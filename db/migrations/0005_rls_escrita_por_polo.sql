-- =============================================================================
-- 0005 - REGRA DE ESCRITA (RLS) DE dados.chamados ALINHADA À AUTORIZAÇÃO DA APLICAÇÃO
--
-- Regra anterior (seg.fn_escrita_chamado): UPDATE só por papel 'admin' ou por 'atendente' que
-- CRIOU o chamado. Efeitos: coordenação não altera nenhum chamado; colega do mesmo polo não
-- complementa, transfere nem registra interação; reatribuição de pendências de conta
-- desativada é impossível sem admin. O papel vinha do SESSION_CONTEXT informado pela aplicação.
--
-- Regra nova (seg.fn_escrita_chamado_v2), igual a lib/auth/autorizacao.ts:
--   perfil ATIVO lido de dados.perfis (não confia no papel informado na sessão) e
--     - papel admin: qualquer chamado; ou
--     - perfil com polo: chamados do mesmo polo; ou
--     - perfil sem polo: chamados que criou ou pelos quais é responsável.
-- O filtro de leitura (seg.fn_leitura_com_contexto) não muda.
-- Requer a 0002 (coluna responsavel_id). Reversão: rollback/0005_rls_escrita_por_polo.down.sql
-- =============================================================================
SET NOCOUNT ON;
GO
CREATE OR ALTER FUNCTION seg.fn_escrita_chamado_v2(
  @criado_por UNIQUEIDENTIFIER,
  @responsavel_id UNIQUEIDENTIFIER,
  @polo_id UNIQUEIDENTIFIER)
RETURNS TABLE
WITH SCHEMABINDING
AS RETURN
  SELECT 1 AS permitido
  FROM dados.perfis p
  WHERE p.id = CAST(SESSION_CONTEXT(N'usuario_id') AS UNIQUEIDENTIFIER)
    AND p.ativo = 1
    AND (
      p.papel = 'admin'
      OR (p.polo_id IS NOT NULL AND p.polo_id = @polo_id)
      OR (p.polo_id IS NULL AND (p.id = @criado_por OR p.id = @responsavel_id))
    );
GO
ALTER SECURITY POLICY seg.pol_chamados
  DROP BLOCK PREDICATE ON dados.chamados AFTER UPDATE,
  DROP BLOCK PREDICATE ON dados.chamados BEFORE UPDATE;
GO
ALTER SECURITY POLICY seg.pol_chamados
  ADD BLOCK PREDICATE seg.fn_escrita_chamado_v2(criado_por, responsavel_id, polo_id) ON dados.chamados AFTER UPDATE,
  ADD BLOCK PREDICATE seg.fn_escrita_chamado_v2(criado_por, responsavel_id, polo_id) ON dados.chamados BEFORE UPDATE;
GO
