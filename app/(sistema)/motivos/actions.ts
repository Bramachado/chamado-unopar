"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario, comTransacao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";

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

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function verificarSimilaridade(nome: string): Promise<SimilaridadeResultado[]> {
  if (!nome || nome.trim().length < 3) return [];

  const perfil = await obterPerfilAtual();
  const normalizado = normalizarTexto(nome);

  return await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      req.input("termo", sql.VarChar(255), `%${normalizado}%`);
      const q = await req.query(`
        SELECT TOP 5
          CAST(id AS NVARCHAR(50)) AS id,
          codigo,
          nome,
          1.0 AS similaridade
        FROM dados.motivos
        WHERE nome_normalizado LIKE @termo OR @termo LIKE '%' + nome_normalizado + '%'
      `);
      return q.recordset;
    }
  );
}

export async function salvarMotivoAction(
  _estadoAnterior: EstadoSalvarMotivo,
  formData: FormData
): Promise<EstadoSalvarMotivo> {
  const perfil = await obterPerfilAtual();
  const nome = String(formData.get("nome") || "");
  const confirmacaoForcada = formData.get("confirmacao_forcada") === "true";

  const parseResult = motivoSchema.safeParse({ nome });
  if (!parseResult.success) {
    return { erro: parseResult.error.issues[0]?.message || "Nome inválido." };
  }

  const nomeLimpo = parseResult.data.nome;
  const nomeNormalizado = normalizarTexto(nomeLimpo);

  // Se não foi confirmação forçada, verifica similaridade
  if (!confirmacaoForcada) {
    const similares = await verificarSimilaridade(nomeLimpo);
    if (similares.length > 0) {
      return {
        requerConfirmacao: true,
        similares,
        erro: `Identificamos ${similares.length} motivo(s) similar(es) no catálogo. Verifique antes de cadastrar.`,
      };
    }
  }

  try {
    const motivoId = await comTransacao(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        // Verifica duplicata exata
        req.input("nomeNormalizado", sql.VarChar(255), nomeNormalizado);
        const dup = await req.query(`
          SELECT id FROM dados.motivos WHERE nome_normalizado = @nomeNormalizado
        `);
        if (dup.recordset.length > 0) {
          throw new Error("Já existe exatamente este mesmo motivo cadastrado no catálogo.");
        }

        // Obtém próximo número sequencial
        const qNum = await req.query(`
          SELECT ISNULL(MAX(numero), 0) + 1 AS proximo FROM dados.motivos WITH (UPDLOCK, HOLDLOCK)
        `);
        const proximoNumero = qNum.recordset[0]?.proximo || 1;
        const codigoFormatado = `#${String(proximoNumero).padStart(2, "0")}`;

        req.input("numero", sql.Int, proximoNumero);
        req.input("codigo", sql.VarChar(10), codigoFormatado);
        req.input("nome", sql.VarChar(255), nomeLimpo);
        req.input("criado_por", sql.UniqueIdentifier, perfil.id);

        const qInsert = await req.query(`
          INSERT INTO dados.motivos (
            numero,
            codigo,
            nome,
            nome_normalizado,
            ativo,
            criado_por
          )
          OUTPUT CAST(inserted.id AS NVARCHAR(50)) AS id
          VALUES (
            @numero,
            @codigo,
            @nome,
            @nomeNormalizado,
            1,
            @criado_por
          )
        `);

        return qInsert.recordset[0]?.id;
      }
    );

    revalidatePath("/motivos");
    revalidatePath("/chamados/novo");
    return { sucesso: true, motivoId };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro ao cadastrar motivo.";
    return { erro: msg };
  }
}

export async function alternarStatusMotivoAction(id: string, ativo: boolean) {
  const perfil = await obterPerfilAtual();

  try {
    await comUsuario(
      { usuario_id: perfil.id, papel: perfil.papel },
      async (req) => {
        req.input("id", sql.UniqueIdentifier, id);
        req.input("ativo", sql.Bit, ativo ? 1 : 0);
        await req.query(`
          UPDATE dados.motivos
          SET ativo = @ativo
          WHERE id = @id
        `);
      }
    );

    revalidatePath("/motivos");
    return { sucesso: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Falha ao alterar status do motivo.";
    return { sucesso: false, erro: msg };
  }
}
