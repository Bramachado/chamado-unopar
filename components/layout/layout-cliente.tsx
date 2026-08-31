"use client";

import { useState } from "react";
import Link from "next/link";
import { type Perfil } from "@/types/database";
import { SidebarPrincipal } from "./sidebar";
import { Menu, Bell, ChevronDown } from "lucide-react";
import { SeletorTema } from "@/components/ui/theme-switcher";

interface LayoutClienteProps {
  perfil: Perfil;
  children: React.ReactNode;
}

export function LayoutCliente({ perfil, children }: LayoutClienteProps) {
  const [mobileAberto, setMobileAberto] = useState(false);

  const formatarPapel = (papel: string) => {
    switch (papel) {
      case "admin":
        return "Administrador";
      case "coordenador":
        return "Coordenador";
      case "atendente":
        return "Atendimento";
      default:
        return papel;
    }
  };

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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-borda bg-superficie/95 backdrop-blur-xs px-4 sm:px-8 shadow-xs">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-md overflow-hidden border border-borda bg-superficie">
                <img src="/logo.png" alt="UNOPAR Logo" className="h-full w-full object-contain" />
              </div>
              <span className="text-xs font-bold text-texto">
                UNOPAR Parauapebas
              </span>
            </div>

            <div className="hidden lg:block">
              <span className="text-xs font-medium text-texto-suave">
                Sistema Integrado de Gestão de Protocolos Acadêmicos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Seletor de Tema */}
            <SeletorTema />

            {/* Notificações com Badge */}
            <Link
              href="/chamados"
              className="relative rounded-xl border border-borda bg-fundo p-2 text-texto-suave hover:text-texto hover:bg-superficie transition"
              title="Notificações"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-xs">
                3
              </span>
            </Link>

            {/* Perfil Pill Badge conforme Mockup */}
            <Link
              href="/perfil"
              className="flex items-center gap-2.5 rounded-xl border border-borda bg-superficie px-3 py-1.5 hover:bg-fundo transition"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1D4ED8] text-xs font-bold text-white shadow-xs">
                {perfil.nome_completo.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <span className="text-xs font-bold text-texto block leading-tight truncate max-w-[120px]">
                  {perfil.nome_completo}
                </span>
                <span className="text-[10px] text-texto-suave block leading-none mt-0.5">
                  {formatarPapel(perfil.papel)}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-texto-suave hidden sm:block" />
            </Link>
          </div>
        </header>

        {/* Área de Conteúdo da Página */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8 md:py-8">
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
