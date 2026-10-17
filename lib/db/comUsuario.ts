import { getPool, sql } from "./pool";
import { ipDoCliente } from "@/lib/auth/ip";

export interface SessaoUsuario {
  usuario_id: string;
  papel: string;
  /** IP do cliente para a auditoria. Se omitido, é lido da requisição atual (proxy confiável). */
  ip?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_NULO = "00000000-0000-0000-0000-000000000000";

function sanitizarUuid(id?: string): string {
  if (!id) return UUID_NULO;
  const limpo = id.trim();
  return UUID_REGEX.test(limpo) ? limpo : UUID_NULO;
}

/** IP da requisição em andamento (fora de uma requisição Next, retorna null). */
async function ipDaRequisicaoAtual(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    return ipDoCliente(await headers());
  } catch {
    return null;
  }
}

/**
 * Wrapper de segurança:
 * SEMPRE define o SESSION_CONTEXT na mesma conexão física antes de qualquer query,
 * garantindo a aplicação das políticas RLS no SQL Server (seg.definir_contexto)
 * e o registro de usuário e IP pelos triggers de auditoria.
 *
 * Um Request criado direto do pool (pool.request()) pega uma conexão nova a cada
 * execute/query, então o contexto poderia ficar numa conexão e a query rodar em outra
 * (com o contexto de outro usuário ou sem contexto). Por isso usa a mesma conexão
 * da transação para o contexto e para as queries.
 */
export async function comUsuario<T>(
  sessao: SessaoUsuario,
  fn: (request: sql.Request) => Promise<T>
): Promise<T> {
  return comTransacao(sessao, (request) => fn(request));
}

/**
 * Wrapper transacional com SESSION_CONTEXT aplicado na conexão da transação.
 * Use `novaRequisicao(transaction)` para cada comando quando houver vários parâmetros,
 * evitando conflito de nomes entre consultas.
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
    const ip = sessao.ip !== undefined ? sessao.ip : await ipDaRequisicaoAtual();

    await request
      .input("usuario_id", sql.VarChar(50), usuarioIdSanitizado)
      .input("papel", sql.VarChar(20), sessao.papel || "atendente")
      .execute("seg.definir_contexto");
    request.parameters = {};
    await request
      .input("ip", sql.VarChar(45), ip ? ip.slice(0, 45) : null)
      .query("EXEC sp_set_session_context @key = N'ip', @value = @ip;");

    // Limpa os parâmetros do request para não contaminar procedures/queries subsequentes
    request.parameters = {};

    const result = await fn(request, transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

export function novaRequisicao(transaction: sql.Transaction): sql.Request {
  return new sql.Request(transaction);
}
