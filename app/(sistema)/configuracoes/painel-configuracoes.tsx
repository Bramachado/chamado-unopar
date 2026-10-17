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
  Lock,
} from "lucide-react";

type Tema = "claro" | "sepia" | "escuro";

interface PainelConfiguracoesProps {
  perfil: Perfil;
}

export function PainelConfiguracoes({ perfil }: PainelConfiguracoesProps) {
  const [temaAtual, setTemaAtual] = useState<Tema>("claro");

  useEffect(() => {
    const salvoCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("unopar_tema="))
      ?.split("=")[1] as Tema | undefined;
    const salvoLocal = localStorage.getItem("unopar-tema") as Tema | null;
    const temaEfetivo = salvoLocal || salvoCookie || "claro";
    setTemaAtual(temaEfetivo);
    document.documentElement.setAttribute("data-theme", temaEfetivo);
  }, []);

  const alterarTema = (novoTema: Tema) => {
    setTemaAtual(novoTema);
    document.documentElement.setAttribute("data-theme", novoTema);
    localStorage.setItem("unopar-tema", novoTema);
    document.cookie = `unopar_tema=${novoTema}; path=/; max-age=31536000; SameSite=Lax`;
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
        {/* Card 1: Meu Perfil, Foto & Segurança */}
        <div className="rounded-xl border border-borda bg-superficie p-5 flex flex-col justify-between space-y-4 hover:border-acento/50 transition shadow-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-acento/15 text-acento flex items-center justify-center border border-acento/30">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-texto">Meu Perfil e Foto</h2>
                <span className="text-xs text-texto-suave block">
                  Foto de perfil, identificação cadastral e segurança
                </span>
              </div>
            </div>

            <p className="text-xs text-texto-suave leading-relaxed">
              Anexe ou altere sua foto de perfil, visualize seus dados de acesso institucional e
              gerencie suas credenciais e senhas com segurança.
            </p>

            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md bg-fundo px-2.5 py-1 font-medium text-texto border border-borda">
                <span>Foto de perfil</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-fundo px-2.5 py-1 font-medium text-texto border border-borda">
                <Lock className="h-3 w-3 text-acento" />
                <span>Segurança</span>
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
        <div className="rounded-xl border border-borda bg-superficie p-5 flex flex-col justify-between space-y-4 shadow-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-acento/15 text-acento flex items-center justify-center border border-acento/30">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-texto">Tema Visual da Interface</h2>
                <span className="text-xs text-texto-suave block">
                  Alterne entre os modos Claro, Sépia e Escuro
                </span>
              </div>
            </div>

            <p className="text-xs text-texto-suave leading-relaxed">
              Personalize o esquema de cores para sua rotina de trabalho. O ajuste é aplicado
              instantaneamente e fica salvo no seu navegador.
            </p>

            {/* Pílula Seletora de Tema (Conforme Imagem Solicitada) */}
            <div className="pt-2">
              <div className="inline-flex items-center rounded-xl border border-borda bg-fundo p-1 text-xs shadow-xs w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => alterarTema("claro")}
                  className={`btn-tátil flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    temaAtual === "claro"
                      ? "bg-superficie text-texto font-bold shadow-xs border border-borda/80 ring-1 ring-amber-500/20"
                      : "text-texto-suave hover:text-texto"
                  }`}
                  title="Tema Claro"
                >
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span>Claro</span>
                </button>

                <button
                  type="button"
                  onClick={() => alterarTema("sepia")}
                  className={`btn-tátil flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    temaAtual === "sepia"
                      ? "bg-superficie text-texto font-bold shadow-xs border border-borda/80 ring-1 ring-blue-600/20"
                      : "text-texto-suave hover:text-texto"
                  }`}
                  title="Tema Sépia (Bege e Azul)"
                >
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span>Sépia</span>
                </button>

                <button
                  type="button"
                  onClick={() => alterarTema("escuro")}
                  className={`btn-tátil flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    temaAtual === "escuro"
                      ? "bg-superficie text-texto font-bold shadow-xs border border-borda/80 ring-1 ring-indigo-400/20"
                      : "text-texto-suave hover:text-texto"
                  }`}
                  title="Tema Escuro"
                >
                  <Moon className="h-4 w-4 text-indigo-400" />
                  <span>Escuro</span>
                </button>
              </div>
            </div>

            {/* Cards de Demonstração / Preview das Cores */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div
                onClick={() => alterarTema("claro")}
                className={`cursor-pointer rounded-lg border p-2.5 text-center transition ${
                  temaAtual === "claro"
                    ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/30"
                    : "border-borda bg-fundo opacity-70 hover:opacity-100"
                }`}
              >
                <div className="h-4 rounded bg-white border border-slate-200 mb-1.5 flex items-center px-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                </div>
                <span className="text-[10px] font-bold text-texto block">Branco / Azul</span>
              </div>

              <div
                onClick={() => alterarTema("sepia")}
                className={`cursor-pointer rounded-lg border p-2.5 text-center transition ${
                  temaAtual === "sepia"
                    ? "border-blue-600 bg-blue-600/5 ring-2 ring-blue-600/30"
                    : "border-borda bg-fundo opacity-70 hover:opacity-100"
                }`}
              >
                <div className="h-4 rounded bg-[#f4ece1] border border-[#d8c8b4] mb-1.5 flex items-center px-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#1e40af]"></div>
                </div>
                <span className="text-[10px] font-bold text-texto block">Bege / Azul</span>
              </div>

              <div
                onClick={() => alterarTema("escuro")}
                className={`cursor-pointer rounded-lg border p-2.5 text-center transition ${
                  temaAtual === "escuro"
                    ? "border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/30"
                    : "border-borda bg-fundo opacity-70 hover:opacity-100"
                }`}
              >
                <div className="h-4 rounded bg-[#0b1329] border border-[#1e293b] mb-1.5 flex items-center px-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-sky-400"></div>
                </div>
                <span className="text-[10px] font-bold text-texto block">Noturno / Azul</span>
              </div>
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
                Cadastre novas colaboradoras, altere permissões de acesso (Administrador,
                Coordenador, Atendente) e consulte senhas de contingência no cofre auditado.
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
                  <h2 className="text-sm font-semibold text-texto">Logs de Auditoria</h2>
                  <span className="text-xs text-texto-suave block">
                    Trilha completa de ações e alterações em banco
                  </span>
                </div>
              </div>

              <p className="text-xs text-texto-suave leading-relaxed">
                Rastreie alterações em chamados, uploads de arquivos, manipulação de motivos e
                qualquer operação sensível com data/hora e IP (quando informado pelo proxy).
              </p>

              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-fundo px-2.5 py-1 font-medium text-texto border border-borda">
                  <span>Exportação CSV</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-fundo px-2.5 py-1 font-medium text-texto border border-borda">
                  <span title="A aplicação só insere registros (sem permissão de alterar ou apagar). Administradores do banco ainda podem alterá-los.">
                    Somente inclusão pela aplicação
                  </span>
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
