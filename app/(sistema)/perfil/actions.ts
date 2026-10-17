"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { salvarAvatarUsuario, removerAvatarUsuario } from "@/lib/auth/avatar";
import { criarSessao } from "@/lib/auth/jwt";

const CUSTO_BCRYPT = 12;

/**
 * Troca da própria senha de acesso (somente hash bcrypt; a senha de login não vai para o cofre).
 * Exige a senha atual e encerra as demais sessões (perfis.sessao_valida_desde); a sessão atual
 * é reemitida para continuar válida.
 */
export async function alterarMinhaSenhaAction(senhaAtual: string, novaSenha: string) {
  const perfil = await obterPerfilAtual();

  if (perfil.papel !== "admin") {
    return { sucesso: false, erro: "Apenas administradores têm permissão para alterar senhas." };
  }
  if (!novaSenha || novaSenha.length < 8) {
    return { sucesso: false, erro: "A nova senha deve ter no mínimo 8 caracteres." };
  }

  try {
    const atual = await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) =>
        (
          await req
            .input("id", sql.UniqueIdentifier, perfil.id)
            .query("SELECT senha_hash FROM dados.perfis WHERE id = @id")
        ).recordset[0]
    );
    if (!atual?.senha_hash || !(await bcrypt.compare(senhaAtual ?? "", atual.senha_hash))) {
      return { sucesso: false, erro: "A senha atual não confere." };
    }
    const hash = await bcrypt.hash(novaSenha, CUSTO_BCRYPT);
    await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
      await req.input("id", sql.UniqueIdentifier, perfil.id).input("hash", sql.VarChar(100), hash)
        .query(`
          UPDATE dados.perfis
          SET senha_hash = @hash, sessao_valida_desde = SYSDATETIMEOFFSET(), atualizado_em = SYSDATETIMEOFFSET()
          WHERE id = @id`);
    });
    // aguarda 1s para o novo token ter "iat" posterior ao corte de sessões
    await new Promise((r) => setTimeout(r, 1100));
    await criarSessao({
      id: perfil.id,
      email: perfil.email,
      nome_completo: perfil.nome_completo,
      papel: perfil.papel,
      polo_id: perfil.polo_id ?? null,
      polo_nome: perfil.polo_nome ?? null,
    });
    try {
      revalidatePath("/perfil");
    } catch {}
    return { sucesso: true };
  } catch (error: unknown) {
    console.error(
      "[PERFIL] Falha ao alterar senha:",
      error instanceof Error ? error.message : error
    );
    return { sucesso: false, erro: "Erro ao atualizar a senha." };
  }
}

export async function atualizarMinhaFotoAction(fotoBase64: string) {
  try {
    const perfil = await obterPerfilAtual();

    if (!fotoBase64 || !fotoBase64.startsWith("data:image/")) {
      return { sucesso: false, erro: "Arquivo de imagem inválido." };
    }

    // Limite de segurança: 2.5MB de base64 (~1.8MB de imagem)
    if (fotoBase64.length > 2.5 * 1024 * 1024) {
      return { sucesso: false, erro: "A imagem é muito grande. Escolha uma foto menor." };
    }

    const ok = await salvarAvatarUsuario(perfil.id, fotoBase64, perfil.nome_completo);

    if (!ok) {
      return {
        sucesso: false,
        erro: "Não foi possível salvar a foto de perfil no banco de dados.",
      };
    }

    try {
      revalidatePath("/perfil");
      revalidatePath("/usuarios");
      revalidatePath("/painel");
    } catch (revErr) {
      console.warn("Aviso ao revalidar rotas após atualizar foto:", revErr);
    }

    return { sucesso: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar foto de perfil.";
    return { sucesso: false, erro: msg };
  }
}

export async function removerMinhaFotoAction() {
  try {
    const perfil = await obterPerfilAtual();

    const ok = await removerAvatarUsuario(perfil.id, perfil.nome_completo);

    if (!ok) {
      return { sucesso: false, erro: "Não foi possível remover a foto de perfil." };
    }

    try {
      revalidatePath("/perfil");
      revalidatePath("/usuarios");
      revalidatePath("/painel");
    } catch (revErr) {
      console.warn("Aviso ao revalidar rotas após remover foto:", revErr);
    }

    return { sucesso: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao remover foto de perfil.";
    return { sucesso: false, erro: msg };
  }
}
