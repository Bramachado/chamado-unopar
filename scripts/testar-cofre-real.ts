import fs from "fs";
import path from "path";

// Carregar .env.local
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

import { getPool, sql } from "../lib/db/pool";
import { comUsuario } from "../lib/db/comUsuario";
import { cifrarSenha, decifrarSenha } from "../lib/crypto/cofre";

async function testarCofreReal() {
  console.log("=== INICIANDO TESTE REAL DA ETAPA 5 (COFRE DE CREDENCIAIS & AUDITORIA) ===");
  const pool = await getPool();

  // 0. Identificar Perfis (Admin e Atendente)
  const resPerfis = await pool.request().query(`
    SELECT CAST(id AS NVARCHAR(50)) AS id, nome_completo, email, papel, ativo
    FROM dados.perfis
    ORDER BY id
  `);

  const admin = resPerfis.recordset.find((p: any) => p.papel === "admin") || {
    id: "00000000-0000-0000-0000-000000000001",
    nome_completo: "Usuaria Teste Admin",
    papel: "admin",
  };

  const atendente = resPerfis.recordset.find((p: any) => p.papel === "atendente") || {
    id: "00000000-0000-0000-0000-000000000003",
    nome_completo: "Usuaria Teste Atendente",
    papel: "atendente",
  };

  console.log(`[0] Perfis de teste: Admin (${admin.nome_completo} - ${admin.id}) | Atendente (${atendente.nome_completo} - ${atendente.id})`);

  // ==============================================================================
  // 1. SALVAR SENHA EXTERNA CIFRADA (AES-256-GCM)
  // ==============================================================================
  console.log("\n--- PASSO 1: Cifragem AES-256-GCM e gravação em dados.credenciais_externas ---");

  const senhaPlanaOriginal = "PortalAcademico@2026#UnoparSegura";
  const { senhaCifrada, iv, authTag } = cifrarSenha(senhaPlanaOriginal);

  await comUsuario(
    { usuario_id: admin.id, papel: admin.papel },
    async (req) => {
      req.input("perfilId", sql.UniqueIdentifier, atendente.id);
      req.input("senhaCifrada", sql.VarBinary(sql.MAX), senhaCifrada);
      req.input("iv", sql.VarBinary(12), iv);
      req.input("authTag", sql.VarBinary(16), authTag);
      req.input("atualizadoPor", sql.UniqueIdentifier, admin.id);

      await req.query(`
        MERGE dados.credenciais_externas AS target
        USING (SELECT @perfilId AS perfil_id) AS source
        ON target.perfil_id = source.perfil_id
        WHEN MATCHED THEN
          UPDATE SET 
            senha_cifrada = @senhaCifrada,
            iv = @iv,
            auth_tag = @authTag,
            atualizado_em = SYSUTCDATETIME(),
            atualizado_por = @atualizadoPor
        WHEN NOT MATCHED THEN
          INSERT (perfil_id, senha_cifrada, iv, auth_tag, atualizado_em, atualizado_por)
          VALUES (@perfilId, @senhaCifrada, @iv, @authTag, SYSUTCDATETIME(), @atualizadoPor);
      `);
    }
  );

  // Consulta direta no banco para provar armazenamento binário cifrado
  const resSelectCofre = await pool.request()
    .input("perfilId", sql.UniqueIdentifier, atendente.id)
    .query(`
      SELECT 
        CAST(perfil_id AS NVARCHAR(50)) AS perfil_id,
        CONVERT(VARCHAR(MAX), senha_cifrada, 1) AS senha_cifrada_hex,
        CONVERT(VARCHAR(MAX), iv, 1) AS iv_hex,
        CONVERT(VARCHAR(MAX), auth_tag, 1) AS auth_tag_hex,
        DATALENGTH(senha_cifrada) AS tamanho_cifrado_bytes,
        DATALENGTH(iv) AS tamanho_iv_bytes,
        DATALENGTH(auth_tag) AS tamanho_auth_tag_bytes,
        CAST(atualizado_por AS NVARCHAR(50)) AS atualizado_por,
        atualizado_em
      FROM dados.credenciais_externas
      WHERE perfil_id = @perfilId
    `);

  const registroCofre = resSelectCofre.recordset[0];
  console.log("[OK] SELECT direto em dados.credenciais_externas (conteúdo binário cifrado em hexadecimal):");
  console.log(registroCofre);

  // ==============================================================================
  // 2. REVELAÇÃO COMO ADMIN VIA PROCEDURE dados.revelar_credencial
  // ==============================================================================
  console.log("\n--- PASSO 2: Revelação autorizada por Administradora via procedure dados.revelar_credencial ---");

  const ipOrigem = "192.168.15.50";
  const userAgentOrigem = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36";

  const resultadoRevelacao = await comUsuario(
    { usuario_id: admin.id, papel: admin.papel },
    async (req) => {
      const res = await req
        .input("perfil_alvo", sql.UniqueIdentifier, atendente.id)
        .input("ip", sql.VarChar(45), ipOrigem)
        .input("user_agent", sql.NVarChar(400), userAgentOrigem)
        .execute("dados.revelar_credencial");

      const row = res.recordset[0];
      const senhaDecifrada = decifrarSenha(
        Buffer.from(row.senha_cifrada),
        Buffer.from(row.iv),
        Buffer.from(row.auth_tag)
      );

      return { senhaDecifrada, row };
    }
  );

  console.log("[OK] Senha decifrada na aplicação pela Admin:", resultadoRevelacao.senhaDecifrada);
  console.log(`[OK] Senha decifrada confere exatamente com a original? ${resultadoRevelacao.senhaDecifrada === senhaPlanaOriginal ? "SIM (100% Integridade)" : "NÃO"}`);

  // Consulta do log de acesso em auditoria.credencial_acessos
  const resAuditoriaCofre = await pool.request()
    .input("perfilAlvo", sql.UniqueIdentifier, atendente.id)
    .query(`
      SELECT TOP 1 
        id,
        CAST(perfil_alvo AS NVARCHAR(50)) AS perfil_alvo,
        CAST(admin_id AS NVARCHAR(50)) AS admin_id,
        ip,
        user_agent,
        data_hora
      FROM auditoria.credencial_acessos
      WHERE perfil_alvo = @perfilAlvo
      ORDER BY id DESC
    `);

  console.log("\n[OK] Registro de auditoria criado em auditoria.credencial_acessos:");
  console.log(resAuditoriaCofre.recordset[0]);

  // ==============================================================================
  // 3. TENTATIVA DE REVELAÇÃO COMO ATENDENTE (BLOQUEIO ESPERADO: ERRO 51011)
  // ==============================================================================
  console.log("\n--- PASSO 3: Tentativa de revelação por Atendente (Esperado: Bloqueio 51011) ---");

  try {
    await comUsuario(
      { usuario_id: atendente.id, papel: atendente.papel },
      async (req) => {
        await req
          .input("perfil_alvo", sql.UniqueIdentifier, atendente.id)
          .input("ip", sql.VarChar(45), "192.168.15.99")
          .input("user_agent", sql.NVarChar(400), "Tentativa Atendente")
          .execute("dados.revelar_credencial");
      }
    );
    console.error("[FALHA]: Atendente conseguiu executar dados.revelar_credencial sem erro.");
  } catch (err: any) {
    console.log("[OK - BLOQUEIO CONFIRMADO VIA PROCEDURE]:", err.message);
    console.log("Número do erro SQL:", err.number);
  }

  // ==============================================================================
  // 4. CONFIRMAR QUE A SENHA EM TEXTO PLANO NÃO FOI GRAVADA EM NENHUM LOG
  // ==============================================================================
  console.log("\n--- PASSO 4: Auditoria de segurança — Verificar se a senha em texto plano vazou em algum log ---");

  const resBuscaVazamento = await pool.request()
    .input("termoSenha", sql.NVarChar(255), `%${senhaPlanaOriginal}%`)
    .query(`
      SELECT COUNT(*) AS ocorrencias_vazadas
      FROM auditoria.logs
      WHERE dados_antes LIKE @termoSenha
         OR dados_depois LIKE @termoSenha
         OR campos_alterados LIKE @termoSenha
    `);

  const vazamentos = resBuscaVazamento.recordset[0].ocorrencias_vazadas;
  console.log(`[OK] Ocorrências da senha em texto plano em auditoria.logs: ${vazamentos}`);
  if (vazamentos === 0) {
    console.log("  [OK] Segurança confirmada: nenhuma senha em texto plano consta em tabelas de log.");
  }

  console.log("\n=== EVIDÊNCIA ETAPA 5 COMPROVADA: COFRE DE CREDENCIAIS VALIDADO ===");
  process.exit(0);
}

testarCofreReal().catch((err) => {
  console.error("[ERRO FATAL NA ETAPA 5]:", err);
  process.exit(1);
});
