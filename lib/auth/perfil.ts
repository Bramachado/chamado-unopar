import { cache } from "react";
import { redirect } from "next/navigation";
import { verificarSessao, destruirSessao } from "./jwt";
import { getPool, sql } from "@/lib/db/pool";
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

  const pool = await getPool();
  const request = pool.request();

  const resultado = await request.input("id", sql.UniqueIdentifier, sessao.id).query(`
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

  const perfil = resultado.recordset[0];

  if (!perfil || !perfil.ativo) {
    await destruirSessao();
    redirect("/login");
  }

  return {
    id: perfil.id,
    nome_completo: perfil.nome_completo,
    email: perfil.email,
    papel: perfil.papel,
    ativo: Boolean(perfil.ativo),
    polo_id: perfil.polo_id || null,
    polo_nome: perfil.polo_nome || null,
    polo_cidade: perfil.polo_cidade || null,
    criado_em: perfil.criado_em
      ? new Date(perfil.criado_em).toISOString()
      : new Date().toISOString(),
    atualizado_em: perfil.atualizado_em
      ? new Date(perfil.atualizado_em).toISOString()
      : new Date().toISOString(),
  };
});
