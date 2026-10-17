import { integracaoHabilitada } from "./ambiente";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import sql from "mssql";
import { IDS } from "../../db/teste/ids";

const opcoes = {
  skip:
    !integracaoHabilitada &&
    "Defina TESTE_APP_SENHA/TESTE_DB_SA_SENHA para rodar contra o banco de testes.",
};

type Repo = typeof import("../../lib/chamados/repositorio");
let repo: Repo;
let pool: typeof import("../../lib/db/pool");
let comTransacao: typeof import("../../lib/db/comUsuario").comTransacao;
let novaRequisicao: typeof import("../../lib/db/comUsuario").novaRequisicao;

type PerfilTeste = { id: string; papel: string; polo_id: string | null; nome_completo: string };
const admin: PerfilTeste = {
  id: IDS.admin,
  papel: "admin",
  polo_id: null,
  nome_completo: "Ana Administradora",
};
const biaPQB: PerfilTeste = {
  id: IDS.atendPQB,
  papel: "atendente",
  polo_id: IDS.poloPQB,
  nome_completo: "Bia Atendente",
};
const dudaCCJ: PerfilTeste = {
  id: IDS.atendCCJ,
  papel: "atendente",
  polo_id: IDS.poloCCJ,
  nome_completo: "Duda Atendente",
};
const coordPQB: PerfilTeste = {
  id: IDS.coordPQB,
  papel: "coordenador",
  polo_id: IDS.poloPQB,
  nome_completo: "Carla Coordenação",
};

before(async () => {
  if (!integracaoHabilitada) return;
  const { prepararBancoTeste } = await import("../../db/teste/preparar");
  await prepararBancoTeste(() => {});
  repo = await import("../../lib/chamados/repositorio");
  pool = await import("../../lib/db/pool");
  ({ comTransacao, novaRequisicao } = await import("../../lib/db/comUsuario"));
});

after(async () => {
  if (integracaoHabilitada) (await pool.getPool()).close();
});

async function carregar(perfil: PerfilTeste, id: string) {
  return comTransacao({ usuario_id: perfil.id, papel: perfil.papel, ip: null }, (req) =>
    repo.carregarChamadoAutorizado(req, perfil, id)
  );
}

function entradaDe(c: NonNullable<Awaited<ReturnType<typeof carregar>>>) {
  return {
    id: c.id,
    versao: c.atualizado_em,
    aluno_nome: c.aluno_nome,
    aluno_ra: c.aluno_ra,
    aluno_cpf: c.aluno_cpf,
    polo_id: c.polo_id,
    contato_telefone: c.contato_telefone,
    motivo_id: c.motivo_id,
    descricao: c.descricao ?? "x",
    situacao: c.situacao,
    prioridade: c.prioridade,
    data_solicitacao: c.data_solicitacao,
    prazo_modo: (c.prazo === c.prazo_calculado ? "automatico" : "manual") as
      "automatico" | "manual",
    prazo: c.prazo,
    observacao: c.observacao,
    resolucao: c.resolucao,
    motivo_encerramento: c.motivo_encerramento,
  };
}

const AGORA = new Date("2026-10-17T00:30:00Z"); // 16/10/2026 21:30 em São Paulo

test(
  "evidência 5858008-202610: leitura devolve as datas civis exatas, sem deslocamento de fuso",
  opcoes,
  async () => {
    const c = await carregar(biaPQB, IDS.ch5858008);
    assert.equal(c?.data_solicitacao, "2026-12-02");
    assert.equal(c?.prazo, "2026-10-23");
  }
);

test(
  "abrir e salvar sem alterar datas não modifica os valores (mesmo inconsistentes)",
  opcoes,
  async () => {
    const c = (await carregar(biaPQB, IDS.ch5858008))!;
    const r = await repo.salvarChamado(
      biaPQB,
      { ...entradaDe(c), observacao: "só observação" },
      [],
      { agora: AGORA, ip: null }
    );
    assert.ok(r.alertas.some((a) => a.includes("inconsistentes")));
    const depois = (await carregar(biaPQB, IDS.ch5858008))!;
    assert.equal(depois.data_solicitacao, "2026-12-02");
    assert.equal(depois.prazo, "2026-10-23");
    assert.equal(depois.observacao, "só observação");
  }
);

