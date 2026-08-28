import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { PainelPerfil } from "./painel-perfil";

export default async function PaginaPerfil() {
  const perfil = await obterPerfilAtual();
  const supabase = await criarClienteServidor();

  // Buscar acessos à própria credencial
  const { data: acessos } = await supabase
    .from("credencial_acessos")
    .select(`
      id,
      perfil_alvo,
      admin_id,
      data_hora,
      ip,
      user_agent,
      admin:admin_id(nome_completo)
    `)
    .eq("perfil_alvo", perfil.id)
    .order("data_hora", { ascending: false });

  const acessosFormatados = (acessos || []).map((a: any) => ({
    id: a.id,
    perfil_alvo: a.perfil_alvo,
    admin_id: a.admin_id,
    data_hora: a.data_hora,
    ip: a.ip,
    user_agent: a.user_agent,
    admin_nome: a.admin?.nome_completo || "Administradora",
  }));

  return (
    <PainelPerfil
      perfil={perfil}
      historicoAcessos={acessosFormatados}
    />
  );
}
