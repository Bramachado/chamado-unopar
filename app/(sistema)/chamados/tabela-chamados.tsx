"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { type Chamado, type Motivo, type Perfil } from "@/types/database";
import { 
  Eye, 
  Edit, 
  Trash2, 
  Search, 
  Download, 
  Plus, 
  Users,
  Filter,
  Calendar
} from "lucide-react";
import { format, parseISO, isBefore, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { excluirChamadoAction } from "./actions";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";
import { CustomCheckbox } from "@/components/ui/custom-checkbox";

interface TabelaChamadosProps {
  chamados: (Chamado & {
    motivos?: Pick<Motivo, "id" | "codigo" | "nome">;
    perfis?: Pick<Perfil, "id" | "nome_completo">;
  })[];
  motivos: Motivo[];
  perfilAtual: Perfil;
  filtros: {
    busca?: string;
    situacao?: string;
    prioridade?: string;
    motivo_id?: string;
    data_inicio?: string;
    data_fim?: string;
    reincidentes?: string;
  };
}

export function TabelaChamados({
  chamados,
  motivos,
  perfilAtual,
  filtros,
}: TabelaChamadosProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Estados locais dos filtros
  const [busca, setBusca] = useState(filtros.busca || "");
  const [situacao, setSituacao] = useState(filtros.situacao || "todos");
  const [prioridade, setPrioridade] = useState(filtros.prioridade || "todos");
  const [motivoId, setMotivoId] = useState(filtros.motivo_id || "todos");
  const [dataInicio, setDataInicio] = useState(filtros.data_inicio || "");
  const [dataFim, setDataFim] = useState(filtros.data_fim || "");
  const [apenasReincidentes, setApenasReincidentes] = useState(filtros.reincidentes === "true");

  // Estado do modal de confirmação de exclusão
  const [chamadoExcluir, setChamadoExcluir] = useState<Chamado | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const hoje = startOfDay(new Date());
  const emDoisDias = addDays(hoje, 2);

  // Opções formatadas para os CustomSelects
  const opcoesSituacao: CustomSelectOption[] = [
    { value: "todos", label: "Todas as situações" },
    { value: "aguardando", label: "Aguardando (Em andamento)" },
    { value: "concluido", label: "Concluído (Resolvido)" },
    { value: "encerrado", label: "Encerrado (Sem resolução)" },
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

  // Filtro de alunos reincidentes no client-side
  const contagemPorAluno = chamados.reduce<Record<string, number>>((acc, c) => {
    const nomeNorm = c.aluno_nome.trim().toLowerCase();
    acc[nomeNorm] = (acc[nomeNorm] || 0) + 1;
    return acc;
  }, {});

  const chamadosFiltrados = apenasReincidentes
    ? chamados.filter((c) => (contagemPorAluno[c.aluno_nome.trim().toLowerCase()] || 0) > 1)
    : chamados;

  const aplicarFiltros = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (busca.trim()) params.set("busca", busca.trim());
    else params.delete("busca");

    if (situacao !== "todos") params.set("situacao", situacao);
    else params.delete("situacao");

    if (prioridade !== "todos") params.set("prioridade", prioridade);
    else params.delete("prioridade");

    if (motivoId !== "todos") params.set("motivo_id", motivoId);
    else params.delete("motivo_id");

    if (dataInicio) params.set("data_inicio", dataInicio);
    else params.delete("data_inicio");

    if (dataFim) params.set("data_fim", dataFim);
    else params.delete("data_fim");

    if (apenasReincidentes) params.set("reincidentes", "true");
    else params.delete("reincidentes");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const limparFiltros = () => {
    setBusca("");
    setSituacao("todos");
    setPrioridade("todos");
    setMotivoId("todos");
    setDataInicio("");
    setDataFim("");
    setApenasReincidentes(false);
    startTransition(() => {
      router.push(pathname);
    });
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
    <div className="space-y-8">
      {/* 1. Cabeçalho Padronizado da Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Gerenciamento de Chamados
          </h1>
          <p className="text-sm text-texto-suave mt-0.5">
            Controle de protocolos, solicitações acadêmicas e prazos de resolução.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/chamados/exportar?${searchParams.toString()}`}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo transition"
            title="Exportar dados filtrados em CSV"
          >
            <Download className="h-4 w-4 text-texto-suave" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Link>

          <Link
            href="/chamados/novo"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover transition"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Chamado</span>
          </Link>
        </div>
      </div>

      {/* 2. Bloco de Filtros */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Busca Textual */}
          <div>
            <label className="block text-xs font-medium text-texto mb-1.5">
              Buscar (Protocolo ou Aluno)
            </label>
            <div className="relative">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") aplicarFiltros();
                }}
                placeholder="Ex: CS12345678 ou Nome..."
                className="w-full rounded-lg border border-borda bg-fundo pl-9 pr-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-texto-suave" />
            </div>
          </div>

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
          <div className="flex flex-wrap items-center gap-4">
            {/* Seletor de Datas */}
            <div className="flex items-center gap-2 bg-fundo px-3 py-1.5 rounded-lg border border-borda">
              <Calendar className="h-4 w-4 text-texto-suave" />
              <span className="text-xs font-medium text-texto">Período:</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="rounded-md border border-borda bg-superficie px-2 py-1 font-mono text-xs text-texto focus:border-acento focus:outline-none"
              />
              <span className="text-xs text-texto-suave font-medium">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="rounded-md border border-borda bg-superficie px-2 py-1 font-mono text-xs text-texto focus:border-acento focus:outline-none"
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

      {/* 3. Tabela de Chamados Desktop */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-borda bg-superficie">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th className="w-32">Protocolo</th>
              <th>Aluno(a)</th>
              <th className="w-32">Contato</th>
              <th className="w-48">Motivo</th>
              <th className="w-28 text-center">Situação</th>
              <th className="w-24 text-center">Prioridade</th>
              <th className="w-28 text-right">Abertura</th>
              <th className="w-28 text-right">Prazo</th>
              <th className="w-36">Responsável</th>
              <th className="w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {chamadosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-xs text-texto-suave">
                  Nenhum chamado encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              chamadosFiltrados.map((c) => {
                const dataPrazo = startOfDay(parseISO(c.prazo));
                const estaVencido = c.situacao === "aguardando" && isBefore(dataPrazo, hoje);
                const estaProximoVencimento =
                  c.situacao === "aguardando" &&
                  !estaVencido &&
                  (isBefore(dataPrazo, emDoisDias) || dataPrazo.getTime() === emDoisDias.getTime());

                const ehAutor = c.criado_por === perfilAtual.id;
                const ehAdmin = perfilAtual.papel === "admin";
                const podeEditar = true;
                const podeExcluir = ehAdmin || ehAutor;

                return (
                  <tr
                    key={c.id}
                    className={
                      c.prioridade === "priorizar" && c.situacao === "aguardando"
                        ? "bg-alerta-fundo/10"
                        : ""
                    }
                  >
                    {/* Protocolo */}
                    <td className="font-mono text-xs font-semibold">
                      <Link
                        href={`/chamados/${c.id}`}
                        className="text-acento hover:underline flex items-center gap-1"
                        title="Ver detalhes do chamado"
                      >
                        <span>{c.protocolo}</span>
                      </Link>
                    </td>

                    {/* Aluno */}
                    <td className="text-xs font-medium text-texto">
                      {c.aluno_nome}
                    </td>

                    {/* Contato */}
                    <td className="font-mono text-xs tabular-nums text-texto-suave">
                      {c.contato_telefone || "—"}
                    </td>

                    {/* Motivo */}
                    <td className="text-xs text-texto truncate max-w-xs" title={c.motivos?.nome}>
                      <span className="font-mono font-medium text-acento mr-1.5">
                        {c.motivos?.codigo}
                      </span>
                      <span>{c.motivos?.nome || "—"}</span>
                    </td>

                    {/* Situação */}
                    <td className="text-center">
                      <span
                        className={`inline-flex items-center justify-center h-6 px-2.5 rounded text-[11px] font-medium border ${
                          c.situacao === "concluido"
                            ? "bg-sucesso-fundo/40 text-sucesso border-sucesso/30"
                            : c.situacao === "encerrado"
                            ? "bg-fundo text-texto-suave border-borda"
                            : "bg-fundo text-texto border-borda"
                        }`}
                      >
                        {c.situacao === "concluido" ? "Concluído" : c.situacao === "aguardando" ? "Aguardando" : "Encerrado"}
                      </span>
                    </td>

                    {/* Prioridade */}
                    <td className="text-center">
                      {c.prioridade === "priorizar" ? (
                        <span className="inline-flex items-center justify-center h-6 px-2 rounded border border-alerta/40 bg-alerta-fundo/40 text-[11px] font-semibold text-alerta">
                          Priorizar
                        </span>
                      ) : (
                        <span className="text-[11px] text-texto-suave font-normal">Normal</span>
                      )}
                    </td>

                    {/* Data de Solicitação */}
                    <td className="font-mono text-xs tabular-nums text-texto-suave text-right">
                      {format(parseISO(c.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
                    </td>

                    {/* Prazo */}
                    <td className="font-mono text-xs tabular-nums text-right">
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          estaVencido
                            ? "bg-erro-fundo text-erro border border-erro/30"
                            : estaProximoVencimento
                            ? "bg-alerta-fundo text-alerta border border-alerta/30"
                            : "text-texto"
                        }`}
                      >
                        {format(parseISO(c.prazo), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </td>

                    {/* Responsável */}
                    <td className="text-xs text-texto">
                      {formatarResponsavel(c.perfis?.nome_completo)}
                    </td>

                    {/* Ações */}
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/chamados/${c.id}`}
                          className="rounded-md p-1.5 text-texto-suave hover:bg-fundo hover:text-acento transition"
                          title="Visualizar chamado"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        {podeEditar && (
                          <Link
                            href={`/chamados/${c.id}/editar`}
                            className="rounded-md p-1.5 text-texto-suave hover:bg-fundo hover:text-acento transition"
                            title="Editar chamado"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        )}

                        {podeExcluir && (
                          <button
                            type="button"
                            onClick={() => setChamadoExcluir(c)}
                            className="rounded-md p-1.5 text-texto-suave hover:bg-fundo hover:text-erro transition"
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

      {/* Cards Responsivos para Mobile */}
      <div className="block sm:hidden space-y-3">
        {chamadosFiltrados.length === 0 ? (
          <div className="rounded-lg border border-borda bg-superficie p-8 text-center text-xs text-texto-suave">
            Nenhum chamado encontrado.
          </div>
        ) : (
          chamadosFiltrados.map((c) => {
            const ehAutor = c.criado_por === perfilAtual.id;
            const ehAdmin = perfilAtual.papel === "admin";
            const podeExcluir = ehAdmin || ehAutor;

            return (
              <div key={c.id} className="rounded-lg border border-borda bg-superficie p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Link href={`/chamados/${c.id}`} className="font-mono font-semibold text-sm text-acento">
                    {c.protocolo}
                  </Link>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-medium ${
                      c.situacao === "concluido"
                        ? "bg-sucesso-fundo/40 text-sucesso border-sucesso/30"
                        : c.situacao === "encerrado"
                        ? "bg-fundo text-texto-suave border-borda"
                        : "bg-fundo text-texto border-borda"
                    }`}
                  >
                    {c.situacao}
                  </span>
                </div>

                <div className="text-xs font-semibold text-texto">
                  {c.aluno_nome}
                </div>

                <div className="text-[11px] text-texto-suave flex items-center justify-between">
                  <span>{c.motivos?.codigo} {c.motivos?.nome}</span>
                  <span className="font-mono text-texto">
                    Prazo: {format(parseISO(c.prazo), "dd/MM/yyyy")}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-borda pt-2 text-xs">
                  <span className="text-[11px] text-texto-suave">
                    Responsável: <strong className="text-texto font-medium">{formatarResponsavel(c.perfis?.nome_completo)}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/chamados/${c.id}`}
                      className="rounded-md border border-borda bg-fundo px-2.5 py-1 text-xs font-medium text-texto"
                    >
                      Ver
                    </Link>
                    <Link
                      href={`/chamados/${c.id}/editar`}
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
              Deseja realmente excluir o chamado <strong>{chamadoExcluir.protocolo}</strong>? Esta ação é auditada.
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
