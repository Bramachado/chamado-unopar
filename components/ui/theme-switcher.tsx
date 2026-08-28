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
    <div className="inline-flex items-center rounded border border-borda bg-superficie p-0.5 text-xs">
      <button
        type="button"
        onClick={() => alterarTema("claro")}
        className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
          temaAtual === "claro"
            ? "bg-fundo text-texto font-medium shadow-sm"
            : "text-texto-suave hover:text-texto"
        }`}
        title="Tema Claro"
      >
        <Sun className="h-3.5 w-3.5" />
        <span>Claro</span>
      </button>
      <button
        type="button"
        onClick={() => alterarTema("sepia")}
        className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
          temaAtual === "sepia"
            ? "bg-fundo text-texto font-medium shadow-sm"
            : "text-texto-suave hover:text-texto"
        }`}
        title="Tema Sépia (Leitura)"
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span>Sépia</span>
      </button>
      <button
        type="button"
        onClick={() => alterarTema("escuro")}
        className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
          temaAtual === "escuro"
            ? "bg-fundo text-texto font-medium shadow-sm"
            : "text-texto-suave hover:text-texto"
        }`}
        title="Tema Escuro"
      >
        <Moon className="h-3.5 w-3.5" />
        <span>Escuro</span>
      </button>
    </div>
  );
}
