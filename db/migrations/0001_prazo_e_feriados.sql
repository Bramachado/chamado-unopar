-- =============================================================================
-- 0001 - PRAZO CALCULADO x AJUSTE MANUAL E CALENDÁRIO DE FERIADOS
--
-- * dados.chamados.prazo continua sendo o prazo EFETIVO (compatível com consultas existentes).
-- * prazo_calculado guarda o prazo calculado pela regra (lib/sla.ts) no momento da gravação.
-- * prazo_ajuste_manual = 1 quando o prazo efetivo foi definido manualmente, com justificativa,
--   autor e data do ajuste (também auditados pelo trigger e em dados.chamado_eventos).
-- * Registros antigos ficam com prazo_calculado NULL (origem desconhecida); nenhum dado é
--   recalculado ou alterado por esta migração.
-- * dados.feriados: feriados estaduais, municipais e institucionais que não estão na lista
--   nacional calculada em código. polo_id NULL = vale para todos os polos.
-- Reversão: db/migrations/rollback/0001_prazo_e_feriados.down.sql
-- =============================================================================
SET NOCOUNT ON;
GO
IF COL_LENGTH('dados.chamados', 'prazo_calculado') IS NULL
  ALTER TABLE dados.chamados ADD
    prazo_calculado DATE NULL,
    prazo_ajuste_manual BIT NOT NULL CONSTRAINT df_chamados_prazo_ajuste_manual DEFAULT 0,
    prazo_ajuste_justificativa NVARCHAR(500) NULL,
    prazo_ajustado_por UNIQUEIDENTIFIER NULL,
    prazo_ajustado_em DATETIMEOFFSET(3) NULL;
GO
IF OBJECT_ID('dados.fk_chamados_prazo_ajustado_por') IS NULL
  ALTER TABLE dados.chamados ADD CONSTRAINT fk_chamados_prazo_ajustado_por
    FOREIGN KEY (prazo_ajustado_por) REFERENCES dados.perfis(id);
GO

IF OBJECT_ID('dados.feriados') IS NULL
CREATE TABLE dados.feriados (
  id INT IDENTITY(1,1) NOT NULL,
  data DATE NOT NULL,
  descricao NVARCHAR(150) NOT NULL,
  abrangencia VARCHAR(20) NOT NULL,
  polo_id UNIQUEIDENTIFIER NULL,
  ativo BIT NOT NULL CONSTRAINT df_feriados_ativo DEFAULT 1,
  criado_por UNIQUEIDENTIFIER NULL,
  criado_em DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_feriados_criado DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_feriados PRIMARY KEY (id),
  CONSTRAINT ck_feriados_abrangencia
    CHECK (abrangencia IN ('estadual', 'municipal', 'institucional', 'ponto_facultativo')),
  CONSTRAINT fk_feriados_polo FOREIGN KEY (polo_id) REFERENCES dados.polos(id),
  CONSTRAINT fk_feriados_criado_por FOREIGN KEY (criado_por) REFERENCES dados.perfis(id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_feriados_data_polo')
  CREATE UNIQUE INDEX uq_feriados_data_polo ON dados.feriados(data, polo_id) WHERE ativo = 1;
GO

IF DATABASE_PRINCIPAL_ID('app_chamados') IS NOT NULL
  GRANT SELECT, INSERT, UPDATE ON dados.feriados TO app_chamados;
GO
