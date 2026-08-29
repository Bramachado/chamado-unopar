"use server";

import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { type SituacaoChamado, type PrioridadeChamado } from "@/types/database";
import { revalidatePath } from "next/cache";

const chamadoSchema = z.object({
  protocolo: z
    .string()
    .trim()
    .regex(/^CS[0-9]{8}$/, "O protocolo deve seguir rigorosamente o padrão CS seguido de 8 dígitos (ex: CS12345678)."),
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

export async function verificarProtocoloDuplicado(protocolo: string, chamadoAtualId?: string) {
  const supabase = await criarClienteServidor();
  const limpo = protocolo.trim().toUpperCase();

  if (!limpo.match(/^CS[0-9]{8}$/)) {
    return null;
  }

  let query = supabase
    .from("chamados")
    .select("id, protocolo, criado_em, criado_por, perfis:criado_por(nome_completo)")
    .eq("protocolo", limpo)
    .is("excluido_em", null);

  if (chamadoAtualId) {
    query = query.neq("id", chamadoAtualId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  const criadoPorNome = (data.perfis as unknown as { nome_completo?: string })?.nome_completo || "Usuária do sistema";

  return {
    duplicado: true,
    protocolo: data.protocolo,
    criado_em: data.criado_em,
    criado_por_nome: criadoPorNome,
  };
}

export async function buscarChamadosParaVinculo(termo: string) {
  if (!termo || termo.trim().length < 2) return [];

  const supabase = await criarClienteServidor();
  const busca = termo.trim();

  let query = supabase
    .from("chamados")
    .select("id, protocolo, aluno_nome, data_solicitacao, situacao")
    .is("excluido_em", null)
    .limit(10);

  if (busca.match(/^CS[0-9]{1,8}$/i)) {
    query = query.ilike("protocolo", `${busca}%`);
  } else {
    query = query.ilike("aluno_nome", `%${busca}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data;
}

export async function salvarChamado(
  _estadoAnterior: EstadoSalvarChamado,
  formData: FormData
): Promise<EstadoSalvarChamado> {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { erro: "Sessão expirada. Autentique-se novamente." };
  }

  const chamadoId = formData.get("id") ? String(formData.get("id")) : undefined;

  const dadosBrutos = {
    protocolo: formData.get("protocolo"),
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

  // Verificação de protocolo duplicado
  const duplicado = await verificarProtocoloDuplicado(payload.protocolo, chamadoId);
  if (duplicado) {
    return {
      erro: `Protocolo ${payload.protocolo} já cadastrado por ${duplicado.criado_por_nome} em ${new Date(duplicado.criado_em).toLocaleDateString("pt-BR")}.`,
      errosCampo: {
        protocolo: `Já cadastrado por ${duplicado.criado_por_nome}.`,
      },
    };
  }

  let finalChamadoId = chamadoId;

  if (chamadoId) {
    // Atualização Colaborativa: registra quem fez a edição e data_conclusao se for concluído
    const dataConclusao = (payload.situacao === "concluido" || payload.situacao === "encerrado")
      ? new Date().toISOString()
      : null;

    const { error } = await supabase
      .from("chamados")
      .update({
        aluno_nome: payload.aluno_nome,
        aluno_ra: payload.aluno_ra,
        contato_telefone: payload.contato_telefone,
        motivo_id: payload.motivo_id,
        descricao: payload.descricao,
        situacao: payload.situacao as SituacaoChamado,
        prioridade: payload.prioridade as PrioridadeChamado,
        data_solicitacao: payload.data_solicitacao,
        prazo: payload.prazo,
        data_conclusao: dataConclusao,
        chamado_vinculado_id: payload.chamado_vinculado_id ? payload.chamado_vinculado_id : null,
        observacao: payload.observacao,
        atualizado_por: user.id,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", chamadoId);

    if (error) {
      return { erro: `Erro ao atualizar chamado: ${error.message}` };
    }
  } else {
    // Criação inicial
    const dataConclusao = (payload.situacao === "concluido" || payload.situacao === "encerrado")
      ? new Date().toISOString()
      : null;

    const { data, error } = await supabase
      .from("chamados")
      .insert({
        protocolo: payload.protocolo,
        aluno_nome: payload.aluno_nome,
        aluno_ra: payload.aluno_ra,
        contato_telefone: payload.contato_telefone,
        motivo_id: payload.motivo_id,
        descricao: payload.descricao,
        situacao: payload.situacao as SituacaoChamado,
        prioridade: payload.prioridade as PrioridadeChamado,
        data_solicitacao: payload.data_solicitacao,
        prazo: payload.prazo,
        data_conclusao: dataConclusao,
        chamado_vinculado_id: payload.chamado_vinculado_id ? payload.chamado_vinculado_id : null,
        observacao: payload.observacao,
        criado_por: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { erro: `Erro ao cadastrar chamado: ${error?.message || "falha desconhecida"}` };
    }

    finalChamadoId = data.id;
  }

  // Upload e vinculação de arquivos enviados no formulário
  const arquivos = formData.getAll("arquivos") as File[];
  if (finalChamadoId && arquivos && arquivos.length > 0) {
    for (const arq of arquivos) {
      if (arq && arq.size > 0 && arq.name) {
        const nomeSanitizado = arq.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const caminhoStorage = `${finalChamadoId}/${Date.now()}_${nomeSanitizado}`;

        // Inserir registro na tabela public.arquivos
        await supabase.from("arquivos").insert({
          chamado_id: finalChamadoId,
          nome_original: arq.name,
          caminho_storage: caminhoStorage,
          tamanho_bytes: arq.size,
          tipo_mime: arq.type || "application/octet-stream",
          criado_por: user.id,
        });
      }
    }
  }

  revalidatePath("/chamados");
  if (finalChamadoId) {
    revalidatePath(`/chamados/${finalChamadoId}`);
  }

  return { sucesso: true, chamadoId: finalChamadoId };
}

export async function anexarArquivoAction(formData: FormData) {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { sucesso: false, erro: "Sessão expirada." };
  }

  const chamadoId = String(formData.get("chamado_id"));
  const descricao = String(formData.get("descricao") || "");
  const arquivos = formData.getAll("arquivos") as File[];

  if (!chamadoId || !arquivos || arquivos.length === 0) {
    return { sucesso: false, erro: "Nenhum arquivo informado." };
  }

  for (const arq of arquivos) {
    if (arq && arq.size > 0 && arq.name) {
      const nomeSanitizado = arq.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const caminhoStorage = `${chamadoId}/${Date.now()}_${nomeSanitizado}`;

      await supabase.from("arquivos").insert({
        chamado_id: chamadoId,
        nome_original: arq.name,
        caminho_storage: caminhoStorage,
        tamanho_bytes: arq.size,
        tipo_mime: arq.type || "application/octet-stream",
        descricao: descricao || null,
        criado_por: user.id,
      });
    }
  }

  // Atualiza timestamp do chamado
  await supabase
    .from("chamados")
    .update({
      atualizado_por: user.id,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", chamadoId);

  revalidatePath(`/chamados/${chamadoId}`);
  return { sucesso: true };
}

export async function excluirArquivoAction(arquivoId: string, chamadoId: string) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("arquivos").delete().eq("id", arquivoId);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath(`/chamados/${chamadoId}`);
  return { sucesso: true };
}

export async function excluirChamadoAction(id: string) {
  const supabase = await criarClienteServidor();

  // Executa a RPC segura de soft delete (apenas autor ou admin)
  const { error } = await supabase.rpc("excluir_chamado", { p_id: id });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/chamados");
  return { sucesso: true };
}
