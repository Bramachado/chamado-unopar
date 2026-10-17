-- REVERSÃO 0003. Remove índice/colunas de chave e consolidação.
-- Chamados já migrados por consolidação NÃO voltam automaticamente: o motivo de origem de cada um
-- está em dados.chamado_eventos (tipo 'consolidacao_motivo', dados_json.motivo_origem) e em
-- auditoria.logs (dados_antes.motivo_id). Restaure manualmente se necessário ANTES desta reversão.
SET NOCOUNT ON;
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_motivos_chave_ativa') DROP INDEX uq_motivos_chave_ativa ON dados.motivos;
IF OBJECT_ID('dados.fk_motivos_consolidado_para') IS NOT NULL ALTER TABLE dados.motivos DROP CONSTRAINT fk_motivos_consolidado_para, fk_motivos_consolidado_por;
GO
IF COL_LENGTH('dados.motivos', 'chave_nome') IS NOT NULL ALTER TABLE dados.motivos DROP COLUMN chave_nome, chave_filtro;
IF COL_LENGTH('dados.motivos', 'descricao') IS NOT NULL ALTER TABLE dados.motivos DROP COLUMN descricao, consolidado_para_id, consolidado_em, consolidado_por, consolidacao_justificativa;
GO
DROP FUNCTION IF EXISTS dados.fn_chave_texto;
GO
DELETE FROM dbo.migracoes_aplicadas WHERE versao = '0003';
GO