test(
  "corrigir a abertura recalcula o prazo; prazo anterior à abertura é recusado",
  opcoes,
  async () => {
    const c = (await carregar(biaPQB, IDS.ch5858008))!;
    await assert.rejects(
      repo.salvarChamado(
        biaPQB,
        {
          ...entradaDe(c),
          data_solicitacao: "2026-10-15",
          prazo_modo: "manual",
          prazo: "2026-10-14",
          prazo_justificativa: "teste de validação",
        },
        [],
        { agora: AGORA, ip: null }
      ),
      (e: Error & { errosCampo?: Record<string, string> }) => !!e.errosCampo?.prazo
    );
    await repo.salvarChamado(
      biaPQB,
      { ...entradaDe(c), data_solicitacao: "2026-10-15", prazo_modo: "automatico" },
      [],
      { agora: AGORA, ip: null }
    );
    const depois = (await carregar(biaPQB, IDS.ch5858008))!;
    assert.equal(depois.data_solicitacao, "2026-10-15");
    assert.equal(depois.prazo, "2026-10-22"); // qui 15 -> sex 16, seg 19, ter 20, qua 21, qui 22
    assert.equal(depois.prazo_calculado, "2026-10-22");
    assert.equal(depois.prazo_ajuste_manual, false);
  }
);

test("virada do dia em UTC: às 21:30 de 16/10 a abertura de 17/10 é futura", opcoes, async () => {
  const base = {
    aluno_nome: "Aluno Fuso",
    motivo_id: IDS.motivo01,
    descricao: "x",
    situacao: "aguardando",
    prioridade: "normal" as const,
    prazo_modo: "automatico" as const,
  };
  await assert.rejects(
    repo.salvarChamado(biaPQB, { ...base, data_solicitacao: "2026-10-17" }, [], {
      agora: AGORA,
      ip: null,
    }),
    (e: Error & { errosCampo?: Record<string, string> }) => !!e.errosCampo?.data_solicitacao
  );
  const r = await repo.salvarChamado(biaPQB, { ...base, data_solicitacao: "2026-10-16" }, [], {
    agora: AGORA,
    ip: null,
  });
  const c = (await carregar(biaPQB, r.chamadoId))!;
  assert.equal(c.data_solicitacao, "2026-10-16");
  assert.equal(c.prazo, "2026-10-23");
  assert.equal(c.polo_id?.toLowerCase(), IDS.poloPQB); // atendente grava sempre no próprio polo
  assert.equal(c.responsavel_id?.toLowerCase(), IDS.atendPQB);
  assert.match(c.protocolo, /^CS20261016-\d{4}$/);
});

test(
  "ajuste manual de prazo exige justificativa e fica registrado separado do calculado",
  opcoes,
  async () => {
    const base = {
      aluno_nome: "Aluno Prazo Manual",
      motivo_id: IDS.motivo01,
      descricao: "x",
      situacao: "aguardando",
      prioridade: "normal" as const,
      data_solicitacao: "2026-10-16",
      prazo_modo: "manual" as const,
      prazo: "2026-10-30",
    };
    await assert.rejects(
      repo.salvarChamado(biaPQB, base, [], { agora: AGORA, ip: null }),
      (e: Error & { errosCampo?: Record<string, string> }) => !!e.errosCampo?.prazo_justificativa
    );
    const r = await repo.salvarChamado(
      biaPQB,
      { ...base, prazo_justificativa: "Aluno pediu prazo maior por viagem" },
      [],
      { agora: AGORA, ip: null }
    );
    const c = (await carregar(biaPQB, r.chamadoId))!;
    assert.equal(c.prazo, "2026-10-30");
    assert.equal(c.prazo_calculado, "2026-10-23");
    assert.equal(c.prazo_ajuste_manual, true);
    assert.equal(c.prazo_ajustado_por_nome, "Bia Atendente");
    const eventos = await comTransacao({ usuario_id: admin.id, papel: "admin", ip: null }, (req) =>
      repo.listarEventos(req, r.chamadoId)
    );
    assert.ok(eventos.some((e) => e.tipo === "ajuste_prazo" && e.texto?.includes("viagem")));
  }
);

test(
  "edição simultânea: a segunda gravação com versão antiga é recusada (sem sobrescrita silenciosa)",
  opcoes,
  async () => {
    const c = (await carregar(biaPQB, IDS.chAlunoTeste))!;
    await repo.salvarChamado(
      biaPQB,
      { ...entradaDe(c), observacao: "primeira", contato_telefone: c.contato_telefone },
      [],
      { agora: AGORA, ip: null }
    );
    await assert.rejects(
      repo.salvarChamado(coordPQB, { ...entradaDe(c), observacao: "segunda" }, [], {
        agora: AGORA,
        ip: null,
      }),
      (e: Error & { codigo?: string }) => e.codigo === "conflito"
    );
    assert.equal((await carregar(biaPQB, IDS.chAlunoTeste))!.observacao, "primeira");
  }
);

