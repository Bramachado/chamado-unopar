/**
 * Relatório de inconsistências para REVISÃO HUMANA (não altera nada).
 *
 *   MSSQL_HOST=... MSSQL_USER=app_chamados MSSQL_PASSWORD=... MSSQL_DATABASE=ChamadosUnopar \
 *   RELATORIO_ADMIN_ID=<uuid de um perfil admin> npx tsx scripts/relatorio-inconsistencias.ts > inconsistencias.csv
 *
 * Tudo roda numa transação com ROLLBACK ao final e só executa SELECT. O contexto de sessão do
 * admin é definido para que o RLS de produção devolva todas as linhas.
 * Saída: CSV (;) com categoria, registro, detalhe e ação sugerida. Nenhuma correção automática:
 * em especial, datas NÃO são ajustadas somando/subtraindo um dia.
 */
import sql from "mssql";
import { getPool } from "../lib/db/pool";
import {
  adicionarDiasCorridos,
  dataCivilDeInstante,
  dataCivilDoBanco,
  hojeCivil,
} from "../lib/datas";
import { calcularPrazoPadrao } from "../lib/sla";
import { normalizarTelefone } from "../lib/utils/telefone";
import { validarRa } from "../lib/utils/ra";
import { validarCpf } from "../lib/utils/cpf";
import { paresSemelhantes } from "../lib/motivos/normalizacao";
import { ehPendente, ehFinal } from "../lib/chamados/situacoes";
import { montarCsv } from "../lib/utils/csv";

interface Achado {
  categoria: string;
  registro: string;
  detalhe: string;
  acao: string;
}

