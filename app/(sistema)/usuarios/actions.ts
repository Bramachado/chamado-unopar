"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { cifrarSenha, decifrarSenha } from "@/lib/crypto/cofre";

export async function revelarSenhaExternaAction(
  perfilIdAlvo: string
): Promise<{ sucesso: true; senhaPlana: string } | { sucesso: false; erro: string }> {
  const perfil = await obterPerfilAtual();
  if (perfil.papel !== "admin") {
    return { sucesso: false, erro: "Apenas administradores podem visualizar senhas da plataforma externa." };
  }

  // 1. Obter IP e User Agent
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "127.0.0.1";
  const userAgent = headerList.get("user-agent") || "Desconhecido";

  try {
    return await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        const res = await req
          .input("perfil_alvo", sql.UniqueIdentifier, perfilIdAlvo)
          .input("ip", sql.VarChar(45), ip.slice(0, 45))
          .input("user_agent", sql.NVarChar(400), userAgent.slice(0, 400))
          .execute("dados.revelar_credencial");

        const cred = res.recordset[0];
        if (!cred) {
          return { sucesso: false, erro: "Nenhuma credencial externa cadastrada para este usuário." };
        }

        const senhaPlana = decifrarSenha(
          Buffer.from(cred.senha_cifrada),
          Buffer.from(cred.iv),
          Buffer.from(cred.auth_tag)
        );

        return { sucesso: true, senhaPlana };
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao decifrar credencial.";
    return { sucesso: false, erro: msg };
  }
}

export async function alternarStatusUsuarioAction(idAlvo: string, novoAtivo: boolean) {
  const perfil = await obterPerfilAtual();
  if (perfil.papel !== "admin") {
    return { sucesso: false, erro: "Apenas administradores podem alterar o status de usuários." };
  }

  if (perfil.id === idAlvo && !novoAtivo) {
    return { sucesso: false, erro: "Você não pode desativar sua própria conta de administrador." };
  }

  try {
    await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        req.input("id", sql.UniqueIdentifier, idAlvo);
        req.input("ativo", sql.Bit, novoAtivo ? 1 : 0);
        await req.query(`
          UPDATE dados.perfis
          SET ativo = @ativo, atualizado_em = SYSUTCDATETIME()
          WHERE id = @id
        `);
      }
    );

    revalidatePath("/usuarios");
    return { sucesso: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro ao atualizar usuário.";
    return { sucesso: false, erro: msg };
  }
}

export async function salvarCredencialExternaAction(perfilIdAlvo: string, senhaPlana: string) {
  const perfil = await obterPerfilAtual();
  const ehAdmin = perfil.papel === "admin";
  const ehPropria = perfil.id === perfilIdAlvo;

  if (!ehAdmin && !ehPropria) {
    return { sucesso: false, erro: "Permissão negada para atualizar esta credencial." };
  }

  const { senhaCifrada, iv, authTag } = cifrarSenha(senhaPlana);

  try {
    await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        req.input("perfilId", sql.UniqueIdentifier, perfilIdAlvo);
        req.input("senhaCifrada", sql.VarBinary(sql.MAX), senhaCifrada);
        req.input("iv", sql.VarBinary(12), iv);
        req.input("authTag", sql.VarBinary(16), authTag);
        req.input("atualizadoPor", sql.UniqueIdentifier, perfil.id);

        await req.query(`
          MERGE dados.credenciais_externas AS target
          USING (SELECT @perfilId AS perfil_id) AS source
          ON target.perfil_id = source.perfil_id
          WHEN MATCHED THEN
            UPDATE SET 
              senha_cifrada = @senhaCifrada,
              iv = @iv,
              auth_tag = @authTag,
              atualizado_em = SYSUTCDATETIME(),
              atualizado_por = @atualizadoPor
          WHEN NOT MATCHED THEN
            INSERT (perfil_id, senha_cifrada, iv, auth_tag, atualizado_em, atualizado_por)
            VALUES (@perfilId, @senhaCifrada, @iv, @authTag, SYSUTCDATETIME(), @atualizadoPor);
        `);
      }
    );

    revalidatePath("/usuarios");
    revalidatePath("/perfil");
    return { sucesso: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Falha ao salvar credencial no cofre.";
    return { sucesso: false, erro: msg };
  }
}

export async function criarOuEditarUsuarioAction(_prevState: unknown, formData: FormData) {
  const perfil = await obterPerfilAtual();
  if (perfil.papel !== "admin") {
    return { erro: "Apenas administradores podem cadastrar ou editar usuários." };
  }

  const id = formData.get("id") as string | null;
  const nomeCompleto = formData.get("nome_completo") as string;
  const email = formData.get("email") as string;
  const papel = formData.get("papel") as "admin" | "coordenador" | "atendente";
  const senhaInicial = formData.get("senha_inicial") as string | null;
  const senhaExterna = formData.get("senha_externa") as string | null;

  if (!nomeCompleto || !email || !papel) {
    return { erro: "Todos os campos obrigatórios devem ser preenchidos." };
  }

  try {
    if (id) {
      // Edição de usuário existente
      await comUsuario(
        { usuario_id: perfil.id, papel: perfil.papel },
        async (req) => {
          req.input("id", sql.UniqueIdentifier, id);
          req.input("nome", sql.VarChar(255), nomeCompleto.trim());
          req.input("email", sql.VarChar(255), email.toLowerCase().trim());
          req.input("papel", sql.VarChar(50), papel);

          await req.query(`
            UPDATE dados.perfis
            SET nome_completo = @nome,
                email = @email,
                papel = @papel,
                atualizado_em = SYSUTCDATETIME()
            WHERE id = @id
          `);
        }
      );

      if (senhaExterna && senhaExterna.trim().length > 0) {
        await salvarCredencialExternaAction(id, senhaExterna.trim());
      }
    } else {
      // Criação de novo usuário
      if (!senhaInicial || senhaInicial.length < 6) {
        return { erro: "A senha inicial deve conter no mínimo 6 caracteres." };
      }

      const hash = await bcrypt.hash(senhaInicial, 12);

      const novoId = await comUsuario(
        { usuario_id: perfil.id, papel: perfil.papel },
        async (req) => {
          req.input("nome", sql.VarChar(255), nomeCompleto.trim());
          req.input("email", sql.VarChar(255), email.toLowerCase().trim());
          req.input("papel", sql.VarChar(50), papel);
          req.input("senhaHash", sql.VarChar(255), hash);

          const q = await req.query(`
            INSERT INTO dados.perfis (
              nome_completo,
              email,
              papel,
              ativo,
              senha_hash
            )
            OUTPUT CAST(inserted.id AS NVARCHAR(50)) AS id
            VALUES (
              @nome,
              @email,
              @papel,
              1,
              @senhaHash
            )
          `);

          return q.recordset[0]?.id;
        }
      );

      if (senhaExterna && senhaExterna.trim().length > 0 && novoId) {
        await salvarCredencialExternaAction(novoId, senhaExterna.trim());
      }
    }

    revalidatePath("/usuarios");
    return { sucesso: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro ao processar usuário.";
    return { erro: msg };
  }
}
