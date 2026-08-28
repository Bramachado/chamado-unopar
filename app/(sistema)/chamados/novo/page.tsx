import { criarClienteServidor } from "@/lib/supabase/server";
import { FormularioChamado } from "../formulario-chamado";

export default async function PaginaNovoChamado() {
  const supabase = await criarClienteServidor();

  const { data: motivos } = await supabase
    .from("motivos")
    .select("*")
    .eq("ativo", true)
    .order("numero", { ascending: true });

  return <FormularioChamado motivos={motivos || []} />;
}
