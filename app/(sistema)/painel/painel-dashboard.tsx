"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Calendar,
  ArrowRight,
} from "lucide-react";
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
  situacoesPie: { nome: string; valor: number; cor: string }[];
  volumeMensal: { mes: string; total: number; concluidos: number }[];
  topMotivos: { nome: string; codigo: string; total: number }[];
  porAtendente: { atendente: string; aguardando: number; concluidos: number; encerrados: number }[];
  tempoMedioPorMotivo: { motivo: string; dias: number }[];
  taxaPrazoMensal: { mes: string; taxa: number }[];
  chamadosVencidosOuProximos: {
    id: string;
    protocolo: string;
    aluno_nome: string;
    prazo: string;
    status: "vencido" | "vencendo_em_2_dias";
    atendente: string;
  }[];
  alunosReincidentes: {
    aluno_nome: string;
    total: number;
    protocolos: string[];
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Seletor de Período */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-texto">
            Painel Geral de Indicadores
          </h1>
          <p className="text-xs text-texto-suave">
            Visão consolidada de volume, prazos, motivos críticos e reincidências.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded border border-borda bg-superficie p-1 text-xs">
          <Calendar className="h-3.5 w-3.5 text-texto-suave ml-1" />
          <button
            type="button"
            onClick={() => mudarPeriodo("mes_atual")}
            className={`rounded px-2 py-1 transition ${
              periodo === "mes_atual"
                ? "bg-fundo text-texto font-medium shadow-sm"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            Mês Atual
          </button>
          <button
            type="button"
            onClick={() => mudarPeriodo("semestre_atual")}
            className={`rounded px-2 py-1 transition ${
              periodo === "semestre_atual"
                ? "bg-fundo text-texto font-medium shadow-sm"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            Semestre Letivo
          </button>
          <button
            type="button"
            onClick={() => mudarPeriodo("ultimos_12_meses")}
            className={`rounded px-2 py-1 transition ${
              periodo === "ultimos_12_meses"
                ? "bg-fundo text-texto font-medium shadow-sm"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            Últimos 12 Meses
          </button>
        </div>
      </div>

      {/* Cartões de Indicadores Críticos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-[11px] font-medium text-texto-suave block">Total no Período</span>
          <span className="font-mono text-xl font-bold text-texto tabular-nums block mt-1">
            {dados.totais.total}
          </span>
        </div>

        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-[11px] font-medium text-texto-suave block">Aguardando</span>
          <span className="font-mono text-xl font-bold text-texto tabular-nums block mt-1">
            {dados.totais.aguardando}
          </span>
        </div>

        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-[11px] font-medium text-texto-suave block">Concluídos (Resolvidos)</span>
          <span className="font-mono text-xl font-bold text-sucesso tabular-nums block mt-1">
            {dados.totais.concluidos}
          </span>
        </div>

        <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm">
          <span className="text-[11px] font-medium text-texto-suave block">Encerrados (Sem Resolver)</span>
          <span className="font-mono text-xl font-bold text-texto-suave tabular-nums block mt-1">
            {dados.totais.encerrados}
          </span>
        </div>

        <div className="rounded border border-erro/30 bg-erro-fundo p-3.5 shadow-sm">
          <span className="text-[11px] font-medium text-erro block">Vencidos em Aberto</span>
          <span className="font-mono text-xl font-bold text-erro tabular-nums block mt-1">
            {dados.totais.vencidos}
          </span>
        </div>

        <div className="rounded border border-alerta/30 bg-alerta-fundo p-3.5 shadow-sm">
          <span className="text-[11px] font-medium text-alerta block">Vencendo em até 2 Dias</span>
          <span className="font-mono text-xl font-bold text-alerta tabular-nums block mt-1">
            {dados.totais.vencendo_em_2_dias}
          </span>
        </div>
      </div>

      {/* Linha 1 de Gráficos: Situação e Volume Mensal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gráfico 1: Chamados por Situação (Rosca) */}
        <div className="rounded border border-borda bg-superficie p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2">
            1. Chamados por Situação
          </h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dados.situacoesPie}
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="valor"
                  nameKey="nome"
                >
                  {dados.situacoesPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Volume Mensal (Linha - Últimos 12 meses) */}
        <div className="lg:col-span-2 rounded border border-borda bg-superficie p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2">
            2. Volume Mensal de Abertura e Resolução (Últimos 12 meses)
          </h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.volumeMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                <Line type="monotone" dataKey="total" name="Abertos" stroke="var(--texto-suave)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="concluidos" name="Resolvidos" stroke="var(--acento)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Linha 2 de Gráficos: Top 10 Motivos e Distribuição por Atendente */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico 3: Top 10 Motivos (Barra Horizontal) */}
        <div className="rounded border border-borda bg-superficie p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2">
            3. Top 10 Motivos de Chamados
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={dados.topMotivos}
                margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <YAxis
                  dataKey="codigo"
                  type="category"
                  tick={{ fontSize: 11, fill: "var(--texto-suave)" }}
                />
                <Tooltip
                  formatter={(val, _name, item) => [
                    `${val} chamados`,
                    item.payload.nome,
                  ]}
                />
                <Bar dataKey="total" name="Total" fill="var(--acento)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Distribuição por Atendente Empilhada por Situação */}
        <div className="rounded border border-borda bg-superficie p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2">
            4. Distribuição por Atendente e Situação
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.porAtendente} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="atendente" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="concluidos" name="Concluídos" stackId="a" fill="#15803D" />
                <Bar dataKey="aguardando" name="Aguardando" stackId="a" fill="#0E6F63" />
                <Bar dataKey="encerrados" name="Encerrados" stackId="a" fill="#9AA1A9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Linha 3 de Gráficos: Tempo Médio por Motivo e Taxa de Prazo */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico 5: Tempo Médio de Resolução por Motivo (Gargalos) */}
        <div className="rounded border border-borda bg-superficie p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2">
            5. Tempo Médio de Resolução por Motivo (Dias) — Gargalos
          </h2>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.tempoMedioPorMotivo} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="motivo" tick={{ fontSize: 10, fill: "var(--texto-suave)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <Tooltip formatter={(val) => [`${val} dias`, "Tempo Médio"]} />
                <Bar dataKey="dias" name="Dias para Resolução" fill="#B45309" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 6: Taxa de Cumprimento de Prazo por Mês */}
        <div className="rounded border border-borda bg-superficie p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2">
            6. Taxa Mensal de Cumprimento de Prazos (%)
          </h2>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.taxaPrazoMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <Tooltip formatter={(val) => [`${val}%`, "No Prazo"]} />
                <Line type="monotone" dataKey="taxa" name="Taxa no Prazo (%)" stroke="#15803D" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Linha 4: Listas Acionáveis (7. Chamados Vencidos / Vencendo e 8. Alunos Reincidentes) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 7. Lista Acionável de Chamados Críticos */}
        <div className="rounded border border-borda bg-superficie p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-borda/40 pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave">
              7. Chamados Vencidos e a Vencer (Ação Imediata)
            </h2>
            <Link href="/chamados?situacao=aguardando" className="text-xs text-acento hover:underline flex items-center gap-1">
              <span>Ver todos</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {dados.chamadosVencidosOuProximos.length === 0 ? (
            <p className="text-xs text-texto-suave py-4 text-center">
              Nenhum chamado vencido ou com prazo crítico no momento.
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
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
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

        {/* 8. Reincidência de Alunos no Semestre */}
        <div className="rounded border border-borda bg-superficie p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2">
            8. Alunos com Múltiplos Chamados no Semestre (Reincidência)
          </h2>

          {dados.alunosReincidentes.length === 0 ? (
            <p className="text-xs text-texto-suave py-4 text-center">
              Nenhuma reincidência de aluno detectada no semestre.
            </p>
          ) : (
            <div className="divide-y divide-borda/40 rounded border border-borda bg-fundo max-h-64 overflow-y-auto">
              {dados.alunosReincidentes.map((a, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                  <div>
                    <span className="font-medium text-texto">{a.aluno_nome}</span>
                    <div className="text-[11px] font-mono text-texto-suave">
                      Protocolos: {a.protocolos.join(", ")}
                    </div>
                  </div>
                  <span className="rounded bg-superficie border border-borda px-2 py-0.5 font-mono font-bold text-texto text-xs">
                    {a.total} chamados
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
