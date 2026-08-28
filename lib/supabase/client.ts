import { createBrowserClient } from "@supabase/ssr";

export function criarClienteBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Variáveis de ambiente do Supabase não configuradas no cliente.");
  }

  return createBrowserClient(url, anonKey);
}
