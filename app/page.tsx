import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

export default async function PaginaInicial() {
  const supabase = await criarClienteServidor();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  } else {
    redirect("/painel");
  }
}
