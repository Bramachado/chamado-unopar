/**
 * Limite de tentativas de login (por e-mail e por IP), em memória do processo.
 * Suficiente para a implantação atual (um contêiner). Com mais de uma instância, mover para o
 * banco ou para um cache compartilhado.
 */

export const LIMITE = { falhas: 5, janelaMs: 15 * 60_000, bloqueioMs: 15 * 60_000 } as const;

interface Registro {
  falhas: number[];
  bloqueadoAte: number;
}

const registros = new Map<string, Registro>();

function obter(chave: string): Registro {
  let r = registros.get(chave);
  if (!r) {
    r = { falhas: [], bloqueadoAte: 0 };
    registros.set(chave, r);
  }
  return r;
}

/** Retorna os segundos restantes de bloqueio (0 se liberado). */
export function segundosDeBloqueio(chaves: string[], agora = Date.now()): number {
  let restante = 0;
  for (const c of chaves) {
    const r = registros.get(c);
    if (r && r.bloqueadoAte > agora) restante = Math.max(restante, r.bloqueadoAte - agora);
  }
  return Math.ceil(restante / 1000);
}

export function registrarFalha(chaves: string[], agora = Date.now()): void {
  for (const c of chaves) {
    const r = obter(c);
    r.falhas = r.falhas.filter((t) => agora - t < LIMITE.janelaMs);
    r.falhas.push(agora);
    if (r.falhas.length >= LIMITE.falhas) {
      r.bloqueadoAte = agora + LIMITE.bloqueioMs;
      r.falhas = [];
    }
  }
}

export function registrarSucesso(chaves: string[]): void {
  for (const c of chaves) registros.delete(c);
}

export function _limparParaTestes(): void {
  registros.clear();
}
