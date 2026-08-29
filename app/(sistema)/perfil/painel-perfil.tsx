"use client";

import { useState, useTransition } from "react";
import { type Perfil, type CredencialAcesso } from "@/types/database";
import { salvarCredencialExternaAction } from "../usuarios/actions";
import { criarClienteBrowser } from "@/lib/supabase/client";
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
        return "Administradora";
      case "coordenador":
        return "Coordenadora";
      case "atendente":
        return "Atendente";
      default:
        return papel;
    }
  };

  const calcularForcaSenha = (senha: string) => {
    if (!senha) return { nivel: 0, rotulo: "", cor: "" };
    let pontos = 0;
    if (senha.length >= 8) pontos += 1;
    if (senha.length >= 12) pontos += 1;
    if (/[0-9]/.test(senha)) pontos += 1;
    if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos += 1;
    if (/[^a-zA-Z0-9]/.test(senha)) pontos += 1;

    if (pontos <= 2) return { nivel: 1, rotulo: "Fraca", cor: "bg-erro text-erro" };
    if (pontos <= 4) return { nivel: 2, rotulo: "Média", cor: "bg-alerta text-alerta" };
    return { nivel: 3, rotulo: "Forte", cor: "bg-sucesso text-sucesso" };
  };

  const forca = calcularForcaSenha(novaSenhaSistema);

  const handleTrocarSenhaSistema = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSucesso(null);
    setMsgErro(null);

    if (novaSenhaSistema.length < 8) {
      setMsgErro("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (novaSenhaSistema !== confirmaSenhaSistema) {
      setMsgErro("A confirmação de senha não coincide com a nova senha digitada.");
      return;
    }

    startTransition(async () => {
      const supabase = criarClienteBrowser();
      const { error } = await supabase.auth.updateUser({
        password: novaSenhaSistema,
      });

      if (error) {
        setMsgErro(`Erro ao atualizar senha: ${error.message}`);
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
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-superficie p-4 rounded-xl border border-borda shadow-sm">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto tracking-tight">
            Meu Perfil e Segurança
          </h1>
          <p className="text-xs text-texto-suave">
            Dados cadastrais, troca de senha e gestão da sua credencial da plataforma externa.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-acento/15 px-3 py-1 text-xs font-bold text-acento border border-acento/30">
          <ShieldCheck className="h-4 w-4" />
          <span>Conta Segura</span>
        </div>
      </div>

      {msgSucesso && (
        <div className="flex items-center gap-2 rounded-xl border border-sucesso/40 bg-sucesso-fundo p-4 text-xs font-bold text-sucesso shadow-sm">
          <Check className="h-4 w-4 shrink-0" />
          <span>{msgSucesso}</span>
        </div>
      )}

      {msgErro && (
        <div className="flex items-start gap-2 rounded-xl border border-erro/40 bg-erro-fundo p-4 text-xs font-bold text-erro shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{msgErro}</span>
        </div>
      )}

      {/* Cartão de Identificação */}
      <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-borda pb-3">
          <User className="h-4 w-4 text-acento" />
          <h2 className="font-heading text-sm font-bold text-texto">
            Identificação Cadastral
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-borda/60 bg-fundo p-3.5">
            <span className="font-semibold text-texto-suave block text-[11px]">Nome Completo</span>
            <span className="text-texto font-bold text-sm block mt-0.5">{perfil.nome_completo}</span>
          </div>

          <div className="rounded-lg border border-borda/60 bg-fundo p-3.5">
            <span className="font-semibold text-texto-suave block text-[11px]">E-mail Institucional</span>
            <span className="text-texto font-mono font-bold block mt-0.5">{perfil.email}</span>
          </div>

          <div className="rounded-lg border border-borda/60 bg-fundo p-3.5">
            <span className="font-semibold text-texto-suave block text-[11px]">Papel no Sistema</span>
            <span className="inline-block rounded-md border border-acento/40 bg-acento/15 px-2.5 py-0.5 text-xs font-bold text-acento mt-1">
              {formatarPapel(perfil.papel)}
            </span>
          </div>
        </div>
      </div>

      {/* Formulários de Senhas em 2 Colunas */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Formulário 1: Troca de Senha do Sistema */}
        <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-borda pb-3">
            <Lock className="h-4 w-4 text-acento" />
            <h2 className="font-heading text-sm font-bold text-texto">
              Senha de Acesso ao Sistema
            </h2>
          </div>

          <form onSubmit={handleTrocarSenhaSistema} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-texto mb-1.5">
                Nova Senha (mínimo 8 caracteres) *
              </label>
              <input
                type="password"
                required
                value={novaSenhaSistema}
                onChange={(e) => setNovaSenhaSistema(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-xs text-texto focus:border-acento focus:outline-none shadow-xs"
              />

              {/* Indicador de Força de Senha */}
              {novaSenhaSistema && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-texto-suave font-medium">Força da senha:</span>
                    <span className={`font-bold ${forca.nivel === 1 ? "text-erro" : forca.nivel === 2 ? "text-alerta" : "text-sucesso"}`}>
                      {forca.rotulo}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-borda">
                    <div
                      style={{ width: `${(forca.nivel / 3) * 100}%` }}
                      className={`h-full ${forca.nivel === 1 ? "bg-erro" : forca.nivel === 2 ? "bg-alerta" : "bg-sucesso"}`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-texto mb-1.5">
                Confirmar Nova Senha *
              </label>
              <input
                type="password"
                required
                value={confirmaSenhaSistema}
                onChange={(e) => setConfirmaSenhaSistema(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-xs text-texto focus:border-acento focus:outline-none shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isPending || novaSenhaSistema.length < 8}
              className="w-full rounded-lg bg-acento px-4 py-2.5 text-xs font-bold text-white transition hover:bg-acento-hover disabled:opacity-50 shadow-sm"
            >
              {isPending ? "Atualizando..." : "Alterar Senha do Sistema"}
            </button>
          </form>
        </div>

        {/* Formulário 2: Senha da Plataforma Externa (Cofre) */}
        <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-borda pb-3">
            <Key className="h-4 w-4 text-acento" />
            <h2 className="font-heading text-sm font-bold text-texto">
              Senha da Plataforma Externa
            </h2>
          </div>

          <p className="text-xs text-texto-suave leading-relaxed">
            Armazenada de forma cifrada. Apenas administradoras podem consultá-la, e toda consulta fica registrada abaixo.
          </p>

          <form onSubmit={handleSalvarSenhaExterna} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-texto mb-1.5">
                Atualizar Senha da Plataforma Externa *
              </label>
              <input
                type="password"
                required
                value={novaSenhaExterna}
                onChange={(e) => setNovaSenhaExterna(e.target.value)}
                placeholder="Senha de acesso ao PAD externo..."
                className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-xs text-texto focus:border-acento focus:outline-none shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isPending || !novaSenhaExterna}
              className="w-full rounded-lg bg-acento px-4 py-2.5 text-xs font-bold text-white transition hover:bg-acento-hover disabled:opacity-50 shadow-sm"
            >
              {isPending ? "Cifrando e salvando..." : "Salvar no Cofre Cifrado"}
            </button>
          </form>
        </div>
      </div>

      {/* Histórico de Quem Consultou Sua Senha (Auditoria Transparente) */}
      <div className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b border-borda pb-3">
          <History className="h-4 w-4 text-acento" />
          <h2 className="font-heading text-sm font-bold text-texto">
            Histórico de Consultas à sua Senha Externa
          </h2>
        </div>

        {historicoAcessos.length === 0 ? (
          <p className="text-xs text-texto-suave">
            Nenhuma administradora consultou sua senha externa até o momento.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda bg-fundo">
            <table className="tabela-densa">
              <thead>
                <tr>
                  <th>Data e Hora</th>
                  <th>Administradora Responsável</th>
                  <th>Endereço IP</th>
                </tr>
              </thead>
              <tbody>
                {historicoAcessos.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs tabular-nums text-texto-suave font-semibold">
                      {format(parseISO(a.data_hora), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </td>
                    <td className="text-xs font-bold text-texto">
                      {a.admin_nome || "Administradora"}
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
