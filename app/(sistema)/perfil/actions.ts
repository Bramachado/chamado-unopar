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
