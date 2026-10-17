import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularIndicadores, type ChamadoIndicador } from "../lib/indicadores/definicoes";

let n = 0;
const c = (
  situacao: string,
  abertura: string,
  prazo: string,
  conclusao: string | null = null
): ChamadoIndicador => ({
  id: `x${++n}`,
  situacao,
  data_solicitacao: abertura,
  prazo,
  dia_conclusao: conclusao,
});

const hoje = "2026-10-16";
const outubro = { inicio: "2026-10-01", fim: "2026-10-31" };

const base: ChamadoIndicador[] = [
  c("aguardando", "2026-10-01", "2026-10-08"), // aberto em out, vencido
  c("em_atendimento", "2026-10-14", "2026-10-21"), // aberto em out, no prazo
  c("aguardando_aluno", "2026-10-12", "2026-10-16"), // vence hoje
  c("rascunho", "2026-09-20", "2026-09-25"), // aberto em set, vencido (estoque não depende do período)
  c("concluido", "2026-10-02", "2026-10-09", "2026-10-09"), // resolvido em out, no prazo (último dia)
  c("concluido", "2026-09-28", "2026-10-05", "2026-10-06"), // aberto em set, resolvido em out, atrasado
  c("concluido", "2026-09-01", "2026-09-08", "2026-09-04"), // resolvido em set
  c("encerrado", "2026-10-05", "2026-10-13", "2026-10-07"),
];

test("cada indicador tem sua população e seu critério temporal", () => {
  const i = calcularIndicadores(base, outubro, hoje);
  assert.equal(i.abertos_no_periodo, 5); // abertura em outubro
  assert.equal(i.resolvidos_no_periodo, 2); // conclusão em outubro
  assert.equal(i.encerrados_no_periodo, 1);
  assert.equal(i.resolvidos_no_prazo, 1);
  assert.equal(i.estoque_pendente, 4); // agora, independente do período
  assert.equal(i.vencidos_pendentes, 2);
  assert.equal(i.vencem_ate_2_dias, 1);
});

test("taxa de resolução (coorte) e taxa de SLA são indicadores distintos", () => {
  const i = calcularIndicadores(base, outubro, hoje);
  // coorte de outubro: 5 abertos, 1 resolvido -> 20%
  assert.equal(i.coorte_resolvidos, 1);
  assert.equal(i.taxa_resolucao, 20);
  // SLA dos resolvidos em outubro: 1 de 2 -> 50%
  assert.equal(i.taxa_sla, 50);
});

test("tempo médio em dias úteis, ponderado por chamado", () => {
  const i = calcularIndicadores(base, outubro, hoje);
  // 02/10 (sex) -> 09/10 (sex) = 5 dias úteis; 28/09 (seg) -> 06/10 (ter) = 6 dias úteis
  assert.equal(i.tempo_medio_dias_uteis, 5.5);
});

test("denominador zero resulta em null (sem dados), não em 0%", () => {
  const i = calcularIndicadores([], outubro, hoje);
  assert.equal(i.taxa_resolucao, null);
  assert.equal(i.taxa_sla, null);
  assert.equal(i.tempo_medio_dias_uteis, null);
  assert.equal(i.estoque_pendente, 0);
});

test("evidência relatada: 'vencidos' do dashboard antigo (só abertos no período) x estoque vencido", () => {
  const i = calcularIndicadores(base, outubro, hoje);
  const vencidosApenasDaCoorte = base.filter(
    (x) => x.data_solicitacao >= outubro.inicio && x.situacao === "aguardando" && x.prazo < hoje
  ).length;
  assert.equal(vencidosApenasDaCoorte, 1); // critério antigo do Dashboard
  assert.equal(i.vencidos_pendentes, 2); // estoque atual, igual à listagem com filtro "vencidos"
});
