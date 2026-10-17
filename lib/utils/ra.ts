/**
 * RA / matrícula. Não há formato institucional único documentado, então só se rejeita o que é
 * comprovadamente inválido; o formato real deve ser confirmado pela gestão (ver DIAGNOSTICO.md).
 *
 * - Opcional (vazio vira NULL).
 * - Letras, dígitos, ponto, hífen e barra; até 50 caracteres.
 * - Rejeita só zeros/sequência repetida e RA igual ao CPF informado no mesmo chamado.
 * - RA com 11 dígitos que passa na validação de CPF gera ALERTA (precisa de confirmação).
 */

import { limparCpf, validarCpf } from "./cpf";

export type ResultadoRa =
  { ok: true; valor: string | null; alerta?: string } | { ok: false; erro: string };

export function validarRa(
  entrada: string | null | undefined,
  cpfDoChamado?: string | null
): ResultadoRa {
  const ra = (entrada ?? "").trim().toUpperCase();
  if (!ra) return { ok: true, valor: null };
  if (ra.length > 50) return { ok: false, erro: "O RA deve ter no máximo 50 caracteres." };
  if (!/^[A-Z0-9./-]+$/.test(ra)) {
    return { ok: false, erro: "RA aceita apenas letras, números, ponto, hífen e barra." };
  }
  const digitos = ra.replace(/\D/g, "");
  if (
    digitos.length > 0 &&
    digitos.length === ra.replace(/[./-]/g, "").length &&
    /^(\d)\1+$/.test(digitos)
  ) {
    return { ok: false, erro: "RA inválido (sequência repetida). Deixe em branco se não houver." };
  }
  const cpf = limparCpf(cpfDoChamado);
  if (cpf && digitos === cpf) {
    return { ok: false, erro: "O RA informado é igual ao CPF. Informe o RA (matrícula) do aluno." };
  }
  if (digitos.length === 11 && digitos === ra.replace(/[./-]/g, "") && validarCpf(digitos)) {
    return {
      ok: true,
      valor: ra,
      alerta: "Este RA tem formato de CPF. Confirme que é a matrícula do aluno, e não o CPF.",
    };
  }
  return { ok: true, valor: ra };
}
