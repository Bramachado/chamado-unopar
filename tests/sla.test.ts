import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adicionarDiasUteis,
  calcularPrazoPadrao,
  classificarPrazo,
  concluidoNoPrazo,
  diasUteisEntre,
  domingoDePascoa,
  ehDiaUtil,
  feriadosNacionais,
} from "../lib/sla";

test("Páscoa e Sexta-feira Santa calculadas corretamente", () => {
  assert.equal(domingoDePascoa(2025), "2025-04-20");
  assert.equal(domingoDePascoa(2026), "2026-04-05");
  assert.equal(domingoDePascoa(2027), "2027-03-28");
  assert.equal(feriadosNacionais(2026).get("2026-04-03"), "Sexta-feira Santa");
});

test("dia da abertura não conta; prazo em semana sem feriado", () => {
  // quarta 14/10/2026 -> qui 15, sex 16, seg 19, ter 20, qua 21
  assert.equal(calcularPrazoPadrao("2026-10-14"), "2026-10-21");
});

test("fins de semana são pulados (abertura na sexta e no sábado)", () => {
  // sexta 16/10 -> seg 19, ter 20, qua 21, qui 22, sex 23
  assert.equal(calcularPrazoPadrao("2026-10-16"), "2026-10-23");
  // sábado 17/10 -> mesmo resultado: primeiro dia útil é segunda 19
  assert.equal(calcularPrazoPadrao("2026-10-17"), "2026-10-23");
});

test("feriado nacional é pulado (12/10 Nossa Senhora Aparecida)", () => {
  // sexta 09/10/2026 -> seg 12 feriado; ter 13, qua 14, qui 15, sex 16, seg 19
  assert.equal(calcularPrazoPadrao("2026-10-09"), "2026-10-19");
  assert.equal(ehDiaUtil("2026-10-12"), false);
});

test("feriados nacionais em sequência (Finados 02/11, República 15/11 domingo, Consciência Negra 20/11)", () => {
  // sexta 30/10/2026 -> seg 02/11 feriado; ter 03, qua 04, qui 05, sex 06, seg 09
  assert.equal(calcularPrazoPadrao("2026-10-30"), "2026-11-09");
  // ter 17/11/2026 -> qua 18, qui 19, sex 20 feriado, seg 23, ter 24, qua 25
  assert.equal(calcularPrazoPadrao("2026-11-17"), "2026-11-25");
});

test("virada de mês", () => {
  // qua 28/01/2026 -> qui 29, sex 30, seg 02/02, ter 03, qua 04
  assert.equal(calcularPrazoPadrao("2026-01-28"), "2026-02-04");
});

test("virada de ano com Natal e Confraternização", () => {
  // qua 23/12/2026 -> qui 24, sex 25 feriado, seg 28, ter 29, qua 30, qui 31
  assert.equal(calcularPrazoPadrao("2026-12-23"), "2026-12-31");
  // qui 24/12/2026 -> sex 25 feriado, seg 28, ter 29, qua 30, qui 31, sex 01/01 feriado, seg 04/01
  assert.equal(calcularPrazoPadrao("2026-12-24"), "2027-01-04");
});

test("Sexta-feira Santa (2026-04-03)", () => {
  // ter 31/03/2026 -> qua 01, qui 02, sex 03 feriado, seg 06, ter 07, qua 08
  assert.equal(calcularPrazoPadrao("2026-03-31"), "2026-04-08");
});

test("feriados institucionais/locais informados como extras", () => {
  // 15/08 (Adesão do Pará) cai num sábado em 2026; usa-se 14/08 sexta como exemplo de recesso
  assert.equal(calcularPrazoPadrao("2026-08-12"), "2026-08-19");
  assert.equal(calcularPrazoPadrao("2026-08-12", ["2026-08-14"]), "2026-08-20");
});

test("dias úteis entre datas seguem a mesma convenção do prazo", () => {
  assert.equal(diasUteisEntre("2026-10-16", "2026-10-16"), 0);
  assert.equal(diasUteisEntre("2026-10-16", "2026-10-19"), 1); // sexta -> segunda
  assert.equal(diasUteisEntre("2026-10-16", calcularPrazoPadrao("2026-10-16")), 5);
  assert.equal(diasUteisEntre("2026-10-20", "2026-10-16"), 0);
  assert.equal(adicionarDiasUteis("2026-10-16", 0), "2026-10-16");
});

test("classificação do prazo em aberto", () => {
  assert.equal(classificarPrazo("2026-10-15", "2026-10-16"), "vencido");
  assert.equal(classificarPrazo("2026-10-16", "2026-10-16"), "vence_hoje");
  assert.equal(classificarPrazo("2026-10-18", "2026-10-16"), "vence_em_breve");
  assert.equal(classificarPrazo("2026-10-19", "2026-10-16"), "no_prazo");
});

test("conclusão no último dia do prazo conta como no prazo, independentemente da hora", () => {
  assert.equal(concluidoNoPrazo("2026-10-23", "2026-10-23"), true);
  assert.equal(concluidoNoPrazo("2026-10-24", "2026-10-23"), false);
});
