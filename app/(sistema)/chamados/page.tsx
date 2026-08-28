import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { TabelaChamados } from "./tabela-chamados";
import Link from "next/link";
import { Plus, Download } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    busca?: string;
    situacao?: string;
    prioridade?: string;
    motivo_id?: string;
    responsavel_id?: string;
    data_inicio?: string;
    data_fim?: string;
    pagina?: string;
    por_pagina?: string;
  }>;
}

export default async function PaginaChamados({ searchParams }: PageProps) {
  const params = await searchParams;
  const perfil = await obterPerfilAtual();
  const supabase = await criarClienteServidor();

  const pagina = Number(params.pagina) || 1;
  const porPagina = Number(params.por_pagina) || 20;
  const offset = (pagina - 1) * porPagina;

  // Carregar catálogo de motivos para o filtro
  const { data: motivos } = await supabase
    .from("motivos")
    .select("id, codigo, nome")
    .order("numero", { ascending: true });

  // Carregar usuárias para o filtro de responsável
  const { data: usuarias } = await supabase
    .from("perfis")
    .select("id, nome_completo")
    .order("nome_completo", { ascending: true });

  // Construir query de chamados
  let query = supabase
    .from("chamados")
    .select(
      `
      id,
      protocolo,
      aluno_nome,
      aluno_ra,
      contato_telefone,
      situacao,
      prioridade,
      data_solicitacao,
      prazo,
      data_conclusao,
      importado,
      criado_por,
      criado_em,
      motivos:motivo_id(id, codigo, nome),
      perfis:criado_por(id, nome_completo)
    `,
      { count: "exact" }
    )
    .is("excluido_em", null);

  // Filtro de Busca unificada
  if (params.busca && params.busca.trim() !== "") {
    const busca = params.busca.trim();
    if (busca.match(/^CS[0-9]{1,8}$/i)) {
      query = query.ilike("protocolo", `${busca}%`);
    } else {
      query = query.ilike("aluno_nome", `%${busca}%`);
    }
  }

  // Filtros estruturados
  if (params.situacao) {
    query = query.eq("situacao", params.situacao);
  }
  if (params.prioridade) {
    query = query.eq("prioridade", params.prioridade);
  }
  if (params.motivo_id) {
    query = query.eq("motivo_id", params.motivo_id);
  }
  if (params.responsavel_id) {
    query = query.eq("criado_por", params.responsavel_id);
  }
  if (params.data_inicio) {
    query = query.gte("data_solicitacao", params.data_inicio);
  }
  if (params.data_fim) {
    query = query.lte("data_solicitacao", params.data_fim);
  }

  // Paginação e ordenação
  query = query
    .order("data_solicitacao", { ascending: false })
    .order("criado_em", { ascending: false })
    .range(offset, offset + porPagina - 1);

  const { data: chamados, count } = await query;

  // Normalizar relação de objetos
  const chamadosNormalizados = (chamados || []).map((c: any) => ({
    id: c.id,
    protocolo: c.protocolo,
    aluno_nome: c.aluno_nome,
    aluno_ra: c.aluno_ra,
    contato_telefone: c.contato_telefone,
    situacao: c.situacao,
    prioridade: c.prioridade,
    data_solicitacao: c.data_solicitacao,
    prazo: c.prazo,
    data_conclusao: c.data_conclusao,
    importado: c.importado,
    criado_por: c.criado_por,
    criado_em: c.criado_em,
    motivos: Array.isArray(c.motivos) ? c.motivos[0] : c.motivos,
    perfis: Array.isArray(c.perfis) ? c.perfis[0] : c.perfis,
  }));

  return (
    <div className="space-y-4">
      {/* Cabeçalho da tela */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-texto">
            Protocolos de Chamados
          </h1>
          <p className="text-xs text-texto-suave">
            Controle de registros, auditoria e prazos de atendimento.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/chamados/exportar"
            className="inline-flex items-center gap-1.5 rounded border border-borda bg-superficie px-3 py-1.5 text-xs font-medium text-texto transition hover:bg-fundo"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </Link>

          <Link
            href="/chamados/novo"
            className="inline-flex items-center gap-1.5 rounded bg-acento px-3 py-1.5 text-xs font-medium text-white transition hover:bg-acento-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo Chamado</span>
          </Link>
        </div>
      </div>

      {/* Tabela de Dados e Filtros Integrados */}
      <TabelaChamados
        dados={chamadosNormalizados}
        totalRegistros={count || 0}
        paginaAtual={pagina}
        porPagina={porPagina}
        motivos={motivos || []}
        usuarias={usuarias || []}
        perfilAtual={perfil}
        filtrosAtuais={params}
      />
    </div>
  );
}
