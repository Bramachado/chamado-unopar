"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { salvarAvatarUsuario, removerAvatarUsuario } from "@/lib/auth/avatar";

export async function alterarMinhaSenhaAction(novaSenha: string) {
  const perfil = await obterPerfilAtual();

  if (perfil.papel !== "admin") {
    return { sucesso: false, erro: "Apenas administradores têm permissão para alterar senhas." };
  }

  if (!novaSenha || novaSenha.length < 6) {
    return { sucesso: false, erro: "A nova senha deve ter no mínimo 6 caracteres." };
  }

  try {
    const hash = await bcrypt.hash(novaSenha, 10);

    await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
      req.input("id", sql.UniqueIdentifier, perfil.id);
      req.input("hash", sql.VarChar(255), hash);

      await req.query(`
          UPDATE dados.perfis
          SET senha_hash = @hash,
              atualizado_em = SYSUTCDATETIME()
          WHERE id = @id
        `);
    });

    try {
      revalidatePath("/perfil");
    } catch {}

    return { sucesso: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro ao atualizar senha.";
    return { sucesso: false, erro: msg };
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
