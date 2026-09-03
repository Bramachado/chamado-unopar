import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SEGREDO_JWT = new TextEncoder().encode(
  process.env.AUTH_SECRET || "chave-secreta-padrao-minimo-32-caracteres-para-dev"
);

const NOME_COOKIE_SESSAO = "chamados_unopar_session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(NOME_COOKIE_SESSAO)?.value;
  let usuarioAutenticado = false;

  if (token) {
    try {
      await jwtVerify(token, SEGREDO_JWT);
      usuarioAutenticado = true;
    } catch {
      usuarioAutenticado = false;
    }
  }

  const ehRotaLogin = request.nextUrl.pathname === "/login";
  const ehRotaPublica =
    ehRotaLogin ||
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/api/public") ||
    request.nextUrl.pathname === "/favicon.ico" ||
    request.nextUrl.pathname === "/logo.png";

  if (!usuarioAutenticado && !ehRotaPublica) {
    const urlLogin = request.nextUrl.clone();
    urlLogin.pathname = "/login";
    return NextResponse.redirect(urlLogin);
  }

  if (usuarioAutenticado && ehRotaLogin) {
    const urlPainel = request.nextUrl.clone();
    urlPainel.pathname = "/painel";
    return NextResponse.redirect(urlPainel);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
