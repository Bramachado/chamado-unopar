import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { PainelDashboard } from "./painel-dashboard";
import { startOfMonth, endOfMonth, subMonths, format, parseISO, isBefore, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PageProps {
  searchParams: Promise<{
    periodo?: string;
  }>;
}

export default async function PaginaPainel({ searchParams }: PageProps) {
  await obterPerfilAtual();
  const params = await searchParams;
  const supabase = await criarClienteServidor();

  const periodo = params.periodo || "mes_atual";
  const hoje = new Date();

  let dataInicioStr = "";
  let dataFimStr = format(hoje, "yyyy-MM-dd");

  if (periodo === "mes_atual") {
    dataInicioStr = format(startOfMonth(hoje), "yyyy-MM-dd");
    dataFimStr = format(endOfMonth(hoje), "yyyy-MM-dd");
  } else if (periodo === "semestre_atual") {
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    if (mes <= 6) {
      dataInicioStr = `${ano}-01-01`;
      dataFimStr = `${ano}-06-30`;
    } else {
      dataInicioStr = `${ano}-07-01`;
      dataFimStr = `${ano}-12-31`;
    }
  } else {
    // ultimos 12 meses
    dataInicioStr = format(subMonths(hoje, 11), "yyyy-MM-01");
  }

  // 1. Buscar chamados do período selecionado
  const { data: chamadosPeriodo } = await supabase
    .from("chamados")
    .select(`
      id,
      protocolo,
      aluno_nome,
      situacao,
      prioridade,
      data_solicitacao,
      prazo,
      data_conclusao,
      motivos:motivo_id(codigo, nome),
      perfis:criado_por(nome_completo)
    `)
    .is("excluido_em", null)
    .gte("data_solicitacao", dataInicioStr)
    .lte("data_solicitacao", dataFimStr);

  const lista = chamadosPeriodo || [];

  const hojeStart = startOfDay(hoje);
  const limite2Dias = addDays(hojeStart, 2);

  let total = lista.length;
  let aguardando = 0;
  let concluidos = 0;
  let encerrados = 0;
  let vencidos = 0;
  let vencendo_em_2_dias = 0;

  const contagemMotivos: Record<string, { codigo: string; nome: string; total: number; diasTotais: number; concluidos: number }> = {};

  const chamadosCriticos: {
    id: string;
    protocolo: string;
    aluno_nome: string;
    prazo: string;
    status: "vencido" | "vencendo_em_2_dias";
    atendente: string;
  }[] = [];

  let somaDiasGeral = 0;
  let totalConcluidosGeral = 0;

  for (const c of lista) {
    if (c.situacao === "aguardando") aguardando++;
    if (c.situacao === "concluido") concluidos++;
    if (c.situacao === "encerrado") encerrados++;

    const dataPrazo = startOfDay(parseISO(c.prazo));

    if (c.situacao === "aguardando") {
      if (isBefore(dataPrazo, hojeStart)) {
        vencidos++;
        const atendenteNome = (c.perfis as unknown as { nome_completo?: string })?.nome_completo || "Atendente";
        chamadosCriticos.push({
          id: c.id,
          protocolo: c.protocolo,
          aluno_nome: c.aluno_nome,
          prazo: c.prazo,
          status: "vencido",
          atendente: atendenteNome,
        });
      } else if (isBefore(dataPrazo, limite2Dias) || dataPrazo.getTime() === limite2Dias.getTime()) {
        vencendo_em_2_dias++;
        const atendenteNome = (c.perfis as unknown as { nome_completo?: string })?.nome_completo || "Atendente";
        chamadosCriticos.push({
          id: c.id,
          protocolo: c.protocolo,
          aluno_nome: c.aluno_nome,
          prazo: c.prazo,
          status: "vencendo_em_2_dias",
          atendente: atendenteNome,
        });
      }
    }

    // Motivos
    const mot = c.motivos as unknown as { codigo?: string; nome?: string };
    const cod = mot?.codigo || "#00";
    const nomeMot = mot?.nome || "Outros";
    if (!contagemMotivos[cod]) {
      contagemMotivos[cod] = { codigo: cod, nome: nomeMot, total: 0, diasTotais: 0, concluidos: 0 };
    }
    contagemMotivos[cod].total++;

    if (c.situacao === "concluido" && c.data_conclusao) {
      const dias = Math.max(0, Math.round((parseISO(c.data_conclusao).getTime() - parseISO(c.data_solicitacao).getTime()) / (1000 * 60 * 60 * 24)));
      contagemMotivos[cod].diasTotais += dias;
      contagemMotivos[cod].concluidos++;
      somaDiasGeral += dias;
      totalConcluidosGeral++;
    }
  }

  // Top 10 Motivos (ordenados decrescente)
  const topMotivos = Object.values(contagemMotivos)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((m) => ({
      codigo: m.codigo,
      nome: m.nome,
      total: m.total,
    }));

  // Tempo Médio por Motivo (apenas motivos com >= 3 concluídos)
  const mediaGeralDias = totalConcluidosGeral > 0 ? Math.round((somaDiasGeral / totalConcluidosGeral) * 10) / 10 : 0;

  const tempoMedioPorMotivo = Object.values(contagemMotivos)
    .filter((m) => m.concluidos >= 3)
    .map((m) => ({
      motivo: m.codigo,
      nome: m.nome,
      dias: Math.round((m.diasTotais / m.concluidos) * 10) / 10,
      concluidos: m.concluidos,
    }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 8);

  let motivoMaisDemorado: { nome: string; fatorMultiplicador: number } | undefined;
  if (tempoMedioPorMotivo.length > 0 && mediaGeralDias > 0) {
    const primeiro = tempoMedioPorMotivo[0];
    if (primeiro && primeiro.dias > mediaGeralDias) {
      motivoMaisDemorado = {
        nome: primeiro.nome,
        fatorMultiplicador: Math.round((primeiro.dias / mediaGeralDias) * 10) / 10,
      };
    }
  }

  // 2. Buscar dados dos últimos 12 meses para os gráficos temporais
  const inicio12m = format(subMonths(hoje, 11), "yyyy-MM-01");
  const { data: chamados12m } = await supabase
    .from("chamados")
    .select("data_solicitacao, situacao, prazo, data_conclusao")
    .is("excluido_em", null)
    .gte("data_solicitacao", inicio12m);

  const mesesMap: Record<string, { total: number; concluidos: number; noPrazo: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(hoje, i);
    const chaveMes = format(d, "MMM/yy", { locale: ptBR });
    mesesMap[chaveMes] = { total: 0, concluidos: 0, noPrazo: 0 };
  }

  for (const c of chamados12m || []) {
    const d = parseISO(c.data_solicitacao);
    const chaveMes = format(d, "MMM/yy", { locale: ptBR });
    if (mesesMap[chaveMes]) {
      mesesMap[chaveMes].total++;
      if (c.situacao === "concluido") {
        mesesMap[chaveMes].concluidos++;
        if (c.data_conclusao && parseISO(c.data_conclusao) <= parseISO(c.prazo)) {
          mesesMap[chaveMes].noPrazo++;
        }
      }
    }
  }

  const volumeMensal = Object.entries(mesesMap).map(([mes, stats]) => ({
    mes,
    total: stats.total,
    concluidos: stats.concluidos,
    pendencia: Math.max(0, stats.total - stats.concluidos),
  }));

  const taxaPrazoMensal = Object.entries(mesesMap).map(([mes, stats]) => ({
    mes,
    taxa: stats.concluidos > 0 ? Math.round((stats.noPrazo / stats.concluidos) * 100) : null,
    totalResolvidos: stats.concluidos,
  }));

  const dadosDashboard = {
    totais: {
      total,
      aguardando,
      concluidos,
      encerrados,
      vencidos,
      vencendo_em_2_dias,
    },
    fila: {
      aguardando,
      concluidos,
      encerrados,
      total,
    },
    volumeMensal,
    topMotivos,
    tempoMedioPorMotivo,
    mediaGeralDias,
    motivoMaisDemorado,
    taxaPrazoMensal,
    chamadosVencidosOuProximos: chamadosCriticos.slice(0, 10),
  };

  return (
    <PainelDashboard
      dados={dadosDashboard}
      periodoSelecionado={periodo}
    />
  );
}
