/**
 * Utilitários para validação, sanitização e mascaramento de CPF segundo as diretrizes da LGPD.
 */

/**
 * Remove qualquer caractere não numérico da string de CPF.
 */
export function limparCpf(cpf: string | null | undefined): string {
  if (!cpf) return "";
  return cpf.replace(/\D/g, "");
}

/**
 * Aplica máscara visual padrão 000.000.000-00 a uma string de dígitos.
 */
export function formatarCpf(cpf: string | null | undefined): string {
  const digitos = limparCpf(cpf);
  if (!digitos) return "";
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9)
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}

/**
 * Valida o algoritmo de dígitos verificadores de um CPF (11 dígitos).
 * Rejeita sequências repetidas (ex: 11111111111).
 */
export function validarCpf(cpf: string | null | undefined): boolean {
  const digitos = limparCpf(cpf);
  if (digitos.length !== 11) return false;

  // Rejeita CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  // Validação do 1º dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(digitos.charAt(i), 10) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  let dv1 = resto >= 10 ? 0 : resto;
  if (dv1 !== parseInt(digitos.charAt(9), 10)) return false;

  // Validação do 2º dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(digitos.charAt(i), 10) * (11 - i);
  }
  resto = 11 - (soma % 11);
  let dv2 = resto >= 10 ? 0 : resto;
  return dv2 === parseInt(digitos.charAt(10), 10);
}

/**
 * Mascara o CPF para exibição segura por padrão (LGPD): ***.456.789-**
 * Revelando apenas os 6 dígitos centrais e ocultando os primeiros 3 e os 2 dígitos verificadores.
 */
export function mascararCpfExibicao(cpf: string | null | undefined): string {
  const digitos = limparCpf(cpf);
  if (!digitos || digitos.length !== 11) {
    return cpf || "—";
  }
  return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
}
