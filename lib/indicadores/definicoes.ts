/**
 * Definição ÚNICA dos indicadores operacionais (Dashboard, Desempenho, exportação, links para a
 * listagem). Cada indicador declara a população, o critério temporal e o denominador.
 *
 * População base: chamados não excluídos e não marcados como teste, no escopo de polo do usuário.
 * Chamados importados de planilha entram nos indicadores operacionais (são demanda real), mas
 * ficam fora da pontuação individual (lib/indicadores/pontuacao.ts).
 *
 *  a) abertos_no_periodo      — data de abertura dentro do período.
 *  b) resolvidos_no_periodo   — situação "concluido" e dia da conclusão dentro do período.
 *     encerrados_no_periodo   — situação "encerrado" e dia do encerramento dentro do período.
 *  c) estoque_pendente        — pendentes AGORA (independe do período): rascunho, aberto, em
 *                               atendimento, aguardando aluno, aguardando externo.
 *  d) vencidos_pendentes      — do estoque, prazo < hoje (independe do período).
 *     vencem_ate_2_dias       — do estoque, prazo entre hoje e hoje + 2 dias corridos.
 *  e) resolvidos_no_prazo     — dos resolvidos no período, dia da conclusão <= prazo.
 *
 *  taxa_resolucao  = resolvidos entre os abertos no período ÷ abertos no período (coorte).
 *  taxa_sla        = resolvidos_no_prazo ÷ resolvidos_no_periodo.
 *  tempo_medio     = média em DIAS ÚTEIS (mesma regra do SLA) entre abertura e resolução, dos
 *                    resolvidos no período, ponderada por chamado (não é média de médias).
 *  Denominador zero → valor null, exibido como "—" (sem dados), nunca 0%.
 */

import { classificarPrazo, concluidoNoPrazo, diasUteisEntre, type FeriadosExtras } from "../sla";
import type { DataCivil } from "../datas";
import { ehPendente } from "../chamados/situacoes";

export interface ChamadoIndicador {
  id: string;
  situacao: string;
  data_solicitacao: DataCivil;
  prazo: DataCivil;
  dia_conclusao: DataCivil | null;
  motivo_codigo?: string | null;
  motivo_nome?: string | null;
  responsavel_id?: string | null;
}

export interface Periodo {
  inicio: DataCivil;
  fim: DataCivil;
}

export interface Indicadores {
  periodo: Periodo;
  hoje: DataCivil;
  abertos_no_periodo: number;
  resolvidos_no_periodo: number;
  encerrados_no_periodo: number;
  resolvidos_no_prazo: number;
  estoque_pendente: number;
  vencidos_pendentes: number;
  vencem_ate_2_dias: number;
  coorte_resolvidos: number;
  taxa_resolucao: number | null;
  taxa_sla: number | null;
  tempo_medio_dias_uteis: number | null;
}

const arred1 = (n: number) => Math.round(n * 10) / 10;

export function dentroDoPeriodo(dia: DataCivil | null, p: Periodo): boolean {
  return !!dia && dia >= p.inicio && dia <= p.fim;
}

export function calcularIndicadores(
  chamados: ChamadoIndicador[],
  periodo: Periodo,
  hoje: DataCivil,
  feriadosExtras?: FeriadosExtras
): Indicadores {
  let abertos = 0;
  let coorteResolvidos = 0;
  let resolvidos = 0;
  let encerrados = 0;
  let noPrazo = 0;
  let diasUteis = 0;
  let estoque = 0;
  let vencidos = 0;
  let vencendo = 0;

  for (const c of chamados) {
    if (dentroDoPeriodo(c.data_solicitacao, periodo)) {
      abertos++;
      if (c.situacao === "concluido") coorteResolvidos++;
    }
    if (c.situacao === "concluido" && dentroDoPeriodo(c.dia_conclusao, periodo)) {
      resolvidos++;
      if (concluidoNoPrazo(c.dia_conclusao!, c.prazo)) noPrazo++;
      diasUteis += diasUteisEntre(c.data_solicitacao, c.dia_conclusao!, feriadosExtras);
    }
    if (c.situacao === "encerrado" && dentroDoPeriodo(c.dia_conclusao, periodo)) encerrados++;
    if (ehPendente(c.situacao)) {
      estoque++;
      const cls = classificarPrazo(c.prazo, hoje);
      if (cls === "vencido") vencidos++;
      else if (cls === "vence_hoje" || cls === "vence_em_breve") vencendo++;
    }
  }

  return {
    periodo,
    hoje,
    abertos_no_periodo: abertos,
    resolvidos_no_periodo: resolvidos,
    encerrados_no_periodo: encerrados,
    resolvidos_no_prazo: noPrazo,
    estoque_pendente: estoque,
    vencidos_pendentes: vencidos,
    vencem_ate_2_dias: vencendo,
    coorte_resolvidos: coorteResolvidos,
    taxa_resolucao: abertos > 0 ? arred1((coorteResolvidos / abertos) * 100) : null,
    taxa_sla: resolvidos > 0 ? arred1((noPrazo / resolvidos) * 100) : null,
    tempo_medio_dias_uteis: resolvidos > 0 ? arred1(diasUteis / resolvidos) : null,
  };
}

export interface TempoPorGrupo {
  chave: string;
  rotulo: string;
  resolvidos: number;
  tempo_medio_dias_uteis: number;
}

/** Tempo médio por motivo/responsável, dos resolvidos no período, em dias úteis. */
export function tempoMedioPorGrupo(
  chamados: ChamadoIndicador[],
  periodo: Periodo,
  grupo: (c: ChamadoIndicador) => { chave: string; rotulo: string },
  feriadosExtras?: FeriadosExtras
): TempoPorGrupo[] {
  const acc = new Map<string, { rotulo: string; n: number; dias: number }>();
  for (const c of chamados) {
    if (c.situacao !== "concluido" || !dentroDoPeriodo(c.dia_conclusao, periodo)) continue;
    const g = grupo(c);
    const a = acc.get(g.chave) ?? { rotulo: g.rotulo, n: 0, dias: 0 };
    a.n++;
    a.dias += diasUteisEntre(c.data_solicitacao, c.dia_conclusao!, feriadosExtras);
    acc.set(g.chave, a);
  }
  return [...acc.entries()].map(([chave, a]) => ({
    chave,
    rotulo: a.rotulo,
    resolvidos: a.n,
    tempo_medio_dias_uteis: arred1(a.dias / a.n),
  }));
}
