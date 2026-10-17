/**
 * Aplica as migrações de db/migrations (exceto o baseline 0000) num banco existente.
 *
 *   MIGRACAO_HOST=... MIGRACAO_PORTA=1433 MIGRACAO_BANCO=ChamadosUnopar \
 *   MIGRACAO_USUARIO=<usuário com permissão de DDL> MIGRACAO_SENHA=... \
 *   npx tsx scripts/aplicar-migracoes.ts [--confirmo-banco-remoto]
 *
 * Use um usuário com permissão de alteração de schema (não o app_chamados). Faça backup antes.
 * Para hosts que não sejam localhost, exige --confirmo-banco-remoto.
 */
import sql from "mssql";
import { aplicarMigracoes, listarMigracoes } from "../db/migracoes";

async function main() {
  const host = process.env.MIGRACAO_HOST ?? "";
  const banco = process.env.MIGRACAO_BANCO ?? "";
  if (!host || !banco || !process.env.MIGRACAO_USUARIO) {
    throw new Error("Defina MIGRACAO_HOST, MIGRACAO_BANCO, MIGRACAO_USUARIO e MIGRACAO_SENHA.");
  }
  const local = ["localhost", "127.0.0.1"].includes(host);
  if (!local && !process.argv.includes("--confirmo-banco-remoto")) {
    throw new Error(`Host remoto (${host}). Revise o plano e repita com --confirmo-banco-remoto.`);
  }
  const pool = await new sql.ConnectionPool({
    server: host,
    port: Number(process.env.MIGRACAO_PORTA ?? 1433),
    database: banco,
    user: process.env.MIGRACAO_USUARIO,
    password: process.env.MIGRACAO_SENHA,
    options: { encrypt: true, trustServerCertificate: true },
    requestTimeout: 120_000,
  }).connect();
  console.log(
    `Migrações disponíveis: ${listarMigracoes(false)
      .map((m) => m.versao)
      .join(", ")}`
  );
  const feitas = await aplicarMigracoes(pool, { incluirBaseline: false });
  console.log(feitas.length ? `Aplicadas: ${feitas.join(", ")}` : "Nenhuma migração pendente.");
  await pool.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
