/**
 * Validação de anexos por TAMANHO, EXTENSÃO e CONTEÚDO (assinatura dos primeiros bytes).
 * O tipo MIME informado pelo navegador não é confiável e não é usado: o MIME gravado é o do
 * tipo detectado. Arquivos cuja extensão não corresponde ao conteúdo são recusados.
 */

export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;
export const MAXIMO_ARQUIVOS_POR_ENVIO = 10;

interface TipoPermitido {
  extensoes: string[];
  mime: string;
  assinatura: (b: Uint8Array) => boolean;
  exibirInline: boolean;
}

const inicia = (b: Uint8Array, bytes: number[], deslocamento = 0) =>
  bytes.every((v, i) => b[deslocamento + i] === v);

const ZIP = (b: Uint8Array) => inicia(b, [0x50, 0x4b, 0x03, 0x04]);
const OLE = (b: Uint8Array) => inicia(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

export const TIPOS_PERMITIDOS: Record<string, TipoPermitido> = {
  pdf: {
    extensoes: [".pdf"],
    mime: "application/pdf",
    assinatura: (b) => inicia(b, [0x25, 0x50, 0x44, 0x46, 0x2d]),
    exibirInline: true,
  },
  png: {
    extensoes: [".png"],
    mime: "image/png",
    assinatura: (b) => inicia(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    exibirInline: true,
  },
  jpeg: {
    extensoes: [".jpg", ".jpeg"],
    mime: "image/jpeg",
    assinatura: (b) => inicia(b, [0xff, 0xd8, 0xff]),
    exibirInline: true,
  },
  webp: {
    extensoes: [".webp"],
    mime: "image/webp",
    assinatura: (b) =>
      inicia(b, [0x52, 0x49, 0x46, 0x46]) && inicia(b, [0x57, 0x45, 0x42, 0x50], 8),
    exibirInline: true,
  },
  xlsx: {
    extensoes: [".xlsx"],
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    assinatura: ZIP,
    exibirInline: false,
  },
  docx: {
    extensoes: [".docx"],
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    assinatura: ZIP,
    exibirInline: false,
  },
  xls: {
    extensoes: [".xls"],
    mime: "application/vnd.ms-excel",
    assinatura: OLE,
    exibirInline: false,
  },
  doc: { extensoes: [".doc"], mime: "application/msword", assinatura: OLE, exibirInline: false },
};

export const EXTENSOES_ACEITAS = Object.values(TIPOS_PERMITIDOS).flatMap((t) => t.extensoes);
export const DESCRICAO_TIPOS_ACEITOS =
  "PDF, PNG, JPG, WEBP, XLSX, XLS, DOCX ou DOC (máx. 10 MB cada)";

export type ResultadoValidacaoArquivo =
  | { ok: true; tipo: string; mime: string; extensao: string; nomeSeguro: string }
  | { ok: false; erro: string };

/** Nome para exibição: sem caminho, sem caracteres de controle, até 200 caracteres. */
export function sanitizarNomeArquivo(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "arquivo";
  const limpo = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "_").trim();
  return (limpo || "arquivo").slice(0, 200);
}

export function validarArquivo(
  nome: string,
  tamanho: number,
  primeirosBytes: Uint8Array
): ResultadoValidacaoArquivo {
  if (tamanho <= 0) return { ok: false, erro: `O arquivo "${nome}" está vazio.` };
  if (tamanho > TAMANHO_MAXIMO_BYTES) {
    return { ok: false, erro: `O arquivo "${nome}" excede o limite de 10 MB.` };
  }
  const nomeSeguro = sanitizarNomeArquivo(nome);
  const ponto = nomeSeguro.lastIndexOf(".");
  const extensao = ponto >= 0 ? nomeSeguro.slice(ponto).toLowerCase() : "";
  const tipo = Object.entries(TIPOS_PERMITIDOS).find(([, t]) => t.extensoes.includes(extensao));
  if (!tipo) {
    return {
      ok: false,
      erro: `Formato não permitido em "${nomeSeguro}". Use ${DESCRICAO_TIPOS_ACEITOS}.`,
    };
  }
  if (!tipo[1].assinatura(primeirosBytes)) {
    return {
      ok: false,
      erro: `O conteúdo de "${nomeSeguro}" não corresponde à extensão ${extensao}.`,
    };
  }
  return { ok: true, tipo: tipo[0], mime: tipo[1].mime, extensao, nomeSeguro };
}

export function podeExibirInline(mime: string | null | undefined): boolean {
  return Object.values(TIPOS_PERMITIDOS).some((t) => t.mime === mime && t.exibirInline);
}
