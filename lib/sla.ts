/**
 * Regra única de prazo (SLA) e dias úteis. Usada no formulário, no servidor, na API do agente,
 * nos indicadores e nas notificações — não deve existir outra implementação.
 *
 * Definições (REGRA_SLA):
 * - Prazo padrão: 5 dias úteis contados a partir da data de abertura.
 * - O dia da abertura NÃO conta: o 1º dia útil é o dia útil seguinte à abertura.
 * - Sábados e domingos não são dias úteis.
 * - Feriados não são dias úteis: os nacionais (calculados abaixo) e os institucionais/locais
 *   cadastrados em dados.feriados (estaduais, municipais e recessos), informados como
 *   `feriadosExtras`. Pontos facultativos (Carnaval, Corpus Christi) só contam se cadastrados.
 * - Mudança de situação (inclusive "aguardando aluno/externo") NÃO pausa o prazo.
 */

import { adicionarDiasCorridos, diaDaSemana, diferencaDiasCorridos, type DataCivil } from "./datas";

export const REGRA_SLA = {
  diasUteisPadrao: 5,
  contaDiaDeAbertura: false,
  diasNaoUteisDaSemana: [0, 6] as readonly number[],
  alertaVencendoEmDiasCorridos: 2,
  pausaAutomaticaEmAguardando: false,
} as const;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function domingoDePascoa(ano: number): DataCivil {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) e Sexta-feira Santa.
 * O Dia Nacional de Zumbi e da Consciência Negra (20/11) é feriado nacional desde 2024.
 */
export function feriadosNacionais(ano: number): Map<DataCivil, string> {
  const f = new Map<DataCivil, string>([
    [`${ano}-01-01`, "Confraternização Universal"],
    [`${ano}-04-21`, "Tiradentes"],
    [`${ano}-05-01`, "Dia do Trabalho"],
    [`${ano}-09-07`, "Independência do Brasil"],
    [`${ano}-10-12`, "Nossa Senhora Aparecida"],
    [`${ano}-11-02`, "Finados"],
    [`${ano}-11-15`, "Proclamação da República"],
    [`${ano}-12-25`, "Natal"],
  ]);
  if (ano >= 2024) f.set(`${ano}-11-20`, "Dia Nacional de Zumbi e da Consciência Negra");
  f.set(adicionarDiasCorridos(domingoDePascoa(ano), -2), "Sexta-feira Santa");
  return f;
}

const cacheNacionais = new Map<number, Map<DataCivil, string>>();

function ehFeriadoNacional(data: DataCivil): boolean {
  const ano = Number(data.slice(0, 4));
  let f = cacheNacionais.get(ano);
  if (!f) {
    f = feriadosNacionais(ano);
    cacheNacionais.set(ano, f);
  }
  return f.has(data);
}

export type FeriadosExtras = ReadonlySet<DataCivil> | readonly DataCivil[];

function comoConjunto(extras?: FeriadosExtras): ReadonlySet<DataCivil> {
  if (!extras) return new Set();
  return extras instanceof Set ? extras : new Set(extras as readonly DataCivil[]);
}

export function ehDiaUtil(data: DataCivil, feriadosExtras?: FeriadosExtras): boolean {
  if (REGRA_SLA.diasNaoUteisDaSemana.includes(diaDaSemana(data))) return false;
  if (ehFeriadoNacional(data)) return false;
  return !comoConjunto(feriadosExtras).has(data);
}

/** Dia útil de número `dias` após `inicio` (o próprio `inicio` não conta). */
export function adicionarDiasUteis(
  inicio: DataCivil,
  dias: number,
  feriadosExtras?: FeriadosExtras
): DataCivil {
  if (!Number.isInteger(dias) || dias < 0) throw new Error("Quantidade de dias úteis inválida.");
  const extras = comoConjunto(feriadosExtras);
  let atual = inicio;
  let contados = 0;
  while (contados < dias) {
    atual = adicionarDiasCorridos(atual, 1);
    if (ehDiaUtil(atual, extras)) contados++;
  }
  return atual;
}

/**
 * Quantidade de dias úteis em (inicio, fim] — mesma convenção do prazo: concluir no dia da
 * abertura = 0 dias úteis; concluir no 5º dia útil = 5. Retorna 0 se fim <= inicio.
 */
export function diasUteisEntre(
  inicio: DataCivil,
  fim: DataCivil,
  feriadosExtras?: FeriadosExtras
): number {
  const total = diferencaDiasCorridos(inicio, fim);
  if (total <= 0) return 0;
  const extras = comoConjunto(feriadosExtras);
  let n = 0;
  let atual = inicio;
  for (let i = 0; i < total; i++) {
    atual = adicionarDiasCorridos(atual, 1);
    if (ehDiaUtil(atual, extras)) n++;
  }
  return n;
}

export function calcularPrazoPadrao(
  abertura: DataCivil,
  feriadosExtras?: FeriadosExtras
): DataCivil {
  return adicionarDiasUteis(abertura, REGRA_SLA.diasUteisPadrao, feriadosExtras);
}

export type ClassificacaoPrazo = "vencido" | "vence_hoje" | "vence_em_breve" | "no_prazo";

/**
 * Classificação de um chamado em aberto em relação ao prazo, em dias corridos a partir de hoje:
 * vencido (prazo < hoje), vence hoje, vence em breve (1 a 2 dias corridos) ou no prazo.
 */
export function classificarPrazo(prazo: DataCivil, hoje: DataCivil): ClassificacaoPrazo {
  const diff = diferencaDiasCorridos(hoje, prazo);
  if (diff < 0) return "vencido";
  if (diff === 0) return "vence_hoje";
  if (diff <= REGRA_SLA.alertaVencendoEmDiasCorridos) return "vence_em_breve";
  return "no_prazo";
}

/** Concluído no prazo quando o DIA da conclusão (no fuso institucional) é <= ao prazo. */
export function concluidoNoPrazo(diaConclusao: DataCivil, prazo: DataCivil): boolean {
  return diaConclusao <= prazo;
}
