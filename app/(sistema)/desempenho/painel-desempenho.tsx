"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { type RankingItem, type Perfil, type Polo } from "@/types/database";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";
import { ArrowRight, Zap, CheckCheck, Target, Info, Trophy, BarChart3, Clock } from "lucide-react";
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
  polos?: Polo[];
  poloSelecionado?: string;
}

export function PainelDesempenho({
  rankingMes,
  rankingSemestre,
  perfilAtual,
  evolucaoPessoal,
  rotuloSemestre,
  polos = [],
  poloSelecionado = "todos",
}: PainelDesempenhoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [recorte, setRecorte] = useState<"mes" | "semestre">("mes");
  const [poloId, setPoloId] = useState(poloSelecionado);
  const [mostrarModalFormula, setMostrarModalFormula] = useState(false);

  const opcoesPolo: CustomSelectOption[] = [
    { value: "todos", label: "Todos os Polos (Consolidado)" },
    ...polos.map((p) => ({
      value: p.id,
      label: `${p.nome} (${p.cidade})`,
    })),
  ];

  const mudarPolo = (novoPolo: string) => {
    setPoloId(novoPolo);
    const params = new URLSearchParams(searchParams.toString());
    if (novoPolo !== "todos") {
      params.set("polo_id", novoPolo);
    } else {
      params.delete("polo_id");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const ehAdmin = perfilAtual.papel === "admin";
  const listaBruta = recorte === "mes" ? rankingMes : rankingSemestre;

  // 1. Lógica de Pontuação e Classificação
  const alguemPontuou = listaBruta.some((r) => (r.pontos_total || 0) > 0);
  const meuDado = !ehAdmin ? listaBruta.find((r) => r.usuario_id === perfilAtual.id) : null;
  const meusPontos = meuDado?.pontos_total ?? 0;
  const minhaPosicao = meuDado?.posicao;

  // Classificação válida apenas quando há pontuação real no período e usuário participa do ranking
  const temClassificacao =
    !ehAdmin && alguemPontuou && meusPontos > 0 && typeof minhaPosicao === "number";

  // Indicadores consolidados da equipe (utilizados na visão do Administrador)
  const totalParticipantes = listaBruta.length;
  const somaPontosEquipe = listaBruta.reduce((acc, curr) => acc + (curr.pontos_total || 0), 0);
  const mediaPontosEquipe =
    totalParticipantes > 0 ? Math.round((somaPontosEquipe / totalParticipantes) * 10) / 10 : 0;

  const totalResolvidosEquipe = listaBruta.reduce((acc, curr) => acc + (curr.resolvidos || 0), 0);
  const totalNoPrazoEquipe = listaBruta.reduce((acc, curr) => acc + (curr.no_prazo || 0), 0);
  const taxaPrazoEquipe =
    totalResolvidosEquipe > 0 ? Math.round((totalNoPrazoEquipe / totalResolvidosEquipe) * 100) : 0;

  const somaDiasEquipe = listaBruta.reduce(
    (acc, curr) => acc + curr.tempo_medio_dias * curr.resolvidos,
    0
  );
  const tempoMedioEquipe =
    totalResolvidosEquipe > 0 ? Math.round((somaDiasEquipe / totalResolvidosEquipe) * 10) / 10 : 0;

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

  let textoDistancia: string | null = null;
  if (temClassificacao && minhaPosicao && minhaPosicao > 1) {
    const pessoaAcima = listaBruta.find((r) => r.posicao === minhaPosicao - 1);
    if (pessoaAcima && pessoaAcima.pontos_total > meusPontos) {
      const diferencaPontos = Math.max(
        0,
        Math.round((pessoaAcima.pontos_total - meusPontos) * 10) / 10
      );
      const chamadosEstimados = Math.ceil(diferencaPontos / 4);
      textoDistancia = `${diferencaPontos} pts para alcançar o ${minhaPosicao - 1}º lugar (aprox. ${chamadosEstimados} chamado${chamadosEstimados > 1 ? "s" : ""} no prazo)`;
    }
  } else if (temClassificacao && minhaPosicao === 1) {
    textoDistancia = "Você está na 1ª colocação geral do período.";
  }

  const resolvidos = meuDado?.resolvidos ?? 0;
  const taxaPrazo = meuDado?.taxa_prazo ?? 0;
  const tempoMedio = meuDado?.tempo_medio_dias ?? 0;

  const membrosComPontos = listaOrdenada.filter((m) => (m.pontos_total || 0) > 0);

  const metaPontos = 100;
  const pontosReferenciaGauge = ehAdmin ? mediaPontosEquipe : meusPontos;
  const progressoPercentual = Math.min(100, Math.round((pontosReferenciaGauge / metaPontos) * 100));
  const strokeDashoffset = 251.2 - (251.2 * progressoPercentual) / 100;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* 1. Cabeçalho da Página */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-texto">
            Acompanhamento de Desempenho
          </h1>
          <p className="text-xs sm:text-sm text-texto-suave mt-0.5">
            Métricas de resolução efetiva, cumprimento de prazos e agilidade no atendimento.
          </p>
        </div>

        {/* Seletores de Polo e Período */}
        <div className="flex flex-wrap items-center gap-3">
          {polos.length > 0 && (
            <div className="w-56">
              <CustomSelect
                options={opcoesPolo}
                value={poloId}
                onChange={(val) => mudarPolo(val)}
              />
            </div>
          )}

          {/* Seletor Mês Atual / Semestre Letivo */}
          <div className="flex items-center gap-1.5 rounded-xl border border-borda bg-superficie p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setRecorte("mes")}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                recorte === "mes"
                  ? "bg-[#1D4ED8] text-white shadow-xs"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              Mês atual
            </button>
            <button
              type="button"
              onClick={() => setRecorte("semestre")}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                recorte === "semestre"
                  ? "bg-[#1D4ED8] text-white shadow-xs"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              Semestre letivo ({rotuloSemestre})
            </button>
          </div>
        </div>
      </div>

      {/* 2. Banner de Status do Usuário */}
      <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-texto-suave">
              Operador: {perfilAtual.nome_completo}
            </span>
            {ehAdmin && (
              <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 border border-purple-500/20">
                Administrador
              </span>
            )}
          </div>
          {ehAdmin ? (
            <div>
              <h2 className="text-xl font-bold text-texto tracking-tight">
                Painel Gerencial de Desempenho
              </h2>
              <p className="text-xs text-texto-suave mt-0.5">
                Administradores gerenciam a plataforma e não participam do ranking. Exibindo
                consolidação da equipe.
              </p>
            </div>
          ) : temClassificacao ? (
            <div>
              <h2 className="text-2xl font-black text-texto tracking-tight">
                {minhaPosicao}º lugar no ranking
              </h2>
              <p className="text-xs text-texto-suave mt-0.5">{textoDistancia}</p>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold text-texto tracking-tight">
                Sem classificação neste período
              </h2>
              <p className="text-xs text-texto-suave mt-0.5">
                Conclua chamados com resolução efetiva dentro do prazo para pontuar.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMostrarModalFormula(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-borda bg-fundo px-3.5 py-2 text-xs font-semibold text-texto hover:bg-superficie transition shadow-xs"
        >
          <Info className="h-4 w-4 text-sky-500" />
          <span>Critérios de Pontuação</span>
        </button>
      </div>

      {/* 3. Cards de Indicadores Individuais ou da Equipe */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Pontuação Total / Média da Equipe */}
        <div className="rounded-xl border border-borda bg-superficie p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-texto-suave">
              {ehAdmin ? "Média da equipe" : "Pontuação total"}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-[#1D4ED8]">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-texto tabular-nums">
            {ehAdmin ? mediaPontosEquipe : meusPontos}{" "}
            <span className="text-xs font-normal text-texto-suave">pts</span>
          </div>
          <div className="text-[11px] text-texto-suave">
            {ehAdmin
              ? "Média de pontos da equipe participante"
              : "Composição: Volume, Prazo e Agilidade"}
          </div>
        </div>

        {/* Card 2: Chamados Concluídos */}
        <div className="rounded-xl border border-borda bg-superficie p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-texto-suave">
              {ehAdmin ? "Total concluídos (Equipe)" : "Chamados concluídos"}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-texto tabular-nums">
            {ehAdmin ? totalResolvidosEquipe : resolvidos}
          </div>
          <div className="text-[11px] text-texto-suave">
            {ehAdmin ? "Demandas resolvidas pelos operadores" : "Demandas com resolução efetiva"}
          </div>
        </div>

        {/* Card 3: Cumprimento de Prazo */}
        <div className="rounded-xl border border-borda bg-superficie p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-texto-suave">
              {ehAdmin ? "Cumprimento de prazo (Equipe)" : "Cumprimento de prazo"}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-texto tabular-nums">
            {ehAdmin
              ? totalResolvidosEquipe > 0
                ? `${taxaPrazoEquipe}%`
                : "—"
              : resolvidos > 0
                ? `${taxaPrazo}%`
                : "—"}
          </div>
          <div className="text-[11px] text-texto-suave">Meta institucional: 90% no prazo</div>
        </div>

        {/* Card 4: Tempo Médio */}
        <div className="rounded-xl border border-borda bg-superficie p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-texto-suave">
              {ehAdmin ? "Tempo médio (Equipe)" : "Tempo médio de solução"}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-texto tabular-nums">
            {ehAdmin
              ? tempoMedioEquipe > 0
                ? `${tempoMedioEquipe}d`
                : "—"
              : tempoMedio > 0
                ? `${tempoMedio}d`
                : "—"}
          </div>
          <div className="text-[11px] text-texto-suave">Meta de agilidade: até 2 dias úteis</div>
        </div>
      </div>

      {/* 4. Destaques (Pódio) e Progresso de Metas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Pódio de Atendimento */}
        <div className="lg:col-span-2 rounded-2xl border border-borda bg-superficie p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-borda pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-bold text-texto">Destaques de Atendimento</h2>
            </div>
            <span className="text-xs font-medium text-texto-suave">
              {recorte === "mes" ? "Mês atual" : `Semestre ${rotuloSemestre}`}
            </span>
          </div>

          {membrosComPontos.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-borda bg-fundo p-8 text-center space-y-2">
              <BarChart3 className="h-8 w-8 text-texto-suave" />
              <h3 className="text-sm font-bold text-texto">
                Nenhum chamado foi concluído com pontuação no período.
              </h3>
              <p className="text-xs text-texto-suave max-w-md">
                Conclua chamados dentro do prazo regulamentar para registrar sua participação no
                ranking.
              </p>
              <div className="pt-2">
                <Link
                  href="/chamados"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
                >
                  <span>Ver chamados em aberto</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* 1º Lugar */}
              {membrosComPontos[0] && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-center space-y-1">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white font-black text-xs shadow-xs">
                    1º
                  </div>
                  <span
                    className="text-xs font-bold text-texto block truncate"
                    title={membrosComPontos[0].nome_completo}
                  >
                    {membrosComPontos[0].nome_completo}
                  </span>
                  <span className="text-lg font-black text-amber-600 tabular-nums block">
                    {membrosComPontos[0].pontos_total} pts
                  </span>
                  <span className="text-[11px] text-texto-suave block">
                    {membrosComPontos[0].resolvidos} concl. · {membrosComPontos[0].taxa_prazo}%
                    prazo
                  </span>
                </div>
              )}

              {/* 2º Lugar */}
              {membrosComPontos[1] && (
                <div className="rounded-xl border border-borda bg-fundo p-4 text-center space-y-1">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-borda bg-superficie text-texto font-black text-xs shadow-xs">
                    2º
                  </div>
                  <span
                    className="text-xs font-bold text-texto block truncate"
                    title={membrosComPontos[1].nome_completo}
                  >
                    {membrosComPontos[1].nome_completo}
                  </span>
                  <span className="text-lg font-black text-texto tabular-nums block">
                    {membrosComPontos[1].pontos_total} pts
                  </span>
                  <span className="text-[11px] text-texto-suave block">
                    {membrosComPontos[1].resolvidos} concl. · {membrosComPontos[1].taxa_prazo}%
                    prazo
                  </span>
                </div>
              )}

              {/* 3º Lugar */}
              {membrosComPontos[2] && (
                <div className="rounded-xl border border-borda bg-fundo p-4 text-center space-y-1">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-borda bg-superficie text-texto font-black text-xs shadow-xs">
                    3º
                  </div>
                  <span
                    className="text-xs font-bold text-texto block truncate"
                    title={membrosComPontos[2].nome_completo}
                  >
                    {membrosComPontos[2].nome_completo}
                  </span>
                  <span className="text-lg font-black text-texto tabular-nums block">
                    {membrosComPontos[2].pontos_total} pts
                  </span>
                  <span className="text-[11px] text-texto-suave block">
                    {membrosComPontos[2].resolvidos} concl. · {membrosComPontos[2].taxa_prazo}%
                    prazo
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gauge de Progresso Pessoal / da Equipe */}
        <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="border-b border-borda pb-3">
            <h2 className="text-sm font-bold text-texto">
              {ehAdmin ? "Média da Equipe no Período" : "Progresso no Período"}
            </h2>
          </div>

          <div className="flex flex-col items-center justify-center py-2 space-y-3">
            <div className="relative h-28 w-28 flex items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-[#1D4ED8] transition-all duration-700 ease-out"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-black text-texto tabular-nums">
                  {progressoPercentual}%
                </span>
                <span className="text-[9px] font-semibold text-texto-suave uppercase tracking-wider">
                  da Meta
                </span>
              </div>
            </div>

            <div className="text-center text-xs text-texto-suave">
              <span className="font-semibold text-texto">{pontosReferenciaGauge}</span> de{" "}
              {metaPontos} pontos de referência
            </div>
          </div>

          <div className="border-t border-borda pt-3 text-center">
            <button
              type="button"
              onClick={() => setMostrarModalFormula(true)}
              className="text-xs font-semibold text-[#1D4ED8] hover:underline"
            >
              Ver detalhes da fórmula
            </button>
          </div>
        </div>
      </div>

      {/* 5. Tabela Geral de Classificação */}
      <div className="rounded-2xl border border-borda bg-superficie shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-borda flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-sm font-bold text-texto">Classificação Geral da Equipe</h2>
            <p className="text-[11px] text-texto-suave">
              Colaboradores elegíveis ao ranking. Administradores não participam da disputa.
            </p>
          </div>
          <span className="text-xs text-texto-suave">{listaOrdenada.length} participantes</span>
        </div>

        <div className="tabela-scroll overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-fundo border-b border-borda text-texto-suave font-semibold">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Pos</th>
                <th className="py-3 px-4">Operador</th>
                <th className="py-3 px-4 text-center">Concluídos</th>
                <th className="py-3 px-4 text-center">No Prazo</th>
                <th className="py-3 px-4 text-center">Taxa Prazo</th>
                <th className="py-3 px-4 text-center">Tempo Médio</th>
                <th className="py-3 px-4 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {listaOrdenada.map((item, index) => {
                const ehUsuarioLogado = item.usuario_id === perfilAtual.id;
                const pontuou = (item.pontos_total || 0) > 0;

                return (
                  <tr
                    key={item.usuario_id}
                    className={`transition-colors ${
                      ehUsuarioLogado ? "bg-blue-500/5 font-semibold" : "hover:bg-fundo/50"
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-bold text-texto-suave">
                      {pontuou ? `${index + 1}º` : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1D4ED8] text-[11px] font-bold text-white shadow-xs">
                          {item.nome_completo.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-texto block truncate max-w-[200px]">
                            {item.nome_completo}
                          </span>
                          {ehUsuarioLogado && (
                            <span className="inline-block rounded bg-[#1D4ED8] px-1.5 py-0.2 text-[10px] font-bold text-white">
                              Você
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center tabular-nums text-texto">
                      {item.resolvidos}
                    </td>
                    <td className="py-3 px-4 text-center tabular-nums text-texto">
                      {item.no_prazo}
                    </td>
                    <td className="py-3 px-4 text-center tabular-nums text-texto">
                      {item.resolvidos > 0 ? `${item.taxa_prazo}%` : "—"}
                    </td>
                    <td className="py-3 px-4 text-center tabular-nums text-texto">
                      {item.tempo_medio_dias > 0 ? `${item.tempo_medio_dias}d` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-texto tabular-nums">
                      {item.pontos_total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Gráfico de Evolução Histórica (6 Meses) */}
      <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-borda pb-3">
          <h2 className="text-sm font-bold text-texto">
            {ehAdmin
              ? "Evolução Histórica da Média da Equipe (Últimos 6 Meses)"
              : "Evolução Pessoal vs. Média da Equipe (Últimos 6 Meses)"}
          </h2>
          <span className="text-xs text-texto-suave">Pontuação mensal consolidada</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucaoPessoal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" textAnchor="end" height={40} fontSize={11} />
              <YAxis fontSize={11} domain={[0, 100]} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
              {!ehAdmin && (
                <Line
                  type="monotone"
                  dataKey="minhaPontuacao"
                  name="Sua Pontuação"
                  stroke="#1D4ED8"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="mediaEquipe"
                name="Média da Equipe"
                stroke={ehAdmin ? "#1D4ED8" : "#94a3b8"}
                strokeWidth={ehAdmin ? 2.5 : 2}
                strokeDasharray={ehAdmin ? undefined : "4 4"}
                dot={{ r: ehAdmin ? 4 : 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Modal Educativo: Critérios de Pontuação */}
      {mostrarModalFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-borda bg-superficie p-6 shadow-2xl space-y-4 text-texto">
            <div className="flex items-center justify-between border-b border-borda pb-3">
              <h3 className="text-base font-bold text-texto">
                Critérios de Avaliação de Desempenho
              </h3>
              <button
                type="button"
                onClick={() => setMostrarModalFormula(false)}
                className="rounded-lg p-1.5 text-texto-suave hover:bg-fundo hover:text-texto"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-texto-suave leading-relaxed">
              <p>
                A pontuação do ranking é calculada com base em 3 pilares equilibrados de qualidade
                operacional:
              </p>

              <div className="rounded-xl border border-borda bg-fundo p-3 space-y-2">
                <div className="flex justify-between font-bold text-texto">
                  <span>1. Volume Relativo à Equipe</span>
                  <span>Até 40 pontos (40%)</span>
                </div>
                <p className="text-[11px]">
                  Calculado proporcionalmente em relação ao colaborador com maior volume ponderado
                  no período (sem teto fixo). Chamados concluídos têm peso 1.0 e encerrados têm peso
                  0.5.
                </p>
              </div>

              <div className="rounded-xl border border-borda bg-fundo p-3 space-y-2">
                <div className="flex justify-between font-bold text-texto">
                  <span>2. Cumprimento do Prazo (SLA)</span>
                  <span>Até 40 pontos (40%)</span>
                </div>
                <p className="text-[11px]">
                  Percentual de chamados finalizados dentro do prazo regulamentar de 5 dias úteis
                  (proporcional até 40 pontos).
                </p>
              </div>

              <div className="rounded-xl border border-borda bg-fundo p-3 space-y-2">
                <div className="flex justify-between font-bold text-texto">
                  <span>3. Agilidade de Atendimento</span>
                  <span>Até 20 pontos (20%)</span>
                </div>
                <p className="text-[11px]">
                  Tempo médio em dias para resolução: até 1 dia (20 pts), até 2 dias (15 pts), até 3
                  dias (10 pts), acima de 3 dias (5 pts).
                </p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setMostrarModalFormula(false)}
                className="rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
