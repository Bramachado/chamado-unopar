import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { autenticarAgente } from "@/lib/agente/auth";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
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

    const resultado = await comTransacao(
      { usuario_id: perfil.id, papel: perfil.papel, ip: null },
      async (_req, tx) => {
        const q = await novaRequisicao(tx).input("id", sql.UniqueIdentifier, id).query(`
          SELECT CAST(a.id AS NVARCHAR(50)) AS id, a.nome_original, a.caminho_storage, a.tipo_mime
          FROM dados.arquivos_chamados a
          INNER JOIN dados.chamados c ON c.id = a.chamado_id AND c.excluido_em IS NULL
          WHERE a.id = @id AND a.excluido_em IS NULL
            AND EXISTS (SELECT 1 FROM dados.tarefas_agente t
                        WHERE t.chamado_id = a.chamado_id AND t.status IN ('pendente', 'em_execucao'))
        `);
        const arquivo = q.recordset[0];
        if (!arquivo) return null;
        const bytes = await obterBufferArquivo(
          () => novaRequisicao(tx),
          arquivo.id,
          arquivo.caminho_storage
        );
        return bytes ? { arquivo, bytes } : null;
      }
    );

    if (!resultado) {
      return NextResponse.json(
        { erro: "Anexo não encontrado ou sem tarefa ativa." },
        { status: 404 }
      );
    }

    const { arquivo, bytes } = resultado;
    const nomeAscii = arquivo.nome_original.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    const headers = new Headers({
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${nomeAscii}"; filename*=UTF-8''${encodeURIComponent(arquivo.nome_original)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) {
    console.error("[ERRO_API_AGENTE_ANEXO]:", error instanceof Error ? error.message : error);
    return NextResponse.json({ erro: "Erro ao baixar anexo." }, { status: 500 });
  }
}