test(
  "telefone legado inválido não bloqueia edição se não foi alterado; novo valor é validado",
  opcoes,
  async () => {
    const c = (await carregar(dudaCCJ, IDS.chCCJ))!;
    assert.equal(c.contato_telefone, "00000000000");
    await assert.rejects(
      repo.salvarChamado(dudaCCJ, { ...entradaDe(c), contato_telefone: "11111111111" }, [], {
        agora: AGORA,
        ip: null,
      }),
      (e: Error & { errosCampo?: Record<string, string> }) => !!e.errosCampo?.contato_telefone
    );
    // RA igual ao CPF (legado) também não bloqueia se nenhum dos dois mudou
    await repo.salvarChamado(
      dudaCCJ,
      { ...entradaDe(c), contato_telefone: "(94) 99123-4567" },
      [],
      { agora: AGORA, ip: null }
    );
    assert.equal((await carregar(dudaCCJ, IDS.chCCJ))!.contato_telefone, "94991234567");
  }
);

test(
  "editar chamado resolvido não altera a data de conclusão; reabrir exige justificativa",
  opcoes,
  async () => {
    const c = (await carregar(biaPQB, IDS.chNoLimite))!;
    const conclusaoOriginal = c.data_conclusao;
    await repo.salvarChamado(
      biaPQB,
      { ...entradaDe(c), observacao: "ajuste de texto", resolucao: "Estorno feito" },
      [],
      { agora: AGORA, ip: null }
    );
    const editado = (await carregar(biaPQB, IDS.chNoLimite))!;
    assert.equal(editado.data_conclusao, conclusaoOriginal);

    await assert.rejects(
      repo.salvarChamado(biaPQB, { ...entradaDe(editado), situacao: "em_atendimento" }, [], {
        agora: AGORA,
        ip: null,
      }),
      (e: Error & { errosCampo?: Record<string, string> }) => !!e.errosCampo?.justificativa
    );
    await repo.salvarChamado(
      biaPQB,
      {
        ...entradaDe(editado),
        situacao: "em_atendimento",
        justificativa_situacao: "Aluno informou cobrança em duplicidade de novo",
      },
      [],
      { agora: AGORA, ip: null }
    );
    const reaberto = (await carregar(biaPQB, IDS.chNoLimite))!;
    assert.equal(reaberto.situacao, "em_atendimento");
    assert.equal(reaberto.data_conclusao, null);
    assert.equal(reaberto.reaberturas, 1);
  }
);

test(
  "autorização: acesso direto por ID a chamado de outro polo é negado (leitura e escrita)",
  opcoes,
  async () => {
    assert.equal(await carregar(dudaCCJ, IDS.chAlunoTeste), null);
    assert.ok(await carregar(admin, IDS.chAlunoTeste));
    const c = (await carregar(admin, IDS.chAlunoTeste))!;
    await assert.rejects(
      repo.salvarChamado(dudaCCJ, { ...entradaDe(c), observacao: "invasão" }, [], {
        agora: AGORA,
        ip: null,
      }),
      (e: Error & { codigo?: string }) => e.codigo === "nao_encontrado"
    );
    await assert.rejects(
      repo.excluirChamado(dudaCCJ, IDS.chAlunoTeste),
      (e: Error & { codigo?: string }) => e.codigo === "nao_encontrado"
    );
    await assert.rejects(
      repo.excluirChamado(coordPQB, IDS.chAlunoTeste),
      (e: Error & { codigo?: string }) => e.codigo === "proibido"
    );
  }
);

test(
  "transferência: responsável desativado ou de outro polo é recusado; transferência exige motivo",
  opcoes,
  async () => {
    await assert.rejects(
      repo.atribuirResponsavel(
        coordPQB,
        IDS.chDesativada,
        IDS.desativadaPQB,
        "qualquer motivo aqui"
      )
    );
    await assert.rejects(
      repo.atribuirResponsavel(coordPQB, IDS.chDesativada, IDS.atendCCJ, "qualquer motivo aqui")
    );
    await assert.rejects(repo.atribuirResponsavel(coordPQB, IDS.chDesativada, IDS.atendPQB, null));
    await repo.atribuirResponsavel(
      coordPQB,
      IDS.chDesativada,
      IDS.atendPQB,
      "Eva foi desligada; redistribuição da fila",
      { ip: "200.10.20.30" }
    );
    const c = (await carregar(coordPQB, IDS.chDesativada))!;
    assert.equal(c.responsavel_id?.toLowerCase(), IDS.atendPQB);
    assert.equal(c.criado_por.toLowerCase(), IDS.desativadaPQB); // criador preservado
    const ev = await comTransacao({ usuario_id: admin.id, papel: "admin", ip: null }, (req) =>
      repo.listarEventos(req, IDS.chDesativada)
    );
    assert.equal(ev[0]?.tipo, "transferencia");
    assert.equal(ev[0]?.responsavel_anterior_nome, "Eva Desligada");
  }
);

