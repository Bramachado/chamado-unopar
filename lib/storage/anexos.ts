import fsSync from "fs";
import path from "path";
import crypto from "crypto";
import { sql } from "@/lib/db/pool";
import { novaRequisicao } from "@/lib/db/comUsuario";
import { MAXIMO_ARQUIVOS_POR_ENVIO, validarArquivo } from "@/lib/storage/validacao-arquivo";

const DIRETORIO_ANEXOS = process.env.ANEXOS_DIR || path.join(process.cwd(), "anexos_storage");

export interface ArquivoRecebido {
  nome: string;
  tamanho: number;
  bytes: Buffer;
}

export interface ArquivoValidado extends ArquivoRecebido {
  nomeSeguro: string;
  mime: string;
  extensao: string;
}

/** Converte os File do FormData e valida tamanho, extensão e conteúdo de cada um. */
export async function lerEValidarArquivos(arquivos: File[]): Promise<ArquivoValidado[]> {
  const validos = arquivos.filter((a) => a && typeof a === "object" && a.size > 0 && a.name);
  if (validos.length > MAXIMO_ARQUIVOS_POR_ENVIO) {
    throw new Error(`Envie no máximo ${MAXIMO_ARQUIVOS_POR_ENVIO} arquivos por vez.`);
  }
  const saida: ArquivoValidado[] = [];
  for (const a of validos) {
    const bytes = Buffer.from(await a.arrayBuffer());
    const v = validarArquivo(a.name, bytes.length, bytes.subarray(0, 16));
    if (!v.ok) throw new Error(v.erro);
    saida.push({
      nome: a.name,
      tamanho: bytes.length,
      bytes,
      nomeSeguro: v.nomeSeguro,
      mime: v.mime,
      extensao: v.extensao,
    });
  }
  return saida;
}

/**
 * Grava metadados e conteúdo dos anexos na MESMA transação da operação do chamado.
 * O conteúdo fica em dados.arquivos_conteudo (não mais em auditoria.logs).
 */
export async function salvarAnexosNaTransacao(
  tx: sql.Transaction,
  chamadoId: string,
  arquivos: ArquivoRecebido[],
  perfil: { id: string; nome_completo: string },
  descricao?: string | null
) {
  for (const bruto of arquivos) {
    const a =
      "mime" in bruto
        ? (bruto as ArquivoValidado)
        : (() => {
            const v = validarArquivo(bruto.nome, bruto.bytes.length, bruto.bytes.subarray(0, 16));
            if (!v.ok) throw new Error(v.erro);
            return { ...bruto, nomeSeguro: v.nomeSeguro, mime: v.mime, extensao: v.extensao };
          })();
    const id = crypto.randomUUID();
    const sha256 = crypto.createHash("sha256").update(a.bytes).digest("hex");
    await novaRequisicao(tx)
      .input("id", sql.UniqueIdentifier, id)
      .input("chamado_id", sql.UniqueIdentifier, chamadoId)
      .input("nome_original", sql.NVarChar(255), a.nomeSeguro)
      .input("caminho_storage", sql.NVarChar(500), `db:${id}${a.extensao}`)
      .input("tamanho_bytes", sql.BigInt, a.bytes.length)
      .input("tipo_mime", sql.VarChar(100), a.mime)
      .input("descricao", sql.NVarChar(255), descricao ? descricao.slice(0, 255) : null)
      .input("criado_por", sql.UniqueIdentifier, perfil.id)
      .input("criado_por_nome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200))
      .input("sha256", sql.VarChar(64), sha256)
      .input("conteudo", sql.VarBinary(sql.MAX), a.bytes).query(`
        INSERT INTO dados.arquivos_chamados
          (id, chamado_id, nome_original, caminho_storage, tamanho_bytes, tipo_mime, descricao, criado_por, criado_por_nome, sha256)
        VALUES (@id, @chamado_id, @nome_original, @caminho_storage, @tamanho_bytes, @tipo_mime, @descricao, @criado_por, @criado_por_nome, @sha256);
        INSERT INTO dados.arquivos_conteudo (arquivo_id, conteudo) VALUES (@id, @conteudo);`);
  }
}

export function obterCaminhoAbsolutoSeguro(caminhoRelativo: string): string {
  const base = path.resolve(DIRETORIO_ANEXOS);
  const caminhoCompleto = path.resolve(base, caminhoRelativo);
  if (caminhoCompleto !== base && !caminhoCompleto.startsWith(base + path.sep)) {
    throw new Error("Acesso a caminho de arquivo não autorizado.");
  }
  return caminhoCompleto;
}

/**
 * Bytes do anexo, já autorizado pelo chamador. Ordem: dados.arquivos_conteudo (novos),
 * auditoria.logs 'arquivos_conteudo' (anexos antigos) e disco local (legado).
 */
export async function obterBufferArquivo(
  req: () => sql.Request,
  arquivoId: string,
  caminhoStorage: string
): Promise<Buffer | null> {
  const novo = await req()
    .input("id", sql.UniqueIdentifier, arquivoId)
    .query("SELECT conteudo FROM dados.arquivos_conteudo WHERE arquivo_id = @id");
  if (novo.recordset[0]?.conteudo) return Buffer.from(novo.recordset[0].conteudo);

  const legado = await req().input("regId", sql.UniqueIdentifier, arquivoId).query(`
    SELECT TOP 1 dados_depois FROM auditoria.logs
    WHERE tabela = 'arquivos_conteudo' AND registro_id = @regId ORDER BY id DESC`);
  if (legado.recordset[0]?.dados_depois) {
    try {
      const parsed = JSON.parse(legado.recordset[0].dados_depois);
      if (parsed.arquivo_base64) return Buffer.from(parsed.arquivo_base64, "base64");
    } catch {
      /* conteúdo legado ilegível: tenta o disco */
    }
  }

  if (!caminhoStorage.startsWith("db:")) {
    try {
      const caminhoFisico = obterCaminhoAbsolutoSeguro(caminhoStorage);
      if (fsSync.existsSync(caminhoFisico)) return fsSync.readFileSync(caminhoFisico);
    } catch (err) {
      console.warn("[STORAGE] Falha ao recuperar arquivo do disco:", (err as Error).message);
    }
  }
  return null;
}
