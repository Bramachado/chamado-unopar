import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { PainelDesempenho } from "./painel-desempenho";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type RankingItem } from "@/types/database";

export default async function PaginaDesempenho() {
  const perfilAtual = await obterPerfilAtual();
  const supabase = await criarClienteServidor();

  const hoje = new Date();
  const inicioMes = format(startOfMonth(hoje), "yyyy-MM-dd");
  const fimMes = format(endOfMonth(hoje), "yyyy-MM-dd");

  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const rotuloSemestre = mes <= 6 ? `${ano}.1` : `${ano}.2`;
  const inicioSemestre = mes <= 6 ? `${ano}-01-01` : `${ano}-07-01`;
  const fimSemestre = mes <= 6 ? `${ano}-06-30` : `${ano}-12-31`;

  // 1. Ranking do Mês Corrente
  const { data: dataRankingMes } = await supabase.rpc("calcular_ranking_desempenho", {
    p_data_inicio: inicioMes,
    p_data_fim: fimMes,
  });

  // 2. Ranking do Semestre Letivo
  const { data: dataRankingSemestre } = await supabase.rpc("calcular_ranking_desempenho", {
    p_data_inicio: inicioSemestre,
    p_data_fim: fimSemestre,
  });

  const rankingMes: RankingItem[] = (dataRankingMes as unknown as RankingItem[]) || [];
  const rankingSemestre: RankingItem[] = (dataRankingSemestre as unknown as RankingItem[]) || [];

  // 3. Evolução Pessoal e Média da Equipe dos últimos 6 meses
  const evolucaoPessoal: { mes: string; minhaPontuacao: number; mediaEquipe: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = subMonths(hoje, i);
    const ini = format(startOfMonth(d), "yyyy-MM-dd");
    const fim = format(endOfMonth(d), "yyyy-MM-dd");
    const rotulo = format(d, "MMM/yy", { locale: ptBR });

    const { data: rankingHist } = await supabase.rpc("calcular_ranking_desempenho", {
      p_data_inicio: ini,
      p_data_fim: fim,
    });

    const lista = (rankingHist as unknown as RankingItem[]) || [];
    const meuItem = lista.find((r) => r.usuario_id === perfilAtual.id);
    const minhaPontuacao = meuItem?.pontos_total ?? 0;

    const somaEquipe = lista.reduce((acc, curr) => acc + (curr.pontos_total || 0), 0);
    const mediaEquipe = lista.length > 0 ? Math.round((somaEquipe / lista.length) * 10) / 10 : 0;

    evolucaoPessoal.push({
      mes: rotulo,
      minhaPontuacao,
      mediaEquipe,
    });
  }

  return (
    <PainelDesempenho
      rankingMes={rankingMes}
      rankingSemestre={rankingSemestre}
      perfilAtual={perfilAtual}
      evolucaoPessoal={evolucaoPessoal}
      rotuloSemestre={rotuloSemestre}
    />
  );
}
