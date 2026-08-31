"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { type Perfil } from "@/types/database";
import { 
  User, 
  Users, 
  FileText, 
  Palette, 
  Sun, 
  Moon, 
  BookOpen, 
  ArrowRight, 
  ShieldCheck, 
  Key, 
  Lock
} from "lucide-react";

type Tema = "claro" | "sepia" | "escuro";

interface PainelConfiguracoesProps {
  perfil: Perfil;
}

export function PainelConfiguracoes({ perfil }: PainelConfiguracoesProps) {
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-superficie p-5 rounded-xl border border-borda shadow-sm">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto tracking-tight">
            Central de Configurações
          </h1>
          <p className="text-xs text-texto-suave">
            Gerencie seu perfil pessoal, temas visuais e configurações administrativas do sistema.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-acento/15 px-3.5 py-1 text-xs font-bold text-acento border border-acento/30">
          <ShieldCheck className="h-4 w-4" />
          <span>Painel de Controle</span>
        </div>
      </div>

      {/* Grid de Configurações */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Card 1: Meu Perfil & Segurança */}
        <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-acento/50 transition">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-acento/15 text-acento flex items-center justify-center border border-acento/30 shadow-xs">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-heading text-base font-bold text-texto">
                  Meu Perfil e Segurança
                </h2>
                <span className="text-xs text-texto-suave">
                  Dados cadastrais, senha do sistema e credencial externa
                </span>
              </div>
            </div>

            <p className="text-xs text-texto-suave leading-relaxed">
              Altere sua senha de acesso ao sistema, gerencie a senha de acesso à plataforma externa e visualize o histórico de quem consultou suas credenciais.
            </p>

            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md bg-fundo px-2.5 py-1 font-medium text-texto border border-borda">
                <Lock className="h-3 w-3 text-acento" />
                <span>Trocar senha</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-fundo px-2.5 py-1 font-medium text-texto border border-borda">
                <Key className="h-3 w-3 text-acento" />
                <span>Cofre cifrado</span>
              </span>
            </div>
          </div>

          <Link
            href="/perfil"
            className="inline-flex items-center justify-between rounded-lg bg-fundo px-4 py-2.5 text-xs font-bold text-acento hover:bg-superficie hover:text-acento-hover border border-borda transition shadow-xs"
          >
            <span>Acessar Meu Perfil</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Card 2: Aparência e Temas Visuais */}
        <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-4 hover:border-acento/50 transition">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center border border-amber-500/30 shadow-xs">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-texto">
                Aparência e Tema Visual
              </h2>
              <span className="text-xs text-texto-suave">
                Personalize as cores de interface para seu conforto
              </span>
            </div>
          </div>

          <p className="text-xs text-texto-suave leading-relaxed">
            Escolha o tema de alto contraste ideal para seu ambiente de trabalho ou leitura prolongada.
          </p>

          {/* Seletor Visual de Cards de Temas */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {/* Claro */}
            <button
              type="button"
              onClick={() => alterarTema("claro")}
              className={`flex flex-col items-center justify-center rounded-lg border-2 p-3 text-center transition ${
                temaAtual === "claro"
                  ? "border-acento bg-acento/10 shadow-xs"
                  : "border-borda bg-fundo hover:border-borda/80"
              }`}
            >
              <Sun className="h-5 w-5 text-amber-500 mb-1.5" />
              <span className="font-bold text-xs text-texto">Claro</span>
              <span className="text-[10px] text-texto-suave mt-0.5">Alto Contraste</span>
            </button>

            {/* Sépia */}
            <button
              type="button"
              onClick={() => alterarTema("sepia")}
              className={`flex flex-col items-center justify-center rounded-lg border-2 p-3 text-center transition ${
                temaAtual === "sepia"
                  ? "border-[#0E6F63] bg-[#D1E7DD]/30 shadow-xs"
                  : "border-borda bg-fundo hover:border-borda/80"
              }`}
            >
              <BookOpen className="h-5 w-5 text-amber-700 mb-1.5" />
              <span className="font-bold text-xs text-texto">Sépia</span>
              <span className="text-[10px] text-texto-suave mt-0.5">Descanso Visual</span>
            </button>

            {/* Escuro */}
            <button
              type="button"
              onClick={() => alterarTema("escuro")}
              className={`flex flex-col items-center justify-center rounded-lg border-2 p-3 text-center transition ${
                temaAtual === "escuro"
                  ? "border-sky-400 bg-sky-950/40 shadow-xs"
                  : "border-borda bg-fundo hover:border-borda/80"
              }`}
            >
              <Moon className="h-5 w-5 text-sky-400 mb-1.5" />
              <span className="font-bold text-xs text-texto">Escuro</span>
              <span className="text-[10px] text-texto-suave mt-0.5">Modo Noturno</span>
            </button>
          </div>
        </div>

        {/* Card 3: Gestão de Usuárias e Cofre (Se Administradora) */}
        {ehAdmin ? (
          <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-acento/50 transition">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-sky-500/15 text-sky-600 flex items-center justify-center border border-sky-500/30 shadow-xs">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-heading text-base font-bold text-texto">
                    Gestão de Usuárias e Cofre
                  </h2>
                  <span className="text-xs text-texto-suave">
                    Controle de contas, papéis e senhas da plataforma
                  </span>
                </div>
              </div>

              <p className="text-xs text-texto-suave leading-relaxed">
                Cadastre novas colaboradoras, defina papéis (Administradora, Coordenadora, Atendente), ative ou desative contas e consulte senhas salvas no cofre.
              </p>
            </div>

            <Link
              href="/usuarios"
              className="inline-flex items-center justify-between rounded-lg bg-fundo px-4 py-2.5 text-xs font-bold text-acento hover:bg-superficie hover:text-acento-hover border border-borda transition shadow-xs"
            >
              <span>Gerenciar Colaboradoras</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-borda bg-fundo/40 p-6 flex flex-col justify-center text-center text-xs text-texto-suave">
            <Users className="h-6 w-6 text-texto-suave mx-auto mb-2 opacity-50" />
            <span className="font-bold text-texto">Gestão de Usuárias</span>
            <span>Acesso restrito ao perfil de Administradora.</span>
          </div>
        )}

        {/* Card 4: Logs de Auditoria do Sistema (Se Administradora) */}
        {ehAdmin ? (
          <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-acento/50 transition">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center border border-emerald-500/30 shadow-xs">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-heading text-base font-bold text-texto">
                    Logs de Auditoria
                  </h2>
                  <span className="text-xs text-texto-suave">
                    Rastreamento de todas as alterações e acessos
                  </span>
                </div>
              </div>

              <p className="text-xs text-texto-suave leading-relaxed">
                Inspecione operações no banco de dados, alterações cadastrais, criação e edição de chamados, anexos e acessos a credenciais com IP e data/hora.
              </p>
            </div>

            <Link
              href="/auditoria"
              className="inline-flex items-center justify-between rounded-lg bg-fundo px-4 py-2.5 text-xs font-bold text-acento hover:bg-superficie hover:text-acento-hover border border-borda transition shadow-xs"
            >
              <span>Visualizar Logs de Auditoria</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-borda bg-fundo/40 p-6 flex flex-col justify-center text-center text-xs text-texto-suave">
            <FileText className="h-6 w-6 text-texto-suave mx-auto mb-2 opacity-50" />
            <span className="font-bold text-texto">Logs de Auditoria</span>
            <span>Acesso restrito ao perfil de Administradora.</span>
          </div>
        )}
      </div>
    </div>
  );
}
