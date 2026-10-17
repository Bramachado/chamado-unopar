import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { autenticarAgente } from "@/lib/agente/auth";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { formatarInstante } from "@/lib/datas";
import {
  SITUACOES,
  dataConclusaoAposTransicao,
  validarTransicao,
  type Situacao,
} from "@/lib/chamados/situacoes";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

const atualizarSchema = z
  .object({
    // Protocolo do PAD (C…/CS…) gravado após a abertura no PAD
    protocolo: z
      .string()
      .trim()
      .regex(/^(CS\d{8}|CS\d{8}-\d{4}|C\d{6,14}|[A-Za-z0-9\-]{5,20})$/, "Protocolo inválido.")
      .optional(),
    situacao: z.enum(SITUACOES).optional(),
    // Obrigatórios conforme a transição (mesma regra da tela): resolução ao resolver,
    // motivo ao encerrar sem solução e justificativa ao reabrir.
    resolucao: z.string().trim().max(8000).optional(),
    motivo_encerramento: z.string().trim().max(40).optional(),
    justificativa: z.string().trim().max(1000).optional(),
    status_externo: z.string().trim().max(120).optional(),
    // Texto acrescentado ao histórico do chamado (ex.: "PAD: status Em andamento — resposta …")
    observacao_adicionar: z.string().trim().min(1).max(4000).optional(),
  })
  .refine(
    (d) => d.protocolo || d.situacao || d.observacao_adicionar || d.status_externo,
    "Nada para atualizar."
  );

/**
 * PATCH /api/agente/chamados/:id
 * Atualização pelo agente: protocolo do PAD, situação (com as mesmas transições e campos
 * obrigatórios da tela), status externo e registro do andamento no histórico.
 * Não altera dados do aluno, motivo ou prazo.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await autenticarAgente(request);
    if ("resposta" in auth) return auth.resposta;
    const { perfil } = auth;

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
    }

    const corpo = await request.json().catch(() => null);
    const parse = atualizarSchema.safeParse(corpo);
    if (!parse.success) {
      return NextResponse.json(
        { erro: "Dados inválidos.", detalhes: parse.error.flatten() },
        { status: 400 }
      );
    }
    const dados = parse.data;
    const protocolo = dados.protocolo?.toUpperCase() || null;

    const resultado = await comTransacao(
      { usuario_id: perfil.id, papel: perfil.papel, ip: null },
      async (_req, tx) => {
        const atualQ = await novaRequisicao(tx)
          .input("id", sql.UniqueIdentifier, id)
          .query(
            "SELECT situacao, data_conclusao, observacao FROM dados.chamados WITH (UPDLOCK, ROWLOCK) WHERE id = @id AND excluido_em IS NULL"
          );
        const atual = atualQ.recordset[0];
        if (!atual) return { tipo: "nao_encontrado" as const };

        if (protocolo) {
          const dup = await novaRequisicao(tx)
            .input("p", sql.VarChar(30), protocolo)
            .input("id", sql.UniqueIdentifier, id)
            .query(
              "SELECT 1 AS existe FROM dados.chamados WHERE protocolo = @p AND id <> @id AND excluido_em IS NULL"
            );
          if (dup.recordset[0]) return { tipo: "duplicado" as const };
        }

        const de = atual.situacao as Situacao;
        const para = (dados.situacao ?? de) as Situacao;
        const trans = validarTransicao(de, para, {
          resolucao: dados.resolucao,
          motivo_encerramento: dados.motivo_encerramento,
          justificativa: dados.justificativa,
        });
        if (!trans.ok) return { tipo: "invalido" as const, erro: trans.erro, campo: trans.campo };

        const agora = new Date().toISOString();
        const conclusaoAtual = atual.data_conclusao
          ? new Date(atual.data_conclusao).toISOString()
          : null;
        const dataConclusao = dataConclusaoAposTransicao(de, para, conclusaoAtual, agora);
        const linhaObservacao = dados.observacao_adicionar
          ? `[${formatarInstante(agora)} · ${perfil.nome_completo}] ${dados.observacao_adicionar}`
          : null;

        await novaRequisicao(tx)
          .input("id", sql.UniqueIdentifier, id)
          .input("protocolo", sql.VarChar(20), protocolo)
          .input("situacao", sql.VarChar(20), para)
          .input("de", sql.VarChar(20), de)
          .input(
            "data_conclusao",
            sql.DateTimeOffset,
            dataConclusao ? new Date(dataConclusao) : null
          )
          .input(
            "resolucao",
            sql.NVarChar(sql.MAX),
            para === "concluido" ? (dados.resolucao ?? null) : null
          )
          .input(
            "motivo_enc",
            sql.VarChar(40),
            para === "encerrado" ? (dados.motivo_encerramento ?? null) : null
          )
          .input("mudou", sql.Bit, para !== de)
          .input("reabertura", sql.Int, trans.ehReabertura ? 1 : 0)
          .input("status_externo", sql.NVarChar(120), dados.status_externo ?? null)
          .input("linha", sql.NVarChar(sql.MAX), linhaObservacao)
          .input("por", sql.UniqueIdentifier, perfil.id)
          .input("por_nome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200)).query(`
          UPDATE dados.chamados SET
            protocolo = COALESCE(@protocolo, protocolo),
            situacao = @situacao,
            data_conclusao = @data_conclusao,
            resolucao = CASE WHEN @mudou = 1 THEN @resolucao ELSE resolucao END,
            motivo_encerramento = CASE WHEN @mudou = 1 THEN @motivo_enc ELSE motivo_encerramento END,
            reaberturas = reaberturas + @reabertura,
            status_externo = COALESCE(@status_externo, status_externo),
            observacao = CASE
              WHEN @linha IS NULL THEN observacao
              WHEN observacao IS NULL OR LTRIM(RTRIM(observacao)) = '' THEN @linha
              ELSE observacao + CHAR(10) + @linha END,
            ultima_interacao_em = SYSDATETIMEOFFSET(),
            atualizado_por = @por, atualizado_por_nome = @por_nome, atualizado_em = SYSDATETIMEOFFSET()
          WHERE id = @id;

          IF @mudou = 1
            INSERT INTO dados.chamado_eventos (chamado_id, tipo, situacao_anterior, situacao_nova, texto, criado_por, criado_por_nome)
            VALUES (@id, CASE WHEN @reabertura = 1 THEN 'reabertura' ELSE 'situacao' END, @de, @situacao,
                    COALESCE(@resolucao, @motivo_enc, @linha), @por, @por_nome);
          IF @linha IS NOT NULL
            INSERT INTO dados.chamado_eventos (chamado_id, tipo, texto, criado_por, criado_por_nome)
            VALUES (@id, 'interacao', @linha, @por, @por_nome);`);
        return { tipo: "ok" as const };
      }
    );

    if (resultado.tipo === "duplicado") {
      return NextResponse.json({ erro: "Protocolo já usado em outro chamado." }, { status: 409 });
    }
    if (resultado.tipo === "nao_encontrado") {
      return NextResponse.json({ erro: "Chamado não encontrado." }, { status: 404 });
    }
    if (resultado.tipo === "invalido") {
      return NextResponse.json({ erro: resultado.erro, campo: resultado.campo }, { status: 422 });
    }
    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error("[ERRO_API_AGENTE_ATUALIZAR]:", error instanceof Error ? error.message : error);
    return NextResponse.json({ erro: "Erro ao atualizar chamado." }, { status: 500 });
  }
}
