"use server";

import { revalidatePath } from "next/cache";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { lerEValidarArquivos } from "@/lib/storage/anexos";
import { escopoDeChamados } from "@/lib/auth/autorizacao";
import {
  ErroNegocio,
  anexarArquivos,
  atribuirResponsavel,
  excluirAnexo,
  excluirChamado,
  marcarComoTeste,
  registrarInteracao,
  salvarChamado as salvarChamadoServico,
  type EntradaChamado,
} from "@/lib/chamados/repositorio";
import { dataCivilDoBanco, instanteDoBanco } from "@/lib/datas";

export type EstadoSalvarChamado = {
  sucesso?: boolean;
  chamadoId?: string;
  erro?: string;
  conflito?: boolean;
  errosCampo?: Record<string, string>;
  alertas?: string[];
};

type ResultadoAcao =
  { sucesso: true } | { sucesso: false; erro: string; errosCampo?: Record<string, string> };

function falha(
  err: unknown,
  padrao: string
): { sucesso: false; erro: string; errosCampo?: Record<string, string> } {
  if (err instanceof ErroNegocio)
    return { sucesso: false, erro: err.message, errosCampo: err.errosCampo };
  console.error(`[CHAMADOS] ${padrao}:`, err instanceof Error ? err.message : err);
  return { sucesso: false, erro: padrao };
}

const texto = (fd: FormData, campo: string) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v : null;
};

export async function verificarProtocoloDuplicado(protocolo: string, chamadoAtualId?: string) {
  const limpo = protocolo.trim().toUpperCase();
  if (limpo.length < 5) return null;
  const perfil = await obterPerfilAtual();
  return comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
    req.input("protocolo", sql.VarChar(30), limpo);
    let consulta = `SELECT criado_por_nome, criado_em FROM dados.chamados WHERE protocolo = @protocolo AND excluido_em IS NULL`;
    if (chamadoAtualId) {
      req.input("atualId", sql.VarChar(50), chamadoAtualId);
      consulta += " AND id <> TRY_CAST(@atualId AS UNIQUEIDENTIFIER)";
    }
    const d = (await req.query(consulta)).recordset[0];
    if (!d) return null;
    return {
      duplicado: true,
      protocolo: limpo,
      criado_em: instanteDoBanco(d.criado_em),
      criado_por_nome: d.criado_por_nome || "Usuário do sistema",
    };
  });
}

/** Busca para vínculo de reincidência, restrita ao escopo de polo do usuário. */
export async function buscarChamadosParaVinculo(termo: string) {
  if (!termo || termo.trim().length < 2) return [];
  const perfil = await obterPerfilAtual();
  const busca = termo.trim();
  const escopo = escopoDeChamados(perfil);
  return comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
    req
      .input("termoBusca", sql.NVarChar(255), `%${busca}%`)
      .input("termoPrefixo", sql.VarChar(50), `${busca}%`);
    let filtroEscopo = "";
    if (escopo.tipo === "polo") {
      req.input("escopoPolo", sql.UniqueIdentifier, escopo.poloId);
      filtroEscopo = " AND c.polo_id = @escopoPolo";
    } else if (escopo.tipo === "proprios") {
      req.input("escopoUsuario", sql.UniqueIdentifier, escopo.usuarioId);
      filtroEscopo = " AND (c.criado_por = @escopoUsuario OR c.responsavel_id = @escopoUsuario)";
    }
    const q = await req.query(`
      SELECT TOP 10 CAST(c.id AS NVARCHAR(50)) AS id, c.protocolo, c.aluno_nome, c.situacao,
        CONVERT(CHAR(10), c.data_solicitacao, 23) AS data_solicitacao
      FROM dados.chamados c
      WHERE c.excluido_em IS NULL ${filtroEscopo}
        AND (c.protocolo LIKE @termoPrefixo OR c.aluno_nome LIKE @termoBusca OR c.aluno_ra LIKE @termoBusca)
      ORDER BY c.data_solicitacao DESC`);
    return q.recordset.map((r) => ({
      ...r,
      data_solicitacao: dataCivilDoBanco(r.data_solicitacao) ?? "",
    })) as {
      id: string;
      protocolo: string;
      aluno_nome: string;
      situacao: string;
      data_solicitacao: string;
    }[];
  });
}

