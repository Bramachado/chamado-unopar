"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  setMonth,
  setYear,
} from "date-fns";

interface CustomDatePickerProps {
  value?: string; // Formato YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  name?: string;
  align?: "left" | "right";
  minDate?: string;
  maxDate?: string;
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export function CustomDatePicker({
  value,
  onChange,
  label,
  placeholder = "dd/mm/aaaa",
  disabled = false,
  required = false,
  className = "",
  name,
  align = "left",
}: CustomDatePickerProps) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Data selecionada válida
  const dataSelecionada = value && isValid(parseISO(value)) ? parseISO(value) : null;

  // Mês/Ano visualizado no calendário
  const [dataVisualizada, setDataVisualizada] = useState<Date>(dataSelecionada || new Date());

  // Sincroniza mês visualizado ao alterar o valor externo
  useEffect(() => {
    if (dataSelecionada) {
      setDataVisualizada(dataSelecionada);
    }
  }, [value]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }

    if (aberto) {
      document.addEventListener("mousedown", handleClickFora);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickFora);
    };
  }, [aberto]);

  // Fechar com tecla Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setAberto(false);
    }
  };

  // Geração da grade de dias (incluindo dias do mês anterior e posterior para preencher a semana)
  const inicioMes = startOfMonth(dataVisualizada);
  const fimMes = endOfMonth(dataVisualizada);
  const inicioGrade = startOfWeek(inicioMes, { weekStartsOn: 0 }); // Domingo
  const fimGrade = endOfWeek(fimMes, { weekStartsOn: 0 });
  const diasDaGrade = eachDayOfInterval({ start: inicioGrade, end: fimGrade });

  const hoje = new Date();

  const handleSelecionarDia = (dia: Date) => {
    const formatado = format(dia, "yyyy-MM-dd");
    onChange(formatado);
    setAberto(false);
  };

  const handleLimpar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const handleSelecionarHoje = () => {
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    onChange(hojeStr);
    setDataVisualizada(new Date());
    setAberto(false);
  };

  // Gerar lista de anos para seleção rápida (10 anos atrás até 5 anos à frente)
  const anoAtual = dataVisualizada.getFullYear();
  const anosDisponiveis = Array.from({ length: 16 }, (_, i) => anoAtual - 10 + i);

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {name && <input type="hidden" name={name} value={value || ""} required={required} />}

      {label && (
        <label className="block text-xs font-bold text-texto mb-1.5">
          {label} {required && <span className="text-erro">*</span>}
        </label>
      )}

      {/* Botão Gatilho / Input Customizado */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setAberto(!aberto)}
        className={`group flex items-center justify-between gap-2 rounded-lg border bg-fundo px-3 py-2 text-xs font-medium text-texto transition shadow-xs cursor-pointer select-none outline-none focus:border-acento focus:ring-2 focus:ring-acento/20 ${
          disabled ? "opacity-50 cursor-not-allowed bg-superficie-destaque" : "hover:border-borda"
        } ${aberto ? "border-acento ring-2 ring-acento/20" : "border-borda"}`}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon
            className={`h-4 w-4 shrink-0 transition-colors ${aberto ? "text-acento" : "text-texto-suave"}`}
          />
          {dataSelecionada ? (
            <span className="font-mono font-semibold text-texto tabular-nums">
              {format(dataSelecionada, "dd/MM/yyyy")}
            </span>
          ) : (
            <span className="text-texto-suave font-mono">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {dataSelecionada && !disabled && (
            <button
              type="button"
              onClick={handleLimpar}
              className="rounded p-0.5 text-texto-suave hover:bg-superficie hover:text-erro transition"
              title="Limpar data"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Popover / Calendário Flutuante */}
      {aberto && (
        <div
          className={`absolute z-50 mt-1.5 w-72 rounded-2xl border border-borda bg-superficie p-3.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Cabeçalho de Navegação de Mês e Ano */}
          <div className="flex items-center justify-between gap-1 pb-3 border-b border-borda">
            <button
              type="button"
              onClick={() => setDataVisualizada((prev) => subMonths(prev, 1))}
              className="btn-tátil rounded-lg p-1.5 text-texto-suave hover:bg-fundo hover:text-texto transition"
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Seletores de Mês e Ano Customizados */}
            <div className="flex items-center gap-1">
              <select
                value={dataVisualizada.getMonth()}
                onChange={(e) =>
                  setDataVisualizada((prev) => setMonth(prev, parseInt(e.target.value, 10)))
                }
                className="rounded-md bg-fundo px-2 py-1 text-xs font-bold text-texto border border-borda/60 focus:outline-none focus:border-acento cursor-pointer"
              >
                {MESES.map((nomeMes, idx) => (
                  <option key={nomeMes} value={idx}>
                    {nomeMes}
                  </option>
                ))}
              </select>

              <select
                value={dataVisualizada.getFullYear()}
                onChange={(e) =>
                  setDataVisualizada((prev) => setYear(prev, parseInt(e.target.value, 10)))
                }
                className="rounded-md bg-fundo px-2 py-1 text-xs font-mono font-bold text-texto border border-borda/60 focus:outline-none focus:border-acento cursor-pointer"
              >
                {anosDisponiveis.map((ano) => (
                  <option key={ano} value={ano}>
                    {ano}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setDataVisualizada((prev) => addMonths(prev, 1))}
              className="btn-tátil rounded-lg p-1.5 text-texto-suave hover:bg-fundo hover:text-texto transition"
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Dias da Semana */}
          <div className="grid grid-cols-7 gap-1 pt-2.5 pb-1 text-center">
            {DIAS_SEMANA.map((dia, idx) => (
              <div
                key={idx}
                className="text-[10px] font-bold text-texto-suave uppercase tracking-wider py-1"
              >
                {dia}
              </div>
            ))}
          </div>

          {/* Grade de Dias */}
          <div className="grid grid-cols-7 gap-1">
            {diasDaGrade.map((dia, idx) => {
              const ehMesAtual = isSameMonth(dia, dataVisualizada);
              const ehHoje = isSameDay(dia, hoje);
              const ehSelecionado = dataSelecionada && isSameDay(dia, dataSelecionada);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelecionarDia(dia)}
                  className={`btn-tátil relative flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs transition ${
                    ehSelecionado
                      ? "bg-acento text-white font-bold shadow-xs scale-105"
                      : ehMesAtual
                        ? "text-texto hover:bg-fundo font-medium"
                        : "text-texto-suave/40 hover:bg-fundo/50"
                  } ${ehHoje && !ehSelecionado ? "border border-acento/40 font-bold text-acento" : ""}`}
                >
                  <span>{format(dia, "d")}</span>
                  {ehHoje && !ehSelecionado && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-acento" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Rodapé com Atalhos Rápidos (Hoje / Limpar) */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-borda text-xs">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setAberto(false);
              }}
              className="btn-tátil text-[11px] font-semibold text-texto-suave hover:text-erro transition"
            >
              Limpar
            </button>

            <button
              type="button"
              onClick={handleSelecionarHoje}
              className="btn-tátil text-[11px] font-bold text-acento hover:underline flex items-center gap-1"
            >
              <span>Hoje</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
