-- REVERSÃO 0001. Perde prazo calculado, marcação/justificativa de ajuste manual e feriados
-- cadastrados (exporte antes). O prazo efetivo (coluna prazo) é preservado.
SET NOCOUNT ON;
GO
DROP TABLE IF EXISTS dados.feriados;
IF OBJECT_ID('dados.fk_chamados_prazo_ajustado_por') IS NOT NULL ALTER TABLE dados.chamados DROP CONSTRAINT fk_chamados_prazo_ajustado_por;
GO
IF COL_LENGTH('dados.chamados', 'prazo_calculado') IS NOT NULL
BEGIN
  ALTER TABLE dados.chamados DROP CONSTRAINT df_chamados_prazo_ajuste_manual;
  ALTER TABLE dados.chamados DROP COLUMN prazo_calculado, prazo_ajuste_manual, prazo_ajuste_justificativa, prazo_ajustado_por, prazo_ajustado_em;
END;
GO
DELETE FROM dbo.migracoes_aplicadas WHERE versao = '0001';
GO
