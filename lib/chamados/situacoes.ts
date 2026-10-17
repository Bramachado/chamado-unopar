/**
 * Situações do chamado, transições permitidas e campos exigidos em cada transição.
 * Códigos antigos (rascunho, aguardando, concluido, encerrado) foram preservados para
 * compatibilidade com os registros existentes e com a API do agente.
 */

export const SITUACOES = [
  "rascunho",
  "aguardando",
  "em_atendimento",
  "aguardando_aluno",
  "aguardando_externo",
  "concluido",
  "encerrado",
] as const;

export type Situacao = (typeof SITUACOES)[number];

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  rascunho: "Rascunho",
  aguardando: "Aberto",
  em_atendimento: "Em atendimento",
  aguardando_aluno: "Aguardando aluno",
  aguardando_externo: "Aguardando retorno externo/PAD",
  concluido: "Resolvido",
  encerrado: "Encerrado sem solução",
};

export const DESCRICAO_SITUACAO: Record<Situacao, string> = {
  rascunho: "Ainda não registrado na plataforma externa.",
  aguardando: "Registrado e aguardando o início do atendimento.",
  em_atendimento: "Em tratamento pela equipe.",
  aguardando_aluno: "Depende de documento ou resposta do aluno.",
  aguardando_externo: "Depende de retorno da plataforma externa (PAD) ou de outro setor.",
  concluido: "Solicitação atendida; a resolução é obrigatória.",
  encerrado: "Finalizado sem atender à solicitação; o motivo é obrigatório.",
};

/** Situações finais (não são pendência). */
export const SITUACOES_FINAIS: readonly Situacao[] = ["concluido", "encerrado"];

/**
 * Pendências: todo chamado não finalizado, inclusive rascunho (a solicitação do aluno já existe).
 * O prazo NÃO é pausado em "aguardando aluno/externo" (REGRA_SLA.pausaAutomaticaEmAguardando).
 */
export const SITUACOES_PENDENTES: readonly Situacao[] = [
  "rascunho",
  "aguardando",
  "em_atendimento",
  "aguardando_aluno",
  "aguardando_externo",
];

export function ehSituacao(valor: unknown): valor is Situacao {
  return typeof valor === "string" && (SITUACOES as readonly string[]).includes(valor);
}

export function ehFinal(situacao: string): boolean {
  return (SITUACOES_FINAIS as readonly string[]).includes(situacao);
}

export function ehPendente(situacao: string): boolean {
  return (SITUACOES_PENDENTES as readonly string[]).includes(situacao);
}

const ABERTAS_EM_TRATAMENTO: Situacao[] = [
  "aguardando",
  "em_atendimento",
  "aguardando_aluno",
  "aguardando_externo",
];

/** Transições permitidas. De situação final só se sai por reabertura (com justificativa). */
export const TRANSICOES: Record<Situacao, readonly Situacao[]> = {
  rascunho: ["aguardando", "em_atendimento", "encerrado"],
  aguardando: [
    "em_atendimento",
    "aguardando_aluno",
    "aguardando_externo",
    "concluido",
    "encerrado",
  ],
  em_atendimento: [
    "aguardando",
    "aguardando_aluno",
    "aguardando_externo",
    "concluido",
    "encerrado",
  ],
  aguardando_aluno: ["em_atendimento", "aguardando_externo", "concluido", "encerrado"],
  aguardando_externo: ["em_atendimento", "aguardando_aluno", "concluido", "encerrado"],
  concluido: ["em_atendimento"],
  encerrado: ["em_atendimento"],
};

/** Situações aceitas na criação de um chamado. */
export const SITUACOES_INICIAIS: readonly Situacao[] = ["rascunho", ...ABERTAS_EM_TRATAMENTO];

export const MOTIVOS_ENCERRAMENTO = {
  aluno_desistiu: "Aluno desistiu da solicitação",
  sem_retorno_aluno: "Sem retorno do aluno",
  fora_do_escopo: "Fora do escopo da secretaria",
  duplicado: "Chamado duplicado",
  indeferido_externo: "Indeferido pela plataforma externa",
  aberto_por_engano: "Aberto por engano",
  outro: "Outro (descrever)",
} as const;

export type MotivoEncerramento = keyof typeof MOTIVOS_ENCERRAMENTO;

export interface DadosTransicao {
  resolucao?: string | null;
  motivo_encerramento?: string | null;
  justificativa?: string | null;
}

export type ResultadoTransicao =
  { ok: true; ehReabertura: boolean } | { ok: false; erro: string; campo?: string };

/** Valida a mudança de situação e os campos obrigatórios. Não há mudança quando de === para. */
export function validarTransicao(
  de: Situacao,
  para: Situacao,
  dados: DadosTransicao
): ResultadoTransicao {
  if (de === para) return { ok: true, ehReabertura: false };
  if (!TRANSICOES[de].includes(para)) {
    return {
      ok: false,
      campo: "situacao",
      erro: `Não é permitido passar de "${ROTULO_SITUACAO[de]}" para "${ROTULO_SITUACAO[para]}".`,
    };
  }
  const ehReabertura = ehFinal(de);
  if (ehReabertura && (dados.justificativa ?? "").trim().length < 10) {
    return {
      ok: false,
      campo: "justificativa",
      erro: "Informe a justificativa da reabertura (mínimo de 10 caracteres).",
    };
  }
  if (para === "concluido" && (dados.resolucao ?? "").trim().length < 5) {
    return {
      ok: false,
      campo: "resolucao",
      erro: "Registre a resolução para marcar como resolvido.",
    };
  }
  if (para === "encerrado") {
    const motivo = dados.motivo_encerramento ?? "";
    if (!(motivo in MOTIVOS_ENCERRAMENTO)) {
      return {
        ok: false,
        campo: "motivo_encerramento",
        erro: "Selecione o motivo do encerramento sem solução.",
      };
    }
    if (motivo === "outro" && (dados.justificativa ?? "").trim().length < 10) {
      return {
        ok: false,
        campo: "justificativa",
        erro: "Descreva o motivo do encerramento (mínimo de 10 caracteres).",
      };
    }
  }
  return { ok: true, ehReabertura };
}

/**
 * Data de conclusão após a transição: definida ao entrar numa situação final, preservada
 * enquanto continua final e limpa na reabertura. Editar um chamado finalizado não altera a data.
 */
export function dataConclusaoAposTransicao(
  de: Situacao,
  para: Situacao,
  conclusaoAtual: string | null,
  agoraIso: string
): string | null {
  if (!ehFinal(para)) return null;
  if (ehFinal(de) && conclusaoAtual) return conclusaoAtual;
  return agoraIso;
}
