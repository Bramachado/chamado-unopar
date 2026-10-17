"use server";

import { revalidatePath } from "next/cache";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comTransacao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { conferirParaDelegar, notificarAgente } from "@/lib/agente/tarefas";

export type ResultadoDelegar = {
  sucesso?: boolean;
  erro?: string;
  faltas?: string[];
  agenteAvisado?: boolean;
};

/**
 * Botão "Delegar para agente": confere o chamado, cria a tarefa e avisa o Agente Prisma.
 */
export async function delegarParaAgenteAction(
  chamadoId: string,
  instrucoes?: string
): Promise<ResultadoDelegar> {
  const perfil = await obterPerfilAtual();
  const textoInstrucoes = (instrucoes || "").trim().slice(0, 2000) || null;

  try {
    const resultado = await comTransacao(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        const q = await req.input("id", sql.VarChar(50), chamadoId).query(`
          SELECT c.protocolo, c.situacao, c.aluno_nome, c.aluno_cpf, c.aluno_ra, c.descricao,
                 m.nome AS motivo_nome, m.filtro AS motivo_filtro,
                 (SELECT COUNT(*) FROM dados.tarefas_agente t
                   WHERE t.chamado_id = c.id AND t.status IN ('pendente', 'em_execucao')) AS ativas
          FROM dados.chamados c
          LEFT JOIN dados.motivos m ON m.id = c.motivo_id
          WHERE c.id = @id AND c.excluido_em IS NULL
        `);
        const chamado = q.recordset[0];
        if (!chamado) return { erro: "Chamado não encontrado." } as ResultadoDelegar;
        if (chamado.ativas > 0) {
          return { erro: "Já existe uma tarefa do agente em andamento para este chamado." };
        }

        const faltas = conferirParaDelegar(chamado);
        if (faltas.length) return { faltas } as ResultadoDelegar;

        req.parameters = {};
        const ins = await req
          .input("chamado_id", sql.VarChar(50), chamadoId)
          .input("instrucoes", sql.NVarChar(2000), textoInstrucoes)
          .input("solicitado_por", sql.VarChar(50), perfil.id)
          .input("solicitado_por_nome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200))
          .query(`
            INSERT INTO dados.tarefas_agente (chamado_id, instrucoes, solicitado_por, solicitado_por_nome)
            OUTPUT CAST(INSERTED.id AS NVARCHAR(50)) AS id
            VALUES (@chamado_id, @instrucoes, @solicitado_por, @solicitado_por_nome)
          `);
        return { tarefaId: ins.recordset[0].id as string };
      }
    );

    if ("erro" in resultado || "faltas" in resultado) return resultado as ResultadoDelegar;

    const agenteAvisado = await notificarAgente((resultado as { tarefaId: string }).tarefaId);
    revalidatePath(`/chamados/${chamadoId}`);
    return { sucesso: true, agenteAvisado };
  } catch (erro) {
    console.error("[DELEGAR_AGENTE]", erro);
    const msg = erro instanceof Error ? erro.message : "";
    if (/tarefas_agente/.test(msg) && /Invalid object name/i.test(msg)) {
      return { erro: "Função ainda não ativada no banco (tabela de tarefas do agente ausente)." };
    }
    return { erro: "Não foi possível delegar ao agente." };
  }
}

/** Cancela uma tarefa ainda na fila (antes de o agente começar). */
export async function cancelarTarefaAgenteAction(
  tarefaId: string,
  chamadoId: string
): Promise<ResultadoDelegar> {
  const perfil = await obterPerfilAtual();
  try {
    const afetados = await comTransacao(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        const q = await req.input("id", sql.VarChar(50), tarefaId).query(`
          UPDATE dados.tarefas_agente
          SET status = 'cancelada', finalizado_em = SYSDATETIMEOFFSET(), atualizado_em = SYSDATETIMEOFFSET()
          WHERE id = @id AND status = 'pendente';
          SELECT @@ROWCOUNT AS n;
        `);
        return q.recordset[0].n as number;
      }
    );
    revalidatePath(`/chamados/${chamadoId}`);
    return afetados ? { sucesso: true } : { erro: "O agente já começou esta tarefa." };
  } catch (erro) {
    console.error("[CANCELAR_TAREFA_AGENTE]", erro);
    return { erro: "Não foi possível cancelar." };
  }
}
