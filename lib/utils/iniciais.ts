/**
 * Utilitário para extrair as iniciais do nome e sobrenome.
 * Seguro para ser executado tanto no cliente (React) quanto no servidor.
 * Ex: "Yasmin Santana" -> "YS"
 * Ex: "Jakeline Lima" -> "JL"
 * Ex: "Maria" -> "MA"
 */
export function extrairIniciaisNome(nomeCompleto?: string | null): string {
  if (!nomeCompleto) return "UN";

  const partes = nomeCompleto
    .trim()
    .split(/\s+/)
    .filter((parte) => parte.length > 0);

  if (partes.length === 0) return "UN";

  const primeiroNome = partes[0];
  const ultimoNome = partes[partes.length - 1];

  if (!primeiroNome || !ultimoNome) return "UN";

  // Se tiver só 1 nome, usa as 2 primeiras letras
  if (partes.length === 1) {
    return primeiroNome.slice(0, 2).toUpperCase();
  }

  // Se tiver mais de um nome, pega o primeiro nome e o último sobrenome relevante
  const primeiro = primeiroNome[0] || "U";
  const ultimo = ultimoNome[0] || "N";

  return `${primeiro}${ultimo}`.toUpperCase();
}
