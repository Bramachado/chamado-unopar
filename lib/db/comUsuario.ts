import { getPool, sql } from "./pool";

export interface SessaoUsuario {
  usuario_id: string;
  papel: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_NULO = "00000000-0000-0000-0000-000000000000";

function sanitizarUuid(id?: string): string {
  if (!id) return UUID_NULO;
  const limpo = id.trim();
  return UUID_REGEX.test(limpo) ? limpo : UUID_NULO;
}

/**
 * Wrapper de segurança inviolável:
 * SEMPRE define o SESSION_CONTEXT na mesma conexão física antes de qualquer query,
 * garantindo a aplicação das políticas RLS no SQL Server (seg.definir_contexto).
 */
export async function comUsuario<T>(
  sessao: SessaoUsuario,
  fn: (request: sql.Request) => Promise<T>
): Promise<T> {
  const pool = await getPool();
  const request = pool.request();
  const usuarioIdSanitizado = sanitizarUuid(sessao.usuario_id);

  // Define o contexto NA MESMA conexão, no início, sempre:
  await request
    .input("usuario_id", sql.VarChar(50), usuarioIdSanitizado)
    .input("papel", sql.VarChar(20), sessao.papel || "atendente")
    .execute("seg.definir_contexto");

  // Limpa os parâmetros do request para não contaminar procedures/queries subsequentes
  request.parameters = {};

  return await fn(request);
}

/**
 * Wrapper transacional com SESSION_CONTEXT aplicado na conexão da transação.
 */
export async function comTransacao<T>(
  sessao: SessaoUsuario,
  fn: (request: sql.Request, transaction: sql.Transaction) => Promise<T>
): Promise<T> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = new sql.Request(transaction);
    const usuarioIdSanitizado = sanitizarUuid(sessao.usuario_id);

    await request
      .input("usuario_id", sql.VarChar(50), usuarioIdSanitizado)
      .input("papel", sql.VarChar(20), sessao.papel || "atendente")
      .execute("seg.definir_contexto");

    // Limpa os parâmetros do request para não contaminar procedures/queries subsequentes
    request.parameters = {};

    const result = await fn(request, transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
