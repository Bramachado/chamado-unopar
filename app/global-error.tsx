"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro fatal global:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 border border-rose-200 text-rose-600">
            <AlertCircle className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Falha ao carregar o sistema
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ocorreu uma instabilidade inesperada. Clique abaixo para restabelecer a conexão.
            </p>
            {error.digest && (
              <p className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 inline-block">
                Digest: {error.digest}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 h-9 px-5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Recarregar Sistema</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