export async function salvarChamado(
  _estadoAnterior: EstadoSalvarChamado,
  formData: FormData
): Promise<EstadoSalvarChamado> {
  const perfil = await obterPerfilAtual();
  const entrada: EntradaChamado = {
    id: texto(formData, "id"),
    versao: texto(formData, "versao"),
    protocolo: texto(formData, "protocolo"),
    aluno_nome: texto(formData, "aluno_nome") ?? "",
    aluno_ra: texto(formData, "aluno_ra"),
    confirmar_ra: texto(formData, "confirmar_ra") === "true",
    aluno_cpf: texto(formData, "aluno_cpf"),
    polo_id: texto(formData, "polo_id"),
    contato_telefone: texto(formData, "contato_telefone"),
    motivo_id: texto(formData, "motivo_id") ?? "",
    descricao: texto(formData, "descricao") ?? "",
    situacao: texto(formData, "situacao") ?? "aguardando",
    prioridade: (texto(formData, "prioridade") as "normal" | "priorizar") ?? "normal",
    data_solicitacao: texto(formData, "data_solicitacao") ?? "",
    prazo_modo: texto(formData, "prazo_modo") === "manual" ? "manual" : "automatico",
    prazo: texto(formData, "prazo"),
    prazo_justificativa: texto(formData, "prazo_justificativa"),
    chamado_vinculado_id: texto(formData, "chamado_vinculado_id"),
    observacao: texto(formData, "observacao"),
    resolucao: texto(formData, "resolucao"),
    motivo_encerramento: texto(formData, "motivo_encerramento"),
    justificativa_situacao: texto(formData, "justificativa_situacao"),
    proxima_acao: texto(formData, "proxima_acao"),
    proxima_acao_em: texto(formData, "proxima_acao_em"),
    status_externo: texto(formData, "status_externo"),
  };

  try {
    const arquivos = await lerEValidarArquivos(formData.getAll("arquivos") as File[]);
    const r = await salvarChamadoServico(perfil, entrada, arquivos);
    revalidatePath("/chamados");
    revalidatePath(`/chamados/${r.chamadoId}`);
    return { sucesso: true, chamadoId: r.chamadoId, alertas: r.alertas };
  } catch (err) {
    if (err instanceof ErroNegocio) {
      return { erro: err.message, errosCampo: err.errosCampo, conflito: err.codigo === "conflito" };
    }
    if (err instanceof Error && /anexo|arquivo|formato|conteúdo|10 MB|máximo/i.test(err.message)) {
      return { erro: err.message, errosCampo: { arquivos: err.message } };
    }
    console.error("[CHAMADOS] Falha ao salvar:", err instanceof Error ? err.message : err);
    return {
      erro: "Não foi possível salvar o chamado. Tente novamente; se persistir, avise a administração.",
    };
  }
}

export async function anexarArquivoAction(formData: FormData): Promise<ResultadoAcao> {
  const perfil = await obterPerfilAtual();
  const chamadoId = texto(formData, "chamado_id") ?? "";
  try {
    const arquivos = await lerEValidarArquivos(formData.getAll("arquivos") as File[]);
    await anexarArquivos(perfil, chamadoId, arquivos, texto(formData, "descricao"));
    revalidatePath(`/chamados/${chamadoId}`);
    return { sucesso: true };
  } catch (err) {
    if (err instanceof Error && !(err instanceof ErroNegocio))
      return { sucesso: false, erro: err.message };
    return falha(err, "Falha ao anexar arquivo.");
  }
}

export async function excluirArquivoAction(arquivoId: string): Promise<ResultadoAcao> {
  const perfil = await obterPerfilAtual();
  try {
    const chamadoId = await excluirAnexo(perfil, arquivoId);
    revalidatePath(`/chamados/${chamadoId}`);
    return { sucesso: true };
  } catch (err) {
    return falha(err, "Erro ao remover anexo.");
  }
}

export async function excluirChamadoAction(id: string): Promise<ResultadoAcao> {
  const perfil = await obterPerfilAtual();
  try {
    await excluirChamado(perfil, id);
    revalidatePath("/chamados");
    return { sucesso: true };
  } catch (err) {
    return falha(err, "Erro ao excluir chamado.");
  }
}

export async function atribuirResponsavelAction(
  chamadoId: string,
  responsavelId: string,
  justificativa: string | null
): Promise<ResultadoAcao> {
  const perfil = await obterPerfilAtual();
  try {
    await atribuirResponsavel(perfil, chamadoId, responsavelId, justificativa);
    revalidatePath(`/chamados/${chamadoId}`);
    return { sucesso: true };
  } catch (err) {
    return falha(err, "Não foi possível alterar o responsável.");
  }
}

export async function registrarInteracaoAction(
  chamadoId: string,
  dados: { texto: string; proxima_acao?: string | null; proxima_acao_em?: string | null }
): Promise<ResultadoAcao> {
  const perfil = await obterPerfilAtual();
  try {
    await registrarInteracao(perfil, chamadoId, dados);
    revalidatePath(`/chamados/${chamadoId}`);
    return { sucesso: true };
  } catch (err) {
    return falha(err, "Não foi possível registrar a interação.");
  }
}

export async function marcarComoTesteAction(
  chamadoId: string,
  ehTeste: boolean,
  justificativa: string
): Promise<ResultadoAcao> {
  const perfil = await obterPerfilAtual();
  try {
    await marcarComoTeste(perfil, chamadoId, ehTeste, justificativa);
    revalidatePath(`/chamados/${chamadoId}`);
    revalidatePath("/painel");
    return { sucesso: true };
  } catch (err) {
    return falha(err, "Não foi possível alterar a marcação de teste.");
  }
}
