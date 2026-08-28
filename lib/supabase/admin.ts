import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com privilégios de service_role para operações de retaguarda seguras.
 * ATENÇÃO: NUNCA importe ou utilize este arquivo em Client Components ou código enviado ao navegador.
 */
export function criarClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
