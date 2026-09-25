"use server";

import { destruirSessao } from "@/lib/auth/jwt";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { obterNotificacoesPrazos, type DadosNotificacoesPrazos } from "@/lib/chamados/notificacoes";
import { redirect } from "next/navigation";

export async function logoutUsuario() {
  await destruirSessao();
  redirect("/login");
}

export async function obterNotificacoesPrazosAction(): Promise<DadosNotificacoesPrazos> {
  const perfil = await obterPerfilAtual();
  return await obterNotificacoesPrazos(perfil);
}
