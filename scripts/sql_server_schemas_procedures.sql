-- ==============================================================================
-- SISTEMA DE CHAMADOS UNOPAR - SCRIPTS REVISADOS PARA SSMS
-- Revisao sobre o arquivo do agente. Aplicar BLOCO A BLOCO, na ordem.
-- NAO rode o arquivo inteiro de uma vez: cada bloco tem um ponto de verificacao.
-- ==============================================================================
USE [ChamadosUnopar];
GO

-- ==============================================================================
-- BLOCO 0 - VERIFICACAO PREVIA (nao altera nada; so confirma o estado real)
-- Rode este bloco PRIMEIRO e confira a saida antes de qualquer outro.
-- ==============================================================================

PRINT '=== Procedure definir_contexto: qual o nome do parametro? ===';
SELECT p.name AS parametro, TYPE_NAME(p.user_type_id) AS tipo
FROM sys.parameters p
WHERE p.object_id = OBJECT_ID('seg.definir_contexto')
ORDER BY p.parameter_id;
-- Esperado: @usuario_id e @papel. Se vier @uid, avise antes de continuar.

PRINT '=== Colunas de auditoria.credencial_acessos ===';
SELECT name AS coluna FROM sys.columns
WHERE object_id = OBJECT_ID('auditoria.credencial_acessos') ORDER BY column_id;
-- Esperado conter: perfil_alvo, admin_id (NAO perfil_alvo_id / acessado_por)

PRINT '=== Colunas de auditoria.logs ===';
SELECT name AS coluna FROM sys.columns
WHERE object_id = OBJECT_ID('auditoria.logs') ORDER BY column_id;
-- Esperado conter: origem, dados_antes, dados_depois, campos_alterados

PRINT '=== Tabela credenciais_externas existe? Colunas? ===';
SELECT name AS coluna FROM sys.columns
WHERE object_id = OBJECT_ID('dados.credenciais_externas') ORDER BY column_id;
-- Esperado: perfil_id, senha_cifrada, iv, auth_tag, atualizado_em, atualizado_por
GO

-- ##############################################################################
-- >>> PARE AQUI. Cole a saida do BLOCO 0. So continue depois de confirmarmos.
-- ##############################################################################


-- ==============================================================================
-- BLOCO 1 - GERAR PROTOCOLO (revisado: fuso correto + robustez)
-- Corrige: (a) descarte de fuso ao cair em DATETIME
--          (b) dependencia fragil do RIGHT(...,4)
-- ==============================================================================
CREATE OR ALTER PROCEDURE dados.gerar_protocolo
    @data_solicitacao DATE = NULL,          -- opcional; default = hoje no fuso de SP
    @protocolo_gerado VARCHAR(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- Data de referencia: se nao informada, usa a data atual no fuso de Sao Paulo.
    -- Converte para DATE (sem hora), evitando o problema de virada de meia-noite.
    DECLARE @data_ref DATE =
        ISNULL(@data_solicitacao,
               CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE));

    DECLARE @data_str CHAR(8) = FORMAT(@data_ref, 'yyyyMMdd');
    DECLARE @prefixo   VARCHAR(11) = 'CS' + @data_str + '-';   -- ex: CS20260902-
    DECLARE @proximo   INT;

    BEGIN TRAN;

        -- Trava a faixa do dia para impedir dois protocolos iguais em concorrencia.
        -- So considera protocolos do formato novo (com traco), ignorando historico.
        SELECT @proximo = ISNULL(MAX(
                    TRY_CAST(SUBSTRING(protocolo, LEN(@prefixo) + 1, 4) AS INT)
               ), 0) + 1
        FROM dados.chamados WITH (UPDLOCK, HOLDLOCK)
        WHERE protocolo LIKE @prefixo + '[0-9][0-9][0-9][0-9]';

        SET @protocolo_gerado = @prefixo + RIGHT('0000' + CAST(@proximo AS VARCHAR(4)), 4);

    COMMIT TRAN;
END;
GO

-- Verificacao do BLOCO 1: gera dois protocolos seguidos (devem ser -0001 e -0002
-- se o dia estiver vazio; NAO insere nada, so testa a numeracao)
PRINT '=== Teste gerar_protocolo (nao insere, so gera) ===';
DECLARE @p1 VARCHAR(20), @p2 VARCHAR(20);
EXEC dados.gerar_protocolo @protocolo_gerado = @p1 OUTPUT;
PRINT 'Primeiro protocolo do dia: ' + @p1;
-- Formato esperado: CSAAAAMMDD-000N
GO

-- ##############################################################################
-- >>> PARE. Cole a saida. Confirme o formato antes de seguir.
-- ##############################################################################


-- ==============================================================================
-- BLOCO 2 - TOKENS DE RECUPERACAO DE SENHA
-- (versao do agente estava ok; ajustes: DATETIMEOFFSET(3) e nome de indice)
-- ==============================================================================
IF OBJECT_ID('dados.tokens_recuperacao') IS NULL
BEGIN
    CREATE TABLE dados.tokens_recuperacao (
        id            BIGINT IDENTITY(1,1) NOT NULL,
        perfil_id     UNIQUEIDENTIFIER NOT NULL,
        token_hash    VARCHAR(255) NOT NULL,
        expira_em     DATETIMEOFFSET(3) NOT NULL,
        utilizado_em  DATETIMEOFFSET(3) NULL,
        criado_em     DATETIMEOFFSET(3) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT pk_tokens_recuperacao PRIMARY KEY (id),
        CONSTRAINT fk_tokens_perfil FOREIGN KEY (perfil_id)
            REFERENCES dados.perfis(id) ON DELETE CASCADE
    );
    CREATE INDEX ix_tokens_perfil ON dados.tokens_recuperacao(perfil_id, token_hash);
    PRINT 'Tabela dados.tokens_recuperacao criada.';
