"use client";

import { useState, useTransition } from "react";
import { autenticarUsuario } from "./actions";
import { Shield, AlertCircle } from "lucide-react";

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
        {/* Cabeçalho do Card */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-acento text-white">
            <Shield className="h-5 w-5" />
          </div>
          <h1 className="font-heading text-xl font-bold text-texto">
            UNOPAR Parauapebas
          </h1>
          <p className="text-xs text-texto-suave">
            Sistema de Registro e Controle de Protocolos
          </p>
        </div>

        {/* Card do Formulário */}
        <div className="rounded border border-borda bg-superficie p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && (
              <div className="flex items-start gap-2 rounded border border-erro/30 bg-erro-fundo p-3 text-xs text-erro">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-texto mb-1"
              >
                E-mail institucional
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="seu.email@unopar.br"
                className="w-full rounded border border-borda bg-fundo px-3 py-2 text-sm text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="senha"
                className="block text-xs font-medium text-texto mb-1"
              >
                Senha de acesso
              </label>
              <input
                id="senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full rounded border border-borda bg-fundo px-3 py-2 text-sm text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded bg-acento py-2 px-4 text-xs font-medium text-white transition hover:bg-acento-hover disabled:opacity-50"
            >
              {isPending ? "Autenticando..." : "Entrar no sistema"}
            </button>
          </form>
        </div>

        {/* Rodapé Institucional */}
        <div className="text-center text-[11px] text-texto-suave">
          Acesso restrito e auditado aos colaboradores da unidade.
        </div>
      </div>
    </div>
  );
}
