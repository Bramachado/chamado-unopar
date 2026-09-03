import fs from "fs";
import path from "path";

// Carregar .env.local se existir
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

import { getPool } from "../lib/db/pool";
import { comUsuario } from "../lib/db/comUsuario";

async function testarConexaoEContexto() {
  console.log("=== INICIANDO TESTE DE CONEXAO COM SQL SERVER 2022 ===");
  console.log("Host:", process.env.MSSQL_HOST || "localhost");
  console.log("Database:", process.env.MSSQL_DATABASE || "ChamadosUnopar");
  console.log("User:", process.env.MSSQL_USER || "app_chamados");

  try {
    const pool = await getPool();
    console.log("[OK] Conexão física estabelecida com sucesso.");

    // 1. Teste de consulta direta
    const resVersao = await pool.request().query("SELECT @@VERSION AS versao, DB_NAME() AS banco_atual");
    console.log("[OK] Banco Conectado:", resVersao.recordset[0].banco_atual);
    console.log("[OK] Versão SQL Server:", resVersao.recordset[0].versao.split("\n")[0]);

    // 2. Teste do Wrapper de Contexto (comUsuario)
    const uidFicticio = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const papelFicticio = "admin";

    console.log("\n=== TESTANDO WRAPPER comUsuario E seg.definir_contexto ===");
    const resultadoContexto = await comUsuario(
      { usuario_id: uidFicticio, papel: papelFicticio },
      async (req) => {
        const query = await req.query(`
          SELECT 
            CAST(SESSION_CONTEXT(N'usuario_id') AS NVARCHAR(50)) AS ctx_uid,
            CAST(SESSION_CONTEXT(N'papel') AS NVARCHAR(50)) AS ctx_papel
        `);
        return query.recordset[0];
      }
    );

    console.log("[OK] Contexto Recuperado do SQL Server:", resultadoContexto);

    if (
      resultadoContexto.ctx_uid?.toLowerCase() === uidFicticio.toLowerCase() &&
      resultadoContexto.ctx_papel === papelFicticio
    ) {
      console.log("=== EVIDENCIA ETAPA 1 COMPROVADA: CONTEXTO DEFINIDO COM SUCESSO ===");
    } else {
      console.error("[FALHA] Os valores do SESSION_CONTEXT não conferem.");
    }
  } catch (error) {
    console.error("[ERRO NO TESTE DE CONEXAO]:", error);
  } finally {
    process.exit(0);
  }
}

testarConexaoEContexto();
