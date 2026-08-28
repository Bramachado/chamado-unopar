"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format, parseISO, isBefore, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type Perfil } from "@/types/database";
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Edit2, 
  Trash2, 
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { excluirChamadoAction } from "./actions";

interface ChamadoLinha {
  id: string;
  protocolo: string;
  aluno_nome: string;
  aluno_ra?: string | null;
  contato_telefone?: string | null;
  situacao: "aguardando" | "concluido" | "encerrado";
  prioridade: "normal" | "priorizar";
  data_solicitacao: string;
  prazo: string;
  data_conclusao?: string | null;
  importado: boolean;
  criado_por: string;
  criado_em: string;
  motivos?: { id: string; codigo: string; nome: string } | null;
  perfis?: { id: string; nome_completo: string } | null;
}

interface TabelaChamadosProps {
  dados: ChamadoLinha[];
  totalRegistros: number;
  paginaAtual: number;
  porPagina: number;
  motivos: { id: string; codigo: string; nome: string }[];
  usuarias: { id: string; nome_completo: string }[];
  perfilAtual: Perfil;
  filtrosAtuais: {
    busca?: string;
    situacao?: string;
    prioridade?: string;
    motivo_id?: string;
    responsavel_id?: string;
    data_inicio?: string;
    data_fim?: string;
  };
}

