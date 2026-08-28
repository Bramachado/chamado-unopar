-- Migração 03: Funções Auxiliares, Segurança, Triggers de Auditoria e Sincronização
-- Sistema de Registro e Controle de Protocolos de Chamados (UNOPAR Parauapebas)

-- ==============================================================================
-- 1. Funções de Apoio às Políticas RLS (SECURITY DEFINER para evitar recursão)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.meu_papel()
RETURNS public.papel_usuario AS $$
DECLARE
  v_papel public.papel_usuario;
BEGIN
  SELECT papel INTO v_papel
  FROM public.perfis
  WHERE id = auth.uid();
  RETURN v_papel;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

CREATE OR REPLACE FUNCTION public.eh_admin()
RETURNS boolean AS $$
DECLARE
  v_eh_admin boolean;
BEGIN
  SELECT (papel = 'admin' AND ativo = true) INTO v_eh_admin
  FROM public.perfis
  WHERE id = auth.uid();
  RETURN COALESCE(v_eh_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

CREATE OR REPLACE FUNCTION public.esta_ativo()
RETURNS boolean AS $$
DECLARE
  v_ativo boolean;
BEGIN
  SELECT ativo INTO v_ativo
  FROM public.perfis
  WHERE id = auth.uid();
  RETURN COALESCE(v_ativo, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

-- ==============================================================================
-- 2. Funções de Catálogo de Motivos e Anti-Duplicata
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.normalizar_motivo(p_nome text)
RETURNS text AS $$
BEGIN
  RETURN lower(public.immutable_unaccent(btrim(regexp_replace(COALESCE(p_nome, ''), '\s+', ' ', 'g'))));
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE STRICT;

CREATE OR REPLACE FUNCTION public.verificar_motivo_similar(p_nome text)
RETURNS TABLE (
  id uuid,
  codigo text,
  nome text,
  similaridade real
) AS $$
DECLARE
  v_norm text;
BEGIN
  v_norm := public.normalizar_motivo(p_nome);
  RETURN QUERY
  SELECT 
    m.id,
    m.codigo,
    m.nome,
    similarity(m.nome_normalizado, v_norm) AS similaridade
  FROM public.motivos m
  WHERE m.ativo = true
    AND similarity(m.nome_normalizado, v_norm) > 0.55
  ORDER BY similaridade DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

-- ==============================================================================
-- 3. Trigger de Sincronização de Usuários (auth.users -> public.perfis)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.trg_handle_novo_usuario()
RETURNS trigger AS $$
DECLARE
  v_nome text;
  v_papel public.papel_usuario;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data->>'nome_completo', split_part(NEW.email, '@', 1));
  v_papel := COALESCE((NEW.raw_user_meta_data->>'papel')::public.papel_usuario, 'atendente'::public.papel_usuario);

  INSERT INTO public.perfis (id, nome_completo, email, papel, ativo)
  VALUES (NEW.id, v_nome, NEW.email::citext, v_papel, true)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      nome_completo = COALESCE(EXCLUDED.nome_completo, public.perfis.nome_completo),
      atualizado_em = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.trg_handle_novo_usuario();

-- ==============================================================================
-- 4. Trigger de Atualização e Situação de Chamados
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.trg_chamados_atualizacao()
RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em := now();

  -- Atualização automática de data_conclusao
  IF NEW.situacao IN ('concluido', 'encerrado') THEN
    IF TG_OP = 'INSERT' OR OLD.situacao = 'aguardando' OR NEW.data_conclusao IS NULL THEN
      NEW.data_conclusao := COALESCE(NEW.data_conclusao, now());
    END IF;
  ELSIF NEW.situacao = 'aguardando' THEN
    NEW.data_conclusao := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chamados_before_write ON public.chamados;
CREATE TRIGGER trg_chamados_before_write
  BEFORE INSERT OR UPDATE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.trg_chamados_atualizacao();

-- ==============================================================================
-- 5. Trigger Genérica de Auditoria para logs_auditoria
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.trg_auditoria_geral()
RETURNS trigger AS $$
DECLARE
  v_usuario_id uuid;
  v_usuario_nome text;
  v_protocolo text;
  v_registro_id uuid;
  v_dados_antes jsonb;
  v_dados_depois jsonb;
  v_campos_alterados text[];
  v_key text;
BEGIN
  v_usuario_id := auth.uid();

  IF v_usuario_id IS NOT NULL THEN
    SELECT nome_completo INTO v_usuario_nome
    FROM public.perfis
    WHERE id = v_usuario_id;
  ELSE
    v_usuario_nome := 'Sistema / Painel SQL';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_registro_id := (to_jsonb(NEW)->>'id')::uuid;
    v_dados_depois := to_jsonb(NEW);
    v_dados_antes := NULL;
    v_protocolo := to_jsonb(NEW)->>'protocolo';
  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id := (to_jsonb(NEW)->>'id')::uuid;
    v_dados_antes := to_jsonb(OLD);
    v_dados_depois := to_jsonb(NEW);
    v_protocolo := COALESCE(to_jsonb(NEW)->>'protocolo', to_jsonb(OLD)->>'protocolo');

    -- Calcular campos alterados
    SELECT array_agg(key)
    INTO v_campos_alterados
    FROM jsonb_each(v_dados_depois)
    WHERE v_dados_depois->key IS DISTINCT FROM v_dados_antes->key;
  ELSIF TG_OP = 'DELETE' THEN
    v_registro_id := (to_jsonb(OLD)->>'id')::uuid;
    v_dados_antes := to_jsonb(OLD);
    v_dados_depois := NULL;
    v_protocolo := to_jsonb(OLD)->>'protocolo';
  END IF;

  -- Redação obrigatória de dados sensíveis no cofre de credenciais
  IF TG_TABLE_NAME = 'credenciais_externas' THEN
    IF v_dados_antes IS NOT NULL THEN
      v_dados_antes := v_dados_antes || jsonb_build_object('senha_cifrada', '[REDIGIDO]', 'iv', '[REDIGIDO]', 'auth_tag', '[REDIGIDO]');
    END IF;
    IF v_dados_depois IS NOT NULL THEN
      v_dados_depois := v_dados_depois || jsonb_build_object('senha_cifrada', '[REDIGIDO]', 'iv', '[REDIGIDO]', 'auth_tag', '[REDIGIDO]');
    END IF;
  END IF;

  INSERT INTO public.logs_auditoria (
    tabela,
    registro_id,
    operacao,
    dados_antes,
    dados_depois,
    campos_alterados,
    usuario_id,
    usuario_nome,
    protocolo,
    ip,
    criado_em
  ) VALUES (
    TG_TABLE_NAME,
    v_registro_id,
    TG_OP,
    v_dados_antes,
    v_dados_depois,
    v_campos_alterados,
    v_usuario_id,
    v_usuario_nome,
    v_protocolo,
    inet_client_addr(),
    now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Aplicar a trigger de auditoria nas tabelas monitoradas
DROP TRIGGER IF EXISTS trg_audit_chamados ON public.chamados;
CREATE TRIGGER trg_audit_chamados
  AFTER INSERT OR UPDATE OR DELETE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.trg_auditoria_geral();

DROP TRIGGER IF EXISTS trg_audit_motivos ON public.motivos;
CREATE TRIGGER trg_audit_motivos
  AFTER INSERT OR UPDATE OR DELETE ON public.motivos
  FOR EACH ROW EXECUTE FUNCTION public.trg_auditoria_geral();

DROP TRIGGER IF EXISTS trg_audit_perfis ON public.perfis;
CREATE TRIGGER trg_audit_perfis
  AFTER INSERT OR UPDATE OR DELETE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.trg_auditoria_geral();

DROP TRIGGER IF EXISTS trg_audit_credenciais_externas ON public.credenciais_externas;
CREATE TRIGGER trg_audit_credenciais_externas
  AFTER INSERT OR UPDATE OR DELETE ON public.credenciais_externas
  FOR EACH ROW EXECUTE FUNCTION public.trg_auditoria_geral();

-- ==============================================================================
-- 6. RPC para Exclusão Lógica de Chamados (Soft Delete Seguro)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.excluir_chamado(p_id uuid)
RETURNS void AS $$
DECLARE
  v_chamado public.chamados%ROWTYPE;
  v_papel public.papel_usuario;
  v_ativo boolean;
BEGIN
  -- Verificar se usuário está ativo
  SELECT ativo, papel INTO v_ativo, v_papel
  FROM public.perfis
  WHERE id = auth.uid();

  IF v_ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: usuária inativa ou não autenticada.';
  END IF;

  SELECT * INTO v_chamado
  FROM public.chamados
  WHERE id = p_id AND excluido_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado ou já excluído.';
  END IF;

  -- Regras da matriz de permissão:
  -- Admin: pode excluir qualquer chamado
  -- Atendente: pode excluir apenas chamados próprios
  -- Coordenador: NÃO pode excluir chamados
  IF v_papel = 'admin' THEN
    -- Permitido
    NULL;
  ELSIF v_papel = 'atendente' AND v_chamado.criado_por = auth.uid() THEN
    -- Permitido
    NULL;
  ELSIF v_papel = 'coordenador' THEN
    RAISE EXCEPTION 'Permissão negada: coordenadoras não possuem permissão para excluir chamados.';
  ELSE
    RAISE EXCEPTION 'Permissão negada: você não pode excluir chamados de terceiros.';
  END IF;

  UPDATE public.chamados
  SET excluido_em = now(),
      excluido_por = auth.uid()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
