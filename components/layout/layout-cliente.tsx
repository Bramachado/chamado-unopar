"use client";

import { useState } from "react";
import { type Perfil } from "@/types/database";
import { SidebarPrincipal } from "./sidebar";
import { Menu, Shield } from "lucide-react";
import { SeletorTema } from "@/components/ui/theme-switcher";

interface LayoutClienteProps {
  perfil: Perfil;
  children: React.ReactNode;
}

export function LayoutCliente({ perfil, children }: LayoutClienteProps) {
  const [mobileAberto, setMobileAberto] = useState(false);

  return (
    <div className="min-h-screen flex bg-fundo text-texto">
      {/* Sidebar Lateral */}
      <SidebarPrincipal
        perfil={perfil}
        mobileAberto={mobileAberto}
        setMobileAberto={setMobileAberto}
      />

      {/* Conteúdo Principal com compensação da largura da Sidebar */}
      <div className="flex flex-1 flex-col lg:pl-72">
        {/* Header Superior Mobile & Desktop */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-borda bg-superficie/95 backdrop-blur-xs px-4 sm:px-6 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileAberto(true)}
              className="rounded-lg border border-borda bg-fundo p-2 text-texto hover:bg-superficie lg:hidden shadow-xs"
              title="Abrir menu de navegação"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-acento text-white shadow-xs">
                <Shield className="h-4 w-4" />
              </div>
              <span className="font-heading text-xs font-bold text-texto">
                UNOPAR Parauapebas
              </span>
            </div>

            <div className="hidden lg:block">
              <span className="text-xs font-semibold text-texto-suave">
                Sistema Integrado de Gestão de Protocolos Acadêmicos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SeletorTema />
          </div>
        </header>

        {/* Área de Conteúdo da Página */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 md:py-8">
          {children}
        </main>

        {/* Rodapé */}
        <footer className="border-t border-borda bg-superficie py-3.5 text-center text-xs font-medium text-texto-suave">
          UNOPAR Parauapebas (Grupo Edunorte) — Sistema de Gestão e Controle de Chamados
        </footer>
      </div>
    </div>
  );
}
