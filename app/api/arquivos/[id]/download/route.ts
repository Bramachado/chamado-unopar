import { NextRequest, NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await criarClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  // 1. Buscar metadados do arquivo
  const { data: arquivo, error } = await supabase
    .from("arquivos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !arquivo) {
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }

  // 2. Obter URL assinada do Supabase Storage ou retornar arquivo
  const { data: storageData } = await supabase.storage
    .from("anexos_chamados")
    .createSignedUrl(arquivo.caminho_storage, 60);

  if (storageData?.signedUrl) {
    return NextResponse.redirect(storageData.signedUrl);
  }

  // Se não estiver em storage físico, retornar arquivo placeholder informativo
  const headers = new Headers();
  headers.set("Content-Disposition", `attachment; filename="${arquivo.nome_original}"`);
  headers.set("Content-Type", arquivo.tipo_mime || "application/octet-stream");

  const placeholderContent = `Comprovante / Anexo do Protocolo: ${arquivo.nome_original}\nData de envio: ${arquivo.criado_em}\nDescrição: ${arquivo.descricao || "Sem descrição"}`;

  return new NextResponse(placeholderContent, {
    status: 200,
    headers,
  });
}
