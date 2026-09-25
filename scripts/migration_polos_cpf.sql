-- ==============================================================================
-- SISTEMA DE CHAMADOS UNOPAR - MIGRATION MULTI-POLO E CPF DO ALUNO
-- Executar no SQL Server Management Studio (SSMS) no banco ChamadosUnopar
-- ==============================================================================
USE [ChamadosUnopar];
GO

-- 1. Criar tabela dados.polos
IF OBJECT_ID('dados.polos') IS NULL
BEGIN
    CREATE TABLE dados.polos (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        nome NVARCHAR(150) NOT NULL,
        codigo VARCHAR(10) NOT NULL,
        cidade NVARCHAR(100) NOT NULL,
        estado VARCHAR(2) NOT NULL DEFAULT 'PR',
        ativo BIT NOT NULL DEFAULT 1,
        criado_em DATETIMEOFFSET(3) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT pk_polos PRIMARY KEY (id),
        CONSTRAINT unq_polos_codigo UNIQUE (codigo)
    );
    PRINT 'Tabela dados.polos criada com sucesso.';
END
GO

-- 2. Inserir os 3 polos iniciais
IF NOT EXISTS (SELECT 1 FROM dados.polos WHERE codigo = 'CAS')
BEGIN
    INSERT INTO dados.polos (id, nome, codigo, cidade, estado, ativo)
    VALUES ('11111111-1111-1111-1111-111111111111', N'Polo Cascavel', 'CAS', N'Cascavel', 'PR', 1);
END;

IF NOT EXISTS (SELECT 1 FROM dados.polos WHERE codigo = 'TOL')
BEGIN
    INSERT INTO dados.polos (id, nome, codigo, cidade, estado, ativo)
    VALUES ('22222222-2222-2222-2222-222222222222', N'Polo Toledo', 'TOL', N'Toledo', 'PR', 1);
END;

IF NOT EXISTS (SELECT 1 FROM dados.polos WHERE codigo = 'FOZ')
BEGIN
    INSERT INTO dados.polos (id, nome, codigo, cidade, estado, ativo)
    VALUES ('33333333-3333-3333-3333-333333333333', N'Polo Foz do Iguaçu', 'FOZ', N'Foz do Iguaçu', 'PR', 1);
END;
GO

-- 3. Adicionar coluna polo_id em dados.perfis
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dados.perfis') AND name = 'polo_id'
)
BEGIN
    ALTER TABLE dados.perfis ADD polo_id UNIQUEIDENTIFIER NULL;
    ALTER TABLE dados.perfis ADD CONSTRAINT fk_perfis_polo 
        FOREIGN KEY (polo_id) REFERENCES dados.polos(id);
    PRINT 'Coluna polo_id adicionada em dados.perfis.';
END
GO

-- 4. Adicionar colunas aluno_cpf e polo_id em dados.chamados
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dados.chamados') AND name = 'aluno_cpf'
)
BEGIN
    ALTER TABLE dados.chamados ADD aluno_cpf VARCHAR(14) NULL;
    PRINT 'Coluna aluno_cpf adicionada em dados.chamados.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dados.chamados') AND name = 'polo_id'
)
BEGIN
    ALTER TABLE dados.chamados ADD polo_id UNIQUEIDENTIFIER NULL;
    ALTER TABLE dados.chamados ADD CONSTRAINT fk_chamados_polo 
        FOREIGN KEY (polo_id) REFERENCES dados.polos(id);
    PRINT 'Coluna polo_id adicionada em dados.chamados.';
END
GO

-- 5. Criar índices para busca e integridade
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chamados_polo' AND object_id = OBJECT_ID('dados.chamados'))
BEGIN
    CREATE INDEX ix_chamados_polo ON dados.chamados(polo_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chamados_cpf' AND object_id = OBJECT_ID('dados.chamados'))
BEGIN
    CREATE INDEX ix_chamados_cpf ON dados.chamados(aluno_cpf);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_perfis_polo' AND object_id = OBJECT_ID('dados.perfis'))
BEGIN
    CREATE INDEX ix_perfis_polo ON dados.perfis(polo_id);
END
GO

-- 6. Atualizar registros existentes sem polo para o Polo Cascavel (default)
UPDATE dados.chamados 
SET polo_id = '11111111-1111-1111-1111-111111111111' 
WHERE polo_id IS NULL;

UPDATE dados.perfis 
SET polo_id = '11111111-1111-1111-1111-111111111111' 
WHERE polo_id IS NULL;
GO

-- 7. Conceder permissões para o usuário da aplicação (app_chamados)
GRANT SELECT, INSERT, UPDATE, DELETE ON dados.polos TO app_chamados;
GRANT SELECT, INSERT, UPDATE ON dados.chamados TO app_chamados;
GRANT SELECT, INSERT, UPDATE ON dados.perfis TO app_chamados;
GO

PRINT '=== MIGRATION CONCLUIDA COM SUCESSO ===';
GO