END
ELSE
    PRINT 'Tabela dados.tokens_recuperacao ja existe; nada feito.';
GO


-- ==============================================================================
-- BLOCO 3 - REVELAR CREDENCIAL (o agente NAO forneceu esta procedure)
-- Valida papel admin no servidor, registra o acesso ANTES de retornar,
-- e devolve os bytes cifrados (a descriptografia acontece no Node).
-- Usa os nomes REAIS do banco: perfil_alvo, admin_id.
-- ==============================================================================
CREATE OR ALTER PROCEDURE dados.revelar_credencial
    @perfil_alvo UNIQUEIDENTIFIER,
    @ip          VARCHAR(45)  = NULL,
    @user_agent  NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @uid   UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
    DECLARE @papel VARCHAR(20)      = CAST(SESSION_CONTEXT(N'papel') AS VARCHAR(20));

    -- Sem contexto, nao faz nada
    IF @uid IS NULL
        THROW 51010, 'Contexto de usuario ausente.', 1;

    -- Confirma o papel no banco, nao confia no que veio no contexto
    DECLARE @papel_real VARCHAR(20) = (SELECT papel FROM dados.perfis WHERE id = @uid AND ativo = 1);
    IF @papel_real <> 'admin'
        THROW 51011, 'Apenas administradoras podem revelar credenciais.', 1;

    -- Registra o acesso ANTES de devolver a senha
    INSERT INTO auditoria.credencial_acessos (perfil_alvo, admin_id, ip, user_agent)
    VALUES (@perfil_alvo, @uid, @ip, @user_agent);

    -- Devolve os bytes cifrados
    SELECT senha_cifrada, iv, auth_tag
    FROM dados.credenciais_externas
    WHERE perfil_id = @perfil_alvo;
END;
GO

-- Verificacao do BLOCO 3: atendente deve ser bloqueada, admin deve passar
PRINT '=== TESTE revelar_credencial como ATENDENTE (deve dar erro 51011) ===';
EXEC seg.definir_contexto @usuario_id='00000000-0000-0000-0000-000000000003', @papel='atendente';
BEGIN TRY
    EXEC dados.revelar_credencial @perfil_alvo='00000000-0000-0000-0000-000000000001';
    PRINT 'FALHOU: atendente conseguiu chamar sem erro.';
END TRY
BEGIN CATCH
    PRINT 'OK: bloqueado - ' + ERROR_MESSAGE();
END CATCH
GO

-- ##############################################################################
-- >>> PARE. Cole a saida. O teste como atendente deve mostrar "OK: bloqueado".
-- ##############################################################################


-- ==============================================================================
-- BLOCO 4 - TRIGGER DE AUDITORIA EM dados.chamados (reescrita)
-- Corrige o padrao (SELECT i.* FOR JSON ...) que serializa errado,
-- usando uma subquery correlacionada por id para cada linha.
-- ==============================================================================
CREATE OR ALTER TRIGGER dados.trg_chamados_auditoria
ON dados.chamados
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @uid    UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
    DECLARE @unome  NVARCHAR(200);
    DECLARE @origem VARCHAR(30);

    IF @uid IS NULL
    BEGIN
        SET @unome  = NULL;
        SET @origem = 'SSMS/manual';
    END
    ELSE
    BEGIN
        SET @unome  = (SELECT nome_completo FROM dados.perfis WHERE id = @uid);
        SET @origem = 'aplicacao';
    END

    -- INSERT
    IF EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted)
        INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_depois,
                                    usuario_id, usuario_nome, protocolo, origem)
        SELECT 'chamados', CAST(i.id AS VARCHAR(100)), 'INSERT',
               (SELECT x.* FROM dados.chamados x WHERE x.id = i.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @uid, @unome, i.protocolo, @origem
        FROM inserted i;

    -- DELETE fisico (nao deveria ocorrer; exclusao e logica)
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
        INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_antes,
                                    usuario_id, usuario_nome, protocolo, origem)
        SELECT 'chamados', CAST(d.id AS VARCHAR(100)), 'DELETE',
               (SELECT * FROM (SELECT d.*) z FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @uid, @unome, d.protocolo, @origem
        FROM deleted d;

    -- UPDATE
    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
        INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_antes, dados_depois,
                                    usuario_id, usuario_nome, protocolo, origem)
        SELECT 'chamados', CAST(i.id AS VARCHAR(100)), 'UPDATE',
               (SELECT * FROM (SELECT d.*) z  FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               (SELECT x.* FROM dados.chamados x WHERE x.id = i.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @uid, @unome, i.protocolo, @origem
        FROM inserted i
        INNER JOIN deleted d ON d.id = i.id;
END;
GO

-- Verificacao do BLOCO 4: alterar um chamado e ver o log
PRINT '=== TESTE trigger: update gera log? ===';
EXEC seg.definir_contexto @usuario_id='00000000-0000-0000-0000-000000000001', @papel='admin';
UPDATE dados.chamados SET observacao = 'teste trigger auditoria'
WHERE protocolo = 'CS90000001';
SELECT TOP 3 tabela, operacao, origem, usuario_nome, protocolo, criado_em
FROM auditoria.logs ORDER BY id DESC;
GO

-- ##############################################################################
-- >>> PARE. Cole a saida. Deve haver uma linha UPDATE com origem=aplicacao.
-- ##############################################################################
