"use server";

import { criarClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function logoutUsuario() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
