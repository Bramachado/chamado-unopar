import { sql } from "@/lib/db/pool";
import { instanteDoBanco } from "@/lib/datas";
import { carregarFeriadosExtras } from "@/lib/feriados";
import type { Motivo, Polo } from "@/types/database";
import type { PerfilAutorizacao } from "@/lib/auth/autorizacao";

/** Motivos ativos (e, se informado, o motivo atual do chamado mesmo inativo), polos do escopo e feriados. */
export async function carregarCatalogosFormulario(
  novaReq: () => sql.Request,
  perfil: PerfilAutorizacao,
  opcoes: { motivoAtualId?: string | null; poloId?: string | null } = {}
): Promise<{ motivos: Motivo[]; polos: Polo[]; feriados: string[] }> {
  const qm = await novaReq().input("motivo_atual", sql.VarChar(50), opcoes.motivoAtualId ?? null)
    .query(`
      SELECT CAST(id AS NVARCHAR(50)) AS id, numero, codigo, nome, nome_normalizado, filtro, descricao, ativo, criado_em
      FROM dados.motivos
      WHERE ativo = 1 OR id = TRY_CAST(@motivo_atual AS UNIQUEIDENTIFIER)
      ORDER BY numero`);
  const reqPolos = novaReq();
  let filtroPolo = "";
  if (perfil.papel !== "admin" && perfil.polo_id) {
    reqPolos.input("meu_polo", sql.UniqueIdentifier, perfil.polo_id);
    filtroPolo = " AND id = @meu_polo";
  }
  const qp = await reqPolos.query(
    `SELECT CAST(id AS NVARCHAR(50)) AS id, nome, codigo, cidade, estado, ativo, criado_em FROM dados.polos WHERE ativo = 1${filtroPolo} ORDER BY nome`
  );
  const feriados = await carregarFeriadosExtras(novaReq(), opcoes.poloId ?? perfil.polo_id ?? null);
  return {
    motivos: qm.recordset.map((m) => ({
      id: m.id,
      numero: m.numero,
      codigo: m.codigo,
      nome: m.ativo ? m.nome : `${m.nome} (inativo)`,
      nome_normalizado: m.nome_normalizado,
      filtro: m.filtro ?? null,
      descricao: m.descricao ?? null,
      ativo: Boolean(m.ativo),
      criado_em: instanteDoBanco(m.criado_em) ?? "",
    })),
    polos: qp.recordset.map((p) => ({
      ...p,
      ativo: Boolean(p.ativo),
      criado_em: instanteDoBanco(p.criado_em) ?? "",
    })),
    feriados,
  };
}

/** Só aceita caminhos internos de retorno para a listagem (evita redirecionamento aberto). */
export function caminhoDeVolta(valor: string | string[] | undefined): string {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (!v) return "/chamados";
  return v.startsWith("/chamados") && !v.startsWith("//") ? v : "/chamados";
}
