/**
 * Telefone brasileiro (fixo ou celular) com DDD. Armazenado só com dígitos (10 ou 11), sem +55.
 * Campo opcional: vazio vira NULL; zeros ou sequências repetidas nunca são aceitos como
 * "preenchimento".
 */

// DDDs válidos atribuídos pela Anatel.
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type ResultadoTelefone = { ok: true; valor: string | null } | { ok: false; erro: string };

export function normalizarTelefone(entrada: string | null | undefined): ResultadoTelefone {
  const bruto = (entrada ?? "").trim();
  if (!bruto) return { ok: true, valor: null };
  let d = bruto.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1); // 0 + DDD + número fixo
  if (/^(\d)\1+$/.test(d)) {
    return {
      ok: false,
      erro: "Telefone inválido (sequência repetida). Deixe em branco se não houver.",
    };
  }
  if (d.length < 10) {
    return { ok: false, erro: "Informe o telefone com DDD (10 ou 11 dígitos)." };
  }
  if (d.length > 11) return { ok: false, erro: "Telefone com dígitos demais." };
  if (!DDDS.has(Number(d.slice(0, 2)))) return { ok: false, erro: "DDD inválido." };
  const numero = d.slice(2);
  if (numero.length === 9 && numero[0] !== "9") {
    return { ok: false, erro: "Celular com 9 dígitos deve começar com 9." };
  }
  if (numero.length === 8 && !/^[2-5]/.test(numero)) {
    return { ok: false, erro: "Telefone fixo inválido. Para celular, inclua o 9 inicial." };
  }
  return { ok: true, valor: d };
}

export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return "—";
  const d = valor.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}
