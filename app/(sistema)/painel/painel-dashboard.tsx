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
import { Calendar, ArrowRight, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

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

export function PainelDashboard({
  dados,
  periodoSelecionado,
}: PainelDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [periodo, setPeriodo] = useState(periodoSelecionado);

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

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Seletor de Período */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto">
            Painel de indicadores
          </h1>
          <p className="text-xs text-texto-suave">
            Acompanhamento operacional de fila, prazos, gargalos e motivos recorrentes.
          </p>
        </div>

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

      {/* Cartões de Indicadores Principais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-xs font-medium text-texto-suave block">Total no período</span>
          <span className="font-mono text-2xl font-bold text-texto tabular-nums block mt-1">
            {dados.totais.total}
          </span>
        </div>

        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-xs font-medium text-texto-suave block">Aguardando</span>
          <span className="font-mono text-2xl font-bold text-texto tabular-nums block mt-1">
            {dados.totais.aguardando}
          </span>
        </div>

        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-xs font-medium text-texto-suave block">Concluídos (resolvidos)</span>
          <span className="font-mono text-2xl font-bold text-sucesso tabular-nums block mt-1">
            {dados.totais.concluidos}
          </span>
        </div>

        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-xs font-medium text-texto-suave block">Encerrados</span>
          <span className="font-mono text-2xl font-bold text-texto-suave tabular-nums block mt-1">
            {dados.totais.encerrados}
          </span>
        </div>

        {/* Vencidos: Neutro se 0; Destaque de erro se > 0 */}
        <div
          className={`rounded border p-3.5 shadow-sm transition ${
            dados.totais.vencidos > 0
              ? "border-erro/40 bg-erro-fundo text-erro"
              : "border-borda bg-superficie text-texto"
          }`}
        >
          <span
            className={`text-xs font-medium block ${
              dados.totais.vencidos > 0 ? "text-erro font-semibold" : "text-texto-suave"
            }`}
          >
            Vencidos em aberto
          </span>
          <span
            className={`font-mono text-2xl font-bold tabular-nums block mt-1 ${
              dados.totais.vencidos > 0 ? "text-erro" : "text-texto"
            }`}
          >
            {dados.totais.vencidos}
          </span>
        </div>

        {/* Vencendo em 2 dias: Neutro se 0; Destaque de alerta se > 0 */}
        <div
          className={`rounded border p-3.5 shadow-sm transition ${
            dados.totais.vencendo_em_2_dias > 0
              ? "border-alerta/40 bg-alerta-fundo text-alerta"
              : "border-borda bg-superficie text-texto"
          }`}
        >
          <span
            className={`text-xs font-medium block ${
              dados.totais.vencendo_em_2_dias > 0 ? "text-alerta font-semibold" : "text-texto-suave"
            }`}
          >
            Vencendo em até 2 dias
          </span>
          <span
            className={`font-mono text-2xl font-bold tabular-nums block mt-1 ${
              dados.totais.vencendo_em_2_dias > 0 ? "text-alerta" : "text-texto"
            }`}
          >
            {dados.totais.vencendo_em_2_dias}
          </span>
        </div>
      </div>

      {/* 1. Como está a fila hoje? (Barra horizontal empilhada única) */}
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-texto">
            Como está a fila hoje?
          </h2>
          <p className="text-xs text-texto-suave">
            Distribuição proporcional entre chamados aguardando atendimento, concluídos com resolução e encerrados sem resolução.
          </p>
        </div>

        {dados.fila.total < 1 ? (
          renderEstadoVazioGrafico(dados.fila.total)
        ) : (
          <div className="space-y-2">
            <div className="flex h-9 w-full overflow-hidden rounded border border-borda bg-fundo">
              {dados.fila.concluidos > 0 && (
                <div
                  style={{ width: `${(dados.fila.concluidos / dados.fila.total) * 100}%` }}
                  className="flex items-center justify-center bg-sucesso text-white text-xs font-bold font-mono px-2"
                  title={`Concluídos: ${dados.fila.concluidos}`}
                >
                  {dados.fila.concluidos} ({Math.round((dados.fila.concluidos / dados.fila.total) * 100)}%)
                </div>
              )}
              {dados.fila.aguardando > 0 && (
                <div
                  style={{ width: `${(dados.fila.aguardando / dados.fila.total) * 100}%` }}
                  className="flex items-center justify-center bg-acento text-white text-xs font-bold font-mono px-2"
                  title={`Aguardando: ${dados.fila.aguardando}`}
                >
                  {dados.fila.aguardando} ({Math.round((dados.fila.aguardando / dados.fila.total) * 100)}%)
                </div>
              )}
              {dados.fila.encerrados > 0 && (
                <div
                  style={{ width: `${(dados.fila.encerrados / dados.fila.total) * 100}%` }}
                  className="flex items-center justify-center bg-texto-suave text-fundo text-xs font-bold font-mono px-2"
                  title={`Encerrados: ${dados.fila.encerrados}`}
                >
                  {dados.fila.encerrados} ({Math.round((dados.fila.encerrados / dados.fila.total) * 100)}%)
                </div>
              )}
            </div>

            {/* Legenda simples */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-sucesso" />
                <span className="text-texto">Concluídos ({dados.fila.concluidos})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-acento" />
                <span className="text-texto">Aguardando ({dados.fila.aguardando})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-texto-suave" />
                <span className="text-texto">Encerrados ({dados.fila.encerrados})</span>
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

          {totalVolume12m < 3 ? (
            renderEstadoVazioGrafico(totalVolume12m)
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dados.volumeMensal} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
              Top 10 motivos ordenados por quantidade de solicitações abertas.
            </p>
          </div>

          {dados.topMotivos.length === 0 ? (
            renderEstadoVazioGrafico(0)
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={dados.topMotivos}
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                  <YAxis
                    dataKey="codigo"
                    type="category"
                    tick={{ fontSize: 11, fill: "var(--texto-suave)" }}
                    width={50}
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
            {dados.motivoMaisDemorado ? (
              <p className="text-xs text-texto-suave">
                <strong className="text-texto font-medium">{dados.motivoMaisDemorado.nome}</strong> leva cerca de{" "}
                <strong className="text-alerta font-medium">{dados.motivoMaisDemorado.fatorMultiplicador}x</strong> mais tempo que a média geral.
              </p>
            ) : (
              <p className="text-xs text-texto-suave">
                Tempo médio de resolução por motivo (apenas motivos com 3 ou mais chamados concluídos).
              </p>
            )}
          </div>

          {dados.tempoMedioPorMotivo.length === 0 ? (
            renderEstadoVazioGrafico(dados.tempoMedioPorMotivo.length, "Sem motivos com 3 ou mais conclusões")
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.tempoMedioPorMotivo} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                  <XAxis dataKey="motivo" tick={{ fontSize: 10, fill: "var(--texto-suave)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                  <Tooltip
                    formatter={(val, _name, item) => [
                      `${val} dias (${item.payload.concluidos} concluídos)`,
                      item.payload.nome,
                    ]}
                  />
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

          {dados.taxaPrazoMensal.every((t) => t.taxa === null) ? (
            renderEstadoVazioGrafico(0, "Nenhum chamado concluído nos últimos 12 meses")
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dados.taxaPrazoMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
          )}
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
              Lista prioritária de protocolos vencidos ou com prazo próximo para conclusão.
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

        {dados.chamadosVencidosOuProximos.length === 0 ? (
          <p className="text-xs text-texto-suave py-4 text-center">
            Nenhum chamado vencido ou com prazo crítico pendente.
          </p>
        ) : (
          <div className="divide-y divide-borda/40 rounded border border-borda bg-fundo max-h-64 overflow-y-auto">
            {dados.chamadosVencidosOuProximos.map((c) => (
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
        )}
      </div>
    </div>
  );
}
