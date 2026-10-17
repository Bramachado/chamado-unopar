import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { autenticarAgente, type PerfilAgente } from "@/lib/agente/auth";
import { REGEX_PROTOCOLO_PAD } from "@/lib/agente/tarefas";
import { comTransacao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string; acao: string }>;
}

const devolverSchema = z.object({ pendencias: z.string().trim().min(5).max(4000) });
const concluirSchema = z.object({
  protocolo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(REGEX_PROTOCOLO_PAD, "Protocolo do PAD inválido (CS + 8 dígitos)."),
  observacao: z.string().trim().max(2000).optional(),
});
const erroSchema = z.object({
  detalhe: z.string().trim().min(3).max(4000),
  // true = falha passageira (ex.: Legion desligado): volta para a fila sem marcar erro
  reenfileirar: z.boolean().optional(),
});

function carimbo(perfil: PerfilAgente) {
  const quando = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  return `[${quando} · ${perfil.nome_completo}]`;
}

/** Acrescenta uma linha na observação do chamado (histórico visível para a equipe). */
async function anotarChamado(
  req: import("mssql").Request,
  perfil: PerfilAgente,
  chamadoId: string,
  linha: string,
  extra?: { set: string; protocolo: string }
) {
  req.parameters = {};
  if (extra) req.input("novo_prot", sql.VarChar(20), extra.protocolo);
  const extraSet = extra?.set || "";
  await req
    .input("an_chamado_id", sql.VarChar(50), chamadoId)
    .input("an_linha", sql.NVarChar(sql.MAX), `${carimbo(perfil)} ${linha}`)
    .input("an_por", sql.VarChar(50), perfil.id)
    .input("an_por_nome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200)).query(`
      UPDATE dados.chamados SET
        ${extraSet}
        observacao = CASE WHEN observacao IS NULL OR LTRIM(RTRIM(observacao)) = '' THEN @an_linha
                          ELSE observacao + CHAR(10) + @an_linha END,
        atualizado_por = @an_por, atualizado_por_nome = @an_por_nome, atualizado_em = SYSUTCDATETIME()
      WHERE id = @an_chamado_id AND excluido_em IS NULL
    `);
}

/**
 * POST /api/agente/tarefas/:id/:acao
 *  - iniciar   → pendente (ou travada há 30 min) → em_execucao
 *  - devolver  → { pendencias } — faltou informação; volta ao atendente
 *  - concluir  → { protocolo, observacao? } — grava o CS… no chamado
 *  - erro      → { detalhe, reenfileirar? } — falha técnica
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await autenticarAgente(request);
    if ("resposta" in auth) return auth.resposta;
    const { perfil } = auth;

    const { id, acao } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
    }
    const corpo = await request.json().catch(() => ({}));

    const resultado = await comTransacao(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        const qt = await req.input("id", sql.VarChar(50), id).query(`
        SELECT CAST(t.chamado_id AS NVARCHAR(50)) AS chamado_id, t.status,
               CASE WHEN t.iniciado_em < DATEADD(MINUTE, -30, SYSDATETIMEOFFSET()) THEN 1 ELSE 0 END AS travada,
               c.protocolo
        FROM dados.tarefas_agente t WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dados.chamados c ON c.id = t.chamado_id
        WHERE t.id = @id
      `);
        const tarefa = qt.recordset[0];
        if (!tarefa) return { status: 404, corpo: { erro: "Tarefa não encontrada." } };

        const atualizarTarefa = async (
          set: string,
          entradas: Record<string, [unknown, unknown]> = {}
        ) => {
          req.parameters = {};
          req.input("tid", sql.VarChar(50), id);
          for (const [nome, [tipo, valor]] of Object.entries(entradas)) {
            req.input(nome, tipo as never, valor);
          }
          await req.query(
            `UPDATE dados.tarefas_agente SET ${set}, atualizado_em = SYSDATETIMEOFFSET() WHERE id = @tid`
          );
        };

        if (acao === "iniciar") {
          const podeIniciar =
            tarefa.status === "pendente" || (tarefa.status === "em_execucao" && tarefa.travada);
          if (!podeIniciar) {
            return {
              status: 409,
              corpo: { erro: `Tarefa não está na fila (status: ${tarefa.status}).` },
            };
          }
          await atualizarTarefa(
            "status = 'em_execucao', iniciado_em = SYSDATETIMEOFFSET(), tentativas = tentativas + 1"
          );
          return { status: 200, corpo: { sucesso: true } };
        }

        if (tarefa.status !== "em_execucao") {
          return {
            status: 409,
            corpo: { erro: `Tarefa não está em execução (status: ${tarefa.status}).` },
          };
        }

        if (acao === "devolver") {
          const p = devolverSchema.safeParse(corpo);
          if (!p.success)
            return {
              status: 400,
              corpo: { erro: "Informe as pendências.", detalhes: p.error.flatten() },
            };
          await atualizarTarefa(
            "status = 'devolvida', pendencias = @pend, finalizado_em = SYSDATETIMEOFFSET()",
            { pend: [sql.NVarChar(4000), p.data.pendencias] }
          );
          await anotarChamado(
            req,
            perfil,
            tarefa.chamado_id,
            `Agente devolveu sem abrir no PAD. Falta: ${p.data.pendencias}`
          );
          return { status: 200, corpo: { sucesso: true } };
        }

        if (acao === "concluir") {
          const p = concluirSchema.safeParse(corpo);
          if (!p.success)
            return {
              status: 400,
              corpo: { erro: "Protocolo inválido.", detalhes: p.error.flatten() },
            };
          const protocolo = p.data.protocolo;

          req.parameters = {};
          const dup = await req
            .input("dup_prot", sql.VarChar(30), protocolo)
            .input("dup_id", sql.VarChar(50), tarefa.chamado_id)
            .query(
              `SELECT 1 AS existe FROM dados.chamados WHERE protocolo = @dup_prot AND id != @dup_id AND excluido_em IS NULL`
            );
          if (dup.recordset[0])
            return { status: 409, corpo: { erro: "Protocolo já usado em outro chamado." } };

          const anterior = tarefa.protocolo as string | null;
          await atualizarTarefa(
            "status = 'concluida', protocolo_pad = @prot, protocolo_anterior = @ant, finalizado_em = SYSDATETIMEOFFSET()",
            { prot: [sql.VarChar(20), protocolo], ant: [sql.VarChar(30), anterior] }
          );
          const linha =
            `Chamado aberto no PAD pelo agente: ${protocolo}` +
            (anterior && anterior !== protocolo
              ? ` (protocolo provisório anterior: ${anterior})`
              : "") +
            (p.data.observacao ? `. ${p.data.observacao}` : ".");
          await anotarChamado(req, perfil, tarefa.chamado_id, linha, {
            protocolo,
            set: "protocolo = @novo_prot, situacao = CASE WHEN situacao IN ('rascunho', 'aguardando') THEN 'aguardando_externo' ELSE situacao END, status_externo = N'Aberto no PAD',",
          });
          return { status: 200, corpo: { sucesso: true, protocolo } };
        }

        if (acao === "erro") {
          const p = erroSchema.safeParse(corpo);
          if (!p.success) return { status: 400, corpo: { erro: "Informe o detalhe do erro." } };
          if (p.data.reenfileirar) {
            await atualizarTarefa("status = 'pendente', iniciado_em = NULL, pendencias = @det", {
              det: [sql.NVarChar(4000), p.data.detalhe],
            });
          } else {
            await atualizarTarefa(
              "status = 'erro', pendencias = @det, finalizado_em = SYSDATETIMEOFFSET()",
              {
                det: [sql.NVarChar(4000), p.data.detalhe],
              }
            );
            await anotarChamado(
              req,
              perfil,
              tarefa.chamado_id,
              `Agente não conseguiu abrir no PAD: ${p.data.detalhe}`
            );
          }
          return { status: 200, corpo: { sucesso: true } };
        }

        return { status: 404, corpo: { erro: "Ação desconhecida." } };
      }
    );

    return NextResponse.json(resultado.corpo, { status: resultado.status });
  } catch (error) {
    console.error("[ERRO_API_AGENTE_TAREFA_ACAO]:", error);
    return NextResponse.json({ erro: "Erro ao atualizar tarefa." }, { status: 500 });
  }
}
