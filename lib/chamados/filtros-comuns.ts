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
import { ehDataCivilValida, type DataCivil } from "@/lib/datas";
import { SITUACOES_FINAIS, SITUACOES_PENDENTES, ehSituacao } from "@/lib/chamados/situacoes";
import type { PerfilAutorizacao } from "@/lib/auth/autorizacao";

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
