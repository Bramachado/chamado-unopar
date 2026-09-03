import { getPool, sql } from "./pool";

export interface SessaoUsuario {
  usuario_id: string;
  papel: string;
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

  // Define o contexto NA MESMA conexão, no início, sempre:
  await request
    .input("usuario_id", sql.UniqueIdentifier, sessao.usuario_id)
    .input("papel", sql.VarChar(20), sessao.papel)
    .execute("seg.definir_contexto");

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
    await request
      .input("usuario_id", sql.UniqueIdentifier, sessao.usuario_id)
      .input("papel", sql.VarChar(20), sessao.papel)
      .execute("seg.definir_contexto");

    const result = await fn(request, transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
