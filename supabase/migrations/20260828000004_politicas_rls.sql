-- Migração 04: Políticas de Segurança em Nível de Linha (Row Level Security - RLS)
-- Sistema de Registro e Controle de Protocolos de Chamados (UNOPAR Parauapebas)

-- ==============================================================================
-- 1. Habilitar RLS em todas as tabelas públicas
-- ==============================================================================
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credenciais_externas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credencial_acessos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

-- Revogar DELETE físico na tabela de chamados (exclusão estritamente lógica)
REVOKE DELETE ON public.chamados FROM public, authenticated, anon;

-- ==============================================================================
-- 2. Políticas para 'perfis'
-- ==============================================================================
DROP POLICY IF EXISTS "Perfis visiveis para usuarias ativas" ON public.perfis;
CREATE POLICY "Perfis visiveis para usuarias ativas"
  ON public.perfis
  FOR SELECT
  TO authenticated
  USING (public.esta_ativo());

DROP POLICY IF EXISTS "Admin gerencia perfis" ON public.perfis;
CREATE POLICY "Admin gerencia perfis"
  ON public.perfis
  FOR ALL
  TO authenticated
  USING (public.eh_admin())
  WITH CHECK (public.eh_admin());

DROP POLICY IF EXISTS "Propria usuaria pode atualizar dados basicos" ON public.perfis;
CREATE POLICY "Propria usuaria pode atualizar dados basicos"
  ON public.perfis
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND public.esta_ativo())
  WITH CHECK (id = auth.uid() AND public.esta_ativo());

-- ==============================================================================
-- 3. Políticas para 'motivos'
-- ==============================================================================
DROP POLICY IF EXISTS "Visualizar motivos ativos para usuarias ativas" ON public.motivos;
CREATE POLICY "Visualizar motivos ativos para usuarias ativas"
  ON public.motivos
  FOR SELECT
  TO authenticated
  USING (public.esta_ativo());

DROP POLICY IF EXISTS "Criar motivos para usuarias ativas" ON public.motivos;
CREATE POLICY "Criar motivos para usuarias ativas"
  ON public.motivos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.esta_ativo() AND criado_por = auth.uid());

DROP POLICY IF EXISTS "Apenas admin edita motivos" ON public.motivos;
CREATE POLICY "Apenas admin edita motivos"
  ON public.motivos
  FOR UPDATE
  TO authenticated
  USING (public.eh_admin())
  WITH CHECK (public.eh_admin());

-- ==============================================================================
-- 4. Políticas para 'chamados'
-- ==============================================================================
DROP POLICY IF EXISTS "Visualizar chamados nao excluidos" ON public.chamados;
CREATE POLICY "Visualizar chamados nao excluidos"
  ON public.chamados
  FOR SELECT
  TO authenticated
  USING (public.esta_ativo() AND excluido_em IS NULL);

DROP POLICY IF EXISTS "Criar chamados com autor forçado" ON public.chamados;
CREATE POLICY "Criar chamados com autor forçado"
  ON public.chamados
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.esta_ativo() 
    AND criado_por = auth.uid()
    AND excluido_em IS NULL
  );

DROP POLICY IF EXISTS "Atualizar chamados conforme permissao" ON public.chamados;
CREATE POLICY "Atualizar chamados conforme permissao"
  ON public.chamados
  FOR UPDATE
  TO authenticated
  USING (
    public.esta_ativo() 
    AND excluido_em IS NULL
    AND (
      public.eh_admin() 
      OR criado_por = auth.uid()
    )
  )
  WITH CHECK (
    public.esta_ativo() 
    AND excluido_em IS NULL
    AND (
      public.eh_admin() 
      OR criado_por = auth.uid()
    )
  );

-- ==============================================================================
-- 5. Políticas para 'credenciais_externas'
-- NENHUMA policy de SELECT para clientes autenticados diretos.
-- Acesso somente via RPC ou Server Action restrita usando service_role.
-- ==============================================================================
DROP POLICY IF EXISTS "Inserir ou atualizar propria credencial" ON public.credenciais_externas;
CREATE POLICY "Inserir ou atualizar propria credencial"
  ON public.credenciais_externas
  FOR ALL
  TO authenticated
  USING (public.eh_admin() OR (perfil_id = auth.uid() AND public.esta_ativo()))
  WITH CHECK (public.eh_admin() OR (perfil_id = auth.uid() AND public.esta_ativo()));

-- ==============================================================================
-- 6. Políticas para 'credencial_acessos'
-- ==============================================================================
DROP POLICY IF EXISTS "Admin ve todos acessos e usuaria ve seus proprios" ON public.credencial_acessos;
CREATE POLICY "Admin ve todos acessos e usuaria ve seus proprios"
  ON public.credencial_acessos
  FOR SELECT
  TO authenticated
  USING (
    public.esta_ativo() 
    AND (
      public.eh_admin() 
      OR perfil_alvo = auth.uid()
    )
  );

-- ==============================================================================
-- 7. Políticas para 'logs_auditoria'
-- ==============================================================================
DROP POLICY IF EXISTS "Admin visualiza todos os logs de auditoria" ON public.logs_auditoria;
CREATE POLICY "Admin visualiza todos os logs de auditoria"
  ON public.logs_auditoria
  FOR SELECT
  TO authenticated
  USING (public.eh_admin());

DROP POLICY IF EXISTS "Historico de alteracao visivel para detalhe de chamado" ON public.logs_auditoria;
CREATE POLICY "Historico de alteracao visivel para detalhe de chamado"
  ON public.logs_auditoria
  FOR SELECT
  TO authenticated
  USING (
    public.esta_ativo()
    AND tabela = 'chamados'
    AND registro_id IS NOT NULL
  );
