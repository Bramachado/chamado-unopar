/**
 * Datas e fuso horário do sistema.
 *
 * Dois tipos de valor, que nunca devem ser misturados:
 *
 * - DATA CIVIL ("YYYY-MM-DD"): dia do calendário, sem hora e sem fuso. Ex.: data de abertura e
 *   prazo de um chamado (colunas DATE). Nunca passa por `new Date(...)` para exibição, porque
 *   "2026-12-02" vira meia-noite UTC e, no fuso -03:00, é exibido como 01/12.
 *
 * - INSTANTE (ISO 8601 em UTC): momento exato. Ex.: conclusão, criação, auditoria
 *   (colunas DATETIMEOFFSET). É gravado em UTC e exibido no fuso institucional.
 *
 * O "dia de hoje" e o dia civil de um instante dependem do fuso institucional, configurável por
 * NEXT_PUBLIC_FUSO_INSTITUCIONAL (padrão America/Sao_Paulo).
 */

export type DataCivil = string;

export const FUSO_PADRAO = "America/Sao_Paulo";

export const FUSO_INSTITUCIONAL: string =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FUSO_INSTITUCIONAL?.trim()) ||
  FUSO_PADRAO;

const REGEX_DATA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

function partes(data: DataCivil): [number, number, number] {
  const m = REGEX_DATA_CIVIL.exec(data);
  if (!m) throw new Error(`Data civil inválida: "${data}" (esperado AAAA-MM-DD).`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function comoUtc(data: DataCivil): Date {
  const [a, m, d] = partes(data);
  return new Date(Date.UTC(a, m - 1, d));
}

function deUtc(data: Date): DataCivil {
  return data.toISOString().slice(0, 10);
}

/** Verifica formato e existência do dia (rejeita 2026-02-30). */
export function ehDataCivilValida(valor: unknown): valor is DataCivil {
  if (typeof valor !== "string" || !REGEX_DATA_CIVIL.test(valor)) return false;
  const [a, m, d] = partes(valor);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Converte o valor de uma coluna DATE lida do SQL Server em data civil.
 * O driver mssql (useUTC = true) entrega DATE como Date à meia-noite UTC; por isso a parte
 * de data é lida em UTC, sem aplicar o fuso local do servidor ou do navegador.
 */
export function dataCivilDoBanco(valor: unknown): DataCivil | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : deUtc(valor);
  }
  if (typeof valor === "string") {
    const inicio = valor.slice(0, 10);
    return ehDataCivilValida(inicio) ? inicio : null;
  }
  return null;
}

/** Valor para parâmetro sql.Date: meia-noite UTC do dia civil (o driver grava a parte UTC). */
export function paraParametroDate(data: DataCivil): Date {
  return comoUtc(data);
}

/** Converte instante lido do banco (Date ou string) para ISO UTC. */
export function instanteDoBanco(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const dt = valor instanceof Date ? valor : new Date(String(valor));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

const formatadoresDia = new Map<string, Intl.DateTimeFormat>();

/** Dia civil em que um instante cai no fuso indicado. */
export function dataCivilDeInstante(
  instante: Date | string,
  fuso: string = FUSO_INSTITUCIONAL
): DataCivil {
  const dt = instante instanceof Date ? instante : new Date(instante);
  let fmt = formatadoresDia.get(fuso);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: fuso,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatadoresDia.set(fuso, fmt);
  }
  return fmt.format(dt);
}

/** "Hoje" no fuso institucional (não no fuso do servidor, nem em UTC). */
export function hojeCivil(fuso: string = FUSO_INSTITUCIONAL, agora: Date = new Date()): DataCivil {
  return dataCivilDeInstante(agora, fuso);
}

/** Deslocamento do fuso em minutos (ex.: -180 para -03:00) no instante informado. */
export function deslocamentoMinutos(fuso: string, instante: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const comoUtcLocal = Date.UTC(
    v("year"),
    v("month") - 1,
    v("day"),
    v("hour"),
    v("minute"),
    v("second")
  );
  return Math.round((comoUtcLocal - Math.floor(instante.getTime() / 1000) * 1000) / 60000);
}

/** Instante UTC em que começa o dia civil no fuso (00:00 local). */
export function inicioDoDiaEmUtc(data: DataCivil, fuso: string = FUSO_INSTITUCIONAL): Date {
  const meiaNoiteUtc = comoUtc(data).getTime();
  // Duas iterações cobrem mudanças de horário de verão na virada do dia.
  let instante = meiaNoiteUtc - deslocamentoMinutos(fuso, new Date(meiaNoiteUtc)) * 60000;
  instante = meiaNoiteUtc - deslocamentoMinutos(fuso, new Date(instante)) * 60000;
  return new Date(instante);
}

/** Primeiro instante do dia civil seguinte (limite exclusivo de um intervalo por dia civil). */
export function fimDoDiaExclusivoEmUtc(data: DataCivil, fuso: string = FUSO_INSTITUCIONAL): Date {
  return inicioDoDiaEmUtc(adicionarDiasCorridos(data, 1), fuso);
}

export function adicionarDiasCorridos(data: DataCivil, dias: number): DataCivil {
  const dt = comoUtc(data);
  dt.setUTCDate(dt.getUTCDate() + dias);
  return deUtc(dt);
}

/** Diferença em dias corridos (b - a). */
export function diferencaDiasCorridos(a: DataCivil, b: DataCivil): number {
  return Math.round((comoUtc(b).getTime() - comoUtc(a).getTime()) / 86_400_000);
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(data: DataCivil): number {
  return comoUtc(data).getUTCDay();
}

export function compararDatasCivis(a: DataCivil, b: DataCivil): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function inicioDoMes(data: DataCivil): DataCivil {
  return `${data.slice(0, 7)}-01`;
}

export function fimDoMes(data: DataCivil): DataCivil {
  const [a, m] = partes(data);
  return deUtc(new Date(Date.UTC(a, m, 0)));
}

export function adicionarMeses(data: DataCivil, meses: number): DataCivil {
  const [a, m, d] = partes(data);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)
  ).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return deUtc(alvo);
}

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** Rótulo de mês "out/26" a partir de uma data civil. */
export function rotuloMes(data: DataCivil): string {
  const [a, m] = partes(data);
  return `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}`;
}

