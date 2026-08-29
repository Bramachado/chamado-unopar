import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { redirect } from "next/navigation";
import { PainelUsuarios } from "./painel-usuarios";
import { type Perfil, type CredencialAcesso } from "@/types/database";

export default async function PaginaUsuarios() {
  const perfil = await obterPerfilAtual();

  if (perfil.papel !== "admin") {
    redirect("/painel");
  }

  const supabase = await criarClienteServidor();

  // Buscar todas as usuárias
  const { data: usuarios } = await supabase
    .from("perfis")
    .select("*")
    .order("nome_completo", { ascending: true });

  // Buscar histórico recente de acessos ao cofre
  const { data: acessos } = await supabase
    .from("credencial_acessos")
    .select(`
      id,
      perfil_alvo_id,
      acessado_por,
      data_hora,
      ip,
      user_agent,
      alvo:perfil_alvo_id(nome_completo),
      admin:acessado_por(nome_completo)
    `)
    .order("data_hora", { ascending: false })
    .limit(10);

  const acessosFormatados = (acessos || []).map((a: unknown) => {
    const item = a as {
      id: string;
      perfil_alvo_id: string;
      acessado_por: string;
      data_hora: string;
      ip: string | null;
      user_agent: string | null;
      alvo?: { nome_completo?: string };
      admin?: { nome_completo?: string };
    };

    return {
      id: item.id,
      perfil_alvo_id: item.perfil_alvo_id,
      acessado_por: item.acessado_por,
      data_hora: item.data_hora,
      ip: item.ip,
      user_agent: item.user_agent,
      perfil_alvo_nome: item.alvo?.nome_completo,
      admin_nome: item.admin?.nome_completo,
    };
  });

  return (
    <PainelUsuarios
      usuarios={(usuarios as Perfil[]) || []}
      acessosRecentes={(acessosFormatados as unknown as (CredencialAcesso & { perfil_alvo_nome?: string; admin_nome?: string })[])}
      perfilAtualId={perfil.id}
    />
  );
}
