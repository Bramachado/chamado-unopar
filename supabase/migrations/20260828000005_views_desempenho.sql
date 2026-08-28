-- Migração 05: Funções e Views de Desempenho e Gamificação
-- Sistema de Registro e Controle de Protocolos de Chamados (UNOPAR Parauapebas)

CREATE OR REPLACE FUNCTION public.calcular_ranking_desempenho(
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE (
  posicao int,
  usuario_id uuid,
  nome_completo text,
  email citext,
  papel public.papel_usuario,
  volume_total bigint,
  resolvidos bigint,
  encerrados bigint,
  aguardando bigint,
  volume_ponderado numeric,
  no_prazo bigint,
  taxa_prazo numeric,
  tempo_medio_dias numeric,
  pontos_volume numeric,
  pontos_prazo numeric,
  pontos_agilidade numeric,
  pontos_total numeric
) AS $$
WITH stats_por_usuario AS (
  SELECT 
    p.id AS usuario_id,
    p.nome_completo,
    p.email,
    p.papel,
    COUNT(c.id) AS volume_total,
    COUNT(c.id) FILTER (WHERE c.situacao = 'concluido') AS resolvidos,
    COUNT(c.id) FILTER (WHERE c.situacao = 'encerrado') AS encerrados,
    COUNT(c.id) FILTER (WHERE c.situacao = 'aguardando') AS aguardando,
    (
      COUNT(c.id) FILTER (WHERE c.situacao = 'concluido') * 1.0 +
      COUNT(c.id) FILTER (WHERE c.situacao = 'encerrado') * 0.5 +
      COUNT(c.id) FILTER (WHERE c.situacao = 'aguardando') * 0.25
    ) AS volume_pond,
    COUNT(c.id) FILTER (WHERE c.situacao = 'concluido' AND c.data_conclusao::date <= c.prazo) AS no_prazo,
    CASE 
      WHEN COUNT(c.id) FILTER (WHERE c.situacao = 'concluido') > 0 THEN
        (COUNT(c.id) FILTER (WHERE c.situacao = 'concluido' AND c.data_conclusao::date <= c.prazo) * 1.0) /
        COUNT(c.id) FILTER (WHERE c.situacao = 'concluido')
      ELSE 0.0
    END AS taxa_prazo,
    CASE 
      WHEN COUNT(c.id) FILTER (WHERE c.situacao = 'concluido') > 0 THEN
        AVG(c.data_conclusao::date - c.data_solicitacao) FILTER (WHERE c.situacao = 'concluido')
      ELSE NULL
    END AS tempo_medio
  FROM public.perfis p
  LEFT JOIN public.chamados c 
    ON c.criado_por = p.id 
    AND c.importado = false 
    AND c.excluido_em IS NULL
    AND c.data_solicitacao >= p_data_inicio 
    AND c.data_solicitacao <= p_data_fim
  WHERE p.ativo = true
  GROUP BY p.id, p.nome_completo, p.email, p.papel
),
limites_periodo AS (
  SELECT 
    COALESCE(MAX(volume_pond), 0) AS max_volume_pond,
    MIN(tempo_medio) AS min_tempo,
    MAX(tempo_medio) AS max_tempo
  FROM stats_por_usuario
),
pontuacao_calculada AS (
  SELECT 
    s.*,
    -- Pontuação de Volume (40 pontos max)
    CASE 
      WHEN l.max_volume_pond > 0 THEN
        ROUND(40.0 * (s.volume_pond / l.max_volume_pond), 2)
      ELSE 0.0
    END AS pontos_volume,
    -- Pontuação de Prazo (40 pontos max)
    ROUND(40.0 * s.taxa_prazo, 2) AS pontos_prazo,
    -- Pontuação de Agilidade/Tempo Médio (20 pontos max)
    CASE 
      WHEN s.resolvidos = 0 OR s.tempo_medio IS NULL THEN 0.0
      WHEN l.max_tempo = l.min_tempo THEN 20.0
      ELSE ROUND(20.0 * (1.0 - ((s.tempo_medio - l.min_tempo) / (l.max_tempo - l.min_tempo))), 2)
    END AS pontos_agilidade
  FROM stats_por_usuario s
  CROSS JOIN limites_periodo l
)
SELECT 
  (ROW_NUMBER() OVER (
    ORDER BY 
      (pontos_volume + pontos_prazo + pontos_agilidade) DESC,
      taxa_prazo DESC,
      COALESCE(tempo_medio, 999999) ASC,
      resolvidos DESC,
      nome_completo ASC
  ))::int AS posicao,
  usuario_id,
  nome_completo,
  email,
  papel,
  volume_total,
  resolvidos,
  encerrados,
  aguardando,
  ROUND(volume_pond, 2) AS volume_ponderado,
  no_prazo,
  ROUND(taxa_prazo * 100.0, 1) AS taxa_prazo,
  ROUND(COALESCE(tempo_medio, 0), 1) AS tempo_medio_dias,
  pontos_volume,
  pontos_prazo,
  pontos_agilidade,
  ROUND(pontos_volume + pontos_prazo + pontos_agilidade, 2) AS pontos_total
FROM pontuacao_calculada
ORDER BY posicao ASC;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
