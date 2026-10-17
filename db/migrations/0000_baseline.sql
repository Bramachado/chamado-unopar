-- =============================================================================
-- 0000 - BASELINE (SOMENTE PARA BANCO VAZIO DE TESTES / DESENVOLVIMENTO)
--
-- Reconstrução do schema de produção observado em 17/10/2026 a partir dos metadados
-- (sys.columns, sys.objects, sys.indexes, sys.foreign_keys, permissões de app_chamados).
-- NÃO executar em produção: lá estes objetos já existem.
--
-- Diferenças conhecidas em relação à produção (o usuário da aplicação não tem VIEW DEFINITION):
--  * Corpo de seg.definir_contexto, triggers de perfis/motivos/credenciais e valores DEFAULT
--    foram inferidos. O trigger de chamados, gerar_protocolo e revelar_credencial seguem
--    scripts/sql_server_schemas_procedures.sql.
--  * A produção aplica Row-Level Security em dados.chamados (consultas sem contexto retornam
--    0 linhas), mas os predicados não puderam ser lidos. Este baseline NÃO cria RLS; a
--    autorização é verificada na aplicação (lib/auth/autorizacao.ts).
-- =============================================================================
SET NOCOUNT ON;
GO
IF SCHEMA_ID('dados') IS NULL EXEC('CREATE SCHEMA dados');
IF SCHEMA_ID('auditoria') IS NULL EXEC('CREATE SCHEMA auditoria');
IF SCHEMA_ID('seg') IS NULL EXEC('CREATE SCHEMA seg');
GO

IF OBJECT_ID('dados.polos') IS NULL
CREATE TABLE dados.polos (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_polos_id DEFAULT NEWID(),
  nome NVARCHAR(150) NOT NULL,
  codigo VARCHAR(10) NOT NULL,
  cidade NVARCHAR(100) NOT NULL,
  estado VARCHAR(2) NOT NULL CONSTRAINT df_polos_estado DEFAULT 'PA',
  ativo BIT NOT NULL CONSTRAINT df_polos_ativo DEFAULT 1,
  criado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_polos_criado DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_polos PRIMARY KEY (id),
  CONSTRAINT uq_polos_codigo UNIQUE (codigo)
);
GO

