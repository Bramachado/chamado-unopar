/**
 * Filtros da listagem de chamados — a MESMA definição é usada pela tela, pela exportação CSV e
 * pelos links dos cartões do Dashboard, para que tela e arquivo reconciliem com a mesma população.
 *
 * Parâmetros (query string):
 *  escopo=meus|todos         meus = responsável atual sou eu (padrão para não-admin)
 *  busca                     protocolo (prefixo), nome do aluno, RA; 11 dígitos = CPF exato
 *  situacao                  código da situação, "pendentes" ou "finalizados"
 *  prioridade, motivo_id, polo_id, responsavel_id
 *  abertura_de, abertura_ate      dias civis (AAAA-MM-DD) da data de abertura
 *  conclusao_de, conclusao_ate    dias civis da conclusão/encerramento no fuso institucional
 *  filtro_prazo=vencidos|vence_hoje|vence_em_breve|ate_2_dias|no_prazo  (só pendentes; relativo
 *                            a hoje; ate_2_dias = vence hoje + vence em 1 a 2 dias corridos)
 *  reincidentes=true         aluno com mais de um chamado (mesmo CPF ou, sem CPF, mesmo nome)
 *  incluir_teste=true        (admin) inclui registros marcados como teste
 *  pagina, por_pagina
 * Compatibilidade: data_inicio/data_fim → abertura_de/abertura_ate; filtro_prazo=vence_2dias →
 * vence_em_breve; filtro_prazo=pendentes → situacao=pendentes.
 */
import { sql } from "@/lib/db/pool";
import {
  adicionarDiasCorridos,
  ehDataCivilValida,
  fimDoDiaExclusivoEmUtc,
  inicioDoDiaEmUtc,
  paraParametroDate,
  type DataCivil,
} from "@/lib/datas";
import { REGRA_SLA } from "@/lib/sla";
import {
  SITUACOES,
  SITUACOES_FINAIS,
  SITUACOES_PENDENTES,
  ehSituacao,
} from "@/lib/chamados/situacoes";
import { escopoDeChamados, type PerfilAutorizacao } from "@/lib/auth/autorizacao";

export type FiltroPrazo = "vencidos" | "vence_hoje" | "vence_em_breve" | "ate_2_dias" | "no_prazo";

export interface FiltrosChamados {
  escopo: "meus" | "todos";
  busca?: string;
  situacao?: string;
  prioridade?: string;
  motivo_id?: string;
  polo_id?: string;
  responsavel_id?: string;
  abertura_de?: DataCivil;
  abertura_ate?: DataCivil;
  conclusao_de?: DataCivil;
  conclusao_ate?: DataCivil;
  filtro_prazo?: FiltroPrazo;
  reincidentes?: boolean;
  incluir_teste?: boolean;
  pagina: number;
  por_pagina: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRAZOS: FiltroPrazo[] = [
  "vencidos",
  "vence_hoje",
  "vence_em_breve",
  "ate_2_dias",
  "no_prazo",
];

type Parametros = Record<string, string | string[] | undefined> | URLSearchParams;

function ler(p: Parametros, chave: string): string | undefined {
  const v = p instanceof URLSearchParams ? (p.get(chave) ?? undefined) : p[chave];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== "" && s !== "todos" ? s.trim() : undefined;
}

export function lerFiltros(p: Parametros, perfil: PerfilAutorizacao): FiltrosChamados {
  const data = (k: string, legado?: string) => {
    const v = ler(p, k) ?? (legado ? ler(p, legado) : undefined);
    return v && ehDataCivilValida(v) ? v : undefined;
  };
  const uuid = (k: string) => {
    const v = ler(p, k);
    return v && UUID.test(v) ? v : undefined;
  };
  let situacao = ler(p, "situacao");
  if (situacao && situacao !== "pendentes" && situacao !== "finalizados" && !ehSituacao(situacao))
    situacao = undefined;
  let prazo = ler(p, "filtro_prazo");
  if (prazo === "vence_2dias") prazo = "vence_em_breve";
  if (prazo === "pendentes") {
    situacao = "pendentes";
    prazo = undefined;
  }
  const prioridade = ler(p, "prioridade");
  const escopoParam = ler(p, "escopo");
  return {
    escopo:
      escopoParam === "meus" || escopoParam === "todos"
        ? escopoParam
        : perfil.papel === "admin"
          ? "todos"
          : "meus",
    busca: ler(p, "busca")?.slice(0, 100),
    situacao,
    prioridade: prioridade === "normal" || prioridade === "priorizar" ? prioridade : undefined,
    motivo_id: uuid("motivo_id"),
    polo_id: uuid("polo_id"),
    responsavel_id: uuid("responsavel_id"),
    abertura_de: data("abertura_de", "data_inicio"),
    abertura_ate: data("abertura_ate", "data_fim"),
    conclusao_de: data("conclusao_de"),
    conclusao_ate: data("conclusao_ate"),
    filtro_prazo: PRAZOS.includes(prazo as FiltroPrazo) ? (prazo as FiltroPrazo) : undefined,
    reincidentes: ler(p, "reincidentes") === "true",
    incluir_teste: perfil.papel === "admin" && ler(p, "incluir_teste") === "true",
    pagina: Math.max(1, Number.parseInt(ler(p, "pagina") ?? "1", 10) || 1),
    por_pagina: Math.min(
      200,
      Math.max(10, Number.parseInt(ler(p, "por_pagina") ?? "50", 10) || 50)
    ),
  };
}

/** Converte os filtros em query string (para links equivalentes entre telas). */
export function filtrosParaQuery(f: Partial<FiltrosChamados>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === false || v === null || v === "") continue;
    if ((k === "pagina" && v === 1) || (k === "por_pagina" && v === 50)) continue;
    q.set(k, String(v));
  }
  return q.toString();
}

