import { integracaoHabilitada } from "./ambiente";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { IDS } from "../../db/teste/ids";

const opcoes = { skip: !integracaoHabilitada && "Defina TESTE_APP_SENHA/TESTE_DB_SA_SENHA." };
type PerfilTeste = { id: string; papel: string; polo_id: string | null; nome_completo: string };
const admin: PerfilTeste = {
  id: IDS.admin,
  papel: "admin",
  polo_id: null,
  nome_completo: "Ana Administradora",
};
const coord: PerfilTeste = {
  id: IDS.coordPQB,
  papel: "coordenador",
  polo_id: IDS.poloPQB,
  nome_completo: "Carla Coordenação",
};
const bia: PerfilTeste = {
  id: IDS.atendPQB,
  papel: "atendente",
  polo_id: IDS.poloPQB,
  nome_completo: "Bia Atendente",
};
const CAMINHO =
  "GRAD/ EJA/ TEC > Acadêmico > Não consegue estudar no AVA > Problema com o conteúdo";

let servico: typeof import("../../lib/motivos/servico");
let db: typeof import("../../lib/db/comUsuario");
let pool: typeof import("../../lib/db/pool");

before(async () => {
  if (!integracaoHabilitada) return;
  await (await import("../../db/teste/preparar")).prepararBancoTeste(() => {});
  servico = await import("../../lib/motivos/servico");
  db = await import("../../lib/db/comUsuario");
  pool = await import("../../lib/db/pool");
});
after(async () => {
  if (integracaoHabilitada) (await pool.getPool()).close();
});

test("atendente não altera o catálogo", opcoes, async () => {
  await assert.rejects(
    servico.salvarMotivo(bia, { nome: "Qualquer motivo" }),
    /administração e coordenação/
  );
});

test(
  "duplicidade exata (acentos, caixa e espaços) é recusada; semelhante pede confirmação",
  opcoes,
  async () => {
    const exato = await servico.salvarMotivo(coord, {
      nome: "  PROBLEMA   com o CONTEUDO ",
      filtro: CAMINHO,
    });
    assert.equal(exato.ok, false);
    assert.equal(!exato.ok && exato.semelhantes[0]?.tipo, "duplicado_exato");

    const semelhante = await servico.salvarMotivo(coord, {
      nome: "Conteúdo com problema",
      filtro: "Outro caminho",
    });
    assert.equal(semelhante.ok, false);
    assert.equal(!semelhante.ok && semelhante.semelhantes[0]?.tipo, "nome_semelhante");

    const confirmado = await servico.salvarMotivo(coord, {
      nome: "Conteúdo com problema",
      filtro: "Outro caminho",
      confirmarSemelhante: true,
    });
    assert.equal(confirmado.ok, true);
  }
);

test("criações simultâneas do mesmo motivo resultam em um único registro", opcoes, async () => {
  const tentativas = await Promise.allSettled(
    Array.from({ length: 4 }, () =>
      servico.salvarMotivo(admin, {
        nome: "Segunda via de diploma",
        filtro: "Diplomas > 2ª via",
        confirmarSemelhante: true,
      })
    )
  );
  const criados = tentativas.filter((t) => t.status === "fulfilled" && t.value.ok).length;
  assert.equal(criados, 1);
  const n = await db.comTransacao({ usuario_id: admin.id, papel: "admin", ip: null }, (req) =>
    req.query("SELECT COUNT(*) AS n FROM dados.motivos WHERE chave_nome = 'segunda via de diploma'")
  );
  assert.equal(n.recordset[0].n, 1);
});

test("consolidação #47 → #51 move os chamados com rastro e desativa a origem", opcoes, async () => {
  await assert.rejects(
    servico.consolidarMotivos(coord, IDS.motivo47, IDS.motivo51, "duplicidade confirmada"),
    /administradores/
  );
  const movidos = await servico.consolidarMotivos(
    admin,
    IDS.motivo47,
    IDS.motivo51,
    "Mesmo caminho no PAD; duplicidade confirmada"
  );
  assert.equal(movidos, 1);
  const r = await db.comTransacao({ usuario_id: admin.id, papel: "admin", ip: null }, (req) =>
    req.query(`
      SELECT (SELECT COUNT(*) FROM dados.chamados WHERE motivo_id = '${IDS.motivo47}') AS restantes,
             (SELECT ativo FROM dados.motivos WHERE id = '${IDS.motivo47}') AS ativo,
             (SELECT CAST(consolidado_para_id AS NVARCHAR(50)) FROM dados.motivos WHERE id = '${IDS.motivo47}') AS destino,
             (SELECT COUNT(*) FROM dados.chamado_eventos WHERE tipo = 'consolidacao_motivo') AS eventos,
             (SELECT COUNT(*) FROM auditoria.logs WHERE tabela = 'chamados' AND campos_alterados LIKE '%motivo_id%') AS auditados`)
  );
  const x = r.recordset[0];
  assert.equal(x.restantes, 0);
  assert.equal(x.ativo, false);
  assert.equal(x.destino.toLowerCase(), IDS.motivo51);
  assert.equal(x.eventos, 1);
  assert.ok(x.auditados >= 1);
});
