"use server";

import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const motivoSchema = z.object({
  nome: z.string().trim().min(3, "O nome do motivo deve conter pelo menos 3 caracteres."),
});

export type SimilaridadeResultado = {
  id: string;
  codigo: string;
  nome: string;
  similaridade: number;
};

export type EstadoSalvarMotivo = {
  sucesso?: boolean;
  motivoId?: string;
  erro?: string;
  similares?: SimilaridadeResultado[];
  requerConfirmacao?: boolean;
};

export async function verificarSimilaridade(nome: string): Promise<SimilaridadeResultado[]> {
  if (!nome || nome.trim().length < 3) return [];

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("verificar_motivo_similar", {
    p_nome: nome.trim(),
  });

  if (error || !data) {
    return [];
  }

  return data as SimilaridadeResultado[];
}

export async function salvarMotivoAction(
  _estadoAnterior: EstadoSalvarMotivo,
  formData: FormData
): Promise<EstadoSalvarMotivo> {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { erro: "Sessão expirada. Faça login novamente." };
  }

  const nome = String(formData.get("nome") || "");
  const confirmacaoForcada = formData.get("confirmacao_forcada") === "true";

  const parseResult = motivoSchema.safeParse({ nome });
  if (!parseResult.success) {
    return { erro: parseResult.error.issues[0]?.message || "Nome inválido." };
  }

  // Se não foi confirmação forçada, verifica similaridade
  if (!confirmacaoForcada) {
    const similares = await verificarSimilaridade(nome);
    if (similares.length > 0) {
      return {
        requerConfirmacao: true,
        similares,
        erro: `Identificamos ${similares.length} motivo(s) similar(es) já cadastrado(s). Verifique antes de continuar.`,
      };
    }
  }

  // Tentar inserir no banco
  const { data, error } = await supabase
    .from("motivos")
    .insert({
      nome: nome.trim(),
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        erro: "Já existe exatamente este mesmo motivo cadastrado no catálogo (duplicata rejeitada pela regra de normalização do banco).",
      };
    }
    return { erro: `Erro ao cadastrar motivo: ${error.message}` };
  }

  revalidatePath("/motivos");
  revalidatePath("/chamados/novo");
  return { sucesso: true, motivoId: data.id };
}

export async function alternarStatusMotivoAction(id: string, ativo: boolean) {
  const supabase = await criarClienteServidor();

  const { error } = await supabase
    .from("motivos")
    .update({ ativo })
    .eq("id", id);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/motivos");
  return { sucesso: true };
}
