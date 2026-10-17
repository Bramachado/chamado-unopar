-- =============================================================================
-- 0004 - SEGURANÇA, COFRE E AUDITORIA
--
-- * Triggers de auditoria passam a gravar:
--     - ip: lido de SESSION_CONTEXT(N'ip'), definido pela aplicação a partir do proxy confiável
--       (antes ficava NULL e a interface exibia "127.0.0.1" como valor substituto);
--     - campos_alterados: lista JSON das colunas que mudaram (antes ficava NULL);
--     - dados sensíveis redigidos: senha_hash (perfis), senha_cifrada/iv/auth_tag (cofre) e CPF
--       mascarado (chamados). A detecção de mudança usa os valores originais.
--   Atomicidade: o trigger roda na mesma transação da alteração.
-- * Revelação de credencial do cofre exige justificativa (gravada em credencial_acessos).
-- * perfis.sessao_valida_desde: sessões emitidas antes desta data são recusadas
--   (troca de senha, redefinição pelo administrador, desativação).
-- * Anexos: exclusão lógica (excluido_em/excluido_por), hash SHA-256 e conteúdo em tabela
--   própria (dados.arquivos_conteudo) em vez de auditoria.logs. Conteúdos antigos continuam
--   legíveis em auditoria.logs (tabela = 'arquivos_conteudo'), que não é alterada.
-- * Para a aplicação, auditoria.logs, credencial_acessos e chamado_eventos são somente-inclusão.
-- Reversão: db/migrations/rollback/0004_seguranca_e_auditoria.down.sql
-- =============================================================================
SET NOCOUNT ON;
GO
IF COL_LENGTH('auditoria.credencial_acessos', 'justificativa') IS NULL
  ALTER TABLE auditoria.credencial_acessos ADD justificativa NVARCHAR(500) NULL;
IF COL_LENGTH('dados.perfis', 'sessao_valida_desde') IS NULL
  ALTER TABLE dados.perfis ADD sessao_valida_desde DATETIMEOFFSET(3) NULL;
IF COL_LENGTH('dados.arquivos_chamados', 'excluido_em') IS NULL
  ALTER TABLE dados.arquivos_chamados ADD
    excluido_em DATETIMEOFFSET(3) NULL,
    excluido_por UNIQUEIDENTIFIER NULL,
    sha256 VARCHAR(64) NULL;
GO
IF OBJECT_ID('dados.fk_arquivos_excluido_por') IS NULL
  ALTER TABLE dados.arquivos_chamados ADD CONSTRAINT fk_arquivos_excluido_por
    FOREIGN KEY (excluido_por) REFERENCES dados.perfis(id);
GO
IF OBJECT_ID('dados.arquivos_conteudo') IS NULL
CREATE TABLE dados.arquivos_conteudo (
  arquivo_id UNIQUEIDENTIFIER NOT NULL,
  conteudo VARBINARY(MAX) NOT NULL,
  criado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_arquivos_conteudo_criado DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_arquivos_conteudo PRIMARY KEY (arquivo_id),
  CONSTRAINT fk_arquivos_conteudo_arquivo FOREIGN KEY (arquivo_id) REFERENCES dados.arquivos_chamados(id)
);
GO

