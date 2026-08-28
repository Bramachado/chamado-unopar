"use client";

import { useActionState } from "react";
import { autenticarUsuario, type EstadoLogin } from "./actions";
import { SeletorTema } from "@/components/ui/theme-switcher";
import { Shield, Lock, Mail, AlertCircle } from "lucide-react";

const estadoInicial: EstadoLogin = {};

export default function PaginaLogin() {
  const [estado, formAction, isPending] = useActionState(
    autenticarUsuario,
    estadoInicial
  );

  return (
    <div className="flex min-h-screen flex-col justify-between bg-fundo px-4 py-8 sm:px-6 lg:px-8">
      {/* Barra superior de utilitários */}
      <header className="mx-auto flex w-full max-w-md items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-acento text-white">
            <Shield className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-texto">
            UNOPAR Parauapebas
          </span>
        </div>
        <SeletorTema />
      </header>

      {/* Caixa central de autenticação */}
      <main className="mx-auto w-full max-w-sm">
        <div className="rounded border border-borda bg-superficie p-6 shadow-sm">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-texto">
              Registro de Protocolos
            </h1>
            <p className="mt-1 text-xs text-texto-suave">
              Acesso restrito à equipe de atendimento e coordenação do Grupo Edunorte.
            </p>
          </div>

          {estado.erro && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded border border-erro/30 bg-erro-fundo p-3 text-xs text-erro"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{estado.erro}</span>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-texto mb-1"
              >
                E-mail institucional
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="usuario@unopar.br"
                  className="w-full rounded border border-borda bg-fundo px-3 py-2 pl-9 text-xs text-texto placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
                />
                <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-texto-suave" />
              </div>
            </div>

            <div>
              <label
                htmlFor="senha"
                className="block text-xs font-medium text-texto mb-1"
              >
                Senha de acesso
              </label>
              <div className="relative">
                <input
                  id="senha"
                  name="senha"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded border border-borda bg-fundo px-3 py-2 pl-9 text-xs text-texto placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
                />
                <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-texto-suave" />
              </div>
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

        <p className="mt-4 text-center text-xs text-texto-suave">
          Auditoria ativa em todas as operações por IP e credencial.
        </p>
      </main>

      {/* Rodapé institucional */}
      <footer className="mx-auto text-center text-xs text-texto-suave">
        Sistema de Controle de Chamados © {new Date().getFullYear()} — UNOPAR Parauapebas / Edunorte
      </footer>
    </div>
  );
}
