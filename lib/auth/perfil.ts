import { criarClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type Perfil } from "@/types/database";

export async function obterPerfilAtual(): Promise<Perfil> {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil, error } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !perfil || !perfil.ativo) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return perfil as Perfil;
}
