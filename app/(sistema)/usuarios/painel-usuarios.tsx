"use client";

import { useState, useEffect, useTransition } from "react";
import { type Perfil, type CredencialAcesso } from "@/types/database";
import { 
  revelarSenhaExternaAction, 
  alternarStatusUsuarioAction,
  criarOuEditarUsuarioAction 
} from "./actions";
import { 
  Eye, 
  EyeOff, 
  Key, 
  UserPlus, 
  AlertTriangle, 
  Check, 
  Clock, 
  History
} from "lucide-react";

interface UsuarioComCredencial extends Perfil {
  tem_credencial_externa?: boolean;
}

interface PainelUsuariosProps {
  usuarios: UsuarioComCredencial[];
  acessosRecentes: (CredencialAcesso & { perfil_alvo_nome?: string; admin_nome?: string })[];
  perfilAtualId: string;
}

export function PainelUsuarios({ usuarios, acessosRecentes, perfilAtualId }: PainelUsuariosProps) {
  const [isPending, startTransition] = useTransition();

  // Estados de revelação temporária (30s)
  const [senhaRevelada, setSenhaRevelada] = useState<{ perfilId: string; senha: string } | null>(null);
  const [tempoRestante, setTempoRestante] = useState<number>(0);

  // Estados do modal de criação/edição
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Perfil | null>(null);

  // Estado do modal de confirmação de desativação
  const [usuarioDesativando, setUsuarioDesativando] = useState<{ id: string; nome: string; ativo: boolean } | null>(null);

  // Mensagens de retorno
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Timer decrescente de 30 segundos
  useEffect(() => {
    if (tempoRestante > 0) {
      const timer = setTimeout(() => {
        setTempoRestante((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (tempoRestante === 0 && senhaRevelada) {
      setSenhaRevelada(null);
    }
    return undefined;
  }, [tempoRestante, senhaRevelada]);

  const handleRevelarSenha = async (perfilId: string) => {
    setMensagemErro(null);
    startTransition(async () => {
      const res = await revelarSenhaExternaAction(perfilId);
      if (res.sucesso && res.senhaPlana) {
        setSenhaRevelada({ perfilId, senha: res.senhaPlana });
        setTempoRestante(30);
      } else {
        setMensagemErro(res.erro || "Falha ao revelar credencial.");
      }
    });
  };

  const handleConfirmarAlternarStatus = async () => {
    if (!usuarioDesativando) return;
    setMensagemErro(null);
    setMensagemSucesso(null);

    const res = await alternarStatusUsuarioAction(usuarioDesativando.id, !usuarioDesativando.ativo);
    if (!res.sucesso) {
      setMensagemErro(res.erro || "Falha ao alterar status da usuária.");
    } else {
      setMensagemSucesso(
        usuarioDesativando.ativo
          ? `A conta de ${usuarioDesativando.nome} foi desativada.`
          : `A conta de ${usuarioDesativando.nome} foi reativada.`
      );
    }
    setUsuarioDesativando(null);
  };

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
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto">
            Gestão de usuárias e cofre de credenciais
          </h1>
          <p className="text-xs text-texto-suave">
            Controle de acesso, papéis no sistema e cofre de senhas da plataforma externa sob auditoria estrita.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setUsuarioEditando(null);
            setModalAberto(true);
          }}
          className="inline-flex items-center gap-1.5 rounded bg-acento px-3 py-1.5 text-xs font-medium text-white transition hover:bg-acento-hover"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Nova usuária</span>
        </button>
      </div>

      {mensagemSucesso && (
        <div className="flex items-center gap-2 rounded border border-sucesso/30 bg-sucesso-fundo p-3 text-xs text-sucesso">
          <Check className="h-4 w-4 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {mensagemErro && (
        <div className="flex items-start gap-2 rounded border border-erro/30 bg-erro-fundo p-3 text-xs text-erro">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {/* Caixa de Senha Revelada Ativa (30 segundos) */}
      {senhaRevelada && (
        <div className="rounded border border-acento/50 bg-acento/10 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-xs text-acento">
              <Key className="h-4 w-4" />
              <span>Senha da plataforma externa (visualização temporária)</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-xs font-bold text-acento tabular-nums bg-fundo px-2 py-0.5 rounded border border-acento/30">
              <Clock className="h-3.5 w-3.5" />
              <span>Expira em {tempoRestante}s</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-texto bg-fundo px-4 py-2 rounded border border-borda select-all">
              {senhaRevelada.senha}
            </span>
            <button
              type="button"
              onClick={() => {
                setSenhaRevelada(null);
                setTempoRestante(0);
              }}
              className="text-xs text-texto-suave hover:text-texto"
            >
              Ocultar agora
            </button>
          </div>
          <p className="text-[11px] text-texto-suave">
            Esta visualização foi registrada em log permanente de auditoria com seu endereço IP e data/hora.
          </p>
        </div>
      )}

      {/* Tabela de Usuárias */}
      <div className="overflow-x-auto rounded border border-borda bg-fundo shadow-sm">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th>Nome completo</th>
              <th>E-mail</th>
              <th className="w-32 text-center">Papel</th>
              <th className="w-24 text-center">Status</th>
              <th className="w-36 text-center">Cofre de senha</th>
              <th className="w-32 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const revelandoEsta = senhaRevelada?.perfilId === u.id;
              const ehPropriaConta = u.id === perfilAtualId;

              return (
                <tr key={u.id}>
                  <td className="text-xs font-medium text-texto">
                    {u.nome_completo}
                    {ehPropriaConta && (
                      <span className="ml-1.5 rounded bg-acento/10 px-1 py-0.2 text-[9px] font-bold text-acento">
                        (Você)
                      </span>
                    )}
                  </td>
                  <td className="text-xs text-texto-suave font-mono">{u.email}</td>
                  <td className="text-center">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${
                        u.papel === "admin"
                          ? "bg-acento/10 text-acento border-acento/30 font-semibold"
                          : u.papel === "coordenador"
                          ? "bg-superficie text-texto border-borda"
                          : "bg-fundo text-texto-suave border-borda"
                      }`}
                    >
                      {formatarPapel(u.papel)}
                    </span>
                  </td>
                  <td className="text-center">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${
                        u.ativo
                          ? "bg-sucesso/10 text-sucesso border-sucesso/30"
                          : "bg-superficie text-texto-suave border-borda"
                      }`}
                    >
                      {u.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="text-center">
                    <button
                      type="button"
                      disabled={isPending || revelandoEsta}
                      onClick={() => handleRevelarSenha(u.id)}
                      className="inline-flex items-center gap-1 rounded border border-borda bg-superficie px-2 py-0.5 text-[11px] font-medium text-texto hover:bg-fundo disabled:opacity-50"
                      title="Revelar senha da plataforma externa sob auditoria"
                    >
                      {revelandoEsta ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      <span>{revelandoEsta ? "Revelada" : "Revelar senha"}</span>
                    </button>
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUsuarioEditando(u);
                          setModalAberto(true);
                        }}
                        className="rounded border border-borda bg-superficie px-2 py-0.5 text-[11px] font-medium text-texto hover:bg-fundo"
                      >
                        Editar
                      </button>

                      {/* Botão de desativação neutro em repouso; desabilitado na própria conta */}
                      {!ehPropriaConta && (
                        <button
                          type="button"
                          onClick={() => setUsuarioDesativando({ id: u.id, nome: u.nome_completo, ativo: u.ativo })}
                          className="rounded border border-borda bg-superficie px-2 py-0.5 text-[11px] font-medium text-texto-suave hover:text-texto hover:bg-fundo"
                          title={u.ativo ? "Desativar conta desta usuária" : "Reativar conta desta usuária"}
                        >
                          {u.ativo ? "Desativar" : "Ativar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Histórico Geral de Consultas ao Cofre */}
      <div className="rounded border border-borda bg-superficie p-5 space-y-3 shadow-sm">
        <h2 className="text-sm font-semibold text-texto border-b border-borda/40 pb-2 flex items-center gap-1.5">
          <History className="h-4 w-4 text-acento" />
          <span>Últimos acessos e revelações de senha registrados no cofre</span>
        </h2>

        {acessosRecentes.length === 0 ? (
          <p className="text-xs text-texto-suave">Nenhuma revelação de senha registrada até o momento.</p>
        ) : (
          <div className="divide-y divide-borda/40 rounded border border-borda bg-fundo">
            {acessosRecentes.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2.5 text-xs">
                <div>
                  <span className="font-semibold text-texto">{a.admin_nome || "Administradora"}</span>
                  <span className="text-texto-suave"> consultou a senha de </span>
                  <span className="font-semibold text-acento">{a.perfil_alvo_nome || "Usuária"}</span>
                  <span className="text-[11px] text-texto-suave font-mono ml-2">(IP: {a.ip || "N/A"})</span>
                </div>
                <span className="font-mono text-[11px] text-texto-suave tabular-nums">
                  {new Date(a.data_hora).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Desativação / Reativação */}
      {usuarioDesativando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded border border-borda bg-fundo p-5 shadow-lg space-y-3">
            <h3 className="font-heading text-sm font-bold text-texto">
              {usuarioDesativando.ativo ? "Confirmar desativação de conta" : "Confirmar reativação de conta"}
            </h3>
            <p className="text-xs text-texto-suave">
              {usuarioDesativando.ativo
                ? `A usuária ${usuarioDesativando.nome} não poderá mais fazer login no sistema. Deseja prosseguir?`
                : `A usuária ${usuarioDesativando.nome} voltará a ter acesso ao sistema. Deseja prosseguir?`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-borda/40">
              <button
                type="button"
                onClick={() => setUsuarioDesativando(null)}
                className="rounded border border-borda bg-superficie px-3 py-1.5 text-xs font-medium text-texto hover:bg-fundo"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarAlternarStatus}
                className={`rounded px-3 py-1.5 text-xs font-medium text-white ${
                  usuarioDesativando.ativo ? "bg-erro hover:bg-erro/90" : "bg-sucesso hover:bg-sucesso/90"
                }`}
              >
                {usuarioDesativando.ativo ? "Desativar usuária" : "Reativar usuária"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Usuária */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded border border-borda bg-fundo p-6 shadow-lg space-y-4">
            <h2 className="font-heading text-sm font-bold text-texto">
              {usuarioEditando ? "Editar usuária" : "Cadastrar nova usuária"}
            </h2>

            <form
              action={async (formData) => {
                setMensagemErro(null);
                const res = await criarOuEditarUsuarioAction({}, formData);
                if (res.erro) {
                  setMensagemErro(res.erro);
                } else {
                  setModalAberto(false);
                  setMensagemSucesso("Usuária salva com sucesso.");
                }
              }}
              className="space-y-3"
            >
              {usuarioEditando && (
                <input type="hidden" name="id" value={usuarioEditando.id} />
              )}

              <div>
                <label className="block text-xs font-medium text-texto mb-1">
                  Nome completo *
                </label>
                <input
                  type="text"
                  name="nome_completo"
                  required
                  defaultValue={usuarioEditando?.nome_completo || ""}
                  placeholder="Nome da colaboradora"
                  className="w-full rounded border border-borda bg-superficie px-3 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-texto mb-1">
                  E-mail institucional *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  defaultValue={usuarioEditando?.email || ""}
                  placeholder="usuario@unopar.br"
                  className="w-full rounded border border-borda bg-superficie px-3 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-texto mb-1">
                  Papel no sistema *
                </label>
                <select
                  name="papel"
                  defaultValue={usuarioEditando?.papel || "atendente"}
                  className="w-full rounded border border-borda bg-superficie px-3 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
                >
                  <option value="atendente">Atendente</option>
                  <option value="coordenador">Coordenadora</option>
                  <option value="admin">Administradora</option>
                </select>
              </div>

              {!usuarioEditando && (
                <div>
                  <label className="block text-xs font-medium text-texto mb-1">
                    Senha de acesso inicial (mínimo 8 caracteres) *
                  </label>
                  <input
                    type="password"
                    name="senha_inicial"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded border border-borda bg-superficie px-3 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-texto mb-1">
                  Senha da plataforma externa (cofre cifrado)
                </label>
                <input
                  type="password"
                  name="senha_externa"
                  placeholder="Senha usada na plataforma externa"
                  className="w-full rounded border border-borda bg-superficie px-3 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
                />
                <span className="text-[11px] text-texto-suave block mt-0.5">
                  Será cifrada no servidor com algoritmo AES-256-GCM.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-borda/40">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded border border-borda bg-superficie px-3 py-1.5 text-xs font-medium text-texto hover:bg-fundo"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded bg-acento px-4 py-1.5 text-xs font-medium text-white hover:bg-acento-hover"
                >
                  Salvar usuária
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
