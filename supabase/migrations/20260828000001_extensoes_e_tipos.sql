-- Migração 01: Extensões e Tipos Enum
-- Sistema de Registro e Controle de Protocolos de Chamados (UNOPAR Parauapebas)

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE papel_usuario AS ENUM ('admin', 'coordenador', 'atendente');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE situacao_chamado AS ENUM ('aguardando', 'concluido', 'encerrado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE prioridade_chamado AS ENUM ('normal', 'priorizar');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
