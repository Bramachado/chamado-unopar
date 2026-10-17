import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarTelefone, formatarTelefone } from "../lib/utils/telefone";
import { validarRa } from "../lib/utils/ra";
import { celulaCsv, montarCsv } from "../lib/utils/csv";
import {
  chaveTexto,
  encontrarSemelhantes,
  paresSemelhantes,
  similaridadeNomes,
} from "../lib/motivos/normalizacao";
import { ipDoCliente } from "../lib/auth/ip";
import {
  registrarFalha,
  registrarSucesso,
  segundosDeBloqueio,
  _limparParaTestes,
  LIMITE,
} from "../lib/auth/limite-tentativas";
import { validarArquivo, podeExibirInline } from "../lib/storage/validacao-arquivo";
import {
  escopoDeChamados,
  podeVerChamado,
  podeExcluirChamado,
  poloPermitidoParaGravacao,
} from "../lib/auth/autorizacao";

test("telefone: normaliza, exige DDD e recusa zeros", () => {
  assert.deepEqual(normalizarTelefone("(94) 99123-4567"), { ok: true, valor: "94991234567" });
  assert.deepEqual(normalizarTelefone("+55 94 3346-1234"), { ok: true, valor: "9433461234" });
  assert.deepEqual(normalizarTelefone(""), { ok: true, valor: null });
  assert.equal(normalizarTelefone("00000000000").ok, false);
  assert.equal(normalizarTelefone("99123-4567").ok, false); // sem DDD
  assert.equal(normalizarTelefone("(20) 99123-4567").ok, false); // DDD inexistente
  assert.equal(formatarTelefone("94991234567"), "(94) 99123-4567");
});

test("RA: opcional, recusa zeros e RA igual ao CPF, alerta quando parece CPF", () => {
  assert.deepEqual(validarRa(""), { ok: true, valor: null });
  assert.deepEqual(validarRa(" 2024abc-1 "), { ok: true, valor: "2024ABC-1" });
  assert.equal(validarRa("0000000").ok, false);
  assert.equal(validarRa("529.982.247-25", "52998224725").ok, false);
  const r = validarRa("52998224725");
  assert.equal(r.ok && !!r.alerta, true);
});