async function main() {
  const adminId = process.env.RELATORIO_ADMIN_ID;
  if (!adminId)
    throw new Error("Defina RELATORIO_ADMIN_ID (perfil admin usado como contexto de leitura).");
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  const achados: Achado[] = [];
  const add = (categoria: string, registro: string, detalhe: string, acao: string) =>
    achados.push({ categoria, registro, detalhe, acao });

  try {
    await new sql.Request(tx)
      .input("usuario_id", sql.VarChar(50), adminId)
      .input("papel", sql.VarChar(20), "admin")
      .execute("seg.definir_contexto");
    const q = (texto: string) => new sql.Request(tx).query(texto);
    const hoje = hojeCivil();

    const chamados = (
      await q(`
        SELECT CAST(c.id AS NVARCHAR(50)) AS id, c.protocolo, c.aluno_nome, c.aluno_ra, c.aluno_cpf, c.contato_telefone,
          c.situacao, c.importado, c.data_solicitacao, c.prazo, c.data_conclusao, c.criado_em,
          CAST(COALESCE(c.responsavel_id, c.criado_por) AS NVARCHAR(50)) AS responsavel_id,
          p.nome_completo AS responsavel_nome, p.ativo AS responsavel_ativo
        FROM dados.chamados c
        LEFT JOIN dados.perfis p ON p.id = COALESCE(c.responsavel_id, c.criado_por)
        WHERE c.excluido_em IS NULL`)
    ).recordset;

    for (const c of chamados) {
      const reg = `${c.protocolo} (${c.id})`;
      const abertura = dataCivilDoBanco(c.data_solicitacao)!;
      const prazo = dataCivilDoBanco(c.prazo)!;
      const diaCriacao = dataCivilDeInstante(c.criado_em);
      if (prazo < abertura)
        add(
          "datas",
          reg,
          `Prazo ${prazo} anterior à abertura ${abertura}`,
          "Conferir na plataforma externa e corrigir abertura e/ou prazo (com justificativa)"
        );
      if (abertura > hoje)
        add(
          "datas",
          reg,
          `Abertura futura ${abertura} (registro criado em ${diaCriacao})`,
          "Conferir a data real de abertura; possível troca de dia/mês na digitação"
        );
      if (abertura > diaCriacao)
        add(
          "datas",
          reg,
          `Abertura ${abertura} posterior ao dia de cadastro ${diaCriacao}`,
          "Conferir a data de abertura"
        );
      if (ehFinal(c.situacao) && !c.data_conclusao)
        add(
          "datas",
          reg,
          `Situação ${c.situacao} sem data de conclusão`,
          "Informar a data real de conclusão, se conhecida; caso contrário, fica fora do tempo médio"
        );
      if (!ehFinal(c.situacao) && c.data_conclusao)
        add(
          "datas",
          reg,
          `Situação ${c.situacao} com data de conclusão`,
          "Verificar se foi reaberto sem limpar a data"
        );
      if (c.data_conclusao && dataCivilDeInstante(c.data_conclusao) < abertura)
        add("datas", reg, "Conclusão anterior à abertura", "Conferir datas");
      const esperado = calcularPrazoPadrao(abertura);
      if (prazo !== esperado) {
        const deslocado =
          prazo === calcularPrazoPadrao(adicionarDiasCorridos(abertura, 1)) ||
          prazo === calcularPrazoPadrao(adicionarDiasCorridos(abertura, -1));
        add(
          "prazo",
          reg,
          `Prazo ${prazo} difere do calculado ${esperado}${deslocado ? " (compatível com abertura deslocada em 1 dia — padrão do bug de fuso)" : ""}`,
          deslocado
            ? "Confirmar a data real de abertura antes de qualquer ajuste; não corrigir automaticamente"
            : "Se o prazo foi combinado, registrar como ajuste manual com justificativa; senão, voltar ao automático"
        );
      }
      if (c.contato_telefone) {
        const t = normalizarTelefone(c.contato_telefone);
        if (!t.ok)
          add(
            "contato",
            reg,
            `Telefone "${c.contato_telefone}": ${t.erro}`,
            "Corrigir com DDD ou deixar vazio"
          );
      }
      if (c.aluno_cpf && !validarCpf(c.aluno_cpf))
        add(
          "documentos",
          reg,
          "CPF com dígitos verificadores inválidos",
          "Corrigir ou remover o CPF"
        );
      if (c.aluno_ra) {
        const r = validarRa(c.aluno_ra, c.aluno_cpf);
        if (!r.ok)
          add("documentos", reg, `RA "${c.aluno_ra}": ${r.erro}`, "Informar o RA real do aluno");
        else if (r.alerta)
          add(
            "documentos",
            reg,
            `RA "${c.aluno_ra}" tem formato de CPF`,
            "Confirmar com o aluno/sistema acadêmico"
          );
      }
      if (ehPendente(c.situacao) && c.responsavel_ativo === false) {
        add(
          "responsavel",
          reg,
          `Pendente sob responsabilidade de conta desativada (${c.responsavel_nome})`,
          "Reatribuir pela tela Equipe > Pendências"
        );
      }
      if (/\b(teste|test|fict[ií]cio|exemplo)\b/i.test(c.aluno_nome)) {
        add(
          "teste_candidato",
          reg,
          `Nome do aluno "${c.aluno_nome}" sugere registro de teste`,
          "Um administrador deve confirmar e marcar como teste (não excluir)"
        );
      }
    }

    const motivos = (
      await q(
        "SELECT CAST(id AS NVARCHAR(50)) AS id, codigo, nome, filtro, ativo FROM dados.motivos"
      )
    ).recordset;
    for (const p of paresSemelhantes(motivos.map((m) => ({ ...m, ativo: Boolean(m.ativo) })))) {
      add(
        "motivos",
        `${p.a.codigo} x ${p.b.codigo}`,
        `${p.tipo}: "${p.a.nome}" x "${p.b.nome}"`,
        "Decidir se consolida (tela Motivos) ou mantém separados por contexto"
      );
    }

    const perfis = (await q("SELECT nome_completo, email, senha_hash, ativo FROM dados.perfis"))
      .recordset;
    for (const p of perfis) {
      if (!String(p.senha_hash).startsWith("$2"))
        add(
          "acesso",
          p.email,
          "Conta sem senha definida (valor provisório)",
          "Definir senha ou desativar"
        );
    }
    const cofre = (await q("SELECT COUNT(*) AS n FROM dados.credenciais_externas")).recordset[0].n;
    if (cofre > 0) {
      add(
        "cofre",
        `${cofre} credencial(is)`,
        "Credenciais gravadas pela versão anterior podem ser cópias reversíveis da senha de login",
        "Trocar as senhas de login dessas contas e recadastrar no cofre apenas a senha do PAD/AVA"
      );
    }
  } finally {
    await tx.rollback();
    await pool.close();
  }

  process.stdout.write(
    montarCsv(
      ["Categoria", "Registro", "Detalhe", "Ação sugerida"],
      achados.map((a) => [a.categoria, a.registro, a.detalhe, a.acao])
    )
  );
  const resumo = achados.reduce<Record<string, number>>(
    (acc, a) => ((acc[a.categoria] = (acc[a.categoria] ?? 0) + 1), acc),
    {}
  );
  console.error("Resumo:", JSON.stringify(resumo));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
