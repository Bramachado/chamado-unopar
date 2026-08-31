"use client";

import { useState } from "react";
import Link from "next/link";
import { type RankingItem, type Perfil } from "@/types/database";
import { 
  CheckCircle2, 
  TrendingUp, 
  Target, 
  Award,
  ArrowRight
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
  // Se ninguém pontuou: ordem alfabética estrita, com posição exibindo "—"
  // Se alguém pontuou: membros com pontos > 0 no topo por pontuação; membros com 0 pontos abaixo em ordem alfabética com posição "—"
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

  // Cálculo da distância para a posição acima (apenas se tiver classificação)
  let textoDistancia: string | null = null;
  if (temClassificacao && minhaPosicao && minhaPosicao > 1) {
    const pessoaAcima = listaBruta.find((r) => r.posicao === minhaPosicao - 1);
    if (pessoaAcima && pessoaAcima.pontos_total > meusPontos) {
      const diferencaPontos = Math.max(0, Math.round((pessoaAcima.pontos_total - meusPontos) * 10) / 10);
      const chamadosEstimados = Math.ceil(diferencaPontos / 4);
      textoDistancia = `${diferencaPontos} pts para alcançar o ${minhaPosicao - 1}º lugar (cerca de ${chamadosEstimados} chamado${chamadosEstimados > 1 ? "s" : ""} no prazo)`;
    }
  } else if (temClassificacao && minhaPosicao === 1) {
    textoDistancia = "Você está na 1ª colocação geral do período";
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
          ? "Meta atingida no período!"
          : `${taxaPrazo}% no prazo neste período`,
    },
    {
      titulo: "Alta Agilidade no Atendimento",
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

  // Membros para o pódio (apenas quem tem pontuação > 0)
  const membrosComPontos = listaOrdenada.filter((m) => (m.pontos_total || 0) > 0);

  return (
    <div className="space-y-8">
      {/* 1. Cabeçalho Padronizado da Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Acompanhamento de Desempenho
          </h1>
          <p className="text-sm text-texto-suave mt-0.5">
            Métricas de resolução efetiva, cumprimento de prazos e agilidade no atendimento.
          </p>
        </div>

        {/* Alternador Mês / Semestre */}
        <div className="flex items-center gap-1 rounded-lg border border-borda bg-superficie p-1">
          <button
            type="button"
            onClick={() => setRecorte("mes")}
            className={`h-7 rounded-md px-3 text-xs font-semibold transition ${
              recorte === "mes"
                ? "bg-acento text-white"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            Mês atual
          </button>
          <button
            type="button"
            onClick={() => setRecorte("semestre")}
            className={`h-7 rounded-md px-3 text-xs font-semibold transition ${
              recorte === "semestre"
                ? "bg-acento text-white"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            Semestre letivo ({rotuloSemestre})
          </button>
        </div>
      </div>

      {/* 2. Bloco Dominante da Tela: Resultado Individual */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-5">
        {/* Linha Superior: Posição ou Estado Sem Classificação */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-borda pb-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-texto-suave">
              Seu resultado — {perfilAtual.nome_completo}
            </span>
            {temClassificacao ? (
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold tracking-tight text-texto tabular-nums">
                  {minhaPosicao}º lugar
                </span>
                <span className="text-sm font-medium text-acento">
                  {recorte === "mes" ? "no ranking do mês" : `no semestre ${rotuloSemestre}`}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-2xl font-bold tracking-tight text-texto block">
                  Sem classificação neste período
                </span>
                <span className="text-xs text-texto-suave block mt-0.5">
                  Conclua um chamado dentro do prazo para entrar no ranking.
                </span>
              </div>
            )}
          </div>

          {/* Distância para a próxima posição (Apenas se classificado) */}
          {textoDistancia && (
            <div className="rounded-md border border-borda bg-fundo px-3.5 py-2 text-right">
              <span className="text-xs font-medium text-texto-suave block">
                Situação no ranking
              </span>
              <span className="text-xs font-semibold text-texto block mt-0.5">
                {textoDistancia}
              </span>
            </div>
          )}
        </div>

        {/* Faixa Horizontal Única dos 4 Indicadores (Dividida por 1px) */}
        <div className="grid grid-cols-2 divide-y divide-borda rounded-lg border border-borda bg-fundo sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div className="p-4">
            <span className="text-[13px] font-medium text-texto-suave block">
              Pontuação total
            </span>
            <span className="text-2xl font-bold text-texto tabular-nums block mt-1">
              {meusPontos} <span className="text-xs font-normal text-texto-suave">pts</span>
            </span>
          </div>

          <div className="p-4">
            <span className="text-[13px] font-medium text-texto-suave block">
              Chamados concluídos
            </span>
            <span className="text-2xl font-bold text-texto tabular-nums block mt-1">
              {resolvidos}
            </span>
          </div>

          <div className="p-4">
            <span className="text-[13px] font-medium text-texto-suave block">
              Cumprimento de prazo
            </span>
            <span className="text-2xl font-bold text-texto tabular-nums block mt-1">
              {resolvidos > 0 ? `${taxaPrazo}%` : "—"}
            </span>
          </div>

          <div className="p-4">
            <span className="text-[13px] font-medium text-texto-suave block">
              Tempo médio
            </span>
            <span className="text-2xl font-bold text-texto tabular-nums block mt-1">
              {tempoMedio > 0 ? `${tempoMedio}d` : "—"}
            </span>
          </div>
        </div>

        {/* Barra de Progresso no Prazo */}
        {resolvidos > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-texto-suave">
                Taxa de resolução no prazo ({noPrazo} de {resolvidos} concluídos)
              </span>
              <span className="font-semibold text-texto tabular-nums">{taxaPrazo}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-borda">
              <div
                style={{ width: `${taxaPrazo}%` }}
                className="h-full bg-acento transition-all duration-300 rounded-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Pódio de Atendimento */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-borda pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-acento" />
            <h2 className="text-sm font-semibold text-texto">
              Destaques de Atendimento (Pódio)
            </h2>
          </div>
          <span className="text-xs text-texto-suave">
            {recorte === "mes" ? "Mês atual" : `Semestre ${rotuloSemestre}`}
          </span>
        </div>

        {membrosComPontos.length === 0 ? (
          /* Estado Vazio com Direção Clara */
          <div className="flex flex-col items-center justify-center rounded-lg border border-borda bg-fundo p-6 text-center space-y-2">
            <span className="text-sm font-medium text-texto">
              Nenhum chamado foi concluído com pontuação no período selecionado.
            </span>
            <span className="text-xs text-texto-suave">
              Conclua chamados dentro do prazo regulamentar para formar o pódio de atendimento.
            </span>
            <div className="pt-2">
              <Link
                href="/chamados"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo transition"
              >
                <span>Ver chamados em aberto</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
            {/* 1º Lugar */}
            {membrosComPontos[0] && (
              <div className="order-1 sm:order-2 rounded-lg border border-acento/50 bg-acento/5 p-4 text-center space-y-1">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-acento text-white text-xs font-bold">
                  1º
                </div>
                <span className="text-sm font-semibold text-texto block truncate" title={membrosComPontos[0].nome_completo}>
                  {membrosComPontos[0].nome_completo}
                </span>
                <span className="text-lg font-bold text-texto tabular-nums block">
                  {membrosComPontos[0].pontos_total} pts
                </span>
                <span className="text-xs text-texto-suave block">
                  {membrosComPontos[0].resolvidos} resolvidos · {membrosComPontos[0].taxa_prazo}% no prazo
                </span>
              </div>
            )}

            {/* 2º Lugar */}
            {membrosComPontos[1] && (
              <div className="order-2 sm:order-1 rounded-lg border border-borda bg-fundo p-4 text-center space-y-1">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-borda bg-superficie text-texto text-xs font-bold">
                  2º
                </div>
                <span className="text-sm font-semibold text-texto block truncate" title={membrosComPontos[1].nome_completo}>
                  {membrosComPontos[1].nome_completo}
                </span>
                <span className="text-lg font-bold text-texto tabular-nums block">
                  {membrosComPontos[1].pontos_total} pts
                </span>
                <span className="text-xs text-texto-suave block">
                  {membrosComPontos[1].resolvidos} resolvidos · {membrosComPontos[1].taxa_prazo}% no prazo
                </span>
              </div>
            )}

            {/* 3º Lugar */}
            {membrosComPontos[2] && (
              <div className="order-3 sm:order-3 rounded-lg border border-borda bg-fundo p-4 text-center space-y-1">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-borda bg-superficie text-texto text-xs font-bold">
                  3º
                </div>
                <span className="text-sm font-semibold text-texto block truncate" title={membrosComPontos[2].nome_completo}>
                  {membrosComPontos[2].nome_completo}
                </span>
                <span className="text-lg font-bold text-texto tabular-nums block">
                  {membrosComPontos[2].pontos_total} pts
                </span>
                <span className="text-xs text-texto-suave block">
                  {membrosComPontos[2].resolvidos} resolvidos · {membrosComPontos[2].taxa_prazo}% no prazo
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Tabela Única de Classificação */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-borda pb-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              Classificação Geral
            </h2>
            <p className="text-xs text-texto-suave">
              Passe o mouse sobre os pontos para ver a composição (Volume 40%, Prazo 40%, Agilidade 20%).
            </p>
          </div>
          <span className="text-xs text-texto-suave font-medium">
            {listaOrdenada.length} pessoas no atendimento
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
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
                    className={ehLogada ? "bg-acento/5 font-semibold text-texto border-l-2 border-l-acento" : ""}
                  >
                    <td className="text-center font-mono text-xs tabular-nums text-texto-suave">
                      {textoPosicao}
                    </td>
                    <td className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-texto">{item.nome_completo}</span>
                        {ehLogada && (
                          <span className="rounded bg-acento/15 px-1.5 py-0.2 text-[10px] font-bold text-acento border border-acento/30">
                            Você
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center font-mono text-xs tabular-nums text-texto-suave">
                      {posOutra}
                    </td>
                    <td className="text-right font-mono text-xs tabular-nums text-texto">
                      {item.resolvidos}
                    </td>
                    <td className="text-right font-mono text-xs tabular-nums text-texto">
                      {item.resolvidos > 0 ? `${item.taxa_prazo}%` : "—"}
                    </td>
                    <td className="text-right font-mono text-xs tabular-nums text-texto-suave">
                      {item.tempo_medio_dias > 0 ? `${item.tempo_medio_dias}d` : "—"}
                    </td>
                    <td className="text-right font-mono text-xs font-bold tabular-nums text-texto">
                      <span
                        className="cursor-help border-b border-dotted border-borda"
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

      {/* 5. Reconhecimentos & Evolução Pessoal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Metas e Reconhecimentos */}
        <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-texto flex items-center gap-2">
              <Target className="h-4 w-4 text-acento" />
              <span>Metas Individuais</span>
            </h2>
            <p className="text-xs text-texto-suave mt-0.5">
              Acompanhamento de metas de atendimento e conformidade com prazos.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {reconhecimentos.map((rec, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3.5 text-xs transition ${
                  rec.concluido
                    ? "border-sucesso/40 bg-sucesso-fundo/30 text-texto"
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
                    <span className="font-semibold block text-texto">{rec.titulo}</span>
                    <span className="text-texto-suave text-xs block mt-0.5">{rec.descricao}</span>
                  </div>
                </div>
                <div className="mt-2.5 text-xs text-texto-suave border-t border-borda pt-2">
                  Progresso: <span className="text-texto font-mono font-medium">{rec.progressoTexto}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evolução Pessoal com Média da Equipe */}
        <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-texto flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-acento" />
              <span>Sua Evolução vs. Média da Equipe (Últimos 6 Meses)</span>
            </h2>
            <p className="text-xs text-texto-suave mt-0.5">
              Histórico pessoal comparado à média geral do atendimento.
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