IF OBJECT_ID('dados.perfis') IS NULL
CREATE TABLE dados.perfis (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_perfis_id DEFAULT NEWID(),
  nome_completo NVARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL,
  senha_hash VARCHAR(100) NOT NULL CONSTRAINT df_perfis_senha DEFAULT 'PROVISORIO_TROCAR_VIA_APP',
  papel VARCHAR(20) NOT NULL,
  ativo BIT NOT NULL CONSTRAINT df_perfis_ativo DEFAULT 1,
  criado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_perfis_criado DEFAULT SYSDATETIMEOFFSET(),
  atualizado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_perfis_atualizado DEFAULT SYSDATETIMEOFFSET(),
  polo_id UNIQUEIDENTIFIER NULL,
  CONSTRAINT pk_perfis PRIMARY KEY (id),
  CONSTRAINT uq_perfis_email UNIQUE (email),
  CONSTRAINT ck_perfis_papel CHECK (papel IN ('admin', 'coordenador', 'atendente')),
  CONSTRAINT fk_perfis_polo FOREIGN KEY (polo_id) REFERENCES dados.polos(id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_perfis_polo')
  CREATE INDEX ix_perfis_polo ON dados.perfis(polo_id);
GO

IF OBJECT_ID('dados.motivos') IS NULL
CREATE TABLE dados.motivos (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_motivos_id DEFAULT NEWID(),
  numero INT NOT NULL,
  codigo AS ('#' + RIGHT('0' + CAST(numero AS VARCHAR(3)), 2)),
  nome NVARCHAR(200) NOT NULL,
  nome_normalizado AS (LOWER(LTRIM(RTRIM(nome)))) PERSISTED,
  ativo BIT NOT NULL CONSTRAINT df_motivos_ativo DEFAULT 1,
  criado_por UNIQUEIDENTIFIER NULL,
  criado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_motivos_criado DEFAULT SYSDATETIMEOFFSET(),
  filtro NVARCHAR(500) NULL,
  CONSTRAINT pk_motivos PRIMARY KEY (id),
  CONSTRAINT uq_motivos_numero UNIQUE (numero),
  CONSTRAINT uq_motivos_nome_norm UNIQUE (nome_normalizado),
  CONSTRAINT fk_motivos_criado_por FOREIGN KEY (criado_por) REFERENCES dados.perfis(id)
);
GO

IF OBJECT_ID('dados.chamados') IS NULL
CREATE TABLE dados.chamados (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_chamados_id DEFAULT NEWID(),
  protocolo VARCHAR(20) NOT NULL,
  aluno_nome NVARCHAR(200) NOT NULL,
  aluno_ra VARCHAR(50) NULL,
  contato_telefone VARCHAR(20) NULL,
  motivo_id UNIQUEIDENTIFIER NOT NULL,
  descricao NVARCHAR(MAX) NULL,
  situacao VARCHAR(20) NOT NULL CONSTRAINT df_chamados_situacao DEFAULT 'aguardando',
  prioridade VARCHAR(20) NOT NULL CONSTRAINT df_chamados_prioridade DEFAULT 'normal',
  data_solicitacao DATE NOT NULL,
  prazo DATE NOT NULL,
  data_conclusao DATETIMEOFFSET(3) NULL,
  chamado_vinculado_id UNIQUEIDENTIFIER NULL,
  observacao NVARCHAR(MAX) NULL,
  importado BIT NOT NULL CONSTRAINT df_chamados_importado DEFAULT 0,
  criado_por UNIQUEIDENTIFIER NOT NULL,
  criado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_chamados_criado DEFAULT SYSDATETIMEOFFSET(),
  atualizado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_chamados_atualizado DEFAULT SYSDATETIMEOFFSET(),
  excluido_em DATETIMEOFFSET(3) NULL,
  excluido_por UNIQUEIDENTIFIER NULL,
  criado_por_nome NVARCHAR(200) NULL,
  atualizado_por UNIQUEIDENTIFIER NULL,
  atualizado_por_nome NVARCHAR(200) NULL,
  polo_id UNIQUEIDENTIFIER NULL,
  aluno_cpf VARCHAR(11) NULL,
  CONSTRAINT pk_chamados PRIMARY KEY (id),
  CONSTRAINT uq_chamados_protocolo UNIQUE (protocolo),
  CONSTRAINT ck_chamados_protocolo CHECK (LEN(LTRIM(RTRIM(protocolo))) >= 5),
  CONSTRAINT ck_chamados_situacao CHECK (situacao IN ('aguardando', 'concluido', 'encerrado', 'rascunho')),
  CONSTRAINT ck_chamados_prioridade CHECK (prioridade IN ('normal', 'priorizar')),
  CONSTRAINT fk_chamados_motivo FOREIGN KEY (motivo_id) REFERENCES dados.motivos(id),
  CONSTRAINT fk_chamados_polo FOREIGN KEY (polo_id) REFERENCES dados.polos(id),
  CONSTRAINT fk_chamados_criado_por FOREIGN KEY (criado_por) REFERENCES dados.perfis(id),
  CONSTRAINT fk_chamados_atualizado_por FOREIGN KEY (atualizado_por) REFERENCES dados.perfis(id),
  CONSTRAINT fk_chamados_excluido_por FOREIGN KEY (excluido_por) REFERENCES dados.perfis(id),
  CONSTRAINT fk_chamados_vinculo FOREIGN KEY (chamado_vinculado_id) REFERENCES dados.chamados(id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chamados_polo')
  CREATE INDEX ix_chamados_polo ON dados.chamados(polo_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chamados_cpf')
  CREATE INDEX ix_chamados_cpf ON dados.chamados(aluno_cpf);
GO

IF OBJECT_ID('dados.arquivos_chamados') IS NULL
CREATE TABLE dados.arquivos_chamados (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_arquivos_id DEFAULT NEWID(),
  chamado_id UNIQUEIDENTIFIER NOT NULL,
  nome_original NVARCHAR(255) NOT NULL,
  caminho_storage NVARCHAR(500) NOT NULL,
  tamanho_bytes BIGINT NULL,
  tipo_mime VARCHAR(100) NULL,
  descricao NVARCHAR(255) NULL,
  criado_por UNIQUEIDENTIFIER NOT NULL,
  criado_por_nome NVARCHAR(200) NULL,
  criado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_arquivos_criado DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_arquivos PRIMARY KEY (id),
  CONSTRAINT fk_arquivos_chamado FOREIGN KEY (chamado_id) REFERENCES dados.chamados(id),
  CONSTRAINT fk_arquivos_criado_por FOREIGN KEY (criado_por) REFERENCES dados.perfis(id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_arquivos_chamado')
  CREATE INDEX ix_arquivos_chamado ON dados.arquivos_chamados(chamado_id);
GO

IF OBJECT_ID('dados.credenciais_externas') IS NULL
CREATE TABLE dados.credenciais_externas (
  perfil_id UNIQUEIDENTIFIER NOT NULL,
  senha_cifrada VARBINARY(MAX) NOT NULL,
  iv VARBINARY(16) NOT NULL,
  auth_tag VARBINARY(16) NOT NULL,
  atualizado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_cred_atualizado DEFAULT SYSDATETIMEOFFSET(),
  atualizado_por UNIQUEIDENTIFIER NULL,
  CONSTRAINT pk_cred PRIMARY KEY (perfil_id),
  CONSTRAINT fk_cred_perfil FOREIGN KEY (perfil_id) REFERENCES dados.perfis(id),
  CONSTRAINT fk_cred_atualizado_por FOREIGN KEY (atualizado_por) REFERENCES dados.perfis(id)
);
GO

IF OBJECT_ID('dados.tokens_recuperacao') IS NULL
CREATE TABLE dados.tokens_recuperacao (
  id BIGINT IDENTITY(1,1) NOT NULL,
  perfil_id UNIQUEIDENTIFIER NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expira_em DATETIMEOFFSET(3) NOT NULL,
  utilizado_em DATETIMEOFFSET(3) NULL,
  criado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_tokens_criado DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_tokens_recuperacao PRIMARY KEY (id),
  CONSTRAINT fk_tokens_perfil FOREIGN KEY (perfil_id) REFERENCES dados.perfis(id) ON DELETE CASCADE
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_tokens_perfil')
  CREATE INDEX ix_tokens_perfil ON dados.tokens_recuperacao(perfil_id, token_hash);
GO

IF OBJECT_ID('auditoria.logs') IS NULL
CREATE TABLE auditoria.logs (
  id BIGINT IDENTITY(1,1) NOT NULL,
  tabela VARCHAR(100) NOT NULL,
  registro_id UNIQUEIDENTIFIER NULL,
  operacao VARCHAR(10) NOT NULL,
  dados_antes NVARCHAR(MAX) NULL,
  dados_depois NVARCHAR(MAX) NULL,
  campos_alterados NVARCHAR(MAX) NULL,
  usuario_id UNIQUEIDENTIFIER NULL,
  usuario_nome NVARCHAR(200) NULL,
  protocolo VARCHAR(20) NULL,
  ip VARCHAR(45) NULL,
  origem VARCHAR(30) NOT NULL CONSTRAINT df_logs_origem DEFAULT 'aplicacao',
  criado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_logs_criado DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_logs PRIMARY KEY (id),
  CONSTRAINT ck_logs_operacao CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  CONSTRAINT ck_logs_dados_antes CHECK (dados_antes IS NULL OR ISJSON(dados_antes) = 1),
  CONSTRAINT ck_logs_dados_depois CHECK (dados_depois IS NULL OR ISJSON(dados_depois) = 1)
);
GO

IF OBJECT_ID('auditoria.credencial_acessos') IS NULL
CREATE TABLE auditoria.credencial_acessos (
  id BIGINT IDENTITY(1,1) NOT NULL,
  perfil_alvo UNIQUEIDENTIFIER NOT NULL,
  admin_id UNIQUEIDENTIFIER NOT NULL,
  data_hora DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ca_data DEFAULT SYSDATETIMEOFFSET(),
  ip VARCHAR(45) NULL,
  user_agent NVARCHAR(400) NULL,
  CONSTRAINT pk_cred_acessos PRIMARY KEY (id),
  CONSTRAINT fk_ca_alvo FOREIGN KEY (perfil_alvo) REFERENCES dados.perfis(id),
  CONSTRAINT fk_ca_admin FOREIGN KEY (admin_id) REFERENCES dados.perfis(id)
);
GO

CREATE OR ALTER PROCEDURE seg.definir_contexto
  @usuario_id VARCHAR(50),
  @papel VARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = TRY_CAST(@usuario_id AS UNIQUEIDENTIFIER);
  EXEC sp_set_session_context @key = N'usuario_id', @value = @uid;
  EXEC sp_set_session_context @key = N'papel', @value = @papel;
END;
GO

CREATE OR ALTER PROCEDURE dados.gerar_protocolo
  @data_solicitacao DATE = NULL,
  @protocolo_gerado VARCHAR(20) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @data_ref DATE = ISNULL(@data_solicitacao,
    CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE));
  -- Produção usa FORMAT(@data_ref, 'yyyyMMdd'); aqui CONVERT(…, 112) (mesmo resultado) porque o
  -- Azure SQL Edge usado nos testes não tem CLR.
  DECLARE @prefixo VARCHAR(11) = 'CS' + CONVERT(CHAR(8), @data_ref, 112) + '-';
  DECLARE @proximo INT;
  BEGIN TRAN;
    SELECT @proximo = ISNULL(MAX(TRY_CAST(SUBSTRING(protocolo, LEN(@prefixo) + 1, 4) AS INT)), 0) + 1
    FROM dados.chamados WITH (UPDLOCK, HOLDLOCK)
    WHERE protocolo LIKE @prefixo + '[0-9][0-9][0-9][0-9]';
    SET @protocolo_gerado = @prefixo + RIGHT('0000' + CAST(@proximo AS VARCHAR(4)), 4);
  COMMIT TRAN;
END;
GO

CREATE OR ALTER PROCEDURE dados.revelar_credencial
  @perfil_alvo UNIQUEIDENTIFIER,
  @ip VARCHAR(45) = NULL,
  @user_agent NVARCHAR(400) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  IF @uid IS NULL THROW 51010, 'Contexto de usuario ausente.', 1;
  DECLARE @papel_real VARCHAR(20) = (SELECT papel FROM dados.perfis WHERE id = @uid AND ativo = 1);
  IF ISNULL(@papel_real, '') <> 'admin' THROW 51011, 'Apenas administradoras podem revelar credenciais.', 1;
  INSERT INTO auditoria.credencial_acessos (perfil_alvo, admin_id, ip, user_agent)
  VALUES (@perfil_alvo, @uid, @ip, @user_agent);
  SELECT senha_cifrada, iv, auth_tag FROM dados.credenciais_externas WHERE perfil_id = @perfil_alvo;
END;
GO

-- Triggers de auditoria (versão anterior às correções da migração 0004)
CREATE OR ALTER TRIGGER dados.trg_chamados_auditoria ON dados.chamados
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  DECLARE @unome NVARCHAR(200) = (SELECT nome_completo FROM dados.perfis WHERE id = @uid);
  DECLARE @origem VARCHAR(30) = CASE WHEN @uid IS NULL THEN 'SSMS/manual' ELSE 'aplicacao' END;
  IF EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted)
    INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_depois, usuario_id, usuario_nome, protocolo, origem)
    SELECT 'chamados', i.id, 'INSERT',
      (SELECT x.* FROM dados.chamados x WHERE x.id = i.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
      @uid, @unome, i.protocolo, @origem
    FROM inserted i;
  IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_antes, usuario_id, usuario_nome, protocolo, origem)
    SELECT 'chamados', d.id, 'DELETE', (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @uid, @unome, d.protocolo, @origem
    FROM deleted d;
  IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
    INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_antes, dados_depois, usuario_id, usuario_nome, protocolo, origem)
    SELECT 'chamados', i.id, 'UPDATE',
      (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
      (SELECT x.* FROM dados.chamados x WHERE x.id = i.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
      @uid, @unome, i.protocolo, @origem
    FROM inserted i JOIN deleted d ON d.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER dados.trg_perfis_auditoria ON dados.perfis
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  DECLARE @origem VARCHAR(30) = CASE WHEN @uid IS NULL THEN 'SSMS/manual' ELSE 'aplicacao' END;
  INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_antes, dados_depois, usuario_id, origem)
  SELECT 'perfis', COALESCE(i.id, d.id),
    CASE WHEN i.id IS NULL THEN 'DELETE' WHEN d.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @uid, @origem
  FROM inserted i FULL JOIN deleted d ON d.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER dados.trg_motivos_auditoria ON dados.motivos
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  DECLARE @origem VARCHAR(30) = CASE WHEN @uid IS NULL THEN 'SSMS/manual' ELSE 'aplicacao' END;
  INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_antes, dados_depois, usuario_id, origem)
  SELECT 'motivos', COALESCE(i.id, d.id),
    CASE WHEN i.id IS NULL THEN 'DELETE' WHEN d.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @uid, @origem
  FROM inserted i FULL JOIN deleted d ON d.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER dados.trg_credenciais_auditoria ON dados.credenciais_externas
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  DECLARE @origem VARCHAR(30) = CASE WHEN @uid IS NULL THEN 'SSMS/manual' ELSE 'aplicacao' END;
  INSERT INTO auditoria.logs (tabela, registro_id, operacao, usuario_id, origem)
  SELECT 'credenciais_externas', COALESCE(i.perfil_id, d.perfil_id),
    CASE WHEN i.perfil_id IS NULL THEN 'DELETE' WHEN d.perfil_id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    @uid, @origem
  FROM inserted i FULL JOIN deleted d ON d.perfil_id = i.perfil_id;
END;
GO

-- Permissões equivalentes às de app_chamados em produção (o usuário é criado por db/teste/preparar.ts)
IF DATABASE_PRINCIPAL_ID('app_chamados') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT ON auditoria.credencial_acessos TO app_chamados;
  GRANT SELECT, INSERT ON auditoria.logs TO app_chamados;
  GRANT SELECT, INSERT, UPDATE ON dados.arquivos_chamados TO app_chamados;
  GRANT SELECT, INSERT, UPDATE ON dados.chamados TO app_chamados;
  DENY DELETE ON dados.chamados TO app_chamados;
  GRANT SELECT, INSERT, UPDATE ON dados.credenciais_externas TO app_chamados;
  GRANT SELECT, INSERT, UPDATE ON dados.motivos TO app_chamados;
  GRANT SELECT, INSERT, UPDATE ON dados.perfis TO app_chamados;
  GRANT SELECT, INSERT, UPDATE ON dados.polos TO app_chamados;
  GRANT SELECT, INSERT, UPDATE ON dados.tokens_recuperacao TO app_chamados;
  GRANT EXECUTE ON dados.gerar_protocolo TO app_chamados;
  GRANT EXECUTE ON dados.revelar_credencial TO app_chamados;
  GRANT EXECUTE ON seg.definir_contexto TO app_chamados;
END;
GO
