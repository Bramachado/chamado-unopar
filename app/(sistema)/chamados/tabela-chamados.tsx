"use client";

import { useState, useTransition, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { type Chamado, type Motivo, type Perfil, type Polo } from "@/types/database";
import {
  Eye,
  Edit,
  Trash2,
  Search,
  Download,
  Plus,
  Users,
  User,
  Filter,
  AlertOctagon,
  Clock,
  CalendarClock,
  Inbox,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { excluirChamadoAction } from "./actions";
import { formatarDataCivil, hojeCivil, diferencaDiasCorridos } from "@/lib/datas";
import { classificarPrazo } from "@/lib/sla";
import { ROTULO_SITUACAO, SITUACOES, ehPendente } from "@/lib/chamados/situacoes";
import { filtrosParaQuery, type FiltrosChamados } from "@/lib/chamados/filtros-comuns";
import { SituacaoBadge } from "@/components/ui/situacao-badge";
import { CpfDisplay } from "@/components/ui/cpf-display";
import { formatarTelefone } from "@/lib/utils/telefone";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";
import { CustomCheckbox } from "@/components/ui/custom-checkbox";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { FiltroColunaExcel } from "@/components/ui/filtro-coluna-excel";

export type TipoFiltroPrazo = "todos" | "vencidos" | "vence_hoje" | "vence_em_breve" | "pendentes";

export interface InfoPrazo {
  tipo: "vencido" | "vence_hoje" | "vence_em_breve" | "no_prazo" | "finalizado";
  dias: number | null;
  textoBadge: string;
  subtexto: string;
  badgeClasse: string;
  bordaTabela: string;
  bgLinha: string;
}

/** Classificação visual do prazo pela regra única (lib/sla), sobre datas civis e sem fuso. */
export function obterInfoPrazo(prazo: string, situacao: string, hojeRef?: string): InfoPrazo {
  if (!ehPendente(situacao)) {
    return {
      tipo: "finalizado",
      dias: null,
      textoBadge: "Finalizado",
      subtexto: "",
      badgeClasse:
        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      bordaTabela: "",
      bgLinha: "",
    };
  }

  const hoje = hojeRef ?? hojeCivil();
  const diff = diferencaDiasCorridos(hoje, prazo);
  const classe = classificarPrazo(prazo, hoje);

  if (classe === "vencido") {
    const diasAtras = Math.abs(diff);
    return {
      tipo: "vencido",
      dias: diff,
      textoBadge: diasAtras === 1 ? "Vencido ontem" : `Vencido há ${diasAtras}d`,
      subtexto: "Prazo expirado",
      badgeClasse:
        "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800 animate-pulse",
      bordaTabela: "border-l-4 border-l-rose-600",
      bgLinha: "bg-rose-50/30 hover:bg-rose-50/50 dark:bg-rose-950/20",
    };
  }

  if (classe === "vence_hoje") {
    return {
      tipo: "vence_hoje",
      dias: 0,
      textoBadge: "Vence hoje!",
      subtexto: "Atenção máxima",
      badgeClasse:
        "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800 font-bold",
      bordaTabela: "border-l-4 border-l-rose-500",
      bgLinha: "bg-rose-50/20 hover:bg-rose-50/40 dark:bg-rose-950/15",
    };
  }

  if (classe === "vence_em_breve") {
    return {
      tipo: "vence_em_breve",
      dias: diff,
      textoBadge: diff === 1 ? "Vence amanhã (1d)" : "Faltam 2 dias",
      subtexto: "Prazo próximo",
      badgeClasse:
        "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800",
      bordaTabela: "border-l-4 border-l-amber-500",
      bgLinha: "bg-amber-50/20 hover:bg-amber-50/40 dark:bg-amber-950/15",
    };
  }

  return {
    tipo: "no_prazo",
    dias: diff,
    textoBadge: `Em ${diff} dias`,
    subtexto: "No prazo",
    badgeClasse:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    bordaTabela: "",
    bgLinha: "",
  };
}

interface TabelaChamadosProps {
  chamados: (Chamado & { motivo_codigo?: string | null; motivo_nome?: string | null })[];
  motivos: Motivo[];
  polos?: Polo[];
  perfilAtual: Perfil;
  filtros: FiltrosChamados;
  resumo: { pendentes: number; vencidos: number; vence_hoje: number; vence_em_breve: number };
  paginacao: { pagina: number; porPagina: number; total: number };
}

export function TabelaChamados({
  chamados,
  motivos,
  polos = [],
  perfilAtual,
  filtros,
  resumo,
  paginacao,
}: TabelaChamadosProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const ehAdmin = perfilAtual.papel === "admin";
  const [escopo, setEscopo] = useState<string>(filtros.escopo);

  // Estados locais dos filtros
  const [busca, setBusca] = useState(filtros.busca || "");
  const [situacao, setSituacao] = useState(filtros.situacao || "todos");
  const [prioridade, setPrioridade] = useState(filtros.prioridade || "todos");
  const [motivoId, setMotivoId] = useState(filtros.motivo_id || "todos");
  const [poloId, setPoloId] = useState(filtros.polo_id || "todos");
  const [dataInicio, setDataInicio] = useState(filtros.abertura_de || "");
  const [dataFim, setDataFim] = useState(filtros.abertura_ate || "");
  const [apenasReincidentes, setApenasReincidentes] = useState(!!filtros.reincidentes);
  const [filtroPrazo, setFiltroPrazo] = useState<TipoFiltroPrazo>(
    filtros.situacao === "pendentes" && !filtros.filtro_prazo
      ? "pendentes"
      : (filtros.filtro_prazo as TipoFiltroPrazo) || "todos"
  );

  // Estado do modal de confirmação de exclusão
  const [chamadoExcluir, setChamadoExcluir] = useState<Chamado | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const hoje = hojeCivil();
  const urlAtual = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const comVolta = (url: string) => `${url}?voltar=${encodeURIComponent(urlAtual)}`;

  // Contadores calculados no servidor sobre TODOS os chamados dos filtros (não só a página)
  const totalVencidos = resumo.vencidos;
  const totalVenceHoje = resumo.vence_hoje;
  const totalVence2Dias = resumo.vence_em_breve;
  const totalPendentes = resumo.pendentes;

  // Opções formatadas para os CustomSelects
  const opcoesSituacao: CustomSelectOption[] = [
    { value: "todos", label: "Todas as situações" },
    { value: "pendentes", label: "Todas as pendentes" },
    { value: "finalizados", label: "Todas as finalizadas" },
    ...SITUACOES.map((s) => ({ value: s, label: ROTULO_SITUACAO[s] })),
  ];

  const opcoesPrioridade: CustomSelectOption[] = [
    { value: "todos", label: "Todas as prioridades" },
    { value: "normal", label: "Normal" },
    { value: "priorizar", label: "Priorizar" },
  ];

  const opcoesMotivo: CustomSelectOption[] = [
    { value: "todos", label: "Todos os motivos" },
    ...motivos.map((m) => ({
      value: m.id,
      label: `${m.codigo} — ${m.nome}`,
    })),
  ];

  const opcoesPolo: CustomSelectOption[] =
    !ehAdmin && perfilAtual.polo_id && polos.length <= 1
      ? polos.map((p) => ({
          value: p.id,
          label: `${p.nome} (${p.cidade})`,
        }))
      : [
          { value: "todos", label: "Todos os polos (Geral)" },
          ...polos.map((p) => ({
            value: p.id,
            label: `${p.nome} (${p.cidade})`,
          })),
        ];

  // Reincidência e prazo são filtrados no servidor (mesma regra da exportação)
  const chamadosFiltrados = chamados;

  // Estado para filtros estilo Excel em colunas específicas
  const [filtrosExcel, setFiltrosExcel] = useState<{
    protocolo?: Set<string>;
    aluno?: Set<string>;
    polo?: Set<string>;
    contato?: Set<string>;
    motivo?: Set<string>;
  }>({});

  // Listas de valores únicos com contagens para os filtros estilo Excel
  const itensProtocolo = useMemo(() => {
    const contagem: Record<string, number> = {};
    chamadosFiltrados.forEach((c) => {
      const val = c.protocolo?.trim();
      if (val) contagem[val] = (contagem[val] || 0) + 1;
    });
    return Object.entries(contagem)
      .map(([valor, cont]) => ({ valor, contagem: cont }))
      .sort((a, b) => a.valor.localeCompare(b.valor));
  }, [chamadosFiltrados]);

  const itensAluno = useMemo(() => {
    const contagem: Record<string, number> = {};
    chamadosFiltrados.forEach((c) => {
      const val = c.aluno_nome?.trim();
      if (val) contagem[val] = (contagem[val] || 0) + 1;
    });
    return Object.entries(contagem)
      .map(([valor, cont]) => ({ valor, contagem: cont }))
      .sort((a, b) => a.valor.localeCompare(b.valor));
  }, [chamadosFiltrados]);

  const itensPolo = useMemo(() => {
    const contagem: Record<string, number> = {};
    chamadosFiltrados.forEach((c) => {
      const val = (c.polo_nome || c.polo_cidade || "Sem polo").trim();
      contagem[val] = (contagem[val] || 0) + 1;
    });
    return Object.entries(contagem)
      .map(([valor, cont]) => ({ valor, contagem: cont }))
      .sort((a, b) => a.valor.localeCompare(b.valor));
  }, [chamadosFiltrados]);

  const itensContato = useMemo(() => {
    const contagem: Record<string, number> = {};
    chamadosFiltrados.forEach((c) => {
      const val = (c.contato_telefone || "Não informado").trim();
      contagem[val] = (contagem[val] || 0) + 1;
    });
    return Object.entries(contagem)
      .map(([valor, cont]) => ({ valor, contagem: cont }))
      .sort((a, b) => a.valor.localeCompare(b.valor));
  }, [chamadosFiltrados]);

  const itensMotivo = useMemo(() => {
    const contagem: Record<string, number> = {};
    chamadosFiltrados.forEach((c) => {
      const val = c.motivo_codigo ? `${c.motivo_codigo} — ${c.motivo_nome}`.trim() : "Outros";
      contagem[val] = (contagem[val] || 0) + 1;
    });
    return Object.entries(contagem)
      .map(([valor, cont]) => ({ valor, contagem: cont }))
      .sort((a, b) => a.valor.localeCompare(b.valor));
  }, [chamadosFiltrados]);

  // Lista final combinada com filtros rápidos + filtros estilo Excel
  const chamadosExibicao = useMemo(() => {
    return chamadosFiltrados.filter((c) => {
      if (filtrosExcel.protocolo && filtrosExcel.protocolo.size > 0) {
        if (!c.protocolo || !filtrosExcel.protocolo.has(c.protocolo.trim())) return false;
      }
      if (filtrosExcel.aluno && filtrosExcel.aluno.size > 0) {
        if (!c.aluno_nome || !filtrosExcel.aluno.has(c.aluno_nome.trim())) return false;
      }
      if (filtrosExcel.polo && filtrosExcel.polo.size > 0) {
        const val = (c.polo_nome || c.polo_cidade || "Sem polo").trim();
        if (!filtrosExcel.polo.has(val)) return false;
      }
      if (filtrosExcel.contato && filtrosExcel.contato.size > 0) {
        const val = (c.contato_telefone || "Não informado").trim();
        if (!filtrosExcel.contato.has(val)) return false;
      }
      if (filtrosExcel.motivo && filtrosExcel.motivo.size > 0) {
        const val = c.motivo_codigo ? `${c.motivo_codigo} — ${c.motivo_nome}`.trim() : "Outros";
        if (!filtrosExcel.motivo.has(val)) return false;
      }
      return true;
    });
  }, [chamadosFiltrados, filtrosExcel]);

  // Referências e estado de rolagem horizontal da tabela
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [podeRolarEsquerda, setPodeRolarEsquerda] = useState(false);
  const [podeRolarDireita, setPodeRolarDireita] = useState(false);

  const atualizarMetricasRolagem = useCallback(() => {
    if (!tableContainerRef.current) return;
    const { scrollLeft, scrollWidth: sw, clientWidth: cw } = tableContainerRef.current;
    setPodeRolarEsquerda(scrollLeft > 10);
    setPodeRolarDireita(scrollLeft + cw < sw - 10);
  }, []);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      atualizarMetricasRolagem();
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    atualizarMetricasRolagem();
    const timer = setTimeout(atualizarMetricasRolagem, 100);

    const resizeObserver = new ResizeObserver(() => {
      atualizarMetricasRolagem();
    });
    resizeObserver.observe(el);

    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [atualizarMetricasRolagem, chamadosExibicao.length]);

  const rolarTabela = (direcao: "esquerda" | "direita") => {
    if (!tableContainerRef.current) return;
    const delta = direcao === "esquerda" ? -350 : 350;
    tableContainerRef.current.scrollBy({ left: delta, behavior: "smooth" });
  };

  const alternarEscopo = (novoEscopo: "meus" | "todos") => {
    setEscopo(novoEscopo);
    const params = new URLSearchParams(searchParams.toString());
    params.set("escopo", novoEscopo);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const alternarFiltroPrazo = (novoFiltro: TipoFiltroPrazo) => {
    const proximo = filtroPrazo === novoFiltro ? "todos" : novoFiltro;
    setFiltroPrazo(proximo);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("pagina");
    params.delete("filtro_prazo");
    if (proximo === "pendentes") params.set("situacao", "pendentes");
    else if (params.get("situacao") === "pendentes") params.delete("situacao");
    if (proximo !== "todos" && proximo !== "pendentes") params.set("filtro_prazo", proximo);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const aplicarFiltros = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("escopo", escopo);

    if (busca.trim()) params.set("busca", busca.trim());
    else params.delete("busca");

    if (situacao !== "todos") params.set("situacao", situacao);
    else params.delete("situacao");

    if (prioridade !== "todos") params.set("prioridade", prioridade);
    else params.delete("prioridade");

    if (motivoId !== "todos") params.set("motivo_id", motivoId);
    else params.delete("motivo_id");

    if (poloId !== "todos") params.set("polo_id", poloId);
    else params.delete("polo_id");

    params.delete("data_inicio");
    params.delete("data_fim");
    params.delete("pagina");
    if (dataInicio) params.set("abertura_de", dataInicio);
    else params.delete("abertura_de");
    if (dataFim) params.set("abertura_ate", dataFim);
    else params.delete("abertura_ate");

    if (apenasReincidentes) params.set("reincidentes", "true");
    else params.delete("reincidentes");

    if (filtroPrazo !== "todos" && filtroPrazo !== "pendentes")
      params.set("filtro_prazo", filtroPrazo);
    else params.delete("filtro_prazo");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const limparFiltros = () => {
    setBusca("");
    setSituacao("todos");
    setPrioridade("todos");
    setMotivoId("todos");
    setPoloId("todos");
    setDataInicio("");
    setDataFim("");
    setApenasReincidentes(false);
    setFiltroPrazo("todos");
    setFiltrosExcel({});

    const padraoEscopo = ehAdmin ? "todos" : "meus";
    setEscopo(padraoEscopo);

    startTransition(() => {
      router.push(`${pathname}?escopo=${padraoEscopo}`);
    });
  };

  const totalPaginas = Math.max(1, Math.ceil(paginacao.total / paginacao.porPagina));
  const irParaPagina = (pg: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (pg > 1) params.set("pagina", String(pg));
    else params.delete("pagina");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const handleConfirmarExclusao = async () => {
    if (!chamadoExcluir) return;
    setMensagemErro(null);

    startTransition(async () => {
      const res = await excluirChamadoAction(chamadoExcluir.id);
      if (!res.sucesso) {
        setMensagemErro(res.erro || "Falha ao excluir chamado.");
      } else {
        setChamadoExcluir(null);
        router.refresh();
      }
    });
  };

  const formatarResponsavel = (nomeCompleto?: string) => {
    if (!nomeCompleto) return "—";
    const partes = nomeCompleto.trim().split(/\s+/);
    if (partes.length === 1) return partes[0];
    return `${partes[0]} ${partes[partes.length - 1]}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Cabeçalho Padronizado da Página e Ações de Topo */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 pb-3 border-b border-borda/40">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-texto">
            Gerenciamento de Chamados
          </h1>
          <p className="text-xs text-texto-suave mt-0.5">
            Controle de protocolos, solicitações acadêmicas e prazos de resolução.
          </p>
        </div>

        {/* Barra de Ações e Alternador de Escopo perfeitamente alinhados */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Alternador de Escopo (Meus Chamados vs Todos os Chamados) */}
          <div className="inline-flex h-9 items-center rounded-lg border border-borda bg-fundo p-1 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => alternarEscopo("meus")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold transition-all ${
                escopo === "meus"
                  ? "bg-acento text-white shadow-xs"
                  : "text-texto-suave hover:text-texto hover:bg-superficie/60"
              }`}
              title="Chamados sob sua responsabilidade"
            >
              <User className="h-3.5 w-3.5" />
              <span>Sob minha responsabilidade</span>
            </button>
            <button
              type="button"
              onClick={() => alternarEscopo("todos")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold transition-all ${
                escopo === "todos"
                  ? "bg-acento text-white shadow-xs"
                  : "text-texto-suave hover:text-texto hover:bg-superficie/60"
              }`}
              title="Todos os chamados que você pode ver"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Todos os Chamados</span>
            </button>
          </div>

          <Link
            href={`/chamados/exportar?${filtrosParaQuery({ ...filtros, pagina: 1 })}`}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo transition shadow-2xs shrink-0"
            title="Exporta todos os chamados destes filtros (não só a página)"
          >
            <Download className="h-3.5 w-3.5 text-texto-suave" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Link>

          <Link
            href={comVolta("/chamados/novo")}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover transition shadow-2xs shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Chamado</span>
          </Link>
        </div>
      </div>

      {/* 2.1. Painel de Visão Geral de Prazos e Chamados Críticos */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-texto-suave">
              Painel Operacional de Prazos
            </h2>
            {filtroPrazo !== "todos" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-acento/10 text-acento border border-acento/20">
                Filtro rápido ativo
              </span>
            )}
          </div>
          {filtroPrazo !== "todos" && (
            <button
              type="button"
              onClick={() => alternarFiltroPrazo("todos")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-acento hover:underline cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Limpar filtro de prazo (ver todos)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Prazos Vencidos */}
          <button
            type="button"
            onClick={() => alternarFiltroPrazo("vencidos")}
            className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
              filtroPrazo === "vencidos"
                ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40 ring-2 ring-rose-500 shadow-sm"
                : "border-rose-200/80 bg-rose-50/30 hover:bg-rose-50/70 hover:border-rose-300 dark:border-rose-900/40 dark:bg-rose-950/15 dark:hover:bg-rose-950/30"
            }`}
            title="Clique para filtrar apenas chamados com prazo estourado"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Prazos Vencidos</span>
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  totalVencidos > 0
                    ? "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100 animate-pulse"
                    : "bg-rose-100/60 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                }`}
              >
                Crítico
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between w-full">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-rose-700 dark:text-rose-300">
                {totalVencidos}
              </span>
              <span className="text-[11px] font-medium text-rose-600/90 dark:text-rose-400/90">
                {totalVencidos === 1 ? "chamado expirado" : "chamados expirados"}
              </span>
            </div>

            <div className="mt-2.5 pt-2 border-t border-rose-200/70 dark:border-rose-900/40 flex items-center justify-between text-[11px] text-rose-700 dark:text-rose-300">
              <span className="font-medium">
                {filtroPrazo === "vencidos" ? "✓ Filtro aplicado" : "Isolar chamados"}
              </span>
              <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </button>

          {/* Card 2: Vencem Hoje */}
          <button
            type="button"
            onClick={() => alternarFiltroPrazo("vence_hoje")}
            className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
              filtroPrazo === "vence_hoje"
                ? "border-orange-500 bg-orange-50 dark:bg-orange-950/40 ring-2 ring-orange-500 shadow-sm"
                : "border-orange-200/80 bg-orange-50/30 hover:bg-orange-50/70 hover:border-orange-300 dark:border-orange-900/40 dark:bg-orange-950/15 dark:hover:bg-orange-950/30"
            }`}
            title="Clique para filtrar apenas chamados que vencem hoje"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
                <span>Vencem Hoje</span>
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  totalVenceHoje > 0
                    ? "bg-orange-200 text-orange-900 dark:bg-orange-900 dark:text-orange-100"
                    : "bg-orange-100/60 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                }`}
              >
                Urgente
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between w-full">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-orange-700 dark:text-orange-300">
                {totalVenceHoje}
              </span>
              <span className="text-[11px] font-medium text-orange-600/90 dark:text-orange-400/90">
                expiram até 23:59
              </span>
            </div>

            <div className="mt-2.5 pt-2 border-t border-orange-200/70 dark:border-orange-900/40 flex items-center justify-between text-[11px] text-orange-700 dark:text-orange-300">
              <span className="font-medium">
                {filtroPrazo === "vence_hoje" ? "✓ Filtro aplicado" : "Isolar chamados"}
              </span>
              <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </button>

          {/* Card 3: Faltam 1 a 2 Dias */}
          <button
            type="button"
            onClick={() => alternarFiltroPrazo("vence_em_breve")}
            className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
              filtroPrazo === "vence_em_breve"
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-500 shadow-sm"
                : "border-amber-200/80 bg-amber-50/30 hover:bg-amber-50/70 hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-950/15 dark:hover:bg-amber-950/30"
            }`}
            title="Clique para filtrar chamados com prazo em até 2 dias"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Vencem em 1 a 2 dias</span>
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                Atenção
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between w-full">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-amber-700 dark:text-amber-300">
                {totalVence2Dias}
              </span>
              <span className="text-[11px] font-medium text-amber-600/90 dark:text-amber-400/90">
                dias corridos
              </span>
            </div>

            <div className="mt-2.5 pt-2 border-t border-amber-200/70 dark:border-amber-900/40 flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-300">
              <span className="font-medium">
                {filtroPrazo === "vence_em_breve" ? "✓ Filtro aplicado" : "Isolar chamados"}
              </span>
              <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </button>

          {/* Card 4: Total Pendentes */}
          <button
            type="button"
            onClick={() => alternarFiltroPrazo("pendentes")}
            className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
              filtroPrazo === "pendentes"
                ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40 ring-2 ring-sky-500 shadow-sm"
                : "border-sky-200/80 bg-sky-50/30 hover:bg-sky-50/70 hover:border-sky-300 dark:border-sky-900/40 dark:bg-sky-950/15 dark:hover:bg-sky-950/30"
            }`}
            title="Clique para filtrar todos os chamados em aberto"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                <Inbox className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Pendências (estoque)</span>
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400">
                Geral
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between w-full">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-sky-700 dark:text-sky-300">
                {totalPendentes}
              </span>
              <span className="text-[11px] font-medium text-sky-600/90 dark:text-sky-400/90">
                situações não finalizadas
              </span>
            </div>

            <div className="mt-2.5 pt-2 border-t border-sky-200/70 dark:border-sky-900/40 flex items-center justify-between text-[11px] text-sky-700 dark:text-sky-300">
              <span className="font-medium">
                {filtroPrazo === "pendentes" ? "✓ Filtro aplicado" : "Isolar chamados"}
              </span>
              <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Bloco de Filtros */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Busca Textual */}
          <div>
            <label className="block text-xs font-medium text-texto mb-1.5">
              Buscar (Protocolo, Aluno, CPF, RA)
            </label>
            <div className="relative">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") aplicarFiltros();
                }}
                placeholder="Protocolo, Nome, CPF ou RA..."
                className="w-full rounded-lg border border-borda bg-fundo pl-9 pr-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-texto-suave" />
            </div>
          </div>

          {/* Filtro de Polo */}
          <CustomSelect
            label="Polo"
            options={opcoesPolo}
            value={poloId}
            onChange={(val) => setPoloId(val)}
          />

          {/* Filtro Situação Customizado */}
          <CustomSelect
            label="Situação"
            options={opcoesSituacao}
            value={situacao}
            onChange={(val) => setSituacao(val)}
          />

          {/* Filtro Prioridade Customizado */}
          <CustomSelect
            label="Prioridade"
            options={opcoesPrioridade}
            value={prioridade}
            onChange={(val) => setPrioridade(val)}
          />

          {/* Filtro Catálogo de Motivo Customizado */}
          <CustomSelect
            label="Motivo"
            options={opcoesMotivo}
            value={motivoId}
            onChange={(val) => setMotivoId(val)}
          />
        </div>

        {/* Linha 2 de Filtros (Datas e Reincidência) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-borda pt-3.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletores de Datas Estilizados */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-texto">Abertura entre:</span>
              <CustomDatePicker
                value={dataInicio}
                onChange={(val) => setDataInicio(val)}
                placeholder="dd/mm/aaaa"
                className="w-36"
              />
              <span className="text-xs text-texto-suave font-medium">até</span>
              <CustomDatePicker
                value={dataFim}
                onChange={(val) => setDataFim(val)}
                placeholder="dd/mm/aaaa"
                className="w-36"
              />
            </div>

            {/* Checkbox Customizado */}
            <CustomCheckbox
              checked={apenasReincidentes}
              onChange={(chk) => setApenasReincidentes(chk)}
              label={
                <span className="flex items-center gap-1.5 font-medium text-xs text-texto">
                  <Users className="h-3.5 w-3.5 text-texto-suave" />
                  <span>Apenas alunos com mais de um chamado</span>
                </span>
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={limparFiltros}
              className="h-9 px-4 rounded-lg border border-borda bg-fundo text-xs font-semibold text-texto-suave hover:text-texto hover:bg-superficie transition"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={aplicarFiltros}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover disabled:opacity-50 transition"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{isPending ? "Filtrando..." : "Aplicar filtros"}</span>
            </button>
          </div>
        </div>
      </div>

      {mensagemErro && (
        <div className="rounded-lg border border-erro/40 bg-erro-fundo p-4 text-xs font-medium text-erro">
          {mensagemErro}
        </div>
      )}

      {/* Indicador de Filtros de Coluna Ativos */}
      {Object.values(filtrosExcel).some((s) => s && s.size > 0) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-acento/30 bg-acento/5 text-xs text-texto shadow-2xs">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-acento shrink-0" />
            <span>
              Filtro de coluna ativo (somente nesta página). Exibindo{" "}
              <strong className="text-acento font-bold">{chamadosExibicao.length}</strong> de{" "}
              <strong>{chamadosFiltrados.length}</strong> chamados.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFiltrosExcel({})}
            className="text-xs font-bold text-acento hover:underline self-start sm:self-auto cursor-pointer"
          >
            Limpar filtros de coluna
          </button>
        </div>
      )}

      {/* 3. Tabela de Chamados Desktop com Navegação por Setinhas */}
      <div className="hidden sm:block relative rounded-xl border border-borda bg-superficie shadow-xs overflow-hidden group">
        {/* Setinha estilizada para voltar colunas (à esquerda) */}
        {podeRolarEsquerda && (
          <button
            type="button"
            onClick={() => rolarTabela("esquerda")}
            className="absolute left-2 top-1.5 z-30 h-8 w-8 rounded-full bg-superficie border border-borda shadow-md ring-2 ring-acento/20 hover:ring-acento hover:bg-acento hover:text-white hover:border-acento text-acento flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
            title="Voltar para as colunas anteriores"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
          </button>
        )}

        {/* Setinha bonita e estilizada na frente para avançar colunas (à direita) */}
        {podeRolarDireita && (
          <button
            type="button"
            onClick={() => rolarTabela("direita")}
            className="absolute right-2 top-1.5 z-30 h-8 w-8 rounded-full bg-superficie border border-borda shadow-md ring-2 ring-acento/20 hover:ring-acento hover:bg-acento hover:text-white hover:border-acento text-acento flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
            title="Avançar para as próximas colunas"
          >
            <ChevronRight className="h-5 w-5 stroke-[2.5]" />
          </button>
        )}

        {/* Tabela com container de rolagem e cabeçalho fixo no topo */}
        <div
          ref={tableContainerRef}
          className="tabela-scroll overflow-auto max-h-[72vh] min-h-[380px]"
        >
          <table className="tabela-densa">
            <thead className="sticky top-0 z-20 bg-superficie-destaque shadow-xs">
              <tr>
                <th className="w-32 bg-superficie-destaque">
                  <div className="flex items-center justify-between gap-1">
                    <span>Protocolo</span>
                    <FiltroColunaExcel
                      titulo="Protocolo"
                      itens={itensProtocolo}
                      selecionados={filtrosExcel.protocolo}
                      onAplicar={(vals) =>
                        setFiltrosExcel((prev) => ({ ...prev, protocolo: vals }))
                      }
                    />
                  </div>
                </th>
                <th className="min-w-[190px] bg-superficie-destaque">
                  <div className="flex items-center justify-between gap-1">
                    <span>Aluno(a) / Documentos</span>
                    <FiltroColunaExcel
                      titulo="Aluno(a)"
                      itens={itensAluno}
                      selecionados={filtrosExcel.aluno}
                      onAplicar={(vals) => setFiltrosExcel((prev) => ({ ...prev, aluno: vals }))}
                    />
                  </div>
                </th>
                <th className="w-28 text-center bg-superficie-destaque">Situação</th>
                <th className="w-32 bg-superficie-destaque">
                  <div className="flex items-center justify-between gap-1">
                    <span>Contato</span>
                    <FiltroColunaExcel
                      titulo="Contato"
                      itens={itensContato}
                      selecionados={filtrosExcel.contato}
                      onAplicar={(vals) => setFiltrosExcel((prev) => ({ ...prev, contato: vals }))}
                      alinhamento="right"
                    />
                  </div>
                </th>
                <th className="min-w-[220px] bg-superficie-destaque">
                  <div className="flex items-center justify-between gap-1">
                    <span>Motivo</span>
                    <FiltroColunaExcel
                      titulo="Motivo"
                      itens={itensMotivo}
                      selecionados={filtrosExcel.motivo}
                      onAplicar={(vals) => setFiltrosExcel((prev) => ({ ...prev, motivo: vals }))}
                      alinhamento="right"
                    />
                  </div>
                </th>
                <th className="w-36 bg-superficie-destaque">
                  <div className="flex items-center justify-between gap-1">
                    <span>Polo</span>
                    <FiltroColunaExcel
                      titulo="Polo"
                      itens={itensPolo}
                      selecionados={filtrosExcel.polo}
                      onAplicar={(vals) => setFiltrosExcel((prev) => ({ ...prev, polo: vals }))}
                      alinhamento="right"
                    />
                  </div>
                </th>
                <th className="w-24 text-center bg-superficie-destaque">Prioridade</th>
                <th className="w-24 text-right bg-superficie-destaque">Abertura</th>
                <th className="w-36 text-right bg-superficie-destaque">Prazo / SLA</th>
                <th className="w-32 bg-superficie-destaque">Responsável</th>
                <th className="w-24 text-right bg-superficie-destaque">Ações</th>
              </tr>
            </thead>
            <tbody>
              {chamadosExibicao.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-xs text-texto-suave">
                    Nenhum chamado encontrado para os filtros selecionados. Ajuste ou limpe os
                    filtros.
                  </td>
                </tr>
              ) : (
                chamadosExibicao.map((c) => {
                  const infoPrazo = obterInfoPrazo(c.prazo, c.situacao, hoje);
                  const ehAutor = c.criado_por === perfilAtual.id;
                  const ehAdmin = perfilAtual.papel === "admin";
                  const podeEditar = true;
                  const podeExcluir = ehAdmin || ehAutor;

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${infoPrazo.bordaTabela} ${
                        infoPrazo.bgLinha ||
                        (c.prioridade === "priorizar" && ehPendente(c.situacao)
                          ? "bg-alerta-fundo/10"
                          : "")
                      }`}
                    >
                      {/* Protocolo */}
                      <td className="font-mono text-xs font-semibold">
                        <Link
                          href={comVolta(`/chamados/${c.id}`)}
                          className="text-acento hover:underline flex items-center gap-1"
                          title="Ver detalhes do chamado"
                        >
                          <span>{c.protocolo}</span>
                        </Link>
                      </td>

                      {/* Aluno e Documentos (CPF e RA) */}
                      <td className="text-xs">
                        <div className="font-medium text-texto">{c.aluno_nome}</div>
                        {(c.aluno_cpf || c.aluno_ra) && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-texto-suave font-mono whitespace-nowrap">
                            {c.aluno_cpf && (
                              <span className="inline-flex items-center gap-1">
                                CPF: <CpfDisplay cpf={c.aluno_cpf} showToggle={false} />
                              </span>
                            )}
                            {c.aluno_cpf && c.aluno_ra && <span className="text-borda">·</span>}
                            {c.aluno_ra && <span>RA: {c.aluno_ra}</span>}
                          </div>
                        )}
                      </td>

                      {/* Situação */}
                      <td className="text-center">
                        <SituacaoBadge situacao={c.situacao} />
                      </td>

                      {/* Contato */}
                      <td className="font-mono text-xs tabular-nums text-texto-suave">
                        {c.contato_telefone ? formatarTelefone(c.contato_telefone) : "—"}
                      </td>

                      {/* Motivo */}
                      <td
                        className="text-xs text-texto truncate max-w-xs"
                        title={c.motivo_nome ?? undefined}
                      >
                        <span className="font-mono font-medium text-acento mr-1.5">
                          {c.motivo_codigo}
                        </span>
                        <span>{c.motivo_nome || "—"}</span>
                      </td>

                      {/* Polo */}
                      <td className="text-xs">
                        {c.polo_nome ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-borda bg-fundo text-texto"
                            title={`${c.polo_nome} - ${c.polo_cidade || ""}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-acento"></span>
                            <span>{c.polo_cidade || c.polo_nome}</span>
                          </span>
                        ) : (
                          <span className="text-texto-suave text-[11px]">—</span>
                        )}
                      </td>

                      {/* Prioridade */}
                      <td className="text-center">
                        {c.prioridade === "priorizar" ? (
                          <span className="inline-flex items-center justify-center h-6 px-2 rounded-full border border-rose-200 bg-rose-50 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                            Priorizar
                          </span>
                        ) : (
                          <span className="text-[11px] text-texto-suave font-normal">Normal</span>
                        )}
                      </td>

                      {/* Data de Solicitação */}
                      <td className="font-mono text-xs tabular-nums text-texto-suave text-right">
                        {formatarDataCivil(c.data_solicitacao)}
                      </td>

                      {/* Prazo com Identificador Vermelho / Urgência */}
                      <td className="text-right whitespace-nowrap">
                        {ehPendente(c.situacao) ? (
                          <div className="inline-flex flex-col items-end gap-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${infoPrazo.badgeClasse}`}
                              title={infoPrazo.subtexto}
                            >
                              {infoPrazo.tipo === "vencido" && (
                                <AlertOctagon className="h-3 w-3 shrink-0 text-rose-600 dark:text-rose-300" />
                              )}
                              {infoPrazo.tipo === "vence_hoje" && (
                                <Clock className="h-3 w-3 shrink-0 text-rose-600 dark:text-rose-300" />
                              )}
                              {infoPrazo.tipo === "vence_em_breve" && (
                                <CalendarClock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-300" />
                              )}
                              {infoPrazo.tipo === "no_prazo" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              )}
                              <span>{infoPrazo.textoBadge}</span>
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-texto-suave">
                              {formatarDataCivil(c.prazo)}
                            </span>
                          </div>
                        ) : (
                          <div className="font-mono text-xs tabular-nums text-texto-suave">
                            {formatarDataCivil(c.prazo)}
                          </div>
                        )}
                      </td>

                      {/* Responsável */}
                      <td className="text-xs text-texto">
                        {formatarResponsavel(c.responsavel_nome ?? undefined)}
                      </td>

                      {/* Ações */}
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={comVolta(`/chamados/${c.id}`)}
                            className="btn-tátil rounded-md p-1.5 text-texto-suave hover:bg-fundo hover:text-acento transition"
                            title="Visualizar chamado"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {podeEditar && (
                            <Link
                              href={comVolta(`/chamados/${c.id}/editar`)}
                              className="btn-tátil rounded-md p-1.5 text-texto-suave hover:bg-fundo hover:text-acento transition"
                              title="Editar chamado"
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                          )}

                          {podeExcluir && (
                            <button
                              type="button"
                              onClick={() => setChamadoExcluir(c)}
                              className="btn-tátil rounded-md p-1.5 text-texto-suave hover:bg-fundo hover:text-erro transition"
                              title="Excluir chamado"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <nav
        aria-label="Paginação"
        className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-texto-suave"
      >
        <span>
          {paginacao.total === 0
            ? "Nenhum chamado"
            : `Exibindo ${(paginacao.pagina - 1) * paginacao.porPagina + 1}–${Math.min(paginacao.pagina * paginacao.porPagina, paginacao.total)} de ${paginacao.total} chamados`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={paginacao.pagina <= 1 || isPending}
            onClick={() => irParaPagina(paginacao.pagina - 1)}
            className="h-8 px-3 rounded-lg border border-borda bg-superficie font-semibold text-texto disabled:opacity-40"
          >
            Anterior
          </button>
          <span aria-current="page">
            Página {paginacao.pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            disabled={paginacao.pagina >= totalPaginas || isPending}
            onClick={() => irParaPagina(paginacao.pagina + 1)}
            className="h-8 px-3 rounded-lg border border-borda bg-superficie font-semibold text-texto disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </nav>

      {/* Cards Responsivos para Mobile */}
      <div className="block sm:hidden space-y-3">
        {chamadosExibicao.length === 0 ? (
          <div className="rounded-lg border border-borda bg-superficie p-8 text-center text-xs text-texto-suave">
            Nenhum chamado encontrado.
          </div>
        ) : (
          chamadosExibicao.map((c) => {
            const infoPrazo = obterInfoPrazo(c.prazo, c.situacao, hoje);
            const ehAutor = c.criado_por === perfilAtual.id;
            const ehAdmin = perfilAtual.papel === "admin";
            const podeExcluir = ehAdmin || ehAutor;

            return (
              <div
                key={c.id}
                className={`rounded-lg border border-borda bg-superficie p-4 space-y-2.5 transition-colors ${infoPrazo.bordaTabela} ${infoPrazo.bgLinha}`}
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={comVolta(`/chamados/${c.id}`)}
                    className="font-mono font-semibold text-sm text-acento"
                  >
                    {c.protocolo}
                  </Link>
                  <div className="flex items-center gap-1.5">
                    <SituacaoBadge situacao={c.situacao} />
                    {c.polo_nome && (
                      <span className="rounded border border-borda bg-fundo px-1.5 py-0.5 text-[10px] font-medium text-texto">
                        {c.polo_cidade || c.polo_nome}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-texto">{c.aluno_nome}</div>
                  {(c.aluno_cpf || c.aluno_ra) && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-texto-suave font-mono">
                      {c.aluno_cpf && (
                        <span className="inline-flex items-center gap-1">
                          CPF: <CpfDisplay cpf={c.aluno_cpf} showToggle={false} />
                        </span>
                      )}
                      {c.aluno_cpf && c.aluno_ra && <span className="text-borda">·</span>}
                      {c.aluno_ra && <span>RA: {c.aluno_ra}</span>}
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-texto-suave flex items-center justify-between">
                  <span className="truncate max-w-[50%]">
                    {c.motivo_codigo} {c.motivo_nome}
                  </span>
                  {ehPendente(c.situacao) ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${infoPrazo.badgeClasse}`}
                    >
                      {infoPrazo.tipo === "vencido" && (
                        <AlertOctagon className="h-2.5 w-2.5 shrink-0" />
                      )}
                      {infoPrazo.tipo === "vence_hoje" && (
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                      )}
                      {infoPrazo.tipo === "vence_em_breve" && (
                        <CalendarClock className="h-2.5 w-2.5 shrink-0" />
                      )}
                      <span>{infoPrazo.textoBadge}</span>
                      <span className="font-mono text-texto-suave font-normal ml-0.5">
                        ({formatarDataCivil(c.prazo, "curto")})
                      </span>
                    </span>
                  ) : (
                    <span className="font-mono text-texto">
                      Prazo: {formatarDataCivil(c.prazo)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-borda pt-2 text-xs">
                  <span className="text-[11px] text-texto-suave">
                    Responsável:{" "}
                    <strong className="text-texto font-medium">
                      {formatarResponsavel(c.responsavel_nome ?? undefined)}
                    </strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={comVolta(`/chamados/${c.id}`)}
                      className="rounded-md border border-borda bg-fundo px-2.5 py-1 text-xs font-medium text-texto"
                    >
                      Ver
                    </Link>
                    <Link
                      href={comVolta(`/chamados/${c.id}/editar`)}
                      className="rounded-md bg-acento px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      Editar
                    </Link>
                    {podeExcluir && (
                      <button
                        type="button"
                        onClick={() => setChamadoExcluir(c)}
                        className="rounded-md border border-erro/40 bg-erro-fundo px-2 py-1 text-xs font-semibold text-erro"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {chamadoExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-borda bg-superficie p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-erro flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              <span>Confirmar Exclusão</span>
            </h3>
            <p className="text-xs text-texto leading-relaxed">
              Deseja realmente excluir o chamado <strong>{chamadoExcluir.protocolo}</strong>? Esta
              ação é auditada.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-borda">
              <button
                type="button"
                onClick={() => setChamadoExcluir(null)}
                className="h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                disabled={isPending}
                className="h-9 px-4 rounded-lg bg-erro text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
