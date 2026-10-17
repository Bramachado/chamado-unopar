"use server";

import { revalidatePath } from "next/cache";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { ErroNegocio } from "@/lib/chamados/repositorio";
import { alternarStatusMotivo, consolidarMotivos, salvarMotivo } from "@/lib/motivos/servico";
import type { TipoSemelhanca } from "@/lib/motivos/normalizacao";

export type SimilaridadeResultado = {
  id: string;
  codigo: string;
  nome: string;
  filtro: string | null;
  tipo: TipoSemelhanca;
  similaridade: number;
};

export type EstadoSalvarMotivo = {
  sucesso?: boolean;
  motivoId?: string;
  erro?: string;
  similares?: SimilaridadeResultado[];
  requerConfirmacao?: boolean;
};

const revalidar = () => {
  revalidatePath("/motivos");
  revalidatePath("/chamados");
  revalidatePath("/chamados/novo");
};

export async function salvarMotivoAction(
  _estado: EstadoSalvarMotivo,
  formData: FormData
): Promise<EstadoSalvarMotivo> {
  const perfil = await obterPerfilAtual();
  const t = (k: string) => (typeof formData.get(k) === "string" ? String(formData.get(k)) : null);
  try {
    const r = await salvarMotivo(perfil, {
      id: t("id") || null,
      nome: t("nome") ?? "",
      filtro: t("filtro"),
      descricao: t("descricao"),
      confirmarSemelhante: t("confirmacao_forcada") === "true",
    });
    if (!r.ok) {
      return {
        erro: r.mensagem,
        requerConfirmacao: !r.semelhantes.some((s) => s.tipo === "duplicado_exato"),
        similares: r.semelhantes.map((s) => ({
          id: s.motivo.id,
          codigo: s.motivo.codigo,
          nome: s.motivo.nome,
          filtro: s.motivo.filtro,
          tipo: s.tipo,
          similaridade: s.similaridade,
        })),
      };
    }
    revalidar();
    return { sucesso: true, motivoId: r.id };
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message };
    console.error("[MOTIVOS] Falha ao salvar:", e instanceof Error ? e.message : e);
    return { erro: "Erro ao salvar motivo." };
  }
}

export async function alternarStatusMotivoAction(id: string, ativo: boolean) {
  const perfil = await obterPerfilAtual();
  try {
    await alternarStatusMotivo(perfil, id, ativo);
    revalidar();
    return { sucesso: true };
  } catch (e) {
    return {
      sucesso: false,
      erro: e instanceof ErroNegocio ? e.message : "Falha ao alterar status do motivo.",
    };
  }
}

export async function consolidarMotivosAction(
  origemId: string,
  destinoId: string,
  justificativa: string
) {
  const perfil = await obterPerfilAtual();
  try {
    const n = await consolidarMotivos(perfil, origemId, destinoId, justificativa);
    revalidar();
    return { sucesso: true as const, chamadosMovidos: n };
  } catch (e) {
    return {
      sucesso: false as const,
      erro: e instanceof ErroNegocio ? e.message : "Falha ao consolidar motivos.",
    };
  }
}
