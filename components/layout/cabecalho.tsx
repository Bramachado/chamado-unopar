"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SeletorTema } from "@/components/ui/theme-switcher";
import { type Perfil } from "@/types/database";
import { 
  LayoutDashboard, 
  Ticket, 
  Tag, 
  Trophy, 
  FileText, 
  Users, 
  User, 
  LogOut,
  Shield
} from "lucide-react";
import { logoutUsuario } from "./actions";

interface CabecalhoProps {
  perfil: Perfil;
}

export function CabecalhoPrincipal({ perfil }: CabecalhoProps) {
  const pathname = usePathname();

  const ehAdmin = perfil.papel === "admin";

  const rotas = [
    { href: "/painel", rotulo: "Painel", icone: LayoutDashboard },
    { href: "/chamados", rotulo: "Chamados", icone: Ticket },
    { href: "/motivos", rotulo: "Motivos", icone: Tag },
    { href: "/desempenho", rotulo: "Desempenho", icone: Trophy },
    ...(ehAdmin
      ? [
          { href: "/auditoria", rotulo: "Auditoria", icone: FileText },
          { href: "/usuarios", rotulo: "Usuárias", icone: Users },
        ]
      : []),
    { href: "/perfil", rotulo: "Meu perfil", icone: User },
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

  return (
    <header className="border-b border-borda bg-superficie">
      {/* Faixa superior */}
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-acento text-white">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <span className="font-heading text-sm font-bold tracking-tight text-texto">
              UNOPAR Parauapebas
            </span>
            <span className="ml-2 text-xs text-texto-suave">
              Controle de Protocolos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-texto">
              {perfil.nome_completo}
            </div>
            <div className="text-xs text-texto-suave">
              {formatarPapel(perfil.papel)}
            </div>
          </div>

          <SeletorTema />

          <form action={logoutUsuario}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded border border-borda bg-fundo px-2.5 py-1 text-xs text-texto-suave transition hover:bg-superficie hover:text-erro"
              title="Encerrar sessão"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </form>
        </div>
      </div>

      {/* Barra de Navegação */}
      <nav className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <ul className="flex space-x-1 overflow-x-auto border-t border-borda/40 py-1.5">
          {rotas.map((rota) => {
            const Icone = rota.icone;
            const ativo = pathname === rota.href || pathname.startsWith(`${rota.href}/`);
            return (
              <li key={rota.href}>
                <Link
                  href={rota.href}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${
                    ativo
                      ? "bg-fundo text-acento border border-borda shadow-sm"
                      : "text-texto-suave hover:bg-fundo/50 hover:text-texto"
                  }`}
                >
                  <Icone className="h-3.5 w-3.5" />
                  <span>{rota.rotulo}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
