import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";
import { comUsuario } from "@/lib/db/comUsuario";
import { getPool, sql } from "@/lib/db/pool";
import { type Perfil } from "@/types/database";

const DIRETORIO_ANEXOS = process.env.ANEXOS_DIR || path.join(process.cwd(), "anexos_storage");
const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB

const TIPOS_PERMITIDOS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export async function salvarArquivoLocal(
  chamadoId: string,
  arquivo: File,
  perfil: Perfil,
  descricao?: string
) {
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error("O arquivo excede o limite máximo permitido de 10 MB.");
  }

  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    throw new Error("Formato de arquivo não permitido. Use PDF, PNG, JPG ou XLSX.");
  }

  // Sanitização de nome e geração de caminho seguro
  const extensao =
    path
      .extname(arquivo.name)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "") || ".dat";
  const nomeSeguro = `${crypto.randomUUID()}${extensao}`;
  const pastaChamado = path.join(DIRETORIO_ANEXOS, chamadoId.replace(/[^a-zA-Z0-9-]/g, ""));
  const caminhoRelativo = `${chamadoId}/${nomeSeguro}`;
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  // 1. Gravação local em disco (como cache rápido, tolerando ambientes serverless read-only)
  try {
    await fs.mkdir(pastaChamado, { recursive: true });
    const caminhoCompletoDisco = path.join(pastaChamado, nomeSeguro);
    await fs.writeFile(caminhoCompletoDisco, buffer);
  } catch (fsErr) {
    console.warn(
      "[STORAGE] Não foi possível salvar em disco local (normal em serverless como Vercel):",
      fsErr instanceof Error ? fsErr.message : fsErr
    );
  }

  // 2. Registro de metadados no SQL Server via comUsuario
  const resultado = await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      const q = await req
        .input("chamado_id", sql.VarChar(50), chamadoId)
        .input("nome_original", sql.NVarChar(255), arquivo.name.slice(0, 255))
        .input("caminho_storage", sql.NVarChar(500), caminhoRelativo.slice(0, 500))
        .input("tamanho_bytes", sql.BigInt, arquivo.size)
        .input(
          "tipo_mime",
          sql.VarChar(100),
          (arquivo.type || "application/octet-stream").slice(0, 100)
        )
        .input("descricao", sql.NVarChar(255), descricao ? descricao.slice(0, 255) : null)
        .input("criado_por", sql.VarChar(50), perfil.id)
        .input("criado_por_nome", sql.NVarChar(200), (perfil.nome_completo || "").slice(0, 200))
        .query(`
          DECLARE @out TABLE (
            id UNIQUEIDENTIFIER,
            chamado_id UNIQUEIDENTIFIER,
            nome_original VARCHAR(255),
            caminho_storage VARCHAR(500),
            tamanho_bytes BIGINT,
            tipo_mime VARCHAR(100),
            descricao VARCHAR(255),
            criado_por UNIQUEIDENTIFIER,
            criado_por_nome VARCHAR(255),
            criado_em DATETIMEOFFSET
          );

          INSERT INTO dados.arquivos_chamados (
            chamado_id,
            nome_original,
            caminho_storage,
            tamanho_bytes,
            tipo_mime,
            descricao,
            criado_por,
            criado_por_nome
          )
          OUTPUT 
            inserted.id,
            inserted.chamado_id,
            inserted.nome_original,
            inserted.caminho_storage,
            inserted.tamanho_bytes,
            inserted.tipo_mime,
            inserted.descricao,
            inserted.criado_por,
            inserted.criado_por_nome,
            inserted.criado_em
          INTO @out
          VALUES (
            @chamado_id,
            @nome_original,
            @caminho_storage,
            @tamanho_bytes,
            @tipo_mime,
            @descricao,
            @criado_por,
            @criado_por_nome
          );

          SELECT 
            CAST(id AS NVARCHAR(50)) AS id,
            CAST(chamado_id AS NVARCHAR(50)) AS chamado_id,
            nome_original,
            caminho_storage,
            tamanho_bytes,
            tipo_mime,
            descricao,
            CAST(criado_por AS NVARCHAR(50)) AS criado_por,
            criado_por_nome,
            criado_em
          FROM @out;
        `);
      return q.recordset[0];
    }
  );

  // 3. Persistência dos bytes no banco de dados (resiliente para cloud/Vercel/serverless)
  if (resultado?.id) {
    try {
      const base64 = buffer.toString("base64");
      const payloadJson = JSON.stringify({ arquivo_base64: base64 });
      const pool = await getPool();
      await pool
        .request()
        .input("tabela", sql.VarChar(100), "arquivos_conteudo")
        .input("regId", sql.VarChar(50), resultado.id)
        .input("operacao", sql.VarChar(10), "INSERT")
        .input("dadosDepois", sql.NVarChar(sql.MAX), payloadJson)
        .input("origem", sql.VarChar(30), "anexo_storage")
        .input("uid", sql.VarChar(50), perfil.id)
        .input(
          "usuarioNome",
          sql.NVarChar(200),
          (perfil.nome_completo || "Colaboradora").slice(0, 200)
        ).query(`
          INSERT INTO auditoria.logs (
            tabela, registro_id, operacao, dados_depois, usuario_id, usuario_nome, origem, criado_em
          ) VALUES (
            @tabela, @regId, @operacao, @dadosDepois, @uid, @usuarioNome, @origem, SYSDATETIMEOFFSET()
          )
        `);
    } catch (dbErr) {
      console.error("[STORAGE] Erro ao persistir bytes do anexo no banco:", dbErr);
    }
  }

  return resultado;
}

