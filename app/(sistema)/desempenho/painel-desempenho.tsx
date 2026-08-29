"use client";

import { useState } from "react";
import { type RankingItem, type Perfil } from "@/types/database";
import { 
  CheckCircle2, 
  TrendingUp, 
  Target, 
  AlertCircle,
  Award,
  Trophy
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

  const listaAtual = recorte === "mes" ? rankingMes : rankingSemestre;
  const listaOutra = recorte === "mes" ? rankingSemestre : rankingMes;

  const meuDado = listaAtual.find((r) => r.usuario_id === perfilAtual.id);
  const minhaPosicao = meuDado?.posicao ?? listaAtual.length;
  const meusPontos = meuDado?.pontos_total ?? 0;

  // Verificar se há pontuação real no período para exibir o pódio
  const alguemPontuou = listaAtual.some((r) => r.pontos_total > 0);

  // Cálculo da distância para a posição acima
  let textoDistancia = "Você está na 1ª colocação geral!";
  if (minhaPosicao > 1) {
    const pessoaAcima = listaAtual.find((r) => r.posicao === minhaPosicao - 1);
    if (pessoaAcima) {
      const diferencaPontos = Math.max(0, Math.round((pessoaAcima.pontos_total - meusPontos) * 10) / 10);
      const chamadosEstimados = Math.ceil(diferencaPontos / 4);
      textoDistancia = `${diferencaPontos} pts para alcançar o ${minhaPosicao - 1}º lugar (cerca de ${chamadosEstimados} chamado${chamadosEstimados > 1 ? "s" : ""} resolvido${chamadosEstimados > 1 ? "s" : ""} no prazo)`;
    }
  }

  // Estatísticas individuais
  const resolvidos = meuDado?.resolvidos ?? 0;
  const noPrazo = meuDado?.no_prazo ?? 0;
  const taxaPrazo = meuDado?.taxa_prazo ?? 0;
  const tempoMedio = meuDado?.tempo_medio_dias ?? 0;

  // Metas e Reconhecimentos individuais
  const reconhecimentos = [
    {
      titulo: "100% de Prazo Cumprido",
      descricao: "Resolver todos os chamados dentro do prazo regulamentar (mínimo de 5 chamados concluídos).",
      concluido: resolvidos >= 5 && taxaPrazo === 100,
      progressoTexto:
        resolvidos < 5
          ? `${resolvidos} de 5 chamados concluídos (${taxaPrazo}% no prazo)`
          : taxaPrazo === 100
          ? "Conquistado neste mês!"
          : `${taxaPrazo}% no prazo neste mês`,
    },
    {
      titulo: "Alta Agilidade de Atendimento",
      descricao: "Manter o tempo médio de resolução abaixo de 2 dias úteis.",
      concluido: resolvidos >= 3 && tempoMedio > 0 && tempoMedio <= 2,
      progressoTexto:
        resolvidos === 0
          ? "Nenhum chamado concluído"
          : tempoMedio <= 2
          ? `Média atual: ${tempoMedio} dias (Meta atingida)`
          : `Média atual: ${tempoMedio} dias (Meta: até 2 dias)`,
    },
    {
      titulo: "Volume Efetivo de Soluções",
      descricao: "Concluir com sucesso 15 ou mais chamados no período.",
      concluido: resolvidos >= 15,
      progressoTexto: `${resolvidos} de 15 chamados concluídos`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-superficie p-4 rounded-xl border border-borda shadow-sm">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto tracking-tight">
            Acompanhamento de Desempenho
          </h1>
          <p className="text-xs text-texto-suave">
            Métricas de resolução efetiva, cumprimento de prazos e agilidade no atendimento.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-acento/15 px-3 py-1 text-xs font-bold text-acento border border-acento/30">
          <Trophy className="h-4 w-4" />
          <span>Ranking de Equipe</span>
        </div>
      </div>

      {/* a) FAIXA PESSOAL (Bloco de maior destaque da tela) */}
      <div className="rounded-xl border-2 border-acento/50 bg-superficie p-6 shadow-md space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-borda pb-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-texto-suave uppercase tracking-wider block">
              Seu resultado individual — {perfilAtual.nome_completo}
            </span>
            <div className="flex items-baseline gap-3">
              <span className="font-heading text-3xl font-extrabold text-texto tabular-nums">
                {minhaPosicao}º lugar
              </span>
              <span className="text-xs font-bold text-acento">
                {recorte === "mes" ? "no ranking do mês" : `no semestre ${rotuloSemestre}`}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-borda bg-fundo px-4 py-2.5 text-right shadow-xs">
            <span className="text-[11px] font-semibold text-texto-suave block">Distância para a próxima posição</span>
            <span className="text-xs font-bold text-texto block mt-0.5">
              {textoDistancia}
            </span>
          </div>
        </div>

        {/* Barra de Progresso e Métricas Pessoais */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-borda bg-fundo p-3.5 shadow-xs">
            <span className="text-xs font-semibold text-texto-suave block">Pontuação total</span>
            <span className="font-mono text-2xl font-bold text-texto tabular-nums block mt-1">
              {meusPontos} pts
            </span>
          </div>

          <div className="rounded-lg border border-borda bg-fundo p-3.5 shadow-xs">
            <span className="text-xs font-semibold text-texto-suave block">Chamados concluídos</span>
            <span className="font-mono text-2xl font-bold text-sucesso tabular-nums block mt-1">
              {resolvidos}
            </span>
          </div>

          <div className="rounded-lg border border-borda bg-fundo p-3.5 shadow-xs">
            <span className="text-xs font-semibold text-texto-suave block">Cumprimento de prazo</span>
            <span className="font-mono text-2xl font-bold text-acento tabular-nums block mt-1">
              {resolvidos > 0 ? `${taxaPrazo}%` : "—"}
            </span>
          </div>

          <div className="rounded-lg border border-borda bg-fundo p-3.5 shadow-xs">
            <span className="text-xs font-semibold text-texto-suave block">Tempo médio</span>
            <span className="font-mono text-2xl font-bold text-texto tabular-nums block mt-1">
              {tempoMedio > 0 ? `${tempoMedio}d` : "—"}
            </span>
          </div>
        </div>

        {/* Barra de Progresso no Prazo */}
        {resolvidos > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-texto-suave">
                Taxa de resolução dentro do prazo: {noPrazo} de {resolvidos} concluídos
              </span>
              <span className="font-mono font-bold text-texto">{taxaPrazo}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-borda">
              <div
                style={{ width: `${taxaPrazo}%` }}
                className="h-full bg-acento transition-all duration-500 rounded-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* b) PÓDIO (2º - 1º - 3º) */}
      <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-borda pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-acento" />
            <h2 className="font-heading text-sm font-bold text-texto">
              Destaques de Produtividade (Pódio)
            </h2>
          </div>
          <span className="text-xs font-bold text-texto-suave">
            {recorte === "mes" ? "Mês corrente" : `Semestre ${rotuloSemestre}`}
          </span>
        </div>

        {!alguemPontuou ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-borda bg-fundo/40 p-4 text-center">
            <AlertCircle className="h-5 w-5 text-texto-suave mb-1" />
            <span className="text-xs font-bold text-texto">
              Dados insuficientes para exibição de pódio neste período
            </span>
            <span className="text-[11px] text-texto-suave mt-0.5">
              O pódio é formado assim que as colaboradoras concluírem chamados com resolução efetiva.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3.5 pt-2">
            {[1, 0, 2].map((idx) => {
              const item = listaAtual[idx];
              if (!item) return null;
              const posicao = idx === 1 ? 2 : idx === 0 ? 1 : 3;
              const ehPrimeiro = posicao === 1;

              return (
                <div
                  key={item.usuario_id}
                  className={`flex flex-col items-center rounded-xl border-2 p-4 text-center transition ${
                    ehPrimeiro
                      ? "border-amber-400/80 bg-gradient-to-b from-amber-400/20 to-superficie shadow-md"
                      : posicao === 2
                      ? "border-slate-300/80 bg-gradient-to-b from-slate-300/20 to-superficie shadow-sm"
                      : "border-amber-700/60 bg-gradient-to-b from-amber-700/20 to-superficie shadow-sm"
                  } ${item.usuario_id === perfilAtual.id ? "ring-2 ring-acento" : ""}`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${
                      ehPrimeiro
                        ? "bg-amber-400 text-amber-950 shadow-sm"
                        : posicao === 2
                        ? "bg-slate-300 text-slate-900 shadow-sm"
                        : "bg-amber-700 text-white shadow-sm"
                    }`}
                  >
                    {posicao}º
                  </div>

                  <span
                    className="mt-2 text-xs font-bold text-texto text-center leading-tight max-w-full truncate"
                    title={item.nome_completo}
                  >
                    {item.nome_completo}
                  </span>

                  <span className="font-mono text-base font-extrabold text-texto tabular-nums mt-1">
                    {item.pontos_total} pts
                  </span>

                  <div className="mt-1 text-[11px] text-texto-suave font-medium">
                    <span>{item.resolvidos} resolvidos</span>
                    {item.resolvidos > 0 && <span> · {item.taxa_prazo}% prazo</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* c) TABELA ÚNICA COM ALTERNADOR MÊS / SEMESTRE */}
      <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-borda pb-3">
          <div>
            <h2 className="font-heading text-sm font-bold text-texto">
              Classificação Geral e Pontuação
            </h2>
            <p className="text-xs text-texto-suave">
              Passe o mouse sobre a coluna de pontos para ver o detalhamento (Volume 40%, Prazo 40%, Agilidade 20%).
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-borda bg-fundo p-1 text-xs shadow-xs">
            <button
              type="button"
              onClick={() => setRecorte("mes")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                recorte === "mes"
                  ? "bg-superficie text-texto shadow-xs border border-borda"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              Mês corrente
            </button>
            <button
              type="button"
              onClick={() => setRecorte("semestre")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                recorte === "semestre"
                  ? "bg-superficie text-texto shadow-xs border border-borda"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              Semestre letivo ({rotuloSemestre})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-borda bg-fundo">
          <table className="tabela-densa">
            <thead>
              <tr>
                <th className="w-16 text-center">Posição</th>
                <th>Colaboradora</th>
                <th className="w-28 text-center">
                  {recorte === "mes" ? "No Semestre" : "No Mês"}
                </th>
                <th className="w-28 text-center">Resolvidos</th>
                <th className="w-28 text-center">No Prazo</th>
                <th className="w-28 text-center">Tempo Médio</th>
                <th className="w-28 text-right">Pontuação</th>
              </tr>
            </thead>
            <tbody>
              {listaAtual.map((item) => {
                const ehLogada = item.usuario_id === perfilAtual.id;
                const posOutra = listaOutra.find((x) => x.usuario_id === item.usuario_id)?.posicao ?? "-";

                return (
                  <tr
                    key={item.usuario_id}
                    className={ehLogada ? "bg-acento/10 font-bold text-texto border-l-4 border-l-acento" : ""}
                  >
                    <td className="text-center font-mono text-xs font-bold tabular-nums">
                      #{item.posicao}
                    </td>
                    <td className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{item.nome_completo}</span>
                        {ehLogada && (
                          <span className="rounded bg-acento px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                            VOCÊ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums text-texto-suave font-semibold">
                      {posOutra}º
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums font-bold">
                      {item.resolvidos}
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums text-sucesso font-bold">
                      {item.resolvidos > 0 ? `${item.taxa_prazo}%` : "—"}
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums text-texto-suave font-semibold">
                      {item.tempo_medio_dias > 0 ? `${item.tempo_medio_dias}d` : "—"}
                    </td>
                    <td className="text-right font-mono text-sm font-extrabold tabular-nums text-texto">
                      <span
                        className="cursor-help border-b-2 border-dotted border-acento"
                        title={`Composição dos ${item.pontos_total} pts:\n• Volume: ${item.pontos_volume} pts (40%)\n• Prazo: ${item.pontos_prazo} pts (40%)\n• Agilidade: ${item.pontos_agilidade} pts (20%)`}
                      >
                        {item.pontos_total}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* d) RECONHECIMENTOS & e) EVOLUÇÃO PESSOAL */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* d) Reconhecimentos */}
        <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-3">
          <div>
            <h2 className="font-heading text-sm font-bold text-texto flex items-center gap-2">
              <Target className="h-4 w-4 text-acento" />
              <span>Metas e Reconhecimentos Individuais</span>
            </h2>
            <p className="text-xs text-texto-suave">
              Acompanhe suas metas de desempenho e veja seu progresso em cada uma.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {reconhecimentos.map((rec, i) => (
              <div
                key={i}
                className={`rounded-lg border-2 p-3.5 text-xs transition ${
                  rec.concluido
                    ? "border-sucesso/50 bg-sucesso-fundo text-texto shadow-xs"
                    : "border-borda bg-fundo text-texto"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 mt-0.5 ${
                      rec.concluido ? "text-sucesso" : "text-texto-suave"
                    }`}
                  />
                  <div>
                    <span className="font-bold block text-texto">{rec.titulo}</span>
                    <span className="text-texto-suave text-[11px] block mt-0.5">{rec.descricao}</span>
                  </div>
                </div>
                <div className="mt-2.5 text-[11px] font-semibold text-texto-suave border-t border-borda/40 pt-2">
                  Progresso: <span className="text-texto font-mono font-bold">{rec.progressoTexto}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* e) Evolução Pessoal com Média da Equipe */}
        <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-3">
          <div>
            <h2 className="font-heading text-sm font-bold text-texto flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-acento" />
              <span>Sua Evolução vs. Média da Equipe (Últimos 6 Meses)</span>
            </h2>
            <p className="text-xs text-texto-suave">
              Histórico pessoal de pontuação comparado à média geral de atendentes.
            </p>
          </div>

          <div className="h-56 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoPessoal} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <Tooltip formatter={(v, name) => [`${v} pts`, name === "minhaPontuacao" ? "Sua pontuação" : "Média da equipe"]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                <Line
                  type="monotone"
                  dataKey="minhaPontuacao"
                  name="Sua pontuação"
                  stroke="var(--acento)"
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
      </div>
    </div>
  );
}
