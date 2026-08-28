import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { FormularioChamado } from "../../formulario-chamado";
import { notFound, redirect } from "next/navigation";
import { type Chamado } from "@/types/database";

interface EditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PaginaEditarChamado({ params }: EditPageProps) {
  const { id } = await params;
  const perfil = await obterPerfilAtual();
  const supabase = await criarClienteServidor();

  // Buscar dados do chamado
  const { data: chamado, error } = await supabase
    .from("chamados")
    .select("*")
    .eq("id", id)
    .is("excluido_em", null)
    .single();

  if (error || !chamado) {
    notFound();
  }

  // Verificar permissão no servidor
  if (perfil.papel !== "admin" && chamado.criado_por !== perfil.id) {
    redirect("/chamados");
  }

  // Buscar motivos
  const { data: motivos } = await supabase
    .from("motivos")
    .select("*")
    .order("numero", { ascending: true });

  // Buscar dados do chamado vinculado se existir
  let chamadoVinculado = null;
  if (chamado.chamado_vinculado_id) {
    const { data: vinc } = await supabase
      .from("chamados")
      .select("id, protocolo, aluno_nome")
      .eq("id", chamado.chamado_vinculado_id)
      .single();
    chamadoVinculado = vinc;
  }

  return (
    <FormularioChamado
      chamadoInicial={chamado as Chamado}
      motivos={motivos || []}
      chamadoVinculadoInicial={chamadoVinculado}
    />
  );
}
