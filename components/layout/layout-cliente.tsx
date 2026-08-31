"use client";

import { useState } from "react";
import Link from "next/link";
import { type Perfil } from "@/types/database";
import { SidebarPrincipal } from "./sidebar";
import { Menu, Bell, ChevronDown, Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface LayoutClienteProps {
  perfil: Perfil;
  children: React.ReactNode;
}

export function LayoutCliente({ perfil, children }: LayoutClienteProps) {
  const [mobileAberto, setMobileAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(false);

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
    <div className="min-h-screen flex bg-fundo text-texto relative">
      {/* Sidebar Lateral com Controle de Recolher/Expandir */}
      <SidebarPrincipal
        perfil={perfil}
        mobileAberto={mobileAberto}
        setMobileAberto={setMobileAberto}
        recolhido={recolhido}
        setRecolhido={setRecolhido}
      />

      {/* Conteúdo Principal com compensação da largura da Sidebar */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ${
        recolhido ? "lg:pl-20" : "lg:pl-72"
      }`}>
        {/* Header Superior Limpo: Apenas Notificação e Usuário */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-borda bg-superficie/95 backdrop-blur-xs px-4 sm:px-8 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Toggle Mobile */}
            <button
              type="button"
              onClick={() => setMobileAberto(true)}
              className="rounded-xl border border-borda bg-fundo p-2 text-texto hover:bg-superficie lg:hidden shadow-xs"
              title="Abrir menu de navegação"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Toggle Desktop no Header */}
            <button
              type="button"
              onClick={() => setRecolhido(!recolhido)}
              className="hidden lg:flex items-center gap-2 rounded-xl border border-borda bg-fundo px-3 py-1.5 text-xs font-semibold text-texto-suave hover:text-texto hover:bg-superficie transition shadow-xs"
              title={recolhido ? "Expandir barra lateral" : "Recolher barra lateral"}
            >
              {recolhido ? (
                <>
                  <PanelLeftOpen className="h-4 w-4 text-sky-500" />
                  <span>Expandir Menu</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span>Recolher Menu</span>
                </>
              )}
            </button>
          </div>

          {/* Lado Direito: Apenas Notificação e Perfil da Usuária */}
          <div className="flex items-center gap-3.5">
            {/* Notificações com Badge */}
            <Link
              href="/chamados"
              className="relative rounded-xl border border-borda bg-fundo p-2 text-texto-suave hover:text-texto hover:bg-superficie transition shadow-xs"
              title="Notificações"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-xs">
                3
              </span>
            </Link>

            {/* Perfil Pill Badge */}
            <Link
              href="/perfil"
              className="flex items-center gap-2.5 rounded-xl border border-borda bg-superficie px-3 py-1.5 hover:bg-fundo transition shadow-xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1D4ED8] text-xs font-bold text-white shadow-xs">
                {perfil.nome_completo.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <span className="text-xs font-bold text-texto block leading-tight truncate max-w-[130px]">
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

      {/* Botão Flutuante (FAB) de Atalho para Novo Chamado */}
      <Link
        href="/chamados/novo"
        className="group fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-[#1D4ED8] p-4 text-white shadow-xl shadow-blue-900/40 transition-all duration-300 hover:scale-105 hover:bg-blue-600 hover:shadow-2xl sm:px-5 sm:py-3.5"
        title="Abrir novo chamado"
      >
        <Plus className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90" />
        <span className="hidden text-xs font-extrabold tracking-wide sm:inline-block">
          Novo Chamado
        </span>
      </Link>
    </div>
  );
}
