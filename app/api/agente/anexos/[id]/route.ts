import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { autenticarAgente } from "@/lib/agente/auth";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { obterBufferArquivo } from "@/lib/storage/anexos";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/agente/anexos/:id
 * Download de anexo pelo agente — só de chamados com tarefa do agente ativa.
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

    const arquivo = await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        const q = await req.input("id", sql.VarChar(50), id).query(`
        SELECT CAST(a.id AS NVARCHAR(50)) AS id, a.nome_original, a.caminho_storage, a.tipo_mime
        FROM dados.arquivos_chamados a
        INNER JOIN dados.chamados c ON c.id = a.chamado_id AND c.excluido_em IS NULL
        WHERE a.id = @id
          AND EXISTS (SELECT 1 FROM dados.tarefas_agente t
                      WHERE t.chamado_id = a.chamado_id AND t.status IN ('pendente', 'em_execucao'))
      `);
        return q.recordset[0];
      }
    );
    if (!arquivo) {
      return NextResponse.json(
        { erro: "Anexo não encontrado ou sem tarefa ativa." },
        { status: 404 }
      );
    }

    const buffer = await obterBufferArquivo(arquivo.id, arquivo.caminho_storage);
    if (!buffer)
      return NextResponse.json({ erro: "Arquivo físico não encontrado." }, { status: 404 });

    const headers = new Headers();
    headers.set("Content-Type", arquivo.tipo_mime || "application/octet-stream");
    headers.set("Content-Length", String(buffer.length));
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(arquivo.nome_original)}"`
    );
    headers.set("Cache-Control", "no-store");
    return new Response(new Uint8Array(buffer), { headers });
  } catch (error) {
    console.error("[ERRO_API_AGENTE_ANEXO]:", error);
    return NextResponse.json({ erro: "Erro ao baixar anexo." }, { status: 500 });
  }
}
