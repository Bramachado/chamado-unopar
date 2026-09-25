"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorSistema({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro no módulo do sistema:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-2xl border border-borda bg-superficie p-8 shadow-sm space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-400">
          <AlertCircle className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-texto">
            Ocorreu uma instabilidade nesta seção
          </h2>
          <p className="text-xs text-texto-suave leading-relaxed">
            Não se preocupe, seus dados estão seguros. A página encontrou um erro inesperado ao
            processar a solicitação.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-texto-suave/80 bg-fundo px-2.5 py-1 rounded-md border border-borda inline-block">
              Código de referência: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Tentar Novamente</span>
          </button>

          <Link
            href="/painel"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg border border-borda bg-fundo text-xs font-semibold text-texto hover:bg-superficie transition"
          >
            <Home className="h-3.5 w-3.5 text-texto-suave" />
            <span>Voltar ao Painel</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
