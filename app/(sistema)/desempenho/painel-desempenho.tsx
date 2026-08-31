"use client";

import { useState } from "react";
import Link from "next/link";
import { type RankingItem, type Perfil } from "@/types/database";
import { 
  Award,
  ArrowRight,
  Zap,
  CheckCheck,
  Target,
  Info,
  Trophy,
  BarChart3,
  Sparkles,
  TrendingUp,
  Clock
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface EvolucaoItem {
  mes: string;
  minhaPontuacao: number;
  mediaEquipe: number;
}

interface PainelDesempenhoProps {
  rankingMes: RankingItem[];
  rankingSemestre: RankingItem[];
  perfilAtual: Perfil;
  evolucaoPessoal: EvolucaoItem[];
  rotuloSemestre: string;
}

export function PainelDesempenho({
  rankingMes,
  rankingSemestre,
  perfilAtual,
  evolucaoPessoal,
  rotuloSemestre,
}: PainelDesempenhoProps) {
  const [recorte, setRecorte] = useState<"mes" | "semestre">("mes");
  const [mostrarModalFormula, setMostrarModalFormula] = useState(false);

  const listaBruta = recorte === "mes" ? rankingMes : rankingSemestre;
  const listaOutraBruta = recorte === "mes" ? rankingSemestre : rankingMes;

  // 1. Lógica de Pontuação e Classificação
  const alguemPontuou = listaBruta.some((r) => (r.pontos_total || 0) > 0);
  const alguemPontuouOutro = listaOutraBruta.some((r) => (r.pontos_total || 0) > 0);

  const meuDado = listaBruta.find((r) => r.usuario_id === perfilAtual.id);
  const meusPontos = meuDado?.pontos_total ?? 0;
  const minhaPosicao = meuDado?.posicao;

  // Uma pessoa só tem classificação válida se houver pontuação e seus pontos forem > 0
  const temClassificacao = alguemPontuou && meusPontos > 0 && typeof minhaPosicao === "number";

  // Ordenação da lista de classificação:
  const listaOrdenada = [...listaBruta].sort((a, b) => {
    const pontosA = a.pontos_total || 0;
    const pontosB = b.pontos_total || 0;
    if (!alguemPontuou) {
      return a.nome_completo.localeCompare(b.nome_completo);
    }
    if (pontosA !== pontosB) {
      return pontosB - pontosA;
    }
    return a.nome_completo.localeCompare(b.nome_completo);
  });

  // Cálculo da distância para a posição acima
  let textoDistancia: string | null = null;
  if (temClassificacao && minhaPosicao && minhaPosicao > 1) {
    const pessoaAcima = listaBruta.find((r) => r.posicao === minhaPosicao - 1);
    if (pessoaAcima && pessoaAcima.pontos_total > meusPontos) {
      const diferencaPontos = Math.max(0, Math.round((pessoaAcima.pontos_total - meusPontos) * 10) / 10);
      const chamadosEstimados = Math.ceil(diferencaPontos / 4);
      textoDistancia = `${diferencaPontos} pts para alcançar o ${minhaPosicao - 1}º lugar (cerca de ${chamadosEstimados} chamado${chamadosEstimados > 1 ? "s" : ""} no prazo)`;
    }
  } else if (temClassificacao && minhaPosicao === 1) {
    textoDistancia = "Você está na 1ª colocação geral do período!";
  }

  // Estatísticas individuais
  const resolvidos = meuDado?.resolvidos ?? 0;
  const noPrazo = meuDado?.no_prazo ?? 0;
  const taxaPrazo = meuDado?.taxa_prazo ?? 0;
  const tempoMedio = meuDado?.tempo_medio_dias ?? 0;

  // Membros para o pódio (apenas quem tem pontuação > 0)
  const membrosComPontos = listaOrdenada.filter((m) => (m.pontos_total || 0) > 0);

  // Cálculo para o Gauge Circular de Progresso
  const metaPontos = 100;
  const progressoPercentual = Math.min(100, Math.round((meusPontos / metaPontos) * 100));
  const strokeDashoffset = 251.2 - (251.2 * progressoPercentual) / 100;

  return (
    <div className="space-y-8">
      {/* 1. Cabeçalho Padronizado da Página conforme Mockup */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-texto">
              Acompanhamento de Desempenho
            </h1>
            <span className="h-2 w-2 rounded-full bg-[#1D4ED8] animate-pulse" />
          </div>
          <p className="text-xs sm:text-sm text-texto-suave mt-1">
            Métricas de resolução efetiva, cumprimento de prazos e agilidade no atendimento.
          </p>
        </div>

        {/* Pill Switcher Mês Atual / Semestre Letivo */}
        <div className="flex items-center gap-2 rounded-2xl border border-borda bg-superficie p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setRecorte("mes")}
            className={`rounded-xl px-5 py-2 text-xs font-bold transition-all ${
              recorte === "mes"
                ? "bg-[#1D4ED8] text-white shadow-md shadow-blue-900/30"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            Mês atual
          </button>
          <button
            type="button"
            onClick={() => setRecorte("semestre")}
            className={`rounded-xl px-5 py-2 text-xs font-bold transition-all ${
              recorte === "semestre"
                ? "bg-[#1D4ED8] text-white shadow-md shadow-blue-900/30"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            Semestre letivo ({rotuloSemestre})
          </button>
        </div>
      </div>

      {/* 2. Hero Banner 3D com Gradiente Cósmico e Troféu */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-950/60 bg-gradient-to-r from-[#070D1E] via-[#0C1A3A] to-[#2E1065] p-7 sm:p-9 shadow-2xl text-white">
        {/* Efeitos de Luz e Brilho de Fundo */}
        <div className="absolute top-0 right-1/4 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-10 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Informações Textuais */}
          <div className="space-y-2 max-w-xl text-left">
            <span className="text-xs sm:text-sm font-semibold text-slate-300 tracking-wide block">
              Olá, {perfilAtual.nome_completo}!
            </span>
            
            {temClassificacao ? (
              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  {minhaPosicao}º lugar no ranking
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                  {textoDistancia}
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  Sem classificação neste período
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-normal mt-1.5 leading-relaxed">
                  Conclua um chamado dentro do prazo para entrar no ranking.
                </p>
              </div>
            )}
          </div>

          {/* Ilustração 3D Troféu / Neon Podium */}
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="relative h-28 w-28 sm:h-32 sm:w-32 flex items-center justify-center">
              {/* Brilho Radial em Torno do Troféu */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-600/40 via-indigo-500/40 to-purple-500/40 blur-xl animate-pulse" />
              
              {/* Pedestal & Troféu em SVG 3D Estilizado */}
              <div className="relative z-10 flex flex-col items-center justify-center">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-400 p-3.5 shadow-2xl shadow-blue-500/50 flex items-center justify-center border border-white/20 transform -rotate-3 hover:rotate-0 transition duration-300">
                  <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-white drop-shadow-md" />
                </div>
                {/* Base do Pedestal */}
                <div className="h-3 w-20 sm:w-24 rounded-full bg-gradient-to-r from-blue-400/40 via-purple-400/60 to-blue-400/40 blur-xs mt-2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Quatro Cards de Indicadores com Ícones Redondos e Ondas Decorativas */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Pontuação Total */}
        <div className="group rounded-2xl border border-borda bg-superficie p-5 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-texto-suave block">
                Pontuação total
              </span>
            </div>
          </div>

          <div>
            <span className="text-3xl font-black text-[#1D4ED8] tabular-nums block">
              {meusPontos} <span className="text-xs font-medium text-texto-suave">pts</span>
            </span>
            <span className="text-[11px] text-texto-suave block mt-0.5 font-medium">
              Volume, Prazo e Agilidade
            </span>
          </div>

          {/* Onda Decorativa em SVG */}
          <div className="pt-2">
            <svg className="w-full h-8 text-blue-500/20" viewBox="0 0 100 25" preserveAspectRatio="none">
              <path
                d="M0,15 C25,5 35,22 60,10 C85,-2 90,20 100,12 L100,25 L0,25 Z"
                fill="currentColor"
              />
              <path
                d="M0,15 C25,5 35,22 60,10 C85,-2 90,20 100,12"
                fill="none"
                stroke="#1D4ED8"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Chamados Concluídos */}
        <div className="group rounded-2xl border border-borda bg-superficie p-5 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
              <CheckCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-texto-suave block">
                Chamados concluídos
              </span>
            </div>
          </div>

          <div>
            <span className="text-3xl font-black text-emerald-500 tabular-nums block">
              {resolvidos}
            </span>
            <span className="text-[11px] text-texto-suave block mt-0.5 font-medium">
              Demandas com solução efetiva
            </span>
          </div>

          {/* Onda Decorativa Verde em SVG */}
          <div className="pt-2">
            <svg className="w-full h-8 text-emerald-500/20" viewBox="0 0 100 25" preserveAspectRatio="none">
              <path
                d="M0,20 C20,18 40,5 60,15 C80,25 90,5 100,10 L100,25 L0,25 Z"
                fill="currentColor"
              />
              <path
                d="M0,20 C20,18 40,5 60,15 C80,25 90,5 100,10"
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Cumprimento de Prazo */}
        <div className="group rounded-2xl border border-borda bg-superficie p-5 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-texto-suave block">
                Cumprimento de prazo
              </span>
            </div>
          </div>

          <div>
            <span className="text-3xl font-black text-amber-500 tabular-nums block">
              {resolvidos > 0 ? `${taxaPrazo}%` : "—"}
            </span>
            <span className="text-[11px] text-texto-suave block mt-0.5 font-medium">
              Meta do setor: 90% no prazo
            </span>
          </div>

          {/* Barra Segmentada Decorativa Âmbar */}
          <div className="pt-4 pb-2">
            <div className="flex items-center gap-1.5">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    taxaPrazo > 0 && i < Math.round((taxaPrazo / 100) * 8)
                      ? "bg-amber-500"
                      : "bg-amber-500/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Card 4: Tempo Médio */}
        <div className="group rounded-2xl border border-borda bg-superficie p-5 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-texto-suave block">
                Tempo médio
              </span>
            </div>
          </div>

          <div>
            <span className="text-3xl font-black text-purple-600 tabular-nums block">
              {tempoMedio > 0 ? `${tempoMedio}d` : "—"}
            </span>
            <span className="text-[11px] text-texto-suave block mt-0.5 font-medium">
              Meta: até 2 dias úteis
            </span>
          </div>

          {/* Onda Decorativa Roxa em SVG */}
          <div className="pt-2">
            <svg className="w-full h-8 text-purple-500/20" viewBox="0 0 100 25" preserveAspectRatio="none">
              <path
                d="M0,18 C20,8 40,22 65,12 C80,5 90,18 100,8 L100,25 L0,25 Z"
                fill="currentColor"
              />
              <path
                d="M0,18 C20,8 40,22 65,12 C80,5 90,18 100,8"
                fill="none"
                stroke="#9333EA"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 4. Linha do Meio: Destaques de Atendimento (Pódio) e Progresso no Mês */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Destaques de Atendimento (Pódio) - 2 Colunas */}
        <div className="lg:col-span-2 rounded-2xl border border-borda bg-superficie p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-borda pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[#1D4ED8]" />
              <h2 className="text-sm font-bold text-texto">
                Destaques de Atendimento (Pódio)
              </h2>
            </div>
            <span className="text-xs font-medium text-texto-suave">
              {recorte === "mes" ? "Mês atual" : `Semestre ${rotuloSemestre}`}
            </span>
          </div>

          {membrosComPontos.length === 0 ? (
            /* Estado Vazio Elegante com Ilustração de Pódio 3D conforme Mockup */
            <div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl border border-blue-100 dark:border-blue-950/40 bg-blue-50/40 dark:bg-blue-950/15 p-6">
              {/* Mini Ilustração Pódio 3D */}
              <div className="relative h-24 w-28 shrink-0 flex items-center justify-center">
                <div className="flex items-end justify-center gap-1.5 h-16">
                  <div className="w-7 h-10 rounded-t-lg bg-blue-300 dark:bg-blue-800 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
                    2
                  </div>
                  <div className="w-8 h-14 rounded-t-lg bg-[#1D4ED8] flex flex-col items-center justify-start pt-1 text-xs font-bold text-white shadow-md">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>1</span>
                  </div>
                  <div className="w-7 h-8 rounded-t-lg bg-blue-400 dark:bg-blue-700 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
                    3
                  </div>
                </div>
              </div>

              {/* Textos com Direção de Ação */}
              <div className="space-y-1.5 text-center sm:text-left flex-1">
                <h3 className="text-sm font-bold text-texto leading-snug">
                  Nenhum chamado foi concluído com pontuação no período selecionado.
                </h3>
                <p className="text-xs text-texto-suave leading-relaxed">
                  Conclua chamados dentro do prazo regulamentar para formar o pódio de atendimento.
                </p>
                <div className="pt-2">
                  <Link
                    href="/chamados"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-acento/40 bg-superficie px-4 py-2 text-xs font-bold text-[#1D4ED8] hover:bg-[#1D4ED8] hover:text-white transition shadow-xs"
                  >
                    <span>Ver chamados em aberto</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              {/* 1º Lugar */}
              {membrosComPontos[0] && (
                <div className="order-1 sm:order-2 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-amber-400/15 via-superficie to-superficie p-5 text-center shadow-md space-y-1.5">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-amber-950 font-extrabold text-xs shadow-sm">
                    1º
                  </div>
                  <span className="text-sm font-bold text-texto block truncate" title={membrosComPontos[0].nome_completo}>
                    {membrosComPontos[0].nome_completo}
                  </span>
                  <span className="text-xl font-black text-amber-500 tabular-nums block">
                    {membrosComPontos[0].pontos_total} pts
                  </span>
                  <span className="text-xs text-texto-suave block">
                    {membrosComPontos[0].resolvidos} resolvidos · {membrosComPontos[0].taxa_prazo}% prazo
                  </span>
                </div>
              )}

              {/* 2º Lugar */}
              {membrosComPontos[1] && (
                <div className="order-2 sm:order-1 rounded-2xl border border-borda bg-fundo p-5 text-center space-y-1.5">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-borda bg-superficie text-texto font-extrabold text-xs shadow-xs">
                    2º
                  </div>
                  <span className="text-sm font-bold text-texto block truncate" title={membrosComPontos[1].nome_completo}>
                    {membrosComPontos[1].nome_completo}
                  </span>
                  <span className="text-xl font-black text-texto tabular-nums block">
                    {membrosComPontos[1].pontos_total} pts
                  </span>
                  <span className="text-xs text-texto-suave block">
                    {membrosComPontos[1].resolvidos} resolvidos · {membrosComPontos[1].taxa_prazo}% prazo
                  </span>
                </div>
              )}

              {/* 3º Lugar */}
              {membrosComPontos[2] && (
                <div className="order-3 sm:order-3 rounded-2xl border border-borda bg-fundo p-5 text-center space-y-1.5">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-borda bg-superficie text-texto font-extrabold text-xs shadow-xs">
                    3º
                  </div>
                  <span className="text-sm font-bold text-texto block truncate" title={membrosComPontos[2].nome_completo}>
                    {membrosComPontos[2].nome_completo}
                  </span>
                  <span className="text-xl font-black text-texto tabular-nums block">
                    {membrosComPontos[2].pontos_total} pts
                  </span>
                  <span className="text-xs text-texto-suave block">
                    {membrosComPontos[2].resolvidos} resolvidos · {membrosComPontos[2].taxa_prazo}% prazo
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Circular Gauge: Progresso no Mês conforme Mockup */}
        <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-borda pb-3">
            <h2 className="text-sm font-bold text-texto">
              Progresso no mês
            </h2>
            <span className="text-xs text-texto-suave font-medium">Meta: 100 pts</span>
          </div>

          <div className="flex items-center gap-5 py-2">
            {/* Anel Circular de Progresso SVG */}
            <div className="relative h-24 w-24 shrink-0 flex items-center justify-center">
              <svg className="h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Trilha do Fundo */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-200 dark:text-slate-800"
                />
                {/* Barra de Progresso Ativa */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#1D4ED8"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              {/* Indicador Numérico Central */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-texto tabular-nums">
                  {progressoPercentual}%
                </span>
              </div>
            </div>

            {/* Explicação e Botão Modal */}
            <div className="space-y-2">
              <p className="text-xs text-texto-suave font-medium leading-relaxed">
                {meusPontos > 0
                  ? `Você acumulou ${meusPontos} pontos de meta no período selecionado.`
                  : "Você ainda não possui pontuação registrada."}
              </p>
              
              <button
                type="button"
                onClick={() => setMostrarModalFormula(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D4ED8] hover:underline"
              >
                <Info className="h-3.5 w-3.5" />
                <span>Entenda a pontuação</span>
              </button>
            </div>
          </div>

          <div className="border-t border-borda pt-2 text-[11px] text-texto-suave font-medium flex items-center justify-between">
            <span>Pontos atuais: <strong className="text-texto">{meusPontos} pts</strong></span>
            <span>Meta: <strong className="text-texto">{metaPontos} pts</strong></span>
          </div>
        </div>
      </div>

      {/* 5. Tabela de Classificação Geral com Avatares e Linhas de Alto Contraste */}
      <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-borda pb-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#1D4ED8]" />
              <h2 className="text-sm font-bold text-texto">
                Classificação Geral
              </h2>
            </div>
            <p className="text-xs text-texto-suave mt-0.5">
              Passe o mouse sobre os pontos para ver a composição (Volume 40%, Prazo 40%, Agilidade 20%).
            </p>
          </div>
          <span className="text-xs text-texto-suave font-semibold mt-1 sm:mt-0">
            {listaOrdenada.length} pessoas no atendimento
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
          <table className="tabela-densa">
            <thead>
              <tr>
                <th className="w-16 text-center">Posição</th>
                <th>Responsável</th>
                <th className="w-28 text-center">
                  {recorte === "mes" ? "No Semestre" : "No Mês"}
                </th>
                <th className="w-28 text-right">Resolvidos</th>
                <th className="w-28 text-right">No Prazo</th>
                <th className="w-28 text-right">Tempo Médio</th>
                <th className="w-28 text-right">Pontuação</th>
              </tr>
            </thead>
            <tbody>
              {listaOrdenada.map((item) => {
                const ehLogada = item.usuario_id === perfilAtual.id;
                const temPontosNeste = (item.pontos_total || 0) > 0;
                const textoPosicao = temPontosNeste && item.posicao ? `${item.posicao}º` : "—";

                const outroDado = listaOutraBruta.find((x) => x.usuario_id === item.usuario_id);
                const temPontosOutro = (outroDado?.pontos_total || 0) > 0;
                const posOutra = alguemPontuouOutro && temPontosOutro && outroDado?.posicao ? `${outroDado.posicao}º` : "—";

                return (
                  <tr
                    key={item.usuario_id}
                    className={
                      ehLogada
                        ? "bg-[#1D4ED8]/5 font-bold text-texto border-l-4 border-l-[#1D4ED8]"
                        : ""
                    }
                  >
                    <td className="text-center font-mono text-xs tabular-nums text-texto-suave font-semibold">
                      {textoPosicao}
                    </td>
                    <td className="text-xs">
                      <div className="flex items-center gap-2.5">
                        {/* Avatar Redondo com Iniciais */}
                        <div className="h-7 w-7 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center text-[10px] font-extrabold shadow-xs">
                          {item.nome_completo.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-texto font-bold">{item.nome_completo}</span>
                        {ehLogada && (
                          <span className="rounded-full bg-[#1D4ED8]/15 px-2 py-0.5 text-[9px] font-extrabold text-[#1D4ED8] border border-[#1D4ED8]/30">
                            Você
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums text-texto-suave">
                      {posOutra}
                    </td>
                    <td className="text-right font-mono text-xs tabular-nums text-texto font-bold">
                      {item.resolvidos}
                    </td>
                    <td className="text-right font-mono text-xs tabular-nums text-emerald-500 font-bold">
                      {item.resolvidos > 0 ? `${item.taxa_prazo}%` : "—"}
                    </td>
                    <td className="text-right font-mono text-xs tabular-nums text-texto-suave">
                      {item.tempo_medio_dias > 0 ? `${item.tempo_medio_dias}d` : "—"}
                    </td>
                    <td className="text-right font-mono text-xs font-black tabular-nums text-texto">
                      <span
                        className="cursor-help border-b border-dotted border-borda text-[#1D4ED8]"
                        title={`Composição dos ${item.pontos_total} pts:\n• Volume: ${item.pontos_volume} pts (40%)\n• Prazo: ${item.pontos_prazo} pts (40%)\n• Agilidade: ${item.pontos_agilidade} pts (20%)`}
                      >
                        {item.pontos_total} pts
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Gráfico de Evolução Histórica (6 Meses) e Metas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Evolução Pessoal com Média da Equipe */}
        <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#1D4ED8]" />
              <h2 className="text-sm font-bold text-texto">
                Evolução vs. Média da Equipe (Últimos 6 Meses)
              </h2>
            </div>
            <p className="text-xs text-texto-suave mt-0.5">
              Comparativo da sua pontuação mensal em relação à média geral.
            </p>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoPessoal} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <Tooltip formatter={(v, name) => [`${v} pts`, name === "minhaPontuacao" ? "Sua pontuação" : "Média da equipe"]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                <Line
                  type="monotone"
                  dataKey="minhaPontuacao"
                  name="Sua pontuação"
                  stroke="#1D4ED8"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="mediaEquipe"
                  name="Média da equipe"
                  stroke="var(--texto-suave)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Metas Individuais de Desempenho */}
        <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#1D4ED8]" />
              <h2 className="text-sm font-bold text-texto">
                Metas e Reconhecimentos
              </h2>
            </div>
            <p className="text-xs text-texto-suave mt-0.5">
              Conquistas e objetivos do setor de atendimento.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-950/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">100% de Prazo Cumprido</span>
                <span className="font-mono text-[11px] font-bold text-emerald-600">
                  {taxaPrazo}% no prazo
                </span>
              </div>
              <p className="text-[11px] text-texto-suave">
                Resolver chamados no prazo ({noPrazo} de {resolvidos} no prazo regulamentar).
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 dark:border-blue-950/50 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1D4ED8]">Alta Agilidade no Atendimento</span>
                <span className="font-mono text-[11px] font-bold text-[#1D4ED8]">
                  {tempoMedio > 0 ? `${tempoMedio}d média` : "—"}
                </span>
              </div>
              <p className="text-[11px] text-texto-suave">
                Manter o tempo médio de resolução abaixo de 2 dias úteis.
              </p>
            </div>

            <div className="rounded-xl border border-purple-200 dark:border-purple-950/50 bg-purple-50/40 dark:bg-purple-950/20 p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-purple-600 dark:text-purple-400">Volume Efetivo de Soluções</span>
                <span className="font-mono text-[11px] font-bold text-purple-600">
                  {resolvidos} concluídos
                </span>
              </div>
              <p className="text-[11px] text-texto-suave">
                Concluir com sucesso 15 ou mais chamados no período.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Educativo: Composição da Pontuação */}
      {mostrarModalFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-borda bg-superficie p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-borda pb-3">
              <div className="flex items-center gap-2 text-texto">
                <Trophy className="h-5 w-5 text-[#1D4ED8]" />
                <h3 className="text-base font-extrabold">
                  Como funciona a pontuação?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalFormula(false)}
                className="text-texto-suave hover:text-texto text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-texto leading-relaxed">
              O ranking é calculado a partir de três pilares fundamentais de atendimento ao aluno:
            </p>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 space-y-1">
                <span className="font-bold text-[#1D4ED8] block">
                  1. Volume Efetivo de Resoluções (Peso: 40%)
                </span>
                <p className="text-texto-suave">
                  Recompensa a quantidade total de chamados concluídos com solução no período.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-1">
                <span className="font-bold text-emerald-600 block">
                  2. Cumprimento do Prazo Regulamentar (Peso: 40%)
                </span>
                <p className="text-texto-suave">
                  Mede a porcentagem de chamados resolvidos dentro do prazo estipulado de 5 dias úteis.
                </p>
              </div>

              <div className="rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 p-3.5 space-y-1">
                <span className="font-bold text-purple-600 block">
                  3. Agilidade de Atendimento (Peso: 20%)
                </span>
                <p className="text-texto-suave">
                  Bonifica atendentes que mantêm a média de resolução abaixo de 2 dias úteis.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setMostrarModalFormula(false)}
                className="rounded-xl bg-[#1D4ED8] px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-600 transition shadow-md"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
