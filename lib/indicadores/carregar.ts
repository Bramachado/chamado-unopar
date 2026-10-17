/**
 * Carga única dos dados de indicadores (Dashboard e Desempenho), respeitando o escopo de polo do
 * usuário, sem registros excluídos e sem registros marcados como teste.
 */
import { sql } from "@/lib/db/pool";
import { novaRequisicao } from "@/lib/db/comUsuario";
import {
  adicionarMeses,
  dataCivilDeInstante,
  dataCivilDoBanco,
  fimDoMes,
  inicioDoDiaEmUtc,
  inicioDoMes,
  paraParametroDate,
  type DataCivil,
} from "@/lib/datas";
import { escopoDeChamados, type PerfilAutorizacao } from "@/lib/auth/autorizacao";
import { carregarFeriadosExtras } from "@/lib/feriados";
import { SQL_PENDENTES } from "@/lib/chamados/filtros";
import type { ChamadoIndicador, Periodo } from "./definicoes";

export interface ChamadoBase extends ChamadoIndicador {
  responsavel_id: string;
  responsavel_nome: string | null;
  importado: boolean;
  protocolo: string;
  aluno_nome: string;
}

export type CodigoPeriodo = "mes_atual" | "semestre_atual" | "ultimos_12_meses";

export function resolverPeriodo(
  codigo: string | undefined,
  hoje: DataCivil
): { codigo: CodigoPeriodo; periodo: Periodo; rotulo: string } {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  if (codigo === "semestre_atual") {
    const primeiro = mes <= 6;
    return {
      codigo: "semestre_atual",
      periodo: {
        inicio: `${ano}-${primeiro ? "01" : "07"}-01`,
        fim: `${ano}-${primeiro ? "06-30" : "12-31"}`,
      },
      rotulo: `Semestre ${ano}.${primeiro ? 1 : 2}`,
    };
  }
  if (codigo === "ultimos_12_meses") {
    return {
      codigo: "ultimos_12_meses",
      periodo: { inicio: inicioDoMes(adicionarMeses(hoje, -11)), fim: fimDoMes(hoje) },
      rotulo: "Últimos 12 meses",
    };
  }
  return {
    codigo: "mes_atual",
    periodo: { inicio: inicioDoMes(hoje), fim: fimDoMes(hoje) },
    rotulo: "Mês atual",
  };
}

/** Polo efetivo para o filtro: não-admin fica no próprio polo. */
export function poloEfetivo(
  perfil: PerfilAutorizacao,
  solicitado: string | undefined
): string | null {
  const escopo = escopoDeChamados(perfil);
  if (escopo.tipo === "polo") return escopo.poloId;
  return solicitado && /^[0-9a-f-]{36}$/i.test(solicitado) ? solicitado : null;
}

export async function carregarBaseIndicadores(
  tx: sql.Transaction,
  perfil: PerfilAutorizacao,
  opcoes: { poloId: string | null; desde: DataCivil }
): Promise<{
  chamados: ChamadoBase[];
  participantes: {
    id: string;
    nome_completo: string;
    email: string;
    papel: string;
    polo_id: string | null;
  }[];
  feriados: DataCivil[];
}> {
  const escopo = escopoDeChamados(perfil);
  const req = novaRequisicao(tx)
    .input("desde", sql.Date, paraParametroDate(opcoes.desde))
    .input("desde_instante", sql.DateTimeOffset, inicioDoDiaEmUtc(opcoes.desde));
  const filtros: string[] = ["c.excluido_em IS NULL", "c.eh_teste = 0"];
  if (opcoes.poloId) {
    req.input("polo", sql.UniqueIdentifier, opcoes.poloId);
    filtros.push("c.polo_id = @polo");
  }
  if (escopo.tipo === "proprios") {
    req.input("usuario", sql.UniqueIdentifier, escopo.usuarioId);
    filtros.push("(c.criado_por = @usuario OR c.responsavel_id = @usuario)");
  }
  const q = await req.query(`
    SELECT CAST(c.id AS NVARCHAR(50)) AS id, c.protocolo, c.aluno_nome, c.situacao, c.importado,
      CONVERT(CHAR(10), c.data_solicitacao, 23) AS data_solicitacao,
      CONVERT(CHAR(10), c.prazo, 23) AS prazo, c.data_conclusao,
      m.codigo AS motivo_codigo, m.nome AS motivo_nome,
      CAST(COALESCE(c.responsavel_id, c.criado_por) AS NVARCHAR(50)) AS responsavel_id,
      p.nome_completo AS responsavel_nome
    FROM dados.chamados c
    LEFT JOIN dados.motivos m ON m.id = c.motivo_id
    LEFT JOIN dados.perfis p ON p.id = COALESCE(c.responsavel_id, c.criado_por)
    WHERE ${filtros.join(" AND ")}
      AND (c.situacao IN ${SQL_PENDENTES} OR c.data_solicitacao >= @desde OR c.data_conclusao >= @desde_instante)`);

  const reqP = novaRequisicao(tx);
  let filtroPerfis = "ativo = 1 AND papel <> 'admin'";
  if (opcoes.poloId) {
    reqP.input("polo", sql.UniqueIdentifier, opcoes.poloId);
    filtroPerfis += " AND polo_id = @polo";
  } else if (escopo.tipo === "proprios") {
    reqP.input("usuario", sql.UniqueIdentifier, escopo.usuarioId);
    filtroPerfis += " AND id = @usuario";
  }
  const participantes = await reqP.query(
    `SELECT CAST(id AS NVARCHAR(50)) AS id, nome_completo, email, papel, CAST(polo_id AS NVARCHAR(50)) AS polo_id FROM dados.perfis WHERE ${filtroPerfis}`
  );

  return {
    chamados: q.recordset.map((r) => ({
      id: r.id,
      protocolo: r.protocolo,
      aluno_nome: r.aluno_nome,
      situacao: r.situacao,
      importado: Boolean(r.importado),
      data_solicitacao: dataCivilDoBanco(r.data_solicitacao) ?? "",
      prazo: dataCivilDoBanco(r.prazo) ?? "",
      dia_conclusao: r.data_conclusao ? dataCivilDeInstante(r.data_conclusao) : null,
      motivo_codigo: r.motivo_codigo,
      motivo_nome: r.motivo_nome,
      responsavel_id: String(r.responsavel_id).toLowerCase(),
      responsavel_nome: r.responsavel_nome,
    })),
    participantes: participantes.recordset.map((p) => ({ ...p, id: String(p.id).toLowerCase() })),
    feriados: await carregarFeriadosExtras(novaRequisicao(tx), opcoes.poloId),
  };
}