export function obterCaminhoAbsolutoSeguro(caminhoRelativo: string): string {
  // Prevenção estrita contra Path Traversal
  const caminhoNormalizado = path.normalize(caminhoRelativo).replace(/^(\.\.(\/|\\|$))+/, "");
  const caminhoCompleto = path.join(DIRETORIO_ANEXOS, caminhoNormalizado);

  if (!caminhoCompleto.startsWith(path.resolve(DIRETORIO_ANEXOS))) {
    throw new Error("Acesso a caminho de arquivo não autorizado.");
  }

  return caminhoCompleto;
}

/**
 * Obtém os bytes do arquivo para download ou visualização.
 * Tenta primeiramente recuperar do banco de dados (nuvem/serverless),
 * com fallback para o sistema de arquivos local se disponível.
 */
export async function obterBufferArquivo(
  arquivoId: string,
  caminhoStorage: string
): Promise<Buffer | null> {
  // 1. Tentar recuperar do banco de dados (persistente entre instâncias Vercel / serverless)
  try {
    const pool = await getPool();
    const res = await pool.request().input("regId", sql.VarChar(50), arquivoId).query(`
        SELECT TOP 1 dados_depois
        FROM auditoria.logs
        WHERE tabela = 'arquivos_conteudo' AND registro_id = @regId
        ORDER BY id DESC
      `);

    if (res.recordset.length > 0 && res.recordset[0].dados_depois) {
      const parsed = JSON.parse(res.recordset[0].dados_depois);
      if (parsed.arquivo_base64) {
        return Buffer.from(parsed.arquivo_base64, "base64");
      }
    }
  } catch (err) {
    console.warn("[STORAGE] Falha ao recuperar arquivo do banco:", err);
  }

  // 2. Fallback para disco local caso exista
  try {
    const caminhoFisico = obterCaminhoAbsolutoSeguro(caminhoStorage);
    if (fsSync.existsSync(caminhoFisico)) {
      return fsSync.readFileSync(caminhoFisico);
    }
  } catch (err) {
    console.warn("[STORAGE] Falha ao recuperar arquivo do disco:", err);
  }

  return null;
}
