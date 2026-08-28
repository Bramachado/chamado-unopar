-- Migração 02: Tabelas Principais, Estruturas e Índices
-- Sistema de Registro e Controle de Protocolos de Chamados (UNOPAR Parauapebas)

-- Função auxiliar immutable para unaccent (obrigatória para generated columns e índices funcionais)
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- 2.1 Tabela de Perfis
CREATE TABLE IF NOT EXISTS public.perfis (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  email citext NOT NULL UNIQUE,
  papel papel_usuario NOT NULL DEFAULT 'atendente',
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- 2.2 Tabela de Credenciais Externas (Cofre AES-256-GCM)
CREATE TABLE IF NOT EXISTS public.credenciais_externas (
  perfil_id uuid PRIMARY KEY REFERENCES public.perfis(id) ON DELETE CASCADE,
  senha_cifrada bytea NOT NULL,
  iv bytea NOT NULL,
  auth_tag bytea NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES public.perfis(id)
);

-- 2.3 Tabela de Auditoria de Acessos a Credenciais
CREATE TABLE IF NOT EXISTS public.credencial_acessos (
  id bigserial PRIMARY KEY,
  perfil_alvo uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.perfis(id),
  data_hora timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text
);

-- 2.4 Tabela de Catálogo de Motivos
CREATE SEQUENCE IF NOT EXISTS public.motivos_numero_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.motivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero int NOT NULL UNIQUE DEFAULT nextval('public.motivos_numero_seq'),
  codigo text GENERATED ALWAYS AS ('#' || lpad(numero::text, 2, '0')) STORED,
  nome text NOT NULL,
  nome_normalizado text GENERATED ALWAYS AS (lower(public.immutable_unaccent(btrim(regexp_replace(nome, '\s+', ' ', 'g'))))) STORED UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.perfis(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 2.5 Tabela de Chamados
CREATE TABLE IF NOT EXISTS public.chamados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo citext NOT NULL UNIQUE,
  aluno_nome text NOT NULL,
  aluno_ra text,
  contato_telefone text,
  motivo_id uuid NOT NULL REFERENCES public.motivos(id),
  descricao text,
  situacao situacao_chamado NOT NULL DEFAULT 'aguardando',
  prioridade prioridade_chamado NOT NULL DEFAULT 'normal',
  data_solicitacao date NOT NULL,
  prazo date NOT NULL,
  data_conclusao timestamptz,
  chamado_vinculado_id uuid REFERENCES public.chamados(id),
  observacao text,
  importado boolean NOT NULL DEFAULT false,
  criado_por uuid NOT NULL REFERENCES public.perfis(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  excluido_em timestamptz,
  excluido_por uuid REFERENCES public.perfis(id),
  CONSTRAINT chk_protocolo_formato CHECK (protocolo ~ '^CS[0-9]{8}$')
);

-- 2.6 Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id bigserial PRIMARY KEY,
  tabela text NOT NULL,
  registro_id uuid,
  operacao text NOT NULL,
  dados_antes jsonb,
  dados_depois jsonb,
  campos_alterados text[],
  usuario_id uuid,
  usuario_nome text,
  protocolo text,
  ip inet,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 2.7 Índices Obrigatórios
CREATE INDEX IF NOT EXISTS idx_chamados_aluno_nome_trgm ON public.chamados USING gin (public.immutable_unaccent(lower(aluno_nome)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chamados_criado_por ON public.chamados (criado_por);
CREATE INDEX IF NOT EXISTS idx_chamados_criado_em ON public.chamados (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_chamados_situacao ON public.chamados (situacao);
CREATE INDEX IF NOT EXISTS idx_chamados_motivo_id ON public.chamados (motivo_id);
CREATE INDEX IF NOT EXISTS idx_chamados_prazo ON public.chamados (prazo);
CREATE INDEX IF NOT EXISTS idx_chamados_chamado_vinculado_id ON public.chamados (chamado_vinculado_id);
CREATE INDEX IF NOT EXISTS idx_chamados_excluido_em ON public.chamados (excluido_em);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_criado_em ON public.logs_auditoria (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario_id ON public.logs_auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_protocolo ON public.logs_auditoria (protocolo);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_tabela ON public.logs_auditoria (tabela);
