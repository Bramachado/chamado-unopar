import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { TabelaChamados } from "./tabela-chamados";
import { type Chamado, type Motivo } from "@/types/database";

interface PageProps {
  searchParams: Promise<{
    busca?: string;
    situacao?: string;
    prioridade?: string;
    motivo_id?: string;
    data_inicio?: string;
    data_fim?: string;
    reincidentes?: string;
  }>;
}

export default async function PaginaChamados({ searchParams }: PageProps) {
  const perfilAtual = await obterPerfilAtual();
  const params = await searchParams;
  const supabase = await criarClienteServidor();

  // 1. Montar consulta de chamados com filtros
  let query = supabase
    .from("chamados")
    .select(`
      *,
      motivos:motivo_id(id, codigo, nome),
      perfis:criado_por(id, nome_completo)
    `)
    .is("excluido_em", null)
    .order("data_solicitacao", { ascending: false });

  // Busca textual / Protocolo / Aluno
  if (params.busca && params.busca.trim().length > 0) {
    const termo = params.busca.trim();
    if (termo.toUpperCase().startsWith("CS")) {
      query = query.ilike("protocolo", `%${termo}%`);
    } else {
      query = query.ilike("aluno_nome", `%${termo}%`);
    }
  }

  // Filtro de Situação
  if (params.situacao && params.situacao !== "todos") {
    query = query.eq("situacao", params.situacao);
  }

  // Filtro de Prioridade
  if (params.prioridade && params.prioridade !== "todos") {
    query = query.eq("prioridade", params.prioridade);
  }

  // Filtro de Motivo
  if (params.motivo_id && params.motivo_id !== "todos") {
    query = query.eq("motivo_id", params.motivo_id);
  }

  // Filtros de Data
  if (params.data_inicio) {
    query = query.gte("data_solicitacao", params.data_inicio);
  }
  if (params.data_fim) {
    query = query.lte("data_solicitacao", params.data_fim);
  }

  const { data: chamados, error: erroChamados } = await query;
  if (erroChamados) {
    console.error("Erro ao buscar chamados:", erroChamados.message);
  }

  // 2. Buscar motivos ativos para o seletor de filtros
  const { data: motivos } = await supabase
    .from("motivos")
    .select("*")
    .order("codigo", { ascending: true });

  return (
    <TabelaChamados
      chamados={(chamados as unknown as (Chamado & { motivos?: Pick<Motivo, "id" | "codigo" | "nome">; perfis?: { id: string; nome_completo: string } })[]) || []}
      motivos={(motivos as Motivo[]) || []}
      perfilAtual={perfilAtual}
      filtros={params}
    />
  );
}
