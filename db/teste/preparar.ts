/**
 * Cria (do zero) o banco de TESTES local, aplica todas as migrações e carrega dados fictícios
 * que reproduzem as evidências relatadas. Recusa-se a rodar fora de localhost.
 *
 *   TESTE_DB_PORTA=14333 TESTE_DB_SA_SENHA=... TESTE_APP_SENHA=... npx tsx db/teste/preparar.ts
 */
import sql from "mssql";
import bcrypt from "bcryptjs";
import { aplicarMigracoes } from "../migracoes";
import { IDS, SENHA_USUARIOS_TESTE } from "./ids";

export const BANCO_TESTE = "ChamadosTeste";

function configTeste(banco: string): sql.config {
  const host = process.env.TESTE_DB_HOST ?? "localhost";
  if (!["localhost", "127.0.0.1"].includes(host))
    throw new Error("O banco de testes precisa ser local.");
  if (!process.env.TESTE_DB_SA_SENHA) throw new Error("Defina TESTE_DB_SA_SENHA.");
  return {
    server: host,
    port: Number(process.env.TESTE_DB_PORTA ?? 14333),
    user: "sa",
    password: process.env.TESTE_DB_SA_SENHA,
    database: banco,
    options: { encrypt: true, trustServerCertificate: true },
    requestTimeout: 120_000,
  };
}

async function comContexto(
  pool: sql.ConnectionPool,
  usuarioId: string,
  papel: string,
  comando: string
) {
  await pool.request().batch(`
    EXEC sp_set_session_context N'usuario_id', '${usuarioId}';
    EXEC sp_set_session_context N'papel', '${papel}';
    ${comando}
    EXEC sp_set_session_context N'usuario_id', NULL;`);
}

