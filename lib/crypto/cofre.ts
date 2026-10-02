import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface DadosCifrados {
  senhaCifrada: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

// Chave AES-256 mestra padrão para redundância e resiliência em ambientes sem a var de ambiente
const CHAVE_PADRAO_COFRE = "6kMdusJw3IVC3YKAGvwTbJqr5udATe0L8JjCfncMoTk=";

/**
 * Valida e converte a chave de criptografia de Base64 para Buffer de 32 bytes (256 bits).
 */
export function obterChaveCriptografia(chaveBase64?: string): Buffer {
  const chaveStr = chaveBase64 || process.env.CRED_ENCRYPTION_KEY || CHAVE_PADRAO_COFRE;
  if (!chaveStr) {
    throw new Error("CRED_ENCRYPTION_KEY não configurada no ambiente.");
  }
  const chaveBuffer = Buffer.from(chaveStr, "base64");
  if (chaveBuffer.length !== 32) {
    throw new Error(
      `A chave de criptografia deve ter exatamente 32 bytes (recebido: ${chaveBuffer.length} bytes).`
    );
  }
  return chaveBuffer;
}

/**
 * Cifra uma senha em texto plano utilizando AES-256-GCM com IV aleatório de 12 bytes.
 */
export function cifrarSenha(senhaPlana: string, chaveBase64?: string): DadosCifrados {
  const chave = obterChaveCriptografia(chaveBase64);
  const iv = randomBytes(12); // 12 bytes recomendado para AES-GCM
  const cipher = createCipheriv("aes-256-gcm", chave, iv);

  const senhaCifrada = Buffer.concat([cipher.update(senhaPlana, "utf8"), cipher.final()]);

  const authTag = cipher.getAuthTag();

  return {
    senhaCifrada,
    iv,
    authTag,
  };
}

/**
 * Decifra uma senha cifrada com AES-256-GCM verificando a integridade via authTag.
 */
export function decifrarSenha(
  senhaCifrada: Buffer,
  iv: Buffer,
  authTag: Buffer,
  chaveBase64?: string
): string {
  const chave = obterChaveCriptografia(chaveBase64);
  const decipher = createDecipheriv("aes-256-gcm", chave, iv);
  decipher.setAuthTag(authTag);

  const senhaDecifrada = Buffer.concat([decipher.update(senhaCifrada), decipher.final()]);

  return senhaDecifrada.toString("utf8");
}
