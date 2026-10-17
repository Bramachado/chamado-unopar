"use client";

import { useState, useRef, useEffect, useId } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  adicionarDiasCorridos,
  adicionarMeses,
  diaDaSemana,
  ehDataCivilValida,
  fimDoMes,
  formatarDataCivil,
  hojeCivil,
  inicioDoMes,
  type DataCivil,
} from "@/lib/datas";

/**
 * Seletor de DATA CIVIL (valor "AAAA-MM-DD"). Não converte fuso: o dia escolhido é o dia gravado.
 * Acessível por teclado: Enter/Espaço abre; setas navegam entre dias; Enter seleciona; Esc fecha.
 */
interface CustomDatePickerProps {
  value?: string;
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
  erro?: string;
  descricao?: string;
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
const DIAS_SEMANA = [
  { curto: "D", longo: "domingo" },
  { curto: "S", longo: "segunda" },
  { curto: "T", longo: "terça" },
  { curto: "Q", longo: "quarta" },
  { curto: "Q", longo: "quinta" },
  { curto: "S", longo: "sexta" },
  { curto: "S", longo: "sábado" },
];

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
  minDate,
  maxDate,
  erro,
  descricao,
}: CustomDatePickerProps) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const selecionada = value && ehDataCivilValida(value) ? value : null;
  const hoje = hojeCivil();
  const [mesVisivel, setMesVisivel] = useState<DataCivil>(inicioDoMes(selecionada ?? hoje));
  const [foco, setFoco] = useState<DataCivil>(selecionada ?? hoje);

  useEffect(() => {
    if (selecionada) {
      setMesVisivel(inicioDoMes(selecionada));
      setFoco(selecionada);
    }
  }, [selecionada]);

  useEffect(() => {
    function fora(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node))
        setAberto(false);
    }
    if (aberto) document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  useEffect(() => {
    if (aberto) gradeRef.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus();
  }, [aberto, foco]);

  const foraDoLimite = (d: DataCivil) => (!!minDate && d < minDate) || (!!maxDate && d > maxDate);

  const selecionar = (d: DataCivil) => {
    if (foraDoLimite(d)) return;
    onChange(d);
    setAberto(false);
  };

  const moverFoco = (dias: number) => {
    const novo = adicionarDiasCorridos(foco, dias);
    setFoco(novo);
    if (novo.slice(0, 7) !== mesVisivel.slice(0, 7)) setMesVisivel(inicioDoMes(novo));
  };

  const teclaNaGrade = (e: React.KeyboardEvent) => {
    const mapa: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in mapa) {
      e.preventDefault();
      moverFoco(mapa[e.key]!);
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  };

  const inicioGrade = adicionarDiasCorridos(mesVisivel, -diaDaSemana(mesVisivel));
  const fimGrade = adicionarDiasCorridos(
    fimDoMes(mesVisivel),
    6 - diaDaSemana(fimDoMes(mesVisivel))
  );
  const dias: DataCivil[] = [];
  for (let d = inicioGrade; d <= fimGrade; d = adicionarDiasCorridos(d, 1)) dias.push(d);

  const anoAtual = Number(mesVisivel.slice(0, 4));
  const anos = Array.from({ length: 16 }, (_, i) => anoAtual - 10 + i);
  const idErro = `${id}-erro`;
  const idDescricao = `${id}-descricao`;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {name && <input type="hidden" name={name} value={value || ""} required={required} />}

      {label && (
        <label
          id={`${id}-rotulo`}
          htmlFor={`${id}-gatilho`}
          className="block text-xs font-bold text-texto mb-1.5"
        >
          {label}{" "}
          {required && (
            <span className="text-erro" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div
        className={`group flex items-center justify-between gap-2 rounded-lg border bg-fundo px-3 py-2 text-xs font-medium text-texto transition shadow-xs ${
          disabled ? "opacity-50 bg-superficie-destaque" : ""
        } ${erro ? "border-erro ring-1 ring-erro/50" : aberto ? "border-acento ring-2 ring-acento/20" : "border-borda"}`}
      >
        <button
          id={`${id}-gatilho`}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={aberto}
          aria-invalid={!!erro}
          aria-describedby={
            [erro ? idErro : "", descricao ? idDescricao : ""].filter(Boolean).join(" ") ||
            undefined
          }
          onClick={() => setAberto((a) => !a)}
          className="flex flex-1 items-center gap-2 truncate text-left outline-none focus-visible:ring-2 focus-visible:ring-acento/40 rounded disabled:cursor-not-allowed"
        >
          <CalendarIcon
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 ${aberto ? "text-acento" : "text-texto-suave"}`}
          />
          {selecionada ? (
            <span className="font-mono font-semibold tabular-nums">
              {formatarDataCivil(selecionada)}
            </span>
          ) : (
            <span className="text-texto-suave font-mono">{placeholder}</span>
          )}
          <span className="sr-only">{aberto ? "Fechar calendário" : "Abrir calendário"}</span>
        </button>
        {selecionada && !disabled && !required && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded p-0.5 text-texto-suave hover:bg-superficie hover:text-erro transition"
            aria-label="Limpar data"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {descricao && !erro && (
        <p id={idDescricao} className="mt-1 text-[11px] text-texto-suave">
          {descricao}
        </p>
      )}
      {erro && (
        <p id={idErro} role="alert" className="mt-1.5 text-[11px] font-semibold text-erro">
          {erro}
        </p>
      )}

      {aberto && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={label ? `${id}-rotulo` : undefined}
          className={`absolute z-50 mt-1.5 w-72 rounded-2xl border border-borda bg-superficie p-3.5 shadow-2xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center justify-between gap-1 pb-3 border-b border-borda">
            <button
              type="button"
              onClick={() => setMesVisivel((m) => adicionarMeses(m, -1))}
              className="rounded-lg p-1.5 text-texto-suave hover:bg-fundo hover:text-texto"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-1">
              <select
                aria-label="Mês"
                value={Number(mesVisivel.slice(5, 7)) - 1}
                onChange={(e) =>
                  setMesVisivel(
                    `${mesVisivel.slice(0, 4)}-${String(Number(e.target.value) + 1).padStart(2, "0")}-01`
                  )
                }
                className="rounded-md bg-fundo px-2 py-1 text-xs font-bold text-texto border border-borda/60 focus:outline-none focus:border-acento"
              >
                {MESES.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                aria-label="Ano"
                value={anoAtual}
                onChange={(e) => setMesVisivel(`${e.target.value}${mesVisivel.slice(4)}`)}
                className="rounded-md bg-fundo px-2 py-1 text-xs font-mono font-bold text-texto border border-borda/60 focus:outline-none focus:border-acento"
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setMesVisivel((m) => adicionarMeses(m, 1))}
              className="rounded-lg p-1.5 text-texto-suave hover:bg-fundo hover:text-texto"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 pt-2.5 pb-1 text-center" aria-hidden="true">
            {DIAS_SEMANA.map((d, i) => (
              <div key={i} className="text-[10px] font-bold text-texto-suave uppercase py-1">
                {d.curto}
              </div>
            ))}
          </div>

          <div
            ref={gradeRef}
            className="grid grid-cols-7 gap-1"
            role="grid"
            onKeyDown={teclaNaGrade}
          >
            {dias.map((d) => {
              const doMes = d.slice(0, 7) === mesVisivel.slice(0, 7);
              const ehHoje = d === hoje;
              const ehSel = d === selecionada;
              const bloqueado = foraDoLimite(d);
              return (
                <button
                  key={d}
                  type="button"
                  data-dia={d}
                  tabIndex={d === foco ? 0 : -1}
                  disabled={bloqueado}
                  aria-pressed={ehSel}
                  aria-current={ehHoje ? "date" : undefined}
                  aria-label={`${formatarDataCivil(d)}, ${DIAS_SEMANA[diaDaSemana(d)]!.longo}${ehHoje ? ", hoje" : ""}${bloqueado ? ", indisponível" : ""}`}
                  onClick={() => selecionar(d)}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-acento ${
                    ehSel
                      ? "bg-acento text-white font-bold"
                      : bloqueado
                        ? "text-texto-suave/30 cursor-not-allowed line-through"
                        : doMes
                          ? "text-texto hover:bg-fundo font-medium"
                          : "text-texto-suave/50 hover:bg-fundo/50"
                  } ${ehHoje && !ehSel ? "border border-acento/40 font-bold text-acento" : ""}`}
                >
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 mt-2 border-t border-borda text-xs">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-[11px] font-semibold text-texto-suave hover:text-texto"
            >
              Fechar
            </button>
            <button
              type="button"
              disabled={foraDoLimite(hoje)}
              onClick={() => selecionar(hoje)}
              className="text-[11px] font-bold text-acento hover:underline disabled:opacity-40"
            >
              Hoje ({formatarDataCivil(hoje, "curto")})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
