import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { PainelDesempenho } from "./painel-desempenho";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type RankingItem } from "@/types/database";

export default async function PaginaDesempenho() {
  const perfil = await obterPerfilAtual();
  const supabase = await criarClienteServidor();

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  // 1. Mês Corrente
  const inicioMes = format(startOfMonth(hoje), "yyyy-MM-dd");
  const fimMes = format(endOfMonth(hoje), "yyyy-MM-dd");

  // 2. Semestre Letivo
  let inicioSemestre = "";
  let fimSemestre = "";
  let rotuloSemestre = "";

  if (mesAtual <= 6) {
    inicioSemestre = `${ano}-01-01`;
    fimSemestre = `${ano}-06-30`;
    rotuloSemestre = `${ano}.01`;
  } else {
    inicioSemestre = `${ano}-07-01`;
    fimSemestre = `${ano}-12-31`;
    rotuloSemestre = `${ano}.02`;
  }

  // Executar função SQL de ranking para o mês corrente
  const { data: rankingMesData } = await supabase.rpc("calcular_ranking_desempenho", {
    p_data_inicio: inicioMes,
    p_data_fim: fimMes,
  });

  // Executar função SQL de ranking para o semestre letivo
  const { data: rankingSemestreData } = await supabase.rpc("calcular_ranking_desempenho", {
    p_data_inicio: inicioSemestre,
    p_data_fim: fimSemestre,
  });

  // 3. Calcular evolução pessoal dos últimos 6 meses
  const evolucaoPessoal: { mes: string; pontos: number; taxaPrazo: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(hoje, i);
    const iMes = format(startOfMonth(d), "yyyy-MM-dd");
    const fMes = format(endOfMonth(d), "yyyy-MM-dd");
    const rotulo = format(d, "MMM/yy", { locale: ptBR });

    const { data: rankMesHist } = await supabase.rpc("calcular_ranking_desempenho", {
      p_data_inicio: iMes,
      p_data_fim: fMes,
    });

    const linhaUser = (rankMesHist as RankingItem[] || []).find((r) => r.usuario_id === perfil.id);
    evolucaoPessoal.push({
      mes: rotulo,
      pontos: Number(linhaUser?.pontos_total || 0),
      taxaPrazo: Number(linhaUser?.taxa_prazo || 0),
    });
  }

  return (
    <PainelDesempenho
      rankingMes={(rankingMesData as RankingItem[]) || []}
      rankingSemestre={(rankingSemestreData as RankingItem[]) || []}
      perfilAtual={perfil}
      evolucaoPessoal={evolucaoPessoal}
      rotuloSemestre={rotuloSemestre}
    />
  );
}
