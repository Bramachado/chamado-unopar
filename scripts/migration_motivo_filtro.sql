-- ==============================================================================
-- SISTEMA DE CHAMADOS UNOPAR - MIGRATION CAMPO 'FILTRO' (CAMINHO DO MOTIVO)
-- Executar no SQL Server Management Studio (SSMS) no banco ChamadosUnopar
-- ==============================================================================
USE [ChamadosUnopar];
GO

-- 1. Adicionar coluna 'filtro' na tabela dados.motivos
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dados.motivos') AND name = 'filtro'
)
BEGIN
    ALTER TABLE dados.motivos ADD filtro NVARCHAR(500) NULL;
    PRINT 'Coluna filtro adicionada com sucesso em dados.motivos.';
END
ELSE
BEGIN
    PRINT 'Coluna filtro ja existe em dados.motivos.';
END
GO

-- 2. Conceder permissões para o usuário da aplicação (app_chamados)
GRANT SELECT, INSERT, UPDATE ON dados.motivos TO app_chamados;
GO

PRINT '=== MIGRATION CONCLUIDA COM SUCESSO ===';
GO
