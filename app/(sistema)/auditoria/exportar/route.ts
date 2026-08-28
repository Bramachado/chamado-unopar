import { criarClienteServidor } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function GET(request: NextRequest) {
  const supabase = await criarClienteServidor();
  const searchParams = request.nextUrl.searchParams;

  // Verificar se é admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });

  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();

  if (perfil?.papel !== "admin") {
    return new NextResponse("Acesso restrito a administradoras", { status: 403 });
  }

  let query = supabase.from("logs_auditoria").select("*");

  const busca = searchParams.get("busca");
  if (busca && busca.trim() !== "") {
    const termo = busca.trim();
    if (termo.match(/^CS[0-9]{1,8}$/i)) {
      query = query.ilike("protocolo", `${termo}%`);
    } else {
      query = query.ilike("usuario_nome", `%${termo}%`);
    }
  }

  const tabela = searchParams.get("tabela");
  if (tabela) query = query.eq("tabela", tabela);

  const operacao = searchParams.get("operacao");
  if (operacao) query = query.eq("operacao", operacao);

  const dataInicio = searchParams.get("data_inicio");
  if (dataInicio) query = query.gte("criado_em", `${dataInicio}T00:00:00Z`);

  const dataFim = searchParams.get("data_fim");
  if (dataFim) query = query.lte("criado_em", `${dataFim}T23:59:59Z`);

  query = query.order("criado_em", { ascending: false });

  const { data: logs, error } = await query;
  if (error || !logs) {
    return new NextResponse("Erro ao exportar logs", { status: 500 });
  }

  const cabecalho = [
    "ID",
    "Data Hora",
    "Operação",
    "Tabela",
    "Protocolo",
    "Usuária",
    "IP",
    "Campos Alterados",
    "Dados Antes (JSON)",
    "Dados Depois (JSON)",
  ];

  const escapeCSV = (val?: string | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const linhas = logs.map((l) => [
    escapeCSV(String(l.id)),
    escapeCSV(format(parseISO(l.criado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })),
    escapeCSV(l.operacao),
    escapeCSV(l.tabela),
    escapeCSV(l.protocolo || ""),
    escapeCSV(l.usuario_nome || "Sistema"),
    escapeCSV(l.ip || "127.0.0.1"),
    escapeCSV(l.campos_alterados ? l.campos_alterados.join(", ") : ""),
    escapeCSV(l.dados_antes ? JSON.stringify(l.dados_antes) : ""),
    escapeCSV(l.dados_depois ? JSON.stringify(l.dados_depois) : ""),
  ].join(";"));

  const conteudoCSV = "\uFEFF" + [cabecalho.join(";"), ...linhas].join("\r\n");
  const nomeArquivo = `auditoria_unopar_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(conteudoCSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
