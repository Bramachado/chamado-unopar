"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { type Perfil } from "@/types/database";
import { SidebarPrincipal } from "./sidebar";
import { Menu, ChevronDown, Plus, User, Settings, Users, FileText, LogOut } from "lucide-react";
import { logoutUsuario } from "./actions";
import { MenuNotificacoes } from "./menu-notificacoes";
import { SeletorTema } from "@/components/ui/theme-switcher";
import { type DadosNotificacoesPrazos } from "@/lib/chamados/notificacoes";

interface LayoutClienteProps {
  perfil: Perfil;
  notificacoesIniciais?: DadosNotificacoesPrazos;
  children: React.ReactNode;
}

export function LayoutCliente({ perfil, notificacoesIniciais, children }: LayoutClienteProps) {
  const [mobileAberto, setMobileAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(false);
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuUsuarioAberto(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuUsuarioAberto(false);
    };
    document.addEventListener("mousedown", handleClickFora);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickFora);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
    <div className="min-h-[100dvh] flex bg-fundo text-texto relative antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Sidebar Lateral com Controle de Recolher/Expandir */}
      <SidebarPrincipal
        perfil={perfil}
        mobileAberto={mobileAberto}
        setMobileAberto={setMobileAberto}
        recolhido={recolhido}
        setRecolhido={setRecolhido}
      />

      {/* Conteúdo Principal com compensação da largura da Sidebar */}
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ${
          recolhido ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        {/* Header Superior Limpo: Apenas Notificação e Usuário */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-borda bg-superficie/95 backdrop-blur-md px-4 sm:px-8 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Toggle Mobile */}
            <button
              type="button"
              onClick={() => setMobileAberto(true)}
              className="btn-tátil rounded-xl border border-borda bg-fundo p-2 text-texto hover:bg-superficie lg:hidden shadow-xs"
              title="Abrir menu de navegação"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Seletor de Temas na barra superior esquerda */}
            <SeletorTema />
          </div>

          {/* Lado Direito: Apenas Notificação e Perfil da Usuária */}
          <div className="flex items-center gap-3.5">
            {/* Central de Notificações de Prazos */}
            <MenuNotificacoes
              notificacoesIniciais={
                notificacoesIniciais || {
                  vencidos: 0,
                  vencendoBreve: 0,
                  totalCriticos: 0,
                  itens: [],
                }
              }
              aoAbrirOutroMenu={() => setMenuUsuarioAberto(false)}
            />

            {/* Menu Dropdown do Usuário / Configurações */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuUsuarioAberto(!menuUsuarioAberto)}
                className={`btn-tátil flex items-center gap-2.5 rounded-xl border border-borda bg-superficie px-3 py-1.5 hover:bg-fundo transition shadow-xs ${
                  menuUsuarioAberto ? "ring-2 ring-acento/20 border-acento" : ""
                }`}
                title="Abrir menu de configurações do usuário"
                aria-expanded={menuUsuarioAberto}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1D4ED8] text-xs font-bold text-white shadow-xs">
                  {perfil.nome_completo.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="text-xs font-bold text-texto block leading-tight truncate max-w-[130px]">
                    {perfil.nome_completo}
                  </span>
                  <span className="text-[10px] text-texto-suave block leading-none mt-0.5 font-medium">
                    {formatarPapel(perfil.papel)}
                  </span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-texto-suave hidden sm:block transition-transform duration-200 ${
                    menuUsuarioAberto ? "rotate-180 text-acento" : ""
                  }`}
                />
              </button>

              {/* Menu Suspenso */}
              {menuUsuarioAberto && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-borda bg-superficie p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Cabeçalho do Usuário */}
                  <div className="px-3 py-2.5 border-b border-borda mb-1.5">
                    <p className="text-xs font-bold text-texto truncate leading-tight">
                      {perfil.nome_completo}
                    </p>
                    <p className="text-[11px] text-texto-suave font-mono truncate mt-0.5">
                      {perfil.email}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-acento/10 px-2 py-0.5 text-[10px] font-bold text-acento">
                      <span>{formatarPapel(perfil.papel)}</span>
                    </div>
                  </div>

                  {/* Links de Configuração */}
                  <div className="space-y-0.5">
                    {perfil.papel === "admin" && (
                      <Link
                        href="/perfil"
                        onClick={() => setMenuUsuarioAberto(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-texto hover:bg-fundo hover:text-acento transition"
                      >
                        <User className="h-4 w-4 text-texto-suave" />
                        <span>Meu Perfil</span>
                      </Link>
                    )}

                    {perfil.papel === "admin" && (
                      <>
                        <Link
                          href="/usuarios"
                          onClick={() => setMenuUsuarioAberto(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-texto hover:bg-fundo hover:text-acento transition"
                        >
                          <Users className="h-4 w-4 text-texto-suave" />
                          <span>Equipe & Cofre</span>
                        </Link>

                        <Link
                          href="/auditoria"
                          onClick={() => setMenuUsuarioAberto(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-texto hover:bg-fundo hover:text-acento transition"
                        >
                          <FileText className="h-4 w-4 text-texto-suave" />
                          <span>Auditoria do Sistema</span>
                        </Link>
                      </>
                    )}

                    <Link
                      href="/configuracoes"
                      onClick={() => setMenuUsuarioAberto(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-texto hover:bg-fundo hover:text-acento transition"
                    >
                      <Settings className="h-4 w-4 text-texto-suave" />
                      <span>Central de Ajustes</span>
                    </Link>
                  </div>

                  {/* Linha Divisória e Logout */}
                  <div className="border-t border-borda mt-1.5 pt-1.5">
                    <form action={logoutUsuario}>
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-erro hover:bg-erro-fundo/40 transition"
                      >
                        <LogOut className="h-4 w-4 text-erro" />
                        <span>Encerrar Sessão</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
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
