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
  Calendar, 
  Users,
  Filter
} from "lucide-react";
import { format, parseISO, isBefore, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { excluirChamadoAction } from "./actions";

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
  const [idExcluindo, setIdExcluindo] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const aplicarFiltros = () => {
    const params = new URLSearchParams();
    if (busca.trim()) params.set("busca", busca.trim());
    if (situacao !== "todos") params.set("situacao", situacao);
    if (prioridade !== "todos") params.set("prioridade", prioridade);
    if (motivoId !== "todos") params.set("motivo_id", motivoId);
    if (dataInicio) params.set("data_inicio", dataInicio);
    if (dataFim) params.set("data_fim", dataFim);
    if (apenasReincidentes) params.set("reincidentes", "true");

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

  const handleExcluir = async () => {
    if (!idExcluindo) return;
    setMensagemErro(null);

    const res = await excluirChamadoAction(idExcluindo);
    if (!res.sucesso) {
      setMensagemErro(res.erro || "Falha ao excluir chamado.");
    } else {
      setIdExcluindo(null);
      router.refresh();
    }
  };

  const hoje = startOfDay(new Date());
  const emDoisDias = addDays(hoje, 2);

  // Formatar nome completo para primeiro nome e sobrenome
  const formatarNomeResponsavel = (nomeCompleto?: string) => {
    if (!nomeCompleto) return "—";
    const partes = nomeCompleto.trim().split(" ");
    if (partes.length === 1) return partes[0];
    return `${partes[0]} ${partes[partes.length - 1]}`;
  };

  // Contagem de chamados por aluno para filtro de reincidentes
  const contagemPorAluno: Record<string, number> = {};
  for (const c of chamados) {
    const k = c.aluno_nome.trim().toUpperCase();
    contagemPorAluno[k] = (contagemPorAluno[k] || 0) + 1;
  }

  const chamadosFiltrados = apenasReincidentes
    ? chamados.filter((c) => (contagemPorAluno[c.aluno_nome.trim().toUpperCase()] || 0) > 1)
    : chamados;

  return (
    <div className="space-y-4">
      {/* Cabeçalho de Ações e Busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto">
            Controle de chamados
          </h1>
          <p className="text-xs text-texto-suave">
            Registro, acompanhamento e histórico de solicitações da unidade.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/chamados/exportar?${searchParams.toString()}`}
            className="inline-flex items-center gap-1.5 rounded border border-borda bg-superficie px-3 py-1.5 text-xs font-medium text-texto transition hover:bg-fundo"
            title="Exportar registros filtrados em CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </a>

          <Link
            href="/chamados/novo"
            className="inline-flex items-center gap-1.5 rounded bg-acento px-3 py-1.5 text-xs font-medium text-white transition hover:bg-acento-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo chamado</span>
          </Link>
        </div>
      </div>

      {/* Painel de Filtros Avançados */}
      <div className="rounded border border-borda bg-superficie p-3.5 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {/* Busca por protocolo ou nome */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-texto-suave" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && aplicarFiltros()}
              placeholder="Buscar por protocolo (CS...) ou nome do aluno"
              className="w-full rounded border border-borda bg-fundo pl-8 pr-3 py-1.5 text-xs text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none"
            />
          </div>

          {/* Situação */}
          <div>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2.5 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="todos">Todas as situações</option>
              <option value="aguardando">Aguardando</option>
              <option value="concluido">Concluído (resolvido)</option>
              <option value="encerrado">Encerrado (sem resolver)</option>
            </select>
          </div>

          {/* Prioridade */}
          <div>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2.5 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="todos">Todas as prioridades</option>
              <option value="normal">Normal</option>
              <option value="priorizar">Priorizar</option>
            </select>
          </div>

          {/* Motivo */}
          <div>
            <select
              value={motivoId}
              onChange={(e) => setMotivoId(e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2.5 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="todos">Todos os motivos</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo} - {m.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha 2 de filtros: datas e reincidência */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-borda/40">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-texto-suave" />
              <span className="text-texto-suave">De:</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="rounded border border-borda bg-fundo px-2 py-1 text-xs text-texto focus:border-acento focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-texto-suave">Até:</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="rounded border border-borda bg-fundo px-2 py-1 text-xs text-texto focus:border-acento focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-1.5 ml-2 cursor-pointer select-none text-xs text-texto font-medium">
              <input
                type="checkbox"
                checked={apenasReincidentes}
                onChange={(e) => setApenasReincidentes(e.target.checked)}
                className="rounded border-borda text-acento focus:ring-acento"
              />
              <Users className="h-3.5 w-3.5 text-texto-suave" />
              <span>Apenas alunos com mais de um chamado</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={limparFiltros}
              className="rounded border border-borda bg-fundo px-2.5 py-1 text-xs font-medium text-texto-suave hover:text-texto"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={aplicarFiltros}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded bg-acento px-3 py-1 text-xs font-medium text-white hover:bg-acento-hover disabled:opacity-50"
            >
              <Filter className="h-3 w-3" />
              <span>{isPending ? "Filtrando..." : "Aplicar filtros"}</span>
            </button>
          </div>
        </div>
      </div>

      {mensagemErro && (
        <div className="rounded border border-erro/30 bg-erro-fundo p-3 text-xs text-erro">
          {mensagemErro}
        </div>
      )}

      {/* Tabela Densa de Chamados */}
      <div className="overflow-x-auto rounded border border-borda bg-fundo shadow-sm">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th className="w-32">Protocolo</th>
              <th>Aluno</th>
              <th className="w-28">Contato</th>
              <th className="w-36">Motivo</th>
              <th className="w-28 text-center">Situação</th>
              <th className="w-24 text-center">Prioridade</th>
              <th className="w-24">Abertura</th>
              <th className="w-24">Prazo</th>
              <th className="w-36">Responsável</th>
              <th className="w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {chamadosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-xs text-texto-suave">
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
                const podeEditar = ehAdmin || (perfilAtual.papel === "coordenador" ? false : ehAutor);
                const podeExcluir = ehAdmin || (perfilAtual.papel === "atendente" && ehAutor);

                return (
                  <tr
                    key={c.id}
                    className={
                      c.prioridade === "priorizar" && c.situacao === "aguardando"
                        ? "bg-alerta-fundo/15 font-medium"
                        : ""
                    }
                  >
                    {/* Protocolo */}
                    <td className="font-mono text-xs font-semibold">
                      <Link
                        href={`/chamados/${c.id}`}
                        className="text-acento hover:underline"
                        title="Ver detalhes do chamado"
                      >
                        {c.protocolo}
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
                    <td className="text-xs text-texto">
                      <span className="font-mono text-[11px] text-texto-suave mr-1">
                        {c.motivos?.codigo}
                      </span>
                      <span>{c.motivos?.nome || "Outros"}</span>
                    </td>

                    {/* Situação */}
                    <td className="text-center">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium capitalize ${
                          c.situacao === "concluido"
                            ? "bg-sucesso/10 text-sucesso border-sucesso/30 font-semibold"
                            : c.situacao === "aguardando"
                            ? "bg-acento/10 text-acento border-acento/30"
                            : "bg-superficie text-texto-suave border-borda"
                        }`}
                      >
                        {c.situacao === "concluido"
                          ? "Concluído"
                          : c.situacao === "aguardando"
                          ? "Aguardando"
                          : "Encerrado"}
                      </span>
                    </td>

                    {/* Prioridade */}
                    <td className="text-center">
                      {c.prioridade === "priorizar" ? (
                        <span className="inline-block rounded border border-alerta/30 bg-alerta-fundo px-2 py-0.5 text-[10px] font-bold text-alerta uppercase">
                          Priorizar
                        </span>
                      ) : (
                        <span className="text-[11px] text-texto-suave">Normal</span>
                      )}
                    </td>

                    {/* Data de Solicitação */}
                    <td className="font-mono text-xs tabular-nums text-texto-suave">
                      {format(parseISO(c.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
                    </td>

                    {/* Prazo */}
                    <td className="font-mono text-xs tabular-nums">
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          estaVencido
                            ? "bg-erro-fundo text-erro font-bold border border-erro/30"
                            : estaProximoVencimento
                            ? "bg-alerta-fundo text-alerta font-semibold border border-alerta/30"
                            : "text-texto-suave"
                        }`}
                        title={estaVencido ? "Prazo vencido!" : estaProximoVencimento ? "Vence em até 2 dias!" : undefined}
                      >
                        {format(parseISO(c.prazo), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </td>

                    {/* Responsável (Primeiro e Último Nome) */}
                    <td className="text-xs text-texto" title={c.perfis?.nome_completo || "Histórico"}>
                      {formatarNomeResponsavel(c.perfis?.nome_completo)}
                    </td>

                    {/* Ações */}
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/chamados/${c.id}`}
                          className="rounded p-1 text-texto-suave hover:bg-superficie hover:text-texto"
                          title="Visualizar detalhes do chamado"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>

                        {podeEditar && (
                          <Link
                            href={`/chamados/${c.id}/editar`}
                            className="rounded p-1 text-texto-suave hover:bg-superficie hover:text-texto"
                            title="Editar chamado"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Link>
                        )}

                        {podeExcluir && (
                          <button
                            type="button"
                            onClick={() => setIdExcluindo(c.id)}
                            className="rounded p-1 text-texto-suave hover:bg-erro-fundo hover:text-erro"
                            title="Excluir chamado (exclusão lógica)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Modal de Confirmação de Exclusão */}
      {idExcluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded border border-borda bg-fundo p-5 shadow-lg space-y-3">
            <h3 className="font-heading text-sm font-bold text-texto">Confirmar exclusão de chamado</h3>
            <p className="text-xs text-texto-suave">
              Esta ação removerá o chamado das listagens ativas e registrará a exclusão nos logs de auditoria. Deseja prosseguir?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-borda/40">
              <button
                type="button"
                onClick={() => setIdExcluindo(null)}
                className="rounded border border-borda bg-superficie px-3 py-1.5 text-xs font-medium text-texto hover:bg-fundo"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExcluir}
                className="rounded bg-erro px-3 py-1.5 text-xs font-medium text-white hover:bg-erro/90"
              >
                Confirmar exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
