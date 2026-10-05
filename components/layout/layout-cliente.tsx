"use client";

import { useState } from "react";
import Link from "next/link";
import { type Perfil } from "@/types/database";
import { SidebarPrincipal } from "./sidebar";
import { Menu, Plus } from "lucide-react";
import { MenuNotificacoes } from "./menu-notificacoes";
import { AvatarUsuario } from "@/components/ui/avatar-usuario";
import { type DadosNotificacoesPrazos } from "@/lib/chamados/notificacoes";

interface LayoutClienteProps {
  perfil: Perfil;
  notificacoesIniciais?: DadosNotificacoesPrazos;
  children: React.ReactNode;
}

export function LayoutCliente({ perfil, notificacoesIniciais, children }: LayoutClienteProps) {
  const [mobileAberto, setMobileAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(false);

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden flex bg-fundo text-texto relative antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Sidebar Lateral com Controle de Recolher/Expandir */}
      <SidebarPrincipal
        perfil={perfil}
        notificacoesIniciais={notificacoesIniciais}
        mobileAberto={mobileAberto}
        setMobileAberto={setMobileAberto}
        recolhido={recolhido}
        setRecolhido={setRecolhido}
      />

      {/* Conteúdo Principal com compensação da largura da Sidebar */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          recolhido ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        {/* Header Superior Apenas no Mobile (No desktop o espaçamento superior foi retirado) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-borda bg-superficie/95 backdrop-blur-md px-4 lg:hidden shadow-xs">
          <div className="flex items-center gap-2.5">
            {/* Toggle Mobile */}
            <button
              type="button"
              onClick={() => setMobileAberto(true)}
              className="btn-tátil rounded-xl border border-borda bg-fundo p-2 text-texto hover:bg-superficie shadow-xs"
              title="Abrir menu de navegação"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="h-7 w-7 object-contain" />
              <span className="text-xs font-black text-texto tracking-tight">
                Gestão de Chamados
              </span>
            </div>
          </div>

          {/* Lado Direito no Mobile: Central de Notificações e Perfil */}
          <div className="flex items-center gap-2.5">
            <MenuNotificacoes
              notificacoesIniciais={
                notificacoesIniciais || {
                  vencidos: 0,
                  vencendoBreve: 0,
                  totalCriticos: 0,
                  itens: [],
                }
              }
            />

            <Link href="/perfil" className="flex items-center">
              <AvatarUsuario nome={perfil.nome_completo} fotoUrl={perfil.avatar_url} tamanho="sm" />
            </Link>
          </div>
        </header>

        {/* Área de Conteúdo da Página */}
        <main className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 px-4 sm:px-8 pt-4 pb-8 sm:pt-6 sm:pb-10">
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
        className="btn-tátil group fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-[#1D4ED8] p-4 text-white shadow-xl shadow-blue-900/30 transition-all duration-300 hover:scale-105 hover:bg-blue-600 hover:shadow-2xl sm:px-5 sm:py-3.5"
        title="Abrir novo chamado"
      >
        <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
        <span className="hidden text-xs font-extrabold tracking-wide sm:inline-block">
          Novo Chamado
        </span>
      </Link>
    </div>
  );
}
