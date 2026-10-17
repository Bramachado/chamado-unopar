/**
 * IP do cliente para auditoria.
 *
 * Por que aparecia 127.0.0.1: os triggers não gravavam IP (coluna sempre NULL) e as telas exibiam
 * "127.0.0.1" como valor substituto; no cofre, a falta de X-Forwarded-For também caía em
 * "127.0.0.1".
 *
 * Regra: X-Forwarded-For só é usado quando há proxy confiável na frente da aplicação
 * (PROXIES_CONFIAVEIS = quantidade de proxies, ex.: 1 para o Traefik do Easypanel). Cada proxy
 * acrescenta o IP de quem o chamou ao FINAL do cabeçalho; por isso o IP real do cliente é o
 * N-ésimo valor a partir do fim. Valores à esquerda podem ter sido forjados pelo cliente e são
 * ignorados. Sem proxy configurado, o cabeçalho é ignorado e o IP fica desconhecido (NULL).
 */

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

function limpar(ip: string): string | null {
  let v = ip.trim();
  if (v.startsWith("[") && v.includes("]")) v = v.slice(1, v.indexOf("]"));
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(v)) v = v.slice(0, v.lastIndexOf(":"));
  if (v.toLowerCase().startsWith("::ffff:") && IPV4.test(v.slice(7))) v = v.slice(7);
  if (IPV4.test(v) || (v.includes(":") && IPV6.test(v) && v.length <= 45)) return v;
  return null;
}

export function quantidadeProxiesConfiaveis(): number {
  const n = Number.parseInt(process.env.PROXIES_CONFIAVEIS ?? "0", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5) : 0;
}

export function ipDoCliente(
  cabecalhos: { get(nome: string): string | null },
  proxiesConfiaveis: number = quantidadeProxiesConfiaveis()
): string | null {
  if (proxiesConfiaveis <= 0) return null;
  const xff = cabecalhos.get("x-forwarded-for");
  if (!xff) return null;
  const lista = xff
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const candidato = lista[lista.length - proxiesConfiaveis];
  return candidato ? limpar(candidato) : null;
}
