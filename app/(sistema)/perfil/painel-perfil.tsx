"use client";

import { useState, useTransition } from "react";
import { type Perfil, type CredencialAcesso } from "@/types/database";
import { salvarCredencialExternaAction } from "../usuarios/actions";
import { alterarMinhaSenhaAction } from "./actions";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, Lock, Key, History, Check, AlertCircle, ShieldCheck } from "lucide-react";

interface PainelPerfilProps {
  perfil: Perfil;
  historicoAcessos: (CredencialAcesso & { admin_nome?: string })[];
}

export function PainelPerfil({ perfil, historicoAcessos }: PainelPerfilProps) {
  const [isPending, startTransition] = useTransition();

  // Estados de formulário
  const [novaSenhaSistema, setNovaSenhaSistema] = useState("");
  const [confirmaSenhaSistema, setConfirmaSenhaSistema] = useState("");
  const [novaSenhaExterna, setNovaSenhaExterna] = useState("");

  const [msgSucesso, setMsgSucesso] = useState<string | null>(null);
  const [msgErro, setMsgErro] = useState<string | null>(null);

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

  const calcularForcaSenha = (senha: string) => {
    if (!senha) return { nivel: 0, rotulo: "", cor: "" };
    let pontos = 0;
    if (senha.length >= 8) pontos += 2;
    if (/[A-Z]/.test(senha)) pontos += 1;
    if (/[0-9]/.test(senha)) pontos += 1;
    if (/[^A-Za-z0-9]/.test(senha)) pontos += 1;

    if (pontos <= 2) return { nivel: 1, rotulo: "Fraca", cor: "bg-erro text-erro" };
    if (pontos <= 4) return { nivel: 2, rotulo: "Média", cor: "bg-alerta text-alerta" };
    return { nivel: 3, rotulo: "Forte", cor: "bg-sucesso text-sucesso" };
  };

  const forca = calcularForcaSenha(novaSenhaSistema);

  const handleTrocarSenhaSistema = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSucesso(null);
    setMsgErro(null);

    if (novaSenhaSistema.length < 6) {
      setMsgErro("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (novaSenhaSistema !== confirmaSenhaSistema) {
      setMsgErro("A confirmação de senha não coincide com a nova senha digitada.");
      return;
    }

    startTransition(async () => {
      const res = await alterarMinhaSenhaAction(novaSenhaSistema);
      if (!res.sucesso) {
        setMsgErro(res.erro || "Erro ao atualizar senha.");
      } else {
        setMsgSucesso("Sua senha de acesso ao sistema foi atualizada com sucesso.");
        setNovaSenhaSistema("");
        setConfirmaSenhaSistema("");
      }
    });
  };

  const handleSalvarSenhaExterna = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSucesso(null);
    setMsgErro(null);

    if (!novaSenhaExterna.trim()) {
      setMsgErro("Digite a senha da plataforma externa.");
      return;
    }

    startTransition(async () => {
      const res = await salvarCredencialExternaAction(perfil.id, novaSenhaExterna);
      if (!res.sucesso) {
        setMsgErro(res.erro || "Falha ao salvar senha da plataforma externa.");
      } else {
        setMsgSucesso("Senha da plataforma externa atualizada e armazenada de forma cifrada.");
        setNovaSenhaExterna("");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. Cabeçalho Padronizado da Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Meu Perfil e Segurança
          </h1>
          <p className="text-sm text-texto-suave mt-0.5">
            Dados cadastrais, troca de senha e gestão da sua credencial da plataforma externa.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-acento/15 px-3 py-1 text-xs font-semibold text-acento border border-acento/30">
          <ShieldCheck className="h-4 w-4" />
          <span>Conta Ativa</span>
        </div>
      </div>

      {msgSucesso && (
        <div className="flex items-center gap-2 rounded-lg border border-sucesso/40 bg-sucesso-fundo/40 p-4 text-xs font-medium text-sucesso">
          <Check className="h-4 w-4 shrink-0" />
          <span>{msgSucesso}</span>
        </div>
      )}

      {msgErro && (
        <div className="flex items-start gap-2 rounded-lg border border-erro/40 bg-erro-fundo p-4 text-xs font-medium text-erro">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{msgErro}</span>
        </div>
      )}

      {/* Cartão de Identificação */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-borda pb-3">
          <User className="h-4 w-4 text-acento" />
          <h2 className="text-sm font-semibold text-texto">
            Identificação Cadastral
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-borda bg-fundo p-3.5">
            <span className="font-medium text-texto-suave block text-[11px]">Nome Completo</span>
            <span className="text-texto font-semibold text-sm block mt-0.5">{perfil.nome_completo}</span>
          </div>

          <div className="rounded-lg border border-borda bg-fundo p-3.5">
            <span className="font-medium text-texto-suave block text-[11px]">E-mail Institucional</span>
            <span className="text-texto font-mono font-medium block mt-0.5">{perfil.email}</span>
          </div>

          <div className="rounded-lg border border-borda bg-fundo p-3.5">
            <span className="font-medium text-texto-suave block text-[11px]">Papel no Sistema</span>
            <span className="text-acento font-semibold block mt-0.5">{formatarPapel(perfil.papel)}</span>
          </div>
        </div>
      </div>

      {/* Grid de Senhas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Troca de Senha do Sistema */}
        <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-borda pb-3">
            <Lock className="h-4 w-4 text-acento" />
            <h2 className="text-sm font-semibold text-texto">
              Alterar Senha do Sistema
            </h2>
          </div>

          <form onSubmit={handleTrocarSenhaSistema} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-texto mb-1.5">
                Nova Senha (mínimo 8 caracteres)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={novaSenhaSistema}
                onChange={(e) => setNovaSenhaSistema(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-xs text-texto focus:border-acento focus:outline-none"
              />
              {novaSenhaSistema && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                  <span className="text-texto-suave">Força:</span>
                  <span className={`font-semibold ${forca.cor}`}>{forca.rotulo}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-texto mb-1.5">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmaSenhaSistema}
                onChange={(e) => setConfirmaSenhaSistema(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-xs text-texto focus:border-acento focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover disabled:opacity-50 transition"
            >
              {isPending ? "Atualizando..." : "Atualizar Senha"}
            </button>
          </form>
        </div>

        {/* Cofre Cifrado da Plataforma Externa */}
        <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-borda pb-3">
            <Key className="h-4 w-4 text-acento" />
            <h2 className="text-sm font-semibold text-texto">
              Senha da Plataforma Externa (Cofre)
            </h2>
          </div>

          <p className="text-xs text-texto-suave leading-relaxed">
            Armazenada com criptografia de ponta a ponta (AES-256-GCM). Permite que administradores tenham acesso de contingência sob auditoria rigorosa.
          </p>

          <form onSubmit={handleSalvarSenhaExterna} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-texto mb-1.5">
                Atualizar Senha da Plataforma Externa
              </label>
              <input
                type="password"
                required
                value={novaSenhaExterna}
                onChange={(e) => setNovaSenhaExterna(e.target.value)}
                placeholder="Digite a nova senha do PAD/AVA..."
                className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-xs text-texto focus:border-acento focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo disabled:opacity-50 transition"
            >
              {isPending ? "Salvando..." : "Salvar no Cofre Cifrado"}
            </button>
          </form>
        </div>
      </div>

      {/* Histórico de Acessos ao seu Cofre */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-borda pb-3">
          <History className="h-4 w-4 text-acento" />
          <h2 className="text-sm font-semibold text-texto">
            Auditoria de Consultas à sua Senha Externa
          </h2>
        </div>

        {historicoAcessos.length === 0 ? (
          <p className="text-xs text-texto-suave">Nenhum acesso de administrador foi realizado ao seu cofre.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
            <table className="tabela-densa">
              <thead>
                <tr>
                  <th>Data e Hora</th>
                  <th>Administrador Solicitante</th>
                  <th>Endereço IP</th>
                </tr>
              </thead>
              <tbody>
                {historicoAcessos.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs tabular-nums text-texto-suave">
                      {format(parseISO(a.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </td>
                    <td className="text-xs font-medium text-texto">
                      {a.admin_nome || "Administrador"}
                    </td>
                    <td className="font-mono text-xs text-texto-suave tabular-nums">
                      {a.ip || "127.0.0.1"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