test("CSV: neutraliza fórmulas e escapa aspas", () => {
  assert.equal(celulaCsv('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(celulaCsv("+5511"), `"'+5511"`);
  assert.equal(celulaCsv("-2+3"), `"'-2+3"`);
  assert.equal(celulaCsv("@SUM(A1)"), `"'@SUM(A1)"`);
  assert.equal(celulaCsv("Normal"), `"Normal"`);
  assert.equal(celulaCsv(null), `""`);
  assert.ok(montarCsv(["A"], [["1"]]).startsWith("﻿"));
});

test("motivos: chave normalizada e evidência #47 x #51", () => {
  assert.equal(chaveTexto("  Problema   com o Conteúdo "), "problema com o conteudo");
  assert.equal(chaveTexto("PROVA DE 2° CHAMADA"), "prova de 2o chamada");
  assert.equal(chaveTexto("Inclusão/Exclusão"), "inclusao exclusao");
  assert.equal(similaridadeNomes("Problema com conteúdo", "Problema com o conteúdo"), 1);

  const caminho =
    "GRAD/ EJA/ TEC > Acadêmico > Não consegue estudar no AVA > Problema com o conteúdo";
  const catalogo = [
    { id: "47", codigo: "#47", nome: "Problema com conteúdo", filtro: caminho, ativo: true },
    { id: "51", codigo: "#51", nome: "Problema com o conteúdo", filtro: caminho, ativo: true },
    { id: "03", codigo: "#03", nome: "PAGAMENTO EM DUPLICIDADE", filtro: "Boletos", ativo: true },
  ];
  const s = encontrarSemelhantes({ nome: "problema com o conteudo", filtro: caminho }, catalogo);
  assert.equal(s[0]!.tipo, "duplicado_exato");
  assert.equal(s[0]!.motivo.id, "51");
  assert.equal(s[1]!.tipo, "mesmo_caminho");
  const pares = paresSemelhantes(catalogo);
  assert.equal(pares.length, 1);
  assert.equal(pares[0]!.tipo, "mesmo_caminho");
});

test("motivos: nomes parecidos com caminhos distintos são só 'semelhantes', não duplicados", () => {
  const s = encontrarSemelhantes({ nome: "Erro ao realizar prova", filtro: "Caminho A" }, [
    { id: "24", codigo: "#24", nome: "Erro ao realizar a prova", filtro: "Caminho B", ativo: true },
  ]);
  assert.equal(s[0]!.tipo, "nome_semelhante");
});

test("IP: sem proxy confiável o cabeçalho é ignorado; com 1 proxy usa o último valor", () => {
  const h = (v: string | null) => ({ get: () => v });
  assert.equal(ipDoCliente(h("1.2.3.4"), 0), null);
  assert.equal(ipDoCliente(h("6.6.6.6, 200.10.20.30"), 1), "200.10.20.30"); // 6.6.6.6 forjado pelo cliente
  assert.equal(ipDoCliente(h("200.10.20.30:51234"), 1), "200.10.20.30");
  assert.equal(ipDoCliente(h("<script>"), 1), null);
  assert.equal(ipDoCliente(h(null), 1), null);
});

test("limite de tentativas de login bloqueia após 5 falhas e libera com sucesso", () => {
  _limparParaTestes();
  const chaves = ["email:a@b.com", "ip:1.1.1.1"];
  for (let i = 0; i < LIMITE.falhas - 1; i++) registrarFalha(chaves, 1000);
  assert.equal(segundosDeBloqueio(chaves, 1000), 0);
  registrarFalha(chaves, 1000);
  assert.ok(segundosDeBloqueio(chaves, 2000) > 0);
  assert.equal(segundosDeBloqueio(chaves, 1000 + LIMITE.bloqueioMs + 1), 0);
  registrarSucesso(chaves);
  assert.equal(segundosDeBloqueio(chaves, 2000), 0);
});

test("anexos: valida extensão, conteúdo e tamanho", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7 ...");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const html = new TextEncoder().encode("<html><script>alert(1)</script>");
  assert.deepEqual(validarArquivo("declaração.pdf", 100, pdf), {
    ok: true,
    tipo: "pdf",
    mime: "application/pdf",
    extensao: ".pdf",
    nomeSeguro: "declaração.pdf",
  });
  assert.equal(validarArquivo("foto.png", 100, png).ok, true);
  assert.equal(validarArquivo("falso.pdf", 100, html).ok, false); // conteúdo não confere
  assert.equal(validarArquivo("pagina.html", 100, html).ok, false); // extensão não permitida
  assert.equal(validarArquivo("grande.pdf", 11 * 1024 * 1024, pdf).ok, false);
  const r = validarArquivo("..\\..\\etc/passwd.pdf", 100, pdf);
  assert.equal(r.ok && r.nomeSeguro, "passwd.pdf");
  assert.equal(podeExibirInline("application/pdf"), true);
  assert.equal(podeExibirInline("text/html"), false);
});

test("autorização por papel e polo", () => {
  const admin = { id: "a", papel: "admin", polo_id: null };
  const atendPQB = { id: "u1", papel: "atendente", polo_id: "PQB" };
  const coordSemPolo = { id: "c1", papel: "coordenador", polo_id: null };
  const chamadoCCJ = { polo_id: "CCJ", criado_por: "u9", responsavel_id: null };
  const chamadoPQB = { polo_id: "pqb", criado_por: "u9", responsavel_id: "u1" };

  assert.deepEqual(escopoDeChamados(admin), { tipo: "todos" });
  assert.equal(podeVerChamado(admin, chamadoCCJ), true);
  assert.equal(podeVerChamado(atendPQB, chamadoCCJ), false); // acesso direto por ID a outro polo
  assert.equal(podeVerChamado(atendPQB, chamadoPQB), true);
  assert.equal(podeVerChamado(coordSemPolo, chamadoPQB), false);
  assert.equal(podeExcluirChamado(atendPQB, chamadoPQB), false); // não foi quem criou
  assert.equal(poloPermitidoParaGravacao(atendPQB, "CCJ"), "PQB");
  assert.equal(poloPermitidoParaGravacao(admin, "CCJ"), "CCJ");
});

test("cofre: sem CRED_ENCRYPTION_KEY não há chave padrão embutida no código", async () => {
  const { obterChaveCriptografia, cifrarSenha, decifrarSenha } =
    await import("../lib/crypto/cofre");
  const anterior = process.env.CRED_ENCRYPTION_KEY;
  delete process.env.CRED_ENCRYPTION_KEY;
  try {
    assert.throws(() => obterChaveCriptografia(), /não configurada/);
  } finally {
    if (anterior !== undefined) process.env.CRED_ENCRYPTION_KEY = anterior;
  }
  const chave = Buffer.alloc(32, 3).toString("base64");
  const c = cifrarSenha("senha-do-pad", chave);
  assert.equal(decifrarSenha(c.senhaCifrada, c.iv, c.authTag, chave), "senha-do-pad");
});
