"use client";

import { useState, useTransition } from "react";
import { autenticarUsuario } from "./actions";
import { AlertCircle, Lock, Mail } from "lucide-react";

export default function PaginaLogin() {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await autenticarUsuario({}, formData);
      if (res?.erro) {
        setErro(res.erro);
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-fundo px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Cabeçalho do Card com Logo Oficial */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-borda shadow-md bg-superficie p-1">
            <img src="/logo.png" alt="UNOPAR Logo" className="h-full w-full object-cover rounded-xl" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-extrabold text-texto tracking-tight">
              UNOPAR Parauapebas
            </h1>
            <p className="text-xs font-semibold text-texto-suave">
              Controle e Gestão de Protocolos Acadêmicos
            </p>
          </div>
        </div>

        {/* Card do Formulário */}
        <div className="rounded-2xl border border-borda bg-superficie p-7 shadow-lg space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && (
              <div className="flex items-start gap-2 rounded-xl border border-erro/40 bg-erro-fundo p-3.5 text-xs font-bold text-erro shadow-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-texto mb-1.5"
              >
                E-mail Institucional
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="seu.email@unopar.br"
                  className="w-full rounded-lg border border-borda bg-fundo pl-9 pr-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20 shadow-xs"
                />
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-texto-suave" />
              </div>
            </div>

            <div>
              <label
                htmlFor="senha"
                className="block text-xs font-bold text-texto mb-1.5"
              >
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  id="senha"
                  name="senha"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-borda bg-fundo pl-9 pr-3 py-2 text-xs text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20 shadow-xs"
                />
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-texto-suave" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-acento py-2.5 text-xs font-bold text-white transition hover:bg-acento-hover disabled:opacity-50 shadow-md active:scale-[0.99]"
            >
              {isPending ? "Entrando..." : "Acessar Sistema"}
            </button>
          </form>

          <div className="border-t border-borda pt-3 text-center text-[11px] text-texto-suave">
            Grupo Educacional Edunorte — Parauapebas/PA
          </div>
        </div>
      </div>
    </div>
  );
}
