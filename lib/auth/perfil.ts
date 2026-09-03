import { redirect } from "next/navigation";
import { verificarSessao, destruirSessao } from "./jwt";
import { getPool, sql } from "@/lib/db/pool";
import { type Perfil } from "@/types/database";

/**
 * Obtém o perfil atual autenticado diretamente de dados.perfis.
 * Garante que decisões de autorização sempre reconsultam o banco em tempo real.
 */
export async function obterPerfilAtual(): Promise<Perfil> {
  const sessao = await verificarSessao();

  if (!sessao) {
    redirect("/login");
  }

  const pool = await getPool();
  const request = pool.request();

  const resultado = await request
    .input("id", sql.UniqueIdentifier, sessao.id)
    .query(`
      SELECT 
        CAST(id AS NVARCHAR(50)) AS id,
        nome_completo,
        email,
        papel,
        ativo,
        criado_em,
        atualizado_em
      FROM dados.perfis
      WHERE id = @id
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
    criado_em: perfil.criado_em ? new Date(perfil.criado_em).toISOString() : new Date().toISOString(),
    atualizado_em: perfil.atualizado_em ? new Date(perfil.atualizado_em).toISOString() : new Date().toISOString(),
  };
}
