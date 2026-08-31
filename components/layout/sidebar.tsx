"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Perfil } from "@/types/database";
import { logoutUsuario } from "@/app/login/actions";
import { 
  LayoutDashboard, 
  Ticket, 
  Trophy, 
  Settings, 
  User, 
  Users, 
  FileText, 
  LogOut, 
  Sun, 
  Moon, 
  BookOpen, 
  ChevronDown, 
  ChevronRight,
  X,
  PanelLeftClose
} from "lucide-react";

interface SidebarPrincipalProps {
  perfil: Perfil;
  mobileAberto: boolean;
  setMobileAberto: (aberto: boolean) => void;
  recolhido: boolean;
  setRecolhido: (recolhido: boolean) => void;
}

type Tema = "claro" | "sepia" | "escuro";

export function SidebarPrincipal({
  perfil,
  mobileAberto,
  setMobileAberto,
  recolhido,
  setRecolhido,
}: SidebarPrincipalProps) {
  const pathname = usePathname();
  const [configAberto, setConfigAberto] = useState(
    pathname.startsWith("/configuracoes") ||
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/usuarios") ||
    pathname.startsWith("/auditoria")
  );

  const [temaAtual, setTemaAtual] = useState<Tema>("claro");

  useEffect(() => {
    const salvo = (localStorage.getItem("unopar-tema") as Tema) || "claro";
    setTemaAtual(salvo);
  }, []);

  const alterarTema = (novoTema: Tema) => {
    setTemaAtual(novoTema);
    document.documentElement.setAttribute("data-theme", novoTema);
    localStorage.setItem("unopar-tema", novoTema);
  };

  const ehAdmin = perfil.papel === "admin";

  const rotasPrincipais = [
    { href: "/painel", rotulo: "Dashboard", icone: LayoutDashboard },
    { href: "/chamados", rotulo: "Chamados", icone: Ticket, badge: "8" },
    { href: "/motivos", rotulo: "Meus atendimentos", icone: Users },
    { href: "/desempenho", rotulo: "Desempenho", icone: Trophy },
    { href: "/auditoria", rotulo: "Relatórios", icone: FileText },
  ];

  const subRotasConfig = [
    { href: "/perfil", rotulo: "Meu Perfil", icone: User },
    ...(ehAdmin
      ? [
          { href: "/usuarios", rotulo: "Equipe & Cofre", icone: Users },
          { href: "/auditoria", rotulo: "Auditoria", icone: FileText },
        ]
      : []),
    { href: "/configuracoes", rotulo: "Central de Ajustes", icone: Settings },
  ];

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

  const estaNaConfiguracao = 
    pathname.startsWith("/configuracoes") ||
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/usuarios") ||
    pathname.startsWith("/auditoria");

  return (
    <>
      {/* Overlay Backdrop para Mobile */}
      {mobileAberto && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setMobileAberto(false)}
        />
      )}

      {/* Sidebar Container (Deep Navy Blue com modo normal w-72 e recolhido w-20) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-[#1E293B] bg-[#070D1E] text-slate-200 shadow-2xl transition-all duration-300 ease-in-out lg:translate-x-0 ${
          mobileAberto ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"
        } ${recolhido ? "lg:w-20" : "lg:w-72"}`}
      >
        {/* Cabeçalho da Sidebar / Logo & Botão de Abrir/Fechar Lateral */}
        <div className={`flex h-24 items-center border-b border-[#1E293B]/60 transition-all ${
          recolhido ? "justify-center px-2" : "justify-between px-5"
        }`}>
          {recolhido ? (
            /* Modo Recolhido: Apenas a Logo Centralizada que ao clicar expande */
            <button
              type="button"
              onClick={() => setRecolhido(false)}
              className="group relative h-12 w-12 rounded-xl flex items-center justify-center p-1 hover:bg-white/10 transition"
              title="Expandir barra lateral"
            >
              <img
                src="/logo.png"
                alt="Gestão de Chamados Logo"
                className="h-full w-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform"
              />
            </button>
          ) : (
            /* Modo Expandido: Logo + Título à Esquerda e Botão de Recolher à Direita */
            <>
              <div className="flex items-center gap-3 truncate">
                <div className="h-12 w-12 shrink-0 flex items-center justify-center p-0.5">
                  <img
                    src="/logo.png"
                    alt="Gestão de Chamados Logo"
                    className="h-full w-full object-contain filter drop-shadow-md"
                  />
                </div>
                <div className="truncate">
                  <span className="text-[15px] font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-sky-300 bg-clip-text text-transparent block leading-tight truncate">
                    Gestão de Chamados
                  </span>
                </div>
              </div>

              {/* Botão de Recolher no Desktop */}
              <button
                type="button"
                onClick={() => setRecolhido(true)}
                className="hidden lg:flex rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
                title="Recolher barra lateral"
              >
                <PanelLeftClose className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Botão de Fechar no Mobile */}
          <button
            type="button"
            onClick={() => setMobileAberto(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            title="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Links de Navegação */}
        <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6 scrollbar-thin">
          {/* Seção Principal */}
          <div>
            <ul className="space-y-1.5">
              {rotasPrincipais.map((rota) => {
                const Icone = rota.icone;
                const ativo = pathname === rota.href || (rota.href !== "/painel" && pathname.startsWith(`${rota.href}/`));
                return (
                  <li key={rota.href}>
                    <Link
                      href={rota.href}
                      onClick={() => setMobileAberto(false)}
                      title={recolhido ? rota.rotulo : undefined}
                      className={`flex items-center rounded-xl py-3 text-xs font-semibold transition-all ${
                        recolhido ? "justify-center px-2" : "justify-between px-4"
                      } ${
                        ativo
                          ? "bg-[#1D4ED8] text-white shadow-lg shadow-blue-900/40"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icone className={`h-5 w-5 shrink-0 ${ativo ? "text-white" : "text-slate-400"}`} />
                        {!recolhido && <span>{rota.rotulo}</span>}
                      </div>
                      {!recolhido && rota.badge && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs">
                          {rota.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Seção de Configurações */}
          <div>
            <div className="space-y-1">
              {/* Botão de Toggle de Configurações */}
              <button
                type="button"
                onClick={() => setConfigAberto(!configAberto)}
                title={recolhido ? "Configurações" : undefined}
                className={`flex w-full items-center rounded-xl py-3 text-xs font-semibold transition-all ${
                  recolhido ? "justify-center px-2" : "justify-between px-4"
                } ${
                  estaNaConfiguracao
                    ? "bg-[#1D4ED8]/20 text-sky-400 border border-sky-500/30"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className={`h-5 w-5 shrink-0 ${estaNaConfiguracao ? "text-sky-400" : "text-slate-400"}`} />
                  {!recolhido && <span>Configurações</span>}
                </div>
                {!recolhido && (
                  configAberto ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )
                )}
              </button>

              {/* Submenu de Configurações (Apenas no modo expandido) */}
              {configAberto && !recolhido && (
                <ul className="mt-1.5 space-y-1 pl-4 border-l border-[#1E293B] ml-5">
                  {subRotasConfig.map((sub) => {
                    const SubIcone = sub.icone;
                    const ativo = pathname === sub.href || pathname.startsWith(`${sub.href}/`);
                    return (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          onClick={() => setMobileAberto(false)}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                            ativo
                              ? "bg-[#1D4ED8] text-white font-bold"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                          }`}
                        >
                          <SubIcone className="h-3.5 w-3.5 shrink-0" />
                          <span>{sub.rotulo}</span>
                        </Link>
                      </li>
                    );
                  })}

                  {/* Seletor de Tema Integrado */}
                  <li className="pt-3 pr-2">
                    <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#1E293B] bg-[#0A1128] p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => alterarTema("claro")}
                        className={`flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold transition ${
                          temaAtual === "claro"
                            ? "bg-[#1D4ED8] text-white shadow-xs"
                            : "text-slate-400 hover:text-white"
                        }`}
                        title="Tema Claro"
                      >
                        <Sun className="h-3.5 w-3.5" />
                        <span>Claro</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => alterarTema("sepia")}
                        className={`flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold transition ${
                          temaAtual === "sepia"
                            ? "bg-[#1D4ED8] text-white shadow-xs"
                            : "text-slate-400 hover:text-white"
                        }`}
                        title="Tema Sépia"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Sépia</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => alterarTema("escuro")}
                        className={`flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold transition ${
                          temaAtual === "escuro"
                            ? "bg-[#1D4ED8] text-white shadow-xs"
                            : "text-slate-400 hover:text-white"
                        }`}
                        title="Tema Escuro"
                      >
                        <Moon className="h-3.5 w-3.5" />
                        <span>Escuro</span>
                      </button>
                    </div>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé da Sidebar: Usuário Conectado & Logout */}
        <div className={`border-t border-[#1E293B] bg-[#050A18] p-3.5 transition-all ${
          recolhido ? "flex flex-col items-center gap-3" : ""
        }`}>
          <div className={`flex items-center ${recolhido ? "flex-col gap-2.5" : "justify-between gap-3"}`}>
            <div className={`flex items-center gap-3 truncate ${recolhido ? "justify-center" : ""}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1D4ED8] text-xs font-extrabold text-white shadow-md" title={perfil.nome_completo}>
                {perfil.nome_completo.substring(0, 2).toUpperCase()}
              </div>
              {!recolhido && (
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate" title={perfil.nome_completo}>
                    {perfil.nome_completo}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400">
                    {formatarPapel(perfil.papel)}
                  </div>
                </div>
              )}
            </div>

            <form action={logoutUsuario}>
              <button
                type="submit"
                className="rounded-xl border border-[#1E293B] bg-[#0A1128] p-2 text-slate-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 transition"
                title="Encerrar sessão"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
