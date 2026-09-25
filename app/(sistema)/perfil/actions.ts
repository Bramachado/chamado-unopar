"use server";

import bcrypt from "bcryptjs";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";

export async function alterarMinhaSenhaAction(novaSenha: string) {
  const perfil = await obterPerfilAtual();

  if (perfil.papel !== "admin") {
    return { sucesso: false, erro: "Apenas administradores têm permissão para alterar senhas." };
  }

  if (!novaSenha || novaSenha.length < 6) {
    return { sucesso: false, erro: "A nova senha deve ter no mínimo 6 caracteres." };
  }

  try {
    const hash = await bcrypt.hash(novaSenha, 12);

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

    return { sucesso: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro ao atualizar senha.";
    return { sucesso: false, erro: msg };
  }
}

import { revalidatePath } from "next/cache";
import { salvarAvatarUsuario, removerAvatarUsuario } from "@/lib/auth/avatar";

export async function atualizarMinhaFotoAction(fotoBase64: string) {
  const perfil = await obterPerfilAtual();

  if (!fotoBase64 || !fotoBase64.startsWith("data:image/")) {
    return { sucesso: false, erro: "Arquivo de imagem inválido." };
  }

  // Limite de segurança: 1.5MB de base64 (~1.1MB de imagem)
  if (fotoBase64.length > 2 * 1024 * 1024) {
    return { sucesso: false, erro: "A imagem é muito grande. Escolha uma foto menor." };
  }

  const ok = await salvarAvatarUsuario(perfil.id, fotoBase64, perfil.nome_completo);

  if (!ok) {
    return { sucesso: false, erro: "Não foi possível salvar a foto de perfil." };
  }

  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { sucesso: true };
}

export async function removerMinhaFotoAction() {
  const perfil = await obterPerfilAtual();

  const ok = await removerAvatarUsuario(perfil.id, perfil.nome_completo);

  if (!ok) {
    return { sucesso: false, erro: "Não foi possível remover a foto de perfil." };
  }

  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { sucesso: true };
}
