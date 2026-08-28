"use client";

import { type RankingItem, type Perfil } from "@/types/database";
import { Award, CheckCircle2, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface PainelDesempenhoProps {
  rankingMes: RankingItem[];
  rankingSemestre: RankingItem[];
  perfilAtual: Perfil;
  evolucaoPessoal: { mes: string; pontos: number; taxaPrazo: number }[];
  rotuloSemestre: string;
}

export function PainelDesempenho({
  rankingMes,
  rankingSemestre,
  perfilAtual,
  evolucaoPessoal,
  rotuloSemestre,
}: PainelDesempenhoProps) {
  const dadosMinhaLinhaMes = rankingMes.find((r) => r.usuario_id === perfilAtual.id);

  // Reconhecimentos objetivos
  const reconhecimentos: string[] = [];
  if (dadosMinhaLinhaMes) {
    if (dadosMinhaLinhaMes.resolvidos > 0 && dadosMinhaLinhaMes.taxa_prazo >= 100) {
      reconhecimentos.push("100% dos chamados resolvidos dentro do prazo neste mês.");
    }
    if (dadosMinhaLinhaMes.posicao === 1) {
      reconhecimentos.push("Primeira colocação no índice geral de desempenho do mês.");
    }
    if (dadosMinhaLinhaMes.tempo_medio_dias > 0 && dadosMinhaLinhaMes.tempo_medio_dias <= 2) {
      reconhecimentos.push("Alta agilidade: tempo médio de resolução inferior a 2 dias.");
    }
    if (dadosMinhaLinhaMes.resolvidos >= 15) {
      reconhecimentos.push("Alto volume de resolução efetiva (mais de 15 chamados concluídos).");
    }
  }

  const renderTabelaRanking = (itens: RankingItem[], titulo: string) => {
    return (
      <div className="rounded border border-borda bg-superficie p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2 flex items-center justify-between">
          <span>{titulo}</span>
          <span className="text-[11px] font-normal text-texto-suave">Fórmula ponderada Seção 8</span>
        </h2>

        {/* Pódio dos 3 Primeiros */}
        <div className="grid grid-cols-3 gap-2 pt-1 pb-3">
          {[1, 0, 2].map((idx) => {
            const item = itens[idx];
            if (!item) return null;
            const posicao = idx + 1;
            const ehPrimeiro = posicao === 1;

            return (
              <div
                key={item.usuario_id}
                className={`flex flex-col items-center rounded border p-2.5 text-center transition ${
                  ehPrimeiro
                    ? "border-acento/50 bg-acento/10 shadow-sm"
                    : "border-borda bg-fundo"
                } ${item.usuario_id === perfilAtual.id ? "ring-1 ring-acento" : ""}`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono font-bold ${
                    posicao === 1
                      ? "bg-acento text-white"
                      : posicao === 2
                      ? "bg-texto-suave text-fundo"
                      : "bg-borda text-texto"
                  }`}
                >
                  {posicao}º
                </div>
                <span className="mt-1.5 text-xs font-semibold text-texto truncate w-full" title={item.nome_completo}>
                  {item.nome_completo.split(" ")[0]}
                </span>
                <span className="font-mono text-sm font-bold text-texto tabular-nums">
                  {item.pontos_total} pts
                </span>
                <span className="text-[10px] text-texto-suave">
                  {item.taxa_prazo}% prazo
                </span>
              </div>
            );
          })}
        </div>

        {/* Tabela Completa */}
        <div className="overflow-x-auto rounded border border-borda bg-fundo">
          <table className="tabela-densa">
            <thead>
              <tr>
                <th className="w-12 text-center">Pos.</th>
                <th>Atendente</th>
                <th className="w-20 text-center">Resolvidos</th>
                <th className="w-20 text-center">No Prazo</th>
                <th className="w-20 text-center">Tempo Médio</th>
                <th className="w-20 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => {
                const ehLogada = item.usuario_id === perfilAtual.id;
                return (
                  <tr
                    key={item.usuario_id}
                    className={ehLogada ? "bg-acento/5 font-semibold text-texto border-l-2 border-l-acento" : ""}
                  >
                    <td className="text-center font-mono text-xs tabular-nums">
                      {item.posicao}º
                    </td>
                    <td className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{item.nome_completo}</span>
                        {ehLogada && (
                          <span className="rounded bg-acento/20 px-1 py-0.2 text-[9px] font-bold text-acento uppercase">
                            Você
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums">
                      {item.resolvidos}
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums text-sucesso">
                      {item.taxa_prazo}%
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums text-texto-suave">
                      {item.tempo_medio_dias > 0 ? `${item.tempo_medio_dias}d` : "-"}
                    </td>
                    <td className="text-right font-mono text-xs font-bold tabular-nums text-texto">
                      {item.pontos_total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-lg font-semibold text-texto">
          Painel de Desempenho e Produtividade
        </h1>
        <p className="text-xs text-texto-suave">
          Acompanhamento transparente focado em resolução efetiva de solicitações, cumprimento rigoroso de prazos e agilidade no atendimento.
        </p>
      </div>

      {/* Painel Pessoal da Usuária Logada */}
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2 flex items-center justify-between">
          <span>Seu Desempenho Individual — {perfilAtual.nome_completo}</span>
          <span className="text-[11px] font-medium text-acento">
            {dadosMinhaLinhaMes ? `${dadosMinhaLinhaMes.posicao}ª Posição no Mês` : "Sem registros no mês"}
          </span>
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border border-borda bg-fundo p-3">
            <span className="text-[11px] text-texto-suave block">Pontuação Atual</span>
            <span className="font-mono text-lg font-bold text-texto tabular-nums block mt-0.5">
              {dadosMinhaLinhaMes?.pontos_total ?? 0} pts
            </span>
          </div>

          <div className="rounded border border-borda bg-fundo p-3">
            <span className="text-[11px] text-texto-suave block">Chamados Resolvidos</span>
            <span className="font-mono text-lg font-bold text-sucesso tabular-nums block mt-0.5">
              {dadosMinhaLinhaMes?.resolvidos ?? 0}
            </span>
          </div>

          <div className="rounded border border-borda bg-fundo p-3">
            <span className="text-[11px] text-texto-suave block">Cumprimento de Prazo</span>
            <span className="font-mono text-lg font-bold text-texto tabular-nums block mt-0.5">
              {dadosMinhaLinhaMes?.taxa_prazo ?? 0}%
            </span>
          </div>

          <div className="rounded border border-borda bg-fundo p-3">
            <span className="text-[11px] text-texto-suave block">Tempo Médio de Resolução</span>
            <span className="font-mono text-lg font-bold text-texto-suave tabular-nums block mt-0.5">
              {dadosMinhaLinhaMes?.tempo_medio_dias ?? 0} dias
            </span>
          </div>
        </div>

        {/* Reconhecimentos Objetivos e Gráfico de Evolução */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pt-2">
          {/* Reconhecimentos */}
          <div className="rounded border border-borda bg-fundo p-4 space-y-2">
            <h3 className="text-xs font-semibold text-texto flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-acento" />
              <span>Destaques e Indicadores Pessoais</span>
            </h3>
            {reconhecimentos.length === 0 ? (
              <p className="text-xs text-texto-suave">
                Resolva chamados dentro do prazo regulamentar para gerar reconhecimentos automáticos de desempenho.
              </p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {reconhecimentos.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-texto">
                    <CheckCircle2 className="h-3.5 w-3.5 text-sucesso shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Gráfico de Evolução dos Últimos 6 Meses */}
          <div className="rounded border border-borda bg-fundo p-4 space-y-2">
            <h3 className="text-xs font-semibold text-texto flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-acento" />
              <span>Evolução de Pontuação (Últimos 6 Meses)</span>
            </h3>
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucaoPessoal} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "var(--texto-suave)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--texto-suave)" }} />
                  <Tooltip formatter={(v) => [`${v} pts`, "Pontuação"]} />
                  <Line type="monotone" dataKey="pontos" stroke="var(--acento)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Dois Rankings Lado a Lado: Mês Corrente e Semestre Letivo */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {renderTabelaRanking(rankingMes, "Ranking do Mês Corrente")}
        {renderTabelaRanking(rankingSemestre, `Ranking Acumulado — Semestre ${rotuloSemestre}`)}
      </div>
    </div>
  );
}
