-- =============================================================================
-- 0003 - CATÁLOGO DE MOTIVOS: CHAVE DE NEGÓCIO, DUPLICIDADE E CONSOLIDAÇÃO
--
-- Chave de negócio de um motivo ativo = (nome normalizado, caminho/filtro normalizado).
-- Normalização (dados.fn_chave_texto): minúsculas, sem acentos, pontuação como espaço e espaços
-- repetidos colapsados. "Problema com o conteúdo" e "Problema com conteúdo" NÃO são iguais pela
-- chave (a diferença é uma palavra); a aplicação os aponta como SEMELHANTES antes da criação e a
-- consolidação é decisão humana, registrada (consolidado_para_id, justificativa, autor, data).
--
-- O índice único só é criado se não houver duplicidade exata entre motivos ativos. Se houver,
-- a migração para e lista os grupos — nada é unido automaticamente.
-- Reversão: db/migrations/rollback/0003_motivos_chave_e_consolidacao.down.sql
-- =============================================================================
SET NOCOUNT ON;
GO
CREATE OR ALTER FUNCTION dados.fn_chave_texto (@texto NVARCHAR(500))
RETURNS NVARCHAR(500)
WITH SCHEMABINDING
AS
BEGIN
  IF @texto IS NULL RETURN N'';
  DECLARE @s NVARCHAR(500) = LOWER(LTRIM(RTRIM(@texto)));
  SET @s = TRANSLATE(@s COLLATE Latin1_General_BIN2,
    N'áàâãäéèêëíìîïóòôõöúùûüçñýÿºª°',
    N'aaaaaeeeeiiiiooooouuuucnyyoao');
  DECLARE @pontuacao NVARCHAR(30) = N'.,;:/\-_()[]{}"''!?>|+*&';
  SET @s = TRANSLATE(@s COLLATE Latin1_General_BIN2, @pontuacao, REPLICATE(N' ', LEN(@pontuacao)));
  WHILE CHARINDEX(N'  ', @s) > 0 SET @s = REPLACE(@s, N'  ', N' ');
  RETURN LTRIM(RTRIM(@s));
END;
GO

IF COL_LENGTH('dados.motivos', 'chave_nome') IS NULL
  ALTER TABLE dados.motivos ADD
    chave_nome AS dados.fn_chave_texto(nome) PERSISTED,
    chave_filtro AS dados.fn_chave_texto(filtro) PERSISTED;
GO
IF COL_LENGTH('dados.motivos', 'descricao') IS NULL
  ALTER TABLE dados.motivos ADD
    descricao NVARCHAR(500) NULL,
    consolidado_para_id UNIQUEIDENTIFIER NULL,
    consolidado_em DATETIMEOFFSET(3) NULL,
    consolidado_por UNIQUEIDENTIFIER NULL,
    consolidacao_justificativa NVARCHAR(500) NULL;
GO
IF OBJECT_ID('dados.fk_motivos_consolidado_para') IS NULL
  ALTER TABLE dados.motivos ADD
    CONSTRAINT fk_motivos_consolidado_para FOREIGN KEY (consolidado_para_id) REFERENCES dados.motivos(id),
    CONSTRAINT fk_motivos_consolidado_por FOREIGN KEY (consolidado_por) REFERENCES dados.perfis(id);
GO

-- Pré-condição do índice único: nenhuma duplicidade EXATA entre ativos
IF EXISTS (
  SELECT 1 FROM dados.motivos WHERE ativo = 1
  GROUP BY chave_nome, chave_filtro HAVING COUNT(*) > 1)
BEGIN
  SELECT chave_nome, chave_filtro, STRING_AGG(CONCAT(codigo, ' ', nome), ' | ') AS motivos
  FROM dados.motivos WHERE ativo = 1
  GROUP BY chave_nome, chave_filtro HAVING COUNT(*) > 1;
  THROW 50301, 'Existem motivos ativos duplicados pela chave de negócio. Consolide-os pela tela de Motivos e execute esta migração novamente.', 1;
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_motivos_chave_ativa')
  CREATE UNIQUE INDEX uq_motivos_chave_ativa ON dados.motivos(chave_nome, chave_filtro) WHERE ativo = 1;
GO

IF DATABASE_PRINCIPAL_ID('app_chamados') IS NOT NULL
  GRANT EXECUTE ON dados.fn_chave_texto TO app_chamados;
GO
