"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Perfil } from "@/types/database";
import { 
  LayoutDashboard, 
  Ticket, 
  Tag, 
  Trophy, 
  Settings, 
  User, 
  Users, 
  FileText, 
  LogOut, 
  Shield, 
  Sun, 
  Moon, 
  BookOpen, 
  ChevronDown, 
  ChevronRight,
  X
} from "lucide-react";
import { logoutUsuario } from "./actions";

type Tema = "claro" | "sepia" | "escuro";

interface SidebarProps {
  perfil: Perfil;
  mobileAberto: boolean;
  setMobileAberto: (aberto: boolean) => void;
}

export function SidebarPrincipal({ perfil, mobileAberto, setMobileAberto }: SidebarProps) {
  const pathname = usePathname();
  const [temaAtual, setTemaAtual] = useState<Tema>("claro");
  const [configAberto, setConfigAberto] = useState(
    pathname.startsWith("/configuracoes") ||
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/usuarios") ||
    pathname.startsWith("/auditoria")
  );

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
    { href: "/painel", rotulo: "Painel", icone: LayoutDashboard },
    { href: "/chamados", rotulo: "Chamados", icone: Ticket },
    { href: "/motivos", rotulo: "Motivos", icone: Tag },
    { href: "/desempenho", rotulo: "Desempenho", icone: Trophy },
  ];

  const subRotasConfig = [
    { href: "/perfil", rotulo: "Meu Perfil", icone: User },
    ...(ehAdmin
      ? [
          { href: "/usuarios", rotulo: "Usuárias & Cofre", icone: Users },
          { href: "/auditoria", rotulo: "Auditoria", icone: FileText },
        ]
      : []),
    { href: "/configuracoes", rotulo: "Central de Ajustes", icone: Settings },
  ];

  const formatarPapel = (papel: string) => {
    switch (papel) {
      case "admin":
        return "Administradora";
      case "coordenador":
        return "Coordenadora";
      case "atendente":
        return "Atendente";
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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setMobileAberto(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col border-r border-borda bg-superficie shadow-lg transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Cabeçalho da Sidebar / Logo */}
        <div className="flex h-16 items-center justify-between border-b border-borda px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-acento text-white shadow-xs">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <span className="font-heading text-sm font-bold tracking-tight text-texto block">
                UNOPAR
              </span>
              <span className="text-[11px] font-semibold text-texto-suave block">
                Controle de Protocolos
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileAberto(false)}
            className="rounded-md p-1.5 text-texto-suave hover:bg-fundo hover:text-texto lg:hidden"
            title="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Links de Navegação */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
          {/* Seção Principal */}
          <div>
            <span className="px-3 text-[10px] font-extrabold tracking-wider text-texto-suave uppercase">
              Principal
            </span>
            <ul className="mt-2 space-y-1">
              {rotasPrincipais.map((rota) => {
                const Icone = rota.icone;
                const ativo = pathname === rota.href || pathname.startsWith(`${rota.href}/`);
                return (
                  <li key={rota.href}>
                    <Link
                      href={rota.href}
                      onClick={() => setMobileAberto(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition shadow-xs ${
                        ativo
                          ? "bg-acento text-white shadow-sm"
                          : "text-texto-suave hover:bg-fundo hover:text-texto"
                      }`}
                    >
                      <Icone className={`h-4 w-4 shrink-0 ${ativo ? "text-white" : "text-texto-suave"}`} />
                      <span>{rota.rotulo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Seção de Configurações */}
          <div>
            <div className="flex items-center justify-between px-3">
              <span className="text-[10px] font-extrabold tracking-wider text-texto-suave uppercase">
                Sistema & Preferências
              </span>
            </div>

            <div className="mt-2 space-y-1">
              {/* Botão de Toggle de Configurações */}
              <button
                type="button"
                onClick={() => setConfigAberto(!configAberto)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold transition ${
                  estaNaConfiguracao
                    ? "bg-acento/10 text-acento border border-acento/30"
                    : "text-texto-suave hover:bg-fundo hover:text-texto"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className={`h-4 w-4 shrink-0 ${estaNaConfiguracao ? "text-acento" : "text-texto-suave"}`} />
                  <span>Configurações</span>
                </div>
                {configAberto ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {/* Submenu de Configurações */}
              {configAberto && (
                <ul className="mt-1 space-y-1 pl-4 border-l-2 border-borda ml-4">
                  {subRotasConfig.map((sub) => {
                    const SubIcone = sub.icone;
                    const ativo = pathname === sub.href || pathname.startsWith(`${sub.href}/`);
                    return (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          onClick={() => setMobileAberto(false)}
                          className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-semibold transition ${
                            ativo
                              ? "bg-acento text-white font-bold shadow-xs"
                              : "text-texto-suave hover:bg-fundo hover:text-texto"
                          }`}
                        >
                          <SubIcone className="h-3.5 w-3.5 shrink-0" />
                          <span>{sub.rotulo}</span>
                        </Link>
                      </li>
                    );
                  })}

                  {/* Seletor de Tema Integrado no Submenu */}
                  <li className="pt-2">
                    <span className="block px-2 text-[10px] font-bold text-texto-suave uppercase mb-1.5">
                      Tema Visual
                    </span>
                    <div className="grid grid-cols-3 gap-1 rounded-lg border border-borda bg-fundo p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => alterarTema("claro")}
                        className={`flex flex-col items-center justify-center gap-1 rounded py-1.5 text-[11px] font-bold transition ${
                          temaAtual === "claro"
                            ? "bg-superficie text-texto shadow-xs border border-borda"
                            : "text-texto-suave hover:text-texto"
                        }`}
                        title="Tema Claro"
                      >
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        <span>Claro</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => alterarTema("sepia")}
                        className={`flex flex-col items-center justify-center gap-1 rounded py-1.5 text-[11px] font-bold transition ${
                          temaAtual === "sepia"
                            ? "bg-superficie text-texto shadow-xs border border-borda"
                            : "text-texto-suave hover:text-texto"
                        }`}
                        title="Tema Sépia (Leitura Suave)"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-amber-700" />
                        <span>Sépia</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => alterarTema("escuro")}
                        className={`flex flex-col items-center justify-center gap-1 rounded py-1.5 text-[11px] font-bold transition ${
                          temaAtual === "escuro"
                            ? "bg-superficie text-texto shadow-xs border border-borda"
                            : "text-texto-suave hover:text-texto"
                        }`}
                        title="Tema Escuro"
                      >
                        <Moon className="h-3.5 w-3.5 text-sky-400" />
                        <span>Escuro</span>
                      </button>
                    </div>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé da Sidebar: Usuária Conectada & Sair */}
        <div className="border-t border-borda bg-fundo/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 truncate">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-acento text-xs font-extrabold text-white shadow-xs">
                {perfil.nome_completo.substring(0, 2).toUpperCase()}
              </div>
              <div className="truncate">
                <div className="font-heading text-xs font-bold text-texto truncate" title={perfil.nome_completo}>
                  {perfil.nome_completo}
                </div>
                <div className="text-[11px] font-medium text-texto-suave">
                  {formatarPapel(perfil.papel)}
                </div>
              </div>
            </div>

            <form action={logoutUsuario}>
              <button
                type="submit"
                className="rounded-lg border border-borda bg-superficie p-2 text-texto-suave hover:border-erro/40 hover:bg-erro-fundo hover:text-erro transition shadow-xs"
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
