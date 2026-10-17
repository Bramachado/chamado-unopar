import { type NextRequest, NextResponse } from "next/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { COLUNAS_CHAMADO, JUNCOES_CHAMADO, mapearChamado } from "@/lib/chamados/repositorio";
import { lerFiltros, montarWhere } from "@/lib/chamados/filtros";
import { formatarDataCivil, formatarInstante, hojeCivil } from "@/lib/datas";
import { classificarPrazo } from "@/lib/sla";
import {
  ROTULO_SITUACAO,
  ehPendente,
  ehSituacao,
  MOTIVOS_ENCERRAMENTO,
} from "@/lib/chamados/situacoes";
import { formatarCpf } from "@/lib/utils/cpf";
import { formatarTelefone } from "@/lib/utils/telefone";
import { montarCsv } from "@/lib/utils/csv";

const LIMITE_LINHAS = 20_000;

/**
 * Exportação CSV com EXATAMENTE os mesmos filtros e escopo de autorização da listagem
 * (lib/chamados/filtros.ts) — sem paginação. A exportação é registrada na auditoria.
 */
export async function GET(request: NextRequest) {
  const perfil = await obterPerfilAtual();
  const filtros = lerFiltros(request.nextUrl.searchParams, perfil);
  const hoje = hojeCivil();

  const linhas = await comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (_req, tx) => {
      const req = novaRequisicao(tx);
      const where = montarWhere(req, perfil, filtros, hoje);
      req.input("limite", sql.Int, LIMITE_LINHAS + 1);
      const q = await req.query(`
      SELECT TOP (@limite) ${COLUNAS_CHAMADO}
      FROM dados.chamados c
      ${JUNCOES_CHAMADO}
      ${where}
      ORDER BY c.data_solicitacao DESC, c.criado_em DESC`);
      await novaRequisicao(tx)
        .input(
          "dados",
          sql.NVarChar(sql.MAX),
          JSON.stringify({ filtros: { ...filtros, pagina: undefined }, linhas: q.recordset.length })
        )
        .input("uid", sql.UniqueIdentifier, perfil.id)
        .input("unome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200)).query(`
        INSERT INTO auditoria.logs (tabela, operacao, dados_depois, usuario_id, usuario_nome, ip, origem)
        VALUES ('exportacao_chamados', 'INSERT', @dados, @uid, @unome, CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45)), 'exportacao')`);
      return q.recordset.map(mapearChamado);
    }
  );

  if (linhas.length > LIMITE_LINHAS) {
    return NextResponse.json(
      {
        erro: `A exportação excede ${LIMITE_LINHAS} linhas. Refine os filtros (ex.: período de abertura).`,
      },
      { status: 413 }
    );
  }

  const cabecalho = [
    "Protocolo",
    "Aluno",
    "CPF",
    "RA",
    "Polo",
    "Cidade",
    "Telefone",
    "Código Motivo",
    "Motivo",
    "Situação",
    "Prioridade",
    "Abertura",
    "Prazo",
    "Prazo ajustado manualmente",
    "Situação do prazo",
    "Conclusão/encerramento",
    "Responsável atual",
    "Aberto por",
    "Resolução / motivo do encerramento",
    "Status externo",
    "Descrição",
    "Observação",
  ];
  const corpo = linhas.map((c) => [
    c.protocolo,
    c.aluno_nome,
    c.aluno_cpf ? formatarCpf(c.aluno_cpf) : "",
    c.aluno_ra ?? "",
    c.polo_nome ?? "",
    c.polo_cidade ?? "",
    c.contato_telefone ? formatarTelefone(c.contato_telefone) : "",
    c.motivo_codigo ?? "",
    c.motivo_nome ?? "",
    ehSituacao(c.situacao) ? ROTULO_SITUACAO[c.situacao] : c.situacao,
    c.prioridade === "priorizar" ? "Priorizar" : "Normal",
    formatarDataCivil(c.data_solicitacao),
    formatarDataCivil(c.prazo),
    c.prazo_ajuste_manual ? "Sim" : "Não",
    ehPendente(c.situacao) ? classificarPrazo(c.prazo, hoje).replace(/_/g, " ") : "finalizado",
    c.data_conclusao ? formatarInstante(c.data_conclusao) : "",
    c.responsavel_nome ?? "",
    c.criado_por_nome ?? "",
    c.situacao === "concluido"
      ? (c.resolucao ?? "")
      : c.situacao === "encerrado"
        ? (MOTIVOS_ENCERRAMENTO[c.motivo_encerramento as keyof typeof MOTIVOS_ENCERRAMENTO] ??
          c.motivo_encerramento ??
          "")
        : "",
    c.status_externo ?? "",
    c.descricao ?? "",
    c.observacao ?? "",
  ]);

  const carimbo = formatarInstante(new Date(), { segundos: true }).replace(/[/: ]/g, "");
  return new NextResponse(montarCsv(cabecalho, corpo), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="chamados_${carimbo}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
