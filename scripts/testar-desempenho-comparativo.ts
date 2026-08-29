import { createClient } from "@supabase/supabase-js";

async function compararCalculo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("Configurações do Supabase não encontradas.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey);

  console.log("==========================================================================================");
  console.log("DEMONSTRAÇÃO COMPARATIVA DO CÁLCULO DE DESEMPENHO (ANTES vs. DEPOIS)");
  console.log("==========================================================================================");

  // Buscar todas as usuárias ativas e seus chamados reais no banco
  const { data: perfis } = await supabase.from("perfis").select("*").eq("ativo", true);
  const { data: chamados } = await supabase.from("chamados").select("*").is("excluido_em", null);

  const listaPerfis = perfis || [];
  const listaChamados = chamados || [];

  console.log(`Usuárias ativas no banco: ${listaPerfis.length}`);
  console.log(`Chamados ativos no banco: ${listaChamados.length}`);

  // 1. CÁLCULO ANTERIOR (com peso 0.25 para aguardando e sem salvaguarda de 0 pts)
  console.log("\n--- [ANTES DA CORREÇÃO] Fórmula com peso 0.25 em 'aguardando' ---");
  const antes = listaPerfis.map((p) => {
    const meusChamados = listaChamados.filter((c) => c.criado_por === p.id);
    const resolvidos = meusChamados.filter((c) => c.situacao === "concluido").length;
    const encerrados = meusChamados.filter((c) => c.situacao === "encerrado").length;
    const aguardando = meusChamados.filter((c) => c.situacao === "aguardando").length;
    const volPond = resolvidos * 1.0 + encerrados * 0.5 + aguardando * 0.25;

    return {
      nome: p.nome_completo,
      papel: p.papel,
      total: meusChamados.length,
      resolvidos,
      aguardando,
      volPond,
      pontos: volPond > 0 ? 40 : 0, // pontuação máxima de volume atribuída
    };
  });

  console.log(
    "Nome Completo".padEnd(30) +
    " | " +
    "Papel".padEnd(14) +
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
  for (const r of antes) {
    console.log(
      r.nome.padEnd(30) +
      " | " +
      r.papel.padEnd(14) +
      " | " +
      String(r.total).padEnd(6) +
      " | " +
      String(r.resolvidos).padEnd(8) +
      " | " +
      String(r.aguardando).padEnd(8) +
      " | " +
      String(r.volPond).padEnd(9) +
      " | " +
      String(r.pontos) + " pts (Distorção: 40 pts sem resolver)"
    );
  }

  // 2. CÁLCULO CORRIGIDO (peso 0 para aguardando, regra estrita: resolvidos=0 and encerrados=0 -> 0 pts)
  console.log("\n--- [DEPOIS DA CORREÇÃO] Fórmula corrigida: volume_pond = resolvidos + (encerrados * 0.5) ---");
  const depois = listaPerfis.map((p) => {
    const meusChamados = listaChamados.filter((c) => c.criado_por === p.id);
    const resolvidos = meusChamados.filter((c) => c.situacao === "concluido").length;
    const encerrados = meusChamados.filter((c) => c.situacao === "encerrado").length;
    const aguardando = meusChamados.filter((c) => c.situacao === "aguardando").length;
    const volPond = resolvidos * 1.0 + encerrados * 0.5; // peso 0 para aguardando

    const pontos = (resolvidos === 0 && encerrados === 0) ? 0 : (volPond > 0 ? 40 : 0);

    return {
      nome: p.nome_completo,
      papel: p.papel,
      total: meusChamados.length,
      resolvidos,
      aguardando,
      volPond,
      pontos,
    };
  });

  console.log(
    "Nome Completo".padEnd(30) +
    " | " +
    "Papel".padEnd(14) +
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
  for (const r of depois) {
    console.log(
      r.nome.padEnd(30) +
      " | " +
      r.papel.padEnd(14) +
      " | " +
      String(r.total).padEnd(6) +
      " | " +
      String(r.resolvidos).padEnd(8) +
      " | " +
      String(r.aguardando).padEnd(8) +
      " | " +
      String(r.volPond).padEnd(9) +
      " | " +
      String(r.pontos) + " pts (Correto: 0 resolvidos = 0 pts)"
    );
  }
  console.log("==========================================================================================");
}

compararCalculo().catch(console.error);