CREATE OR ALTER PROCEDURE dados.revelar_credencial
  @perfil_alvo UNIQUEIDENTIFIER,
  @ip VARCHAR(45) = NULL,
  @user_agent NVARCHAR(400) = NULL,
  @justificativa NVARCHAR(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  IF @uid IS NULL THROW 51010, 'Contexto de usuario ausente.', 1;
  DECLARE @papel_real VARCHAR(20) = (SELECT papel FROM dados.perfis WHERE id = @uid AND ativo = 1);
  IF ISNULL(@papel_real, '') <> 'admin' THROW 51011, 'Apenas administradoras podem revelar credenciais.', 1;
  IF LEN(LTRIM(RTRIM(ISNULL(@justificativa, N'')))) < 10
    THROW 51012, 'Informe a justificativa (mínimo de 10 caracteres) para revelar a credencial.', 1;
  INSERT INTO auditoria.credencial_acessos (perfil_alvo, admin_id, ip, user_agent, justificativa)
  VALUES (@perfil_alvo, @uid, @ip, @user_agent, LTRIM(RTRIM(@justificativa)));
  SELECT senha_cifrada, iv, auth_tag FROM dados.credenciais_externas WHERE perfil_id = @perfil_alvo;
END;
GO

CREATE OR ALTER TRIGGER dados.trg_chamados_auditoria ON dados.chamados
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  DECLARE @unome NVARCHAR(200) = (SELECT nome_completo FROM dados.perfis WHERE id = @uid);
  DECLARE @ip VARCHAR(45) = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
  DECLARE @origem VARCHAR(30) = CASE WHEN @uid IS NULL THEN 'SSMS/manual' ELSE 'aplicacao' END;

  INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_antes, dados_depois,
                              campos_alterados, usuario_id, usuario_nome, protocolo, ip, origem)
  SELECT 'chamados', COALESCE(i.id, d.id),
    CASE WHEN i.id IS NULL THEN 'DELETE' WHEN d.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    JSON_MODIFY(j.antes, '$.aluno_cpf',
      CASE WHEN d.aluno_cpf IS NULL THEN NULL ELSE '***' + SUBSTRING(d.aluno_cpf, 4, 6) + '**' END),
    JSON_MODIFY(j.depois, '$.aluno_cpf',
      CASE WHEN i.aluno_cpf IS NULL THEN NULL ELSE '***' + SUBSTRING(i.aluno_cpf, 4, 6) + '**' END),
    c.campos, @uid, @unome, COALESCE(i.protocolo, d.protocolo), @ip, @origem
  FROM inserted i
  FULL JOIN deleted d ON d.id = i.id
  CROSS APPLY (SELECT
    CASE WHEN d.id IS NULL THEN NULL
      ELSE (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END AS antes,
    CASE WHEN i.id IS NULL THEN NULL
      ELSE (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END AS depois) j
  OUTER APPLY (SELECT '[' + STRING_AGG('"' + STRING_ESCAPE(COALESCE(a.[key], b.[key]), 'json') + '"', ',') + ']' AS campos
    FROM OPENJSON(j.antes) a FULL JOIN OPENJSON(j.depois) b ON a.[key] = b.[key]
    WHERE j.antes IS NOT NULL AND j.depois IS NOT NULL
      AND ISNULL(a.value, N'<nulo>') COLLATE Latin1_General_BIN2 <> ISNULL(b.value, N'<nulo>') COLLATE Latin1_General_BIN2) c;
END;
GO

CREATE OR ALTER TRIGGER dados.trg_perfis_auditoria ON dados.perfis
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  DECLARE @unome NVARCHAR(200) = (SELECT nome_completo FROM dados.perfis WHERE id = @uid);
  DECLARE @ip VARCHAR(45) = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
  DECLARE @origem VARCHAR(30) = CASE WHEN @uid IS NULL THEN 'SSMS/manual' ELSE 'aplicacao' END;

  INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_antes, dados_depois,
                              campos_alterados, usuario_id, usuario_nome, ip, origem)
  SELECT 'perfis', COALESCE(i.id, d.id),
    CASE WHEN i.id IS NULL THEN 'DELETE' WHEN d.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    JSON_MODIFY(j.antes, '$.senha_hash', CASE WHEN d.id IS NULL THEN NULL ELSE '[redigido]' END),
    JSON_MODIFY(j.depois, '$.senha_hash', CASE WHEN i.id IS NULL THEN NULL ELSE '[redigido]' END),
    c.campos, @uid, @unome, @ip, @origem
  FROM inserted i
  FULL JOIN deleted d ON d.id = i.id
  CROSS APPLY (SELECT
    CASE WHEN d.id IS NULL THEN NULL
      ELSE (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END AS antes,
    CASE WHEN i.id IS NULL THEN NULL
      ELSE (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END AS depois) j
  OUTER APPLY (SELECT '[' + STRING_AGG('"' + STRING_ESCAPE(COALESCE(a.[key], b.[key]), 'json') + '"', ',') + ']' AS campos
    FROM OPENJSON(j.antes) a FULL JOIN OPENJSON(j.depois) b ON a.[key] = b.[key]
    WHERE j.antes IS NOT NULL AND j.depois IS NOT NULL
      AND ISNULL(a.value, N'<nulo>') COLLATE Latin1_General_BIN2 <> ISNULL(b.value, N'<nulo>') COLLATE Latin1_General_BIN2) c;
END;
GO

CREATE OR ALTER TRIGGER dados.trg_motivos_auditoria ON dados.motivos
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  DECLARE @unome NVARCHAR(200) = (SELECT nome_completo FROM dados.perfis WHERE id = @uid);
  DECLARE @ip VARCHAR(45) = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
  DECLARE @origem VARCHAR(30) = CASE WHEN @uid IS NULL THEN 'SSMS/manual' ELSE 'aplicacao' END;

  INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_antes, dados_depois,
                              campos_alterados, usuario_id, usuario_nome, ip, origem)
  SELECT 'motivos', COALESCE(i.id, d.id),
    CASE WHEN i.id IS NULL THEN 'DELETE' WHEN d.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    j.antes, j.depois, c.campos, @uid, @unome, @ip, @origem
  FROM inserted i
  FULL JOIN deleted d ON d.id = i.id
  CROSS APPLY (SELECT
    CASE WHEN d.id IS NULL THEN NULL
      ELSE (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END AS antes,
    CASE WHEN i.id IS NULL THEN NULL
      ELSE (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END AS depois) j
  OUTER APPLY (SELECT '[' + STRING_AGG('"' + STRING_ESCAPE(COALESCE(a.[key], b.[key]), 'json') + '"', ',') + ']' AS campos
    FROM OPENJSON(j.antes) a FULL JOIN OPENJSON(j.depois) b ON a.[key] = b.[key]
    WHERE j.antes IS NOT NULL AND j.depois IS NOT NULL
      AND ISNULL(a.value, N'<nulo>') COLLATE Latin1_General_BIN2 <> ISNULL(b.value, N'<nulo>') COLLATE Latin1_General_BIN2) c;
END;
GO

CREATE OR ALTER TRIGGER dados.trg_credenciais_auditoria ON dados.credenciais_externas
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  DECLARE @unome NVARCHAR(200) = (SELECT nome_completo FROM dados.perfis WHERE id = @uid);
  DECLARE @ip VARCHAR(45) = CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45));
  DECLARE @origem VARCHAR(30) = CASE WHEN @uid IS NULL THEN 'SSMS/manual' ELSE 'aplicacao' END;

  -- Valores cifrados nunca vão para a auditoria; registra-se apenas quem alterou e quando.
  INSERT INTO auditoria.logs (tabela, registro_id, operacao, dados_antes, dados_depois,
                              campos_alterados, usuario_id, usuario_nome, ip, origem)
  SELECT 'credenciais_externas', COALESCE(i.perfil_id, d.perfil_id),
    CASE WHEN i.perfil_id IS NULL THEN 'DELETE' WHEN d.perfil_id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    CASE WHEN d.perfil_id IS NULL THEN NULL ELSE
      (SELECT d.perfil_id, '[redigido]' AS senha_cifrada, d.atualizado_em, d.atualizado_por
       FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END,
    CASE WHEN i.perfil_id IS NULL THEN NULL ELSE
      (SELECT i.perfil_id, '[redigido]' AS senha_cifrada, i.atualizado_em, i.atualizado_por
       FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END,
    CASE WHEN i.perfil_id IS NOT NULL AND d.perfil_id IS NOT NULL THEN '["senha_cifrada"]' END,
    @uid, @unome, @ip, @origem
  FROM inserted i
  FULL JOIN deleted d ON d.perfil_id = i.perfil_id;
END;
GO

IF DATABASE_PRINCIPAL_ID('app_chamados') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT ON dados.arquivos_conteudo TO app_chamados;
  DENY UPDATE, DELETE ON auditoria.logs TO app_chamados;
  DENY UPDATE, DELETE ON auditoria.credencial_acessos TO app_chamados;
  DENY DELETE ON dados.arquivos_chamados TO app_chamados;
END;
GO
