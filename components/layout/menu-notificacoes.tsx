"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Building2,
  Tag,
} from "lucide-react";
import { formatarDataCivil } from "@/lib/datas";
import { type DadosNotificacoesPrazos } from "@/lib/chamados/notificacoes";
import { obterNotificacoesPrazosAction } from "./actions";

interface MenuNotificacoesProps {
  notificacoesIniciais: DadosNotificacoesPrazos;
  aoAbrirOutroMenu?: () => void;
  posicao?: "header" | "sidebar";
}

export function MenuNotificacoes({
  notificacoesIniciais,
  aoAbrirOutroMenu,
  posicao = "header",
}: MenuNotificacoesProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<DadosNotificacoesPrazos>(notificacoesIniciais);
  const [filtro, setFiltro] = useState<"todos" | "vencidos" | "vencendo">("todos");
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Atualiza se as props iniciais mudarem (ex: navegação de página)
  useEffect(() => {
    setDados(notificacoesIniciais);
  }, [notificacoesIniciais]);

  // Fechar ao clicar fora ou pressionar ESC
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };

    document.addEventListener("mousedown", handleClickFora);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickFora);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const carregarAtualizado = () => {
    startTransition(async () => {
      try {
        const novos = await obterNotificacoesPrazosAction();
        setDados(novos);
      } catch (err) {
        console.error("Falha ao atualizar notificações:", err);
      }
    });
  };

  const alternarMenu = () => {
    const proximoEstado = !aberto;
    if (proximoEstado) {
      aoAbrirOutroMenu?.();
      carregarAtualizado();
    }
    setAberto(proximoEstado);
  };

  const itensFiltrados = dados.itens.filter((item) => {
    if (filtro === "vencidos") return item.statusPrazo === "vencido";
    if (filtro === "vencendo") return item.statusPrazo !== "vencido";
    return true;
  });

  // Prazo é uma data civil (sem hora): exibido sem conversão de fuso
  const formatarDataPrazo = (dataCivil: string) => formatarDataCivil(dataCivil);

  return (
    <div className="relative" ref={containerRef}>
      {/* Botão de Notificação */}
      <button
        type="button"
        onClick={alternarMenu}
        className={`btn-tátil relative rounded-xl border p-2 transition shadow-xs ${
          posicao === "sidebar"
            ? aberto
              ? "border-sky-500 bg-sky-950/60 text-white ring-2 ring-sky-500/30"
              : "border-[#1E293B] bg-[#0A1128] text-slate-300 hover:text-white hover:border-slate-600 hover:bg-white/5"
            : aberto
              ? "border-acento bg-superficie text-texto ring-2 ring-acento/20"
              : "border-borda bg-fundo text-texto-suave hover:text-texto hover:bg-superficie"
        }`}
        title="Notificações de prazos e SLA"
        aria-label="Notificações de prazos e SLA"
        aria-expanded={aberto}
      >
        <Bell className="h-4 w-4" />

        {/* Badge Numérico Dinâmico */}
        {dados.totalCriticos > 0 ? (
          <span
            className={`absolute -top-1.5 -right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[9px] font-black text-white shadow-xs ring-2 ${
              posicao === "sidebar" ? "ring-[#070D1E]" : "ring-superficie"
            } ${dados.vencidos > 0 ? "bg-rose-600 animate-pulse" : "bg-amber-600"}`}
          >
            {dados.totalCriticos > 9 ? "9+" : dados.totalCriticos}
          </span>
        ) : null}
      </button>

      {/* Dropdown de Notificações */}
      {aberto && (
        <div
          className={`absolute w-80 sm:w-96 rounded-2xl border border-borda bg-superficie p-0 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden ${
            posicao === "sidebar" ? "left-full top-0 ml-3" : "right-0 top-full mt-2"
          }`}
        >
          {/* Topo do Menu */}
          <div className="flex items-center justify-between border-b border-borda px-4 py-3 bg-fundo/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-rose-500" />
                <h3 className="text-xs font-bold text-texto uppercase tracking-wider">
                  Central de Prazos
                </h3>
              </div>
              <p className="text-[11px] text-texto-suave mt-0.5">
                {dados.totalCriticos === 0 ? (
                  "Todos os chamados estão em dia"
                ) : (
                  <>
                    <strong className="text-rose-600 dark:text-rose-400 font-semibold">
                      {dados.vencidos} vencido{dados.vencidos === 1 ? "" : "s"}
                    </strong>
                    {" e "}
                    <strong className="text-amber-600 dark:text-amber-400 font-semibold">
                      {dados.vencendoBreve} a vencer
                    </strong>
                  </>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={carregarAtualizado}
              disabled={isPending}
              className="rounded-lg p-1.5 text-texto-suave hover:text-texto hover:bg-superficie border border-borda/60 transition disabled:opacity-50"
              title="Recarregar notificações"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin text-acento" : ""}`} />
            </button>
          </div>

          {/* Abas / Filtros rápidos se houver chamados */}
          {dados.totalCriticos > 0 && (
            <div className="flex items-center gap-1 px-3 py-2 border-b border-borda bg-superficie text-xs">
              <button
                type="button"
                onClick={() => setFiltro("todos")}
                className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition ${
                  filtro === "todos"
                    ? "bg-fundo text-texto font-bold shadow-xs border border-borda"
                    : "text-texto-suave hover:text-texto"
                }`}
              >
                Todos ({dados.totalCriticos})
              </button>
              <button
                type="button"
                onClick={() => setFiltro("vencidos")}
                className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition flex items-center gap-1 ${
                  filtro === "vencidos"
                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-900"
                    : "text-texto-suave hover:text-rose-600"
                }`}
              >
                Vencidos ({dados.vencidos})
              </button>
              <button
                type="button"
                onClick={() => setFiltro("vencendo")}
                className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition flex items-center gap-1 ${
                  filtro === "vencendo"
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-900"
                    : "text-texto-suave hover:text-amber-600"
                }`}
              >
                A vencer ({dados.vencendoBreve})
              </button>
            </div>
          )}

          {/* Lista de Chamados Notificados */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-borda/40">
            {itensFiltrados.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h4 className="text-xs font-bold text-texto">
                  {filtro === "todos"
                    ? "Tudo em dia!"
                    : filtro === "vencidos"
                      ? "Nenhum chamado vencido!"
                      : "Nenhum chamado a vencer nos próximos dias!"}
                </h4>
                <p className="text-[11px] text-texto-suave mt-1 max-w-[220px] mx-auto">
                  Não há chamados críticos nesta categoria no momento.
                </p>
              </div>
            ) : (
              itensFiltrados.map((item) => {
                const ehVencido = item.statusPrazo === "vencido";
                const ehHoje = item.statusPrazo === "vence_hoje";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setAberto(false);
                      router.push(`/chamados/${item.id}`);
                    }}
                    className={`w-full text-left p-3 transition hover:bg-fundo/80 flex items-start gap-3 border-l-4 ${
                      ehVencido
                        ? "border-l-rose-500 bg-rose-50/20 dark:bg-rose-950/10"
                        : ehHoje
                          ? "border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/10"
                          : "border-l-sky-500 bg-sky-50/20 dark:bg-sky-950/10"
                    }`}
                  >
                    <div className="mt-0.5">
                      {ehVencido ? (
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Clock className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Linha 1: Protocolo + Tag de Status de Prazo */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono text-xs font-bold text-texto">
                          #{item.protocolo}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            ehVencido
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                              : ehHoje
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                          }`}
                        >
                          {item.rotuloPrazo}
                        </span>
                      </div>

                      {/* Linha 2: Aluno */}
                      <p className="text-xs font-semibold text-texto truncate mb-1">
                        {item.aluno_nome}
                      </p>

                      {/* Linha 3: Detalhes complementares */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-texto-suave">
                        {item.motivo_nome && (
                          <span className="flex items-center gap-1 truncate max-w-[140px]">
                            <Tag className="h-2.5 w-2.5 text-texto-suave" />
                            {item.motivo_nome}
                          </span>
                        )}
                        {item.polo_nome && (
                          <span className="flex items-center gap-1 truncate max-w-[120px]">
                            <Building2 className="h-2.5 w-2.5 text-texto-suave" />
                            {item.polo_nome}
                          </span>
                        )}
                      </div>

                      {/* Linha 4: Data exata do prazo */}
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-texto-suave">
                        <Clock className="h-2.5 w-2.5" />
                        <span>Prazo: {formatarDataPrazo(item.prazo)}</span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-texto-suave/60 mt-1 shrink-0" />
                  </button>
                );
              })
            )}
          </div>

          {/* Rodapé: Link para todos os chamados em aberto */}
          <div className="border-t border-borda bg-fundo/40 p-2.5 text-center">
            <Link
              href="/chamados?situacao=aguardando"
              onClick={() => setAberto(false)}
              className="text-xs font-bold text-acento hover:underline inline-flex items-center gap-1"
            >
              <span>Ver todos os chamados aguardando</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
