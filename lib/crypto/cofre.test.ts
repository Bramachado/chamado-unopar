import { randomBytes } from "node:crypto";
import { cifrarSenha, decifrarSenha, obterChaveCriptografia } from "./cofre";

function executarTesteCofre() {
  console.log("Iniciando validação do módulo de criptografia (AES-256-GCM)...");

  // 1. Gerar chave temporária de 32 bytes em Base64
  const chaveValida = randomBytes(32).toString("base64");
  const chaveInvalida = randomBytes(16).toString("base64");

  // Teste 1: Validação de tamanho de chave
  try {
    obterChaveCriptografia(chaveInvalida);
    console.error("FALHA: Deveria ter rejeitado chave com tamanho incorreto.");
    process.exit(1);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log("OK: Chave de 16 bytes rejeitada corretamente:", err.message);
    }
  }

  // Teste 2: Cifragem e decifragem de texto plano
  const senhaOriginal = "SenhaExterna@2026!#Segura";
  const { senhaCifrada, iv, authTag } = cifrarSenha(senhaOriginal, chaveValida);

  if (senhaCifrada.equals(Buffer.from(senhaOriginal))) {
    console.error("FALHA: O texto cifrado não pode ser idêntico ao original.");
    process.exit(1);
  }

  if (iv.length !== 12) {
    console.error(`FALHA: IV deve ter 12 bytes, obtido ${iv.length}`);
    process.exit(1);
  }

  const senhaRecuperada = decifrarSenha(senhaCifrada, iv, authTag, chaveValida);
  if (senhaRecuperada !== senhaOriginal) {
    console.error(`FALHA: Senha decifrada "${senhaRecuperada}" difere da original "${senhaOriginal}".`);
    process.exit(1);
  }
  console.log("OK: Cifragem e decifragem com integridade de tag bem-sucedidas.");

  // Teste 3: Detecção de adulteração (auth tag inválida)
  try {
    const authTagAdulterada = Buffer.from(authTag);
    authTagAdulterada[0] = (authTagAdulterada[0] ?? 0) ^ 0xff;
    decifrarSenha(senhaCifrada, iv, authTagAdulterada, chaveValida);
    console.error("FALHA: Deveria ter falhado ao detectar authTag adulterada.");
    process.exit(1);
  } catch {
    console.log("OK: Adulteração de dados detectada e rejeitada pelo GCM auth tag.");
  }

  console.log("Todos os testes unitários do cofre de senhas passaram com sucesso.");
}

executarTesteCofre();
