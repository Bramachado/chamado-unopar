"use client";

import { useState, useEffect, useTransition } from "react";
import { type Perfil, type CredencialAcesso } from "@/types/database";
import {
  revelarSenhaExternaAction,
  alternarStatusUsuarioAction,
  criarOuEditarUsuarioAction,
} from "./actions";
import {
  Eye,
  EyeOff,
  Key,
  UserPlus,
  AlertTriangle,
  Check,
  Clock,
  History,
  Shield,
} from "lucide-react";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";

interface UsuarioComCredencial extends Perfil {
  tem_credencial_externa?: boolean;
}

interface PainelUsuariosProps {
  usuarios: UsuarioComCredencial[];
  acessosRecentes: (CredencialAcesso & { perfil_alvo_nome?: string; admin_nome?: string })[];
  perfilAtualId: string;
}

export function PainelUsuarios({ usuarios, acessosRecentes, perfilAtualId }: PainelUsuariosProps) {
  const [isPending] = useTransition();

  // Estados de revelação temporária (30s)
  const [senhaRevelada, setSenhaRevelada] = useState<{ perfilId: string; senha: string } | null>(
    null
  );
  const [tempoRestante, setTempoRestante] = useState<number>(0);

  // Estados do modal de criação/edição
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Perfil | null>(null);

  // Estado do modal de confirmação de desativação
  const [usuarioDesativando, setUsuarioDesativando] = useState<{
    id: string;
    nome: string;
    ativo: boolean;
  } | null>(null);

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
    const res = await revelarSenhaExternaAction(perfilId);
    if (!res.sucesso) {
      setMensagemErro(res.erro || "Falha ao obter senha do cofre.");
    } else {
      setSenhaRevelada({ perfilId, senha: res.senhaPlana });
      setTempoRestante(30);
    }
  };

  const handleConfirmarAlternarStatus = async () => {
    if (!usuarioDesativando) return;
    setMensagemErro(null);
    setMensagemSucesso(null);

    const res = await alternarStatusUsuarioAction(usuarioDesativando.id, !usuarioDesativando.ativo);
    if (!res.sucesso) {
      setMensagemErro(res.erro || "Falha ao alterar status da conta.");
    } else {
      setMensagemSucesso(
        usuarioDesativando.ativo
          ? `A conta de ${usuarioDesativando.nome} foi desativada com sucesso.`
          : `A conta de ${usuarioDesativando.nome} foi reativada com sucesso.`
      );
    }
    setUsuarioDesativando(null);
  };

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

  return (
    <div className="space-y-8">
      {/* 1. Cabeçalho Padronizado da Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Gestão de Equipe e Credenciais
          </h1>
          <p className="text-sm text-texto-suave mt-0.5">
            Controle de acesso, papéis no sistema e cofre de senhas da plataforma externa sob
            auditoria.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setUsuarioEditando(null);
            setModalAberto(true);
          }}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover transition"
        >
          <UserPlus className="h-4 w-4" />
          <span>Novo Membro</span>
        </button>
      </div>

      {mensagemSucesso && (
        <div className="flex items-center gap-2 rounded-lg border border-sucesso/40 bg-sucesso-fundo/40 p-4 text-xs font-medium text-sucesso">
          <Check className="h-4 w-4 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {mensagemErro && (
        <div className="flex items-start gap-2 rounded-lg border border-erro/40 bg-erro-fundo p-4 text-xs font-medium text-erro">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {/* Notificação de Senha Revelada com Barra de Tempo Linear */}
      {senhaRevelada && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-5 space-y-3 shadow-xs dark:bg-sky-950/30 dark:border-sky-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-xs text-sky-800 dark:text-sky-300">
              <Key className="h-4 w-4" />
              <span>Senha da Plataforma Externa (Visualização Temporária)</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-sky-800 tabular-nums bg-white dark:bg-slate-900 px-3 py-1 rounded-md border border-sky-200 dark:border-sky-800 dark:text-sky-300">
              <Clock className="h-3.5 w-3.5 text-sky-600" />
              <span>Expira em {tempoRestante}s</span>
            </div>
          </div>

          {/* Barra de Progresso do Timer */}
          <div className="w-full bg-sky-200 dark:bg-sky-900 h-1 rounded-full overflow-hidden">
            <div
              className="bg-sky-600 h-full transition-all duration-1000 ease-linear"
              style={{ width: `${(tempoRestante / 30) * 100}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="font-mono text-base font-bold text-texto bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border border-borda select-all">
              {senhaRevelada.senha}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(senhaRevelada.senha);
              }}
              className="btn-tátil h-9 px-3.5 rounded-lg border border-borda bg-white dark:bg-slate-900 text-xs font-semibold text-texto hover:bg-fundo transition flex items-center gap-1.5 shadow-xs"
            >
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span>Copiar senha</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSenhaRevelada(null);
                setTempoRestante(0);
              }}
              className="btn-tátil text-xs font-semibold text-texto-suave hover:text-texto underline ml-auto"
            >
              Ocultar agora
            </button>
          </div>
          <p className="text-[11px] text-texto-suave">
            Esta visualização foi registrada no histórico de auditoria com seu endereço IP e
            data/hora.
          </p>
        </div>
      )}

      {/* 2. Tabela de Equipe */}
      <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th>Nome Completo</th>
              <th>E-mail</th>
              <th className="w-36 text-center">Papel</th>
              <th className="w-28 text-center">Status</th>
              <th className="w-40 text-center">Cofre de Senha</th>
              <th className="w-36 text-right">Ações</th>
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
                      <span className="ml-2 rounded bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.2 text-[10px] font-bold dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">
                        (Você)
                      </span>
                    )}
                  </td>
                  <td className="text-xs text-texto-suave font-mono">{u.email}</td>
                  <td className="text-center">
                    <span
                      className={`inline-flex items-center justify-center h-6 px-2.5 rounded-full text-[11px] font-semibold border ${
                        u.papel === "admin"
                          ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                          : u.papel === "coordenador"
                            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                            : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {formatarPapel(u.papel)}
                    </span>
                  </td>
                  <td className="text-center">
                    <span
                      className={`inline-flex items-center justify-center h-6 px-2.5 rounded-full text-[11px] font-semibold border ${
                        u.ativo
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                      }`}
                    >
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="text-center">
                    {u.tem_credencial_externa ? (
                      <button
                        type="button"
                        onClick={() => handleRevelarSenha(u.id)}
                        className={`btn-tátil inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition ${
                          revelandoEsta
                            ? "bg-[#1D4ED8] text-white shadow-xs"
                            : "border border-borda bg-fundo text-texto hover:bg-superficie"
                        }`}
                        title="Revelar senha do cofre (auditado)"
                      >
                        {revelandoEsta ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        <span>{revelandoEsta ? "Revelada" : "Ver senha"}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-texto-suave italic">Sem credencial</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUsuarioEditando(u);
                          setModalAberto(true);
                        }}
                        className="h-7 px-2.5 rounded border border-borda bg-fundo text-[11px] font-medium text-texto hover:bg-superficie"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (ehPropriaConta) {
                            setMensagemErro(
                              "Você não pode desativar sua própria conta de administrador."
                            );
                            return;
                          }
                          setUsuarioDesativando({
                            id: u.id,
                            nome: u.nome_completo,
                            ativo: u.ativo,
                          });
                        }}
                        className="h-7 px-2.5 rounded border border-borda bg-fundo text-[11px] font-medium text-texto-suave hover:text-texto hover:bg-superficie"
                      >
                        {u.ativo ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. Histórico Recente de Acesso ao Cofre (Auditoria) */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-borda pb-3">
          <History className="h-4 w-4 text-acento" />
          <h2 className="text-sm font-semibold text-texto">
            Auditoria de Acessos ao Cofre de Senhas
          </h2>
        </div>

        {acessosRecentes.length === 0 ? (
          <p className="text-xs text-texto-suave">
            Nenhum acesso ao cofre registrado nas últimas semanas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
            <table className="tabela-densa">
              <thead>
                <tr>
                  <th>Data e Hora</th>
                  <th>Responsável pelo Acesso</th>
                  <th>Conta Consultada</th>
                  <th>Endereço IP</th>
                </tr>
              </thead>
              <tbody>
                {acessosRecentes.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs tabular-nums text-texto-suave">
                      {new Date(a.data_hora).toLocaleString("pt-BR")}
                    </td>
                    <td className="text-xs font-medium text-texto">
                      {a.admin_nome || "Administrador"}
                    </td>
                    <td className="text-xs text-acento font-medium">{a.perfil_alvo_nome || "—"}</td>
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

      {/* Modal de Criação / Edição de Usuário */}
      {modalAberto && (
        <ModalFormularioUsuario
          usuario={usuarioEditando}
          aoFechar={() => setModalAberto(false)}
          aoSalvar={() => {
            setModalAberto(false);
            setMensagemSucesso("Cadastro atualizado com sucesso.");
          }}
        />
      )}

      {/* Modal de Confirmação de Desativação */}
      {usuarioDesativando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-borda bg-superficie p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-borda pb-3">
              <Shield className="h-5 w-5 text-alerta" />
              <h3 className="text-sm font-semibold text-texto">
                {usuarioDesativando.ativo ? "Confirmar Desativação" : "Confirmar Reativação"}
              </h3>
            </div>

            <p className="text-xs text-texto leading-relaxed">
              Deseja realmente {usuarioDesativando.ativo ? "desativar" : "reativar"} o acesso de{" "}
              <strong>{usuarioDesativando.nome}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-borda">
              <button
                type="button"
                onClick={() => setUsuarioDesativando(null)}
                className="h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarAlternarStatus}
                disabled={isPending}
                className="h-9 px-5 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover disabled:opacity-50"
              >
                {isPending ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const opcoesPapel: CustomSelectOption[] = [
  {
    value: "atendente",
    label: "Atendente",
    sublabel: "Acesso operacional a chamados e desempenho",
  },
  { value: "coordenador", label: "Coordenador", sublabel: "Acompanhamento geral e relatórios" },
  { value: "admin", label: "Administrador", sublabel: "Acesso total, cofre e auditoria" },
];

function ModalFormularioUsuario({
  usuario,
  aoFechar,
  aoSalvar,
}: {
  usuario: Perfil | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [nome, setNome] = useState(usuario?.nome_completo || "");
  const [email, setEmail] = useState(usuario?.email || "");
  const [papel, setPapel] = useState(usuario?.papel || "atendente");
  const [senhaSistema, setSenhaSistema] = useState("");
  const [senhaExterna, setSenhaExterna] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const formData = new FormData();
    if (usuario?.id) formData.set("id", usuario.id);
    formData.set("nome_completo", nome);
    formData.set("email", email);
    formData.set("papel", papel);
    if (senhaSistema) formData.set("senha_sistema", senhaSistema);
    if (senhaExterna) formData.set("senha_externa", senhaExterna);

    startTransition(async () => {
      const res = await criarOuEditarUsuarioAction({}, formData);
      if (res.erro) {
        setErro(res.erro);
      } else {
        aoSalvar();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-borda bg-superficie p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between border-b border-borda pb-3">
          <h3 className="text-sm font-semibold text-texto">
            {usuario ? `Editar Membro: ${usuario.nome_completo}` : "Cadastrar Novo Membro"}
          </h3>
          <button
            type="button"
            onClick={aoFechar}
            className="text-texto-suave hover:text-texto font-semibold"
          >
            ✕
          </button>
        </div>

        {erro && (
          <div className="rounded-lg border border-erro/40 bg-erro-fundo p-3.5 text-xs font-medium text-erro">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-texto mb-1.5">Nome Completo *</label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Ana Silva"
              className="w-full rounded-lg border border-borda bg-fundo px-3.5 py-2 text-xs font-medium text-texto focus:border-acento focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-texto mb-1.5">
              E-mail Institucional *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana.silva@unopar.br"
              className="w-full rounded-lg border border-borda bg-fundo px-3.5 py-2 text-xs font-medium text-texto focus:border-acento focus:outline-none"
            />
          </div>

          {/* CustomSelect para Papel no Sistema */}
          <CustomSelect
            label="Papel no Sistema *"
            options={opcoesPapel}
            value={papel}
            onChange={(val) => setPapel(val as "admin" | "coordenador" | "atendente")}
          />

          <div>
            <label className="block text-xs font-medium text-texto mb-1.5">
              {usuario
                ? "Nova Senha do Sistema (Opcional)"
                : "Senha de Acesso ao Sistema (mínimo 8 caracteres) *"}
            </label>
            <input
              type="password"
              required={!usuario}
              value={senhaSistema}
              onChange={(e) => setSenhaSistema(e.target.value)}
              placeholder="••••••••"
              minLength={8}
              className="w-full rounded-lg border border-borda bg-fundo px-3.5 py-2 text-xs text-texto focus:border-acento focus:outline-none"
            />
          </div>

          <div className="border-t border-borda pt-3">
            <label className="block text-xs font-medium text-texto mb-1.5 flex items-center gap-1.5">
              <Key className="h-4 w-4 text-acento" />
              <span>Senha da Plataforma Externa (Cofre Cifrado)</span>
            </label>
            <input
              type="password"
              value={senhaExterna}
              onChange={(e) => setSenhaExterna(e.target.value)}
              placeholder="Senha de acesso ao PAD externo..."
              className="w-full rounded-lg border border-borda bg-fundo px-3.5 py-2 text-xs text-texto focus:border-acento focus:outline-none"
            />
            <p className="text-xs text-texto-suave mt-1">
              Armazenada de forma cifrada com AES-256-GCM.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-borda">
            <button
              type="button"
              onClick={aoFechar}
              className="h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-9 px-5 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover disabled:opacity-50"
            >
              {isPending ? "Salvando..." : "Salvar Dados"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
