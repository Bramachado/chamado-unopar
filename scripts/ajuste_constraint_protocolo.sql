-- ==============================================================================
-- SISTEMA DE CHAMADOS UNOPAR - AJUSTE DA RESTRIÇÃO DE PROTOCOLO
-- Executar no SQL Server Management Studio (SSMS) no banco ChamadosUnopar
-- ==============================================================================
USE [ChamadosUnopar];
GO

PRINT '=== Atualizando restrição de validação de protocolo ===';

-- 1. Remover a restrição antiga que exigia estritamente formato CS...
IF EXISTS (
    SELECT 1 FROM sys.check_constraints 
    WHERE name = 'ck_chamados_protocolo' AND parent_object_id = OBJECT_ID('dados.chamados')
)
BEGIN
    ALTER TABLE dados.chamados DROP CONSTRAINT ck_chamados_protocolo;
    PRINT 'Restrição antiga ck_chamados_protocolo removida com sucesso.';
END
GO

-- 2. Adicionar nova restrição flexível que aceita tanto protocolos do PAD (ex: C345235256),
--    quanto protocolos gerados automaticamente (ex: CS20260923-0001) e códigos com no mínimo 5 caracteres.
ALTER TABLE dados.chamados ADD CONSTRAINT ck_chamados_protocolo
    CHECK (LEN(LTRIM(RTRIM(protocolo))) >= 5);
GO

PRINT 'Nova restrição ck_chamados_protocolo aplicada com sucesso!';