/** "02/12/2026" (ou "02/12" no formato curto), sem conversão de fuso. */
export function formatarDataCivil(
  data: DataCivil | null | undefined,
  formato: "completo" | "curto" = "completo"
): string {
  if (!data || !ehDataCivilValida(data)) return "—";
  const [a, m, d] = data.split("-");
  return formato === "curto" ? `${d}/${m}` : `${d}/${m}/${a}`;
}

const formatadoresInstante = new Map<string, Intl.DateTimeFormat>();

/** Exibe um instante no fuso institucional: "16/10/2026 21:05" (ou com segundos). */
export function formatarInstante(
  instante: string | Date | null | undefined,
  opcoes: { segundos?: boolean; somenteData?: boolean; fuso?: string } = {}
): string {
  if (!instante) return "—";
  const dt = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(dt.getTime())) return "—";
  const fuso = opcoes.fuso ?? FUSO_INSTITUCIONAL;
  const chave = `${fuso}|${opcoes.segundos ? 1 : 0}|${opcoes.somenteData ? 1 : 0}`;
  let fmt = formatadoresInstante.get(chave);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("pt-BR", {
      timeZone: fuso,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(opcoes.somenteData
        ? {}
        : {
            hour: "2-digit",
            minute: "2-digit",
            ...(opcoes.segundos ? { second: "2-digit" } : {}),
          }),
    });
    formatadoresInstante.set(chave, fmt);
  }
  return fmt.format(dt).replace(",", "");
}
