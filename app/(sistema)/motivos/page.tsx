import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { PainelMotivos } from "./painel-motivos";

export default async function PaginaMotivos() {
  const perfil = await obterPerfilAtual();
  const supabase = await criarClienteServidor();

  // Buscar todos os motivos com contagem de chamados vinculados
  const { data: motivos } = await supabase
    .from("motivos")
    .select(`
      id,
      numero,
      codigo,
      nome,
      nome_normalizado,
      ativo,
      criado_em,
      chamados(count)
    `)
    .order("numero", { ascending: true });

  const motivosFormatados = (motivos || []).map((m) => ({
    ...m,
    total_chamados: (m.chamados as unknown as { count: number }[])?.[0]?.count || 0,
  }));

  return <PainelMotivos motivos={motivosFormatados} perfilAtual={perfil} />;
}
