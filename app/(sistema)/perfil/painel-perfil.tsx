"use client";

import { useState, useTransition } from "react";
import { type Perfil, type CredencialAcesso } from "@/types/database";
import { salvarCredencialExternaAction } from "../usuarios/actions";
import { criarClienteBrowser } from "@/lib/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, Lock, Key, History, Check, AlertCircle } from "lucide-react";

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
      setMsgErro("A nova senha do sistema deve ter no mínimo 8 caracteres.");
      return;
    }

    if (novaSenhaSistema !== confirmaSenhaSistema) {
      setMsgErro("A confirmação de senha não confere.");
      return;
    }

    const supabase = criarClienteBrowser();
    const { error } = await supabase.auth.updateUser({
      password: novaSenhaSistema,
    });

    if (error) {
      setMsgErro(`Erro ao atualizar senha: ${error.message}`);
    } else {
      setNovaSenhaSistema("");
      setConfirmaSenhaSistema("");
      setMsgSucesso("Sua senha de acesso ao sistema foi alterada com sucesso.");
    }
  };

  const handleAtualizarSenhaExterna = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSucesso(null);
    setMsgErro(null);

    if (!novaSenhaExterna || novaSenhaExterna.trim().length === 0) {
      setMsgErro("Informe a nova senha da plataforma externa.");
      return;
    }

    startTransition(async () => {
      const res = await salvarCredencialExternaAction(perfil.id, novaSenhaExterna);
      if (res.sucesso) {
        setNovaSenhaExterna("");
        setMsgSucesso("Senha da plataforma externa atualizada e cifrada com sucesso no cofre.");
      } else {
        setMsgErro(res.erro || "Falha ao salvar senha no cofre.");
      }
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-texto">Meu perfil</h1>
        <p className="text-sm text-texto-suave">
          Gerenciamento de credenciais próprias e transparência de acessos administrativos.
        </p>
      </div>

      {msgSucesso && (
        <div className="flex items-center gap-2 rounded border border-sucesso/30 bg-sucesso-fundo p-3 text-xs text-sucesso">
          <Check className="h-4 w-4 shrink-0" />
          <span>{msgSucesso}</span>
        </div>
      )}

      {msgErro && (
        <div className="flex items-start gap-2 rounded border border-erro/30 bg-erro-fundo p-3 text-xs text-erro">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{msgErro}</span>
        </div>
      )}

      {/* Dados Pessoais */}
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-texto-suave border-b border-borda/40 pb-2 flex items-center gap-1.5">
          <User className="h-4 w-4" />
          <span>Informações cadastrais</span>
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
          <div>
            <span className="text-texto-suave block text-xs">Nome completo</span>
            <span className="font-medium text-texto">{perfil.nome_completo}</span>
          </div>
          <div>
            <span className="text-texto-suave block text-xs">E-mail institucional</span>
            <span className="font-mono text-texto">{perfil.email}</span>
          </div>
          <div>
            <span className="text-texto-suave block text-xs">Papel no sistema</span>
            <span className="font-medium text-texto">{formatarPapel(perfil.papel)}</span>
          </div>
        </div>
      </div>

      {/* Formulários de Senha */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Alterar Senha de Acesso ao Sistema */}
        <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-texto-suave border-b border-borda/40 pb-2 flex items-center gap-1.5">
            <Lock className="h-4 w-4" />
            <span>Alterar senha do sistema</span>
          </h2>

          <form onSubmit={handleTrocarSenhaSistema} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-texto mb-1">
                Nova senha de acesso (mínimo 8 caracteres) *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={novaSenhaSistema}
                onChange={(e) => setNovaSenhaSistema(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded border border-borda bg-fundo px-3 py-2 text-sm text-texto focus:border-acento focus:outline-none"
              />
              {novaSenhaSistema.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex h-1.5 w-24 gap-1 rounded bg-borda overflow-hidden">
                    <div
                      className={`h-full ${
                        forca.nivel >= 1 ? (forca.nivel === 1 ? "bg-erro w-1/3" : forca.nivel === 2 ? "bg-alerta w-2/3" : "bg-sucesso w-full") : ""
                      }`}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${forca.cor.split(" ")[1]}`}>
                    Força: {forca.rotulo}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-texto mb-1">
                Confirmar nova senha *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmaSenhaSistema}
                onChange={(e) => setConfirmaSenhaSistema(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full rounded border border-borda bg-fundo px-3 py-2 text-sm text-texto focus:border-acento focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded bg-acento py-2 px-3 text-xs font-medium text-white transition hover:bg-acento-hover"
            >
              Salvar nova senha do sistema
            </button>
          </form>
        </div>

        {/* Atualizar Senha da Plataforma Externa */}
        <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-texto-suave border-b border-borda/40 pb-2 flex items-center gap-1.5">
            <Key className="h-4 w-4" />
            <span>Atualizar senha da plataforma externa</span>
          </h2>

          <form onSubmit={handleAtualizarSenhaExterna} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-texto mb-1">
                Nova senha da plataforma externa *
              </label>
              <input
                type="password"
                required
                value={novaSenhaExterna}
                onChange={(e) => setNovaSenhaExterna(e.target.value)}
                placeholder="Senha usada na plataforma externa"
                className="w-full rounded border border-borda bg-fundo px-3 py-2 text-sm text-texto focus:border-acento focus:outline-none"
              />
              <span className="text-xs text-texto-suave block mt-1.5">
                Armazenada de forma cifrada. Apenas administradoras podem consultá-la, e toda consulta fica registrada abaixo.
              </span>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded border border-borda bg-fundo py-2 px-3 text-xs font-medium text-texto transition hover:bg-superficie disabled:opacity-50"
            >
              {isPending ? "Cifrando e salvando..." : "Atualizar senha no cofre"}
            </button>
          </form>
        </div>
      </div>

      {/* Histórico de Acessos à Minha Credencial */}
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-texto-suave border-b border-borda/40 pb-2 flex items-center gap-1.5">
          <History className="h-4 w-4" />
          <span>Histórico de consultas à minha credencial externa</span>
        </h2>
        <p className="text-xs text-texto-suave">
          Transparência total: sempre que uma administradora revela sua senha da plataforma externa, o registro permanente aparece aqui.
        </p>

        {historicoAcessos.length === 0 ? (
          <p className="text-xs text-texto-suave py-2">
            Sua credencial nunca foi consultada por nenhuma administradora.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-borda bg-fundo">
            <table className="tabela-densa">
              <thead>
                <tr>
                  <th>Administradora</th>
                  <th className="w-48">Data e hora</th>
                  <th className="w-36 font-mono">Endereço IP</th>
                </tr>
              </thead>
              <tbody>
                {historicoAcessos.map((h) => (
                  <tr key={h.id}>
                    <td className="text-xs font-medium text-texto">
                      {h.admin_nome || "Administradora"}
                    </td>
                    <td className="font-mono text-xs tabular-nums text-texto-suave">
                      {format(parseISO(h.data_hora), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </td>
                    <td className="font-mono text-xs tabular-nums text-texto-suave">
                      {h.ip || "127.0.0.1"}
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
