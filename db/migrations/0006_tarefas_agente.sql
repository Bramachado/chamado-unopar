-- =============================================================================
-- 0006 - FILA DE TAREFAS DO AGENTE PRISMA (botão "Delegar para agente")
-- Idempotente. Já aplicada manualmente na produção em 17/10/2026 (scripts/migration_tarefas_agente.sql).
-- =============================================================================
IF OBJECT_ID('dados.tarefas_agente') IS NULL
BEGIN
    CREATE TABLE dados.tarefas_agente (
        id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_tarefas_agente_id DEFAULT NEWID(),
        chamado_id          UNIQUEIDENTIFIER NOT NULL,
        tipo                VARCHAR(30)      NOT NULL CONSTRAINT df_tarefas_agente_tipo DEFAULT 'abrir_pad',
        status              VARCHAR(20)      NOT NULL CONSTRAINT df_tarefas_agente_status DEFAULT 'pendente',
        instrucoes          NVARCHAR(2000)   NULL,   -- observação livre do atendente ao delegar
        pendencias          NVARCHAR(4000)   NULL,   -- o que faltou (status devolvida/erro)
        protocolo_pad       VARCHAR(20)      NULL,   -- protocolo aberto no PAD (status concluida)
        protocolo_anterior  VARCHAR(30)      NULL,   -- protocolo provisório substituído
        tentativas          INT              NOT NULL CONSTRAINT df_tarefas_agente_tentativas DEFAULT 0,
        solicitado_por      UNIQUEIDENTIFIER NOT NULL,
        solicitado_por_nome NVARCHAR(200)    NULL,
        solicitado_em       DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_tarefas_agente_solicitado DEFAULT SYSDATETIMEOFFSET(),
        iniciado_em         DATETIMEOFFSET(3) NULL,
        finalizado_em       DATETIMEOFFSET(3) NULL,
        atualizado_em       DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_tarefas_agente_atualizado DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT pk_tarefas_agente PRIMARY KEY (id),
        CONSTRAINT fk_tarefas_agente_chamado FOREIGN KEY (chamado_id) REFERENCES dados.chamados (id),
        CONSTRAINT ck_tarefas_agente_status CHECK (status IN ('pendente', 'em_execucao', 'concluida', 'devolvida', 'erro', 'cancelada')),
        CONSTRAINT ck_tarefas_agente_tipo CHECK (tipo IN ('abrir_pad'))
    );

    CREATE INDEX ix_tarefas_agente_chamado ON dados.tarefas_agente (chamado_id, solicitado_em DESC);
    CREATE INDEX ix_tarefas_agente_status ON dados.tarefas_agente (status, solicitado_em);

    -- No máximo uma tarefa ativa por chamado
    CREATE UNIQUE INDEX ux_tarefas_agente_ativa ON dados.tarefas_agente (chamado_id)
        WHERE status IN ('pendente', 'em_execucao');

    PRINT 'Tabela dados.tarefas_agente criada.';
END
GO

GRANT SELECT, INSERT, UPDATE ON dados.tarefas_agente TO app_chamados;
GO

-- Perfil do agente (autor das alterações feitas pela API do agente)
IF NOT EXISTS (SELECT 1 FROM dados.perfis WHERE nome_completo = N'Agente Prisma')
BEGIN
    PRINT 'ATENÇÃO: crie o perfil "Agente Prisma" pela tela de usuários (papel atendente) e configure AGENTE_PERFIL_ID.';
END
GO
