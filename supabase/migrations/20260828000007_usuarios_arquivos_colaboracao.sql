-- ==============================================================================
-- 7. MIGRAÇÃO: ENTIDADE USUÁRIOS, ARQUIVOS 1:N, EDIÇÃO COLABORATIVA E RASTREAMENTO
-- ==============================================================================

-- 1. Criação de View / Compatibilidade da entidade 'usuarios' baseada em 'perfis'
-- Permite que consultas e relacionamentos usem 'usuarios' ou 'perfis' de forma intercambiável
CREATE OR REPLACE VIEW public.usuarios AS 
SELECT 
  id,
  nome_completo,
  email,
  papel,
  ativo,
  criado_em,
  atualizado_em
FROM public.perfis;

-- 2. Adicionar coluna atualizado_por na tabela chamados
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'chamados' 
      AND column_name = 'atualizado_por'
  ) THEN
    ALTER TABLE public.chamados 
    ADD COLUMN atualizado_por uuid REFERENCES public.perfis(id);
  END IF;
END $$;

-- 3. Atualizar trigger para registrar quem fez a última edição e o timestamp
CREATE OR REPLACE FUNCTION public.trg_atualizar_chamados_tracking()
RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  IF auth.uid() IS NOT NULL THEN
    NEW.atualizado_por = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_atualizar_chamados_timestamp ON public.chamados;
CREATE TRIGGER trg_atualizar_chamados_timestamp
BEFORE UPDATE ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.trg_atualizar_chamados_tracking();

-- 4. Garantir que a tabela de arquivos exista associada aos chamados (1:N)
CREATE TABLE IF NOT EXISTS public.arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  nome_original text NOT NULL,
  caminho_storage text NOT NULL,
  tamanho_bytes bigint,
  tipo_mime text,
  descricao text,
  criado_por uuid NOT NULL REFERENCES public.perfis(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arquivos_chamado_id ON public.arquivos(chamado_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_criado_por ON public.arquivos(criado_por);

-- 5. Atualização de Políticas de RLS (Edição Colaborativa e Proteção de Exclusão)
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas de restrição de edição exclusiva
DROP POLICY IF EXISTS "Admins editam qualquer chamado" ON public.chamados;
DROP POLICY IF EXISTS "Atendentes editam chamados próprios" ON public.chamados;
DROP POLICY IF EXISTS "Coordenadores editam chamados próprios" ON public.chamados;
DROP POLICY IF EXISTS "Usuárias ativas editam chamados colaborativamente" ON public.chamados;

-- NOVA REGRA: Qualquer colaboradora ativa pode editar chamados (adicionar notas, arquivos, mudar status)
CREATE POLICY "Usuárias ativas editam chamados colaborativamente" ON public.chamados
  FOR UPDATE TO authenticated
  USING (public.esta_ativo() AND excluido_em IS NULL)
  WITH CHECK (public.esta_ativo() AND excluido_em IS NULL);

-- REGRA DE EXCLUSÃO LÓGICA REFORÇADA:
-- Apenas o criador original do chamado OU administradoras podem excluir o chamado
CREATE OR REPLACE FUNCTION public.excluir_chamado(p_id uuid)
RETURNS void AS $$
DECLARE
  v_chamado public.chamados%ROWTYPE;
  v_papel public.papel_usuario;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT papel INTO v_papel FROM public.perfis WHERE id = v_uid AND ativo = true;
  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Usuário inativo ou não cadastrado.';
  END IF;

  SELECT * INTO v_chamado FROM public.chamados WHERE id = p_id AND excluido_em IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado ou já excluído.';
  END IF;

  -- Ninguém pode excluir chamado alheio a menos que seja administradora
  IF v_papel != 'admin' AND v_chamado.criado_por != v_uid THEN
    RAISE EXCEPTION 'Você só pode excluir chamados criados por você mesma.';
  END IF;

  UPDATE public.chamados
  SET excluido_em = now(),
      excluido_por = v_uid
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Políticas de Arquivos
DROP POLICY IF EXISTS "Arquivos visíveis por usuários ativos" ON public.arquivos;
CREATE POLICY "Arquivos visíveis por usuários ativos" ON public.arquivos
  FOR SELECT TO authenticated USING (public.esta_ativo());

DROP POLICY IF EXISTS "Usuários ativos anexam arquivos" ON public.arquivos;
CREATE POLICY "Usuários ativos anexam arquivos" ON public.arquivos
  FOR INSERT TO authenticated WITH CHECK (public.esta_ativo() AND criado_por = auth.uid());

DROP POLICY IF EXISTS "Exclusão de arquivos restrita ao autor ou admin" ON public.arquivos;
CREATE POLICY "Exclusão de arquivos restrita ao autor ou admin" ON public.arquivos
  FOR DELETE TO authenticated USING (public.eh_admin() OR criado_por = auth.uid());

-- Trigger de Auditoria para Arquivos
DROP TRIGGER IF EXISTS trg_audit_arquivos ON public.arquivos;
CREATE TRIGGER trg_audit_arquivos
AFTER INSERT OR UPDATE OR DELETE ON public.arquivos
FOR EACH ROW EXECUTE FUNCTION public.trg_auditoria_geral();
