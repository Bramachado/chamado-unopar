/**
 * Redação de dados sensíveis em registros de auditoria exibidos ou exportados (defesa em
 * profundidade: os triggers da migração 0004 já redigem; registros antigos podem conter hash
 * de senha ou bytes de anexo).
 */
const CHAVES_SENSIVEIS = /senha|hash|cifrad|auth_?tag|^iv$|token|arquivo_base64|avatar/i;

export function redigir(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(redigir);
  if (valor && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) {
      if (CHAVES_SENSIVEIS.test(k)) saida[k] = v === null ? null : "[redigido]";
      else if (k === "aluno_cpf" && typeof v === "string" && /^\d{11}$/.test(v))
        saida[k] = `***${v.slice(3, 9)}**`;
      else saida[k] = redigir(v);
    }
    return saida;
  }
  return valor;
}

export function lerJsonAuditoria(texto: unknown): Record<string, unknown> | null {
  if (texto === null || texto === undefined || texto === "") return null;
  try {
    const obj = typeof texto === "string" ? JSON.parse(texto) : texto;
    return (redigir(obj) as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

export function lerCamposAlterados(texto: unknown): string[] | null {
  if (!texto) return null;
  if (Array.isArray(texto)) return texto.map(String);
  try {
    const v = JSON.parse(String(texto));
    return Array.isArray(v) ? v.map(String) : null;
  } catch {
    return null;
  }
}

/** Tabelas técnicas que não são operações de negócio (conteúdo de anexo e fotos de perfil). */
export const TABELAS_TECNICAS = ["arquivos_conteudo", "perfis_avatar"];
