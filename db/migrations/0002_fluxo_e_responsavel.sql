-- =============================================================================
-- 0002 - FLUXO DO CHAMADO, RESPONSÁVEL, HISTÓRICO ESTRUTURADO E DADOS DE TESTE
--
-- Situações (códigos existentes preservados; rótulos novos na aplicação):
--   rascunho            Rascunho (ainda não registrado na plataforma externa)
--   aguardando          Aberto - aguardando atendimento   (código já existente)
--   em_atendimento      Em atendimento                     (novo)
--   aguardando_aluno    Aguardando aluno                   (novo)
--   aguardando_externo  Aguardando retorno externo/PAD     (novo)
--   concluido           Resolvido                          (código já existente)
--   encerrado           Encerrado sem solução              (código já existente)
-- Nenhum registro existente muda de situação.
--
-- responsavel_id: responsável atual, separado de criado_por. NULL nos registros antigos;
-- a aplicação usa COALESCE(responsavel_id, criado_por). Não há UPDATE em massa.
--
-- eh_teste: marca manual (por administrador) de registros de teste, excluídos dos indicadores.
-- Reversão: db/migrations/rollback/0002_fluxo_e_responsavel.down.sql
-- =============================================================================
SET NOCOUNT ON;
GO
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_chamados_situacao')
  ALTER TABLE dados.chamados DROP CONSTRAINT ck_chamados_situacao;
GO
ALTER TABLE dados.chamados ADD CONSTRAINT ck_chamados_situacao CHECK (situacao IN (
  'rascunho', 'aguardando', 'em_atendimento', 'aguardando_aluno', 'aguardando_externo',
  'concluido', 'encerrado'));
GO

IF COL_LENGTH('dados.chamados', 'responsavel_id') IS NULL
  ALTER TABLE dados.chamados ADD
    responsavel_id UNIQUEIDENTIFIER NULL,
    resolucao NVARCHAR(MAX) NULL,
    motivo_encerramento VARCHAR(40) NULL,
    ultima_interacao_em DATETIMEOFFSET(3) NULL,
    proxima_acao NVARCHAR(500) NULL,
    proxima_acao_em DATE NULL,
    status_externo NVARCHAR(120) NULL,
    reaberturas INT NOT NULL CONSTRAINT df_chamados_reaberturas DEFAULT 0,
    eh_teste BIT NOT NULL CONSTRAINT df_chamados_eh_teste DEFAULT 0;
GO
IF OBJECT_ID('dados.fk_chamados_responsavel') IS NULL
  ALTER TABLE dados.chamados ADD CONSTRAINT fk_chamados_responsavel
    FOREIGN KEY (responsavel_id) REFERENCES dados.perfis(id);
GO
IF OBJECT_ID('dados.ck_chamados_motivo_encerramento') IS NULL
  ALTER TABLE dados.chamados ADD CONSTRAINT ck_chamados_motivo_encerramento CHECK (
    motivo_encerramento IS NULL OR motivo_encerramento IN (
      'aluno_desistiu', 'sem_retorno_aluno', 'fora_do_escopo', 'duplicado',
      'indeferido_externo', 'aberto_por_engano', 'outro'));
GO

IF OBJECT_ID('dados.chamado_eventos') IS NULL
CREATE TABLE dados.chamado_eventos (
  id BIGINT IDENTITY(1,1) NOT NULL,
  chamado_id UNIQUEIDENTIFIER NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  situacao_anterior VARCHAR(20) NULL,
  situacao_nova VARCHAR(20) NULL,
  responsavel_anterior UNIQUEIDENTIFIER NULL,
  responsavel_novo UNIQUEIDENTIFIER NULL,
  texto NVARCHAR(MAX) NULL,
  dados_json NVARCHAR(MAX) NULL,
  criado_por UNIQUEIDENTIFIER NULL,
  criado_por_nome NVARCHAR(200) NULL,
  ip VARCHAR(45) NULL,
  criado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_eventos_criado DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_chamado_eventos PRIMARY KEY (id),
  CONSTRAINT fk_eventos_chamado FOREIGN KEY (chamado_id) REFERENCES dados.chamados(id),
  CONSTRAINT fk_eventos_criado_por FOREIGN KEY (criado_por) REFERENCES dados.perfis(id),
  CONSTRAINT ck_eventos_tipo CHECK (tipo IN (
    'criacao', 'situacao', 'atribuicao', 'transferencia', 'interacao', 'ajuste_prazo',
    'reabertura', 'consolidacao_motivo', 'marcacao_teste', 'edicao')),
  CONSTRAINT ck_eventos_json CHECK (dados_json IS NULL OR ISJSON(dados_json) = 1)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_eventos_chamado')
  CREATE INDEX ix_eventos_chamado ON dados.chamado_eventos(chamado_id, id);
GO

-- Índices para as consultas reais de listagem, indicadores, notificações e detalhes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chamados_abertura')
  CREATE INDEX ix_chamados_abertura ON dados.chamados(data_solicitacao)
    INCLUDE (situacao, prazo, polo_id, criado_por, responsavel_id, motivo_id, data_conclusao, eh_teste)
    WHERE excluido_em IS NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chamados_situacao_prazo')
  CREATE INDEX ix_chamados_situacao_prazo ON dados.chamados(situacao, prazo)
    INCLUDE (polo_id, criado_por, responsavel_id, eh_teste)
    WHERE excluido_em IS NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chamados_conclusao')
  CREATE INDEX ix_chamados_conclusao ON dados.chamados(data_conclusao)
    INCLUDE (situacao, prazo, data_solicitacao, polo_id, criado_por, responsavel_id, eh_teste)
    WHERE excluido_em IS NULL AND data_conclusao IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chamados_responsavel')
  CREATE INDEX ix_chamados_responsavel ON dados.chamados(responsavel_id) WHERE responsavel_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chamados_vinculado')
  CREATE INDEX ix_chamados_vinculado ON dados.chamados(chamado_vinculado_id) WHERE chamado_vinculado_id IS NOT NULL;
-- auditoria.logs é consultada por (tabela, registro_id) para avatar, anexo e histórico do chamado
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_logs_tabela_registro')
  CREATE INDEX ix_logs_tabela_registro ON auditoria.logs(tabela, registro_id, id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_logs_criado_em')
  CREATE INDEX ix_logs_criado_em ON auditoria.logs(criado_em);
GO

IF DATABASE_PRINCIPAL_ID('app_chamados') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT ON dados.chamado_eventos TO app_chamados;
  DENY UPDATE, DELETE ON dados.chamado_eventos TO app_chamados;
END;
GO
