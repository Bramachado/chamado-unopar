"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getPool, resetPool, sql } from "@/lib/db/pool";
import { headers } from "next/headers";
import { criarSessao, destruirSessao } from "@/lib/auth/jwt";
import { ipDoCliente } from "@/lib/auth/ip";
import { registrarFalha, registrarSucesso, segundosDeBloqueio } from "@/lib/auth/limite-tentativas";

// Hash de referência para comparar quando o e-mail não existe (tempo de resposta uniforme).
const HASH_FICTICIO = bcrypt.hashSync("referencia-de-tempo-sem-usuario", 12);

const loginSchema = z.object({
  email: z.string().email("Informe um endereço de e-mail válido."),
  senha: z.string().min(1, "Informe a senha de acesso."),
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
  const ip = ipDoCliente(await headers());
  const chavesLimite = [`email:${email.toLowerCase().trim()}`, ...(ip ? [`ip:${ip}`] : [])];
  const bloqueio = segundosDeBloqueio(chavesLimite);
  if (bloqueio > 0) {
    return {
      erro: `Muitas tentativas de acesso. Aguarde ${Math.ceil(bloqueio / 60)} minuto(s) e tente novamente.`,
    };
  }
  let perfil: any = null;

  try {
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

    perfil = resultado.recordset[0];
  } catch (errDb: any) {
    resetPool();
    console.error("Erro ao consultar banco no login (tentativa 1):", errDb);

    // Tenta uma segunda vez com pool recém-criado
    try {
      const pool2 = await getPool();
      const request2 = pool2.request();
      const resultado2 = await request2.input("email", sql.VarChar(255), email.toLowerCase().trim())
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
      perfil = resultado2.recordset[0];
    } catch (errDb2: any) {
      resetPool();
      console.error("Erro ao consultar banco no login (tentativa 2):", errDb2);
      const msg = errDb2?.message || errDb?.message || "";
      if (msg.includes("Login failed for user")) {
        return {
          erro: "Falha de autenticação com o banco de dados SQL Server (verifique MSSQL_USER e MSSQL_PASSWORD nas variáveis de ambiente).",
        };
      }
      return {
        erro: `Falha ao conectar com o banco de dados (${msg || "tempo esgotado"}). Verifique a conectividade de rede e as credenciais.`,
      };
    }
  }

  // Mensagem genérica para não revelar existência de e-mail
  const mensagemErroGenerico =
    "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.";

  const hashValido = typeof perfil?.senha_hash === "string" && perfil.senha_hash.startsWith("$2");
  const senhaValida = await bcrypt.compare(senha, hashValido ? perfil.senha_hash : HASH_FICTICIO);

  if (!perfil || !hashValido || !senhaValida) {
    registrarFalha(chavesLimite);
    if (perfil && !hashValido) {
      return {
        erro: "Senha inicial ainda não definida para este usuário. Solicite à administração a definição da senha.",
      };
    }
    return { erro: mensagemErroGenerico };
  }

  // Só informa que a conta está desativada depois de a senha conferir
  if (!perfil.ativo) {
    return { erro: "Esta conta foi desativada pela coordenação ou administração." };
  }
  registrarSucesso(chavesLimite);

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
