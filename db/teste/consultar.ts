/** Executa SQL arbitrário no banco de TESTES local (como sa). Uso: npx tsx db/teste/consultar.ts "<sql>" */
import sql from "mssql";

async function main() {
  const pool = await new sql.ConnectionPool({
    server: "localhost",
    port: Number(process.env.TESTE_DB_PORTA ?? 14333),
    user: "sa",
    password: process.env.TESTE_DB_SA_SENHA,
    database: "ChamadosTeste",
    options: { encrypt: true, trustServerCertificate: true },
  }).connect();
  const r = await pool.request().query(process.argv[2] ?? "SELECT 1");
  for (const rs of r.recordsets as unknown as unknown[][]) console.table(rs);
  await pool.close();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
