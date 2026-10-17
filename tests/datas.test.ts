import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adicionarMeses,
  dataCivilDeInstante,
  dataCivilDoBanco,
  ehDataCivilValida,
  fimDoDiaExclusivoEmUtc,
  fimDoMes,
  formatarDataCivil,
  formatarInstante,
  hojeCivil,
  inicioDoDiaEmUtc,
  paraParametroDate,
} from "../lib/datas";

const SP = "America/Sao_Paulo";

test("virada do dia em UTC não antecipa a data local (16/10 21:30 em SP = 17/10 00:30 UTC)", () => {
  const instante = new Date("2026-10-17T00:30:00Z");
  assert.equal(hojeCivil(SP, instante), "2026-10-16");
  // o padrão antigo do formulário (toISOString) dava o dia seguinte:
  assert.equal(instante.toISOString().slice(0, 10), "2026-10-17");
});

test("às 23:59 locais ainda é o mesmo dia; às 00:00 locais já é o próximo", () => {
  assert.equal(hojeCivil(SP, new Date("2026-10-17T02:59:59Z")), "2026-10-16");
  assert.equal(hojeCivil(SP, new Date("2026-10-17T03:00:00Z")), "2026-10-17");
});

test("DATE lido do banco (meia-noite UTC) mantém o dia civil", () => {
  const doDriver = new Date(Date.UTC(2026, 11, 2)); // como o mssql entrega DATE '2026-12-02'
  assert.equal(dataCivilDoBanco(doDriver), "2026-12-02");
  assert.equal(dataCivilDoBanco("2026-10-23"), "2026-10-23");
  assert.equal(dataCivilDoBanco(null), null);
});

test("exibição de data civil não aplica fuso (02/12 continua 02/12)", () => {
  assert.equal(formatarDataCivil("2026-12-02"), "02/12/2026");
  assert.equal(formatarDataCivil("2026-10-23", "curto"), "23/10");
  assert.equal(formatarDataCivil(null), "—");
});

test("ida e volta: parâmetro DATE e leitura preservam o valor (salvar sem alterar não muda)", () => {
  for (const d of ["2026-01-01", "2026-02-28", "2026-12-31", "2028-02-29"]) {
    assert.equal(dataCivilDoBanco(paraParametroDate(d)), d);
  }
});

test("validação de data civil rejeita dias inexistentes", () => {
  assert.equal(ehDataCivilValida("2026-02-28"), true);
  assert.equal(ehDataCivilValida("2026-02-30"), false);
  assert.equal(ehDataCivilValida("2028-02-29"), true);
  assert.equal(ehDataCivilValida("02/12/2026"), false);
});

test("instantes são exibidos no fuso institucional", () => {
  assert.equal(formatarInstante("2026-10-17T00:30:00Z", { fuso: SP }), "16/10/2026 21:30");
  assert.equal(dataCivilDeInstante("2026-10-17T00:30:00Z", SP), "2026-10-16");
  assert.equal(formatarInstante(null), "—");
});

test("limites UTC de um dia civil em SP (-03:00)", () => {
  assert.equal(inicioDoDiaEmUtc("2026-10-16", SP).toISOString(), "2026-10-16T03:00:00.000Z");
  assert.equal(fimDoDiaExclusivoEmUtc("2026-10-16", SP).toISOString(), "2026-10-17T03:00:00.000Z");
});

test("operações de mês: fim do mês e soma de meses com dia inexistente", () => {
  assert.equal(fimDoMes("2026-02-10"), "2026-02-28");
  assert.equal(fimDoMes("2028-02-10"), "2028-02-29");
  assert.equal(adicionarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(adicionarMeses("2026-11-15", 2), "2027-01-15");
});
