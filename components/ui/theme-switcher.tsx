"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, BookOpen } from "lucide-react";

type Tema = "claro" | "sepia" | "escuro";

export function SeletorTema() {
  const [temaAtual, setTemaAtual] = useState<Tema>("claro");

  useEffect(() => {
    const salvo = (localStorage.getItem("unopar-tema") as Tema) || "claro";
    setTemaAtual(salvo);
  }, []);

  const alterarTema = (novoTema: Tema) => {
    setTemaAtual(novoTema);
    document.documentElement.setAttribute("data-theme", novoTema);
    localStorage.setItem("unopar-tema", novoTema);
  };

  return (
    <div className="inline-flex items-center rounded-xl border border-borda bg-fundo p-0.5 text-xs shadow-xs">
      <button
        type="button"
        onClick={() => alterarTema("claro")}
        className={`btn-tátil flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
          temaAtual === "claro"
            ? "bg-superficie text-texto font-bold shadow-xs border border-borda/80"
            : "text-texto-suave hover:text-texto"
        }`}
        title="Tema Claro"
      >
        <Sun className="h-3.5 w-3.5 text-amber-500" />
        <span className="hidden sm:inline">Claro</span>
      </button>
      <button
        type="button"
        onClick={() => alterarTema("sepia")}
        className={`btn-tátil flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
          temaAtual === "sepia"
            ? "bg-superficie text-texto font-bold shadow-xs border border-borda/80"
            : "text-texto-suave hover:text-texto"
        }`}
        title="Tema Sépia (Bege e Azul)"
      >
        <BookOpen className="h-3.5 w-3.5 text-blue-600" />
        <span className="hidden sm:inline">Sépia</span>
      </button>
      <button
        type="button"
        onClick={() => alterarTema("escuro")}
        className={`btn-tátil flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
          temaAtual === "escuro"
            ? "bg-superficie text-texto font-bold shadow-xs border border-borda/80"
            : "text-texto-suave hover:text-texto"
        }`}
        title="Tema Escuro"
      >
        <Moon className="h-3.5 w-3.5 text-indigo-400" />
        <span className="hidden sm:inline">Escuro</span>
      </button>
    </div>
  );
}
