import { criarClienteServidor } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function GET(request: NextRequest) {
  const supabase = await criarClienteServidor();
  const searchParams = request.nextUrl.searchParams;

  let query = supabase
    .from("chamados")
    .select(`
      protocolo,
      aluno_nome,
      aluno_ra,
      contato_telefone,
      situacao,
      prioridade,
      data_solicitacao,
      prazo,
      data_conclusao,
      descricao,
      observacao,
      motivos:motivo_id(codigo, nome),
      perfis:criado_por(nome_completo)
    `)
    .is("excluido_em", null);

  const busca = searchParams.get("busca");
  if (busca && busca.trim() !== "") {
    const limpo = busca.trim();
    if (limpo.match(/^CS[0-9]{1,8}$/i)) {
      query = query.ilike("protocolo", `${limpo}%`);
    } else {
      query = query.ilike("aluno_nome", `%${limpo}%`);
    }
  }

  const situacao = searchParams.get("situacao");
  if (situacao) query = query.eq("situacao", situacao);

  const prioridade = searchParams.get("prioridade");
  if (prioridade) query = query.eq("prioridade", prioridade);

  const motivoId = searchParams.get("motivo_id");
  if (motivoId) query = query.eq("motivo_id", motivoId);

  const responsavelId = searchParams.get("responsavel_id");
  if (responsavelId) query = query.eq("criado_por", responsavelId);

  const dataInicio = searchParams.get("data_inicio");
  if (dataInicio) query = query.gte("data_solicitacao", dataInicio);

  const dataFim = searchParams.get("data_fim");
  if (dataFim) query = query.lte("data_solicitacao", dataFim);

  query = query.order("data_solicitacao", { ascending: false });

  const { data: chamados, error } = await query;

  if (error || !chamados) {
    return new NextResponse("Erro ao gerar relatório CSV", { status: 500 });
  }

  // Montar CSV com delimitador ponto e vírgula para Excel em pt-BR e BOM UTF-8
  const cabecalho = [
    "Protocolo",
    "Aluno",
    "RA",
    "Telefone",
    "Código Motivo",
    "Motivo",
    "Situação",
    "Prioridade",
    "Data Solicitação",
    "Prazo",
    "Data Conclusão",
    "Responsável",
    "Descrição",
    "Observação",
  ];

  const escapeCSV = (val?: string | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const linhas = chamados.map((c) => {
    const motivoObj = c.motivos as unknown as { codigo?: string; nome?: string };
    const perfilObj = c.perfis as unknown as { nome_completo?: string };

    return [
      escapeCSV(c.protocolo),
      escapeCSV(c.aluno_nome),
      escapeCSV(c.aluno_ra || ""),
      escapeCSV(c.contato_telefone || ""),
      escapeCSV(motivoObj?.codigo || ""),
      escapeCSV(motivoObj?.nome || ""),
      escapeCSV(c.situacao),
      escapeCSV(c.prioridade),
      escapeCSV(c.data_solicitacao ? format(parseISO(c.data_solicitacao), "dd/MM/yyyy", { locale: ptBR }) : ""),
      escapeCSV(c.prazo ? format(parseISO(c.prazo), "dd/MM/yyyy", { locale: ptBR }) : ""),
      escapeCSV(c.data_conclusao ? format(parseISO(c.data_conclusao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""),
      escapeCSV(perfilObj?.nome_completo || "Histórico"),
      escapeCSV(c.descricao || ""),
      escapeCSV(c.observacao || ""),
    ].join(";");
  });

  const conteudoCSV = "\uFEFF" + [cabecalho.join(";"), ...linhas].join("\r\n");

  const nomeArquivo = `chamados_unopar_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(conteudoCSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
