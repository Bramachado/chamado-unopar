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
    <div className="space-y-6">
      {/* Cabeçalho e Ações Principais */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-superficie p-5 rounded-xl border border-borda shadow-sm">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto tracking-tight">
            Gerenciamento de Chamados
          </h1>
          <p className="text-xs text-texto-suave">
            Controle de protocolos, solicitações acadêmicas e prazos de resolução.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/chamados/exportar?${searchParams.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-borda bg-fundo px-3.5 py-2 text-xs font-bold text-texto transition hover:bg-superficie shadow-xs"
            title="Exportar dados filtrados em CSV"
          >
            <Download className="h-4 w-4 text-texto-suave" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Link>

          <Link
            href="/chamados/novo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-acento px-4 py-2 text-xs font-bold text-white transition hover:bg-acento-hover shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Chamado</span>
          </Link>
        </div>
      </div>

      {/* Bloco de Filtros com CustomSelects e CustomCheckbox */}
      <div className="rounded-xl border border-borda bg-superficie p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Busca Textual */}
          <div>
            <label className="block text-xs font-bold text-texto mb-1.5">
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
                className="w-full rounded-lg border border-borda bg-fundo pl-9 pr-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20 shadow-xs"
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
            {/* Seletor de Datas Estilizado */}
            <div className="flex items-center gap-2 bg-fundo px-3 py-1.5 rounded-lg border border-borda shadow-xs">
              <Calendar className="h-4 w-4 text-texto-suave" />
              <span className="text-xs font-bold text-texto">Período:</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="rounded-md border border-borda/80 bg-superficie px-2 py-1 font-mono text-xs font-semibold text-texto focus:border-acento focus:outline-none shadow-xs"
              />
              <span className="text-xs text-texto-suave font-medium">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="rounded-md border border-borda/80 bg-superficie px-2 py-1 font-mono text-xs font-semibold text-texto focus:border-acento focus:outline-none shadow-xs"
              />
            </div>

            {/* Checkbox Customizado */}
            <CustomCheckbox
              checked={apenasReincidentes}
              onChange={(chk) => setApenasReincidentes(chk)}
              label={
                <span className="flex items-center gap-1.5 font-semibold text-xs text-texto">
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
              className="rounded-lg border border-borda bg-fundo px-3.5 py-1.5 text-xs font-bold text-texto-suave hover:text-texto hover:bg-superficie shadow-xs transition"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={aplicarFiltros}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-acento px-4 py-1.5 text-xs font-bold text-white hover:bg-acento-hover disabled:opacity-50 shadow-sm transition"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{isPending ? "Filtrando..." : "Aplicar filtros"}</span>
            </button>
          </div>
        </div>
      </div>

      {mensagemErro && (
        <div className="rounded-xl border border-erro/40 bg-erro-fundo p-4 text-xs font-bold text-erro shadow-sm">
          {mensagemErro}
        </div>
      )}

      {/* Tabela de Chamados Desktop (Escondida em telas muito pequenas) */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-borda bg-superficie shadow-sm">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th className="w-32">Protocolo</th>
              <th>Aluno(a)</th>
              <th className="w-32">Contato</th>
              <th className="w-48">Motivo</th>
              <th className="w-28 text-center">Situação</th>
              <th className="w-24 text-center">Prioridade</th>
              <th className="w-28">Abertura</th>
              <th className="w-28">Prazo</th>
              <th className="w-36">Responsável</th>
              <th className="w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {chamadosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-xs text-texto-suave font-medium">
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
                        ? "bg-amber-500/10 font-medium"
                        : ""
                    }
                  >
                    {/* Protocolo */}
                    <td className="font-mono text-xs font-bold">
                      <Link
                        href={`/chamados/${c.id}`}
                        className="text-acento hover:underline flex items-center gap-1"
                        title="Ver detalhes do chamado"
                      >
                        <span>{c.protocolo}</span>
                      </Link>
                    </td>

                    {/* Aluno */}
                    <td className="text-xs font-bold text-texto">
                      {c.aluno_nome}
                    </td>

                    {/* Contato */}
                    <td className="font-mono text-xs tabular-nums text-texto-suave font-semibold">
                      {c.contato_telefone || "—"}
                    </td>

                    {/* Motivo */}
                    <td className="text-xs text-texto truncate max-w-xs" title={c.motivos?.nome}>
                      <span className="font-mono font-bold text-acento mr-1.5">
                        {c.motivos?.codigo}
                      </span>
                      <span>{c.motivos?.nome || "—"}</span>
                    </td>

                    {/* Situação */}
                    <td className="text-center">
                      <span
                        className={`inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-bold ${
                          c.situacao === "concluido"
                            ? "bg-sucesso/15 text-sucesso border-sucesso/40"
                            : c.situacao === "encerrado"
                            ? "bg-fundo text-texto-suave border-borda"
                            : "bg-acento/15 text-acento border-acento/40"
                        }`}
                      >
                        {c.situacao}
                      </span>
                    </td>

                    {/* Prioridade */}
                    <td className="text-center">
                      {c.prioridade === "priorizar" ? (
                        <span className="rounded-md border border-alerta/50 bg-alerta-fundo px-2 py-0.5 text-[11px] font-bold text-alerta">
                          Priorizar
                        </span>
                      ) : (
                        <span className="text-[11px] text-texto-suave font-medium">Normal</span>
                      )}
                    </td>

                    {/* Data de Solicitação */}
                    <td className="font-mono text-xs tabular-nums text-texto-suave">
                      {format(parseISO(c.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
                    </td>

                    {/* Prazo */}
                    <td className="font-mono text-xs tabular-nums">
                      <span
                        className={`rounded px-1.5 py-0.5 font-bold ${
                          estaVencido
                            ? "bg-erro-fundo text-erro border border-erro/40"
                            : estaProximoVencimento
                            ? "bg-alerta-fundo text-alerta border border-alerta/40"
                            : "text-texto"
                        }`}
                      >
                        {format(parseISO(c.prazo), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </td>

                    {/* Responsável */}
                    <td className="text-xs text-texto font-medium">
                      {formatarResponsavel(c.perfis?.nome_completo)}
                    </td>

                    {/* Ações */}
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/chamados/${c.id}`}
                          className="rounded-md p-1.5 text-texto-suave hover:bg-superficie hover:text-acento transition"
                          title="Visualizar chamado"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        {podeEditar && (
                          <Link
                            href={`/chamados/${c.id}/editar`}
                            className="rounded-md p-1.5 text-texto-suave hover:bg-superficie hover:text-acento transition"
                            title="Editar chamado"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        )}

                        {podeExcluir && (
                          <button
                            type="button"
                            onClick={() => setChamadoExcluir(c)}
                            className="rounded-md p-1.5 text-texto-suave hover:bg-superficie hover:text-erro transition"
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

      {/* Cards Responsivos para Telas Mobile */}
      <div className="block sm:hidden space-y-3">
        {chamadosFiltrados.length === 0 ? (
          <div className="rounded-xl border border-borda bg-superficie p-8 text-center text-xs text-texto-suave">
            Nenhum chamado encontrado.
          </div>
        ) : (
          chamadosFiltrados.map((c) => {
            const ehAutor = c.criado_por === perfilAtual.id;
            const ehAdmin = perfilAtual.papel === "admin";
            const podeExcluir = ehAdmin || ehAutor;

            return (
              <div key={c.id} className="rounded-xl border border-borda bg-superficie p-4 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <Link href={`/chamados/${c.id}`} className="font-mono font-bold text-sm text-acento">
                    {c.protocolo}
                  </Link>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                      c.situacao === "concluido"
                        ? "bg-sucesso/15 text-sucesso border-sucesso/40"
                        : c.situacao === "encerrado"
                        ? "bg-fundo text-texto-suave border-borda"
                        : "bg-acento/15 text-acento border-acento/40"
                    }`}
                  >
                    {c.situacao}
                  </span>
                </div>

                <div className="text-xs font-bold text-texto">
                  {c.aluno_nome}
                </div>

                <div className="text-[11px] text-texto-suave flex items-center justify-between">
                  <span>{c.motivos?.codigo} {c.motivos?.nome}</span>
                  <span className="font-mono font-bold text-texto">
                    Prazo: {format(parseISO(c.prazo), "dd/MM/yyyy")}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-borda/40 pt-2 text-xs">
                  <span className="text-[11px] text-texto-suave">
                    Por: <strong>{formatarResponsavel(c.perfis?.nome_completo)}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/chamados/${c.id}`}
                      className="rounded-md border border-borda bg-fundo px-2.5 py-1 text-xs font-bold text-texto"
                    >
                      Ver
                    </Link>
                    <Link
                      href={`/chamados/${c.id}/editar`}
                      className="rounded-md bg-acento px-2.5 py-1 text-xs font-bold text-white"
                    >
                      Editar
                    </Link>
                    {podeExcluir && (
                      <button
                        type="button"
                        onClick={() => setChamadoExcluir(c)}
                        className="rounded-md border border-erro/40 bg-erro-fundo px-2 py-1 text-xs font-bold text-erro"
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
          <div className="w-full max-w-md rounded-xl border border-borda bg-fundo p-6 shadow-xl space-y-4">
            <h3 className="font-heading text-base font-bold text-erro flex items-center gap-2">
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
                className="rounded-md border border-borda bg-superficie px-4 py-2 text-xs font-bold text-texto hover:bg-fundo"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                disabled={isPending}
                className="rounded-md bg-erro px-5 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
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
