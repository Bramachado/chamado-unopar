"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario, comTransacao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { salvarArquivoLocal } from "@/lib/storage/anexos";

const chamadoSchema = z.object({
  protocolo: z
    .string()
    .trim()
    .regex(
      /^(CS\d{8}|CS\d{8}-\d{4})$/,
      "O protocolo deve seguir o padrão CSAAAAMMDD-NNNN (ex: CS20260902-0001) ou o formato histórico de 8 dígitos."
    )
    .optional()
    .nullable()
    .or(z.literal("")),
  aluno_nome: z.string().trim().min(3, "Informe o nome completo do aluno."),
  aluno_ra: z.string().trim().optional().nullable(),
  contato_telefone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val ? val.replace(/\D/g, "") : null)),
  motivo_id: z.string().uuid("Selecione um motivo válido do catálogo."),
  descricao: z.string().trim().optional().nullable(),
  situacao: z.enum(["aguardando", "concluido", "encerrado"] as const),
  prioridade: z.enum(["normal", "priorizar"] as const),
  data_solicitacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de solicitação inválida."),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de prazo inválida."),
  chamado_vinculado_id: z.string().uuid().optional().nullable().or(z.literal("")),
  observacao: z.string().trim().optional().nullable(),
});

export type EstadoSalvarChamado = {
  sucesso?: boolean;
  chamadoId?: string;
  erro?: string;
  errosCampo?: Record<string, string>;
};

/**
 * Gera atomicamente o próximo protocolo sequencial do dia chamando a procedure dados.gerar_protocolo.
 */
export async function gerarProximoProtocolo(dataSolicitacaoStr?: string): Promise<string> {
  const dataRef = dataSolicitacaoStr ? new Date(dataSolicitacaoStr) : new Date();
  const perfil = await obterPerfilAtual();

  return await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      const res = await req
        .input("data_solicitacao", sql.Date, dataRef)
        .output("protocolo_gerado", sql.VarChar(20))
        .execute("dados.gerar_protocolo");

      return res.output.protocolo_gerado;
    }
  );
}

export async function verificarProtocoloDuplicado(protocolo: string, chamadoAtualId?: string) {
  const limpo = protocolo.trim().toUpperCase();
  if (!limpo.match(/^(CS\d{8}|CS\d{8}-\d{4})$/)) {
    return null;
  }

  const perfil = await obterPerfilAtual();

  return await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      let sqlQuery = `
        SELECT 
          CAST(id AS NVARCHAR(50)) AS id,
          protocolo,
          criado_em,
          CAST(criado_por AS NVARCHAR(50)) AS criado_por,
          criado_por_nome
        FROM dados.chamados
        WHERE protocolo = @protocolo AND excluido_em IS NULL
      `;

      req.input("protocolo", sql.VarChar(30), limpo);

      if (chamadoAtualId) {
        req.input("atualId", sql.UniqueIdentifier, chamadoAtualId);
        sqlQuery += ` AND id != @atualId`;
      }

      const q = await req.query(sqlQuery);
      const data = q.recordset[0];

      if (!data) return null;

      return {
        duplicado: true,
        protocolo: data.protocolo,
        criado_em: data.criado_em,
        criado_por_nome: data.criado_por_nome || "Usuário do sistema",
      };
    }
  );
}

export async function buscarChamadosParaVinculo(termo: string) {
  if (!termo || termo.trim().length < 2) return [];

  const perfil = await obterPerfilAtual();
  const busca = termo.trim();

  return await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      req.input("termoBusca", sql.VarChar(255), `%${busca}%`);
      req.input("termoPrefixo", sql.VarChar(50), `${busca}%`);

      const q = await req.query(`
        SELECT TOP 10
          CAST(id AS NVARCHAR(50)) AS id,
          protocolo,
          aluno_nome,
          data_solicitacao,
          situacao
        FROM dados.chamados
        WHERE excluido_em IS NULL
          AND (protocolo LIKE @termoPrefixo OR aluno_nome LIKE @termoBusca)
        ORDER BY data_solicitacao DESC
      `);

      return q.recordset;
    }
  );
}

