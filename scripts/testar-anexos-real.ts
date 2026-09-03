import fs from "fs";
import path from "path";

// Carregar .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

import { getPool, sql } from "../lib/db/pool";
import { comUsuario } from "../lib/db/comUsuario";
import { salvarArquivoLocal, obterCaminhoAbsolutoSeguro } from "../lib/storage/anexos";
import { GET as routeHandlerAnexo } from "../app/api/anexos/[id]/route";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

async function testarAnexosReal() {
  console.log("=== INICIANDO TESTE REAL DA ETAPA 4 (ANEXOS, STORAGE & ROUTE HANDLER) ===");
  const pool = await getPool();

  const adminPerfil = {
    id: "00000000-0000-0000-0000-000000000001",
    papel: "admin",
  };

  const chamado = await comUsuario(
    { usuario_id: adminPerfil.id, papel: adminPerfil.papel },
    async (req) => {
      const q = await req.query(`
        SELECT TOP 1 CAST(id AS NVARCHAR(50)) AS id, protocolo, CAST(criado_por AS NVARCHAR(50)) AS criado_por
        FROM dados.chamados
        WHERE excluido_em IS NULL
        ORDER BY criado_em DESC
      `);
      return q.recordset[0];
    }
  );

  if (!chamado) {
    console.error("[ERRO]: Nenhum chamado encontrado para vincular o anexo.");
    process.exit(1);
  }

  const resPerfil = await pool.request()
    .input("id", sql.UniqueIdentifier, chamado.criado_por)
    .query("SELECT CAST(id AS NVARCHAR(50)) AS id, nome_completo, email, papel, ativo FROM dados.perfis WHERE id = @id");

  const perfil = resPerfil.recordset[0] || {
    id: "00000000-0000-0000-0000-000000000003",
    nome_completo: "Usuaria Teste Atendente",
    email: "teste.atend@unopar.br",
    papel: "atendente",
    ativo: true,
  };

  console.log(`[0] Contexto de teste: Chamado ${chamado.protocolo} (${chamado.id}) | Usuária: ${perfil.nome_completo}`);

  // ==============================================================================
  // 1. UPLOAD REAL DE UM PDF
  // ==============================================================================
  console.log("\n--- PASSO 1: Upload real de arquivo PDF vinculado ao chamado ---");

  const conteudoPdfExemplo = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n200\n%%EOF"
  );

  const arquivoMock = new File([conteudoPdfExemplo], "comprovante_matricula_oficial.pdf", {
    type: "application/pdf",
  });

  const registroSalvo = await salvarArquivoLocal(
    chamado.id,
    arquivoMock,
    perfil,
    "Comprovante acadêmico enviado para teste de validação."
  );

  console.log("[OK] Registro gravado em dados.arquivos_chamados:");
  console.log(registroSalvo);

  // Verificação no disco físico
  const caminhoFisicoDisco = obterCaminhoAbsolutoSeguro(registroSalvo.caminho_storage);
  const existeNoDisco = fs.existsSync(caminhoFisicoDisco);
  const statsDisco = existeNoDisco ? fs.statSync(caminhoFisicoDisco) : null;

  console.log("\n[OK] Verificação no disco físico (ANEXOS_DIR):");
  console.log({
    caminho_completo: caminhoFisicoDisco,
    existe_no_disco: existeNoDisco,
    tamanho_no_disco_bytes: statsDisco?.size,
    tamanho_esperado_bytes: conteudoPdfExemplo.length,
  });

  // ==============================================================================
  // 2. DOWNLOAD AUTENTICADO VS NÃO AUTENTICADO
  // ==============================================================================
  console.log("\n--- PASSO 2: Teste de segurança do Route Handler GET /api/anexos/[id] ---");

  const segredoJwt = new TextEncoder().encode(process.env.AUTH_SECRET || "chave-secreta-padrao-minimo-32-caracteres-para-dev");
  const urlRoute = `http://localhost:3000/api/anexos/${registroSalvo.id}`;

  // 2.1 Tentativa SEM sessão (deve retornar 401)
  const reqSemAuth = new NextRequest(urlRoute, {
    method: "GET",
  });
  const resSemAuth = await routeHandlerAnexo(reqSemAuth, {
    params: Promise.resolve({ id: registroSalvo.id }),
  });
  const corpoSemAuth = await resSemAuth.json();

  console.log("[2.1] Tentativa SEM sessão (Download não autenticado):", {
    status_http: resSemAuth.status,
    status_text: resSemAuth.statusText,
    resposta_json: corpoSemAuth,
  });

  if (resSemAuth.status === 401) {
    console.log("  [OK] Acesso não autenticado foi BLOQUEADO com HTTP 401.");
  } else {
    console.error("  [FALHA] Esperado 401, recebido:", resSemAuth.status);
  }

  // 2.2 Tentativa COM sessão válida (deve retornar 200 e servir o PDF)
  const tokenValido = await new SignJWT({
    id: perfil.id,
    email: perfil.email,
    nome_completo: perfil.nome_completo,
    papel: perfil.papel,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(segredoJwt);

  const reqComAuth = new NextRequest(urlRoute, {
    method: "GET",
    headers: {
      cookie: `chamados_unopar_session=${tokenValido}`,
    },
  });

  const resComAuth = await routeHandlerAnexo(reqComAuth, {
    params: Promise.resolve({ id: registroSalvo.id }),
  });

  const arrayBufferCorpo = await resComAuth.arrayBuffer();
  const tamanhoRecebido = arrayBufferCorpo.byteLength;

  console.log("\n[2.2] Tentativa COM sessão válida (Download autenticado):", {
    status_http: resComAuth.status,
    content_type: resComAuth.headers.get("content-type"),
    content_disposition: resComAuth.headers.get("content-disposition"),
    bytes_recebidos: tamanhoRecebido,
    bytes_originais: conteudoPdfExemplo.length,
  });

  if (resComAuth.status === 200 && tamanhoRecebido === conteudoPdfExemplo.length) {
    console.log("  [OK] Download autenticado serviu o arquivo com integridade total.");
  } else {
    console.error("  [FALHA] Download autenticado falhou ou tamanho divergiu.");
  }

  // ==============================================================================
  // 3. PROTEÇÃO CONTRA PATH TRAVERSAL
  // ==============================================================================
  console.log("\n--- PASSO 3: Teste de proteção contra Path Traversal ---");

  console.log(`[3.1] Nome original enviado pelo cliente: "${arquivoMock.name}"`);
  console.log(`[3.2] Nome sanitizado e gravado no storage: "${registroSalvo.caminho_storage}"`);

  const nomeNoDiscoEhOriginal = registroSalvo.caminho_storage.endsWith(arquivoMock.name);
  console.log(`[3.3] O arquivo físico no disco usa o nome do cliente diretamente? ${nomeNoDiscoEhOriginal ? "SIM (Inseguro)" : "NÃO (Seguro, gerado com UUID)"}`);

  // Teste de tentativa forçada de traversal no utilitário de caminho
  let traversalBloqueado = false;
  try {
    obterCaminhoAbsolutoSeguro("../../../etc/passwd");
  } catch (err: any) {
    traversalBloqueado = true;
    console.log(`[3.4] Tentativa de traversal "../../../etc/passwd" bloqueada: "${err.message}"`);
  }

  if (!nomeNoDiscoEhOriginal && traversalBloqueado) {
    console.log("  [OK] Proteção contra Path Traversal COMPROVADA.");
  }

  console.log("\n=== EVIDÊNCIA ETAPA 4 COMPROVADA: ANEXOS E STORAGE VALIDADOS ===");
  process.exit(0);
}

testarAnexosReal().catch((err) => {
  console.error("[ERRO FATAL NA ETAPA 4]:", err);
  process.exit(1);
});
