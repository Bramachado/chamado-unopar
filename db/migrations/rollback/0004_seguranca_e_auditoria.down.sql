-- REVERSÃO 0004. Restaura procedure/triggers anteriores e remove colunas/tabela novas.
-- ATENÇÃO: conteúdo de anexos enviados após a 0004 está em dados.arquivos_conteudo; exporte-o antes
-- (ou mantenha a tabela) — a versão anterior da aplicação lia anexos de auditoria.logs/disco.
-- Justificativas de acesso ao cofre e dados de exclusão lógica de anexos serão perdidos.
SET NOCOUNT ON;
GO
CREATE OR ALTER PROCEDURE dados.revelar_credencial
  @perfil_alvo UNIQUEIDENTIFIER, @ip VARCHAR(45) = NULL, @user_agent NVARCHAR(400) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @uid UNIQUEIDENTIFIER = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER);
  IF @uid IS NULL THROW 51010, 'Contexto de usuario ausente.', 1;
  DECLARE @papel_real VARCHAR(20) = (SELECT papel FROM dados.perfis WHERE id = @uid AND ativo = 1);
  IF @papel_real <> 'admin' THROW 51011, 'Apenas administradoras podem revelar credenciais.', 1;
  INSERT INTO auditoria.credencial_acessos (perfil_alvo, admin_id, ip, user_agent) VALUES (@perfil_alvo, @uid, @ip, @user_agent);
  SELECT senha_cifrada, iv, auth_tag FROM dados.credenciais_externas WHERE perfil_id = @perfil_alvo;
END;
GO
-- Triggers: reaplicar as definições anteriores (scripts/sql_server_schemas_procedures.sql, BLOCO 4,
-- e as versões de perfis/motivos/credenciais exportadas da produção ANTES da 0004 — ver DIAGNOSTICO.md).
IF OBJECT_ID('dados.arquivos_conteudo') IS NOT NULL PRINT 'Mantendo dados.arquivos_conteudo (exporte antes de remover).';
GO
IF OBJECT_ID('dados.fk_arquivos_excluido_por') IS NOT NULL ALTER TABLE dados.arquivos_chamados DROP CONSTRAINT fk_arquivos_excluido_por;
GO
IF COL_LENGTH('dados.arquivos_chamados', 'excluido_em') IS NOT NULL ALTER TABLE dados.arquivos_chamados DROP COLUMN excluido_em, excluido_por, sha256;
IF COL_LENGTH('dados.perfis', 'sessao_valida_desde') IS NOT NULL ALTER TABLE dados.perfis DROP COLUMN sessao_valida_desde;
IF COL_LENGTH('auditoria.credencial_acessos', 'justificativa') IS NOT NULL ALTER TABLE auditoria.credencial_acessos DROP COLUMN justificativa;
GO
DELETE FROM dbo.migracoes_aplicadas WHERE versao = '0004';
GO
