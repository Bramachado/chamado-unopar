import { sql } from "@/lib/db/pool";

import { REGEX_PROTOCOLO_PAD, type StatusTarefaAgente, type TarefaAgente } from "./tarefas-tipos";

export { REGEX_PROTOCOLO_PAD, type StatusTarefaAgente, type TarefaAgente };

export const SELECT_TAREFA = `
  CAST(t.id AS NVARCHAR(50)) AS id,
  CAST(t.chamado_id AS NVARCHAR(50)) AS chamado_id,
  t.status, t.instrucoes, t.pendencias, t.protocolo_pad, t.protocolo_anterior, t.tentativas,
  t.solicitado_por_nome, t.solicitado_em, t.iniciado_em, t.finalizado_em
`;

export function formatarTarefa(row: Record<string, unknown> | undefined): TarefaAgente | null {
  if (!row) return null;
  const data = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    id: row.id as string,
    chamado_id: row.chamado_id as string,
    status: row.status as StatusTarefaAgente,
    instrucoes: (row.instrucoes as string) || null,
    pendencias: (row.pendencias as string) || null,
    protocolo_pad: (row.protocolo_pad as string) || null,
    protocolo_anterior: (row.protocolo_anterior as string) || null,
    tentativas: Number(row.tentativas || 0),
    solicitado_por_nome: (row.solicitado_por_nome as string) || null,
    solicitado_em: data(row.solicitado_em) || new Date().toISOString(),
    iniciado_em: data(row.iniciado_em),
    finalizado_em: data(row.finalizado_em),
  };
}

/** Última tarefa do chamado (ou null se a tabela ainda não existir). */
export async function buscarUltimaTarefa(
  req: sql.Request,
  chamadoId: string
): Promise<TarefaAgente | null> {
  try {
    const q = await req.input("tarefa_chamado_id", sql.VarChar(50), chamadoId).query(`
      SELECT TOP 1 ${SELECT_TAREFA}
      FROM dados.tarefas_agente t
      WHERE t.chamado_id = @tarefa_chamado_id
      ORDER BY t.solicitado_em DESC
    `);
    return formatarTarefa(q.recordset[0]);
  } catch {
    return null;
  }
}

export interface DadosConferencia {
  protocolo: string | null;
  situacao: string;
  aluno_nome: string | null;
  aluno_cpf: string | null;
  aluno_ra: string | null;
  descricao: string | null;
  motivo_nome: string | null;
  motivo_filtro: string | null;
}

/**
 * Conferência feita ANTES de acionar o agente: devolve na hora o que falta,
 * sem gastar uma execução do agente.
 */
export function conferirParaDelegar(c: DadosConferencia): string[] {
  const faltas: string[] = [];
  if (c.protocolo && REGEX_PROTOCOLO_PAD.test(c.protocolo.trim().toUpperCase())) {
    faltas.push(`Este chamado já tem protocolo do PAD (${c.protocolo}).`);
  }
  if (c.situacao === "concluido" || c.situacao === "encerrado") {
    faltas.push("Chamado já está concluído/encerrado.");
  }
  if (!c.aluno_nome || c.aluno_nome.trim().length < 3) faltas.push("Nome do aluno.");
  if (!c.aluno_cpf && !c.aluno_ra) faltas.push("CPF ou RA do aluno.");
  const descricao = (c.descricao || "").replace(/[\s.\-_,;:]+/g, " ").trim();
  if (descricao.length < 20) {
    faltas.push(
      "Descrição detalhada (o que o aluno pediu, o que já foi verificado e o que se espera) — mínimo de 20 caracteres."
    );
  }
  if (!c.motivo_filtro || !c.motivo_filtro.trim()) {
    faltas.push(
      `O motivo "${c.motivo_nome || "?"}" não tem o caminho do PAD cadastrado (Motivos > Filtro/Caminho).`
    );
  }
  return faltas;
}

/**
 * Avisa o OpenClaw (webhook) que há uma tarefa nova. Falha aqui não perde a tarefa:
 * ela fica "pendente" e a automação de varredura do agente a recolhe.
 */
export async function notificarAgente(tarefaId: string): Promise<boolean> {
  const url = process.env.OPENCLAW_HOOK_URL?.trim();
  const token = process.env.OPENCLAW_HOOK_TOKEN?.trim();
  if (!url || !token) return false;

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": `tarefa-${tarefaId}`,
      },
      body: JSON.stringify({ tarefa_id: tarefaId }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resposta.ok) {
      console.error("[AGENTE_WEBHOOK]", resposta.status, await resposta.text().catch(() => ""));
    }
    return resposta.ok;
  } catch (erro) {
    console.error("[AGENTE_WEBHOOK]", erro instanceof Error ? erro.message : erro);
    return false;
  }
}
