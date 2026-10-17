/**
 * Pontuação de desempenho — implementação ÚNICA, usada no ranking, nos destaques, na média da
 * equipe, na evolução histórica e na explicação exibida na tela.
 *
 * Fórmula (versão "2026-10", a mesma descrita na tela "Critérios de Avaliação"):
 *  1. Volume (0–40): 40 × volume ponderado da pessoa ÷ maior volume ponderado entre os
 *     participantes elegíveis no mesmo recorte. Volume ponderado = resolvidos × 1,0 +
 *     encerrados sem solução × 0,5. Como a razão é ≤ 1, o máximo é 40 por construção.
 *  2. Cumprimento do prazo (0–40): 40 × resolvidos no prazo ÷ resolvidos.
 *  3. Agilidade (0–20): pela média de dias úteis entre abertura e resolução:
 *     ≤ 1 → 20; ≤ 2 → 15; ≤ 3 → 10; > 3 → 5. Sem resolvidos → 0.
 *  Total = soma dos três componentes já arredondados (1 casa) — a soma exibida bate com a nota.
 *  Logo 0 ≤ total ≤ 100 sem nenhum limitador artificial.
 *
 * Regras de contagem (cada chamado conta uma única vez, pelo seu ESTADO no fim do cálculo):
 *  - Considera chamados com abertura no período, não excluídos, não marcados como teste e não
 *    importados de planilha.
 *  - Atribuição: responsável atual (ou o criador nos registros antigos sem responsável).
 *    Transferências passam o chamado inteiro para o novo responsável.
 *  - Resolvido (concluido) conta como resolvido; reaberto e resolvido de novo continua contando
 *    uma vez, com a data da última resolução. Reaberto e ainda pendente não conta.
 *  - Encerrado sem solução conta só no volume (peso 0,5); não entra em prazo nem agilidade.
 *  - Elegibilidade: perfis ativos com papel diferente de admin. Quem não tem chamado no recorte
 *    aparece como "sem chamados", com nota nula, e não entra na média da equipe nem no pódio.
 */

import { diasUteisEntre, concluidoNoPrazo, type FeriadosExtras } from "../sla";
import type { DataCivil } from "../datas";

export const VERSAO_FORMULA = "2026-10";

export const PESOS = {
  volumeMaximo: 40,
  prazoMaximo: 40,
  agilidadeMaxima: 20,
  pesoResolvido: 1,
  pesoEncerrado: 0.5,
  faixasAgilidade: [
    { ateDiasUteis: 1, pontos: 20 },
    { ateDiasUteis: 2, pontos: 15 },
    { ateDiasUteis: 3, pontos: 10 },
  ],
  pontosAgilidadeAcimaDasFaixas: 5,
} as const;

export interface ChamadoPontuavel {
  id: string;
  responsavel_id: string;
  situacao: string;
  data_solicitacao: DataCivil;
  prazo: DataCivil;
  /** Dia civil (fuso institucional) da conclusão/encerramento, se finalizado. */
  dia_conclusao: DataCivil | null;
}

export interface Participante {
  id: string;
  nome_completo: string;
  email?: string;
  papel: string;
}

export interface ComponentesNota {
  volume: number;
  prazo: number;
  agilidade: number;
}

export interface LinhaRanking {
  posicao: number | null;
  usuario_id: string;
  nome_completo: string;
  email: string;
  papel: string;
  elegivel: boolean;
  volume_total: number;
  resolvidos: number;
  encerrados: number;
  pendentes: number;
  volume_ponderado: number;
  no_prazo: number;
  taxa_prazo: number | null;
  dias_uteis_resolucao_total: number;
  tempo_medio_dias_uteis: number | null;
  pontos: ComponentesNota;
  pontos_total: number | null;
  chamados_considerados: string[];
}

export interface ResumoEquipe {
  participantes_elegiveis: number;
  media_pontos: number | null;
  resolvidos: number;
  no_prazo: number;
  /** Ponderada por chamado: total no prazo ÷ total resolvido. */
  taxa_prazo: number | null;
  /** Ponderada por chamado: soma de dias úteis ÷ total resolvido. */
  tempo_medio_dias_uteis: number | null;
}

const arred1 = (n: number) => Math.round(n * 10) / 10;

export function pontosAgilidade(tempoMedioDiasUteis: number | null): number {
  if (tempoMedioDiasUteis === null) return 0;
  for (const f of PESOS.faixasAgilidade) {
    if (tempoMedioDiasUteis <= f.ateDiasUteis) return f.pontos;
  }
  return PESOS.pontosAgilidadeAcimaDasFaixas;
}

/**
 * Calcula o ranking a partir dos chamados JÁ filtrados pelo recorte (período/polo/teste/importado).
 */
