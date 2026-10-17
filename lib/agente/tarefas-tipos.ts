// Tipos e constantes da fila do agente — sem dependências de servidor (usado também no cliente).

export type StatusTarefaAgente =
  "pendente" | "em_execucao" | "concluida" | "devolvida" | "erro" | "cancelada";

export interface TarefaAgente {
  id: string;
  chamado_id: string;
  status: StatusTarefaAgente;
  instrucoes: string | null;
  pendencias: string | null;
  protocolo_pad: string | null;
  protocolo_anterior: string | null;
  tentativas: number;
  solicitado_por_nome: string | null;
  solicitado_em: string;
  iniciado_em: string | null;
  finalizado_em: string | null;
}

/** Protocolo definitivo do PAD (CS + 8 dígitos). Provisórios do sistema são CSAAAAMMDD-NNNN. */
export const REGEX_PROTOCOLO_PAD = /^CS\d{8}$/;
