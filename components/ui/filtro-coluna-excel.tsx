"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Filter, X, Search, Check } from "lucide-react";

export interface ItemFiltroExcel {
  valor: string;
  contagem: number;
}

interface FiltroColunaExcelProps {
  titulo: string;
  itens: ItemFiltroExcel[];
  selecionados?: Set<string>;
  onAplicar: (novosSelecionados: Set<string> | undefined) => void;
  alinhamento?: "left" | "right";
}

export function FiltroColunaExcel({
  titulo,
  itens,
  selecionados,
  onAplicar,
  alinhamento = "left",
}: FiltroColunaExcelProps) {
  const [aberto, setAberto] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  // Estado temporário enquanto o modal estiver aberto
  const [temporarios, setTemporarios] = useState<Set<string>>(() => new Set(selecionados || []));

  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar temporários quando abrir ou quando selecionados mudarem externamente
  useEffect(() => {
    if (aberto) {
      setTemporarios(new Set(selecionados || []));
      setTermoBusca("");
    }
  }, [aberto, selecionados]);

  // Fechar ao clicar fora
  useEffect(() => {
    if (!aberto) return;

    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }

    document.addEventListener("mousedown", handleClickFora);
    return () => {
      document.removeEventListener("mousedown", handleClickFora);
    };
  }, [aberto]);

  const temFiltroAtivo = Boolean(selecionados && selecionados.size > 0);

  // Itens filtrados pela caixa de pesquisa do menu
  const itensVisiveis = useMemo(() => {
    if (!termoBusca.trim()) return itens;
    const termo = termoBusca.toLowerCase().trim();
    return itens.filter((item) => item.valor.toLowerCase().includes(termo));
  }, [itens, termoBusca]);

  const todosVisiveisEstaoMarcados =
    itensVisiveis.length > 0 && itensVisiveis.every((i) => temporarios.has(i.valor));

  const alternarSelecionarTodos = () => {
    setTemporarios((prev) => {
      const novo = new Set(prev);
      if (todosVisiveisEstaoMarcados) {
        itensVisiveis.forEach((i) => novo.delete(i.valor));
      } else {
        itensVisiveis.forEach((i) => novo.add(i.valor));
      }
      return novo;
    });
  };

  const alternarItem = (val: string) => {
    setTemporarios((prev) => {
      const novo = new Set(prev);
      if (novo.has(val)) {
        novo.delete(val);
      } else {
        novo.add(val);
      }
      return novo;
    });
  };

  const handleAplicar = () => {
    if (temporarios.size === 0 || temporarios.size === itens.length) {
      // Se não marcou nada ou marcou todos, limpa o filtro
      onAplicar(undefined);
    } else {
      onAplicar(new Set(temporarios));
    }
    setAberto(false);
  };

  const handleLimpar = () => {
    setTemporarios(new Set());
    onAplicar(undefined);
    setAberto(false);
  };

  return (
    <div className="relative inline-flex items-center ml-1" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberto(!aberto);
        }}
        title={
          temFiltroAtivo
            ? `Filtro ativo (${selecionados?.size} selecionado${(selecionados?.size || 0) > 1 ? "s" : ""})`
            : `Filtrar coluna ${titulo} (estilo Excel)`
        }
        className={`inline-flex items-center justify-center h-5 w-5 rounded transition-all ${
          temFiltroAtivo
            ? "bg-acento text-white shadow-xs ring-2 ring-acento/30"
            : "text-texto-suave/60 hover:text-texto hover:bg-superficie/80"
        }`}
      >
        <Filter className={`h-3 w-3 ${temFiltroAtivo ? "stroke-[2.5]" : ""}`} />
      </button>

      {/* Popover suspenso de filtro estilo Excel */}
      {aberto && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full mt-1.5 z-50 w-80 sm:w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-borda bg-superficie p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 text-left ${
            alinhamento === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Cabeçalho do Popover */}
          <div className="flex items-center justify-between pb-2 border-b border-borda/60">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-acento" />
              <span className="text-xs font-bold text-texto">
                Filtrar: <span className="text-acento">{titulo}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="p-1 rounded-md text-texto-suave hover:text-texto hover:bg-fundo transition"
              title="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative my-2.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-texto-suave" />
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Pesquisar nesta coluna..."
              className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-borda bg-fundo text-xs text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none shadow-2xs"
              autoFocus
            />
            {termoBusca && (
              <button
                type="button"
                onClick={() => setTermoBusca("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-texto-suave hover:text-texto"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Opção Selecionar Tudo / Limpar Todos */}
          <div className="flex items-center justify-between px-1 py-1 text-[11px] border-b border-borda/40 mb-1.5">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-texto select-none">
              <input
                type="checkbox"
                checked={todosVisiveisEstaoMarcados}
                onChange={alternarSelecionarTodos}
                className="rounded border-borda text-acento focus:ring-0 cursor-pointer h-3.5 w-3.5"
              />
              <span>(Selecionar tudo)</span>
            </label>
            {temporarios.size > 0 && (
              <button
                type="button"
                onClick={() => setTemporarios(new Set())}
                className="text-[10px] text-acento hover:underline font-semibold"
              >
                Desmarcar todos
              </button>
            )}
          </div>

          {/* Lista com Rolagem de Itens Distintos */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 divide-y divide-borda/20 tabela-scroll">
            {itensVisiveis.length === 0 ? (
              <div className="py-4 text-center text-xs text-texto-suave italic">
                Nenhum valor correspondente
              </div>
            ) : (
              itensVisiveis.map((item) => {
                const marcado = temporarios.has(item.valor);
                return (
                  <label
                    key={item.valor}
                    className="flex items-start justify-between gap-2.5 px-1.5 py-1.5 rounded-md hover:bg-fundo cursor-pointer text-xs select-none transition group"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarItem(item.valor)}
                        className="rounded border-borda text-acento focus:ring-0 cursor-pointer h-3.5 w-3.5 mt-0.5 shrink-0"
                      />
                      <span
                        className={`text-xs leading-snug break-words ${
                          marcado
                            ? "font-semibold text-texto"
                            : "text-texto-suave group-hover:text-texto"
                        }`}
                      >
                        {item.valor}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-texto-suave/80 shrink-0 bg-fundo px-1 py-0.5 rounded border border-borda/40 mt-0.5">
                      {item.contagem}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {/* Rodapé com Ações */}
          <div className="flex items-center justify-between gap-2 pt-2.5 mt-2 border-t border-borda/60">
            {temFiltroAtivo ? (
              <button
                type="button"
                onClick={handleLimpar}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
              >
                Limpar filtro
              </button>
            ) : (
              <span className="text-[10px] text-texto-suave">
                {temporarios.size} de {itens.length} marcado{temporarios.size === 1 ? "" : "s"}
              </span>
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="h-7 px-2.5 rounded-md text-xs font-medium text-texto-suave hover:text-texto hover:bg-fundo transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAplicar}
                className="inline-flex items-center gap-1 h-7 px-3 rounded-md bg-acento text-xs font-semibold text-white hover:bg-acento-hover transition shadow-xs"
              >
                <Check className="h-3 w-3" />
                <span>Aplicar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
