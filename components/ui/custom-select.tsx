"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione uma opção...",
  label,
  disabled = false,
  className = "",
  name,
}: CustomSelectProps) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const opcaoSelecionada = options.find((opt) => opt.value === value);

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

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setAberto((prev) => !prev);
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {name && <input type="hidden" name={name} value={value} />}
      {label && (
        <label className="block text-xs font-bold text-texto mb-1.5">
          {label}
        </label>
      )}

      {/* Botão Gatilho Estilizado */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAberto(!aberto)}
        onKeyDown={handleKeyDown}
        className={`group flex w-full items-center justify-between gap-2 rounded-lg border bg-fundo px-3.5 py-2 text-xs font-medium text-texto transition shadow-xs outline-none focus:border-acento focus:ring-2 focus:ring-acento/20 disabled:cursor-not-allowed disabled:opacity-50 ${
          aberto ? "border-acento ring-2 ring-acento/20" : "border-borda hover:border-borda/80"
        }`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
      >
        <span className="truncate text-left">
          {opcaoSelecionada ? (
            <span className="font-semibold text-texto">
              {opcaoSelecionada.label}
              {opcaoSelecionada.sublabel && (
                <span className="ml-1.5 text-texto-suave font-normal">
                  {opcaoSelecionada.sublabel}
                </span>
              )}
            </span>
          ) : (
            <span className="text-texto-suave">{placeholder}</span>
          )}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-texto-suave transition-transform duration-200 ${
            aberto ? "rotate-180 text-acento" : "group-hover:text-texto"
          }`}
        />
      </button>

      {/* Dropdown Menu Flutuante */}
      {aberto && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-borda bg-superficie p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
          <div role="listbox" className="space-y-0.5">
            {options.map((opt) => {
              const estaSelecionado = opt.value === value;

              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={estaSelecionado}
                  onClick={() => {
                    onChange(opt.value);
                    setAberto(false);
                  }}
                  className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs transition ${
                    estaSelecionado
                      ? "bg-acento text-white font-bold shadow-xs"
                      : "text-texto hover:bg-fundo"
                  }`}
                >
                  <div className="flex flex-col truncate">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className={`text-[11px] truncate ${estaSelecionado ? "text-white/80" : "text-texto-suave"}`}>
                        {opt.sublabel}
                      </span>
                    )}
                  </div>

                  {estaSelecionado && (
                    <Check className="h-4 w-4 shrink-0 text-white ml-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
