import { NextRequest, NextResponse } from "next/server";
import { autenticarAgente } from "@/lib/agente/auth";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

/**
 * GET /api/agente/tarefas
 * Fila do agente: tarefas pendentes e em execução há mais de 30 min (travadas).
 * Usado pela varredura periódica, caso o webhook tenha falhado.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await autenticarAgente(request);
    if ("resposta" in auth) return auth.resposta;
    const { perfil } = auth;

    const tarefas = await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        const q = await req.input("limite", sql.Int, 20).query(`
        SELECT TOP (@limite)
          CAST(t.id AS NVARCHAR(50)) AS id,
          CAST(t.chamado_id AS NVARCHAR(50)) AS chamado_id,
          t.status, t.tentativas, t.solicitado_em, t.iniciado_em
        FROM dados.tarefas_agente t
        WHERE t.status = 'pendente'
           OR (t.status = 'em_execucao' AND t.iniciado_em < DATEADD(MINUTE, -30, SYSDATETIMEOFFSET()))
        ORDER BY t.solicitado_em ASC
      `);
        return q.recordset;
      }
    );

    return NextResponse.json({ tarefas });
  } catch (error) {
    console.error("[ERRO_API_AGENTE_TAREFAS]:", error);
    return NextResponse.json({ erro: "Erro ao listar tarefas." }, { status: 500 });
  }
}
