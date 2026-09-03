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

import bcrypt from "bcryptjs";
import { getPool, sql } from "../lib/db/pool";

async function definirSenhaTeste() {
  const email = process.env.TEST_EMAIL_ADMIN || "teste.admin@unopar.br";
  const novaSenha = process.env.TEST_SENHA_ADMIN || "SenhaSegura@2026Admin";

  console.log("=== DEFININDO SENHA REAL PARA USUÁRIA DE TESTE ===");
  console.log("E-mail:", email);

  const pool = await getPool();

  // 1. Localiza a usuária
  const res = await pool.request()
    .input("email", sql.VarChar(255), email.toLowerCase().trim())
    .query("SELECT CAST(id AS NVARCHAR(50)) AS id, nome_completo, papel, ativo, senha_hash FROM dados.perfis WHERE email = @email");

  const perfil = res.recordset[0];
  if (!perfil) {
    console.error("[ERRO]: Usuária de teste não encontrada em dados.perfis.");
    process.exit(1);
  }

  console.log("[OK] Usuária localizada:", perfil.nome_completo, "| Papel:", perfil.papel, "| Hash atual:", perfil.senha_hash);

  // 2. Gera hash bcrypt custo 12
  const hash = await bcrypt.hash(novaSenha, 12);

  // 3. Atualiza no banco
  await pool.request()
    .input("id", sql.UniqueIdentifier, perfil.id)
    .input("hash", sql.VarChar(255), hash)
    .query("UPDATE dados.perfis SET senha_hash = @hash, atualizado_em = SYSUTCDATETIME() WHERE id = @id");

  console.log("[OK] Senha atualizada com sucesso no SQL Server.");
  console.log("Nova senha em texto plano:", novaSenha);
  console.log("Novo hash bcrypt:", hash);
  process.exit(0);
}

definirSenhaTeste().catch((err) => {
  console.error("[ERRO]:", err);
  process.exit(1);
});
