import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SEGREDO_JWT = new TextEncoder().encode(
  process.env.AUTH_SECRET || "chave-secreta-padrao-minimo-32-caracteres-para-dev"
);

const NOME_COOKIE_SESSAO = "chamados_unopar_session";
const DURACAO_SESSAO_SEGUNDOS = 8 * 60 * 60; // 8 horas

export interface PayloadSessao {
  id: string;
  email: string;
  nome_completo: string;
  papel: "admin" | "coordenador" | "atendente";
}

/**
 * Cria o JWT assinado com validade de 8 horas e define o cookie HTTP-only seguro.
 */
export async function criarSessao(payload: PayloadSessao): Promise<string> {
  const jwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_SEGUNDOS}s`)
    .sign(SEGREDO_JWT);

  const cookieStore = await cookies();
  cookieStore.set(NOME_COOKIE_SESSAO, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });

  return jwt;
}

/**
 * Verifica o token JWT da sessão atual.
 */
export async function verificarSessao(): Promise<PayloadSessao | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(NOME_COOKIE_SESSAO)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, SEGREDO_JWT);
    return payload as unknown as PayloadSessao;
  } catch {
    return null;
  }
}

/**
 * Destrói o cookie de sessão para logout.
 */
export async function destruirSessao(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(NOME_COOKIE_SESSAO);
}
