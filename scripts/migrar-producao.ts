/**
 * Migração da produção em duas etapas, com backup e exportação das definições atuais.
 *
 * Credenciais em .env.migracao.local (ignorado pelo Git):
 *   MIGRACAO_HOST=100.118.29.5   MIGRACAO_PORTA=1433   MIGRACAO_BANCO=ChamadosUnopar
 *   MIGRACAO_USUARIO=sa          MIGRACAO_SENHA=...
 *   MIGRACAO_PASTA_BACKUP=/var/opt/mssql/backup   (pasta NO SERVIDOR do SQL Server)
 *
 * Etapa 1 — preparar (não altera o schema):
 *   npx tsx scripts/migrar-producao.ts preparar
 *   - confere conexão e permissões;
 *   - faz BACKUP DATABASE ... WITH COPY_ONLY, CHECKSUM e valida com RESTORE VERIFYONLY;
 *   - exporta as definições atuais (triggers, procedures, funções, políticas RLS) para
 *     db/producao/definicoes-<data>.sql — necessárias para a reversão da 0004;
 *   - verifica pré-condições (duplicidades exatas de motivos que bloqueariam a 0003).
 *
 * Etapa 2 — aplicar (exige um backup feito há menos de 2 horas na etapa 1):
 *   npx tsx scripts/migrar-producao.ts aplicar            (todas as pendentes)
 *   npx tsx scripts/migrar-producao.ts aplicar 0004       (só até a 0004)
 */
import fs from "fs";
import path from "path";
import sql from "mssql";
import { aplicarMigracoes, listarMigracoes } from "../db/migracoes";

const ARQ_ENV = path.resolve(process.cwd(), ".env.migracao.local");
const ARQ_ESTADO = path.resolve(process.cwd(), "db/producao/ultimo-backup.json");

