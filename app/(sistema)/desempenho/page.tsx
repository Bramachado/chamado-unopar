import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { PainelDesempenho } from "./painel-desempenho";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type RankingItem, type PapelUsuario } from "@/types/database";

async function calcularRanking(
  req: sql.Request,
  dataInicio: string,
  dataFim: string
): Promise<RankingItem[]> {
  const qPerfis = await req.query(`
    SELECT CAST(id AS NVARCHAR(50)) AS id, nome_completo, email, papel
    FROM dados.perfis
    WHERE ativo = 1
  `);

  const reqChamados = new sql.Request(req.transaction || (req as any).parent);
  reqChamados.input("ini", sql.DateTimeOffset, new Date(dataInicio));
  reqChamados.input("fim", sql.DateTimeOffset, new Date(dataFim + "T23:59:59.999Z"));

  const qChamados = await reqChamados.query(`
    SELECT 
      CAST(criado_por AS NVARCHAR(50)) AS criado_por,
      situacao,
      prazo,
      data_solicitacao,
      data_conclusao
    FROM dados.chamados
    WHERE excluido_em IS NULL
      AND importado = 0
      AND data_solicitacao >= @ini
      AND data_solicitacao <= @fim
  `);

  const perfis = qPerfis.recordset;
  const chamados = qChamados.recordset;

  const statsMap: Record<
    string,
    {
      usuario_id: string;
      nome_completo: string;
      email: string;
      papel: PapelUsuario;
      volume_total: number;
      resolvidos: number;
      encerrados: number;
      aguardando: number;
      no_prazo: number;
      dias_totais: number;
    }
  > = {};

  for (const p of perfis) {
    statsMap[p.id] = {
      usuario_id: p.id,
      nome_completo: p.nome_completo,
      email: p.email,
      papel: p.papel,
      volume_total: 0,
      resolvidos: 0,
      encerrados: 0,
      aguardando: 0,
      no_prazo: 0,
      dias_totais: 0,
    };
  }

  for (const c of chamados) {
    const uid = c.criado_por;
    if (!statsMap[uid]) continue;

    statsMap[uid].volume_total++;

    if (c.situacao === "concluido") {
      statsMap[uid].resolvidos++;
      if (c.data_conclusao && new Date(c.data_conclusao) <= new Date(c.prazo)) {
        statsMap[uid].no_prazo++;
      }
      if (c.data_conclusao) {
        const dias = Math.max(
          0,
          Math.round(
            (new Date(c.data_conclusao).getTime() - new Date(c.data_solicitacao).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
        statsMap[uid].dias_totais += dias;
      }
    } else if (c.situacao === "encerrado") {
      statsMap[uid].encerrados++;
    } else {
      statsMap[uid].aguardando++;
    }
  }

  const listaComPontos = Object.values(statsMap).map((item) => {
    const volumePonderado = item.resolvidos * 1.0 + item.encerrados * 0.5;
    const taxaPrazo = item.resolvidos > 0 ? (item.no_prazo / item.resolvidos) * 100 : 0;
    const tempoMedioDias = item.resolvidos > 0 ? Math.round((item.dias_totais / item.resolvidos) * 10) / 10 : 0;

    // Fórmula fixa equilibrada (Volume 40%, Prazo 40%, Agilidade 20%)
    const pontosVolume = Math.min(40, Math.round(item.resolvidos * 2.67 * 10) / 10);
    const pontosPrazo = item.resolvidos > 0 ? Math.round((item.no_prazo / item.resolvidos) * 40 * 10) / 10 : 0;

    let pontosAgilidade = 0;
    if (item.resolvidos > 0) {
      if (tempoMedioDias <= 1.0) pontosAgilidade = 20;
      else if (tempoMedioDias <= 2.0) pontosAgilidade = 15;
      else if (tempoMedioDias <= 3.0) pontosAgilidade = 10;
      else pontosAgilidade = 5;
    }

    const pontosTotal = item.resolvidos === 0 && item.encerrados === 0
      ? 0
      : Math.round((pontosVolume + pontosPrazo + pontosAgilidade) * 10) / 10;

    return {
      posicao: 0,
      usuario_id: item.usuario_id,
      nome_completo: item.nome_completo,
      email: item.email,
      papel: item.papel,
      volume_total: item.volume_total,
      resolvidos: item.resolvidos,
      encerrados: item.encerrados,
      aguardando: item.aguardando,
      volume_ponderado: volumePonderado,
      no_prazo: item.no_prazo,
      taxa_prazo: Math.round(taxaPrazo),
      tempo_medio_dias: tempoMedioDias,
      pontos_volume: pontosVolume,
      pontos_prazo: pontosPrazo,
      pontos_agilidade: pontosAgilidade,
      pontos_total: pontosTotal,
    };
  });

  // Ordenação por pontuação decrescente
  listaComPontos.sort((a, b) => {
    if (b.pontos_total !== a.pontos_total) return b.pontos_total - a.pontos_total;
    if (b.resolvidos !== a.resolvidos) return b.resolvidos - a.resolvidos;
    return b.volume_total - a.volume_total;
  });

  return listaComPontos.map((item, idx) => ({
    ...item,
    posicao: idx + 1,
  }));
}

export default async function PaginaDesempenho() {
  const perfilAtual = await obterPerfilAtual();

  const hoje = new Date();
  const inicioMes = format(startOfMonth(hoje), "yyyy-MM-01");
  const fimMes = format(endOfMonth(hoje), "yyyy-MM-dd");

  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const rotuloSemestre = mes <= 6 ? `${ano}.1` : `${ano}.2`;
  const inicioSemestre = mes <= 6 ? `${ano}-01-01` : `${ano}-07-01`;
  const fimSemestre = mes <= 6 ? `${ano}-06-30` : `${ano}-12-31`;

  const dados = await comUsuario(
    { usuario_id: perfilAtual.id, papel: perfilAtual.papel },
    async (req) => {
      const rankingMes = await calcularRanking(req, inicioMes, fimMes);
      const rankingSemestre = await calcularRanking(req, inicioSemestre, fimSemestre);

      const evolucaoPessoal: { mes: string; minhaPontuacao: number; mediaEquipe: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = subMonths(hoje, i);
        const ini = format(startOfMonth(d), "yyyy-MM-01");
        const fim = format(endOfMonth(d), "yyyy-MM-dd");
        const rotulo = format(d, "MMM/yy", { locale: ptBR });

        const hist = await calcularRanking(req, ini, fim);
        const meuItem = hist.find((r) => r.usuario_id === perfilAtual.id);
        const minhaPontuacao = meuItem?.pontos_total ?? 0;

        const somaEquipe = hist.reduce((acc, curr) => acc + (curr.pontos_total || 0), 0);
        const mediaEquipe = hist.length > 0 ? Math.round((somaEquipe / hist.length) * 10) / 10 : 0;

        evolucaoPessoal.push({
          mes: rotulo,
          minhaPontuacao,
          mediaEquipe,
        });
      }

      return {
        rankingMes,
        rankingSemestre,
        evolucaoPessoal,
      };
    }
  );

  return (
    <PainelDesempenho
      rankingMes={dados.rankingMes}
      rankingSemestre={dados.rankingSemestre}
      perfilAtual={perfilAtual}
      evolucaoPessoal={dados.evolucaoPessoal}
      rotuloSemestre={rotuloSemestre}
    />
  );
}
