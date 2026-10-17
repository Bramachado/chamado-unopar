/** Testa as reversões no banco de TESTES local: desfaz 0004→0001 e reaplica. */
import fs from "fs";
import path from "path";
import sql from "mssql";
import { dividirEmLotes, aplicarMigracoes, PASTA_MIGRACOES } from "../migracoes";
async function main() {
  const pool = await new sql.ConnectionPool({
    server: "localhost",
    port: Number(process.env.TESTE_DB_PORTA ?? 14333),
    user: "sa",
    password: process.env.TESTE_DB_SA_SENHA,
    database: "ChamadosTeste",
    options: { encrypt: true, trustServerCertificate: true },
  }).connect();
  for (const v of [
    "0004_seguranca_e_auditoria",
    "0003_motivos_chave_e_consolidacao",
    "0002_fluxo_e_responsavel",
    "0001_prazo_e_feriados",
  ]) {
    for (const lote of dividirEmLotes(
      fs.readFileSync(path.join(PASTA_MIGRACOES, "rollback", `${v}.down.sql`), "utf8")
    ))
      await pool.request().batch(lote);
    console.log("revertida", v);
  }
  const r = await pool
    .request()
    .query("SELECT COUNT(*) n FROM dados.chamados; SELECT versao FROM dbo.migracoes_aplicadas");
  const conjuntos = r.recordsets as unknown as Record<string, unknown>[][];
  console.log(
    "chamados preservados:",
    conjuntos[0]![0]!.n,
    "| versoes:",
    conjuntos[1]!.map((x) => x.versao).join(",")
  );
  console.log(
    "reaplicadas:",
    (await aplicarMigracoes(pool, { incluirBaseline: false, log: () => {} })).join(",")
  );
  await pool.close();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