function carregarEnv() {
  if (!fs.existsSync(ARQ_ENV))
    throw new Error(`Crie ${ARQ_ENV} com as credenciais (veja o cabeçalho deste script).`);
  for (const linha of fs.readFileSync(ARQ_ENV, "utf8").split(/\r?\n/)) {
    const t = linha.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  for (const k of ["MIGRACAO_HOST", "MIGRACAO_BANCO", "MIGRACAO_USUARIO", "MIGRACAO_SENHA"]) {
    if (!process.env[k]) throw new Error(`Falta ${k} em .env.migracao.local`);
  }
}

async function conectar() {
  return new sql.ConnectionPool({
    server: process.env.MIGRACAO_HOST!,
    port: Number(process.env.MIGRACAO_PORTA ?? 1433),
    database: process.env.MIGRACAO_BANCO!,
    user: process.env.MIGRACAO_USUARIO!,
    password: process.env.MIGRACAO_SENHA!,
    options: { encrypt: true, trustServerCertificate: true },
    requestTimeout: 30 * 60_000,
  }).connect();
}

async function preparar(pool: sql.ConnectionPool) {
  const banco = process.env.MIGRACAO_BANCO!;
  const info = (
    await pool.request().query(`
      SELECT DB_NAME() AS banco, SUSER_SNAME() AS login, IS_SRVROLEMEMBER('sysadmin') AS sysadmin,
        IS_ROLEMEMBER('db_owner') AS db_owner, IS_ROLEMEMBER('db_backupoperator') AS backup_op,
        HAS_PERMS_BY_NAME(NULL, 'DATABASE', 'VIEW DEFINITION') AS view_def, @@VERSION AS versao`)
  ).recordset[0];
  console.log(
    `Conectado em ${info.banco} como ${info.login} (sysadmin=${info.sysadmin}, db_owner=${info.db_owner})`
  );
  if (!info.sysadmin && !info.db_owner)
    throw new Error("O usuário precisa ser db_owner (ou sysadmin) para migrar.");
  if (!info.sysadmin && !info.backup_op && !info.db_owner)
    throw new Error("O usuário não pode fazer backup.");
  if (!info.view_def && !info.sysadmin)
    throw new Error("O usuário precisa de VIEW DEFINITION para exportar as definições.");

  const aplicadas = await pool
    .request()
    .query("SELECT versao FROM dbo.migracoes_aplicadas")
    .then((r) => r.recordset.map((x) => x.versao as string))
    .catch(() => [] as string[]);
  const pendentes = listarMigracoes(false)
    .filter((m) => !aplicadas.includes(m.versao))
    .map((m) => m.versao);
  console.log(
    `Migrações já aplicadas: ${aplicadas.join(", ") || "nenhuma"} | pendentes: ${pendentes.join(", ") || "nenhuma"}`
  );

  // 1. Backup completo (cópia avulsa: não interfere na cadeia de backups existente)
  const carimbo = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const pasta = (process.env.MIGRACAO_PASTA_BACKUP ?? "/var/opt/mssql/backup").replace(/\/$/, "");
  const arquivo = `${pasta}/${banco}_antes_migracoes_${carimbo}.bak`;
  console.log(`Backup em ${arquivo} (no servidor)...`);
  await pool
    .request()
    .input("arquivo", sql.NVarChar(400), arquivo)
    .batch(
      `BACKUP DATABASE [${banco}] TO DISK = @arquivo WITH COPY_ONLY, CHECKSUM, INIT, STATS = 25;`
    );
  await pool
    .request()
    .input("arquivo", sql.NVarChar(400), arquivo)
    .batch("RESTORE VERIFYONLY FROM DISK = @arquivo WITH CHECKSUM;");
  console.log("Backup concluído e verificado (RESTORE VERIFYONLY).");

  // 2. Exportar definições atuais (para a reversão da 0004 e para versionar o que existe hoje)
  const mods = (
    await pool.request().query(`
      SELECT o.type_desc AS tipo, SCHEMA_NAME(o.schema_id) + '.' + o.name AS nome, m.definition
      FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
      ORDER BY o.type_desc, nome`)
  ).recordset;
  const politicas = (
    await pool.request().query(`
      SELECT p.name AS politica, p.is_enabled, OBJECT_SCHEMA_NAME(pr.target_object_id) + '.' + OBJECT_NAME(pr.target_object_id) AS alvo,
        pr.predicate_type_desc AS tipo, pr.operation_desc AS operacao, pr.predicate_definition AS predicado
      FROM sys.security_policies p JOIN sys.security_predicates pr ON pr.object_id = p.object_id`)
  ).recordset;
  fs.mkdirSync(path.dirname(ARQ_ESTADO), { recursive: true });
  const arqDef = path.resolve(process.cwd(), `db/producao/definicoes-${carimbo}.sql`);
  fs.writeFileSync(
    arqDef,
    [
      `-- Definições exportadas de ${banco} em ${new Date().toISOString()} (antes das migrações)`,
      ...mods.map((m) => `-- ${m.tipo} ${m.nome}\n${m.definition}\nGO\n`),
      "-- POLÍTICAS DE SEGURANÇA (RLS)",
      ...politicas.map(
        (p) =>
          `-- ${p.politica} (ativa=${p.is_enabled}) ${p.tipo} ${p.operacao ?? ""} em ${p.alvo}: ${p.predicado}`
      ),
    ].join("\n"),
    "utf8"
  );
  console.log(
    `Definições exportadas: ${mods.length} módulos, ${politicas.length} predicados RLS → ${path.relative(process.cwd(), arqDef)}`
  );

  // 3. Pré-condições
  const dupl = (
    await pool.request().query(`
      SELECT LOWER(LTRIM(RTRIM(nome))) AS nome, COUNT(*) AS n FROM dados.motivos WHERE ativo = 1
      GROUP BY LOWER(LTRIM(RTRIM(nome))), LOWER(LTRIM(RTRIM(ISNULL(filtro, '')))) HAVING COUNT(*) > 1`)
  ).recordset;
  if (dupl.length)
    console.log("ATENÇÃO: motivos ativos com nome e caminho iguais (a 0003 vai parar):", dupl);
  else console.log("Pré-condição da 0003: sem duplicidade exata evidente entre motivos ativos.");

  fs.writeFileSync(
    ARQ_ESTADO,
    JSON.stringify({ arquivo, definicoes: arqDef, em: new Date().toISOString(), banco }, null, 2)
  );
  console.log("\nEtapa 1 concluída. Revise e rode: npx tsx scripts/migrar-producao.ts aplicar");
}

async function aplicar(pool: sql.ConnectionPool) {
  if (!fs.existsSync(ARQ_ESTADO))
    throw new Error("Rode a etapa 'preparar' antes (backup obrigatório).");
  const estado = JSON.parse(fs.readFileSync(ARQ_ESTADO, "utf8"));
  const idadeMin = (Date.now() - new Date(estado.em).getTime()) / 60000;
  if (estado.banco !== process.env.MIGRACAO_BANCO || idadeMin > 120) {
    throw new Error(
      `O backup registrado tem ${Math.round(idadeMin)} min ou é de outro banco. Rode 'preparar' de novo.`
    );
  }
  console.log(`Backup de referência: ${estado.arquivo} (${Math.round(idadeMin)} min atrás)`);
  const ate = process.argv[3];
  if (ate && !/^\d{4}$/.test(ate)) throw new Error("Versão limite inválida (ex.: 0004).");
  const feitas = await aplicarMigracoes(pool, { incluirBaseline: false, ate });
  console.log(feitas.length ? `Aplicadas: ${feitas.join(", ")}` : "Nenhuma migração pendente.");
  const conf = (
    await pool.request().query(`
      SELECT COL_LENGTH('dados.perfis','sessao_valida_desde') AS c4, OBJECT_ID('dados.chamado_eventos') AS t2,
             COL_LENGTH('dados.chamados','prazo_calculado') AS c1, OBJECT_ID('dados.fn_chave_texto') AS f3`)
  ).recordset[0];
  console.log("Conferência:", JSON.stringify(conf));
}

async function main() {
  const etapa = process.argv[2];
  if (etapa !== "preparar" && etapa !== "aplicar") throw new Error("Use: preparar | aplicar");
  carregarEnv();
  const pool = await conectar();
  try {
    if (etapa === "preparar") await preparar(pool);
    else await aplicar(pool);
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
