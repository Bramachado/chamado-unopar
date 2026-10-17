import { test } from "node:test";
import assert from "node:assert/strict";
import { dataConclusaoAposTransicao, validarTransicao } from "../lib/chamados/situacoes";

test("transições permitidas e proibidas", () => {
  assert.equal(validarTransicao("aguardando", "em_atendimento", {}).ok, true);
  assert.equal(validarTransicao("rascunho", "concluido", { resolucao: "feito" }).ok, false);
  assert.equal(
    validarTransicao("concluido", "aguardando_aluno", { justificativa: "x".repeat(20) }).ok,
    false
  );
});

test("resolver exige resolução; encerrar exige motivo", () => {
  const r1 = validarTransicao("em_atendimento", "concluido", {});
  assert.equal(r1.ok, false);
  assert.equal(!r1.ok && r1.campo, "resolucao");
  assert.equal(
    validarTransicao("em_atendimento", "concluido", { resolucao: "Boleto reemitido" }).ok,
    true
  );

  const r2 = validarTransicao("aguardando", "encerrado", {});
  assert.equal(!r2.ok && r2.campo, "motivo_encerramento");
  assert.equal(
    validarTransicao("aguardando", "encerrado", { motivo_encerramento: "duplicado" }).ok,
    true
  );
  assert.equal(
    validarTransicao("aguardando", "encerrado", { motivo_encerramento: "outro" }).ok,
    false
  );
});

test("reabertura exige justificativa e é identificada", () => {
  assert.equal(validarTransicao("concluido", "em_atendimento", {}).ok, false);
  const r = validarTransicao("encerrado", "em_atendimento", {
    justificativa: "Aluno enviou novo documento",
  });
  assert.deepEqual(r, { ok: true, ehReabertura: true });
});

test("data de conclusão: definida ao finalizar, preservada em edições e limpa ao reabrir", () => {
  const agora = "2026-10-16T15:00:00.000Z";
  const antiga = "2026-10-10T12:00:00.000Z";
  assert.equal(dataConclusaoAposTransicao("em_atendimento", "concluido", null, agora), agora);
  // editar um chamado já resolvido NÃO sobrescreve a data (bug do formulário antigo)
  assert.equal(dataConclusaoAposTransicao("concluido", "concluido", antiga, agora), antiga);
  assert.equal(dataConclusaoAposTransicao("concluido", "em_atendimento", antiga, agora), null);
});
