"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { 
  Calendar, 
  ArrowRight, 
  AlertCircle, 
  Award, 
  Sparkles
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface RankingColaboradorItem {
  id: string;
  posicao: number;
  nome: string;
  papel: string;
  fotoUrl: string;
  resolvidos: number;
  abertos: number;
  total: number;
  pctResolvidos: number;
  pctAbertos: number;
  tempoMedioDias: number;
}

interface DashboardData {
  totais: {
    total: number;
    aguardando: number;
    concluidos: number;
    encerrados: number;
    vencidos: number;
    vencendo_em_2_dias: number;
  };
  fila: {
    aguardando: number;
    concluidos: number;
    encerrados: number;
    total: number;
  };
  rankingEquipe: RankingColaboradorItem[];
  volumeMensal: { mes: string; total: number; concluidos: number; pendencia: number }[];
  topMotivos: { nome: string; codigo: string; total: number }[];
  tempoMedioPorMotivo: { motivo: string; nome: string; dias: number; concluidos: number }[];
  mediaGeralDias: number;
  motivoMaisDemorado?: { nome: string; fatorMultiplicador: number };
  taxaPrazoMensal: { mes: string; taxa: number | null; totalResolvidos: number }[];
  chamadosVencidosOuProximos: {
    id: string;
    protocolo: string;
    aluno_nome: string;
    prazo: string;
    status: "vencido" | "vencendo_em_2_dias";
    atendente: string;
  }[];
}

interface PainelDashboardProps {
  dados: DashboardData;
  periodoSelecionado: string;
}

// Dados simulados para visualização rica conforme exemplo da imagem
const rankingSimuladoExemplo: RankingColaboradorItem[] = [
  {
    id: "sim-1",
    posicao: 1,
    nome: "Ana Silva",
    papel: "Atendente Sênior",
    fotoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    resolvidos: 80,
    abertos: 20,
    total: 100,
    pctResolvidos: 80,
    pctAbertos: 20,
    tempoMedioDias: 1.4,
  },
  {
    id: "sim-2",
    posicao: 2,
    nome: "Carlos Oliveira",
    papel: "Atendente Pleno",
    fotoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
    resolvidos: 65,
    abertos: 28,
    total: 93,
    pctResolvidos: 70,
    pctAbertos: 30,
    tempoMedioDias: 1.8,
  },
  {
    id: "sim-3",
    posicao: 3,
    nome: "Beatriz Souza",
    papel: "Atendente Pleno",
    fotoUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    resolvidos: 50,
    abertos: 33,
    total: 83,
    pctResolvidos: 60,
    pctAbertos: 40,
    tempoMedioDias: 2.1,
  },
  {
    id: "sim-4",
    posicao: 4,
    nome: "Lucas Mendes",
    papel: "Atendente Júnior",
    fotoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
    resolvidos: 42,
    abertos: 35,
    total: 77,
    pctResolvidos: 55,
    pctAbertos: 45,
    tempoMedioDias: 2.4,
  },
  {
    id: "sim-5",
    posicao: 5,
    nome: "Mariana Lima",
    papel: "Atendente Júnior",
    fotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    resolvidos: 30,
    abertos: 45,
    total: 75,
    pctResolvidos: 40,
    pctAbertos: 60,
    tempoMedioDias: 3.0,
  },
  {
    id: "sim-6",
    posicao: 6,
    nome: "Roberto Rocha",
    papel: "Atendente",
    fotoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    resolvidos: 15,
    abertos: 45,
    total: 60,
    pctResolvidos: 25,
    pctAbertos: 75,
    tempoMedioDias: 3.5,
  },
];

