"use client";

import { useTransition } from "react";
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
  Legend,
} from "recharts";
import {
  ArrowRight,
  Award,
  Plus,
  Ticket,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Percent,
  Inbox,
  XCircle,
  Timer,
  Info,
} from "lucide-react";
import { type Polo, type Perfil } from "@/types/database";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";
import { AvatarUsuario } from "@/components/ui/avatar-usuario";
import { formatarDataCivil } from "@/lib/datas";
import type { Indicadores } from "@/lib/indicadores/definicoes";
import type { LinhaRanking, ResumoEquipe } from "@/lib/indicadores/pontuacao";
import type { ClassificacaoPrazo } from "@/lib/sla";

export interface DadosPainel {
  periodo: { codigo: string; rotulo: string; inicio: string; fim: string };
  hoje: string;
  poloNome: string;
  indicadores: Indicadores;
  links: Record<
    "abertos" | "resolvidos" | "encerrados" | "estoque" | "vencidos" | "vencendo",
    string
  >;
  ranking: (LinhaRanking & { foto: string | null })[];
  equipe: ResumoEquipe;
  mensal: { mes: string; abertos: number; resolvidos: number; taxa_sla: number | null }[];
  topMotivos: { codigo: string; nome: string; total: number }[];
  tempoPorMotivo: {
    chave: string;
    rotulo: string;
    resolvidos: number;
    tempo_medio_dias_uteis: number;
  }[];
  criticos: {
    id: string;
    protocolo: string;
    aluno_nome: string;
    prazo: string;
    classe: ClassificacaoPrazo;
    responsavel: string;
  }[];
}

interface Props {
  dados: DadosPainel;
  polos?: Polo[];
  poloSelecionado?: string;
  perfilAtual?: Perfil;
}

const fmtNum = (v: number | null, sufixo = "") =>
  v === null ? "—" : `${String(v).replace(".", ",")}${sufixo}`;

