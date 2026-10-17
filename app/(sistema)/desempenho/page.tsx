import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { PainelDesempenho, type RecorteDesempenho } from "./painel-desempenho";
import {
  adicionarMeses,
  fimDoMes,
  hojeCivil,
  inicioDoMes,
  instanteDoBanco,
  rotuloMes,
} from "@/lib/datas";
import { calcularRanking, VERSAO_FORMULA } from "@/lib/indicadores/pontuacao";
import { dentroDoPeriodo, type Periodo } from "@/lib/indicadores/definicoes";
import {
  carregarBaseIndicadores,
  poloEfetivo,
  resolverPeriodo,
  type ChamadoBase,
} from "@/lib/indicadores/carregar";
import { filtrosParaQuery } from "@/lib/chamados/filtros";
import { ehPendente } from "@/lib/chamados/situacoes";
import type { Polo } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ polo_id?: string }>;
}

export default async function PaginaDesempenho({ searchParams }: PageProps) {
  const perfilAtual = await obterPerfilAtual();
  const params = await searchParams;
  const hoje = hojeCivil();
  const poloId = poloEfetivo(perfilAtual, params.polo_id);
  const mes = resolverPeriodo("mes_atual", hoje);
  const semestre = resolverPeriodo("semestre_atual", hoje);
  const inicio6m = inicioDoMes(adicionarMeses(hoje, -5));
  const desde = semestre.periodo.inicio < inicio6m ? semestre.periodo.inicio : inicio6m;

  const { base, polos } = await comTransacao(
    { usuario_id: perfilAtual.id, papel: perfilAtual.papel },
    async (_req, tx) => {
      const base = await carregarBaseIndicadores(tx, perfilAtual, { poloId, desde });
      const reqPolos = novaRequisicao(tx);
      let filtro = "";
      if (perfilAtual.papel !== "admin" && perfilAtual.polo_id) {
        reqPolos.input("meu", sql.UniqueIdentifier, perfilAtual.polo_id);
        filtro = " AND id = @meu";
      }
      const polos = await reqPolos.query(
        `SELECT CAST(id AS NVARCHAR(50)) AS id, nome, codigo, cidade, estado, ativo, criado_em FROM dados.polos WHERE ativo = 1${filtro} ORDER BY nome`
      );
      return { base, polos: polos.recordset };
    }
  );

  // Mesma população do Dashboard: não importados, finalizados no período (+ pendentes só para exibição)
  const pontuaveis = (periodo: Periodo): ChamadoBase[] =>
    base.chamados.filter(
      (c) => !c.importado && (ehPendente(c.situacao) || dentroDoPeriodo(c.dia_conclusao, periodo))
    );

  const recortes: RecorteDesempenho[] = [mes, semestre].map(({ rotulo, periodo }) => {
    const { linhas, equipe } = calcularRanking(
      base.participantes,
      pontuaveis(periodo),
      base.feriados
    );
    // Link para a listagem com exatamente os chamados que formam a nota de cada pessoa
    const links = Object.fromEntries(
      linhas.map((l) => [
        l.usuario_id,
        `/chamados?${filtrosParaQuery({
          escopo: "todos",
          responsavel_id: l.usuario_id,
          situacao: "finalizados",
          conclusao_de: periodo.inicio,
          conclusao_ate: periodo.fim,
        })}`,
      ])
    );
    return { rotulo, periodo, linhas, equipe, links };
  });

  const eu = perfilAtual.id.toLowerCase();
  const evolucao = Array.from({ length: 6 }, (_, i) => {
    const ini = inicioDoMes(adicionarMeses(hoje, i - 5));
    const { linhas, equipe } = calcularRanking(
      base.participantes,
      pontuaveis({ inicio: ini, fim: fimDoMes(ini) }),
      base.feriados
    );
    return {
      mes: rotuloMes(ini),
      minhaPontuacao: linhas.find((l) => l.usuario_id === eu)?.pontos_total ?? null,
      mediaEquipe: equipe.media_pontos,
    };
  });

  const polosFormatados: Polo[] = polos.map((p) => ({
    ...p,
    ativo: Boolean(p.ativo),
    criado_em: instanteDoBanco(p.criado_em) ?? "",
  }));

  return (
    <PainelDesempenho
      recortes={recortes}
      perfilAtual={perfilAtual}
      evolucao={evolucao}
      polos={polosFormatados}
      poloSelecionado={poloId ?? "todos"}
      versaoFormula={VERSAO_FORMULA}
    />
  );
}
