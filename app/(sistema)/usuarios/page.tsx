import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { redirect } from "next/navigation";
import { PainelUsuarios } from "./painel-usuarios";

export default async function PaginaUsuarios() {
  const perfil = await obterPerfilAtual();

  // Apenas admin tem acesso a esta rota
  if (perfil.papel !== "admin") {
    redirect("/painel");
  }

  const supabase = await criarClienteServidor();

  // Buscar usuárias
  const { data: usuarios } = await supabase
    .from("perfis")
    .select("*")
    .order("nome_completo", { ascending: true });

  // Buscar acessos recentes ao cofre
  const { data: acessos } = await supabase
    .from("credencial_acessos")
    .select(`
      id,
      perfil_alvo,
      admin_id,
      data_hora,
      ip,
      user_agent,
      alvo:perfil_alvo(nome_completo),
      admin:admin_id(nome_completo)
    `)
    .order("data_hora", { ascending: false })
    .limit(20);

  const acessosFormatados = (acessos || []).map((a: any) => ({
    id: a.id,
    perfil_alvo: a.perfil_alvo,
    admin_id: a.admin_id,
    data_hora: a.data_hora,
    ip: a.ip,
    user_agent: a.user_agent,
    perfil_alvo_nome: a.alvo?.nome_completo || "Usuária",
    admin_nome: a.admin?.nome_completo || "Administradora",
  }));

  return (
    <PainelUsuarios
      usuarios={usuarios || []}
      acessosRecentes={acessosFormatados}
    />
  );
}
