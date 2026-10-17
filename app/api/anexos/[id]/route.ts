import { NextRequest, NextResponse } from "next/server";
import { verificarSessao } from "@/lib/auth/jwt";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { getPool, sql } from "@/lib/db/pool";
import { obterBufferArquivo } from "@/lib/storage/anexos";
import { podeExibirInline } from "@/lib/storage/validacao-arquivo";
import { carregarAnexoAutorizado } from "@/lib/chamados/repositorio";
import { sessaoAindaValida } from "@/lib/auth/perfil";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Download de anexo: exige sessão válida, perfil ativo e permissão sobre o chamado do anexo.
 * Tipos que o navegador pode interpretar (PDF/imagens) abrem inline com sandbox; os demais
 * são sempre baixados. Nunca é armazenado em cache compartilhado.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const sessao = await verificarSessao(request.cookies.get("chamados_unopar_session")?.value);
    if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

    const pool = await getPool();
    const resPerfil = await pool.request().input("id", sql.VarChar(50), sessao.id).query(`
      SELECT CAST(id AS NVARCHAR(50)) AS id, papel, ativo, CAST(polo_id AS NVARCHAR(50)) AS polo_id, sessao_valida_desde
      FROM dados.perfis WHERE id = TRY_CAST(@id AS UNIQUEIDENTIFIER)`);
    const perfil = resPerfil.recordset[0];
    if (!perfil || !perfil.ativo || !sessaoAindaValida(sessao, perfil.sessao_valida_desde)) {
      return NextResponse.json({ erro: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const resultado = await comTransacao(
      { usuario_id: perfil.id, papel: perfil.papel, ip: null },
      async (_req, tx) => {
        const arquivo = await carregarAnexoAutorizado(() => novaRequisicao(tx), perfil, id);
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
        { erro: "Arquivo não localizado ou sem permissão de acesso." },
        { status: 404 }
      );
    }

    const { arquivo, bytes } = resultado;
    const inline =
      podeExibirInline(arquivo.tipo_mime) && request.nextUrl.searchParams.get("baixar") !== "1";
    const nomeAscii = arquivo.nome_original.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    const headers = new Headers({
      "Content-Type": inline ? (arquivo.tipo_mime as string) : "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${nomeAscii}"; filename*=UTF-8''${encodeURIComponent(arquivo.nome_original)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "Cache-Control": "private, no-store",
    });
    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) {
    console.error("[ERRO_DOWNLOAD_ANEXO]:", error instanceof Error ? error.message : error);
    return NextResponse.json({ erro: "Erro ao processar download do anexo." }, { status: 500 });
  }
}
