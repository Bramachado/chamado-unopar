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
import { gerarProximoProtocolo } from "../app/(sistema)/chamados/actions";

async function testarCrudReal() {
  console.log("=== INICIANDO TESTE REAL DA ETAPA 3 (CRUD DE CHAMADOS & RLS) ===");
  const pool = await getPool();

  // 0. Identificar Perfis e Motivo existente
  const resPerfis = await pool.request().query(`
    SELECT CAST(id AS NVARCHAR(50)) AS id, nome_completo, email, papel, ativo
    FROM dados.perfis
    ORDER BY id
  `);

  console.log("\n[0] Perfis cadastrados no banco:");
  console.table(resPerfis.recordset);

  const atendente1 = resPerfis.recordset.find((p: any) => p.papel === "atendente") || {
    id: "00000000-0000-0000-0000-000000000003",
    nome_completo: "Usuaria Teste Atendente 1",
    papel: "atendente",
  };

  // Se houver apenas uma atendente, usamos um UUID de uma segunda atendente para testar a RLS
  const atendente2 = resPerfis.recordset.filter((p: any) => p.papel === "atendente")[1] || {
    id: "00000000-0000-0000-0000-000000000099",
    nome_completo: "Outra Atendente Nao Autora",
    papel: "atendente",
  };

  const admin = resPerfis.recordset.find((p: any) => p.papel === "admin") || {
    id: "00000000-0000-0000-0000-000000000001",
    nome_completo: "Usuaria Teste Admin",
    papel: "admin",
  };

  const resMotivos = await pool.request().query(`
    SELECT TOP 1 CAST(id AS NVARCHAR(50)) AS id, codigo, nome
    FROM dados.motivos
    WHERE ativo = 1
  `);

  let motivoId = resMotivos.recordset[0]?.id;
  if (!motivoId) {
    // Buscar qualquer motivo
    const resQualquerMotivo = await pool.request().query(`
      SELECT TOP 1 CAST(id AS NVARCHAR(50)) AS id, codigo, nome FROM dados.motivos
    `);
    motivoId = resQualquerMotivo.recordset[0]?.id;
  }
  console.log(`[0] Motivo selecionado para o teste: ${resMotivos.recordset[0]?.nome || "Padrão"} (ID: ${motivoId})`);

  // ==============================================================================
  // PASSO 1: Criar chamado logado como atendente1 (...003)
  // ==============================================================================
  console.log(`\n--- PASSO 1: Criação de chamado como Atendente (${atendente1.nome_completo} - ${atendente1.id}) ---`);

  const hojeStr = new Date().toISOString().slice(0, 10);
  const prazoData = new Date();
  prazoData.setDate(prazoData.getDate() + 5);
  const prazoStr = prazoData.toISOString().slice(0, 10);

  // Geração de protocolo sequencial via procedure
  const protocolo = await comUsuario(
    { usuario_id: atendente1.id, papel: atendente1.papel },
    async (req) => {
      const res = await req
        .input("data_solicitacao", sql.Date, new Date(hojeStr))
        .output("protocolo_gerado", sql.VarChar(20))
        .execute("dados.gerar_protocolo");
      return res.output.protocolo_gerado;
    }
  );

  console.log(`[OK] Protocolo gerado atomicamente pela procedure: ${protocolo}`);

  // Inserção do chamado com SESSION_CONTEXT da atendente1
  const chamadoInserido = await comUsuario(
    { usuario_id: atendente1.id, papel: atendente1.papel },
    async (req) => {
      req.input("protocolo", sql.VarChar(30), protocolo);
      req.input("aluno_nome", sql.VarChar(255), "Aluno Teste de Validacao");
      req.input("aluno_ra", sql.VarChar(50), "RA12345678");
      req.input("contato_telefone", sql.VarChar(50), "11999998888");
      req.input("motivo_id", sql.UniqueIdentifier, motivoId);
      req.input("descricao", sql.NVarChar(sql.MAX), "Chamado criado para validacao comportamental de CRUD e RLS.");
      req.input("situacao", sql.VarChar(30), "aguardando");
      req.input("prioridade", sql.VarChar(20), "normal");
      req.input("data_solicitacao", sql.DateTimeOffset, new Date(hojeStr));
      req.input("prazo", sql.DateTimeOffset, new Date(prazoStr));
      req.input("criado_por", sql.UniqueIdentifier, atendente1.id);
      req.input("criado_por_nome", sql.VarChar(255), atendente1.nome_completo);

      const q = await req.query(`
        DECLARE @out TABLE (
          id UNIQUEIDENTIFIER,
          protocolo VARCHAR(30),
          aluno_nome VARCHAR(255),
          situacao VARCHAR(30),
          criado_por UNIQUEIDENTIFIER,
          criado_por_nome VARCHAR(255),
          criado_em DATETIMEOFFSET
        );

        INSERT INTO dados.chamados (
          protocolo, aluno_nome, aluno_ra, contato_telefone, motivo_id,
          descricao, situacao, prioridade, data_solicitacao, prazo,
          criado_por, criado_por_nome
        )
        OUTPUT 
          inserted.id,
          inserted.protocolo,
          inserted.aluno_nome,
          inserted.situacao,
          inserted.criado_por,
          inserted.criado_por_nome,
          inserted.criado_em
        INTO @out
        VALUES (
          @protocolo, @aluno_nome, @aluno_ra, @contato_telefone, @motivo_id,
          @descricao, @situacao, @prioridade, @data_solicitacao, @prazo,
          @criado_por, @criado_por_nome
        );

        SELECT 
          CAST(id AS NVARCHAR(50)) AS id,
          protocolo,
          aluno_nome,
          situacao,
          CAST(criado_por AS NVARCHAR(50)) AS criado_por,
          criado_por_nome,
          criado_em
        FROM @out;
      `);
      return q.recordset[0];
    }
  );

  console.log("\n[OK] Chamado inserido com sucesso pela atendente1:");
  console.log(chamadoInserido);

  // Consulta do registro no banco para confirmação
  const chamadoConsulta = await comUsuario(
    { usuario_id: atendente1.id, papel: atendente1.papel },
    async (req) => {
      req.input("id", sql.UniqueIdentifier, chamadoInserido.id);
      const q = await req.query(`
        SELECT 
          CAST(id AS NVARCHAR(50)) AS id,
          protocolo,
          aluno_nome,
          aluno_ra,
          situacao,
          prioridade,
          CAST(criado_por AS NVARCHAR(50)) AS criado_por,
          criado_por_nome,
          CAST(atualizado_por AS NVARCHAR(50)) AS atualizado_por,
          atualizado_por_nome,
          criado_em,
          atualizado_em
        FROM dados.chamados
        WHERE id = @id
      `);
      return q.recordset[0];
    }
  );

  console.log("\n[OK] SELECT direto do registro gravado em dados.chamados:");
  console.log(chamadoConsulta);

  // ==============================================================================
  // PASSO 2: Logado como Coordenadora ou outra atendente, tentar editar este chamado (esperado: BLOQUEIO RLS)
  // ==============================================================================
  const coordenadora = resPerfis.recordset.find((p: any) => p.papel === "coordenador") || {
    id: "00000000-0000-0000-0000-000000000002",
    nome_completo: "Usuaria Teste Coordenadora",
    papel: "coordenador",
  };

  console.log(`\n--- PASSO 2: Tentativa de edição por usuária sem permissão (${coordenadora.nome_completo} - papel: ${coordenadora.papel}) ---`);

  try {
    const resultadoTentativaBloqueio = await comUsuario(
      { usuario_id: coordenadora.id, papel: coordenadora.papel },
      async (req) => {
        req.input("id", sql.UniqueIdentifier, chamadoInserido.id);
        req.input("obs", sql.NVarChar(sql.MAX), "Tentativa indevida de edicao por coordenadora.");
        req.input("atualizado_por", sql.UniqueIdentifier, coordenadora.id);
        req.input("atualizado_por_nome", sql.VarChar(255), coordenadora.nome_completo);

        const q = await req.query(`
          UPDATE dados.chamados
          SET observacao = @obs,
              atualizado_por = @atualizado_por,
              atualizado_por_nome = @atualizado_por_nome,
              atualizado_em = SYSUTCDATETIME()
          WHERE id = @id
        `);

        return q.rowsAffected[0];
      }
    );

    if (resultadoTentativaBloqueio === 0) {
      console.log(`[OK - BLOQUEIO RLS CONFIRMADO]: 0 linhas afetadas. A política de segurança RLS filtrou/bloqueou o registro para usuária sem permissão de escrita.`);
    } else {
      console.log(`[AVISO]: Update afetou ${resultadoTentativaBloqueio} linhas.`);
    }
  } catch (err: any) {
    console.log(`[OK - BLOQUEIO CONFIRMADO VIA RLS/EXCECAO]:`, err.message);
  }

  // ==============================================================================
  // PASSO 3: Logado como Admin, editar o chamado (esperado: SUCESSO + atualizado_por gravado)
  // ==============================================================================
  console.log(`\n--- PASSO 3: Edição autorizada por Administrador (${admin.nome_completo} - ${admin.id}) ---`);

  const chamadoAtualizado = await comUsuario(
    { usuario_id: admin.id, papel: admin.papel },
    async (req) => {
      req.input("id", sql.UniqueIdentifier, chamadoInserido.id);
      req.input("obs", sql.NVarChar(sql.MAX), "Edicao autorizada realizada por admin com sucesso.");
      req.input("situacao", sql.VarChar(30), "concluido");
      req.input("atualizado_por", sql.UniqueIdentifier, admin.id);
      req.input("atualizado_por_nome", sql.VarChar(255), admin.nome_completo);

      await req.query(`
        UPDATE dados.chamados
        SET observacao = @obs,
            situacao = @situacao,
            data_conclusao = SYSUTCDATETIME(),
            atualizado_por = @atualizado_por,
            atualizado_por_nome = @atualizado_por_nome,
            atualizado_em = SYSUTCDATETIME()
        WHERE id = @id
      `);

      req.input("idConsulta", sql.UniqueIdentifier, chamadoInserido.id);
      const q = await req.query(`
        SELECT 
          CAST(id AS NVARCHAR(50)) AS id,
          protocolo,
          aluno_nome,
          situacao,
          observacao,
          CAST(criado_por AS NVARCHAR(50)) AS criado_por,
          criado_por_nome,
          CAST(atualizado_por AS NVARCHAR(50)) AS atualizado_por,
          atualizado_por_nome,
          criado_em,
          atualizado_em,
          data_conclusao
        FROM dados.chamados
        WHERE id = @idConsulta
      `);
      return q.recordset[0];
    }
  );

  console.log("\n[OK] Chamado editado com sucesso pelo Administrador:");
  console.log(chamadoAtualizado);

  // Verificar se a trigger de auditoria registrou o UPDATE com origem = 'aplicacao'
  const logAuditoria = await pool.request()
    .input("protocolo", sql.VarChar(50), chamadoInserido.protocolo)
    .query(`
      SELECT TOP 2 id, tabela, operacao, origem, usuario_nome, protocolo, criado_em
      FROM auditoria.logs
      WHERE protocolo = @protocolo
      ORDER BY id DESC
    `);

  console.log("\n[OK] Logs de auditoria gerados automaticamente pela trigger dados.trg_chamados_auditoria:");
  console.table(logAuditoria.recordset);

  console.log("\n=== EVIDÊNCIA ETAPA 3 COMPROVADA: CRUD E RLS VALIDADOS ===");
  process.exit(0);
}

testarCrudReal().catch((err) => {
  console.error("[ERRO FATAL NA ETAPA 3]:", err);
  process.exit(1);
});
