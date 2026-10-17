import { integracaoHabilitada } from "./ambiente";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { IDS } from "../../db/teste/ids";

const opcoes = { skip: !integracaoHabilitada && "Defina TESTE_APP_SENHA/TESTE_DB_SA_SENHA." };

type PerfilTeste = { id: string; papel: string; polo_id: string | null; nome_completo: string };
const admin: PerfilTeste = {
  id: IDS.admin,
  papel: "admin",
  polo_id: null as string | null,
  nome_completo: "Ana Administradora",
};
const biaPQB: PerfilTeste = {
  id: IDS.atendPQB,
  papel: "atendente",
  polo_id: IDS.poloPQB as string | null,
  nome_completo: "Bia Atendente",
};
const HOJE = "2026-10-16";
const OUTUBRO = { inicio: "2026-10-01", fim: "2026-10-31" };

let mods: {
  comTransacao: typeof import("../../lib/db/comUsuario").comTransacao;
  novaRequisicao: typeof import("../../lib/db/comUsuario").novaRequisicao;
  carregar: typeof import("../../lib/indicadores/carregar");
  definicoes: typeof import("../../lib/indicadores/definicoes");
  pontuacao: typeof import("../../lib/indicadores/pontuacao");
  filtros: typeof import("../../lib/chamados/filtros");
  pool: typeof import("../../lib/db/pool");
};

before(async () => {
  if (!integracaoHabilitada) return;
  const { prepararBancoTeste } = await import("../../db/teste/preparar");
  await prepararBancoTeste(() => {});
  const db = await import("../../lib/db/comUsuario");
  mods = {
    comTransacao: db.comTransacao,
    novaRequisicao: db.novaRequisicao,
    carregar: await import("../../lib/indicadores/carregar"),
    definicoes: await import("../../lib/indicadores/definicoes"),
    pontuacao: await import("../../lib/indicadores/pontuacao"),
    filtros: await import("../../lib/chamados/filtros"),
    pool: await import("../../lib/db/pool"),
  };
});

after(async () => {
  if (integracaoHabilitada) (await mods.pool.getPool()).close();
});

async function contarListagem(perfil: PerfilTeste, parametros: Record<string, string>) {
  const f = mods.filtros.lerFiltros(parametros, perfil);
  return mods.comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel, ip: null },
    async (_r, tx) => {
      const req = mods.novaRequisicao(tx);
      const where = mods.filtros.montarWhere(req, perfil, f, HOJE);
      return (await req.query(`SELECT COUNT(*) AS n FROM dados.chamados c ${where}`)).recordset[0]
        .n as number;
    }
  );
}

async function indicadores(perfil: PerfilTeste, poloId: string | null) {
  return mods.comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel, ip: null },
    async (_r, tx) => {
      const base = await mods.carregar.carregarBaseIndicadores(tx, perfil, {
        poloId,
        desde: "2025-11-01",
      });
      return {
        base,
        ind: mods.definicoes.calcularIndicadores(base.chamados, OUTUBRO, HOJE, base.feriados),
      };
    }
  );
}

test(
  "cartões do Dashboard reconciliam com a listagem (mesma população e filtros)",
  opcoes,
  async () => {
    const { ind } = await indicadores(admin, null);
    assert.equal(
      await contarListagem(admin, {
        escopo: "todos",
        abertura_de: OUTUBRO.inicio,
        abertura_ate: OUTUBRO.fim,
      }),
      ind.abertos_no_periodo
    );
    assert.equal(
      await contarListagem(admin, {
        escopo: "todos",
        situacao: "concluido",
        conclusao_de: OUTUBRO.inicio,
        conclusao_ate: OUTUBRO.fim,
      }),
      ind.resolvidos_no_periodo
    );
    assert.equal(
      await contarListagem(admin, { escopo: "todos", situacao: "pendentes" }),
      ind.estoque_pendente
    );
    assert.equal(
      await contarListagem(admin, { escopo: "todos", filtro_prazo: "vencidos" }),
      ind.vencidos_pendentes
    );
    assert.equal(
      await contarListagem(admin, { escopo: "todos", filtro_prazo: "ate_2_dias" }),
      ind.vencem_ate_2_dias
    );
  }
);

test(
  "conclusão às 23:30 locais do último dia do prazo conta como resolvido no prazo",
  opcoes,
  async () => {
    const { base } = await indicadores(admin, IDS.poloPQB);
    const c = base.chamados.find((x) => x.id.toLowerCase() === IDS.chNoLimite)!;
    assert.equal(c.dia_conclusao, "2026-10-08"); // 02:30 UTC do dia 09 = 23:30 do dia 08 em SP
    assert.equal(c.prazo, "2026-10-08");
  }
);

test(
  "escopo de polo: atendente de PQB que pede CCJ recebe só indicadores de PQB",
  opcoes,
  async () => {
    const poloUsado = mods.carregar.poloEfetivo(biaPQB, IDS.poloCCJ); // tenta pedir outro polo
    assert.equal(poloUsado, IDS.poloPQB);
    const { base } = await indicadores(biaPQB, poloUsado);
    const ids = base.chamados.map((c) => c.id.toLowerCase());
    assert.ok(ids.includes(IDS.chNoLimite)); // PQB
    assert.ok(!ids.includes(IDS.chCCJ) && !ids.includes(IDS.chCCJConcluido)); // CCJ fora
    assert.ok(base.participantes.every((p) => p.polo_id?.toLowerCase() === IDS.poloPQB));
  }
);

test(
  "pontuação reproduzível a partir dos chamados considerados e limitada a 0–100",
  opcoes,
  async () => {
    const { base } = await indicadores(admin, null);
    const pontuaveis = base.chamados.filter(
      (c) =>
        !c.importado &&
        (c.situacao !== "concluido" && c.situacao !== "encerrado"
          ? true
          : mods.definicoes.dentroDoPeriodo(c.dia_conclusao, OUTUBRO))
    );
    const { linhas } = mods.pontuacao.calcularRanking(
      base.participantes,
      pontuaveis,
      base.feriados
    );
    for (const l of linhas.filter((x) => x.elegivel)) {
      const soma = Math.round((l.pontos.volume + l.pontos.prazo + l.pontos.agilidade) * 10) / 10;
      assert.equal(l.pontos_total, soma);
      assert.ok(l.pontos_total! >= 0 && l.pontos_total! <= 100);
      const reprocessado = mods.pontuacao
        .calcularRanking(
          base.participantes,
          pontuaveis.filter(
            (c) => l.chamados_considerados.includes(c.id) || c.responsavel_id !== l.usuario_id
          ),
          base.feriados
        )
        .linhas.find((x) => x.usuario_id === l.usuario_id)!;
      assert.equal(reprocessado.pontos_total, l.pontos_total);
    }
    assert.equal(
      linhas.some((l) => l.usuario_id === IDS.admin),
      false
    );
  }
);