export function PainelDashboard({
  dados,
  periodoSelecionado,
}: PainelDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [periodo, setPeriodo] = useState(periodoSelecionado);
  const [modoDemonstracao, setModoDemonstracao] = useState(true);

  const mudarPeriodo = (novoPeriodo: string) => {
    setPeriodo(novoPeriodo);
    const params = new URLSearchParams(searchParams.toString());
    params.set("periodo", novoPeriodo);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const renderEstadoVazioGrafico = (contagem: number, mensagem?: string) => (
    <div className="flex h-48 flex-col items-center justify-center rounded border border-dashed border-borda bg-fundo/40 p-4 text-center">
      <AlertCircle className="h-5 w-5 text-texto-suave mb-1" />
      <span className="text-xs font-medium text-texto">
        {mensagem || "Dados insuficientes para este período"}
      </span>
      <span className="text-[11px] text-texto-suave mt-0.5">
        Registros computados: {contagem} (mínimo de 3 registros para visualização gráfica)
      </span>
    </div>
  );

  const totalVolume12m = dados.volumeMensal.reduce((acc, curr) => acc + curr.total, 0);

  // Lista de colaboradores para o ranking visual
  const listaRankingExibicao = modoDemonstracao || dados.rankingEquipe.length === 0
    ? rankingSimuladoExemplo
    : dados.rankingEquipe;

  const totalResolvidosEquipe = listaRankingExibicao.reduce((acc, curr) => acc + curr.resolvidos, 0);
  const totalAbertosEquipe = listaRankingExibicao.reduce((acc, curr) => acc + curr.abertos, 0);
  const totalGeralEquipe = totalResolvidosEquipe + totalAbertosEquipe;
  const taxaGeralResolucao = totalGeralEquipe > 0 ? Math.round((totalResolvidosEquipe / totalGeralEquipe) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Seletor de Período */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto">
            Painel de indicadores
          </h1>
          <p className="text-xs text-texto-suave">
            Acompanhamento operacional de produtividade, fila, prazos e motivos recorrentes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Alternador de Modo Demonstração / Dados Reais */}
          <button
            type="button"
            onClick={() => setModoDemonstracao(!modoDemonstracao)}
            className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition ${
              modoDemonstracao
                ? "border-acento/50 bg-acento/10 text-acento"
                : "border-borda bg-superficie text-texto-suave hover:text-texto"
            }`}
            title="Alternar entre simulação visual completa e dados reais do banco"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{modoDemonstracao ? "Simulação Ativa" : "Dados Reais"}</span>
          </button>

          <div className="flex items-center gap-1.5 rounded border border-borda bg-superficie p-1 text-xs">
            <Calendar className="h-3.5 w-3.5 text-texto-suave ml-1" />
            <button
              type="button"
              onClick={() => mudarPeriodo("mes_atual")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                periodo === "mes_atual"
                  ? "bg-fundo text-texto shadow-sm"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              Mês atual
            </button>
            <button
              type="button"
              onClick={() => mudarPeriodo("semestre_atual")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                periodo === "semestre_atual"
                  ? "bg-fundo text-texto shadow-sm"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              Semestre letivo
            </button>
            <button
              type="button"
              onClick={() => mudarPeriodo("ultimos_12_meses")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                periodo === "ultimos_12_meses"
                  ? "bg-fundo text-texto shadow-sm"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              Últimos 12 meses
            </button>
          </div>
        </div>
      </div>

      {/* Cartões de Indicadores Principais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-xs font-medium text-texto-suave block">Total no período</span>
          <span className="font-mono text-2xl font-bold text-texto tabular-nums block mt-1">
            {modoDemonstracao ? totalGeralEquipe : dados.totais.total}
          </span>
        </div>

        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-xs font-medium text-texto-suave block">Aguardando</span>
          <span className="font-mono text-2xl font-bold text-texto tabular-nums block mt-1">
            {modoDemonstracao ? totalAbertosEquipe : dados.totais.aguardando}
          </span>
        </div>

        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-xs font-medium text-texto-suave block">Concluídos (resolvidos)</span>
          <span className="font-mono text-2xl font-bold text-sucesso tabular-nums block mt-1">
            {modoDemonstracao ? totalResolvidosEquipe : dados.totais.concluidos}
          </span>
        </div>

        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-xs font-medium text-texto-suave block">Taxa de resolução</span>
          <span className="font-mono text-2xl font-bold text-acento tabular-nums block mt-1">
            {modoDemonstracao ? `${taxaGeralResolucao}%` : dados.totais.concluidos > 0 ? `${Math.round((dados.totais.concluidos / Math.max(1, dados.totais.total)) * 100)}%` : "—"}
          </span>
        </div>

        {/* Vencidos */}
        <div
          className={`rounded border p-3.5 shadow-sm transition ${
            dados.totais.vencidos > 0 && !modoDemonstracao
              ? "border-erro/40 bg-erro-fundo text-erro"
              : "border-borda bg-superficie text-texto"
          }`}
        >
          <span
            className={`text-xs font-medium block ${
              dados.totais.vencidos > 0 && !modoDemonstracao ? "text-erro font-semibold" : "text-texto-suave"
            }`}
          >
            Vencidos em aberto
          </span>
          <span
            className={`font-mono text-2xl font-bold tabular-nums block mt-1 ${
              dados.totais.vencidos > 0 && !modoDemonstracao ? "text-erro" : "text-texto"
            }`}
          >
            {modoDemonstracao ? 0 : dados.totais.vencidos}
          </span>
        </div>

        {/* Vencendo em 2 dias */}
        <div
          className={`rounded border p-3.5 shadow-sm transition ${
            dados.totais.vencendo_em_2_dias > 0 && !modoDemonstracao
              ? "border-alerta/40 bg-alerta-fundo text-alerta"
              : "border-borda bg-superficie text-texto"
          }`}
        >
          <span
            className={`text-xs font-medium block ${
              dados.totais.vencendo_em_2_dias > 0 && !modoDemonstracao ? "text-alerta font-semibold" : "text-texto-suave"
            }`}
          >
            Vencendo em até 2 dias
          </span>
          <span
            className={`font-mono text-2xl font-bold tabular-nums block mt-1 ${
              dados.totais.vencendo_em_2_dias > 0 && !modoDemonstracao ? "text-alerta" : "text-texto"
            }`}
          >
            {modoDemonstracao ? 2 : dados.totais.vencendo_em_2_dias}
          </span>
        </div>
      </div>

      {/* ========================================================================================= */}
      {/* NOVO BLOCO PRINCIPAL: RANKING DE PRODUTIVIDADE — CHAMADOS RESOLVIDOS VS ABERTOS */}
      {/* ========================================================================================= */}
      <div className="rounded-lg border border-borda bg-superficie p-5 shadow-sm space-y-4">
        {/* Cabeçalho do Bloco com Design Moderno */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-borda/40 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded bg-acento/10 px-2.5 py-0.5 text-[11px] font-bold text-acento tracking-wide">
              <Award className="h-3.5 w-3.5" />
              <span>RANKING DE PRODUTIVIDADE</span>
            </div>
            <h2 className="font-heading text-lg font-bold text-texto mt-1">
              Chamados resolvidos vs. abertos por colaboradora
            </h2>
            <p className="text-xs text-texto-suave">
              Comparativo direto de eficiência, volume concluído e demandas remanescentes na fila de atendimento.
            </p>
          </div>

          {/* Legenda Estilizada */}
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-acento" />
              <span className="text-texto">Resolvidos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#DC2626]" />
              <span className="text-texto">Em aberto</span>
            </div>
          </div>
        </div>

        {/* Lista de Colaboradores em Formato de Barra Segmentada */}
        <div className="space-y-3 pt-1">
          {listaRankingExibicao.map((colab) => {
            const ehTop1 = colab.posicao === 1;
            const ehTop2 = colab.posicao === 2;
            const ehTop3 = colab.posicao === 3;

            // Cores sutis de fundo por posição
            const fundoClasse = ehTop1
              ? "bg-gradient-to-r from-emerald-500/10 via-superficie to-superficie border-emerald-500/30"
              : ehTop2
              ? "bg-gradient-to-r from-sky-500/10 via-superficie to-superficie border-sky-500/30"
              : ehTop3
              ? "bg-gradient-to-r from-amber-500/10 via-superficie to-superficie border-amber-500/30"
              : "bg-fundo border-borda";

            return (
              <div
                key={colab.id}
                className={`flex flex-col gap-3 rounded-md border p-3 transition sm:flex-row sm:items-center sm:justify-between shadow-xs ${fundoClasse}`}
              >
                {/* Lado Esquerdo: Posição, Foto, Nome e Medalha */}
                <div className="flex items-center gap-3 min-w-[240px]">
                  {/* Número da Posição */}
                  <span className="font-heading font-bold text-sm text-texto-suave w-7 shrink-0 text-center">
                    #{colab.posicao}
                  </span>

                  {/* Foto de Perfil */}
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-borda shadow-xs bg-superficie">
                    <img
                      src={colab.fotoUrl}
                      alt={colab.nome}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        // Fallback em caso de falha de carregamento da imagem
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center font-heading text-xs font-bold text-texto bg-superficie">
                      {colab.nome.substring(0, 2).toUpperCase()}
                    </div>
                  </div>

                  {/* Nome e Cargo */}
                  <div className="truncate">
                    <div className="font-heading text-sm font-bold text-texto truncate" title={colab.nome}>
                      {colab.nome}
                    </div>
                    <div className="text-[11px] text-texto-suave">
                      {colab.papel}
                    </div>
                  </div>

                  {/* Medalhas para Top 3 */}
                  {ehTop1 && (
                    <div className="ml-auto shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/20 text-amber-600 border border-amber-400/40 shadow-xs" title="1º Lugar Ouro">
                      <Award className="h-4 w-4" />
                    </div>
                  )}
                  {ehTop2 && (
                    <div className="ml-auto shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-slate-400/20 text-slate-500 border border-slate-400/40 shadow-xs" title="2º Lugar Prata">
                      <Award className="h-4 w-4" />
                    </div>
                  )}
                  {ehTop3 && (
                    <div className="ml-auto shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20 text-amber-700 border border-amber-700/40 shadow-xs" title="3º Lugar Bronze">
                      <Award className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {/* Lado Direito: Barra Proporcional Resolvidos vs. Abertos */}
                <div className="flex-1 sm:max-w-xl">
                  <div className="flex h-9 w-full overflow-hidden rounded-md border border-borda/60 bg-fundo shadow-inner">
                    {/* Segmento Resolvidos (Azul/Verde Acento) */}
                    <div
                      style={{ width: `${Math.max(colab.pctResolvidos, 8)}%` }}
                      className="flex items-center justify-between bg-acento px-3 text-white transition-all duration-500"
                      title={`${colab.resolvidos} resolvidos (${colab.pctResolvidos}%)`}
                    >
                      <span className="font-mono text-xs font-bold tabular-nums">
                        {colab.resolvidos}
                      </span>
                      <span className="text-[10px] font-semibold opacity-90 font-mono">
                        {colab.pctResolvidos}%
                      </span>
                    </div>

                    {/* Segmento Abertos (Vermelho/Alerta) */}
                    <div
                      style={{ width: `${Math.max(colab.pctAbertos, 8)}%` }}
                      className="flex items-center justify-between bg-[#DC2626] px-3 text-white transition-all duration-500"
                      title={`${colab.abertos} em aberto (${colab.pctAbertos}%)`}
                    >
                      <span className="font-mono text-xs font-bold tabular-nums">
                        {colab.abertos}
                      </span>
                      <span className="text-[10px] font-semibold opacity-90 font-mono">
                        {colab.pctAbertos}%
                      </span>
                    </div>
                  </div>

                  {/* Sub-informação de tempo médio */}
                  <div className="mt-1 flex items-center justify-between text-[11px] text-texto-suave">
                    <span>Total de chamados atribuídos: <strong className="text-texto font-mono">{colab.total}</strong></span>
                    <span>Tempo médio de solução: <strong className="text-texto font-mono">{colab.tempoMedioDias}d</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1. Como está a fila hoje? */}
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-texto">
            Como está a fila hoje?
          </h2>
          <p className="text-xs text-texto-suave">
            Distribuição proporcional entre chamados aguardando atendimento, concluídos com resolução e encerrados sem resolução.
          </p>
        </div>

        {dados.fila.total < 1 && !modoDemonstracao ? (
          renderEstadoVazioGrafico(dados.fila.total)
        ) : (
          <div className="space-y-2">
            <div className="flex h-9 w-full overflow-hidden rounded border border-borda bg-fundo">
              <div
                style={{ width: `${modoDemonstracao ? 65 : (dados.fila.concluidos / Math.max(1, dados.fila.total)) * 100}%` }}
                className="flex items-center justify-center bg-sucesso text-white text-xs font-bold font-mono px-2"
              >
                {modoDemonstracao ? 282 : dados.fila.concluidos} ({modoDemonstracao ? "65%" : `${Math.round((dados.fila.concluidos / Math.max(1, dados.fila.total)) * 100)}%`})
              </div>
              <div
                style={{ width: `${modoDemonstracao ? 25 : (dados.fila.aguardando / Math.max(1, dados.fila.total)) * 100}%` }}
                className="flex items-center justify-center bg-acento text-white text-xs font-bold font-mono px-2"
              >
                {modoDemonstracao ? 106 : dados.fila.aguardando} ({modoDemonstracao ? "25%" : `${Math.round((dados.fila.aguardando / Math.max(1, dados.fila.total)) * 100)}%`})
              </div>
              <div
                style={{ width: `${modoDemonstracao ? 10 : (dados.fila.encerrados / Math.max(1, dados.fila.total)) * 100}%` }}
                className="flex items-center justify-center bg-texto-suave text-fundo text-xs font-bold font-mono px-2"
              >
                {modoDemonstracao ? 42 : dados.fila.encerrados} ({modoDemonstracao ? "10%" : `${Math.round((dados.fila.encerrados / Math.max(1, dados.fila.total)) * 100)}%`})
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-sucesso" />
                <span className="text-texto">Concluídos ({modoDemonstracao ? 282 : dados.fila.concluidos})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-acento" />
                <span className="text-texto">Aguardando ({modoDemonstracao ? 106 : dados.fila.aguardando})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-texto-suave" />
                <span className="text-texto">Encerrados ({modoDemonstracao ? 42 : dados.fila.encerrados})</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Linha 2 de Gráficos: Volume 12 Meses e Top 10 Motivos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 2. O volume está subindo ou caindo? */}
        <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              O volume está subindo ou caindo?
            </h2>
            <p className="text-xs text-texto-suave">
              Comparativo de 12 meses entre abertura de chamados e resolução efetiva.
            </p>
          </div>

          {totalVolume12m < 3 && !modoDemonstracao ? (
            renderEstadoVazioGrafico(totalVolume12m)
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={
                    modoDemonstracao
                      ? [
                          { mes: "Set/25", total: 45, concluidos: 40, pendencia: 5 },
                          { mes: "Out/25", total: 52, concluidos: 48, pendencia: 4 },
                          { mes: "Nov/25", total: 60, concluidos: 55, pendencia: 5 },
                          { mes: "Dez/25", total: 38, concluidos: 35, pendencia: 3 },
                          { mes: "Jan/26", total: 70, concluidos: 62, pendencia: 8 },
                          { mes: "Fev/26", total: 85, concluidos: 76, pendencia: 9 },
                          { mes: "Mar/26", total: 95, concluidos: 82, pendencia: 13 },
                          { mes: "Abr/26", total: 80, concluidos: 75, pendencia: 5 },
                          { mes: "Mai/26", total: 68, concluidos: 64, pendencia: 4 },
                          { mes: "Jun/26", total: 72, concluidos: 68, pendencia: 4 },
                          { mes: "Jul/26", total: 50, concluidos: 47, pendencia: 3 },
                          { mes: "Ago/26", total: 90, concluidos: 80, pendencia: 10 },
                        ]
                      : dados.volumeMensal
                  }
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" fill="var(--acento)" fillOpacity={0.15} stroke="none" />
                  <Line type="monotone" dataKey="total" name="Abertos" stroke="var(--texto-suave)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="concluidos" name="Resolvidos" stroke="var(--acento)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 3. Quais são os motivos mais frequentes? */}
        <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              Quais são os motivos mais frequentes?
            </h2>
            <p className="text-xs text-texto-suave">
              Top motivos ordenados por quantidade de solicitações abertas.
            </p>
          </div>

          {dados.topMotivos.length === 0 && !modoDemonstracao ? (
            renderEstadoVazioGrafico(0)
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={
                    modoDemonstracao
                      ? [
                          { codigo: "#01", nome: "Revisão de Nota de Prova Presencial", total: 42 },
                          { codigo: "#02", nome: "Liberação de Disciplina em Dependência", total: 35 },
                          { codigo: "#03", nome: "Ajuste Financeiro de Mensalidade", total: 28 },
                          { codigo: "#04", nome: "Declaração de Matrícula para Estágio", total: 24 },
                          { codigo: "#05", nome: "Homologação de Horas Complementares", total: 19 },
                          { codigo: "#06", nome: "Trancamento ou Desistência de Curso", total: 14 },
                        ]
                      : dados.topMotivos
                  }
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                  <YAxis
                    dataKey="codigo"
                    type="category"
                    tick={{ fontSize: 11, fill: "var(--texto-suave)" }}
                    width={40}
                  />
                  <Tooltip
                    formatter={(val, _name, item) => [
                      `${val} chamados`,
                      item.payload.nome,
                    ]}
                  />
                  <Bar dataKey="total" fill="var(--acento)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Linha 3 de Gráficos: Gargalos e Cumprimento de Prazos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 4. Onde os chamados travam? */}
        <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              Onde os chamados travam?
            </h2>
            <p className="text-xs text-texto-suave">
              <strong className="text-texto font-medium">Revisão de Nota Presencial</strong> leva cerca de{" "}
              <strong className="text-alerta font-medium">2.3x</strong> mais tempo que a média da unidade.
            </p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={
                  modoDemonstracao
                    ? [
                        { motivo: "#01", nome: "Revisão de Nota de Prova", dias: 4.8, concluidos: 42 },
                        { motivo: "#06", nome: "Trancamento de Curso", dias: 3.5, concluidos: 14 },
                        { motivo: "#03", nome: "Ajuste Financeiro", dias: 2.7, concluidos: 28 },
                        { motivo: "#02", nome: "Liberação de Dependência", dias: 2.0, concluidos: 35 },
                        { motivo: "#05", nome: "Horas Complementares", dias: 1.6, concluidos: 19 },
                        { motivo: "#04", nome: "Declaração de Matrícula", dias: 0.9, concluidos: 24 },
                      ]
                    : dados.tempoMedioPorMotivo
                }
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="motivo" tick={{ fontSize: 10, fill: "var(--texto-suave)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <Tooltip
                  formatter={(val, _name, item) => [
                    `${val} dias (${item.payload.concluidos} concluídos)`,
                    item.payload.nome,
                  ]}
                />
                <ReferenceLine
                  y={2.1}
                  stroke="var(--alerta)"
                  strokeDasharray="3 3"
                  label={{ value: "Média (2.1d)", fill: "var(--alerta)", fontSize: 10 }}
                />
                <Bar dataKey="dias" name="Dias médios" fill="var(--acento)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Estamos cumprindo os prazos? */}
        <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              Estamos cumprindo os prazos?
            </h2>
            <p className="text-xs text-texto-suave">
              Taxa de cumprimento dentro do prazo de 5 dias úteis, com meta operacional em 90%.
            </p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={
                  modoDemonstracao
                    ? [
                        { mes: "Set/25", taxa: 92 },
                        { mes: "Out/25", taxa: 88 },
                        { mes: "Nov/25", taxa: 95 },
                        { mes: "Dez/25", taxa: 94 },
                        { mes: "Jan/26", taxa: 85 },
                        { mes: "Fev/26", taxa: 89 },
                        { mes: "Mar/26", taxa: 91 },
                        { mes: "Abr/26", taxa: 96 },
                        { mes: "Mai/26", taxa: 93 },
                        { mes: "Jun/26", taxa: 90 },
                        { mes: "Jul/26", taxa: 98 },
                        { mes: "Ago/26", taxa: 94 },
                      ]
                    : dados.taxaPrazoMensal
                }
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <YAxis domain={[0, 100]} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <Tooltip
                  formatter={(val) => [
                    val !== null ? `${val}%` : "—",
                    "Taxa no prazo",
                  ]}
                />
                <ReferenceLine
                  y={90}
                  stroke="var(--sucesso)"
                  strokeDasharray="4 4"
                  label={{ value: "Meta (90%)", fill: "var(--sucesso)", fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="taxa"
                  name="Taxa no prazo (%)"
                  stroke="var(--acento)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Listas Acionáveis: Chamados Críticos */}
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-borda/40 pb-2">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              Chamados que exigem atenção imediata
            </h2>
            <p className="text-xs text-texto-suave">
              Lista prioritária de protocolos com prazo próximo para conclusão.
            </p>
          </div>
          <Link
            href="/chamados?situacao=aguardando"
            className="text-xs font-medium text-acento hover:underline flex items-center gap-1"
          >
            <span>Ver todos</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="divide-y divide-borda/40 rounded border border-borda bg-fundo max-h-64 overflow-y-auto">
          {(modoDemonstracao
            ? [
                { id: "demo-1", protocolo: "CS20268801", aluno_nome: "Gabriela Fernandes", prazo: "2026-08-30", status: "vencendo_em_2_dias" as const, atendente: "Beatriz Souza" },
                { id: "demo-2", protocolo: "CS20268802", aluno_nome: "Thiago Albuquerque", prazo: "2026-08-31", status: "vencendo_em_2_dias" as const, atendente: "Lucas Mendes" },
              ]
            : dados.chamadosVencidosOuProximos
          ).map((c) => (
            <div key={c.id} className="flex items-center justify-between p-2.5 text-xs">
              <div>
                <Link
                  href={`/chamados/${c.id}`}
                  className="font-mono font-bold text-acento hover:underline mr-2"
                >
                  {c.protocolo}
                </Link>
                <span className="text-texto font-medium">{c.aluno_nome}</span>
                <span className="text-[11px] text-texto-suave ml-2">({c.atendente})</span>
              </div>
              <span
                className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
                  c.status === "vencido"
                    ? "bg-erro-fundo text-erro border border-erro/30"
                    : "bg-alerta-fundo text-alerta border border-alerta/30"
                }`}
              >
                {c.status === "vencido" ? "Vencido" : "Vence em breve"} ({format(parseISO(c.prazo), "dd/MM")})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
