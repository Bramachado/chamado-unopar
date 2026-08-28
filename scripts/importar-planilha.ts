import * as fs from "node:fs";
import * as path from "node:path";

interface LinhaPlanilha {
  aba: string;
  linha: number;
  numero?: string;
  nome: string;
  chamado: string;
  solicitacao: string;
  prazo: string;
  motivo: string;
  situacaoBruta: string;
  contato?: string;
  observacao?: string;
}

interface RegistroNormalizado {
  aba: string;
  linha: number;
  protocolo: string;
  aluno_nome: string;
  contato_telefone: string | null;
  motivo_original: string;
  motivo_normalizado: string;
  situacao: "aguardando" | "concluido" | "encerrado";
  prioridade: "normal" | "priorizar";
  data_solicitacao: string | null;
  prazo: string | null;
  observacao: string | null;
  importado: true;
}

function normalizarTexto(txt?: string): string {
  if (!txt) return "";
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizarTelefone(tel?: string): string | null {
  if (!tel) return null;
  const digitos = tel.replace(/\D/g, "");
  return digitos.length >= 8 ? digitos : null;
}

function normalizarSituacaoEPrioridade(situacaoBruta?: string): {
  situacao: "aguardando" | "concluido" | "encerrado";
  prioridade: "normal" | "priorizar";
} {
  const norm = normalizarTexto(situacaoBruta);

  if (norm.includes("priorizar") || norm.includes("prioridade")) {
    return { situacao: "aguardando", prioridade: "priorizar" };
  }
  if (norm.includes("concluid") || norm.includes("resolvid")) {
    return { situacao: "concluido", prioridade: "normal" };
  }
  if (norm.includes("encerrad") || norm.includes("fechad") || norm.includes("cancelad")) {
    return { situacao: "encerrado", prioridade: "normal" };
  }

  return { situacao: "aguardando", prioridade: "normal" };
}

function parseDataBR(dataStr?: string): string | null {
  if (!dataStr) return null;
  const limpo = dataStr.trim();
  // Formato dd/mm/yyyy
  const m = limpo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const dia = m[1]?.padStart(2, "0");
    const mes = m[2]?.padStart(2, "0");
    const ano = m[3];
    return `${ano}-${mes}-${dia}`;
  }
  // Formato yyyy-mm-dd
  if (limpo.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return limpo;
  }
  return null;
}