test(
  "auditoria: IP do proxy confiável, campos alterados e atomicidade com a alteração",
  opcoes,
  async () => {
    await repo.registrarInteracao(
      biaPQB,
      IDS.chAlunoTeste,
      { texto: "Liguei para o aluno" },
      { ip: "200.10.20.30" }
    );
    const ultimo = await comTransacao({ usuario_id: admin.id, papel: "admin", ip: null }, (req) =>
      req
        .input("id", sql.UniqueIdentifier, IDS.chAlunoTeste)
        .query(
          "SELECT TOP 1 ip, campos_alterados, usuario_nome FROM auditoria.logs WHERE tabela = 'chamados' AND registro_id = @id ORDER BY id DESC"
        )
    );
    assert.equal(ultimo.recordset[0].ip, "200.10.20.30");
    assert.equal(ultimo.recordset[0].usuario_nome, "Bia Atendente");
    assert.match(ultimo.recordset[0].campos_alterados, /ultima_interacao_em/);

    const antes = await contarLogs();
    await assert.rejects(
      comTransacao({ usuario_id: biaPQB.id, papel: "atendente", ip: null }, async (_r, tx) => {
        await novaRequisicao(tx)
          .input("id", sql.UniqueIdentifier, IDS.chAlunoTeste)
          .query("UPDATE dados.chamados SET observacao = N'x' WHERE id = @id");
        throw new Error("falha simulada depois do UPDATE");
      })
    );
    assert.equal(await contarLogs(), antes); // alteração e auditoria desfeitas juntas
  }
);

async function contarLogs() {
  const r = await comTransacao({ usuario_id: admin.id, papel: "admin", ip: null }, (req) =>
    req.query("SELECT COUNT(*) AS n FROM auditoria.logs")
  );
  return r.recordset[0].n as number;
}

test("trilha de auditoria é somente-inclusão para a aplicação", opcoes, async () => {
  await assert.rejects(
    comTransacao({ usuario_id: admin.id, papel: "admin", ip: null }, (req) =>
      req.query("DELETE FROM auditoria.logs")
    ),
    /permission was denied|DELETE permission/i
  );
  await assert.rejects(
    comTransacao({ usuario_id: admin.id, papel: "admin", ip: null }, (req) =>
      req.query("UPDATE auditoria.logs SET ip = '1.1.1.1'")
    ),
    /permission was denied|UPDATE permission/i
  );
});

test(
  "anexos: conteúdo validado, gravado com o chamado e protegido por polo e autoria",
  opcoes,
  async () => {
    const pdf = { nome: "comprovante.pdf", tamanho: 9, bytes: Buffer.from("%PDF-1.4\n") };
    const falso = { nome: "virus.pdf", tamanho: 6, bytes: Buffer.from("MZ\x90\x00\x03\x00") };
    await assert.rejects(
      repo.anexarArquivos(biaPQB, IDS.chAlunoTeste, [falso], null),
      /não corresponde/
    );
    await repo.anexarArquivos(biaPQB, IDS.chAlunoTeste, [pdf], "Comprovante");
    const lista = await comTransacao({ usuario_id: admin.id, papel: "admin", ip: null }, (req) =>
      req
        .input("c", sql.UniqueIdentifier, IDS.chAlunoTeste)
        .query(
          "SELECT CAST(a.id AS NVARCHAR(50)) id, a.tipo_mime, a.sha256, DATALENGTH(ac.conteudo) bytes FROM dados.arquivos_chamados a JOIN dados.arquivos_conteudo ac ON ac.arquivo_id = a.id WHERE a.chamado_id = @c"
        )
    );
    const anexo = lista.recordset[0];
    assert.equal(anexo.tipo_mime, "application/pdf");
    assert.equal(Number(anexo.bytes), 9);
    const doOutroPolo = await comTransacao(
      { usuario_id: dudaCCJ.id, papel: "atendente", ip: null },
      (_r, tx) => repo.carregarAnexoAutorizado(() => novaRequisicao(tx), dudaCCJ, anexo.id)
    );
    assert.equal(doOutroPolo, null);
    await assert.rejects(
      repo.excluirAnexo(coordPQB, anexo.id),
      (e: Error & { codigo?: string }) => e.codigo === "proibido"
    );
    await repo.excluirAnexo(biaPQB, anexo.id);
    const excluido = await comTransacao(
      { usuario_id: biaPQB.id, papel: "atendente", ip: null },
      (_r, tx) => repo.carregarAnexoAutorizado(() => novaRequisicao(tx), biaPQB, anexo.id)
    );
    assert.equal(excluido, null);
  }
);
