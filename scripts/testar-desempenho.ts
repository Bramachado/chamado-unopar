import { createClient } from "@supabase/supabase-js";

async function testarDesempenho() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("Configurações do Supabase não encontradas.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey);

  console.log("==========================================================================================");
  console.log("TESTE DE CÁLCULO DE DESEMPENHO E RANKING (EVIDÊNCIA COMPORTAMENTAL)");
  console.log("==========================================================================================");

  // Executar consulta
  const { data: ranking, error } = await supabase.rpc("calcular_ranking_desempenho", {
    p_data_inicio: "2026-08-01",
    p_data_fim: "2026-08-31",
  });

  if (error) {
    console.error("Erro ao consultar calcular_ranking_desempenho:", error.message);
    process.exit(1);
  }

  console.log("\nResultado retornado pelo SELECT calcular_ranking_desempenho('2026-08-01', '2026-08-31'):\n");
  console.log(
    "Pos".padEnd(5) +
    " | " +
    "Nome Completo".padEnd(28) +
    " | " +
    "Papel".padEnd(12) +
    " | " +
    "Total".padEnd(6) +
    " | " +
    "Resolv.".padEnd(8) +
    " | " +
    "Aguard.".padEnd(8) +
    " | " +
    "Vol.Pond".padEnd(9) +
    " | " +
    "Pontos Total"
  );
  console.log("-".repeat(95));

  for (const r of ranking) {
    console.log(
      String(r.posicao + "º").padEnd(5) +
      " | " +
      String(r.nome_completo).padEnd(28) +
      " | " +
      String(r.papel).padEnd(12) +
      " | " +
      String(r.volume_total).padEnd(6) +
      " | " +
      String(r.resolvidos).padEnd(8) +
      " | " +
      String(r.aguardando).padEnd(8) +
      " | " +
      String(r.volume_ponderado).padEnd(9) +
      " | " +
      String(r.pontos_total) + " pts"
    );
  }
  console.log("==========================================================================================");
}

testarDesempenho().catch(console.error);
