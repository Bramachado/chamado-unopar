"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { type Perfil, type Polo } from "@/types/database";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";
import {
  ArrowRight,
  Zap,
  CheckCheck,
  Target,
  Info,
  Trophy,
  BarChart3,
  Clock,
  ChevronDown,
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
import { PESOS, type LinhaRanking, type ResumoEquipe } from "@/lib/indicadores/pontuacao";
import { REGRA_SLA } from "@/lib/sla";
import { formatarDataCivil } from "@/lib/datas";
import type { Periodo } from "@/lib/indicadores/definicoes";

export interface RecorteDesempenho {
  rotulo: string;
  periodo: Periodo;
  linhas: LinhaRanking[];
  equipe: ResumoEquipe;
  links: Record<string, string>;
}

interface Props {
  recortes: RecorteDesempenho[];
  perfilAtual: Perfil;
  evolucao: { mes: string; minhaPontuacao: number | null; mediaEquipe: number | null }[];
  polos?: Polo[];
  poloSelecionado?: string;
  versaoFormula: string;
}

const num = (v: number | null | undefined, sufixo = "") =>
  v === null || v === undefined ? "—" : `${String(v).replace(".", ",")}${sufixo}`;

function Indicador({
  titulo,
  valor,
  descricao,
  icone,
  cor,
}: {
  titulo: string;
  valor: string;
  descricao: string;
  icone: React.ReactNode;
  cor: string;
}) {
  return (
    <div className="rounded-xl border border-borda bg-superficie p-5 shadow-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-texto-suave">{titulo}</span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${cor}`}
          aria-hidden="true"
        >
          {icone}
        </span>
      </div>
      <div className="text-2xl font-black text-texto tabular-nums">{valor}</div>
      <div className="text-[11px] text-texto-suave">{descricao}</div>
    </div>
  );
}

export function PainelDesempenho({
  recortes,
  perfilAtual,
  evolucao,
  polos = [],
  poloSelecionado = "todos",
  versaoFormula,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [carregando, startTransition] = useTransition();
  const [indice, setIndice] = useState(0);
  const [mostrarFormula, setMostrarFormula] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const ehAdmin = perfilAtual.papel === "admin";
  const recorte = recortes[indice] ?? recortes[0]!;
  const eu = perfilAtual.id.toLowerCase();
  const meu = recorte.linhas.find((l) => l.usuario_id === eu);
  const elegiveis = recorte.linhas.filter((l) => l.elegivel);
  const podio = elegiveis.slice(0, 3);
  const acima =
    meu?.posicao && meu.posicao > 1
      ? elegiveis.filter((l) => (l.posicao ?? 0) < meu.posicao!).at(-1)
      : undefined;

  const mudarPolo = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor !== "todos") params.set("polo_id", valor);
    else params.delete("polo_id");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };
  const opcoesPolo: CustomSelectOption[] = [
    ...(ehAdmin ? [{ value: "todos", label: "Todos os polos (consolidado)" }] : []),
    ...polos.map((p) => ({ value: p.id, label: `${p.nome} (${p.cidade})` })),
  ];
  const ref = ehAdmin ? recorte.equipe.media_pontos : (meu?.pontos_total ?? null);
  const progresso = Math.round(ref ?? 0);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto" aria-busy={carregando}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-texto">
            Acompanhamento de Desempenho
          </h1>
          <p className="text-xs sm:text-sm text-texto-suave mt-0.5">
            {recorte.rotulo} ({formatarDataCivil(recorte.periodo.inicio)} a{" "}
            {formatarDataCivil(recorte.periodo.fim)}) · chamados finalizados no período
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {ehAdmin ? (
            <div className="w-56">
              <CustomSelect options={opcoesPolo} value={poloSelecionado} onChange={mudarPolo} />
            </div>
          ) : (
            <span className="rounded-lg border border-borda bg-superficie px-3 py-1.5 text-xs font-semibold text-texto">
              {polos[0]?.nome ?? perfilAtual.polo_nome ?? "Meu polo"}
            </span>
          )}
          <div
            role="group"
            aria-label="Recorte"
            className="flex items-center gap-1.5 rounded-xl border border-borda bg-superficie p-1 shadow-xs"
          >
            {recortes.map((r, i) => (
              <button
                key={r.rotulo}
                type="button"
                aria-pressed={i === indice}
                onClick={() => setIndice(i)}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${i === indice ? "bg-[#1D4ED8] text-white shadow-xs" : "text-texto-suave hover:text-texto"}`}
              >
                {r.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-texto-suave">
            Operador: {perfilAtual.nome_completo}
          </span>
          {ehAdmin ? (
            <>
              <h2 className="text-xl font-bold text-texto">Painel gerencial de desempenho</h2>
              <p className="text-xs text-texto-suave">Administradores não participam do ranking.</p>
            </>
          ) : meu?.elegivel ? (
            <>
              <h2 className="text-2xl font-black text-texto">{meu.posicao}º lugar no ranking</h2>
              <p className="text-xs text-texto-suave">
                {meu.posicao === 1
                  ? "Você está na 1ª colocação do período."
                  : acima
                    ? `${num(Math.round(((acima.pontos_total ?? 0) - (meu.pontos_total ?? 0)) * 10) / 10)} pts abaixo de ${acima.nome_completo.split(" ")[0]}.`
                    : ""}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-texto">Sem classificação neste período</h2>
              <p className="text-xs text-texto-suave">
                A classificação considera chamados resolvidos ou encerrados no período.
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMostrarFormula(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-borda bg-fundo px-3.5 py-2 text-xs font-semibold text-texto hover:bg-superficie"
        >
          <Info className="h-4 w-4 text-sky-500" aria-hidden="true" /> Critérios de pontuação
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo={ehAdmin ? "Média da equipe" : "Pontuação total"}
          valor={`${num(ref)} pts`}
          descricao={
            ehAdmin
              ? `Média simples das notas de ${recorte.equipe.participantes_elegiveis} participante(s)`
              : meu?.elegivel
                ? `Volume ${num(meu.pontos.volume)} + Prazo ${num(meu.pontos.prazo)} + Agilidade ${num(meu.pontos.agilidade)}`
                : "Sem chamados finalizados no período"
          }
          icone={<Zap className="h-4 w-4" />}
          cor="bg-blue-500/10 text-[#1D4ED8]"
        />
        <Indicador
          titulo={ehAdmin ? "Resolvidos (equipe)" : "Resolvidos"}
          valor={String(ehAdmin ? recorte.equipe.resolvidos : (meu?.resolvidos ?? 0))}
          descricao={
            ehAdmin
              ? "Soma dos resolvidos no período"
              : `${meu?.encerrados ?? 0} encerrado(s) sem solução · ${meu?.pendentes ?? 0} pendente(s) agora`
          }
          icone={<CheckCheck className="h-4 w-4" />}
          cor="bg-emerald-500/10 text-emerald-600"
        />
        <Indicador
          titulo="Cumprimento do prazo"
          valor={num(ehAdmin ? recorte.equipe.taxa_prazo : meu?.taxa_prazo, "%")}
          descricao={
            ehAdmin
              ? `${recorte.equipe.no_prazo} de ${recorte.equipe.resolvidos} resolvidos no prazo (ponderado por chamado)`
              : `${meu?.no_prazo ?? 0} de ${meu?.resolvidos ?? 0} resolvidos no prazo · meta 90%`
          }
          icone={<Target className="h-4 w-4" />}
          cor="bg-amber-500/10 text-amber-600"
        />
        <Indicador
          titulo="Tempo médio"
          valor={num(
            ehAdmin ? recorte.equipe.tempo_medio_dias_uteis : meu?.tempo_medio_dias_uteis,
            " d.ú."
          )}
          descricao="Dias úteis da abertura à resolução (mesma regra do prazo)"
          icone={<Clock className="h-4 w-4" />}
          cor="bg-purple-500/10 text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section
          className="lg:col-span-2 rounded-2xl border border-borda bg-superficie p-6 shadow-xs space-y-4"
          aria-labelledby="titulo-destaques"
        >
          <div className="flex items-center justify-between border-b border-borda pb-3">
            <h2
              id="titulo-destaques"
              className="text-sm font-bold text-texto flex items-center gap-2"
            >
              <Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" /> Destaques
            </h2>
            <span className="text-xs text-texto-suave">{recorte.rotulo}</span>
          </div>
          {podio.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-borda bg-fundo p-8 text-center space-y-2">
              <BarChart3 className="h-8 w-8 text-texto-suave" aria-hidden="true" />
              <h3 className="text-sm font-bold text-texto">
                Nenhum chamado finalizado no período.
              </h3>
              <Link
                href="/chamados?situacao=pendentes"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                Ver pendências <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {podio.map((p) => (
                <li
                  key={p.usuario_id}
                  className={`rounded-xl border p-4 text-center space-y-1 ${p.posicao === 1 ? "border-amber-500/40 bg-amber-500/5" : "border-borda bg-fundo"}`}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white font-black text-xs">
                    {p.posicao}º
                  </span>
                  <span className="text-xs font-bold text-texto block truncate">
                    {p.nome_completo}
                  </span>
                  <span className="text-lg font-black text-texto tabular-nums block">
                    {num(p.pontos_total)} pts
                  </span>
                  <span className="text-[11px] text-texto-suave block">
                    {p.resolvidos} resolvidos · {num(p.taxa_prazo, "%")} no prazo
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-borda bg-superficie p-6 shadow-xs flex flex-col justify-between space-y-4">
          <h2 className="text-sm font-bold text-texto border-b border-borda pb-3">
            {ehAdmin ? "Média da equipe" : "Sua nota no período"}
          </h2>
          <div className="flex flex-col items-center py-2 space-y-3">
            <div
              className="relative h-28 w-28 flex items-center justify-center"
              role="img"
              aria-label={`${num(ref)} de 100 pontos`}
            >
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
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
                  className="stroke-[#1D4ED8]"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * Math.min(100, progresso)) / 100}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <span className="absolute text-xl font-black text-texto tabular-nums">
                {num(ref)}
              </span>
            </div>
            <span className="text-xs text-texto-suave">de 100 pontos possíveis</span>
          </div>
          <button
            type="button"
            onClick={() => setMostrarFormula(true)}
            className="text-xs font-semibold text-[#1D4ED8] hover:underline"
          >
            Como a nota é calculada
          </button>
        </section>
      </div>

      <section
        className="rounded-2xl border border-borda bg-superficie shadow-xs overflow-hidden"
        aria-labelledby="titulo-classificacao"
      >
        <div className="px-6 py-4 border-b border-borda">
          <h2 id="titulo-classificacao" className="text-sm font-bold text-texto">
            Classificação da equipe
          </h2>
          <p className="text-[11px] text-texto-suave">
            Clique em uma linha para ver os componentes da nota e os chamados considerados. Quem não
            finalizou chamados no período aparece sem nota.
          </p>
        </div>
        <div className="tabela-scroll overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-fundo border-b border-borda text-texto-suave font-semibold">
              <tr>
                <th scope="col" className="py-3 px-4 w-12 text-center">
                  Pos.
                </th>
                <th scope="col" className="py-3 px-4">
                  Operador
                </th>
                <th scope="col" className="py-3 px-4 text-center">
                  Resolvidos
                </th>
                <th scope="col" className="py-3 px-4 text-center">
                  Encerrados
                </th>
                <th scope="col" className="py-3 px-4 text-center">
                  No prazo
                </th>
                <th scope="col" className="py-3 px-4 text-center">
                  Tempo médio
                </th>
                <th scope="col" className="py-3 px-4 text-right">
                  Nota
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {recorte.linhas.map((l) => {
                const sou = l.usuario_id === eu;
                const expandido = aberto === l.usuario_id;
                return (
                  <Fragment key={l.usuario_id}>
                    <tr className={sou ? "bg-blue-500/5 font-semibold" : "hover:bg-fundo/50"}>
                      <td className="py-3 px-4 text-center font-bold text-texto-suave">
                        {l.posicao ? `${l.posicao}º` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          aria-expanded={expandido}
                          onClick={() => setAberto(expandido ? null : l.usuario_id)}
                          className="flex items-center gap-1.5 text-left text-texto hover:text-acento"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${expandido ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                          {l.nome_completo}
                          {sou && (
                            <span className="rounded bg-[#1D4ED8] px-1.5 text-[10px] font-bold text-white">
                              Você
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums">{l.resolvidos}</td>
                      <td className="py-3 px-4 text-center tabular-nums">{l.encerrados}</td>
                      <td className="py-3 px-4 text-center tabular-nums">
                        {l.resolvidos > 0 ? `${l.no_prazo} (${num(l.taxa_prazo, "%")})` : "—"}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums">
                        {num(l.tempo_medio_dias_uteis, " d.ú.")}
                      </td>
                      <td className="py-3 px-4 text-right font-black tabular-nums">
                        {l.elegivel ? num(l.pontos_total) : "sem nota"}
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="bg-fundo/60">
                        <td colSpan={7} className="px-6 py-3 text-[11px] text-texto">
                          {l.elegivel ? (
                            <div className="flex flex-wrap gap-x-6 gap-y-1">
                              <span>
                                Volume: {num(l.volume_ponderado)} ponderado ({l.resolvidos} × 1 +{" "}
                                {l.encerrados} × 0,5) → <strong>{num(l.pontos.volume)}</strong> / 40
                              </span>
                              <span>
                                Prazo: {l.no_prazo}/{l.resolvidos} no prazo →{" "}
                                <strong>{num(l.pontos.prazo)}</strong> / 40
                              </span>
                              <span>
                                Agilidade: média {num(l.tempo_medio_dias_uteis)} d.ú. →{" "}
                                <strong>{num(l.pontos.agilidade)}</strong> / 20
                              </span>
                              <span>
                                Total: <strong>{num(l.pontos_total)}</strong>
                              </span>
                            </div>
                          ) : (
                            <span>
                              Sem chamados finalizados no período ({l.pendentes} pendente(s) agora).
                            </span>
                          )}
                          <Link
                            href={recorte.links[l.usuario_id] ?? "/chamados"}
                            className="mt-1 inline-flex items-center gap-1 font-semibold text-acento hover:underline"
                          >
                            Ver os {l.resolvidos + l.encerrados} chamado(s) considerados{" "}
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-borda bg-superficie p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-texto border-b border-borda pb-3">
          {ehAdmin
            ? "Média da equipe (últimos 6 meses)"
            : "Sua nota x média da equipe (últimos 6 meses)"}
        </h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} domain={[0, 100]} />
              <Tooltip
                formatter={(v) => (v === null ? "sem nota" : `${String(v).replace(".", ",")} pts`)}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {!ehAdmin && (
                <Line
                  type="monotone"
                  dataKey="minhaPontuacao"
                  name="Sua nota"
                  stroke="#1D4ED8"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              )}
              <Line
                type="monotone"
                dataKey="mediaEquipe"
                name="Média da equipe"
                stroke={ehAdmin ? "#1D4ED8" : "#94a3b8"}
                strokeWidth={2}
                strokeDasharray={ehAdmin ? undefined : "4 4"}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {mostrarFormula && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onKeyDown={(e) => e.key === "Escape" && setMostrarFormula(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-formula"
            className="w-full max-w-lg rounded-2xl border border-borda bg-superficie p-6 shadow-2xl space-y-4 text-texto"
          >
            <div className="flex items-center justify-between border-b border-borda pb-3">
              <h3 id="titulo-formula" className="text-base font-bold">
                Critérios de avaliação (versão {versaoFormula})
              </h3>
              <button
                type="button"
                onClick={() => setMostrarFormula(false)}
                className="rounded-lg p-1.5 text-texto-suave hover:bg-fundo"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-texto-suave leading-relaxed">
              <p>
                Nota de 0 a 100 = soma de três componentes. Considera os chamados{" "}
                <strong>resolvidos ou encerrados no período</strong>, atribuídos ao responsável
                atual. Chamados de teste e importados de planilha não contam.
              </p>
              <div className="rounded-xl border border-borda bg-fundo p-3 space-y-1">
                <div className="flex justify-between font-bold text-texto">
                  <span>1. Volume</span>
                  <span>até {PESOS.volumeMaximo} pontos</span>
                </div>
                <p className="text-[11px]">
                  Volume ponderado (resolvido = {PESOS.pesoResolvido}; encerrado sem solução ={" "}
                  {String(PESOS.pesoEncerrado).replace(".", ",")}) em proporção ao maior volume da
                  equipe no mesmo período: quem tem o maior volume recebe {PESOS.volumeMaximo}.
                </p>
              </div>
              <div className="rounded-xl border border-borda bg-fundo p-3 space-y-1">
                <div className="flex justify-between font-bold text-texto">
                  <span>2. Cumprimento do prazo</span>
                  <span>até {PESOS.prazoMaximo} pontos</span>
                </div>
                <p className="text-[11px]">
                  Proporção de resolvidos cujo dia de conclusão foi até o prazo (
                  {REGRA_SLA.diasUteisPadrao} dias úteis, salvo ajuste justificado).
                </p>
              </div>
              <div className="rounded-xl border border-borda bg-fundo p-3 space-y-1">
                <div className="flex justify-between font-bold text-texto">
                  <span>3. Agilidade</span>
                  <span>até {PESOS.agilidadeMaxima} pontos</span>
                </div>
                <p className="text-[11px]">
                  Tempo médio em dias úteis até a resolução:{" "}
                  {PESOS.faixasAgilidade
                    .map((f) => `até ${f.ateDiasUteis} → ${f.pontos} pts`)
                    .join("; ")}
                  ; acima → {PESOS.pontosAgilidadeAcimaDasFaixas} pts. Sem resolvidos → 0.
                </p>
              </div>
              <p className="text-[11px]">
                Média da equipe: média simples das notas de quem finalizou chamados no período. Taxa
                de prazo e tempo médio da equipe são ponderados por chamado.
              </p>
            </div>
            <div className="text-right">
              <button
                type="button"
                onClick={() => setMostrarFormula(false)}
                className="rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-bold text-white"
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
