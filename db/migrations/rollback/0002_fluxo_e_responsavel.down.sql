-- REVERSÃO 0002. ATENÇÃO: transforma dados.
-- 1) Situações novas voltam para 'aguardando' (a versão anterior não as conhece).
-- 2) Responsável, resolução, motivo de encerramento, próxima ação, status externo, marcação de
--    teste e o histórico estruturado (dados.chamado_eventos) são perdidos — exporte antes.
-- 0) Reverta a 0005 antes desta (a regra de escrita v2 usa responsavel_id).
SET NOCOUNT ON;
GO
-- A RLS de dados.chamados esconde e bloqueia linhas sem contexto de sessão; desliga só durante o UPDATE.
ALTER SECURITY POLICY seg.pol_chamados WITH (STATE = OFF);
UPDATE dados.chamados SET situacao = 'aguardando' WHERE situacao IN ('em_atendimento', 'aguardando_aluno', 'aguardando_externo');
ALTER SECURITY POLICY seg.pol_chamados WITH (STATE = ON);
GO
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_chamados_situacao') ALTER TABLE dados.chamados DROP CONSTRAINT ck_chamados_situacao;
ALTER TABLE dados.chamados ADD CONSTRAINT ck_chamados_situacao CHECK (situacao IN ('aguardando', 'concluido', 'encerrado', 'rascunho'));
GO
DROP INDEX IF EXISTS ix_chamados_abertura ON dados.chamados;
DROP INDEX IF EXISTS ix_chamados_situacao_prazo ON dados.chamados;
DROP INDEX IF EXISTS ix_chamados_conclusao ON dados.chamados;
DROP INDEX IF EXISTS ix_chamados_responsavel ON dados.chamados;
DROP INDEX IF EXISTS ix_chamados_vinculado ON dados.chamados;
DROP INDEX IF EXISTS ix_logs_tabela_registro ON auditoria.logs;
DROP INDEX IF EXISTS ix_logs_criado_em ON auditoria.logs;
GO
DROP TABLE IF EXISTS dados.chamado_eventos;
IF OBJECT_ID('dados.fk_chamados_responsavel') IS NOT NULL ALTER TABLE dados.chamados DROP CONSTRAINT fk_chamados_responsavel;
IF OBJECT_ID('dados.ck_chamados_motivo_encerramento') IS NOT NULL ALTER TABLE dados.chamados DROP CONSTRAINT ck_chamados_motivo_encerramento;
GO
IF COL_LENGTH('dados.chamados', 'responsavel_id') IS NOT NULL
BEGIN
  ALTER TABLE dados.chamados DROP CONSTRAINT df_chamados_reaberturas, df_chamados_eh_teste;
  ALTER TABLE dados.chamados DROP COLUMN responsavel_id, resolucao, motivo_encerramento, ultima_interacao_em,
    proxima_acao, proxima_acao_em, status_externo, reaberturas, eh_teste;
END;
GO
DELETE FROM dbo.migracoes_aplicadas WHERE versao = '0002';
GO
