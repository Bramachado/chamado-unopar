-- ==============================================================================
-- SISTEMA DE GESTÃO DE CHAMADOS (UNOPAR / GRUPO EDUNORTE)
-- SCRIPTS DE ESTRUTURAS, PROCEDURES E TRIGGERS PARA SQL SERVER 2022
-- IMPORTANTE: Executar manualmente via SQL Server Management Studio (SSMS).
-- ==============================================================================

USE [ChamadosUnopar];
GO

-- ------------------------------------------------------------------------------
-- 1. SCHEMA SEPARADO PARA AUDITORIA E SEGURANÇA (caso ainda não existam)
-- ------------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'seg')
    EXEC('CREATE SCHEMA seg');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'auditoria')
    EXEC('CREATE SCHEMA auditoria');
GO

-- ------------------------------------------------------------------------------
-- 2. PROCEDURE DE CONTEXTO DE SEGURANÇA (Alimenta políticas RLS)
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE seg.definir_contexto
    @uid UNIQUEIDENTIFIER,
    @papel VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    EXEC sp_set_session_context @key = N'usuario_id', @value = @uid, @read_only = 0;
    EXEC sp_set_session_context @key = N'papel', @value = @papel, @read_only = 0;
END;
GO

-- ------------------------------------------------------------------------------
-- 3. PROCEDURE DE GERAÇÃO ATÔMICA DE PROTOCOLO SEQUENCIAL DIÁRIO (CSAAAAMMDD-NNNN)
-- ------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dados.gerar_protocolo
    @data_solicitacao DATETIMEOFFSET = NULL,
    @protocolo_gerado VARCHAR(30) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @data_ref DATETIME = ISNULL(@data_solicitacao, SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time');
    DECLARE @data_str VARCHAR(8) = FORMAT(@data_ref, 'yyyyMMdd');
    DECLARE @prefixo_base VARCHAR(10) = 'CS' + @data_str;
    DECLARE @proximo_numero INT;

    BEGIN TRANSACTION;

    SELECT @proximo_numero = ISNULL(MAX(CAST(RIGHT(protocolo, 4) AS INT)), 0) + 1
    FROM dados.chamados WITH (UPDLOCK, HOLDLOCK)
    WHERE protocolo LIKE @prefixo_base + '-%';

    SET @protocolo_gerado = @prefixo_base + '-' + RIGHT('0000' + CAST(@proximo_numero AS VARCHAR(4)), 4);

    COMMIT TRANSACTION;
END;
GO

-- ------------------------------------------------------------------------------
-- 4. TABELA DE TOKENS DE RECUPERAÇÃO DE SENHA
-- ------------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dados.tokens_recuperacao') AND type in (N'U'))
BEGIN
    CREATE TABLE dados.tokens_recuperacao (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        perfil_id UNIQUEIDENTIFIER NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expira_em DATETIMEOFFSET NOT NULL,
        utilizado_em DATETIMEOFFSET NULL,
        criado_em DATETIMEOFFSET NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_tokens_perfil FOREIGN KEY (perfil_id) REFERENCES dados.perfis(id) ON DELETE CASCADE
    );

    CREATE INDEX IX_tokens_recuperacao_perfil ON dados.tokens_recuperacao(perfil_id, token_hash);
END;
GO

-- ------------------------------------------------------------------------------
-- 5. TABELA DE LOGS DE AUDITORIA GERAL (Caso não exista)
-- ------------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'auditoria.logs') AND type in (N'U'))
BEGIN
    CREATE TABLE auditoria.logs (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        tabela VARCHAR(50) NOT NULL,
        registro_id VARCHAR(100) NULL,
        operacao VARCHAR(10) NOT NULL,
        dados_antes NVARCHAR(MAX) NULL,
        dados_depois NVARCHAR(MAX) NULL,
        campos_alterados NVARCHAR(MAX) NULL,
        usuario_id UNIQUEIDENTIFIER NULL,
        usuario_nome VARCHAR(255) NULL,
        protocolo VARCHAR(50) NULL,
        ip VARCHAR(45) NULL,
        criado_em DATETIMEOFFSET NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_auditoria_logs_tabela ON auditoria.logs(tabela, criado_em DESC);
    CREATE INDEX IX_auditoria_logs_registro ON auditoria.logs(registro_id);
END;
GO

-- ------------------------------------------------------------------------------
-- 6. TABELA DE LOGS DE ACESSO AO COFRE DE CREDENCIAIS
-- ------------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'auditoria.credencial_acessos') AND type in (N'U'))
BEGIN
    CREATE TABLE auditoria.credencial_acessos (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        perfil_alvo_id UNIQUEIDENTIFIER NOT NULL,
        acessado_por UNIQUEIDENTIFIER NOT NULL,
        ip VARCHAR(45) NULL,
        user_agent NVARCHAR(500) NULL,
        data_hora DATETIMEOFFSET NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_credencial_acessos_alvo ON auditoria.credencial_acessos(perfil_alvo_id, data_hora DESC);
END;
GO

-- ------------------------------------------------------------------------------
-- 7. TRIGGER DE AUDITORIA AUTOMÁTICA EM dados.chamados (Lê SESSION_CONTEXT)
-- ------------------------------------------------------------------------------
CREATE OR ALTER TRIGGER dados.trg_chamados_auditoria
ON dados.chamados
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @usuario_id UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
    DECLARE @usuario_nome VARCHAR(255) = NULL;

    IF @usuario_id IS NOT NULL
    BEGIN
        SELECT @usuario_nome = nome_completo FROM dados.perfis WHERE id = @usuario_id;
    END
    ELSE
    BEGIN
        SET @usuario_nome = 'SSMS/Manual';
    END

    -- INSERT
    IF EXISTS (SELECT * FROM inserted) AND NOT EXISTS (SELECT * FROM deleted)
    BEGIN
        INSERT INTO auditoria.logs (
            tabela, registro_id, operacao, dados_depois, usuario_id, usuario_nome, protocolo, criado_em
        )
        SELECT 
            'chamados',
            CAST(i.id AS VARCHAR(100)),
            'INSERT',
            (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @usuario_id,
            @usuario_nome,
            i.protocolo,
            SYSUTCDATETIME()
        FROM inserted i;
    END

    -- DELETE (Físico)
    IF EXISTS (SELECT * FROM deleted) AND NOT EXISTS (SELECT * FROM inserted)
    BEGIN
        INSERT INTO auditoria.logs (
            tabela, registro_id, operacao, dados_antes, usuario_id, usuario_nome, protocolo, criado_em
        )
        SELECT 
            'chamados',
            CAST(d.id AS VARCHAR(100)),
            'DELETE',
            (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @usuario_id,
            @usuario_nome,
            d.protocolo,
            SYSUTCDATETIME()
        FROM deleted d;
    END

    -- UPDATE
    IF EXISTS (SELECT * FROM inserted) AND EXISTS (SELECT * FROM deleted)
    BEGIN
        INSERT INTO auditoria.logs (
            tabela, registro_id, operacao, dados_antes, dados_depois, usuario_id, usuario_nome, protocolo, criado_em
        )
        SELECT 
            'chamados',
            CAST(i.id AS VARCHAR(100)),
            'UPDATE',
            (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @usuario_id,
            @usuario_nome,
            i.protocolo,
            SYSUTCDATETIME()
        FROM inserted i
        INNER JOIN deleted d ON d.id = i.id;
    END
END;
GO
