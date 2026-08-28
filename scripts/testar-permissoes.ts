import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface TesteResultado {
  acao: string;
  papel: string;
  esperado: string;
  obtido: string;
  status: "OK" | "FALHA";
}

const resultados: TesteResultado[] = [];

function registrarResultado(
  acao: string,
  papel: string,
  esperado: "PERMITIDO" | "NEGADO",
  sucessoReal: boolean,
  detalhe?: string
) {
  const obtido = sucessoReal ? "PERMITIDO" : "NEGADO";
  const ok = esperado === obtido;

  resultados.push({
    acao,
    papel,
    esperado,
    obtido: detalhe ? `${obtido} (${detalhe})` : obtido,
    status: ok ? "OK" : "FALHA",
  });
}

async function autenticarCliente(url: string, anonKey: string, email?: string, password?: string): Promise<SupabaseClient | null> {
  if (!email || !password) return null;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`Erro ao autenticar ${email}:`, error.message);
    return null;
  }
  return client;
}

async function executarTestes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Variáveis de ambiente do Supabase não configuradas para os testes.");
    console.error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local.");
    process.exit(1);
  }

  const emailAdmin = process.env.TEST_EMAIL_ADMIN;
  const senhaAdmin = process.env.TEST_SENHA_ADMIN;
  const emailCoord = process.env.TEST_EMAIL_COORD;
  const senhaCoord = process.env.TEST_SENHA_COORD;
  const emailAtend = process.env.TEST_EMAIL_ATEND;
  const senhaAtend = process.env.TEST_SENHA_ATEND;

  if (!emailAdmin || !emailCoord || !emailAtend || !senhaAdmin || !senhaCoord || !senhaAtend) {
    console.warn("Credenciais de teste não fornecidas em variáveis TEST_EMAIL_* e TEST_SENHA_*.");
    console.warn("Para executar o teste real de ponta a ponta contra o banco Supabase, forneça as credenciais.");
    console.log("\nEstrutura do script de validação de RLS e permissões preparada com sucesso.");
    return;
  }

  const clientAdmin = await autenticarCliente(url, anonKey, emailAdmin, senhaAdmin);
  const clientCoord = await autenticarCliente(url, anonKey, emailCoord, senhaCoord);
  const clientAtend = await autenticarCliente(url, anonKey, emailAtend, senhaAtend);

  if (!clientAdmin || !clientCoord || !clientAtend) {
    console.error("Falha ao autenticar uma ou mais usuárias de teste.");
    process.exit(1);
  }

  console.log("Usuárias autenticadas com sucesso. Executando bateria da matriz de permissões...");

  // 1. SELECT na tabela chamados
  const { error: errSelAdmin } = await clientAdmin.from("chamados").select("id").limit(1);
  registrarResultado("Ver chamados", "admin", "PERMITIDO", !errSelAdmin);

  const { error: errSelCoord } = await clientCoord.from("chamados").select("id").limit(1);
  registrarResultado("Ver chamados", "coordenador", "PERMITIDO", !errSelCoord);

  const { error: errSelAtend } = await clientAtend.from("chamados").select("id").limit(1);
  registrarResultado("Ver chamados", "atendente", "PERMITIDO", !errSelAtend);

  // 2. SELECT na tabela logs_auditoria
  const { data: dataLogAdmin, error: errLogAdmin } = await clientAdmin.from("logs_auditoria").select("id").limit(1);
  registrarResultado("Ver logs de auditoria gerais", "admin", "PERMITIDO", !errLogAdmin && !!dataLogAdmin);

  const { data: dataLogCoord } = await clientCoord.from("logs_auditoria").select("id").limit(1);
  registrarResultado("Ver logs de auditoria gerais", "coordenador", "NEGADO", (dataLogCoord?.length ?? 0) > 0);

  const { data: dataLogAtend } = await clientAtend.from("logs_auditoria").select("id").limit(1);
  registrarResultado("Ver logs de auditoria gerais", "atendente", "NEGADO", (dataLogAtend?.length ?? 0) > 0);

  // 3. SELECT em credenciais_externas (bloqueio total no banco)
  const { data: dataCredAdmin } = await clientAdmin.from("credenciais_externas").select("perfil_id").limit(1);
  registrarResultado("SELECT direto em credenciais_externas", "admin", "NEGADO", (dataCredAdmin?.length ?? 0) > 0);

  const { data: dataCredCoord } = await clientCoord.from("credenciais_externas").select("perfil_id").limit(1);
  registrarResultado("SELECT direto em credenciais_externas", "coordenador", "NEGADO", (dataCredCoord?.length ?? 0) > 0);

  const { data: dataCredAtend } = await clientAtend.from("credenciais_externas").select("perfil_id").limit(1);
  registrarResultado("SELECT direto em credenciais_externas", "atendente", "NEGADO", (dataCredAtend?.length ?? 0) > 0);

  // Exibição da tabela de resultados
  console.log("\n==========================================================================================");
  console.log("RELATÓRIO DE VALIDAÇÃO DE PERMISSÕES (ROW LEVEL SECURITY)");
  console.log("==========================================================================================");
  console.log(
    "Ação".padEnd(40) +
    " | " +
    "Papel".padEnd(12) +
    " | " +
    "Esperado".padEnd(10) +
    " | " +
    "Obtido".padEnd(15) +
    " | " +
    "Status"
  );
  console.log("-".repeat(90));

  let temFalha = false;
  for (const r of resultados) {
    if (r.status === "FALHA") temFalha = true;
    console.log(
      r.acao.padEnd(40) +
      " | " +
      r.papel.padEnd(12) +
      " | " +
      r.esperado.padEnd(10) +
      " | " +
      r.obtido.padEnd(15) +
      " | " +
      r.status
    );
  }
  console.log("==========================================================================================");

  if (temFalha) {
    console.error("FALHA NA VALIDAÇÃO: Uma ou mais regras de permissão falharam.");
    process.exit(1);
  } else {
    console.log("SUCESSO: Todas as políticas de segurança foram validadas com sucesso no PostgreSQL.");
  }
}

executarTestes().catch((err) => {
  console.error("Erro fatal durante a execução dos testes:", err);
  process.exit(1);
});
