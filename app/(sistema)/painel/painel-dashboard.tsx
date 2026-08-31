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
  Award, 
  X,
  Search,
  Plus
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface RankingResponsavelItem {
  id: string;
  posicao: number;
  nome: string;
  papel: string;
  avatarBg: string;
  avatarTexto: string;
  fotoUrl?: string;
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
  rankingEquipe: RankingResponsavelItem[];
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

type TipoIndicador = "total" | "aguardando" | "concluidos" | "taxa" | "vencidos" | "vencendo" | null;

export function PainelDashboard({
  dados,
  periodoSelecionado,
}: PainelDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [periodo, setPeriodo] = useState(periodoSelecionado);
  const [indicadorAtivo, setIndicadorAtivo] = useState<TipoIndicador>(null);
  const [buscaModal, setBuscaModal] = useState("");

  const mudarPeriodo = (novoPeriodo: string) => {
    setPeriodo(novoPeriodo);
    const params = new URLSearchParams(searchParams.toString());
    params.set("periodo", novoPeriodo);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const totalVolume12m = dados.volumeMensal.reduce((acc, curr) => acc + curr.total, 0);
  const taxaGeralResolucao = dados.totais.total > 0
    ? Math.round((dados.totais.concluidos / dados.totais.total) * 100)
    : 0;

  // Filtragem dos chamados para exibição no modal
  const obterDadosModal = () => {
    let titulo = "";
    let subtitulo = "";
    let linkVerTodos = "/chamados";
    let listaFiltrada = dados.chamadosVencidosOuProximos;

    switch (indicadorAtivo) {
      case "total":
        titulo = "Total de Chamados no Período";
        subtitulo = `${dados.totais.total} chamado(s) registrado(s) no período selecionado.`;
        linkVerTodos = "/chamados";
        break;
      case "aguardando":
        titulo = "Chamados Aguardando Atendimento";
        subtitulo = `${dados.totais.aguardando} chamado(s) em andamento na fila.`;
        linkVerTodos = "/chamados?situacao=aguardando";
        break;
      case "concluidos":
        titulo = "Chamados Concluídos (Resolvidos)";
        subtitulo = `${dados.totais.concluidos} chamado(s) resolvidos com sucesso no período.`;
        linkVerTodos = "/chamados?situacao=concluido";
        break;
      case "taxa":
        titulo = "Taxa de Resolução de Chamados";
        subtitulo = `${taxaGeralResolucao}% de eficiência na resolução global de demandas.`;
        linkVerTodos = "/desempenho";
        break;
      case "vencidos":
        titulo = "Chamados Vencidos em Aberto";
        subtitulo = `${dados.totais.vencidos} chamado(s) com prazo estipulado expirado.`;
        linkVerTodos = "/chamados?situacao=aguardando";
        listaFiltrada = dados.chamadosVencidosOuProximos.filter((c) => c.status === "vencido");
        break;
      case "vencendo":
        titulo = "Chamados Vencendo em até 2 Dias";
        subtitulo = `${dados.totais.vencendo_em_2_dias} chamado(s) prioritários vencendo em breve.`;
        linkVerTodos = "/chamados?situacao=aguardando";
        listaFiltrada = dados.chamadosVencidosOuProximos.filter((c) => c.status === "vencendo_em_2_dias");
        break;
      default:
        break;
    }

    if (buscaModal.trim()) {
      const termo = buscaModal.toLowerCase();
      listaFiltrada = listaFiltrada.filter(
        (c) =>
          c.protocolo.toLowerCase().includes(termo) ||
          c.aluno_nome.toLowerCase().includes(termo) ||
          (c.atendente && c.atendente.toLowerCase().includes(termo))
      );
    }

    return { titulo, subtitulo, linkVerTodos, listaFiltrada };
  };

  const modalInfo = obterDadosModal();

  return (
    <div className="space-y-8">
      {/* 1. Cabeçalho Padronizado da Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Painel de Indicadores
          </h1>
          <p className="text-sm text-texto-suave mt-0.5">
            Acompanhamento operacional de atendimento, produtividade, prazos e motivos recorrentes.
          </p>
        </div>

        {/* Seletor de Período Padronizado */}
        <div className="flex items-center gap-1 rounded-lg border border-borda bg-superficie p-1">
          <Calendar className="h-3.5 w-3.5 text-texto-suave ml-2 mr-1" />
          <button
            type="button"
            onClick={() => mudarPeriodo("mes_atual")}
            className={`h-7 rounded-md px-3 text-xs font-semibold transition ${
              periodo === "mes_atual"
                ? "bg-acento text-white"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            Mês atual
          </button>
          <button
            type="button"
            onClick={() => mudarPeriodo("semestre_atual")}
            className={`h-7 rounded-md px-3 text-xs font-semibold transition ${
              periodo === "semestre_atual"
                ? "bg-acento text-white"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            Semestre letivo
          </button>
          <button
            type="button"
            onClick={() => mudarPeriodo("ultimos_12_meses")}
            className={`h-7 rounded-md px-3 text-xs font-semibold transition ${
              periodo === "ultimos_12_meses"
                ? "bg-acento text-white"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            Últimos 12 meses
          </button>
        </div>
      </div>

      {/* 2. Cartões de Indicadores Principais (Semântica Estrita de Cores) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total no período */}
        <div
          onClick={() => {
            setBuscaModal("");
            setIndicadorAtivo("total");
          }}
          className="group cursor-pointer rounded-lg border border-borda bg-superficie p-4 transition hover:border-acento space-y-1"
          title="Clique para detalhar"
        >
          <span className="text-xs font-medium text-texto-suave block">Total no período</span>
          <span className="text-2xl font-bold text-texto tabular-nums block">
            {dados.totais.total}
          </span>
          <span className="text-[11px] text-texto-suave block">Chamados registrados</span>
        </div>

        {/* Aguardando */}
        <div
          onClick={() => {
            setBuscaModal("");
            setIndicadorAtivo("aguardando");
          }}
          className="group cursor-pointer rounded-lg border border-borda bg-superficie p-4 transition hover:border-acento space-y-1"
          title="Clique para detalhar"
        >
          <span className="text-xs font-medium text-texto-suave block">Aguardando</span>
          <span className="text-2xl font-bold text-texto tabular-nums block">
            {dados.totais.aguardando}
          </span>
          <span className="text-[11px] text-texto-suave block">Em andamento</span>
        </div>

        {/* Concluídos */}
        <div
          onClick={() => {
            setBuscaModal("");
            setIndicadorAtivo("concluidos");
          }}
          className="group cursor-pointer rounded-lg border border-borda bg-superficie p-4 transition hover:border-sucesso space-y-1"
          title="Clique para detalhar"
        >
          <span className="text-xs font-medium text-texto-suave block">Concluídos</span>
          <span className="text-2xl font-bold text-sucesso tabular-nums block">
            {dados.totais.concluidos}
          </span>
          <span className="text-[11px] text-texto-suave block">Resolvidos com sucesso</span>
        </div>

        {/* Taxa de resolução */}
        <div
          onClick={() => {
            setBuscaModal("");
            setIndicadorAtivo("taxa");
          }}
          className="group cursor-pointer rounded-lg border border-borda bg-superficie p-4 transition hover:border-acento space-y-1"
          title="Clique para detalhar"
        >
          <span className="text-xs font-medium text-texto-suave block">Taxa de resolução</span>
          <span className="text-2xl font-bold text-acento tabular-nums block">
            {dados.totais.total > 0 ? `${taxaGeralResolucao}%` : "—"}
          </span>
          <span className="text-[11px] text-texto-suave block">Meta: 90% no prazo</span>
        </div>

        {/* Vencidos em aberto (Neutro se 0; Crítico se > 0) */}
        <div
          onClick={() => {
            setBuscaModal("");
            setIndicadorAtivo("vencidos");
          }}
          className={`group cursor-pointer rounded-lg border p-4 transition space-y-1 ${
            dados.totais.vencidos > 0
              ? "border-erro bg-erro-fundo/40 text-erro"
              : "border-borda bg-superficie text-texto hover:border-borda/80"
          }`}
          title="Clique para detalhar"
        >
          <span className="text-xs font-medium block">Vencidos em aberto</span>
          <span className="text-2xl font-bold tabular-nums block">
            {dados.totais.vencidos}
          </span>
          <span className="text-[11px] text-texto-suave block">Prazos expirados</span>
        </div>

        {/* Vencendo em 2 dias (Neutro se 0; Atenção se > 0) */}
        <div
          onClick={() => {
            setBuscaModal("");
            setIndicadorAtivo("vencendo");
          }}
          className={`group cursor-pointer rounded-lg border p-4 transition space-y-1 ${
            dados.totais.vencendo_em_2_dias > 0
              ? "border-alerta bg-alerta-fundo/40 text-alerta"
              : "border-borda bg-superficie text-texto hover:border-borda/80"
          }`}
          title="Clique para detalhar"
        >
          <span className="text-xs font-medium block">Vencendo em até 2 dias</span>
          <span className="text-2xl font-bold tabular-nums block">
            {dados.totais.vencendo_em_2_dias}
          </span>
          <span className="text-[11px] text-texto-suave block">Atenção no prazo</span>
        </div>
      </div>

      {/* Modal Interativo de Detalhamento do Indicador */}
      {indicadorAtivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-borda bg-superficie p-5 space-y-4 max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-start justify-between border-b border-borda pb-3">
              <div>
                <h3 className="text-base font-semibold text-texto">
                  {modalInfo.titulo}
                </h3>
                <p className="text-xs text-texto-suave mt-0.5">
                  {modalInfo.subtitulo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIndicadorAtivo(null)}
                className="text-texto-suave hover:text-texto rounded-md p-1"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Listagem de Itens Críticos quando houver */}
            {modalInfo.listaFiltrada.length > 0 ? (
              <div className="space-y-3 flex-1 overflow-y-auto">
                <div className="relative">
                  <input
                    type="text"
                    value={buscaModal}
                    onChange={(e) => setBuscaModal(e.target.value)}
                    placeholder="Buscar por protocolo, aluno ou responsável..."
                    className="w-full rounded-lg border border-borda bg-fundo pl-9 pr-3 py-2 text-xs text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-texto-suave" />
                </div>

                <div className="divide-y divide-borda rounded-lg border border-borda bg-fundo">
                  {modalInfo.listaFiltrada.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/chamados/${item.id}`}
                            className="font-mono font-semibold text-acento hover:underline"
                          >
                            {item.protocolo}
                          </Link>
                          <span className="font-medium text-texto">{item.aluno_nome}</span>
                        </div>
                        <span className="text-[11px] text-texto-suave block mt-0.5">
                          Responsável: {item.atendente} · Prazo: {format(parseISO(item.prazo), "dd/MM/yyyy")}
                        </span>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                          item.status === "vencido"
                            ? "bg-erro-fundo text-erro border border-erro/30"
                            : "bg-alerta-fundo text-alerta border border-alerta/30"
                        }`}
                      >
                        {item.status === "vencido" ? "Vencido" : "Vence em breve"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center rounded-lg border border-borda bg-fundo p-6 text-center space-y-1">
                <span className="text-xs font-medium text-texto">
                  Consulte a listagem completa no módulo de chamados.
                </span>
                <span className="text-[11px] text-texto-suave">
                  Use os filtros de situação e prazo para refinar os resultados.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-borda pt-3">
              <button
                type="button"
                onClick={() => setIndicadorAtivo(null)}
                className="h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo transition"
              >
                Fechar
              </button>
              <Link
                href={modalInfo.linkVerTodos}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover transition"
              >
                <span>Ver módulo de chamados</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 3. Ranking de Produtividade: Resolvidos vs. Em Aberto por Responsável */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-borda pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-acento" />
              <h2 className="text-sm font-semibold text-texto">
                Chamados Resolvidos vs. Em Aberto por Responsável
              </h2>
            </div>
            <p className="text-xs text-texto-suave mt-0.5">
              Volume concluído com resolução comparado a pendências remanescentes na fila.
            </p>
          </div>

          {/* Legenda Semântica: Acento (Resolvidos) e Cinza Médio (Em Aberto) */}
          <div className="flex items-center gap-4 text-xs font-medium bg-fundo px-3 py-1.5 rounded-lg border border-borda">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-acento" />
              <span className="text-texto">Resolvidos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-borda" />
              <span className="text-texto-suave">Em aberto</span>
            </div>
          </div>
        </div>

        {/* Lista de Responsáveis com Fundo Neutro na Base */}
        {dados.rankingEquipe.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-borda bg-fundo p-6 text-center space-y-2">
            <span className="text-sm font-medium text-texto">
              Nenhum atendimento registrado no período selecionado.
            </span>
            <span className="text-xs text-texto-suave">
              Os atendimentos aparecerão aqui assim que novos chamados forem abertos ou concluídos.
            </span>
            <div className="pt-2">
              <Link
                href="/chamados/novo"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Novo Chamado</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {dados.rankingEquipe.map((colab) => (
              <div
                key={colab.id}
                className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Lado Esquerdo: Identificação */}
                <div className="flex items-center gap-3 min-w-[240px]">
                  <span className="font-mono text-xs font-semibold text-texto-suave w-6 text-center">
                    #{colab.posicao}
                  </span>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fundo border border-borda text-xs font-bold text-texto">
                    {colab.avatarTexto}
                  </div>

                  <div className="truncate">
                    <span className="text-xs font-semibold text-texto block truncate" title={colab.nome}>
                      {colab.nome}
                    </span>
                    <span className="text-[11px] text-texto-suave block">
                      {colab.papel}
                    </span>
                  </div>
                </div>

                {/* Lado Direito: Barra Proporcional Semântica */}
                <div className="flex-1 sm:max-w-md">
                  <div className="flex h-7 w-full overflow-hidden rounded-md border border-borda bg-fundo">
                    {/* Resolvidos (Acento) */}
                    {colab.resolvidos > 0 && (
                      <div
                        style={{ width: `${Math.max(colab.pctResolvidos, 10)}%` }}
                        className="flex items-center justify-between bg-acento px-2 text-white text-[11px] font-semibold tabular-nums"
                        title={`${colab.resolvidos} resolvidos (${colab.pctResolvidos}%)`}
                      >
                        <span>{colab.resolvidos}</span>
                        <span className="opacity-90">{colab.pctResolvidos}%</span>
                      </div>
                    )}

                    {/* Em Aberto (Cinza Médio) */}
                    {colab.abertos > 0 && (
                      <div
                        style={{ width: `${Math.max(colab.pctAbertos, 10)}%` }}
                        className="flex items-center justify-between bg-borda px-2 text-texto text-[11px] font-semibold tabular-nums"
                        title={`${colab.abertos} em aberto (${colab.pctAbertos}%)`}
                      >
                        <span>{colab.abertos}</span>
                        <span className="text-texto-suave">{colab.pctAbertos}%</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-texto-suave">
                    <span>Total atribuído: <strong className="text-texto font-medium">{colab.total}</strong></span>
                    <span>Tempo médio: <strong className="text-texto font-medium">{colab.tempoMedioDias}d</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Gráficos de Volume e Motivos Recorrentes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Volume de Chamados (12 Meses) */}
        <div className="rounded-lg border border-borda bg-superficie p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              Volume de Chamados (Últimos 12 Meses)
            </h2>
            <p className="text-xs text-texto-suave mt-0.5">
              Comparativo temporal entre abertura de chamados e resolução efetiva.
            </p>
          </div>

          {totalVolume12m === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-borda bg-fundo p-4 text-center space-y-1">
              <span className="text-xs font-medium text-texto">Sem histórico de chamados registrado.</span>
              <span className="text-[11px] text-texto-suave">Os dados mensais serão preenchidos conforme novos chamados forem abertos.</span>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dados.volumeMensal} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" fill="var(--acento)" fillOpacity={0.1} stroke="none" />
                  <Line type="monotone" dataKey="total" name="Abertos" stroke="var(--texto-suave)" strokeWidth={1.5} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="concluidos" name="Resolvidos" stroke="var(--acento)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Motivos Mais Frequentes */}
        <div className="rounded-lg border border-borda bg-superficie p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              Motivos Mais Frequentes
            </h2>
            <p className="text-xs text-texto-suave mt-0.5">
              Principais motivos classificados por volume de solicitações.
            </p>
          </div>

          {dados.topMotivos.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-borda bg-fundo p-4 text-center space-y-1">
              <span className="text-xs font-medium text-texto">Nenhum motivo registrado no período.</span>
              <span className="text-[11px] text-texto-suave">A frequência dos motivos será exibida após o registro de chamados.</span>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={dados.topMotivos} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                  <YAxis dataKey="codigo" type="category" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} width={40} />
                  <Tooltip formatter={(val, _name, item) => [`${val} chamados`, item.payload.nome]} />
                  <Bar dataKey="total" fill="var(--acento)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 5. Gargalos e Cumprimento de Prazos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tempo Médio por Motivo */}
        <div className="rounded-lg border border-borda bg-superficie p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              Tempo Médio de Solução por Motivo
            </h2>
            <p className="text-xs text-texto-suave mt-0.5">
              Dias úteis médios até a conclusão efetiva do chamado.
            </p>
          </div>

          {dados.tempoMedioPorMotivo.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-borda bg-fundo p-4 text-center space-y-1">
              <span className="text-xs font-medium text-texto">Dados insuficientes para cálculo de tempo médio.</span>
              <span className="text-[11px] text-texto-suave">Mínimo de 3 chamados concluídos por motivo para cálculo estatístico.</span>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.tempoMedioPorMotivo} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                  <XAxis dataKey="motivo" tick={{ fontSize: 10, fill: "var(--texto-suave)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                  <Tooltip formatter={(val, _name, item) => [`${val} dias (${item.payload.concluidos} concluídos)`, item.payload.nome]} />
                  {dados.mediaGeralDias > 0 && (
                    <ReferenceLine
                      y={dados.mediaGeralDias}
                      stroke="var(--alerta)"
                      strokeDasharray="3 3"
                      label={{ value: `Média (${dados.mediaGeralDias}d)`, fill: "var(--alerta)", fontSize: 10 }}
                    />
                  )}
                  <Bar dataKey="dias" name="Dias médios" fill="var(--acento)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Cumprimento de Prazos */}
        <div className="rounded-lg border border-borda bg-superficie p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">
              Cumprimento de Prazos
            </h2>
            <p className="text-xs text-texto-suave mt-0.5">
              Taxa de resolução no prazo de 5 dias úteis com meta em 90%.
            </p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.taxaPrazoMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <YAxis domain={[0, 100]} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <Tooltip formatter={(val) => [val !== null ? `${val}%` : "—", "Taxa no prazo"]} />
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
    </div>
  );
}