export function TabelaChamados({
  dados,
  totalRegistros,
  paginaAtual,
  porPagina,
  motivos,
  usuarias,
  perfilAtual,
  filtrosAtuais,
}: TabelaChamadosProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [busca, setBusca] = useState(filtrosAtuais.busca || "");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const totalPaginas = Math.ceil(totalRegistros / porPagina) || 1;

  const aplicarFiltro = (chave: string, valor?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor && valor !== "") {
      params.set(chave, valor);
    } else {
      params.delete(chave);
    }
    params.set("pagina", "1"); // Reinicia para a primeira página
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const limparFiltros = () => {
    setBusca("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  const mudarPagina = (novaPagina: number) => {
    if (novaPagina < 1 || novaPagina > totalPaginas) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("pagina", novaPagina.toString());
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const formatarTelefone = (tel?: string | null) => {
    if (!tel) return "-";
    const d = tel.replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return tel;
  };

  const calcularStatusPrazo = (chamado: ChamadoLinha) => {
    if (chamado.situacao === "concluido") {
      return { rotulo: "Concluído", classe: "bg-sucesso/10 text-sucesso border-sucesso/30" };
    }
    if (chamado.situacao === "encerrado") {
      return { rotulo: "Encerrado", classe: "bg-texto-suave/10 text-texto-suave border-borda" };
    }

    const hoje = startOfDay(new Date());
    const dataPrazo = startOfDay(parseISO(chamado.prazo));
    const limiteAlerta = addDays(hoje, 2);

    if (isBefore(dataPrazo, hoje)) {
      return { rotulo: "Vencido", classe: "bg-erro-fundo text-erro border-erro/30 font-semibold" };
    }
    if (isBefore(dataPrazo, limiteAlerta) || dataPrazo.getTime() === limiteAlerta.getTime()) {
      return { rotulo: "Vence em 2 dias", classe: "bg-alerta-fundo text-alerta border-alerta/30 font-medium" };
    }

    return { rotulo: "No prazo", classe: "bg-superficie text-texto border-borda" };
  };

  const podeEditar = (chamado: ChamadoLinha) => {
    if (perfilAtual.papel === "admin") return true;
    return chamado.criado_por === perfilAtual.id;
  };

  const podeExcluir = (chamado: ChamadoLinha) => {
    if (perfilAtual.papel === "admin") return true;
    if (perfilAtual.papel === "atendente" && chamado.criado_por === perfilAtual.id) return true;
    return false; // Coordenadoras não excluem, atendente não exclui de outra
  };

  const confirmarExclusao = async (id: string) => {
    setErroExclusao(null);
    if (!confirm("Deseja realmente mover este chamado para a exclusão lógica?")) {
      return;
    }
    setExcluindoId(id);
    const res = await excluirChamadoAction(id);
    setExcluindoId(null);
    if (!res.sucesso) {
      setErroExclusao(res.erro || "Falha ao excluir chamado.");
    }
  };

  return (
    <div className="space-y-3">
      {/* Mensagem de Erro de Ação */}
      {erroExclusao && (
        <div className="flex items-center gap-2 rounded border border-erro/30 bg-erro-fundo p-3 text-xs text-erro">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{erroExclusao}</span>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="rounded border border-borda bg-superficie p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {/* Busca por protocolo ou nome */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-texto mb-0.5">
              Buscar (Protocolo CS... ou Nome)
            </label>
            <div className="relative">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    aplicarFiltro("busca", busca);
                  }
                }}
                placeholder="CS12345678 ou Nome do aluno"
                className="w-full rounded border border-borda bg-fundo px-2.5 py-1 pl-8 text-xs text-texto placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
              />
              <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-texto-suave" />
            </div>
          </div>

          {/* Filtro: Situação */}
          <div>
            <label className="block text-[11px] font-medium text-texto mb-0.5">
              Situação
            </label>
            <select
              value={filtrosAtuais.situacao || ""}
              onChange={(e) => aplicarFiltro("situacao", e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2 py-1 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="">Todas</option>
              <option value="aguardando">Aguardando</option>
              <option value="concluido">Concluído</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>

          {/* Filtro: Prioridade */}
          <div>
            <label className="block text-[11px] font-medium text-texto mb-0.5">
              Prioridade
            </label>
            <select
              value={filtrosAtuais.prioridade || ""}
              onChange={(e) => aplicarFiltro("prioridade", e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2 py-1 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="">Todas</option>
              <option value="normal">Normal</option>
              <option value="priorizar">Priorizar</option>
            </select>
          </div>

          {/* Filtro: Motivo */}
          <div>
            <label className="block text-[11px] font-medium text-texto mb-0.5">
              Motivo
            </label>
            <select
              value={filtrosAtuais.motivo_id || ""}
              onChange={(e) => aplicarFiltro("motivo_id", e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2 py-1 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="">Todos</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo} {m.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro: Atendente / Responsável */}
          <div>
            <label className="block text-[11px] font-medium text-texto mb-0.5">
              Responsável
            </label>
            <select
              value={filtrosAtuais.responsavel_id || ""}
              onChange={(e) => aplicarFiltro("responsavel_id", e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2 py-1 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="">Todas</option>
              {usuarias.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome_completo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botão de Limpeza e Indicador de Filtros */}
        <div className="mt-2 flex items-center justify-between border-t border-borda/40 pt-2 text-xs">
          <span className="text-texto-suave">
            Exibindo <strong>{dados.length}</strong> de <strong>{totalRegistros}</strong> protocolos encontrados.
          </span>
          <button
            type="button"
            onClick={limparFiltros}
            className="inline-flex items-center gap-1 text-[11px] text-texto-suave transition hover:text-texto"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Limpar filtros</span>
          </button>
        </div>
      </div>

      {/* Tabela de Dados Densa */}
      <div className="overflow-x-auto rounded border border-borda bg-fundo shadow-sm">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th className="w-28">Protocolo</th>
              <th>Aluno</th>
              <th className="w-28">Telefone</th>
              <th>Motivo</th>
              <th className="w-24">Situação</th>
              <th className="w-24">Prioridade</th>
              <th className="w-24">Solicitação</th>
              <th className="w-32">Prazo</th>
              <th className="w-28">Responsável</th>
              <th className="w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {dados.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-xs text-texto-suave">
                  Nenhum protocolo encontrado com os critérios selecionados.
                </td>
              </tr>
            ) : (
              dados.map((c) => {
                const statusPrazo = calcularStatusPrazo(c);
                return (
                  <tr key={c.id} className="transition-colors">
                    <td className="font-mono text-xs font-semibold tabular-nums text-texto">
                      <Link
                        href={`/chamados/${c.id}`}
                        className="hover:underline hover:text-acento"
                      >
                        {c.protocolo}
                      </Link>
                    </td>
                    <td>
                      <div className="font-medium text-texto leading-tight">
                        {c.aluno_nome}
                      </div>
                      {c.aluno_ra && (
                        <div className="text-[11px] font-mono text-texto-suave tabular-nums">
                          RA: {c.aluno_ra}
                        </div>
                      )}
                    </td>
                    <td className="font-mono text-xs tabular-nums text-texto-suave">
                      {formatarTelefone(c.contato_telefone)}
                    </td>
                    <td className="text-xs text-texto">
                      {c.motivos ? (
                        <span>
                          <span className="font-mono text-texto-suave font-semibold mr-1">
                            {c.motivos.codigo}
                          </span>
                          {c.motivos.nome}
                        </span>
                      ) : (
                        <span className="text-texto-suave">-</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium capitalize ${
                          c.situacao === "concluido"
                            ? "bg-sucesso/10 text-sucesso border-sucesso/30"
                            : c.situacao === "encerrado"
                            ? "bg-texto-suave/10 text-texto-suave border-borda"
                            : "bg-superficie text-texto border-borda"
                        }`}
                      >
                        {c.situacao}
                      </span>
                    </td>
                    <td>
                      {c.prioridade === "priorizar" ? (
                        <span className="inline-block rounded border border-alerta/40 bg-alerta-fundo px-1.5 py-0.5 text-[11px] font-semibold text-alerta">
                          Priorizar
                        </span>
                      ) : (
                        <span className="text-xs text-texto-suave">Normal</span>
                      )}
                    </td>
                    <td className="font-mono text-xs tabular-nums text-texto-suave">
                      {format(parseISO(c.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs tabular-nums text-texto">
                          {format(parseISO(c.prazo), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <span
                          className={`mt-0.5 inline-block w-fit rounded border px-1 py-0.2 text-[10px] ${statusPrazo.classe}`}
                        >
                          {statusPrazo.rotulo}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs text-texto-suave truncate max-w-[120px]" title={c.perfis?.nome_completo}>
                      {c.perfis?.nome_completo || "Histórico"}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/chamados/${c.id}`}
                          className="rounded p-1 text-texto-suave hover:bg-superficie hover:text-texto"
                          title="Detalhar protocolo"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        {podeEditar(c) && (
                          <Link
                            href={`/chamados/${c.id}/editar`}
                            className="rounded p-1 text-texto-suave hover:bg-superficie hover:text-texto"
                            title="Editar chamado"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        {podeExcluir(c) && (
                          <button
                            type="button"
                            disabled={excluindoId === c.id}
                            onClick={() => confirmarExclusao(c.id)}
                            className="rounded p-1 text-texto-suave hover:bg-superficie hover:text-erro disabled:opacity-50"
                            title="Excluir logicamente"
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

      {/* Paginação */}
      <div className="flex items-center justify-between border-t border-borda pt-3 text-xs">
        <div className="text-texto-suave">
          Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={paginaAtual <= 1 || isPending}
            onClick={() => mudarPagina(paginaAtual - 1)}
            className="flex items-center gap-1 rounded border border-borda bg-superficie px-2 py-1 text-xs text-texto transition hover:bg-fundo disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Anterior</span>
          </button>
          <button
            type="button"
            disabled={paginaAtual >= totalPaginas || isPending}
            onClick={() => mudarPagina(paginaAtual + 1)}
            className="flex items-center gap-1 rounded border border-borda bg-superficie px-2 py-1 text-xs text-texto transition hover:bg-fundo disabled:opacity-40"
          >
            <span>Próxima</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
