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
  X,
  Calendar
} from "lucide-react";
import Link from "next/link";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";

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
  { value: "arquivos", label: "arquivos", sublabel: "Anexos de chamados" },
  { value: "motivos", label: "motivos", sublabel: "Catálogo de motivos" },
  { value: "perfis", label: "perfis", sublabel: "Usuárias do sistema" },
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
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-superficie p-5 rounded-xl border border-borda shadow-sm">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto tracking-tight">
            Logs de Auditoria do Sistema
          </h1>
          <p className="text-xs text-texto-suave">
            Rastreamento completo de operações em banco de dados, alterações cadastrais, arquivos e acessos.
          </p>
        </div>

        <Link
          href={`/auditoria/exportar?${searchParams.toString()}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-borda bg-fundo px-4 py-2 text-xs font-bold text-texto transition hover:bg-superficie shadow-xs"
        >
          <Download className="h-4 w-4 text-texto-suave" />
          <span>Exportar CSV</span>
        </Link>
      </div>

      {/* Filtros de Alto Contraste com CustomSelect */}
      <div className="rounded-xl border border-borda bg-superficie p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Busca */}
          <div>
            <label className="block text-xs font-bold text-texto mb-1.5">
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
                className="w-full rounded-lg border border-borda bg-fundo pl-9 pr-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20 shadow-xs"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-texto-suave" />
            </div>
          </div>

          {/* Filtro Tabela Customizado */}
          <CustomSelect
            label="Tabela"
            options={opcoesTabela}
            value={filtrosAtuais.tabela || ""}
            onChange={(val) => aplicarFiltro("tabela", val)}
          />

          {/* Filtro Operação Customizado */}
          <CustomSelect
            label="Operação"
            options={opcoesOperacao}
            value={filtrosAtuais.operacao || ""}
            onChange={(val) => aplicarFiltro("operacao", val)}
          />

          {/* Data de Início */}
          <div>
            <label className="block text-xs font-bold text-texto mb-1.5">
              Data de Início
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-borda bg-fundo px-3 py-2 shadow-xs">
              <Calendar className="h-4 w-4 text-texto-suave" />
              <input
                type="date"
                value={filtrosAtuais.data_inicio || ""}
                onChange={(e) => aplicarFiltro("data_inicio", e.target.value)}
                className="w-full bg-transparent font-mono text-xs font-semibold text-texto focus:outline-none"
              />
            </div>
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-xs font-bold text-texto mb-1.5">
              Data Final
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-borda bg-fundo px-3 py-2 shadow-xs">
              <Calendar className="h-4 w-4 text-texto-suave" />
              <input
                type="date"
                value={filtrosAtuais.data_fim || ""}
                onChange={(e) => aplicarFiltro("data_fim", e.target.value)}
                className="w-full bg-transparent font-mono text-xs font-semibold text-texto focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-borda pt-3 text-xs">
          <span className="text-texto-suave">
            Total de <strong>{totalRegistros}</strong> registros de auditoria.
          </span>
          <button
            type="button"
            onClick={limparFiltros}
            className="inline-flex items-center gap-1 text-xs font-bold text-texto-suave hover:text-texto"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Limpar filtros</span>
          </button>
        </div>
      </div>

      {/* Tabela de Logs */}
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie shadow-sm">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th className="w-44">Data e Hora</th>
              <th className="w-28 text-center">Operação</th>
              <th className="w-36">Tabela</th>
              <th className="w-32">Protocolo</th>
              <th>Usuária Responsável</th>
              <th className="w-32 font-mono">Endereço IP</th>
              <th>Campos Alterados</th>
              <th className="w-20 text-right">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-texto-suave font-medium">
                  Nenhum log de auditoria encontrado.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs tabular-nums text-texto-suave font-semibold">
                    {format(parseISO(l.criado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </td>
                  <td className="text-center">
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${
                        l.operacao === "INSERT"
                          ? "bg-sucesso/15 text-sucesso border-sucesso/40"
                          : l.operacao === "UPDATE"
                          ? "bg-alerta-fundo text-alerta border-alerta/40"
                          : "bg-erro-fundo text-erro border-erro/40"
                      }`}
                    >
                      {l.operacao}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-texto font-bold">{l.tabela}</td>
                  <td className="font-mono text-xs tabular-nums font-bold text-acento">
                    {l.protocolo || "—"}
                  </td>
                  <td className="text-xs text-texto font-bold">
                    {l.usuario_nome || "Sistema"}
                  </td>
                  <td className="font-mono text-xs tabular-nums text-texto-suave">
                    {l.ip || "127.0.0.1"}
                  </td>
                  <td className="text-xs text-texto-suave truncate max-w-xs" title={l.campos_alterados?.join(", ")}>
                    {l.campos_alterados && l.campos_alterados.length > 0
                      ? l.campos_alterados.join(", ")
                      : "—"}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => setLogSelecionado(l)}
                      className="rounded-md p-1.5 text-texto-suave hover:bg-fundo hover:text-acento transition"
                      title="Inspecionar dados antes e depois"
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
      <div className="flex items-center justify-between border-t border-borda pt-3 text-xs">
        <div className="text-texto-suave font-medium">
          Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={paginaAtual <= 1 || isPending}
            onClick={() => mudarPagina(paginaAtual - 1)}
            className="flex items-center gap-1 rounded-lg border border-borda bg-superficie px-3 py-1.5 text-xs font-bold text-texto transition hover:bg-fundo disabled:opacity-40 shadow-xs"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Anterior</span>
          </button>
          <button
            type="button"
            disabled={paginaAtual >= totalPaginas || isPending}
            onClick={() => mudarPagina(paginaAtual + 1)}
            className="flex items-center gap-1 rounded-lg border border-borda bg-superficie px-3 py-1.5 text-xs font-bold text-texto transition hover:bg-fundo disabled:opacity-40 shadow-xs"
          >
            <span>Próxima</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal de Inspeção Antes / Depois */}
      {logSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-borda bg-fundo p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-borda pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-acento" />
                <h3 className="font-heading text-sm font-bold text-texto">
                  Auditoria #{logSelecionado.id} — {logSelecionado.tabela} ({logSelecionado.operacao})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLogSelecionado(null)}
                className="text-texto-suave hover:text-texto font-bold"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-texto-suave block mb-1">
                  Dados Antes da Operação
                </span>
                <pre className="rounded-lg border border-borda bg-superficie p-3 text-[11px] font-mono text-texto overflow-x-auto whitespace-pre-wrap shadow-inner">
                  {logSelecionado.dados_antes
                    ? JSON.stringify(logSelecionado.dados_antes, null, 2)
                    : "null (Registro novo)"}
                </pre>
              </div>

              <div>
                <span className="font-bold text-texto-suave block mb-1">
                  Dados Depois da Operação
                </span>
                <pre className="rounded-lg border border-borda bg-superficie p-3 text-[11px] font-mono text-texto overflow-x-auto whitespace-pre-wrap shadow-inner">
                  {logSelecionado.dados_depois
                    ? JSON.stringify(logSelecionado.dados_depois, null, 2)
                    : "null (Excluído)"}
                </pre>
              </div>
            </div>

            {logSelecionado.campos_alterados && (
              <div className="text-xs">
                <span className="font-bold text-texto-suave block mb-1">
                  Campos Modificados
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {logSelecionado.campos_alterados.map((campo) => (
                    <span
                      key={campo}
                      className="rounded-md border border-acento/40 bg-acento/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-acento"
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
