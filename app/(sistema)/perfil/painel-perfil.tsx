"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { type Perfil, type CredencialAcesso } from "@/types/database";
import { salvarCredencialExternaAction } from "../usuarios/actions";
import {
  alterarMinhaSenhaAction,
  atualizarMinhaFotoAction,
  removerMinhaFotoAction,
} from "./actions";
import { AvatarUsuario } from "@/components/ui/avatar-usuario";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User,
  Lock,
  Key,
  History,
  Check,
  AlertCircle,
  ShieldCheck,
  Camera,
  Trash2,
  Loader2,
} from "lucide-react";

interface PainelPerfilProps {
  perfil: Perfil;
  historicoAcessos: (CredencialAcesso & { admin_nome?: string })[];
}

export function PainelPerfil({ perfil, historicoAcessos }: PainelPerfilProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estados de formulário
  const [senhaAtualSistema, setSenhaAtualSistema] = useState("");
  const [novaSenhaSistema, setNovaSenhaSistema] = useState("");
  const [confirmaSenhaSistema, setConfirmaSenhaSistema] = useState("");
  const [novaSenhaExterna, setNovaSenhaExterna] = useState("");

  const [fotoUrl, setFotoUrl] = useState<string | null>(perfil.avatar_url || null);
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const [msgSucesso, setMsgSucesso] = useState<string | null>(null);
  const [msgErro, setMsgErro] = useState<string | null>(null);

  const processarEComprimirImagem = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 380;
          const largura = img.width;
          const altura = img.height;

          // Corta em formato quadrado central
          const menorLado = Math.min(largura, altura);
          const sx = (largura - menorLado) / 2;
          const sy = (altura - menorLado) / 2;

          const canvas = document.createElement("canvas");
          canvas.width = Math.min(menorLado, maxDim);
          canvas.height = Math.min(menorLado, maxDim);

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, sx, sy, menorLado, menorLado, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/webp", 0.85);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Falha ao carregar a imagem."));
        img.src = e.target?.result as string;
      };
      leitor.onerror = () => reject(new Error("Falha ao ler o arquivo selecionado."));
      leitor.readAsDataURL(file);
    });
  };

  const handleSelecionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMsgErro("Por favor, selecione um arquivo de imagem válido (JPG, PNG ou WebP).");
      return;
    }

    try {
      setSalvandoFoto(true);
      setMsgErro(null);
      setMsgSucesso(null);

      const base64Comprimido = await processarEComprimirImagem(file);
      setFotoUrl(base64Comprimido);

      const res = await atualizarMinhaFotoAction(base64Comprimido);
      if (!res.sucesso) {
        setMsgErro(res.erro || "Falha ao salvar a foto de perfil.");
        setFotoUrl(perfil.avatar_url || null);
      } else {
        setMsgSucesso("Foto de perfil anexada e atualizada com sucesso!");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar imagem.";
      setMsgErro(msg);
      setFotoUrl(perfil.avatar_url || null);
    } finally {
      setSalvandoFoto(false);
      if (inputArquivoRef.current) {
        inputArquivoRef.current.value = "";
      }
    }
  };

  const handleRemoverFoto = async () => {
    try {
      setSalvandoFoto(true);
      setMsgErro(null);
      setMsgSucesso(null);

      const res = await removerMinhaFotoAction();
      if (!res.sucesso) {
        setMsgErro(res.erro || "Falha ao remover a foto.");
      } else {
        setFotoUrl(null);
        setMsgSucesso("Foto removida. O sistema agora exibe as iniciais do seu nome.");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover foto.";
      setMsgErro(msg);
    } finally {
      setSalvandoFoto(false);
    }
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

    if (novaSenhaSistema.length < 8) {
      setMsgErro("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (novaSenhaSistema !== confirmaSenhaSistema) {
      setMsgErro("A confirmação de senha não coincide com a nova senha digitada.");
      return;
    }

    startTransition(async () => {
      const res = await alterarMinhaSenhaAction(senhaAtualSistema, novaSenhaSistema);
      if (!res.sucesso) {
        setMsgErro(res.erro || "Erro ao atualizar senha.");
      } else {
        setMsgSucesso("Senha atualizada. Sessões abertas em outros dispositivos foram encerradas.");
        setSenhaAtualSistema("");
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

      {/* Cartão de Identificação & Foto de Perfil */}
      <div className="rounded-xl border border-borda bg-superficie p-6 space-y-6 shadow-xs">
        <div className="flex items-center gap-2 border-b border-borda pb-4">
          <User className="h-4.5 w-4.5 text-acento" />
          <h2 className="text-base font-semibold text-texto">Identificação e Foto de Perfil</h2>
        </div>

        {/* Bloco de Foto / Avatar e Instrução */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 rounded-xl border border-borda bg-fundo/60 p-5">
          <div className="relative group">
            <AvatarUsuario
              nome={perfil.nome_completo}
              fotoUrl={fotoUrl}
              tamanho="2xl"
              className="ring-4 ring-acento/20"
            />
            {salvandoFoto && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-xs">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-texto">Sua Foto de Perfil</h3>
              <p className="text-xs text-texto-suave mt-1 leading-relaxed">
                Você pode anexar uma foto para personalizar seu perfil no sistema. Caso não anexe
                nenhuma foto, as iniciais do seu nome e sobrenome serão exibidas automaticamente no
                cabeçalho e nos menus.
              </p>
            </div>

            {/* Input de arquivo invisível */}
            <input
              ref={inputArquivoRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleSelecionarFoto}
              className="hidden"
            />

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
              <button
                type="button"
                disabled={salvandoFoto}
                onClick={() => inputArquivoRef.current?.click()}
                className="btn-tátil inline-flex items-center gap-2 rounded-xl bg-acento px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-acento/90 transition disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                <span>{fotoUrl ? "Alterar Foto" : "Anexar Foto"}</span>
              </button>

              {fotoUrl && (
                <button
                  type="button"
                  disabled={salvandoFoto}
                  onClick={handleRemoverFoto}
                  className="btn-tátil inline-flex items-center gap-1.5 rounded-xl border border-erro/30 bg-erro/10 px-3 py-2 text-xs font-semibold text-erro hover:bg-erro/20 transition disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remover Foto</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-texto-suave">
              Formatos aceitos: JPG, PNG ou WebP. A foto é cortada e comprimida automaticamente.
            </p>
          </div>
        </div>

        {/* Dados Cadastrais */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-borda bg-fundo p-4">
            <span className="font-medium text-texto-suave block text-[11px]">Nome Completo</span>
            <span className="text-texto font-semibold text-sm block mt-1">
              {perfil.nome_completo}
            </span>
          </div>

          <div className="rounded-xl border border-borda bg-fundo p-4">
            <span className="font-medium text-texto-suave block text-[11px]">
              E-mail Institucional
            </span>
            <span className="text-texto font-mono font-medium block mt-1">{perfil.email}</span>
          </div>

          <div className="rounded-xl border border-borda bg-fundo p-4">
            <span className="font-medium text-texto-suave block text-[11px]">Papel no Sistema</span>
            <span className="text-acento font-semibold block mt-1">
              {formatarPapel(perfil.papel)}
            </span>
          </div>
        </div>
      </div>

      {/* Seção de Senhas: Apenas Administrador pode alterar diretamente */}
      {perfil.papel === "admin" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Troca de Senha do Sistema */}
          <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-borda pb-3">
              <Lock className="h-4 w-4 text-acento" />
              <h2 className="text-sm font-semibold text-texto">Alterar Senha do Sistema</h2>
            </div>

            <form onSubmit={handleTrocarSenhaSistema} className="space-y-4">
              <div>
                <label
                  htmlFor="senha-atual"
                  className="block text-xs font-medium text-texto mb-1.5"
                >
                  Senha atual
                </label>
                <input
                  id="senha-atual"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={senhaAtualSistema}
                  onChange={(e) => setSenhaAtualSistema(e.target.value)}
                  className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-xs text-texto focus:border-acento focus:outline-none"
                />
              </div>
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
              Senha do PAD/AVA, independente da senha de acesso a este sistema. Fica cifrada no
              servidor (AES-256-GCM, criptografia em repouso — não é criptografia de ponta a ponta:
              o servidor consegue decifrá-la). A administração pode revelá-la mediante
              reautenticação e justificativa, e cada consulta fica registrada.
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
      ) : (
        <div className="rounded-lg border border-borda bg-superficie p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-borda pb-3">
            <Lock className="h-4 w-4 text-acento" />
            <h2 className="text-sm font-semibold text-texto">Segurança e Credenciais de Acesso</h2>
          </div>
          <p className="text-xs text-texto-suave leading-relaxed">
            Sua senha de acesso ao sistema interno e à plataforma externa é gerenciada de forma
            centralizada e segura pela administração.
          </p>
          <div className="flex items-center gap-2.5 rounded-lg border border-acento/20 bg-acento/5 p-3.5 text-xs text-texto">
            <ShieldCheck className="h-4 w-4 text-acento shrink-0" />
            <span>
              Por diretriz corporativa, a alteração e redefinição de senhas é realizada
              exclusivamente pelo <strong>Administrador do Sistema</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Histórico de Acessos ao seu Cofre */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-borda pb-3">
          <History className="h-4 w-4 text-acento" />
          <h2 className="text-sm font-semibold text-texto">
            Auditoria de Consultas à sua Senha Externa
          </h2>
        </div>

        {historicoAcessos.length === 0 ? (
          <p className="text-xs text-texto-suave">
            Nenhum acesso de administrador foi realizado ao seu cofre.
          </p>
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
                    <td
                      suppressHydrationWarning
                      className="font-mono text-xs tabular-nums text-texto-suave"
                    >
                      {format(parseISO(a.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </td>
                    <td className="text-xs font-medium text-texto">
                      {a.admin_nome || "Administrador"}
                    </td>
                    <td className="font-mono text-xs text-texto-suave tabular-nums">
                      {a.ip || "não registrado"}
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