export async function salvarChamado(
  _estadoAnterior: EstadoSalvarChamado,
  formData: FormData
): Promise<EstadoSalvarChamado> {
  const perfil = await obterPerfilAtual();
  const chamadoId = formData.get("id") ? String(formData.get("id")) : undefined;

  const dadosBrutos = {
    protocolo: formData.get("protocolo") || null,
    aluno_nome: formData.get("aluno_nome"),
    aluno_ra: formData.get("aluno_ra") || null,
    contato_telefone: formData.get("contato_telefone") || null,
    motivo_id: formData.get("motivo_id"),
    descricao: formData.get("descricao") || null,
    situacao: formData.get("situacao") || "aguardando",
    prioridade: formData.get("prioridade") || "normal",
    data_solicitacao: formData.get("data_solicitacao"),
    prazo: formData.get("prazo"),
    chamado_vinculado_id: formData.get("chamado_vinculado_id") || null,
    observacao: formData.get("observacao") || null,
  };

  const parseResult = chamadoSchema.safeParse(dadosBrutos);
  if (!parseResult.success) {
    const errosCampo: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      if (issue.path[0]) {
        errosCampo[String(issue.path[0])] = issue.message;
      }
    }
    return {
      erro: "Corrija os erros apontados no formulário.",
      errosCampo,
    };
  }

  const payload = parseResult.data;

  // Se não foi fornecido protocolo válido, gera atomicamente
  let protocoloFinal = payload.protocolo;
  if (!protocoloFinal || protocoloFinal.trim() === "") {
    protocoloFinal = await gerarProximoProtocolo(payload.data_solicitacao);
  }

  // Verificação de protocolo duplicado
  const duplicado = await verificarProtocoloDuplicado(protocoloFinal, chamadoId);
  if (duplicado) {
    return {
      erro: `Protocolo ${protocoloFinal} já cadastrado por ${duplicado.criado_por_nome} em ${new Date(duplicado.criado_em).toLocaleDateString("pt-BR")}.`,
      errosCampo: {
        protocolo: `Já cadastrado por ${duplicado.criado_por_nome}.`,
      },
    };
  }

  let finalChamadoId = chamadoId;

  try {
    if (chamadoId) {
      // Atualização Colaborativa com rastreamento visível
      const dataConclusao = (payload.situacao === "concluido" || payload.situacao === "encerrado")
        ? new Date()
        : null;

      await comUsuario(
        { usuario_id: perfil.id, papel: perfil.papel },
        async (req) => {
          await req
            .input("id", sql.UniqueIdentifier, chamadoId)
            .input("aluno_nome", sql.VarChar(255), payload.aluno_nome)
            .input("aluno_ra", sql.VarChar(50), payload.aluno_ra || null)
            .input("contato_telefone", sql.VarChar(50), payload.contato_telefone || null)
            .input("motivo_id", sql.UniqueIdentifier, payload.motivo_id)
            .input("descricao", sql.NVarChar(sql.MAX), payload.descricao || null)
            .input("situacao", sql.VarChar(30), payload.situacao)
            .input("prioridade", sql.VarChar(20), payload.prioridade)
            .input("data_solicitacao", sql.DateTimeOffset, new Date(payload.data_solicitacao))
            .input("prazo", sql.DateTimeOffset, new Date(payload.prazo))
            .input("data_conclusao", sql.DateTimeOffset, dataConclusao)
            .input("chamado_vinculado_id", sql.UniqueIdentifier, payload.chamado_vinculado_id || null)
            .input("observacao", sql.NVarChar(sql.MAX), payload.observacao || null)
            .input("atualizado_por", sql.UniqueIdentifier, perfil.id)
            .input("atualizado_por_nome", sql.VarChar(255), perfil.nome_completo)
            .query(`
              UPDATE dados.chamados
              SET 
                aluno_nome = @aluno_nome,
                aluno_ra = @aluno_ra,
                contato_telefone = @contato_telefone,
                motivo_id = @motivo_id,
                descricao = @descricao,
                situacao = @situacao,
                prioridade = @prioridade,
                data_solicitacao = @data_solicitacao,
                prazo = @prazo,
                data_conclusao = @data_conclusao,
                chamado_vinculado_id = @chamado_vinculado_id,
                observacao = @observacao,
                atualizado_por = @atualizado_por,
                atualizado_por_nome = @atualizado_por_nome,
                atualizado_em = SYSUTCDATETIME()
              WHERE id = @id AND excluido_em IS NULL
            `);
        }
      );
    } else {
      // Criação inicial
      const dataConclusao = (payload.situacao === "concluido" || payload.situacao === "encerrado")
        ? new Date()
        : null;

      finalChamadoId = await comTransacao(
        { usuario_id: perfil.id, papel: perfil.papel },
        async (req) => {
          const q = await req
            .input("protocolo", sql.VarChar(30), protocoloFinal!)
            .input("aluno_nome", sql.VarChar(255), payload.aluno_nome)
            .input("aluno_ra", sql.VarChar(50), payload.aluno_ra || null)
            .input("contato_telefone", sql.VarChar(50), payload.contato_telefone || null)
            .input("motivo_id", sql.UniqueIdentifier, payload.motivo_id)
            .input("descricao", sql.NVarChar(sql.MAX), payload.descricao || null)
            .input("situacao", sql.VarChar(30), payload.situacao)
            .input("prioridade", sql.VarChar(20), payload.prioridade)
            .input("data_solicitacao", sql.DateTimeOffset, new Date(payload.data_solicitacao))
            .input("prazo", sql.DateTimeOffset, new Date(payload.prazo))
            .input("data_conclusao", sql.DateTimeOffset, dataConclusao)
            .input("chamado_vinculado_id", sql.UniqueIdentifier, payload.chamado_vinculado_id || null)
            .input("observacao", sql.NVarChar(sql.MAX), payload.observacao || null)
            .input("criado_por", sql.UniqueIdentifier, perfil.id)
            .input("criado_por_nome", sql.VarChar(255), perfil.nome_completo)
            .query(`
              DECLARE @out TABLE (id UNIQUEIDENTIFIER);

              INSERT INTO dados.chamados (
                protocolo,
                aluno_nome,
                aluno_ra,
                contato_telefone,
                motivo_id,
                descricao,
                situacao,
                prioridade,
                data_solicitacao,
                prazo,
                data_conclusao,
                chamado_vinculado_id,
                observacao,
                criado_por,
                criado_por_nome
              )
              OUTPUT inserted.id INTO @out(id)
              VALUES (
                @protocolo,
                @aluno_nome,
                @aluno_ra,
                @contato_telefone,
                @motivo_id,
                @descricao,
                @situacao,
                @prioridade,
                @data_solicitacao,
                @prazo,
                @data_conclusao,
                @chamado_vinculado_id,
                @observacao,
                @criado_por,
                @criado_por_nome
              );

              SELECT CAST(id AS NVARCHAR(50)) AS id FROM @out;
            `);

          return q.recordset[0]?.id;
        }
      );
    }

    // Processamento de múltiplos arquivos anexados no formulário
    const arquivos = formData.getAll("arquivos") as File[];
    if (finalChamadoId && arquivos && arquivos.length > 0) {
      for (const arq of arquivos) {
        if (arq && arq.size > 0 && arq.name) {
          await salvarArquivoLocal(finalChamadoId, arq, perfil);
        }
      }
    }

    revalidatePath("/chamados");
    if (finalChamadoId) {
      revalidatePath(`/chamados/${finalChamadoId}`);
    }

    return { sucesso: true, chamadoId: finalChamadoId };
  } catch (error: unknown) {
    console.error("[ERRO_SALVAR_CHAMADO]:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido ao salvar chamado.";
    return { erro: `Falha ao salvar chamado: ${msg}` };
  }
}

