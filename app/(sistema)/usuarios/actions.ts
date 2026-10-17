"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { cifrarSenha, decifrarSenha } from "@/lib/crypto/cofre";
import { ipDoCliente } from "@/lib/auth/ip";
import { registrarFalha, registrarSucesso, segundosDeBloqueio } from "@/lib/auth/limite-tentativas";
import { ErroNegocio, reatribuirPendencias } from "@/lib/chamados/repositorio";

const CUSTO_BCRYPT = 12;
const SENHA_MINIMA = 8;

/**
 * Revela a credencial EXTERNA (PAD/AVA) de um perfil.
 * Exige: papel admin, reautenticação com a própria senha e justificativa (≥ 10 caracteres).
 * O acesso é registrado (quem, quando, qual conta, IP do proxy confiável, navegador e
 * justificativa) pela procedure dados.revelar_credencial ANTES de devolver o conteúdo.
 */
export async function revelarSenhaExternaAction(
  perfilIdAlvo: string,
  confirmacao: { senhaAtual: string; justificativa: string }
): Promise<{ sucesso: true; senhaPlana: string } | { sucesso: false; erro: string }> {
  try {
    const perfil = await obterPerfilAtual();
    if (perfil.papel !== "admin") {
      return {
        sucesso: false,
        erro: "Apenas administradores podem visualizar credenciais externas.",
      };
    }
    if (!z.string().uuid().safeParse(perfilIdAlvo).success) {
      return { sucesso: false, erro: "Usuário inválido." };
    }
    const justificativa = (confirmacao?.justificativa ?? "").trim();
    if (justificativa.length < 10) {
      return { sucesso: false, erro: "Informe a justificativa (mínimo de 10 caracteres)." };
    }

    const chaves = [`reauth:${perfil.id}`];
    const bloqueio = segundosDeBloqueio(chaves);
    if (bloqueio > 0) {
      return {
        sucesso: false,
        erro: `Muitas tentativas. Aguarde ${Math.ceil(bloqueio / 60)} minuto(s).`,
      };
    }
    const hash = await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) =>
        (
          await req
            .input("id", sql.UniqueIdentifier, perfil.id)
            .query("SELECT senha_hash FROM dados.perfis WHERE id = @id")
        ).recordset[0]?.senha_hash as string | undefined
    );
    if (!hash || !(await bcrypt.compare(confirmacao?.senhaAtual ?? "", hash))) {
      registrarFalha(chaves);
      return { sucesso: false, erro: "Senha de confirmação incorreta." };
    }
    registrarSucesso(chaves);

    const cabecalhos = await headers();
    const ip = ipDoCliente(cabecalhos);
    const userAgent = (cabecalhos.get("user-agent") || "").slice(0, 400) || null;

    const cred = await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel, ip },
      async (req) => {
        const res = await req
          .input("perfil_alvo", sql.UniqueIdentifier, perfilIdAlvo)
          .input("ip", sql.VarChar(45), ip)
          .input("user_agent", sql.NVarChar(400), userAgent)
          .input("justificativa", sql.NVarChar(500), justificativa.slice(0, 500))
          .execute("dados.revelar_credencial");
        return res.recordset[0];
      }
    );
    if (!cred) {
      return { sucesso: false, erro: "Nenhuma credencial externa cadastrada para este usuário." };
    }
    const senhaPlana = decifrarSenha(
      Buffer.from(cred.senha_cifrada),
      Buffer.from(cred.iv),
      Buffer.from(cred.auth_tag)
    );
    return { sucesso: true, senhaPlana };
  } catch (err: unknown) {
    // Nunca registrar o conteúdo decifrado ou a chave; só a mensagem do erro.
    console.error(
      "[COFRE] Falha ao revelar credencial:",
      err instanceof Error ? err.message : "erro"
    );
    return { sucesso: false, erro: "Não foi possível revelar a credencial." };
  }
}

