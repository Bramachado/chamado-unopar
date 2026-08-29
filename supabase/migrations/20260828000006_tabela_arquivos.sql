-- ==============================================================================
-- 6. TABELA DE ARQUIVOS / ANEXOS DO PROTOCOLO E AUDITORIA
-- ==============================================================================

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

-- Índices de performance para busca de arquivos por chamado
CREATE INDEX IF NOT EXISTS idx_arquivos_chamado_id ON public.arquivos(chamado_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_criado_por ON public.arquivos(criado_por);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para arquivos
DROP POLICY IF EXISTS "Arquivos visíveis por usuários ativos" ON public.arquivos;
CREATE POLICY "Arquivos visíveis por usuários ativos" ON public.arquivos
  FOR SELECT TO authenticated USING (public.esta_ativo());

DROP POLICY IF EXISTS "Usuários ativos anexam arquivos" ON public.arquivos;
CREATE POLICY "Usuários ativos anexam arquivos" ON public.arquivos
  FOR INSERT TO authenticated WITH CHECK (public.esta_ativo() AND criado_por = auth.uid());

DROP POLICY IF EXISTS "Admins excluem qualquer arquivo" ON public.arquivos;
CREATE POLICY "Admins excluem qualquer arquivo" ON public.arquivos
  FOR DELETE TO authenticated USING (public.eh_admin());

DROP POLICY IF EXISTS "Usuários excluem arquivos próprios" ON public.arquivos;
CREATE POLICY "Usuários excluem arquivos próprios" ON public.arquivos
  FOR DELETE TO authenticated USING (public.esta_ativo() AND criado_por = auth.uid());

-- Trigger de Auditoria para inclusão/exclusão de arquivos
DROP TRIGGER IF EXISTS trg_audit_arquivos ON public.arquivos;
CREATE TRIGGER trg_audit_arquivos
AFTER INSERT OR UPDATE OR DELETE ON public.arquivos
FOR EACH ROW EXECUTE FUNCTION public.trg_auditoria_geral();
