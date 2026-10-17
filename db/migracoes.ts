import fs from "fs";
import path from "path";
import sql from "mssql";

export const PASTA_MIGRACOES = path.join(__dirname, "migrations");

/** Divide um script T-SQL em lotes pelo separador GO (linha isolada). */
export function dividirEmLotes(script: string): string[] {
  return script
    .split(/^\s*GO\s*$/gim)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function listarMigracoes(incluirBaseline: boolean): { versao: string; arquivo: string }[] {
  return fs
    .readdirSync(PASTA_MIGRACOES)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .filter((f) => incluirBaseline || !f.startsWith("0000_"))
    .sort()
    .map((f) => ({ versao: f.slice(0, 4), arquivo: path.join(PASTA_MIGRACOES, f) }));
}

/**
 * Aplica as migrações pendentes, registrando cada uma em dbo.migracoes_aplicadas.
 * Cada migração roda numa transação: se um lote falhar, nada daquela migração fica aplicado.
 */
export async function aplicarMigracoes(
  pool: sql.ConnectionPool,
  opcoes: { incluirBaseline: boolean; ate?: string; log?: (m: string) => void }
): Promise<string[]> {
  const log = opcoes.log ?? console.log;
  await pool.request().batch(`
    IF OBJECT_ID('dbo.migracoes_aplicadas') IS NULL
      CREATE TABLE dbo.migracoes_aplicadas (
        versao VARCHAR(10) NOT NULL PRIMARY KEY,
        arquivo NVARCHAR(200) NOT NULL,
        aplicada_em DATETIMEOFFSET(3) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        aplicada_por NVARCHAR(128) NOT NULL DEFAULT SUSER_SNAME()
      );`);
  const aplicadas = new Set(
    (await pool.request().query("SELECT versao FROM dbo.migracoes_aplicadas")).recordset.map(
      (r) => r.versao
    )
  );
  const feitas: string[] = [];
  for (const m of listarMigracoes(opcoes.incluirBaseline)) {
    if (aplicadas.has(m.versao)) continue;
    if (opcoes.ate && m.versao > opcoes.ate) break;
    const lotes = dividirEmLotes(fs.readFileSync(m.arquivo, "utf8"));
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const lote of lotes) await new sql.Request(tx).batch(lote);
      await new sql.Request(tx)
        .input("versao", sql.VarChar(10), m.versao)
        .input("arquivo", sql.NVarChar(200), path.basename(m.arquivo))
        .query("INSERT INTO dbo.migracoes_aplicadas (versao, arquivo) VALUES (@versao, @arquivo)");
      await tx.commit();
      log(`  aplicada ${path.basename(m.arquivo)}`);
      feitas.push(m.versao);
    } catch (e) {
      await tx.rollback().catch(() => {});
      throw new Error(`Falha na migração ${path.basename(m.arquivo)}: ${(e as Error).message}`);
    }
  }
  return feitas;
}