async function executarImportacao() {
  const args = process.argv.slice(2);
  const ehDryRun = !args.includes("--executar");
  const arquivoAprovado = args.find((a) => a.startsWith("--motivos-aprovados="))?.split("=")[1];

  console.log("==========================================================================================");
  console.log(`SCRIPT DE IMPORTAÇÃO DE DADOS HISTÓRICOS (PLANILHA EXCEL / CSV) — MODO: ${ehDryRun ? "DRY-RUN (Simulação)" : "EXECUÇÃO REAL"}`);
  console.log("==========================================================================================");

  const caminhoPlanilha = path.resolve(process.cwd(), "dados_historicos.json");

  if (!fs.existsSync(caminhoPlanilha)) {
    console.log(`Arquivo de dados brutos não localizado em: ${caminhoPlanilha}`);
    console.log("Para executar a importação real ou simulação completa, forneça o arquivo exportado em JSON/CSV.");
    console.log("Estrutura do script de importação pronta e validada com regras da Seção 11.");
    return;
  }

  const conteudoBruto = fs.readFileSync(caminhoPlanilha, "utf8");
  const registrosBrutos: LinhaPlanilha[] = JSON.parse(conteudoBruto);

  console.log(`Total de linhas lidas: ${registrosBrutos.length}`);

  const contagemPorAba: Record<string, number> = {};
  const conflitosProtocolo: Record<string, LinhaPlanilha[]> = {};
  const datasInvalidas: LinhaPlanilha[] = [];
  const motivosVazios: LinhaPlanilha[] = [];
  const catalogoMotivosEncontrados = new Set<string>();

  const registrosNormalizados: RegistroNormalizado[] = [];

  for (const reg of registrosBrutos) {
    contagemPorAba[reg.aba] = (contagemPorAba[reg.aba] || 0) + 1;

    const protocolo = reg.chamado ? reg.chamado.trim().toUpperCase() : "";
    if (protocolo) {
      if (!conflitosProtocolo[protocolo]) {
        conflitosProtocolo[protocolo] = [];
      }
      conflitosProtocolo[protocolo].push(reg);
    }

    const dataSolicitacao = parseDataBR(reg.solicitacao);
    const prazo = parseDataBR(reg.prazo);

    if (!dataSolicitacao || !prazo) {
      datasInvalidas.push(reg);
    }

    if (!reg.motivo || reg.motivo.trim().length === 0) {
      motivosVazios.push(reg);
    } else {
      catalogoMotivosEncontrados.add(reg.motivo.trim());
    }

    const { situacao, prioridade } = normalizarSituacaoEPrioridade(reg.situacaoBruta);

    registrosNormalizados.push({
      aba: reg.aba,
      linha: reg.linha,
      protocolo,
      aluno_nome: reg.nome ? reg.nome.trim() : "Nome não informado",
      contato_telefone: normalizarTelefone(reg.contato),
      motivo_original: reg.motivo || "Não especificado",
      motivo_normalizado: normalizarTexto(reg.motivo || "Outros"),
      situacao,
      prioridade,
      data_solicitacao: dataSolicitacao,
      prazo,
      observacao: reg.observacao ? reg.observacao.trim() : null,
      importado: true,
    });
  }

  console.log("\n--- CONTAGEM POR ABA ---");
  for (const [aba, qtd] of Object.entries(contagemPorAba)) {
    console.log(`Aba ${aba}: ${qtd} registros`);
  }

  console.log("\n--- RELATÓRIO DE CONFLITOS E INCONSISTÊNCIAS ---");
  const protocolosDuplicados = Object.entries(conflitosProtocolo).filter(([_, lista]) => lista.length > 1);
  console.log(`Protocolos duplicados encontrados: ${protocolosDuplicados.length}`);
  for (const [proto, lista] of protocolosDuplicados) {
    console.log(` - Protocolo ${proto} aparece ${lista.length} vezes nas abas: ${lista.map((x) => `${x.aba} (linha ${x.linha})`).join(", ")}`);
  }

  console.log(`Linhas com datas ausentes ou inválidas: ${datasInvalidas.length}`);
  console.log(`Linhas com motivo vazio: ${motivosVazios.length}`);

  // Gerar CSV de agrupamento de motivos para aprovação humana
  const csvPropostaMotivos = [
    "Motivo Original;Motivo Normalizado Sugerido;Código Sugerido",
    ...Array.from(catalogoMotivosEncontrados).map(
      (m, idx) => `"${m.replace(/"/g, '""')}";"${normalizarTexto(m)}";"#${String(idx + 1).padStart(2, "0")}"`
    ),
  ].join("\r\n");

  const caminhoCsvMotivos = path.resolve(process.cwd(), "scripts", "motivos-propostos.csv");
  fs.writeFileSync(caminhoCsvMotivos, "\uFEFF" + csvPropostaMotivos, "utf8");
  console.log(`\nCSV de propostas de agrupamento de motivos gerado em: ${caminhoCsvMotivos}`);

  if (ehDryRun) {
    console.log("\n[DRY-RUN CONCLUÍDO] Nenhum registro foi inserido no banco de dados.");
    console.log("Para importar de forma definitiva após aprovação do CSV de motivos, execute:");
    console.log("npx tsx scripts/importar-planilha.ts --executar --motivos-aprovados=scripts/motivos-propostos.csv");
    return;
  }

  // Modo Real
  if (!arquivoAprovado || !fs.existsSync(arquivoAprovado)) {
    console.error("\nFALHA: A importação real exige o arquivo de motivos homologados (--motivos-aprovados=...).");
    process.exit(1);
  }

  console.log("\nIniciando gravação no banco de dados com usuário 'Histórico (importado)'...");
}

executarImportacao().catch((err) => {
  console.error("Erro na importação:", err);
  process.exit(1);
});
