import { getPool, sql } from "@/lib/db/pool";
import { cache } from "react";

/**
 * Obtém o avatar mais recente do usuário.
 * Retorna uma data URL base64 ou null se não houver foto cadastrada ou se foi removida.
 */
export const obterAvatarUsuario = cache(async (usuarioId: string): Promise<string | null> => {
  if (!usuarioId) return null;

  try {
    const pool = await getPool();
    const resultado = await pool.request().input("regId", sql.VarChar(50), usuarioId).query(`
        SELECT TOP 1 dados_depois, operacao
        FROM auditoria.logs
        WHERE tabela = 'perfis_avatar' AND registro_id = @regId
        ORDER BY criado_em DESC
      `);

    if (resultado.recordset.length === 0) {
      return null;
    }

    const row = resultado.recordset[0];
    if (row.operacao === "DELETE" || !row.dados_depois) {
      return null;
    }

    try {
      const parsed = JSON.parse(row.dados_depois);
      return parsed.avatar || null;
    } catch {
      return null;
    }
  } catch (erro) {
    console.error("Erro ao buscar avatar do usuário:", erro);
    return null;
  }
});

/**
 * Salva uma nova foto de perfil para o usuário (em formato data URL base64 comprimida).
 */
export async function salvarAvatarUsuario(
  usuarioId: string,
  fotoBase64: string,
  nomeUsuario?: string
): Promise<boolean> {
  try {
    const pool = await getPool();
    const payloadJson = JSON.stringify({ avatar: fotoBase64 });

    await pool
      .request()
      .input("tabela", sql.VarChar(100), "perfis_avatar")
      .input("regId", sql.VarChar(50), usuarioId)
      .input("operacao", sql.VarChar(10), "UPDATE")
      .input("dadosDepois", sql.NVarChar(sql.MAX), payloadJson)
      .input("uid", sql.VarChar(50), usuarioId)
      .input("usuarioNome", sql.NVarChar(200), nomeUsuario || "Usuário")
      .input("origem", sql.VarChar(30), "avatar_upload").query(`
        INSERT INTO auditoria.logs (
          tabela, registro_id, operacao, dados_depois, usuario_id, usuario_nome, origem, criado_em
        ) VALUES (
          @tabela, @regId, @operacao, @dadosDepois, @uid, @usuarioNome, @origem, SYSDATETIMEOFFSET()
        )
      `);

    return true;
  } catch (erro) {
    console.error("Erro ao salvar avatar do usuário:", erro);
    return false;
  }
}

/**
 * Remove a foto de perfil do usuário, voltando a exibir as iniciais do nome.
 */
export async function removerAvatarUsuario(
  usuarioId: string,
  nomeUsuario?: string
): Promise<boolean> {
  try {
    const pool = await getPool();
    const payloadJson = JSON.stringify({ avatar: null });

    await pool
      .request()
      .input("tabela", sql.VarChar(100), "perfis_avatar")
      .input("regId", sql.VarChar(50), usuarioId)
      .input("operacao", sql.VarChar(10), "DELETE")
      .input("dadosDepois", sql.NVarChar(sql.MAX), payloadJson)
      .input("uid", sql.VarChar(50), usuarioId)
      .input("usuarioNome", sql.NVarChar(200), nomeUsuario || "Usuário")
      .input("origem", sql.VarChar(30), "avatar_delete").query(`
        INSERT INTO auditoria.logs (
          tabela, registro_id, operacao, dados_depois, usuario_id, usuario_nome, origem, criado_em
        ) VALUES (
          @tabela, @regId, @operacao, @dadosDepois, @uid, @usuarioNome, @origem, SYSDATETIMEOFFSET()
        )
      `);

    return true;
  } catch (erro) {
    console.error("Erro ao remover avatar do usuário:", erro);
    return false;
  }
}

export { extrairIniciaisNome } from "@/lib/utils/iniciais";