function Cartao({
  titulo,
  valor,
  descricao,
  href,
  icone,
  cor,
}: {
  titulo: string;
  valor: string | number;
  descricao: string;
  href?: string;
  icone: React.ReactNode;
  cor: string;
}) {
  const conteudo = (
    <>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-texto-suave">{titulo}</span>
        <span
          className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${cor}`}
          aria-hidden="true"
        >
          {icone}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-texto tabular-nums">{valor}</div>
      <p className="text-[11px] text-texto-suave leading-snug">{descricao}</p>
      {href && (
        <span className="text-[11px] font-semibold text-acento inline-flex items-center gap-1">
          Ver na listagem <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </span>
      )}
    </>
  );
  const classe = "rounded-xl border border-borda bg-superficie p-3.5 space-y-1.5 transition-all";
  return href ? (
    <Link
      href={href}
      className={`${classe} hover:border-acento/50 hover:shadow-xs focus-visible:ring-2 focus-visible:ring-acento`}
    >
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

function SemDados({ texto }: { texto: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-borda text-xs text-texto-suave">
      {texto}
    </div>
  );
}

export function PainelDashboard({
  dados,
  polos = [],
  poloSelecionado = "todos",
  perfilAtual,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [carregando, startTransition] = useTransition();
  const ind = dados.indicadores;
  const ehAdmin = perfilAtual?.papel === "admin";

  const navegar = (chave: string, valor: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor && valor !== "todos") params.set(chave, valor);
    else params.delete(chave);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const opcoesPolo: CustomSelectOption[] = [
    ...(ehAdmin ? [{ value: "todos", label: "Todos os polos (consolidado)" }] : []),
    ...polos.map((p) => ({ value: p.id, label: `${p.nome} (${p.cidade})` })),
  ];
  const elegiveis = dados.ranking.filter((r) => r.elegivel);
  const maxVolume = Math.max(
    1,
    ...dados.ranking.map((r) => r.resolvidos + r.encerrados + r.pendentes)
  );
  const periodoTexto = `${formatarDataCivil(dados.periodo.inicio)} a ${formatarDataCivil(dados.periodo.fim)}`;

  return (
    <div className="space-y-6" aria-busy={carregando}>
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 pb-3 border-b border-borda/40">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-texto">
            Painel de Indicadores
          </h1>
          <p className="text-xs text-texto-suave mt-0.5">
            <strong className="text-texto">{dados.periodo.rotulo}</strong> ({periodoTexto}) ·{" "}
            <strong className="text-texto">{dados.poloNome}</strong> · registros de teste excluídos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {ehAdmin ? (
            <div className="w-56 shrink-0">
              <CustomSelect
                options={opcoesPolo}
                value={poloSelecionado}
                onChange={(v) => navegar("polo_id", v)}
                label={undefined}
              />
            </div>
          ) : (
            <div className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto">
              <span className="text-texto-suave font-normal">Polo:</span>
              <span>{dados.poloNome}</span>
            </div>
          )}
          <div
            role="group"
            aria-label="Período"
            className="inline-flex h-9 items-center rounded-lg border border-borda bg-fundo p-1 shrink-0"
          >
            {(
              [
                ["mes_atual", "Mês atual"],
                ["semestre_atual", "Semestre"],
                ["ultimos_12_meses", "12 meses"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={dados.periodo.codigo === v}
                onClick={() => navegar("periodo", v === "mes_atual" ? null : v)}
                className={`h-7 px-3 rounded-md text-xs font-semibold transition-all ${
                  dados.periodo.codigo === v
                    ? "bg-acento text-white shadow-xs"
                    : "text-texto-suave hover:text-texto"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {perfilAtual && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-borda/80 bg-gradient-to-r from-superficie via-superficie to-azul-primario/5">
          <div className="flex items-center gap-3.5">
            <AvatarUsuario
              nome={perfilAtual.nome_completo}
              fotoUrl={perfilAtual.avatar_url}
              tamanho="xl"
              indicadorStatus
              statusOnline
            />
            <div className="space-y-0.5">
              <span className="text-base font-bold text-texto tracking-tight">
                {perfilAtual.nome_completo}
              </span>
              <div className="text-xs text-texto-suave">
                {perfilAtual.email}
                {perfilAtual.polo_nome ? ` · ${perfilAtual.polo_nome}` : ""}
              </div>
            </div>
          </div>
          <Link
            href="/chamados/novo"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-acento hover:bg-acento/90 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Novo chamado
          </Link>
        </div>
      )}

      <section aria-labelledby="titulo-periodo" className="space-y-2">
        <h2
          id="titulo-periodo"
          className="text-xs font-bold uppercase tracking-wider text-texto-suave"
        >
          Fluxo no período ({periodoTexto})
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Cartao
            titulo="Abertos"
            valor={ind.abertos_no_periodo}
            descricao="Data de abertura no período"
            href={dados.links.abertos}
            icone={<Ticket className="h-3.5 w-3.5" />}
            cor="bg-sky-500/10 text-sky-600"
          />
          <Cartao
            titulo="Resolvidos"
            valor={ind.resolvidos_no_periodo}
            descricao="Resolvidos (dia da conclusão) no período"
            href={dados.links.resolvidos}
            icone={<CheckCircle2 className="h-3.5 w-3.5" />}
            cor="bg-emerald-500/10 text-emerald-600"
          />
          <Cartao
            titulo="Encerrados sem solução"
            valor={ind.encerrados_no_periodo}
            descricao="Encerrados no período"
            href={dados.links.encerrados}
            icone={<XCircle className="h-3.5 w-3.5" />}
            cor="bg-slate-500/10 text-slate-600"
          />
          <Cartao
            titulo="Taxa de resolução"
            valor={fmtNum(ind.taxa_resolucao, "%")}
            descricao={
              ind.abertos_no_periodo > 0
                ? `${ind.coorte_resolvidos} dos ${ind.abertos_no_periodo} abertos no período já resolvidos`
                : "Sem chamados abertos no período"
            }
            icone={<Percent className="h-3.5 w-3.5" />}
            cor="bg-blue-500/10 text-blue-600"
          />
          <Cartao
            titulo="Cumprimento do SLA"
            valor={fmtNum(ind.taxa_sla, "%")}
            descricao={
              ind.resolvidos_no_periodo > 0
                ? `${ind.resolvidos_no_prazo} de ${ind.resolvidos_no_periodo} resolvidos no prazo (meta 90%)`
                : "Sem resoluções no período"
            }
            href={dados.links.resolvidos}
            icone={<Clock className="h-3.5 w-3.5" />}
            cor="bg-indigo-500/10 text-indigo-600"
          />
          <Cartao
            titulo="Tempo médio"
            valor={fmtNum(ind.tempo_medio_dias_uteis, " d.ú.")}
            descricao="Dias úteis da abertura à resolução, dos resolvidos no período"
            icone={<Timer className="h-3.5 w-3.5" />}
            cor="bg-violet-500/10 text-violet-600"
          />
        </div>
      </section>

      <section aria-labelledby="titulo-agora" className="space-y-2">
        <h2
          id="titulo-agora"
          className="text-xs font-bold uppercase tracking-wider text-texto-suave"
        >
          Situação agora ({formatarDataCivil(dados.hoje)}) — independe do período
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Cartao
            titulo="Pendências (estoque)"
            valor={ind.estoque_pendente}
            descricao="Todos os chamados não finalizados, de qualquer data de abertura"
            href={dados.links.estoque}
            icone={<Inbox className="h-3.5 w-3.5" />}
            cor="bg-amber-500/10 text-amber-600"
          />
          <Cartao
            titulo="Vencidos em aberto"
            valor={ind.vencidos_pendentes}
            descricao="Pendentes com prazo anterior a hoje"
            href={dados.links.vencidos}
            icone={<AlertOctagon className="h-3.5 w-3.5" />}
            cor="bg-red-500/10 text-red-600"
          />
          <Cartao
            titulo="Vencem em até 2 dias"
            valor={ind.vencem_ate_2_dias}
            descricao="Pendentes com prazo de hoje até 2 dias corridos"
            href={dados.links.vencendo}
            icone={<AlertTriangle className="h-3.5 w-3.5" />}
            cor="bg-orange-500/10 text-orange-600"
          />
        </div>
      </section>

      <section
        className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm space-y-4"
        aria-labelledby="titulo-equipe"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-borda pb-3">
          <div>
            <h2
              id="titulo-equipe"
              className="text-base font-extrabold text-texto flex items-center gap-2"
            >
              <Award className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" /> Atendimento por
              responsável
            </h2>
            <p className="text-xs text-texto-suave mt-0.5">
              Finalizados no período e pendências atuais de cada responsável. Tempo médio em dias
              úteis (mesmo cálculo da tela Desempenho).
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold bg-fundo px-3.5 py-2 rounded-xl border border-borda">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#1D4ED8]" /> Resolvidos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-slate-400" /> Encerrados
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#DC2626]" /> Pendentes
            </span>
          </div>
        </div>
        {dados.ranking.length === 0 ? (
          <SemDados texto="Nenhum participante neste polo." />
        ) : (
          <ul className="space-y-3">
            {dados.ranking.map((r) => {
              const total = r.resolvidos + r.encerrados + r.pendentes;
              return (
                <li
                  key={r.usuario_id}
                  className="flex flex-col gap-3 rounded-2xl border border-borda p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3 min-w-[240px]">
                    <span className="font-mono text-sm font-black text-texto w-8 text-center">
                      {r.posicao ? `#${r.posicao}` : "—"}
                    </span>
                    <AvatarUsuario
                      nome={r.nome_completo}
                      fotoUrl={r.foto ?? undefined}
                      tamanho="lg"
                    />
                    <div className="truncate">
                      <div className="text-sm font-bold text-texto truncate">{r.nome_completo}</div>
                      <div className="text-[11px] text-texto-suave">
                        {r.elegivel
                          ? `${r.pontos_total} pts`
                          : "Sem chamados finalizados no período"}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 sm:max-w-xl">
                    <div
                      className="flex h-8 w-full overflow-hidden rounded-lg bg-fundo border border-borda"
                      role="img"
                      aria-label={`${r.resolvidos} resolvidos, ${r.encerrados} encerrados, ${r.pendentes} pendentes`}
                    >
                      <div
                        style={{ width: `${(total / maxVolume) * 100}%` }}
                        className="flex h-full"
                      >
                        {r.resolvidos > 0 && (
                          <div
                            style={{ flex: r.resolvidos }}
                            className="bg-[#1D4ED8] text-white text-[11px] font-bold flex items-center px-2"
                          >
                            {r.resolvidos}
                          </div>
                        )}
                        {r.encerrados > 0 && (
                          <div
                            style={{ flex: r.encerrados }}
                            className="bg-slate-400 text-white text-[11px] font-bold flex items-center px-2"
                          >
                            {r.encerrados}
                          </div>
                        )}
                        {r.pendentes > 0 && (
                          <div
                            style={{ flex: r.pendentes }}
                            className="bg-[#DC2626] text-white text-[11px] font-bold flex items-center px-2"
                          >
                            {r.pendentes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-texto-suave px-1">
                      <span>
                        No prazo:{" "}
                        <strong className="text-texto">
                          {r.taxa_prazo === null
                            ? "—"
                            : `${String(r.taxa_prazo).replace(".", ",")}%`}
                        </strong>
                      </span>
                      <span>
                        Tempo médio:{" "}
                        <strong className="text-texto">
                          {r.tempo_medio_dias_uteis === null
                            ? "—"
                            : `${String(r.tempo_medio_dias_uteis).replace(".", ",")} d.ú.`}
                        </strong>
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-texto-suave flex items-center gap-1">
          <Info className="h-3 w-3" aria-hidden="true" />
          Equipe: {dados.equipe.resolvidos} resolvidos, {fmtNum(dados.equipe.taxa_prazo, "%")} no
          prazo, tempo médio {fmtNum(dados.equipe.tempo_medio_dias_uteis, " d.ú.")} (ponderado por
          chamado). {elegiveis.length} participante(s) com finalizados no período.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-bold text-texto">
              Abertos x resolvidos (últimos 12 meses)
            </h2>
            <p className="text-xs text-texto-suave">
              Abertos pela data de abertura; resolvidos pelo dia da conclusão.
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.mensal} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="abertos"
                  name="Abertos"
                  stroke="#1D4ED8"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="resolvidos"
                  name="Resolvidos"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-bold text-texto">Motivos mais recorrentes</h2>
            <p className="text-xs text-texto-suave">Chamados abertos no período, por motivo.</p>
          </div>
          <div className="h-56 w-full">
            {dados.topMotivos.length === 0 ? (
              <SemDados texto="Nenhum chamado aberto no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados.topMotivos
                    .slice(0, 6)
                    .map((m) => ({ ...m, rotulo: `${m.codigo} ${m.nome}` }))}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--texto-suave)" }}
                  />
                  <YAxis
                    dataKey="rotulo"
                    type="category"
                    width={170}
                    tick={{ fontSize: 10, fill: "var(--texto-suave)" }}
                    tickFormatter={(v: string) => (v.length > 30 ? `${v.slice(0, 29)}…` : v)}
                  />
                  <Tooltip formatter={(val) => [`${val} chamados`, "Abertos"]} />
                  <Bar dataKey="total" fill="#1D4ED8" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-bold text-texto">Tempo médio por motivo (dias úteis)</h2>
            <p className="text-xs text-texto-suave">
              Resolvidos no período. A linha tracejada é a média geral do período.
            </p>
          </div>
          <div className="h-56 w-full">
            {dados.tempoPorMotivo.length === 0 ? (
              <SemDados texto="Nenhuma resolução no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados.tempoPorMotivo}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                  <YAxis
                    dataKey="rotulo"
                    type="category"
                    width={170}
                    tick={{ fontSize: 10, fill: "var(--texto-suave)" }}
                    tickFormatter={(v: string) => (v.length > 30 ? `${v.slice(0, 29)}…` : v)}
                  />
                  <Tooltip
                    formatter={(val, _n, item) => [
                      `${String(val).replace(".", ",")} d.ú. (${item.payload.resolvidos} resolvidos)`,
                      "Tempo médio",
                    ]}
                  />
                  {ind.tempo_medio_dias_uteis !== null && (
                    <ReferenceLine
                      x={ind.tempo_medio_dias_uteis}
                      stroke="#D97706"
                      strokeDasharray="3 3"
                      label={{
                        value: `Média ${String(ind.tempo_medio_dias_uteis).replace(".", ",")}`,
                        fill: "#D97706",
                        fontSize: 10,
                        position: "top",
                      }}
                    />
                  )}
                  <Bar
                    dataKey="tempo_medio_dias_uteis"
                    name="Dias úteis"
                    fill="#1D4ED8"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-bold text-texto">Cumprimento do SLA por mês (meta 90%)</h2>
            <p className="text-xs text-texto-suave">
              Resolvidos no mês cujo dia de conclusão foi até o prazo. Meses sem resolução ficam
              vazios.
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.mensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" opacity={0.6} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} />
                <YAxis
                  domain={[0, 100]}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--texto-suave)" }}
                />
                <Tooltip
                  formatter={(val) => [
                    val !== null ? `${String(val).replace(".", ",")}%` : "sem resoluções",
                    "No prazo",
                  ]}
                />
                <ReferenceLine
                  y={90}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  label={{ value: "Meta 90%", fill: "#10B981", fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="taxa_sla"
                  name="No prazo (%)"
                  stroke="#1D4ED8"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section
        className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm space-y-3"
        aria-labelledby="titulo-criticos"
      >
        <div className="flex items-center justify-between border-b border-borda pb-2">
          <div>
            <h2 id="titulo-criticos" className="text-sm font-bold text-texto">
              Chamados que exigem atenção
            </h2>
            <p className="text-xs text-texto-suave">
              Pendentes vencidos ou que vencem em até 2 dias (os 10 mais antigos).
            </p>
          </div>
          <Link
            href={dados.links.vencidos}
            className="text-xs font-bold text-[#1D4ED8] hover:underline flex items-center gap-1"
          >
            Ver vencidos <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
        {dados.criticos.length === 0 ? (
          <p className="p-4 text-center text-xs text-texto-suave">
            Nenhum chamado vencido ou vencendo em até 2 dias.
          </p>
        ) : (
          <ul className="divide-y divide-borda/60 rounded-xl border border-borda bg-fundo">
            {dados.criticos.map((c) => (
              <li key={c.id} className="flex items-center justify-between p-3 text-xs">
                <div>
                  <Link
                    href={`/chamados/${c.id}`}
                    className="font-mono font-bold text-[#1D4ED8] hover:underline mr-2"
                  >
                    {c.protocolo}
                  </Link>
                  <span className="text-texto font-bold">{c.aluno_nome}</span>
                  <span className="text-[11px] text-texto-suave ml-2">({c.responsavel})</span>
                </div>
                <span
                  className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold ${
                    c.classe === "vencido"
                      ? "bg-red-500/15 text-red-600 border border-red-500/40"
                      : "bg-orange-500/15 text-orange-600 border border-orange-500/40"
                  }`}
                >
                  {c.classe === "vencido"
                    ? "Vencido"
                    : c.classe === "vence_hoje"
                      ? "Vence hoje"
                      : "Vence em breve"}{" "}
                  ({formatarDataCivil(c.prazo, "curto")})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
