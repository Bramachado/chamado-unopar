import { cache } from "react";
import { redirect } from "next/navigation";
import { verificarSessao, destruirSessao, type PayloadSessao } from "./jwt";
import { getPool, resetPool, sql } from "@/lib/db/pool";
import { obterAvatarUsuario } from "./avatar";
import { type Perfil } from "@/types/database";

/**
 * Sessões emitidas antes de perfis.sessao_valida_desde (troca/redefinição de senha) são recusadas.
 * A desativação da conta também é verificada a cada requisição (perfil.ativo).
 */
export function sessaoAindaValida(sessao: PayloadSessao, sessaoValidaDesde: unknown): boolean {
  if (!sessaoValidaDesde) return true;
  const limite = new Date(sessaoValidaDesde as string | Date).getTime();
  if (Number.isNaN(limite)) return true;
  const emitidaEm = (sessao.iat ?? 0) * 1000;
  return emitidaEm >= limite - 1000;
}

const CONSULTA_PERFIL = `
  SELECT CAST(p.id AS NVARCHAR(50)) AS id, p.nome_completo, p.email, p.papel, p.ativo,
    CAST(p.polo_id AS NVARCHAR(50)) AS polo_id, pol.nome AS polo_nome, pol.cidade AS polo_cidade,
    p.criado_em, p.atualizado_em, p.sessao_valida_desde
  FROM dados.perfis p
  LEFT JOIN dados.polos pol ON pol.id = p.polo_id
  WHERE p.id = TRY_CAST(@id AS UNIQUEIDENTIFIER)`;

async function buscarPerfil(id: string) {
  const pool = await getPool();
  return (await pool.request().input("id", sql.VarChar(50), id).query(CONSULTA_PERFIL))
    .recordset[0];
}

/**
 * Obtém o perfil atual autenticado diretamente de dados.perfis.
 * O cache de requisição do React desduplica chamadas entre layout e página na mesma renderização.
 */
export const obterPerfilAtual = cache(async (): Promise<Perfil> => {
  const sessao = await verificarSessao();
  if (!sessao) redirect("/login");

  let perfil: Record<string, unknown> | undefined;
  try {
    perfil = await buscarPerfil(sessao.id);
  } catch (err) {
    resetPool();
    console.warn("Reconectando banco em obterPerfilAtual...", (err as Error)?.message);
    perfil = await buscarPerfil(sessao.id);
  }

  if (!perfil || !perfil.ativo || !sessaoAindaValida(sessao, perfil.sessao_valida_desde)) {
    await destruirSessao();
    redirect("/login");
  }

  const avatarUrl = await obterAvatarUsuario(String(perfil.id));
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : new Date().toISOString());

  return {
    id: String(perfil.id),
    nome_completo: String(perfil.nome_completo),
    email: String(perfil.email),
    papel: perfil.papel as Perfil["papel"],
    ativo: Boolean(perfil.ativo),
    polo_id: (perfil.polo_id as string) || null,
    polo_nome: (perfil.polo_nome as string) || null,
    polo_cidade: (perfil.polo_cidade as string) || null,
    avatar_url: avatarUrl,
    criado_em: iso(perfil.criado_em),
    atualizado_em: iso(perfil.atualizado_em),
  };
});
