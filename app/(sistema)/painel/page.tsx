import { obterPerfilAtual } from "@/lib/auth/perfil";
import { obterAvatarUsuario } from "@/lib/auth/avatar";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { PainelDashboard, type DadosPainel } from "./painel-dashboard";
import {
  adicionarMeses,
  fimDoMes,
  hojeCivil,
  inicioDoMes,
  instanteDoBanco,
  rotuloMes,
} from "@/lib/datas";
import {
  calcularIndicadores,
  dentroDoPeriodo,
  tempoMedioPorGrupo,
} from "@/lib/indicadores/definicoes";
import { calcularRanking } from "@/lib/indicadores/pontuacao";
import { carregarBaseIndicadores, poloEfetivo, resolverPeriodo } from "@/lib/indicadores/carregar";
import { filtrosParaQuery } from "@/lib/chamados/filtros";
import { classificarPrazo, concluidoNoPrazo } from "@/lib/sla";
import { ehPendente } from "@/lib/chamados/situacoes";
import type { Polo } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ periodo?: string; polo_id?: string }>;
}

export default async function PaginaPainel({ searchParams }: PageProps) {
  const perfilAtual = await obterPerfilAtual();
  const params = await searchParams;
  const hoje = hojeCivil();
  const { codigo, periodo, rotulo } = resolverPeriodo(params.periodo, hoje);
  const poloId = poloEfetivo(perfilAtual, params.polo_id);
  const inicio12m = inicioDoMes(adicionarMeses(hoje, -11));
  const desde = periodo.inicio < inicio12m ? periodo.inicio : inicio12m;

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

  const { chamados, participantes, feriados } = base;
  const indicadores = calcularIndicadores(chamados, periodo, hoje, feriados);

  // Ranking: mesma função e mesma população (finalizados no período) da tela de Desempenho
  const pontuaveis = chamados.filter(
    (c) => !c.importado && (ehPendente(c.situacao) || dentroDoPeriodo(c.dia_conclusao, periodo))
  );
  const { linhas, equipe } = calcularRanking(participantes, pontuaveis, feriados);
  const fotos = Object.fromEntries(
    await Promise.all(
      linhas.map(async (l) => [l.usuario_id, await obterAvatarUsuario(l.usuario_id)] as const)
    )
  );

  const rotuloMotivo = (c: { motivo_codigo?: string | null; motivo_nome?: string | null }) =>
    c.motivo_codigo ? `${c.motivo_codigo} ${c.motivo_nome ?? ""}`.trim() : "Sem motivo";
  const contagemMotivos = new Map<string, { codigo: string; nome: string; total: number }>();
  for (const c of chamados) {
    if (!dentroDoPeriodo(c.data_solicitacao, periodo)) continue;
    const k = c.motivo_codigo ?? "—";
    const atual = contagemMotivos.get(k) ?? {
      codigo: k,
      nome: c.motivo_nome ?? "Sem motivo",
      total: 0,
    };
    atual.total++;
    contagemMotivos.set(k, atual);
  }
  const tempoPorMotivo = tempoMedioPorGrupo(
    chamados,
    periodo,
    (c) => ({ chave: c.motivo_codigo ?? "—", rotulo: rotuloMotivo(c) }),
    feriados
  )
    .sort((a, b) => b.tempo_medio_dias_uteis - a.tempo_medio_dias_uteis)
    .slice(0, 8);

  const mensal = Array.from({ length: 12 }, (_, i) => {
    const ini = inicioDoMes(adicionarMeses(hoje, i - 11));
    const mes = { inicio: ini, fim: fimDoMes(ini) };
    let abertos = 0;
    let resolvidos = 0;
    let noPrazo = 0;
    for (const c of chamados) {
      if (dentroDoPeriodo(c.data_solicitacao, mes)) abertos++;
      if (c.situacao === "concluido" && dentroDoPeriodo(c.dia_conclusao, mes)) {
        resolvidos++;
        if (concluidoNoPrazo(c.dia_conclusao!, c.prazo)) noPrazo++;
      }
    }
    return {
      mes: rotuloMes(ini),
      abertos,
      resolvidos,
      taxa_sla: resolvidos > 0 ? Math.round((noPrazo / resolvidos) * 1000) / 10 : null,
    };
  });

  const criticos = chamados
    .filter((c) => ehPendente(c.situacao))
    .map((c) => ({ ...c, classe: classificarPrazo(c.prazo, hoje) }))
    .filter((c) => c.classe !== "no_prazo")
    .sort((a, b) => (a.prazo < b.prazo ? -1 : 1))
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      protocolo: c.protocolo,
      aluno_nome: c.aluno_nome,
      prazo: c.prazo,
      classe: c.classe,
      responsavel: c.responsavel_nome ?? "—",
    }));

  const comuns = { escopo: "todos" as const, polo_id: poloId ?? undefined };
  const links = {
    abertos: `/chamados?${filtrosParaQuery({ ...comuns, abertura_de: periodo.inicio, abertura_ate: periodo.fim })}`,
    resolvidos: `/chamados?${filtrosParaQuery({ ...comuns, situacao: "concluido", conclusao_de: periodo.inicio, conclusao_ate: periodo.fim })}`,
    encerrados: `/chamados?${filtrosParaQuery({ ...comuns, situacao: "encerrado", conclusao_de: periodo.inicio, conclusao_ate: periodo.fim })}`,
    estoque: `/chamados?${filtrosParaQuery({ ...comuns, situacao: "pendentes" })}`,
    vencidos: `/chamados?${filtrosParaQuery({ ...comuns, filtro_prazo: "vencidos" })}`,
    vencendo: `/chamados?${filtrosParaQuery({ ...comuns, filtro_prazo: "ate_2_dias" })}`,
  };

  const polosFormatados: Polo[] = polos.map((p) => ({
    ...p,
    ativo: Boolean(p.ativo),
    criado_em: instanteDoBanco(p.criado_em) ?? "",
  }));
  const dados: DadosPainel = {
    periodo: { codigo, rotulo, ...periodo },
    hoje,
    poloNome: poloId
      ? (polosFormatados.find((p) => p.id.toLowerCase() === poloId.toLowerCase())?.nome ?? "Polo")
      : "Todos os polos",
    indicadores,
    links,
    ranking: linhas.map((l) => ({ ...l, foto: fotos[l.usuario_id] ?? null })),
    equipe,
    mensal,
    topMotivos: [...contagemMotivos.values()].sort((a, b) => b.total - a.total).slice(0, 8),
    tempoPorMotivo,
    criticos,
  };

  return (
    <PainelDashboard
      dados={dados}
      polos={polosFormatados}
      poloSelecionado={poloId ?? "todos"}
      perfilAtual={perfilAtual}
    />
  );
}
