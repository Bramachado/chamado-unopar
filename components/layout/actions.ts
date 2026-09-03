"use server";

import { destruirSessao } from "@/lib/auth/jwt";
import { redirect } from "next/navigation";

export async function logoutUsuario() {
  await destruirSessao();
  redirect("/login");
}
