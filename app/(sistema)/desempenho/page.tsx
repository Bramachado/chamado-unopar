import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { PainelDesempenho } from "./painel-desempenho";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type RankingItem, type PapelUsuario, type Polo } from "@/types/database";

interface PageProps {
  searchParams: Promise<{
    polo_id?: string;
  }>;
}

function calcularRankingEmMemoria(
  perfis: any[],
  chamados: any[],
  dataInicioStr: string,
  dataFimStr: string
): RankingItem[] {
  const dtInicio = new Date(dataInicioStr).getTime();
  const dtFim = new Date(dataFimStr + "T23:59:59.999Z").getTime();

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
    const tSol = new Date(c.data_solicitacao).getTime();
    if (tSol < dtInicio || tSol > dtFim) continue;

    const uid = c.criado_por;
    if (!statsMap[uid]) continue;

    statsMap[uid].volume_total++;

    if (c.situacao === "concluido") {
      statsMap[uid].resolvidos++;

      if (c.data_conclusao && c.prazo) {
        const dConc = new Date(c.data_conclusao).getTime();
        const dPrazo = new Date(c.prazo).getTime();
        if (dConc <= dPrazo) {
          statsMap[uid].no_prazo++;
        }
      }

      if (c.data_conclusao && c.data_solicitacao) {
        const dConc = new Date(c.data_conclusao).getTime();
        const diffDias = Math.max(0, (dConc - tSol) / (1000 * 60 * 60 * 24));
        statsMap[uid].dias_totais += diffDias;
      }
    } else if (c.situacao === "encerrado") {
      statsMap[uid].encerrados++;
    } else {
      statsMap[uid].aguardando++;
    }
  }

  const ranking: RankingItem[] = Object.values(statsMap).map((s) => {
    const taxaPrazo = s.resolvidos > 0 ? (s.no_prazo / s.resolvidos) * 100 : 0;
    const tempoMedio = s.resolvidos > 0 ? Math.round((s.dias_totais / s.resolvidos) * 10) / 10 : 0;

    const volumePonderado = s.resolvidos * 2 + s.encerrados * 0.5;
    const pontosVolume = Math.round(volumePonderado * 4);
    const pontosPrazo = Math.round((taxaPrazo / 100) * 40);

    let pontosAgilidade = 0;
    if (s.resolvidos > 0) {
      if (tempoMedio <= 2) pontosAgilidade = 20;
      else if (tempoMedio <= 4) pontosAgilidade = 12;
      else if (tempoMedio <= 5) pontosAgilidade = 6;
    }

    const pontosTotal = pontosVolume + pontosPrazo + pontosAgilidade;

    return {
      posicao: 0,
      usuario_id: s.usuario_id,
      nome_completo: s.nome_completo,
      email: s.email,
      papel: s.papel,
      volume_total: s.volume_total,
      resolvidos: s.resolvidos,
      encerrados: s.encerrados,
      aguardando: s.aguardando,
      volume_ponderado: volumePonderado,
      no_prazo: s.no_prazo,
      taxa_prazo: Math.round(taxaPrazo * 10) / 10,
      tempo_medio_dias: tempoMedio,
      pontos_volume: pontosVolume,
      pontos_prazo: pontosPrazo,
      pontos_agilidade: pontosAgilidade,
      pontos_total: pontosTotal,
    };
  });

  ranking.sort((a, b) => b.pontos_total - a.pontos_total);
  ranking.forEach((r, idx) => {
    r.posicao = idx + 1;
  });

  return ranking;
}

export default async function PaginaDesempenho({ searchParams }: PageProps) {
  const perfilAtual = await obterPerfilAtual();
  const params = await searchParams;
  const poloId = params.polo_id || "todos";

  const hoje = new Date();
  const inicioMes = format(startOfMonth(hoje), "yyyy-MM-01");
  const fimMes = format(endOfMonth(hoje), "yyyy-MM-dd");

  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const rotuloSemestre = mes <= 6 ? `${ano}.1` : `${ano}.2`;
  const inicioSemestre = mes <= 6 ? `${ano}-01-01` : `${ano}-07-01`;
  const fimSemestre = mes <= 6 ? `${ano}-06-30` : `${ano}-12-31`;

  const inicio6Meses = format(startOfMonth(subMonths(hoje, 5)), "yyyy-MM-01");
  const dataMinimaStr = inicioSemestre < inicio6Meses ? inicioSemestre : inicio6Meses;

  const dados = await comUsuario(
    { usuario_id: perfilAtual.id, papel: perfilAtual.papel },
    async (req) => {
      let sqlPoloPerfis = "";
      let sqlPoloChamados = "";
      if (poloId !== "todos") {
        req.input("poloIdParam", sql.UniqueIdentifier, poloId);
        sqlPoloPerfis = " AND polo_id = @poloIdParam";
        sqlPoloChamados = " AND polo_id = @poloIdParam";
      }

      req.input("dtMinima", sql.DateTimeOffset, new Date(dataMinimaStr));

      const batch = await req.query(`
        -- 1. Polos ativos
        SELECT CAST(id AS NVARCHAR(50)) AS id, nome, codigo, cidade, estado, ativo, criado_em
        FROM dados.polos
        WHERE ativo = 1
        ORDER BY nome ASC;

        -- 2. Perfis ativos
        SELECT CAST(id AS NVARCHAR(50)) AS id, nome_completo, email, papel
        FROM dados.perfis
        WHERE ativo = 1
          ${sqlPoloPerfis};

        -- 3. Chamados do período total
        SELECT 
          CAST(criado_por AS NVARCHAR(50)) AS criado_por,
          situacao,
          prazo,
          data_solicitacao,
          data_conclusao
        FROM dados.chamados
        WHERE excluido_em IS NULL
          AND importado = 0
          AND data_solicitacao >= @dtMinima
          ${sqlPoloChamados};
      `);

      const rsets = batch.recordsets as any[];
      const polos = rsets[0] || [];
      const perfis = rsets[1] || [];
      const chamados = rsets[2] || [];

      const rankingMes = calcularRankingEmMemoria(perfis, chamados, inicioMes, fimMes);
      const rankingSemestre = calcularRankingEmMemoria(
        perfis,
        chamados,
        inicioSemestre,
        fimSemestre
      );

      const evolucaoPessoal: { mes: string; minhaPontuacao: number; mediaEquipe: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = subMonths(hoje, i);
        const ini = format(startOfMonth(d), "yyyy-MM-01");
        const fim = format(endOfMonth(d), "yyyy-MM-dd");
        const rotulo = format(d, "MMM/yy", { locale: ptBR });

        const hist = calcularRankingEmMemoria(perfis, chamados, ini, fim);
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
        polos,
        rankingMes,
        rankingSemestre,
        evolucaoPessoal,
      };
    }
  );

  const polosFormatados: Polo[] = dados.polos.map((p: any) => ({
    id: p.id,
    nome: p.nome,
    codigo: p.codigo,
    cidade: p.cidade,
    estado: p.estado,
    ativo: Boolean(p.ativo),
    criado_em: p.criado_em ? new Date(p.criado_em).toISOString() : new Date().toISOString(),
  }));

  return (
    <PainelDesempenho
      rankingMes={dados.rankingMes}
      rankingSemestre={dados.rankingSemestre}
      perfilAtual={perfilAtual}
      evolucaoPessoal={dados.evolucaoPessoal}
      rotuloSemestre={rotuloSemestre}
      polos={polosFormatados}
      poloSelecionado={poloId}
    />
  );
}
