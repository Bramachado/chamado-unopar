import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { redirect } from "next/navigation";
import { PainelAuditoria } from "./painel-auditoria";

interface AuditPageProps {
  searchParams: Promise<{
    busca?: string;
    tabela?: string;
    operacao?: string;
    data_inicio?: string;
    data_fim?: string;
    pagina?: string;
    por_pagina?: string;
  }>;
}

export default async function PaginaAuditoria({ searchParams }: AuditPageProps) {
  const perfil = await obterPerfilAtual();

  if (perfil.papel !== "admin") {
    redirect("/painel");
  }

  const params = await searchParams;
  const supabase = await criarClienteServidor();

  const pagina = Number(params.pagina) || 1;
  const porPagina = Number(params.por_pagina) || 25;
  const offset = (pagina - 1) * porPagina;

  let query = supabase
    .from("logs_auditoria")
    .select("*", { count: "exact" });

  if (params.busca && params.busca.trim() !== "") {
    const termo = params.busca.trim();
    if (termo.match(/^CS[0-9]{1,8}$/i)) {
      query = query.ilike("protocolo", `${termo}%`);
    } else {
      query = query.ilike("usuario_nome", `%${termo}%`);
    }
  }

  if (params.tabela) {
    query = query.eq("tabela", params.tabela);
  }

  if (params.operacao) {
    query = query.eq("operacao", params.operacao);
  }

  if (params.data_inicio) {
    query = query.gte("criado_em", `${params.data_inicio}T00:00:00Z`);
  }

  if (params.data_fim) {
    query = query.lte("criado_em", `${params.data_fim}T23:59:59Z`);
  }

  query = query
    .order("criado_em", { ascending: false })
    .range(offset, offset + porPagina - 1);

  const { data: logs, count } = await query;

  return (
    <PainelAuditoria
      logs={logs || []}
      totalRegistros={count || 0}
      paginaAtual={pagina}
      porPagina={porPagina}
      filtrosAtuais={params}
    />
  );
}
