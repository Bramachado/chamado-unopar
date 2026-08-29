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

async function autenticarCliente(url: string, anonKey: string, email?: string, password?: string): Promise<{ client: SupabaseClient; userId: string } | null> {
  if (!email || !password) return null;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    console.error(`Erro ao autenticar ${email}:`, error?.message);
    return null;
  }
  return { client, userId: data.user.id };
}

async function executarTestes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Variáveis de ambiente do Supabase não configuradas para os testes.");
    process.exit(1);
  }

  const emailAdmin = process.env.TEST_EMAIL_ADMIN;
  const senhaAdmin = process.env.TEST_SENHA_ADMIN;
  const emailCoord = process.env.TEST_EMAIL_COORD;
  const senhaCoord = process.env.TEST_SENHA_COORD;
  const emailAtend = process.env.TEST_EMAIL_ATEND;
  const senhaAtend = process.env.TEST_SENHA_ATEND;

  const authAdmin = await autenticarCliente(url, anonKey, emailAdmin, senhaAdmin);
  const authCoord = await autenticarCliente(url, anonKey, emailCoord, senhaCoord);
  const authAtend = await autenticarCliente(url, anonKey, emailAtend, senhaAtend);

  if (!authAdmin || !authCoord || !authAtend) {
    console.error("Falha ao autenticar uma ou mais usuárias de teste.");
    process.exit(1);
  }

  const { client: clientAdmin, userId: idAdmin } = authAdmin;
  const { client: clientCoord, userId: idCoord } = authCoord;
  const { client: clientAtend, userId: idAtend } = authAtend;

  console.log("Usuárias autenticadas com sucesso no Supabase Auth:");
  console.log(`- Admin: ${idAdmin}`);
  console.log(`- Coordenadora: ${idCoord}`);
  console.log(`- Atendente: ${idAtend}`);
  console.log("\nExecutando bateria completa da matriz de permissões (Row Level Security)...");

  // Garantir um motivo base para testes
  const { data: motivoBase } = await clientAdmin
    .from("motivos")
    .select("id")
    .limit(1)
    .maybeSingle();

  let motivoId = motivoBase?.id;
  if (!motivoId) {
    const { data: novoMotivo } = await clientAdmin
      .from("motivos")
      .insert({ nome: "Motivo Geral de Testes", criado_por: idAdmin })
      .select("id")
      .single();
    motivoId = novoMotivo?.id;
  }

  // ==============================================================================
  // 1. Ver chamados (SELECT em chamados) -> Todos
  // ==============================================================================
  const { error: errSelAdmin } = await clientAdmin.from("chamados").select("id").limit(1);
  registrarResultado("Ver chamados", "admin", "PERMITIDO", !errSelAdmin);

  const { error: errSelCoord } = await clientCoord.from("chamados").select("id").limit(1);
  registrarResultado("Ver chamados", "coordenador", "PERMITIDO", !errSelCoord);

  const { error: errSelAtend } = await clientAtend.from("chamados").select("id").limit(1);
  registrarResultado("Ver chamados", "atendente", "PERMITIDO", !errSelAtend);

  // ==============================================================================
  // 2. Criar chamado (INSERT em chamados) -> Todos (com criado_por forçado a auth.uid())
  // ==============================================================================
  const protoAdmin = `CS${Math.floor(10000000 + Math.random() * 90000000)}`;
  const protoCoord = `CS${Math.floor(10000000 + Math.random() * 90000000)}`;
  const protoAtend = `CS${Math.floor(10000000 + Math.random() * 90000000)}`;

  const { data: chamAdmin, error: errInsAdmin } = await clientAdmin
    .from("chamados")
    .insert({
      protocolo: protoAdmin,
      aluno_nome: "Aluno Teste Admin",
      motivo_id: motivoId,
      situacao: "aguardando",
      prioridade: "normal",
      data_solicitacao: "2026-08-29",
      prazo: "2026-09-05",
      criado_por: idAdmin,
    })
    .select("id")
    .single();
  registrarResultado("Criar chamado", "admin", "PERMITIDO", !errInsAdmin && !!chamAdmin);

  const { data: chamCoord, error: errInsCoord } = await clientCoord
    .from("chamados")
    .insert({
      protocolo: protoCoord,
      aluno_nome: "Aluno Teste Coord",
      motivo_id: motivoId,
      situacao: "aguardando",
      prioridade: "normal",
      data_solicitacao: "2026-08-29",
      prazo: "2026-09-05",
      criado_por: idCoord,
    })
    .select("id")
    .single();
  registrarResultado("Criar chamado", "coordenador", "PERMITIDO", !errInsCoord && !!chamCoord);

  const { data: chamAtend, error: errInsAtend } = await clientAtend
    .from("chamados")
    .insert({
      protocolo: protoAtend,
      aluno_nome: "Aluno Teste Atend",
      motivo_id: motivoId,
      situacao: "aguardando",
      prioridade: "normal",
      data_solicitacao: "2026-08-29",
      prazo: "2026-09-05",
      criado_por: idAtend,
    })
    .select("id")
    .single();
  registrarResultado("Criar chamado", "atendente", "PERMITIDO", !errInsAtend && !!chamAtend);

  // Tentativa de forjar autor no INSERT (deve falhar se criado_por != auth.uid())
  const { error: errForjar } = await clientAtend.from("chamados").insert({
    protocolo: `CS${Math.floor(10000000 + Math.random() * 90000000)}`,
    aluno_nome: "Aluno Forjado",
    motivo_id: motivoId,
    situacao: "aguardando",
    prioridade: "normal",
    data_solicitacao: "2026-08-29",
    prazo: "2026-09-05",
    criado_por: idAdmin, // tentativa forjada
  });
  registrarResultado("Forjar autor no INSERT", "atendente", "NEGADO", !errForjar);

  // ==============================================================================
  // 3. Editar chamado próprio -> Todos
  // ==============================================================================
  if (chamAdmin) {
    const { error: errUpdProprioAdmin } = await clientAdmin
      .from("chamados")
      .update({ descricao: "Atualização própria admin" })
      .eq("id", chamAdmin.id);
    registrarResultado("Editar chamado próprio", "admin", "PERMITIDO", !errUpdProprioAdmin);
  }

  if (chamCoord) {
    const { error: errUpdProprioCoord } = await clientCoord
      .from("chamados")
      .update({ descricao: "Atualização própria coord" })
      .eq("id", chamCoord.id);
    registrarResultado("Editar chamado próprio", "coordenador", "PERMITIDO", !errUpdProprioCoord);
  }

  if (chamAtend) {
    const { error: errUpdProprioAtend } = await clientAtend
      .from("chamados")
      .update({ descricao: "Atualização própria atendente" })
      .eq("id", chamAtend.id);
    registrarResultado("Editar chamado próprio", "atendente", "PERMITIDO", !errUpdProprioAtend);
  }

  // ==============================================================================
  // 4. Editar chamado de outra -> Admin SIM, Coordenador NÃO, Atendente NÃO
  // ==============================================================================
  if (chamAtend) {
    // Admin edita chamado de atendente
    const { error: errUpdOutraAdmin } = await clientAdmin
      .from("chamados")
      .update({ descricao: "Edição por admin em chamado de atendente" })
      .eq("id", chamAtend.id);
    registrarResultado("Editar chamado de outra", "admin", "PERMITIDO", !errUpdOutraAdmin);

    // Coordenadora tenta editar chamado de atendente
    const { data: dataUpdCoord, error: errUpdOutraCoord } = await clientCoord
      .from("chamados")
      .update({ descricao: "Tentativa de edição por coordenadora" })
      .eq("id", chamAtend.id)
      .select();
    const sucessoCoord = !errUpdOutraCoord && (dataUpdCoord?.length ?? 0) > 0;
    registrarResultado("Editar chamado de outra", "coordenador", "NEGADO", sucessoCoord);

    // Atendente tenta editar chamado de coordenadora
    if (chamCoord) {
      const { data: dataUpdAtend, error: errUpdOutraAtend } = await clientAtend
        .from("chamados")
        .update({ descricao: "Tentativa de edição por atendente" })
        .eq("id", chamCoord.id)
        .select();
      const sucessoAtend = !errUpdOutraAtend && (dataUpdAtend?.length ?? 0) > 0;
      registrarResultado("Editar chamado de outra", "atendente", "NEGADO", sucessoAtend);
    }
  }

  // ==============================================================================
  // 5. Excluir chamado próprio (RPC excluir_chamado) -> Admin SIM, Coord NÃO, Atend SIM
  // ==============================================================================
  if (chamAdmin) {
    const { error: errDelAdmin } = await clientAdmin.rpc("excluir_chamado", { p_id: chamAdmin.id });
    registrarResultado("Excluir chamado próprio", "admin", "PERMITIDO", !errDelAdmin);
  }

  if (chamCoord) {
    const { error: errDelCoord } = await clientCoord.rpc("excluir_chamado", { p_id: chamCoord.id });
    registrarResultado("Excluir chamado próprio", "coordenador", "NEGADO", !errDelCoord);
  }

  if (chamAtend) {
    const { error: errDelAtend } = await clientAtend.rpc("excluir_chamado", { p_id: chamAtend.id });
    registrarResultado("Excluir chamado próprio", "atendente", "PERMITIDO", !errDelAtend);
  }

  // ==============================================================================
  // 6. Excluir chamado de outra (RPC excluir_chamado) -> Admin SIM, Coord NÃO, Atend NÃO
  // ==============================================================================
  // Criar um novo chamado da coordenadora para testar exclusão por admin e atendente
  const protoCoord2 = `CS${Math.floor(10000000 + Math.random() * 90000000)}`;
  const { data: chamCoord2 } = await clientCoord
    .from("chamados")
    .insert({
      protocolo: protoCoord2,
      aluno_nome: "Aluno Coord 2",
      motivo_id: motivoId,
      situacao: "aguardando",
      prioridade: "normal",
      data_solicitacao: "2026-08-29",
      prazo: "2026-09-05",
      criado_por: idCoord,
    })
    .select("id")
    .single();

  if (chamCoord2) {
    // Atendente tenta excluir chamado de coordenadora
    const { error: errDelOutraAtend } = await clientAtend.rpc("excluir_chamado", { p_id: chamCoord2.id });
    registrarResultado("Excluir chamado de outra", "atendente", "NEGADO", !errDelOutraAtend);

    // Admin exclui chamado de coordenadora
    const { error: errDelOutraAdmin } = await clientAdmin.rpc("excluir_chamado", { p_id: chamCoord2.id });
    registrarResultado("Excluir chamado de outra", "admin", "PERMITIDO", !errDelOutraAdmin);
  }

  // ==============================================================================
  // 7. Revogação de DELETE Físico na tabela chamados
  // ==============================================================================
  const { error: errFisicoAdmin } = await clientAdmin.from("chamados").delete().eq("criado_por", idAdmin);
  registrarResultado("DELETE físico direto na tabela", "admin", "NEGADO", !errFisicoAdmin);

  // ==============================================================================
  // 8. Ver logs de auditoria gerais -> Admin SIM, Coord NÃO, Atend NÃO
  // ==============================================================================
  const { data: dataLogAdmin, error: errLogAdmin } = await clientAdmin.from("logs_auditoria").select("id").limit(1);
  registrarResultado("Ver logs de auditoria gerais", "admin", "PERMITIDO", !errLogAdmin && !!dataLogAdmin);

  const { data: dataLogCoord } = await clientCoord.from("logs_auditoria").select("id").limit(1);
  registrarResultado("Ver logs de auditoria gerais", "coordenador", "NEGADO", (dataLogCoord?.length ?? 0) > 0);

  const { data: dataLogAtend } = await clientAtend.from("logs_auditoria").select("id").limit(1);
  registrarResultado("Ver logs de auditoria gerais", "atendente", "NEGADO", (dataLogAtend?.length ?? 0) > 0);

  // ==============================================================================
  // 9. Catálogo de Motivos: Criar -> Todos, Editar -> Somente Admin
  // ==============================================================================
  const nomeMotivoCoord = `Motivo Coord ${Date.now()}`;
  const { data: motCoord, error: errInsMotCoord } = await clientCoord
    .from("motivos")
    .insert({ nome: nomeMotivoCoord, criado_por: idCoord })
    .select("id")
    .single();
  registrarResultado("Criar motivo", "coordenador", "PERMITIDO", !errInsMotCoord && !!motCoord);

  if (motCoord) {
    // Coordenador tenta editar motivo
    const { data: dataUpdMotCoord, error: errUpdMotCoord } = await clientCoord
      .from("motivos")
      .update({ nome: "Tentativa edicao coord" })
      .eq("id", motCoord.id)
      .select();
    const sucessoUpdMotCoord = !errUpdMotCoord && (dataUpdMotCoord?.length ?? 0) > 0;
    registrarResultado("Editar motivo", "coordenador", "NEGADO", sucessoUpdMotCoord);

    // Admin edita motivo
    const { error: errUpdMotAdmin } = await clientAdmin
      .from("motivos")
      .update({ nome: "Edicao homologada admin" })
      .eq("id", motCoord.id);
    registrarResultado("Editar motivo", "admin", "PERMITIDO", !errUpdMotAdmin);
  }

  // ==============================================================================
  // 10. SELECT direto em credenciais_externas (bloqueio total no banco)
  // ==============================================================================
  const { data: dataCredAdmin } = await clientAdmin.from("credenciais_externas").select("perfil_id").limit(1);
  registrarResultado("SELECT direto em credenciais_externas", "admin", "NEGADO", (dataCredAdmin?.length ?? 0) > 0);

  const { data: dataCredCoord } = await clientCoord.from("credenciais_externas").select("perfil_id").limit(1);
  registrarResultado("SELECT direto em credenciais_externas", "coordenador", "NEGADO", (dataCredCoord?.length ?? 0) > 0);

  const { data: dataCredAtend } = await clientAtend.from("credenciais_externas").select("perfil_id").limit(1);
  registrarResultado("SELECT direto em credenciais_externas", "atendente", "NEGADO", (dataCredAtend?.length ?? 0) > 0);

  // ==============================================================================
  // EXIBIÇÃO DA TABELA FORMATADA
  // ==============================================================================
  console.log("\n==========================================================================================");
  console.log("RELATÓRIO DE VALIDAÇÃO DE PERMISSÕES (ROW LEVEL SECURITY)");
  console.log("==========================================================================================");
  console.log(
    "Ação".padEnd(38) +
    " | " +
    "Papel".padEnd(12) +
    " | " +
    "Esperado".padEnd(10) +
    " | " +
    "Obtido".padEnd(12) +
    " | " +
    "Status"
  );
  console.log("-".repeat(85));

  let totalFalhas = 0;
  for (const r of resultados) {
    if (r.status === "FALHA") totalFalhas++;
    console.log(
      r.acao.padEnd(38) +
      " | " +
      r.papel.padEnd(12) +
      " | " +
      r.esperado.padEnd(10) +
      " | " +
      r.obtido.padEnd(12) +
      " | " +
      r.status
    );
  }
  console.log("==========================================================================================");

  if (totalFalhas > 0) {
    console.error(`\nFALHA NA VALIDAÇÃO: ${totalFalhas} regra(s) de permissão falharam.`);
    process.exit(1);
  } else {
    console.log(`\nSUCESSO: Todas as ${resultados.length} verificações da matriz de segurança RLS foram validadas com êxito no PostgreSQL.`);
  }
}

executarTestes().catch((err) => {
  console.error("Erro fatal durante a execução dos testes:", err);
  process.exit(1);
});
