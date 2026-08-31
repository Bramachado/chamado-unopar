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
    <div className="space-y-8">
      {/* 1. Cabeçalho Padronizado da Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Central de Configurações
          </h1>
          <p className="text-sm text-texto-suave mt-0.5">
            Gerencie seu perfil pessoal, temas visuais e configurações administrativas do sistema.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-acento/15 px-3 py-1 text-xs font-semibold text-acento border border-acento/30">
          <ShieldCheck className="h-4 w-4" />
          <span>Painel de Ajustes</span>
        </div>
      </div>

      {/* Grid de Configurações */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Card 1: Meu Perfil & Segurança */}
        <div className="rounded-lg border border-borda bg-superficie p-5 flex flex-col justify-between space-y-4 hover:border-acento/50 transition">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-acento/15 text-acento flex items-center justify-center border border-acento/30">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-texto">
                  Meu Perfil e Segurança
                </h2>
                <span className="text-xs text-texto-suave block">
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
            className="inline-flex items-center justify-between h-9 px-4 rounded-lg bg-fundo text-xs font-semibold text-acento hover:bg-superficie hover:text-acento-hover border border-borda transition"
          >
            <span>Acessar Meu Perfil</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Card 2: Preferências de Tema Visual */}
        <div className="rounded-lg border border-borda bg-superficie p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-acento/15 text-acento flex items-center justify-center border border-acento/30">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-texto">
                  Tema Visual da Interface
                </h2>
                <span className="text-xs text-texto-suave block">
                  Alterne entre os modos Claro, Sépia e Escuro
                </span>
              </div>
            </div>

            <p className="text-xs text-texto-suave leading-relaxed">
              Escolha a paleta de cores ideal para o seu ambiente de trabalho. As preferências são salvas automaticamente no seu navegador.
            </p>

            {/* Seletores de Tema */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => alterarTema("claro")}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs font-semibold transition ${
                  temaAtual === "claro"
                    ? "border-acento bg-acento/10 text-acento ring-2 ring-acento"
                    : "border-borda bg-fundo text-texto hover:bg-superficie"
                }`}
              >
                <Sun className="h-4 w-4" />
                <span>Claro</span>
              </button>

              <button
                type="button"
                onClick={() => alterarTema("sepia")}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs font-semibold transition ${
                  temaAtual === "sepia"
                    ? "border-acento bg-acento/10 text-acento ring-2 ring-acento"
                    : "border-borda bg-fundo text-texto hover:bg-superficie"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>Sépia</span>
              </button>

              <button
                type="button"
                onClick={() => alterarTema("escuro")}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs font-semibold transition ${
                  temaAtual === "escuro"
                    ? "border-acento bg-acento/10 text-acento ring-2 ring-acento"
                    : "border-borda bg-fundo text-texto hover:bg-superficie"
                }`}
              >
                <Moon className="h-4 w-4" />
                <span>Escuro</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-texto-suave border-t border-borda pt-2">
            Tema ativo: <strong className="text-texto capitalize">{temaAtual}</strong>
          </div>
        </div>

        {/* Card 3: Gestão de Equipe (Apenas Admin) */}
        {ehAdmin && (
          <div className="rounded-lg border border-borda bg-superficie p-5 flex flex-col justify-between space-y-4 hover:border-acento/50 transition">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-acento/15 text-acento flex items-center justify-center border border-acento/30">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-texto">
                    Gestão de Equipe e Credenciais
                  </h2>
                  <span className="text-xs text-texto-suave block">
                    Papéis de acesso, criação de contas e cofre
                  </span>
                </div>
              </div>

              <p className="text-xs text-texto-suave leading-relaxed">
                Cadastre novas colaboradoras, altere permissões de acesso (Administrador, Coordenador, Atendente) e consulte senhas de contingência no cofre auditado.
              </p>

              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-fundo px-2.5 py-1 font-medium text-texto border border-borda">
                  <span>Permissões RBAC</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-fundo px-2.5 py-1 font-medium text-texto border border-borda">
                  <span>Auditoria de cofre</span>
                </span>
              </div>
            </div>

            <Link
              href="/usuarios"
              className="inline-flex items-center justify-between h-9 px-4 rounded-lg bg-fundo text-xs font-semibold text-acento hover:bg-superficie hover:text-acento-hover border border-borda transition"
            >
              <span>Gerenciar Equipe</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Card 4: Auditoria do Sistema (Apenas Admin) */}
        {ehAdmin && (
          <div className="rounded-lg border border-borda bg-superficie p-5 flex flex-col justify-between space-y-4 hover:border-acento/50 transition">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-acento/15 text-acento flex items-center justify-center border border-acento/30">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-texto">
                    Logs de Auditoria
                  </h2>
                  <span className="text-xs text-texto-suave block">
                    Trilha completa de ações e alterações em banco
                  </span>
                </div>
              </div>

              <p className="text-xs text-texto-suave leading-relaxed">
                Rastreie alterações em chamados, uploads de arquivos, manipulação de motivos e qualquer operação sensível com IP e data/hora.
              </p>

              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-fundo px-2.5 py-1 font-medium text-texto border border-borda">
                  <span>Exportação CSV</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-fundo px-2.5 py-1 font-medium text-texto border border-borda">
                  <span>Trilha imutável</span>
                </span>
              </div>
            </div>

            <Link
              href="/auditoria"
              className="inline-flex items-center justify-between h-9 px-4 rounded-lg bg-fundo text-xs font-semibold text-acento hover:bg-superficie hover:text-acento-hover border border-borda transition"
            >
              <span>Visualizar Auditoria</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
