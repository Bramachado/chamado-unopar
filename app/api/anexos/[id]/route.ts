import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { obterCaminhoAbsolutoSeguro } from "@/lib/storage/anexos";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const perfil = await obterPerfilAtual();
    const { id } = await params;

    // Busca metadados do arquivo via comUsuario (RLS do SQL Server garante permissão de visualização do chamado)
    const arquivo = await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        const q = await req
          .input("id", sql.UniqueIdentifier, id)
          .query(`
            SELECT 
              CAST(a.id AS NVARCHAR(50)) AS id,
              CAST(a.chamado_id AS NVARCHAR(50)) AS chamado_id,
              a.nome_original,
              a.caminho_storage,
              a.tamanho_bytes,
              a.tipo_mime
            FROM dados.arquivos_chamados a
            INNER JOIN dados.chamados c ON c.id = a.chamado_id
            WHERE a.id = @id AND c.excluido_em IS NULL
          `);
        return q.recordset[0];
      }
    );

    if (!arquivo) {
      return NextResponse.json({ erro: "Arquivo não localizado ou sem permissão de acesso." }, { status: 404 });
    }

    const caminhoFisico = obterCaminhoAbsolutoSeguro(arquivo.caminho_storage);

    if (!fs.existsSync(caminhoFisico)) {
      return NextResponse.json({ erro: "Arquivo físico não encontrado no servidor." }, { status: 404 });
    }

    const fileStream = fs.createReadStream(caminhoFisico);
    const responseStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    const headers = new Headers();
    headers.set("Content-Type", arquivo.tipo_mime || "application/octet-stream");
    headers.set(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(arquivo.nome_original)}"`
    );

    return new Response(responseStream, { headers });
  } catch (error) {
    console.error("[ERRO_DOWNLOAD_ANEXO]:", error);
    return NextResponse.json({ erro: "Erro ao processar download do anexo." }, { status: 500 });
  }
}