const lista = (valores: readonly string[]) => valores.map((s) => `'${s}'`).join(", ");
export const SQL_PENDENTES = `(${lista(SITUACOES_PENDENTES)})`;
export const SQL_FINAIS = `(${lista(SITUACOES_FINAIS)})`;

/**
 * Monta o WHERE (alias "c") com escopo de autorização + filtros. `semFiltroPrazo` permite calcular
 * os contadores dos cartões de prazo com os demais filtros aplicados.
 */
export function montarWhere(
  req: sql.Request,
  perfil: PerfilAutorizacao,
  f: FiltrosChamados,
  hoje: DataCivil,
  opcoes: { semFiltroPrazo?: boolean } = {}
): string {
  const w: string[] = ["c.excluido_em IS NULL"];
  if (!f.incluir_teste) w.push("c.eh_teste = 0");

  const escopo = escopoDeChamados(perfil);
  if (escopo.tipo === "polo") {
    req.input("f_escopo_polo", sql.UniqueIdentifier, escopo.poloId);
    w.push("c.polo_id = @f_escopo_polo");
  } else if (escopo.tipo === "proprios") {
    req.input("f_escopo_usuario", sql.UniqueIdentifier, escopo.usuarioId);
    w.push("(c.criado_por = @f_escopo_usuario OR c.responsavel_id = @f_escopo_usuario)");
  }
  if (f.escopo === "meus") {
    req.input("f_eu", sql.UniqueIdentifier, perfil.id);
    w.push("COALESCE(c.responsavel_id, c.criado_por) = @f_eu");
  }

  if (f.busca) {
    const digitos = f.busca.replace(/\D/g, "");
    if (digitos.length === 11 && digitos.length === f.busca.replace(/[.\-\s]/g, "").length) {
      req.input("f_cpf", sql.VarChar(11), digitos);
      w.push("c.aluno_cpf = @f_cpf");
    } else {
      req.input("f_busca", sql.NVarChar(120), `%${f.busca}%`);
      req.input("f_prefixo", sql.VarChar(60), `${f.busca}%`);
      w.push(
        "(c.protocolo LIKE @f_prefixo OR c.aluno_nome LIKE @f_busca OR c.aluno_ra LIKE @f_busca)"
      );
    }
  }
  if (f.situacao === "pendentes") w.push(`c.situacao IN ${SQL_PENDENTES}`);
  else if (f.situacao === "finalizados") w.push(`c.situacao IN ${SQL_FINAIS}`);
  else if (f.situacao && (SITUACOES as readonly string[]).includes(f.situacao)) {
    req.input("f_situacao", sql.VarChar(20), f.situacao);
    w.push("c.situacao = @f_situacao");
  }
  if (f.prioridade) {
    req.input("f_prioridade", sql.VarChar(20), f.prioridade);
    w.push("c.prioridade = @f_prioridade");
  }
  if (f.motivo_id) {
    req.input("f_motivo", sql.UniqueIdentifier, f.motivo_id);
    w.push("c.motivo_id = @f_motivo");
  }
  if (f.polo_id) {
    req.input("f_polo", sql.UniqueIdentifier, f.polo_id);
    w.push("c.polo_id = @f_polo");
  }
  if (f.responsavel_id) {
    req.input("f_responsavel", sql.UniqueIdentifier, f.responsavel_id);
    w.push("COALESCE(c.responsavel_id, c.criado_por) = @f_responsavel");
  }
  if (f.abertura_de) {
    req.input("f_ab_de", sql.Date, paraParametroDate(f.abertura_de));
    w.push("c.data_solicitacao >= @f_ab_de");
  }
  if (f.abertura_ate) {
    req.input("f_ab_ate", sql.Date, paraParametroDate(f.abertura_ate));
    w.push("c.data_solicitacao <= @f_ab_ate");
  }
  if (f.conclusao_de) {
    req.input("f_co_de", sql.DateTimeOffset, inicioDoDiaEmUtc(f.conclusao_de));
    w.push("c.data_conclusao >= @f_co_de");
  }
  if (f.conclusao_ate) {
    req.input("f_co_ate", sql.DateTimeOffset, fimDoDiaExclusivoEmUtc(f.conclusao_ate));
    w.push("c.data_conclusao < @f_co_ate");
  }
  if (f.reincidentes) {
    w.push(`EXISTS (SELECT 1 FROM dados.chamados r WHERE r.excluido_em IS NULL AND r.id <> c.id
      AND ((c.aluno_cpf IS NOT NULL AND r.aluno_cpf = c.aluno_cpf)
        OR (c.aluno_cpf IS NULL AND LOWER(LTRIM(RTRIM(r.aluno_nome))) = LOWER(LTRIM(RTRIM(c.aluno_nome))))))`);
  }
  if (f.filtro_prazo && !opcoes.semFiltroPrazo) {
    req.input("f_hoje", sql.Date, paraParametroDate(hoje));
    req.input(
      "f_limite",
      sql.Date,
      paraParametroDate(adicionarDiasCorridos(hoje, REGRA_SLA.alertaVencendoEmDiasCorridos))
    );
    w.push(`c.situacao IN ${SQL_PENDENTES}`);
    if (f.filtro_prazo === "vencidos") w.push("c.prazo < @f_hoje");
    if (f.filtro_prazo === "vence_hoje") w.push("c.prazo = @f_hoje");
    if (f.filtro_prazo === "vence_em_breve") w.push("c.prazo > @f_hoje AND c.prazo <= @f_limite");
    if (f.filtro_prazo === "ate_2_dias") w.push("c.prazo >= @f_hoje AND c.prazo <= @f_limite");
    if (f.filtro_prazo === "no_prazo") w.push("c.prazo > @f_limite");
  }
  return "WHERE " + w.join("\n  AND ");
}

/** Contadores dos cartões de prazo (com os demais filtros, sem o de prazo). */
export function sqlResumoPrazos(where: string): string {
  return `
    SELECT
      SUM(CASE WHEN c.situacao IN ${SQL_PENDENTES} THEN 1 ELSE 0 END) AS pendentes,
      SUM(CASE WHEN c.situacao IN ${SQL_PENDENTES} AND c.prazo < @r_hoje THEN 1 ELSE 0 END) AS vencidos,
      SUM(CASE WHEN c.situacao IN ${SQL_PENDENTES} AND c.prazo = @r_hoje THEN 1 ELSE 0 END) AS vence_hoje,
      SUM(CASE WHEN c.situacao IN ${SQL_PENDENTES} AND c.prazo > @r_hoje AND c.prazo <= @r_limite THEN 1 ELSE 0 END) AS vence_em_breve
    FROM dados.chamados c
    ${where}`;
}