export function calcularRanking(
  participantes: Participante[],
  chamados: ChamadoPontuavel[],
  feriadosExtras?: FeriadosExtras
): { linhas: LinhaRanking[]; equipe: ResumoEquipe } {
  const porPessoa = new Map<string, LinhaRanking>();
  for (const p of participantes) {
    if (p.papel === "admin") continue;
    porPessoa.set(p.id, {
      posicao: null,
      usuario_id: p.id,
      nome_completo: p.nome_completo,
      email: p.email ?? "",
      papel: p.papel,
      elegivel: false,
      volume_total: 0,
      resolvidos: 0,
      encerrados: 0,
      pendentes: 0,
      volume_ponderado: 0,
      no_prazo: 0,
      taxa_prazo: null,
      dias_uteis_resolucao_total: 0,
      tempo_medio_dias_uteis: null,
      pontos: { volume: 0, prazo: 0, agilidade: 0 },
      pontos_total: null,
      chamados_considerados: [],
    });
  }

  const vistos = new Set<string>();
  for (const c of chamados) {
    if (vistos.has(c.id)) continue; // proteção contra dupla contagem (ex.: linhas repetidas por JOIN)
    vistos.add(c.id);
    const linha = porPessoa.get(c.responsavel_id);
    if (!linha) continue;
    linha.volume_total++;
    linha.chamados_considerados.push(c.id);
    if (c.situacao === "concluido" && c.dia_conclusao) {
      linha.resolvidos++;
      if (concluidoNoPrazo(c.dia_conclusao, c.prazo)) linha.no_prazo++;
      linha.dias_uteis_resolucao_total += diasUteisEntre(
        c.data_solicitacao,
        c.dia_conclusao,
        feriadosExtras
      );
    } else if (c.situacao === "encerrado") {
      linha.encerrados++;
    } else {
      linha.pendentes++;
    }
  }

  for (const l of porPessoa.values()) {
    l.elegivel = l.volume_total > 0;
    l.volume_ponderado = l.resolvidos * PESOS.pesoResolvido + l.encerrados * PESOS.pesoEncerrado;
    l.taxa_prazo = l.resolvidos > 0 ? arred1((l.no_prazo / l.resolvidos) * 100) : null;
    l.tempo_medio_dias_uteis =
      l.resolvidos > 0 ? arred1(l.dias_uteis_resolucao_total / l.resolvidos) : null;
  }

  const elegiveis = [...porPessoa.values()].filter((l) => l.elegivel);
  const maiorVolume = Math.max(0, ...elegiveis.map((l) => l.volume_ponderado));

  for (const l of elegiveis) {
    const volume =
      maiorVolume > 0 ? arred1((PESOS.volumeMaximo * l.volume_ponderado) / maiorVolume) : 0;
    const prazo = l.resolvidos > 0 ? arred1((PESOS.prazoMaximo * l.no_prazo) / l.resolvidos) : 0;
    // A faixa usa o mesmo tempo médio exibido (1 casa), para a explicação bater com a nota.
    const agilidade = pontosAgilidade(l.tempo_medio_dias_uteis);
    l.pontos = { volume, prazo, agilidade };
    l.pontos_total = arred1(volume + prazo + agilidade);
  }

  const linhas = [...porPessoa.values()].sort((a, b) => {
    if (a.elegivel !== b.elegivel) return a.elegivel ? -1 : 1;
    const diff = (b.pontos_total ?? 0) - (a.pontos_total ?? 0);
    return diff !== 0 ? diff : a.nome_completo.localeCompare(b.nome_completo, "pt-BR");
  });
  // Empates recebem a mesma posição (1, 2, 2, 4).
  let posicaoAnterior = 0;
  let notaAnterior: number | null = null;
  linhas.forEach((l, i) => {
    if (!l.elegivel) return;
    if (l.pontos_total !== notaAnterior) {
      posicaoAnterior = i + 1;
      notaAnterior = l.pontos_total;
    }
    l.posicao = posicaoAnterior;
  });

  const resolvidos = elegiveis.reduce((s, l) => s + l.resolvidos, 0);
  const noPrazo = elegiveis.reduce((s, l) => s + l.no_prazo, 0);
  const diasTotais = elegiveis.reduce((s, l) => s + l.dias_uteis_resolucao_total, 0);
  const equipe: ResumoEquipe = {
    participantes_elegiveis: elegiveis.length,
    media_pontos:
      elegiveis.length > 0
        ? arred1(elegiveis.reduce((s, l) => s + (l.pontos_total ?? 0), 0) / elegiveis.length)
        : null,
    resolvidos,
    no_prazo: noPrazo,
    taxa_prazo: resolvidos > 0 ? arred1((noPrazo / resolvidos) * 100) : null,
    tempo_medio_dias_uteis: resolvidos > 0 ? arred1(diasTotais / resolvidos) : null,
  };

  return { linhas, equipe };
}
