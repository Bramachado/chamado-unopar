"use client";

import { useState } from "react";
import { type RankingItem, type Perfil } from "@/types/database";
import { 
  CheckCircle2, 
  TrendingUp, 
  Target, 
  AlertCircle
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
      if (diferencaPontos > 0) {
        // Estimar chamados no prazo necessários (cada chamado no prazo rende ~4.5 pts ponderados)
        const chamadosEstimados = Math.max(1, Math.ceil(diferencaPontos / 4.5));
        textoDistancia = `${diferencaPontos} pts para alcançar o ${minhaPosicao - 1}º lugar (cerca de ${chamadosEstimados} ${chamadosEstimados === 1 ? 'chamado resolvido' : 'chamados resolvidos'} no prazo)`;
      } else {
        textoDistancia = `Empatada com o ${minhaPosicao - 1}º lugar — resolva o próximo chamado no prazo para desempatar!`;
      }
    }
  }

  // Progresso de reconhecimentos objetivos com métricas reais
  const resolvidos = meuDado?.resolvidos ?? 0;
  const noPrazo = meuDado?.no_prazo ?? 0;
  const taxaPrazo = meuDado?.taxa_prazo ?? 0;
  const tempoMedio = meuDado?.tempo_medio_dias ?? 0;

  const reconhecimentos = [
    {
      titulo: "100% de Cumprimento de Prazo no Mês",
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
      <div>
        <h1 className="font-heading text-xl font-bold text-texto">
          Acompanhamento de desempenho
        </h1>
        <p className="text-xs text-texto-suave">
          Métricas objetivas de resolução efetiva, cumprimento de prazos e agilidade no atendimento.
        </p>
      </div>

      {/* a) FAIXA PESSOAL (Bloco de maior destaque da tela) */}
      <div className="rounded border border-acento/30 bg-superficie p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-borda/40 pb-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-texto-suave block">
              Seu resultado individual — {perfilAtual.nome_completo}
            </span>
            <div className="flex items-baseline gap-3">
              <span className="font-heading text-3xl font-bold text-texto tabular-nums">
                {minhaPosicao}º lugar
              </span>
              <span className="text-xs font-medium text-acento">
                {recorte === "mes" ? "no ranking do mês" : `no semestre ${rotuloSemestre}`}
              </span>
            </div>
          </div>

          <div className="rounded border border-borda bg-fundo px-3.5 py-2 text-right">
            <span className="text-[11px] text-texto-suave block">Distância para a próxima posição</span>
            <span className="text-xs font-semibold text-texto block mt-0.5">
              {textoDistancia}
            </span>
          </div>
        </div>

        {/* Barra de Progresso e Métricas Pessoais */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded border border-borda bg-fundo p-3">
            <span className="text-xs text-texto-suave block">Pontuação total</span>
            <span className="font-mono text-xl font-bold text-texto tabular-nums block mt-0.5">
              {meusPontos} pts
            </span>
          </div>

          <div className="rounded border border-borda bg-fundo p-3">
            <span className="text-xs text-texto-suave block">Chamados concluídos</span>
            <span className="font-mono text-xl font-bold text-sucesso tabular-nums block mt-0.5">
              {resolvidos}
            </span>
          </div>

          <div className="rounded border border-borda bg-fundo p-3">
            <span className="text-xs text-texto-suave block">Cumprimento de prazo</span>
            <span className="font-mono text-xl font-bold text-texto tabular-nums block mt-0.5">
              {resolvidos > 0 ? `${taxaPrazo}%` : "—"}
            </span>
          </div>

          <div className="rounded border border-borda bg-fundo p-3">
            <span className="text-xs text-texto-suave block">Tempo médio</span>
            <span className="font-mono text-xl font-bold text-texto tabular-nums block mt-0.5">
              {tempoMedio > 0 ? `${tempoMedio} dias` : "—"}
            </span>
          </div>
        </div>

        {/* Barra de Progresso no Prazo */}
        {resolvidos > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-texto-suave">
                Taxa de resolução dentro do prazo: {noPrazo} de {resolvidos} concluídos
              </span>
              <span className="font-mono font-semibold text-texto">{taxaPrazo}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-borda">
              <div
                style={{ width: `${taxaPrazo}%` }}
                className="h-full bg-acento transition-all duration-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* b) PÓDIO (2º - 1º - 3º) */}
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-borda/40 pb-2">
          <h2 className="text-sm font-semibold text-texto">
            Destaques de produtividade
          </h2>
          <span className="text-xs text-texto-suave">
            {recorte === "mes" ? "Mês corrente" : `Semestre ${rotuloSemestre}`}
          </span>
        </div>

        {!alguemPontuou ? (
          <div className="flex h-32 flex-col items-center justify-center rounded border border-dashed border-borda bg-fundo/40 p-4 text-center">
            <AlertCircle className="h-5 w-5 text-texto-suave mb-1" />
            <span className="text-xs font-medium text-texto">
              Dados insuficientes para exibição de pódio neste período
            </span>
            <span className="text-[11px] text-texto-suave mt-0.5">
              O pódio é formado assim que as usuárias concluírem chamados com resolução efetiva.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[1, 0, 2].map((idx) => {
              const item = listaAtual[idx];
              if (!item) return null;
              const posicao = idx + 1;
              const ehPrimeiro = posicao === 1;

              return (
                <div
                  key={item.usuario_id}
                  className={`flex flex-col items-center rounded border p-3 text-center transition ${
                    ehPrimeiro
                      ? "border-acento/50 bg-acento/10 shadow-sm"
                      : "border-borda bg-fundo"
                  } ${item.usuario_id === perfilAtual.id ? "ring-1 ring-acento" : ""}`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-mono font-bold ${
                      ehPrimeiro
                        ? "bg-acento text-white"
                        : "bg-borda text-texto"
                    }`}
                  >
                    {posicao}º
                  </div>

                  <span
                    className="mt-2 text-xs font-semibold text-texto text-center leading-tight max-w-full"
                    title={item.nome_completo}
                  >
                    {item.nome_completo}
                  </span>

                  <span className="font-mono text-sm font-bold text-texto tabular-nums mt-1">
                    {item.pontos_total} pts
                  </span>

                  <div className="mt-1 text-[11px] text-texto-suave">
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
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-borda/40 pb-2">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              Classificação geral
            </h2>
            <p className="text-xs text-texto-suave">
              Passe o mouse sobre os pontos para ver a composição detalhada.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded border border-borda bg-fundo p-1 text-xs">
            <button
              type="button"
              onClick={() => setRecorte("mes")}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                recorte === "mes"
                  ? "bg-superficie text-texto shadow-sm border border-borda"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              Mês corrente
            </button>
            <button
              type="button"
              onClick={() => setRecorte("semestre")}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                recorte === "semestre"
                  ? "bg-superficie text-texto shadow-sm border border-borda"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              Semestre letivo ({rotuloSemestre})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-borda bg-fundo">
          <table className="tabela-densa">
            <thead>
              <tr>
                <th className="w-12 text-center">Pos.</th>
                <th>Atendente</th>
                <th className="w-24 text-center">
                  {recorte === "mes" ? "No Semestre" : "No Mês"}
                </th>
                <th className="w-24 text-center">Resolvidos</th>
                <th className="w-24 text-center">No Prazo</th>
                <th className="w-24 text-center">Tempo Médio</th>
                <th className="w-28 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {listaAtual.map((item) => {
                const ehLogada = item.usuario_id === perfilAtual.id;
                const posOutra = listaOutra.find((x) => x.usuario_id === item.usuario_id)?.posicao ?? "-";

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
                          <span className="rounded bg-acento/20 px-1 py-0.2 text-[9px] font-bold text-acento">
                            Você
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums text-texto-suave">
                      {posOutra}º
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums">
                      {item.resolvidos}
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums text-sucesso">
                      {item.resolvidos > 0 ? `${item.taxa_prazo}%` : "—"}
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums text-texto-suave">
                      {item.tempo_medio_dias > 0 ? `${item.tempo_medio_dias}d` : "—"}
                    </td>
                    <td className="text-right font-mono text-xs font-bold tabular-nums text-texto">
                      <span
                        className="cursor-help border-b border-dotted border-texto-suave/60"
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

      {/* d) RECONHECIMENTOS COM PROGRESSO & e) EVOLUÇÃO PESSOAL */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* d) Reconhecimentos */}
        <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-texto flex items-center gap-1.5">
              <Target className="h-4 w-4 text-acento" />
              <span>Metas e reconhecimentos</span>
            </h2>
            <p className="text-xs text-texto-suave">
              Acompanhe suas metas de desempenho e veja seu progresso em cada uma.
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            {reconhecimentos.map((rec, i) => (
              <div
                key={i}
                className={`rounded border p-3 text-xs transition ${
                  rec.concluido
                    ? "border-sucesso/40 bg-sucesso-fundo/40 text-texto"
                    : "border-borda bg-fundo text-texto"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 mt-0.5 ${
                        rec.concluido ? "text-sucesso" : "text-texto-suave"
                      }`}
                    />
                    <div>
                      <span className="font-semibold block">{rec.titulo}</span>
                      <span className="text-texto-suave text-[11px] block mt-0.5">{rec.descricao}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-medium text-texto-suave border-t border-borda/40 pt-1.5">
                  Progresso: <span className="text-texto font-mono">{rec.progressoTexto}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* e) Evolução Pessoal com Média da Equipe */}
        <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-texto flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-acento" />
              <span>Sua evolução comparada à equipe (últimos 6 meses)</span>
            </h2>
            <p className="text-xs text-texto-suave">
              Histórico pessoal de pontuação com a linha de referência da média dos atendentes.
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
                  strokeWidth={2}
                  dot={{ r: 3 }}
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
