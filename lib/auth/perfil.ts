import { cache } from "react";
import { redirect } from "next/navigation";
import { verificarSessao, destruirSessao } from "./jwt";
import { getPool, resetPool, sql } from "@/lib/db/pool";
import { obterAvatarUsuario } from "./avatar";
import { type Perfil } from "@/types/database";

/**
 * Obtém o perfil atual autenticado diretamente de dados.perfis.
 * O cache de requisição do React desduplica chamadas entre layout e página na mesma renderização.
 */
export const obterPerfilAtual = cache(async (): Promise<Perfil> => {
  const sessao = await verificarSessao();

  if (!sessao) {
    redirect("/login");
  }

  let perfil: any = null;

  try {
    const pool = await getPool();
    const request = pool.request();
    const resultado = await request.input("id", sql.VarChar(50), sessao.id).query(`
        SELECT 
          CAST(p.id AS NVARCHAR(50)) AS id,
          p.nome_completo,
          p.email,
          p.papel,
          p.ativo,
          CAST(p.polo_id AS NVARCHAR(50)) AS polo_id,
          pol.nome AS polo_nome,
          pol.cidade AS polo_cidade,
          p.criado_em,
          p.atualizado_em
        FROM dados.perfis p
        LEFT JOIN dados.polos pol ON pol.id = p.polo_id
        WHERE p.id = @id
      `);
    perfil = resultado.recordset[0];
  } catch (err: any) {
    resetPool();
    console.warn("Reconectando banco em obterPerfilAtual...", err?.message);
    try {
      const pool2 = await getPool();
      const request2 = pool2.request();
      const resultado2 = await request2.input("id", sql.VarChar(50), sessao.id).query(`
          SELECT 
            CAST(p.id AS NVARCHAR(50)) AS id,
            p.nome_completo,
            p.email,
            p.papel,
            p.ativo,
            CAST(p.polo_id AS NVARCHAR(50)) AS polo_id,
            pol.nome AS polo_nome,
            pol.cidade AS polo_cidade,
            p.criado_em,
            p.atualizado_em
          FROM dados.perfis p
          LEFT JOIN dados.polos pol ON pol.id = p.polo_id
          WHERE p.id = @id
        `);
      perfil = resultado2.recordset[0];
    } catch (err2: any) {
      resetPool();
      console.error("Falha definitiva ao obter perfil atual no banco:", err2);
      throw err2;
    }
  }

  if (!perfil || !perfil.ativo) {
    await destruirSessao();
    redirect("/login");
  }

  const avatarUrl = await obterAvatarUsuario(perfil.id);

  return {
    id: perfil.id,
    nome_completo: perfil.nome_completo,
    email: perfil.email,
    papel: perfil.papel,
    ativo: Boolean(perfil.ativo),
    polo_id: perfil.polo_id || null,
    polo_nome: perfil.polo_nome || null,
    polo_cidade: perfil.polo_cidade || null,
    avatar_url: avatarUrl,
    criado_em: perfil.criado_em
      ? new Date(perfil.criado_em).toISOString()
      : new Date().toISOString(),
    atualizado_em: perfil.atualizado_em
      ? new Date(perfil.atualizado_em).toISOString()
      : new Date().toISOString(),
  };
});
