import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { autenticarAgente } from "@/lib/agente/auth";
import { formatarTarefa, SELECT_TAREFA } from "@/lib/agente/tarefas";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/agente/tarefas/:id
 * Tudo o que o agente precisa para abrir o chamado no PAD: tarefa, chamado, motivo (caminho do PAD) e anexos.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await autenticarAgente(request);
    if ("resposta" in auth) return auth.resposta;
    const { perfil } = auth;

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
    }

    const dados = await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
      const qt = await req.input("id", sql.VarChar(50), id).query(`
        SELECT ${SELECT_TAREFA} FROM dados.tarefas_agente t WHERE t.id = @id
      `);
      const tarefa = formatarTarefa(qt.recordset[0]);
      if (!tarefa) return null;

      req.parameters = {};
      const qc = await req.input("chamado_id", sql.VarChar(50), tarefa.chamado_id).query(`
        SELECT
          CAST(c.id AS NVARCHAR(50)) AS id,
          c.protocolo, c.aluno_nome, c.aluno_ra, c.aluno_cpf, c.contato_telefone,
          pol.nome AS polo_nome, pol.cidade AS polo_cidade, pol.codigo AS polo_codigo,
          m.codigo AS motivo_codigo, m.nome AS motivo_nome, m.filtro AS motivo_caminho_pad,
          c.descricao, c.observacao, c.situacao, c.prioridade, c.data_solicitacao, c.prazo,
          c.criado_por_nome
        FROM dados.chamados c
        LEFT JOIN dados.motivos m ON m.id = c.motivo_id
        LEFT JOIN dados.polos pol ON pol.id = c.polo_id
        WHERE c.id = @chamado_id AND c.excluido_em IS NULL
      `);
      const qa = await req.query(`
        SELECT CAST(a.id AS NVARCHAR(50)) AS id, a.nome_original, a.tipo_mime, a.tamanho_bytes, a.descricao
        FROM dados.arquivos_chamados a
        WHERE a.chamado_id = @chamado_id
        ORDER BY a.criado_em ASC
      `);
      return { tarefa, chamado: qc.recordset[0] || null, anexos: qa.recordset };
    });

    if (!dados) return NextResponse.json({ erro: "Tarefa não encontrada." }, { status: 404 });
    return NextResponse.json({
      ...dados,
      anexos: dados.anexos.map((a: Record<string, unknown>) => ({
        ...a,
        download: `/api/agente/anexos/${a.id}`,
      })),
    });
  } catch (error) {
    console.error("[ERRO_API_AGENTE_TAREFA]:", error);
    return NextResponse.json({ erro: "Erro ao carregar tarefa." }, { status: 500 });
  }
}