export async function anexarArquivoAction(formData: FormData) {
  const perfil = await obterPerfilAtual();
  const chamadoId = String(formData.get("chamado_id"));
  const descricao = String(formData.get("descricao") || "");
  const arquivos = formData.getAll("arquivos") as File[];

  if (!chamadoId || !arquivos || arquivos.length === 0) {
    return { sucesso: false, erro: "Nenhum arquivo informado." };
  }

  try {
    for (const arq of arquivos) {
      if (arq && arq.size > 0 && arq.name) {
        await salvarArquivoLocal(chamadoId, arq, perfil, descricao);
      }
    }

    // Atualiza metadados do chamado
    await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        await req
          .input("id", sql.UniqueIdentifier, chamadoId)
          .input("atualizado_por", sql.UniqueIdentifier, perfil.id)
          .input("atualizado_por_nome", sql.VarChar(255), perfil.nome_completo)
          .query(`
            UPDATE dados.chamados
            SET atualizado_por = @atualizado_por,
                atualizado_por_nome = @atualizado_por_nome,
                atualizado_em = SYSUTCDATETIME()
            WHERE id = @id AND excluido_em IS NULL
          `);
      }
    );

    revalidatePath(`/chamados/${chamadoId}`);
    return { sucesso: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Falha ao anexar arquivo.";
    return { sucesso: false, erro: msg };
  }
}

export async function excluirArquivoAction(arquivoId: string, chamadoId: string) {
  const perfil = await obterPerfilAtual();

  try {
    await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        await req
          .input("id", sql.UniqueIdentifier, arquivoId)
          .input("chamado_id", sql.UniqueIdentifier, chamadoId)
          .query(`
            DELETE FROM dados.arquivos_chamados
            WHERE id = @id AND chamado_id = @chamado_id
          `);
      }
    );

    revalidatePath(`/chamados/${chamadoId}`);
    return { sucesso: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao remover anexo.";
    return { sucesso: false, erro: msg };
  }
}

export async function excluirChamadoAction(id: string) {
  const perfil = await obterPerfilAtual();

  try {
    // Soft delete seguro via comUsuario (RLS e autoridade de admin ou criador)
    await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        const queryAdmin = perfil.papel === "admin"
          ? ""
          : " AND criado_por = @usuario_logado";

        req.input("id", sql.UniqueIdentifier, id);
        req.input("usuario_logado", sql.UniqueIdentifier, perfil.id);

        const res = await req.query(`
          UPDATE dados.chamados
          SET excluido_em = SYSUTCDATETIME(),
              excluido_por = @usuario_logado
          WHERE id = @id AND excluido_em IS NULL ${queryAdmin}
        `);

        if (res.rowsAffected[0] === 0) {
          throw new Error("Chamado não encontrado ou você não possui permissão para excluí-lo.");
        }
      }
    );

    revalidatePath("/chamados");
    return { sucesso: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao excluir chamado.";
    return { sucesso: false, erro: msg };
  }
}
