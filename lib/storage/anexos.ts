import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
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
  const extensao = path.extname(arquivo.name).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".dat";
  const nomeSeguro = `${crypto.randomUUID()}${extensao}`;
  const pastaChamado = path.join(DIRETORIO_ANEXOS, chamadoId.replace(/[^a-zA-Z0-9-]/g, ""));

  await fs.mkdir(pastaChamado, { recursive: true });

  const caminhoCompletoDisco = path.join(pastaChamado, nomeSeguro);
  const caminhoRelativo = `${chamadoId}/${nomeSeguro}`;

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  await fs.writeFile(caminhoCompletoDisco, buffer);

  // Registro de metadados no SQL Server via comUsuario
  const resultado = await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      const q = await req
        .input("chamado_id", sql.UniqueIdentifier, chamadoId)
        .input("nome_original", sql.VarChar(255), arquivo.name.slice(0, 255))
        .input("caminho_storage", sql.VarChar(500), caminhoRelativo)
        .input("tamanho_bytes", sql.BigInt, arquivo.size)
        .input("tipo_mime", sql.VarChar(100), arquivo.type)
        .input("descricao", sql.VarChar(255), descricao ? descricao.slice(0, 255) : null)
        .input("criado_por", sql.UniqueIdentifier, perfil.id)
        .input("criado_por_nome", sql.VarChar(255), perfil.nome_completo)
        .query(`
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
            CAST(inserted.id AS NVARCHAR(50)) AS id,
            CAST(inserted.chamado_id AS NVARCHAR(50)) AS chamado_id,
            inserted.nome_original,
            inserted.caminho_storage,
            inserted.tamanho_bytes,
            inserted.tipo_mime,
            inserted.descricao,
            CAST(inserted.criado_por AS NVARCHAR(50)) AS criado_por,
            inserted.criado_por_nome,
            inserted.criado_em
          VALUES (
            @chamado_id,
            @nome_original,
            @caminho_storage,
            @tamanho_bytes,
            @tipo_mime,
            @descricao,
            @criado_por,
            @criado_por_nome
          )
        `);
      return q.recordset[0];
    }
  );

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
