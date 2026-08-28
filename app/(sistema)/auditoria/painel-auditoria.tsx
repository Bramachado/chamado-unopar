"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { type LogAuditoria } from "@/types/database";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  RotateCcw, 
  FileText,
  Eye,
  X
} from "lucide-react";
import Link from "next/link";

interface PainelAuditoriaProps {
  logs: LogAuditoria[];
  totalRegistros: number;
  paginaAtual: number;
  porPagina: number;
  filtrosAtuais: {
    busca?: string;
    tabela?: string;
    operacao?: string;
    data_inicio?: string;
    data_fim?: string;
  };
}

export function PainelAuditoria({
  logs,
  totalRegistros,
  paginaAtual,
  porPagina,
  filtrosAtuais,
}: PainelAuditoriaProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [busca, setBusca] = useState(filtrosAtuais.busca || "");
  const [logSelecionado, setLogSelecionado] = useState<LogAuditoria | null>(null);

  const totalPaginas = Math.ceil(totalRegistros / porPagina) || 1;

  const aplicarFiltro = (chave: string, valor?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor && valor !== "") {
      params.set(chave, valor);
    } else {
      params.delete(chave);
    }
    params.set("pagina", "1");
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

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-texto">
            Logs de Auditoria do Sistema
          </h1>
          <p className="text-xs text-texto-suave">
            Rastreamento completo de operações em banco de dados, alterações cadastrais e acessos.
          </p>
        </div>

        <Link
          href={`/auditoria/exportar?${searchParams.toString()}`}
          className="inline-flex items-center gap-1.5 rounded border border-borda bg-superficie px-3 py-1.5 text-xs font-medium text-texto transition hover:bg-fundo"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Exportar CSV</span>
        </Link>
      </div>

      {/* Filtros */}
      <div className="rounded border border-borda bg-superficie p-3 space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-[11px] font-medium text-texto mb-0.5">
              Buscar (Usuária ou Protocolo)
            </label>
            <div className="relative">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") aplicarFiltro("busca", busca);
                }}
                placeholder="Nome ou CS..."
                className="w-full rounded border border-borda bg-fundo px-2.5 py-1 pl-8 text-xs text-texto placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
              />
              <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-texto-suave" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-texto mb-0.5">
              Tabela
            </label>
            <select
              value={filtrosAtuais.tabela || ""}
              onChange={(e) => aplicarFiltro("tabela", e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2 py-1 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="">Todas</option>
              <option value="chamados">chamados</option>
              <option value="motivos">motivos</option>
              <option value="perfis">perfis</option>
              <option value="credenciais_externas">credenciais_externas</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-texto mb-0.5">
              Operação
            </label>
            <select
              value={filtrosAtuais.operacao || ""}
              onChange={(e) => aplicarFiltro("operacao", e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2 py-1 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="">Todas</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-texto mb-0.5">
              Data Início
            </label>
            <input
              type="date"
              value={filtrosAtuais.data_inicio || ""}
              onChange={(e) => aplicarFiltro("data_inicio", e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2 py-1 font-mono text-xs text-texto focus:border-acento focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-texto mb-0.5">
              Data Fim
            </label>
            <input
              type="date"
              value={filtrosAtuais.data_fim || ""}
              onChange={(e) => aplicarFiltro("data_fim", e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-2 py-1 font-mono text-xs text-texto focus:border-acento focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-borda/40 pt-2 text-xs">
          <span className="text-texto-suave">
            Total de <strong>{totalRegistros}</strong> registros de auditoria.
          </span>
          <button
            type="button"
            onClick={limparFiltros}
            className="inline-flex items-center gap-1 text-[11px] text-texto-suave hover:text-texto"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Limpar filtros</span>
          </button>
        </div>
      </div>

      {/* Tabela de Logs */}
      <div className="overflow-x-auto rounded border border-borda bg-fundo shadow-sm">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th className="w-40">Data e Hora</th>
              <th className="w-24">Operação</th>
              <th className="w-36">Tabela</th>
              <th className="w-28">Protocolo</th>
              <th>Usuária Responsável</th>
              <th className="w-28 font-mono">IP</th>
              <th>Campos Alterados</th>
              <th className="w-20 text-right">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-texto-suave">
                  Nenhum log de auditoria encontrado.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs tabular-nums text-texto-suave">
                    {format(parseISO(l.criado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </td>
                  <td>
                    <span
                      className={`inline-block rounded border px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                        l.operacao === "INSERT"
                          ? "bg-sucesso/10 text-sucesso border-sucesso/30"
                          : l.operacao === "UPDATE"
                          ? "bg-alerta-fundo text-alerta border-alerta/30"
                          : "bg-erro-fundo text-erro border-erro/30"
                      }`}
                    >
                      {l.operacao}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-texto">{l.tabela}</td>
                  <td className="font-mono text-xs tabular-nums font-semibold text-acento">
                    {l.protocolo || "-"}
                  </td>
                  <td className="text-xs text-texto font-medium">
                    {l.usuario_nome || "Sistema"}
                  </td>
                  <td className="font-mono text-xs tabular-nums text-texto-suave">
                    {l.ip || "127.0.0.1"}
                  </td>
                  <td className="text-xs text-texto-suave truncate max-w-xs" title={l.campos_alterados?.join(", ")}>
                    {l.campos_alterados && l.campos_alterados.length > 0
                      ? l.campos_alterados.join(", ")
                      : "-"}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => setLogSelecionado(l)}
                      className="rounded p-1 text-texto-suave hover:bg-superficie hover:text-texto"
                      title="Inspecionar dados antes e depois"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
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

      {/* Modal de Inspeção Antes / Depois */}
      {logSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded border border-borda bg-fundo p-5 shadow-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-borda/40 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-acento" />
                <h3 className="text-sm font-semibold text-texto">
                  Auditoria #{logSelecionado.id} — {logSelecionado.tabela} ({logSelecionado.operacao})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLogSelecionado(null)}
                className="text-texto-suave hover:text-texto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-texto-suave block mb-1">
                  Dados Antes da Operação
                </span>
                <pre className="rounded border border-borda bg-superficie p-3 text-[11px] font-mono text-texto overflow-x-auto whitespace-pre-wrap">
                  {logSelecionado.dados_antes
                    ? JSON.stringify(logSelecionado.dados_antes, null, 2)
                    : "null (Registro novo)"}
                </pre>
              </div>

              <div>
                <span className="font-semibold text-texto-suave block mb-1">
                  Dados Depois da Operação
                </span>
                <pre className="rounded border border-borda bg-superficie p-3 text-[11px] font-mono text-texto overflow-x-auto whitespace-pre-wrap">
                  {logSelecionado.dados_depois
                    ? JSON.stringify(logSelecionado.dados_depois, null, 2)
                    : "null (Excluído)"}
                </pre>
              </div>
            </div>

            {logSelecionado.campos_alterados && (
              <div className="text-xs">
                <span className="font-semibold text-texto-suave block mb-1">
                  Campos Efetivamente Modificados
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {logSelecionado.campos_alterados.map((campo) => (
                    <span
                      key={campo}
                      className="rounded border border-acento/30 bg-acento/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-acento"
                    >
                      {campo}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
