"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getPool, sql } from "@/lib/db/pool";
import { criarSessao, destruirSessao } from "@/lib/auth/jwt";

const loginSchema = z.object({
  email: z.string().email("Informe um endereço de e-mail válido."),
  senha: z.string().min(1, "Informe a senha de acesso."),
});

const definirSenhaSchema = z.object({
  email: z.string().email("Informe um endereço de e-mail válido."),
  novaSenha: z.string().min(6, "A nova senha deve possuir no mínimo 6 caracteres."),
});

export type EstadoLogin = {
  erro?: string;
  sucesso?: boolean;
};

export async function autenticarUsuario(
  _estadoAnterior: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const dados = {
    email: formData.get("email"),
    senha: formData.get("senha"),
  };

  const validacao = loginSchema.safeParse(dados);
  if (!validacao.success) {
    return {
      erro: validacao.error.issues[0]?.message ?? "Dados de formulário inválidos.",
    };
  }

  const { email, senha } = validacao.data;
  const pool = await getPool();
  const request = pool.request();

  const resultado = await request.input("email", sql.VarChar(255), email.toLowerCase().trim())
    .query(`
      SELECT 
        CAST(p.id AS NVARCHAR(50)) AS id,
        p.nome_completo,
        p.email,
        p.papel,
        p.ativo,
        p.senha_hash,
        CAST(p.polo_id AS NVARCHAR(50)) AS polo_id,
        pol.nome AS polo_nome
      FROM dados.perfis p
      LEFT JOIN dados.polos pol ON pol.id = p.polo_id
      WHERE p.email = @email
    `);

  const perfil = resultado.recordset[0];

  // Mensagem genérica para não revelar existência de e-mail
  const mensagemErroGenerico =
    "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.";

  if (!perfil) {
    return { erro: mensagemErroGenerico };
  }

  // Verifica se a conta está ativa
  if (!perfil.ativo) {
    return { erro: "Esta conta foi desativada pela coordenação ou administração." };
  }

  // Senhas com valor provisório exigem definição inicial
  if (!perfil.senha_hash || perfil.senha_hash === "PROVISORIO_TROCAR_VIA_APP") {
    return {
      erro: "Senha inicial ainda não definida para este usuário. Use a opção de definição de senha inicial.",
    };
  }

  const senhaValida = await bcrypt.compare(senha, perfil.senha_hash);

  if (!senhaValida) {
    return { erro: mensagemErroGenerico };
  }

  await criarSessao({
    id: perfil.id,
    email: perfil.email,
    nome_completo: perfil.nome_completo,
    papel: perfil.papel,
    polo_id: perfil.polo_id || null,
    polo_nome: perfil.polo_nome || null,
  });

  redirect("/painel");
}

export async function logoutUsuario() {
  await destruirSessao();
  redirect("/login");
}

/**
 * Permite definir a senha real inicial para usuárias de teste que estão com 'PROVISORIO_TROCAR_VIA_APP'.
 * Custo do bcrypt: 12.
 */
export async function definirSenhaInicial(
  formData: FormData
): Promise<{ erro?: string; sucesso?: boolean }> {
  const dados = {
    email: formData.get("email"),
    novaSenha: formData.get("novaSenha"),
  };

  const validacao = definirSenhaSchema.safeParse(dados);
  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const pool = await getPool();
  const request = pool.request();

  const resultado = await request.input(
    "email",
    sql.VarChar(255),
    validacao.data.email.toLowerCase().trim()
  ).query(`
      SELECT 
        CAST(id AS NVARCHAR(50)) AS id,
        senha_hash
      FROM dados.perfis
      WHERE email = @email
    `);

  const perfil = resultado.recordset[0];
  if (!perfil) {
    return { erro: "Usuário não localizado." };
  }

  const hash = await bcrypt.hash(validacao.data.novaSenha, 12);

  await pool
    .request()
    .input("id", sql.UniqueIdentifier, perfil.id)
    .input("hash", sql.VarChar(255), hash).query(`
      UPDATE dados.perfis
      SET senha_hash = @hash, atualizado_em = SYSUTCDATETIME()
      WHERE id = @id
    `);

  return { sucesso: true };
}