export async function prepararBancoTeste(log: (m: string) => void = console.log) {
  const senhaApp = process.env.TESTE_APP_SENHA;
  if (!senhaApp)
    throw new Error("Defina TESTE_APP_SENHA (senha do login app_chamados no banco de testes).");

  const master = await new sql.ConnectionPool(configTeste("master")).connect();
  await master.request().batch(`
    IF DB_ID('${BANCO_TESTE}') IS NOT NULL
    BEGIN
      ALTER DATABASE [${BANCO_TESTE}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${BANCO_TESTE}];
    END;
    CREATE DATABASE [${BANCO_TESTE}];`);
  await master.request().input("senha", sql.NVarChar(200), senhaApp).batch(`
      IF SUSER_ID('app_chamados') IS NOT NULL DROP LOGIN app_chamados;
      DECLARE @cmd NVARCHAR(400) = N'CREATE LOGIN app_chamados WITH PASSWORD = ' + QUOTENAME(@senha, '''') + N', CHECK_POLICY = OFF';
      EXEC (@cmd);`);
  await master.close();

  const pool = await new sql.ConnectionPool(configTeste(BANCO_TESTE)).connect();
  await pool.request().batch("CREATE USER app_chamados FOR LOGIN app_chamados;");
  log("Aplicando migrações:");
  await aplicarMigracoes(pool, { incluirBaseline: true, log });

  const hash = await bcrypt.hash(SENHA_USUARIOS_TESTE, 10);
  await pool.request().input("hash", sql.VarChar(100), hash).batch(`
    INSERT INTO dados.polos (id, nome, codigo, cidade, estado) VALUES
      ('${IDS.poloPQB}', N'Polo Parauapebas', 'PQB', N'Parauapebas', 'PA'),
      ('${IDS.poloCCJ}', N'Polo Canaã dos Carajás', 'CCJ', N'Canaã dos Carajás', 'PA'),
      ('${IDS.poloELD}', N'Polo Eldorado dos Carajás', 'ELD', N'Eldorado dos Carajás', 'PA');
    INSERT INTO dados.perfis (id, nome_completo, email, senha_hash, papel, ativo, polo_id) VALUES
      ('${IDS.admin}', N'Ana Administradora', 'admin@teste.local', @hash, 'admin', 1, NULL),
      ('${IDS.coordPQB}', N'Carla Coordenação', 'coord@teste.local', @hash, 'coordenador', 1, '${IDS.poloPQB}'),
      ('${IDS.atendPQB}', N'Bia Atendente', 'bia@teste.local', @hash, 'atendente', 1, '${IDS.poloPQB}'),
      ('${IDS.atendCCJ}', N'Duda Atendente', 'duda@teste.local', @hash, 'atendente', 1, '${IDS.poloCCJ}'),
      ('${IDS.desativadaPQB}', N'Eva Desligada', 'eva@teste.local', @hash, 'atendente', 0, '${IDS.poloPQB}');`);

  await comContexto(
    pool,
    IDS.admin,
    "admin",
    `
    INSERT INTO dados.motivos (id, numero, nome, filtro, ativo, criado_por) VALUES
      ('${IDS.motivo01}', 1, N'Atendimento e Documentação Acadêmica', NULL, 1, '${IDS.admin}'),
      ('${IDS.motivo02}', 2, N'teste', NULL, 0, '${IDS.admin}'),
      ('${IDS.motivo03}', 3, N'PAGAMENTO EM DUPLICIDADE', N'Boletos > Boletos Pagos > Mensalidade > Duplicidade De Pagamento', 1, '${IDS.admin}'),
      ('${IDS.motivo14}', 14, N'Mensalidade', N'Boletos > Boletos Pagos > Mensalidade > Duplicidade De Pagamento', 0, '${IDS.admin}'),
      ('${IDS.motivo24}', 24, N'Erro ao realizar a prova', N'Prova, Sistema De Pontos E Frequência > Erro ao realizar a prova', 1, '${IDS.admin}'),
      ('${IDS.motivo47}', 47, N'Problema com conteúdo', N'GRAD/ EJA/ TEC > Acadêmico > Não consegue estudar no AVA > Problema com o conteúdo', 1, '${IDS.admin}'),
      ('${IDS.motivo51}', 51, N'Problema com o conteúdo', N'GRAD/ EJA/ TEC > Acadêmico > Não consegue estudar no AVA > Problema com o conteúdo', 1, '${IDS.admin}');`
  );

  const chamado = (
    id: string,
    protocolo: string,
    aluno: string,
    polo: string,
    criador: string,
    situacao: string,
    motivo: string,
    abertura: string,
    prazo: string,
    conclusao: string | null,
    extra: { telefone?: string; ra?: string; cpf?: string } = {}
  ) => `INSERT INTO dados.chamados (id, protocolo, aluno_nome, aluno_ra, aluno_cpf, contato_telefone, polo_id,
      motivo_id, descricao, situacao, prioridade, data_solicitacao, prazo, data_conclusao, criado_por, criado_por_nome)
    VALUES ('${id}', '${protocolo}', N'${aluno}', ${extra.ra ? `'${extra.ra}'` : "NULL"}, ${extra.cpf ? `'${extra.cpf}'` : "NULL"},
      ${extra.telefone ? `'${extra.telefone}'` : "NULL"}, '${polo}', '${motivo}', N'Descrição de teste', '${situacao}', 'normal',
      '${abertura}', '${prazo}', ${conclusao ? `'${conclusao}'` : "NULL"}, '${criador}',
      (SELECT nome_completo FROM dados.perfis WHERE id = '${criador}'));`;

  await comContexto(
    pool,
    IDS.atendPQB,
    "atendente",
    [
      // Evidência do chamado 5858008-202610: abertura futura e prazo anterior à abertura
      chamado(
        IDS.ch5858008,
        "5858008-202610",
        "Aluno Evidência Datas",
        IDS.poloPQB,
        IDS.atendPQB,
        "aguardando",
        IDS.motivo01,
        "2026-12-02",
        "2026-10-23",
        null
      ),
      // Concluído às 23:30 locais do último dia do prazo (02:30 UTC do dia seguinte)
      chamado(
        IDS.chNoLimite,
        "CS20261001-0001",
        "Aluno Prazo No Limite",
        IDS.poloPQB,
        IDS.atendPQB,
        "concluido",
        IDS.motivo03,
        "2026-10-01",
        "2026-10-08",
        "2026-10-08T23:30:00-03:00"
      ),
      chamado(
        IDS.chAlunoTeste,
        "CS20261005-0001",
        "ALUNO TESTE",
        IDS.poloPQB,
        IDS.atendPQB,
        "aguardando",
        IDS.motivo01,
        "2026-10-05",
        "2026-10-13",
        null,
        { telefone: "99123-4567" }
      ),
      chamado(
        IDS.chEncerrado,
        "CS20261005-0002",
        "Aluno Encerrado",
        IDS.poloPQB,
        IDS.atendPQB,
        "encerrado",
        IDS.motivo51,
        "2026-10-05",
        "2026-10-13",
        "2026-10-07T13:00:00Z"
      ),
    ].join("\n")
  );
  await comContexto(
    pool,
    IDS.desativadaPQB,
    "atendente",
    chamado(
      IDS.chDesativada,
      "CS20260920-0001",
      "Aluno Da Desligada",
      IDS.poloPQB,
      IDS.desativadaPQB,
      "aguardando",
      IDS.motivo01,
      "2026-09-20",
      "2026-09-25",
      null
    )
  );
  await comContexto(
    pool,
    IDS.atendCCJ,
    "atendente",
    [
      chamado(
        IDS.chCCJ,
        "CS20261014-0001",
        "Aluno Canaã",
        IDS.poloCCJ,
        IDS.atendCCJ,
        "aguardando",
        IDS.motivo24,
        "2026-10-14",
        "2026-10-21",
        null,
        { telefone: "00000000000", ra: "52998224725", cpf: "52998224725" }
      ),
      chamado(
        IDS.chCCJConcluido,
        "CS20261002-0001",
        "Aluno Canaã Resolvido",
        IDS.poloCCJ,
        IDS.atendCCJ,
        "concluido",
        IDS.motivo47,
        "2026-10-02",
        "2026-10-09",
        "2026-10-06T14:00:00Z"
      ),
    ].join("\n")
  );

  await pool.close();
  log(`Banco ${BANCO_TESTE} pronto.`);
}

if (require.main === module) {
  prepararBancoTeste().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
