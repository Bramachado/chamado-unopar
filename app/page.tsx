import { redirect } from "next/navigation";
import { verificarSessao } from "@/lib/auth/jwt";

export default async function PaginaInicial() {
  const sessao = await verificarSessao();

  if (!sessao) {
    redirect("/login");
  } else {
    redirect("/painel");
  }
}
