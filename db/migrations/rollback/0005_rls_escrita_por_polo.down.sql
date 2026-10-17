-- REVERSÃO 0005. Restaura exatamente a regra de escrita anterior (admin ou atendente criadora).
SET NOCOUNT ON;
GO
ALTER SECURITY POLICY seg.pol_chamados
  DROP BLOCK PREDICATE ON dados.chamados AFTER UPDATE,
  DROP BLOCK PREDICATE ON dados.chamados BEFORE UPDATE;
GO
ALTER SECURITY POLICY seg.pol_chamados
  ADD BLOCK PREDICATE seg.fn_escrita_chamado(criado_por) ON dados.chamados AFTER UPDATE,
  ADD BLOCK PREDICATE seg.fn_escrita_chamado(criado_por) ON dados.chamados BEFORE UPDATE;
GO
DROP FUNCTION IF EXISTS seg.fn_escrita_chamado_v2;
GO
DELETE FROM dbo.migracoes_aplicadas WHERE versao = '0005';
GO
