import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularRanking,
  pontosAgilidade,
  type ChamadoPontuavel,
} from "../lib/indicadores/pontuacao";

const pessoas = [
  { id: "ana", nome_completo: "Ana", papel: "atendente" },
  { id: "bia", nome_completo: "Bia", papel: "atendente" },
  { id: "caio", nome_completo: "Caio", papel: "coordenador" },
  { id: "adm", nome_completo: "Admin", papel: "admin" },
];

let seq = 0;
function ch(
  resp: string,
  situacao: string,
  abertura: string,
  prazo: string,
  conclusao: string | null
): ChamadoPontuavel {
  return {
    id: `c${++seq}`,
    responsavel_id: resp,
    situacao,
    data_solicitacao: abertura,
    prazo,
    dia_conclusao: conclusao,
  };
}

test("causa dos 108 pontos: o volume da fórmula antiga não tinha teto", () => {
  // Cálculo removido de app/(sistema)/desempenho/page.tsx: round((resolvidos*2 + encerrados*0,5) * 4)
  const volumeAntigo = (resolvidos: number, encerrados: number) =>
    Math.round((resolvidos * 2 + encerrados * 0.5) * 4);
  // 7 resolvidos, todos no prazo (40) e tempo médio entre 2 e 4 dias corridos (12): 56 + 40 + 12 = 108
  assert.equal(volumeAntigo(7, 0) + 40 + 12, 108);
  // a partir de 6 resolvidos o "volume" sozinho já passava dos 40 pontos anunciados
  assert.ok(volumeAntigo(6, 0) > 40);
});

test("nova fórmula: máximo de 100 pontos para quem lidera em volume, cumpre todos os prazos e resolve em até 1 dia útil", () => {
  const chamados = Array.from({ length: 12 }, () =>
    ch("ana", "concluido", "2026-10-05", "2026-10-12", "2026-10-06")
  );
  const { linhas } = calcularRanking(pessoas, chamados);
  const ana = linhas.find((l) => l.usuario_id === "ana")!;
  assert.deepEqual(ana.pontos, { volume: 40, prazo: 40, agilidade: 20 });
  assert.equal(ana.pontos_total, 100);
});

test("resultado conhecido com dois participantes, componentes somam a nota exibida", () => {
  const chamados = [
    // Ana: 4 resolvidos (3 no prazo), 1 encerrado, 1 pendente
    ch("ana", "concluido", "2026-10-05", "2026-10-12", "2026-10-07"), // seg -> qua: 2 dias úteis
    ch("ana", "concluido", "2026-10-05", "2026-10-12", "2026-10-09"), // seg -> sex: 4 dias úteis
    ch("ana", "concluido", "2026-10-05", "2026-10-12", "2026-10-12"), // 12/10 é feriado: 4 dias úteis
    ch("ana", "concluido", "2026-10-05", "2026-10-12", "2026-10-14"), // 6 dias úteis, fora do prazo
    ch("ana", "encerrado", "2026-10-05", "2026-10-12", "2026-10-06"),
    ch("ana", "em_atendimento", "2026-10-05", "2026-10-12", null),
    // Bia: 1 resolvido no prazo em 1 dia útil
    ch("bia", "concluido", "2026-10-08", "2026-10-16", "2026-10-09"),
  ];
  const { linhas, equipe } = calcularRanking(pessoas, chamados);
  const ana = linhas.find((l) => l.usuario_id === "ana")!;
  const bia = linhas.find((l) => l.usuario_id === "bia")!;

  // Dias úteis de Ana: 2 + 4 + 4 + 6 = 16 -> média 4,0
  assert.equal(ana.resolvidos, 4);
  assert.equal(ana.encerrados, 1);
  assert.equal(ana.pendentes, 1);
  assert.equal(ana.no_prazo, 3);
  assert.equal(ana.dias_uteis_resolucao_total, 16);
  assert.equal(ana.tempo_medio_dias_uteis, 4);
  assert.equal(ana.volume_ponderado, 4.5);
  // Volume: Ana tem o maior volume ponderado (4,5) -> 40. Prazo: 3/4 -> 30. Agilidade: 4 > 3 -> 5.
  assert.deepEqual(ana.pontos, { volume: 40, prazo: 30, agilidade: 5 });
  assert.equal(ana.pontos_total, 75);

  // Bia: volume 1 / 4,5 * 40 = 8,9; prazo 40; agilidade 1 dia útil -> 20
  assert.deepEqual(bia.pontos, { volume: 8.9, prazo: 40, agilidade: 20 });
  assert.equal(bia.pontos_total, 68.9);

  for (const l of linhas.filter((x) => x.elegivel)) {
    assert.equal(
      l.pontos_total,
      Math.round((l.pontos.volume + l.pontos.prazo + l.pontos.agilidade) * 10) / 10
    );
    assert.ok(l.pontos_total! >= 0 && l.pontos_total! <= 100);
  }

  // Equipe ponderada por chamado: 4 no prazo de 5 resolvidos = 80%; dias 16 + 1 = 17 / 5 = 3,4
  assert.equal(equipe.taxa_prazo, 80);
  assert.equal(equipe.tempo_medio_dias_uteis, 3.4);
  assert.equal(equipe.media_pontos, 72); // (75 + 68,9) / 2 = 71,95 -> 72,0
  assert.equal(ana.posicao, 1);
  assert.equal(bia.posicao, 2);
});

test("elegibilidade: sem chamados não pontua nem entra na média; admin não participa", () => {
  const { linhas, equipe } = calcularRanking(pessoas, [
    ch("ana", "concluido", "2026-10-05", "2026-10-12", "2026-10-06"),
  ]);
  const caio = linhas.find((l) => l.usuario_id === "caio")!;
  assert.equal(caio.elegivel, false);
  assert.equal(caio.pontos_total, null);
  assert.equal(caio.posicao, null);
  assert.equal(
    linhas.some((l) => l.usuario_id === "adm"),
    false
  );
  assert.equal(equipe.participantes_elegiveis, 1);
});

test("chamado repetido na entrada (reaberto e resolvido de novo, JOIN duplicado) conta uma vez", () => {
  const c = ch("ana", "concluido", "2026-10-05", "2026-10-12", "2026-10-07");
  const { linhas } = calcularRanking(pessoas, [c, { ...c }]);
  assert.equal(linhas.find((l) => l.usuario_id === "ana")!.resolvidos, 1);
});

test("transferência: o chamado conta para o responsável atual", () => {
  const { linhas } = calcularRanking(pessoas, [
    ch("bia", "concluido", "2026-10-05", "2026-10-12", "2026-10-06"),
  ]);
  assert.equal(linhas.find((l) => l.usuario_id === "bia")!.resolvidos, 1);
  assert.equal(linhas.find((l) => l.usuario_id === "ana")!.volume_total, 0);
});

test("faixas de agilidade", () => {
  assert.equal(pontosAgilidade(null), 0);
  assert.equal(pontosAgilidade(0), 20);
  assert.equal(pontosAgilidade(1), 20);
  assert.equal(pontosAgilidade(1.1), 15);
  assert.equal(pontosAgilidade(3), 10);
  assert.equal(pontosAgilidade(3.1), 5);
});

test("empate recebe a mesma posição", () => {
  const { linhas } = calcularRanking(pessoas, [
    ch("ana", "concluido", "2026-10-05", "2026-10-12", "2026-10-06"),
    ch("bia", "concluido", "2026-10-05", "2026-10-12", "2026-10-06"),
  ]);
  assert.deepEqual(
    linhas.filter((l) => l.elegivel).map((l) => l.posicao),
    [1, 1]
  );
});
