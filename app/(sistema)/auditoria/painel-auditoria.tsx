"use client";

import { formatarInstante } from "@/lib/datas";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { type LogAuditoria } from "@/types/database";
import { Search, ChevronLeft, ChevronRight, Download, RotateCcw, Eye, X } from "lucide-react";
import Link from "next/link";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";

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

const opcoesTabela: CustomSelectOption[] = [
  { value: "", label: "Todas as tabelas" },
  { value: "chamados", label: "chamados", sublabel: "Protocolos acadêmicos" },
  { value: "exportacao_chamados", label: "exportacao_chamados", sublabel: "Exportações CSV" },
  {
    value: "arquivos_conteudo",
    label: "arquivos_conteudo",
    sublabel: "Conteúdo técnico de anexos",
  },
  { value: "motivos", label: "motivos", sublabel: "Catálogo de motivos" },
  { value: "perfis", label: "perfis", sublabel: "Equipe e contas do sistema" },
  { value: "credenciais_externas", label: "credenciais_externas", sublabel: "Cofre cifrado" },
];

const opcoesOperacao: CustomSelectOption[] = [
  { value: "", label: "Todas as operações" },
  { value: "INSERT", label: "INSERT (Criação)" },
  { value: "UPDATE", label: "UPDATE (Edição)" },
  { value: "DELETE", label: "DELETE (Exclusão)" },
];

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
    <div className="space-y-8">
      {/* 1. Cabeçalho Padronizado da Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Logs de Auditoria do Sistema
          </h1>
          <p className="text-sm text-texto-suave mt-0.5">
            Rastreamento completo de operações em banco de dados, alterações cadastrais, arquivos e
            acessos.
          </p>
        </div>

        <Link
          href={`/auditoria/exportar?${searchParams.toString()}`}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo transition"
        >
          <Download className="h-4 w-4 text-texto-suave" />
          <span>Exportar CSV</span>
        </Link>
      </div>

      {/* 2. Filtros */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Busca Textual */}
          <div>
            <label className="block text-xs font-medium text-texto mb-1.5">
              Buscar em Detalhes
            </label>
            <div className="relative">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") aplicarFiltro("busca", busca);
                }}
                placeholder="Ex: protocolo, ID, IP..."
                className="w-full rounded-lg border border-borda bg-fundo pl-9 pr-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-texto-suave" />
            </div>
          </div>

          {/* Filtro Tabela */}
          <CustomSelect
            label="Tabela Afetada"
            options={opcoesTabela}
            value={filtrosAtuais.tabela || ""}
            onChange={(val) => aplicarFiltro("tabela", val)}
          />

          {/* Filtro Operação */}
          <CustomSelect
            label="Tipo de Operação"
            options={opcoesOperacao}
            value={filtrosAtuais.operacao || ""}
            onChange={(val) => aplicarFiltro("operacao", val)}
          />

          {/* Período */}
          <div>
            <CustomDatePicker
              label="Data Específica"
              value={filtrosAtuais.data_inicio || ""}
              onChange={(val) => aplicarFiltro("data_inicio", val)}
              placeholder="dd/mm/aaaa"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-borda pt-3">
          <button
            type="button"
            onClick={limparFiltros}
            className="inline-flex items-center gap-1 h-9 px-4 rounded-lg border border-borda bg-fundo text-xs font-semibold text-texto-suave hover:text-texto hover:bg-superficie transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Limpar filtros</span>
          </button>
          <button
            type="button"
            onClick={() => aplicarFiltro("busca", busca)}
            disabled={isPending}
            className="inline-flex items-center gap-1 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover disabled:opacity-50 transition"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{isPending ? "Filtrando..." : "Filtrar"}</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela de Logs */}
      <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th className="w-36">Data / Hora</th>
              <th className="w-24 text-center">Operação</th>
              <th className="w-32">Tabela</th>
              <th className="w-40">Responsável</th>
              <th className="w-28">Endereço IP</th>
              <th>Resumo da Alteração</th>
              <th className="w-16 text-right">Ver</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-texto-suave">
                  Nenhum registro de auditoria encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="font-mono text-xs tabular-nums text-texto-suave">
                    {formatarInstante(log.criado_em, { segundos: true })}
                  </td>
                  <td className="text-center">
                    <span
                      className={`inline-flex items-center justify-center h-6 px-2 rounded text-[10px] font-semibold border ${
                        log.operacao === "INSERT"
                          ? "bg-sucesso-fundo/40 text-sucesso border-sucesso/30"
                          : log.operacao === "UPDATE"
                            ? "bg-alerta-fundo/40 text-alerta border-alerta/30"
                            : "bg-erro-fundo text-erro border-erro/30"
                      }`}
                    >
                      {log.operacao}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-acento">{log.tabela}</td>
                  <td className="text-xs text-texto truncate max-w-[150px]">
                    {log.usuario_nome || "Sistema Automático"}
                  </td>
                  <td className="font-mono text-xs text-texto-suave tabular-nums">
                    {log.ip || "127.0.0.1"}
                  </td>
                  <td className="text-xs text-texto-suave font-mono truncate max-w-md">
                    {JSON.stringify(log.dados_depois || log.dados_antes || {})}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => setLogSelecionado(log)}
                      className="rounded-md p-1 text-texto-suave hover:bg-fundo hover:text-acento transition"
                      title="Ver detalhes do payload"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between text-xs text-texto-suave">
        <span>
          Total de <strong>{totalRegistros}</strong> registros (Página {paginaAtual} de{" "}
          {totalPaginas})
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => mudarPagina(paginaAtual - 1)}
            disabled={paginaAtual <= 1}
            className="h-8 px-2.5 rounded border border-borda bg-superficie font-medium text-texto hover:bg-fundo disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 font-mono tabular-nums">{paginaAtual}</span>
          <button
            type="button"
            onClick={() => mudarPagina(paginaAtual + 1)}
            disabled={paginaAtual >= totalPaginas}
            className="h-8 px-2.5 rounded border border-borda bg-superficie font-medium text-texto hover:bg-fundo disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal Detalhes do Log */}
      {logSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-borda bg-superficie p-6 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-borda pb-3">
              <h3 className="text-sm font-semibold text-texto">
                Detalhes do Registro #{logSelecionado.id}
              </h3>
              <button
                type="button"
                onClick={() => setLogSelecionado(null)}
                className="text-texto-suave hover:text-texto font-semibold"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto text-xs font-mono">
              <div className="grid grid-cols-2 gap-2 text-texto bg-fundo p-3 rounded-lg border border-borda">
                <div>
                  <strong>Tabela:</strong> {logSelecionado.tabela}
                </div>
                <div>
                  <strong>Operação:</strong> {logSelecionado.operacao}
                </div>
                <div>
                  <strong>Responsável:</strong> {logSelecionado.usuario_nome || "Sistema"}
                </div>
                <div>
                  <strong>Data:</strong>{" "}
                  {formatarInstante(logSelecionado.criado_em, { segundos: true })}
                </div>
              </div>

              {logSelecionado.dados_antes && (
                <div>
                  <span className="text-[11px] font-bold text-texto-suave block mb-1">
                    Dados Anteriores:
                  </span>
                  <pre className="rounded bg-fundo p-3 text-[11px] text-texto overflow-x-auto border border-borda">
                    {JSON.stringify(logSelecionado.dados_antes, null, 2)}
                  </pre>
                </div>
              )}

              {logSelecionado.dados_depois && (
                <div>
                  <span className="text-[11px] font-bold text-texto-suave block mb-1">
                    Dados Novos:
                  </span>
                  <pre className="rounded bg-fundo p-3 text-[11px] text-texto overflow-x-auto border border-borda">
                    {JSON.stringify(logSelecionado.dados_depois, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-borda pt-3">
              <button
                type="button"
                onClick={() => setLogSelecionado(null)}
                className="h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