/** Ativa/desativa a conta. Desativar encerra as sessões abertas imediatamente. */
export async function alternarStatusUsuarioAction(idAlvo: string, novoAtivo: boolean) {
  try {
    const perfil = await obterPerfilAtual();
    if (perfil.papel !== "admin") {
      return { sucesso: false, erro: "Apenas administradores podem alterar o status de usuários." };
    }
    if (perfil.id === idAlvo && !novoAtivo) {
      return {
        sucesso: false,
        erro: "Você não pode desativar sua própria conta de administrador.",
      };
    }
    const pendencias = await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        req.input("id", sql.UniqueIdentifier, idAlvo).input("ativo", sql.Bit, novoAtivo ? 1 : 0);
        const r = await req.query(`
        UPDATE dados.perfis
        SET ativo = @ativo, atualizado_em = SYSDATETIMEOFFSET(),
            sessao_valida_desde = CASE WHEN @ativo = 0 THEN SYSDATETIMEOFFSET() ELSE sessao_valida_desde END
        WHERE id = @id;
        SELECT COUNT(*) AS n FROM dados.chamados
        WHERE excluido_em IS NULL AND COALESCE(responsavel_id, criado_por) = @id
          AND situacao IN ('rascunho','aguardando','em_atendimento','aguardando_aluno','aguardando_externo');`);
        return Number(r.recordset[0]?.n ?? 0);
      }
    );
    try {
      revalidatePath("/usuarios");
    } catch {}
    return { sucesso: true, pendencias };
  } catch (error: unknown) {
    console.error(
      "[USUARIOS] Falha ao alterar status:",
      error instanceof Error ? error.message : error
    );
    return { sucesso: false, erro: "Erro ao atualizar usuário." };
  }
}

/**
 * Grava a credencial EXTERNA (PAD/AVA) no cofre — admin para qualquer pessoa ou a própria pessoa.
 * Não tem relação com a senha de acesso a este sistema.
 */
export async function salvarCredencialExternaAction(perfilIdAlvo: string, senhaPlana: string) {
  try {
    const perfil = await obterPerfilAtual();
    if (perfil.papel !== "admin" && perfil.id !== perfilIdAlvo) {
      return { sucesso: false, erro: "Permissão negada para atualizar esta credencial." };
    }
    if (!senhaPlana || !senhaPlana.trim() || senhaPlana.length > 200) {
      return { sucesso: false, erro: "Informe a senha da plataforma externa." };
    }
    const { senhaCifrada, iv, authTag } = cifrarSenha(senhaPlana);
    await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
      req
        .input("perfilId", sql.UniqueIdentifier, perfilIdAlvo)
        .input("senhaCifrada", sql.VarBinary(sql.MAX), senhaCifrada)
        .input("iv", sql.VarBinary(16), iv)
        .input("authTag", sql.VarBinary(16), authTag)
        .input("atualizadoPor", sql.UniqueIdentifier, perfil.id);
      await req.query(`
        MERGE dados.credenciais_externas AS alvo
        USING (SELECT @perfilId AS perfil_id) AS origem ON alvo.perfil_id = origem.perfil_id
        WHEN MATCHED THEN UPDATE SET senha_cifrada = @senhaCifrada, iv = @iv, auth_tag = @authTag,
          atualizado_em = SYSDATETIMEOFFSET(), atualizado_por = @atualizadoPor
        WHEN NOT MATCHED THEN INSERT (perfil_id, senha_cifrada, iv, auth_tag, atualizado_em, atualizado_por)
          VALUES (@perfilId, @senhaCifrada, @iv, @authTag, SYSDATETIMEOFFSET(), @atualizadoPor);`);
    });
    try {
      revalidatePath("/usuarios");
      revalidatePath("/perfil");
    } catch {}
    return { sucesso: true };
  } catch (err: unknown) {
    console.error(
      "[COFRE] Falha ao salvar credencial:",
      err instanceof Error ? err.message : "erro"
    );
    return { sucesso: false, erro: "Falha ao salvar credencial no cofre." };
  }
}

const usuarioSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  nome_completo: z.string().trim().min(3, "Informe o nome completo.").max(200),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(200),
  papel: z.enum(["admin", "coordenador", "atendente"]),
  polo_id: z.string().uuid().nullable(),
  senha: z
    .string()
    .min(SENHA_MINIMA, `A senha deve ter no mínimo ${SENHA_MINIMA} caracteres.`)
    .max(200)
    .optional(),
});

/**
 * Cria/edita usuário. A senha de acesso é guardada apenas como hash bcrypt (sem recuperação);
 * ela NÃO é mais copiada para o cofre. Redefinir a senha encerra as sessões abertas.
 */
export async function criarOuEditarUsuarioAction(_prevState: unknown, formData: FormData) {
  try {
    const perfil = await obterPerfilAtual();
    if (perfil.papel !== "admin") {
      return { erro: "Apenas administradores podem cadastrar ou editar usuários." };
    }
    const texto = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" && v.trim() !== "" ? v : undefined;
    };
    const parse = usuarioSchema.safeParse({
      id: texto("id") ?? null,
      nome_completo: texto("nome_completo") ?? "",
      email: texto("email") ?? "",
      papel: texto("papel"),
      polo_id: texto("polo_id") && texto("polo_id") !== "nenhum" ? texto("polo_id") : null,
      senha: texto("senha"),
    });
    if (!parse.success) return { erro: parse.error.issues[0]?.message ?? "Dados inválidos." };
    const u = parse.data;
    if (!u.id && !u.senha)
      return { erro: `A senha inicial deve ter no mínimo ${SENHA_MINIMA} caracteres.` };
    const hash = u.senha ? await bcrypt.hash(u.senha, CUSTO_BCRYPT) : null;

    await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
      req
        .input("nome", sql.NVarChar(200), u.nome_completo)
        .input("email", sql.VarChar(200), u.email)
        .input("papel", sql.VarChar(20), u.papel)
        .input("polo_id", sql.UniqueIdentifier, u.polo_id)
        .input("hash", sql.VarChar(100), hash);
      if (u.id) {
        await req.input("id", sql.UniqueIdentifier, u.id).query(`
          UPDATE dados.perfis
          SET nome_completo = @nome, email = @email, papel = @papel, polo_id = @polo_id,
              senha_hash = COALESCE(@hash, senha_hash),
              sessao_valida_desde = CASE WHEN @hash IS NOT NULL THEN SYSDATETIMEOFFSET() ELSE sessao_valida_desde END,
              atualizado_em = SYSDATETIMEOFFSET()
          WHERE id = @id`);
      } else {
        await req.query(`
          INSERT INTO dados.perfis (nome_completo, email, papel, polo_id, ativo, senha_hash)
          VALUES (@nome, @email, @papel, @polo_id, 1, @hash)`);
      }
    });
    try {
      revalidatePath("/usuarios");
    } catch {}
    return { sucesso: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (/UNIQUE KEY|duplicate key|uq_perfis_email/i.test(msg))
      return { erro: "Já existe um usuário com este e-mail." };
    console.error("[USUARIOS] Falha ao salvar usuário:", msg);
    return { erro: "Erro ao salvar usuário." };
  }
}

/** Reatribui as pendências de um responsável (ex.: conta desativada) para outra pessoa. */
export async function reatribuirPendenciasAction(
  origemId: string,
  destinoId: string,
  justificativa: string
) {
  try {
    const perfil = await obterPerfilAtual();
    const n = await reatribuirPendencias(perfil, origemId, destinoId, justificativa);
    try {
      revalidatePath("/usuarios");
      revalidatePath("/chamados");
    } catch {}
    return { sucesso: true as const, quantidade: n };
  } catch (err) {
    if (err instanceof ErroNegocio) return { sucesso: false as const, erro: err.message };
    console.error("[USUARIOS] Falha na reatribuição:", err instanceof Error ? err.message : err);
    return { sucesso: false as const, erro: "Não foi possível reatribuir as pendências." };
  }
}
