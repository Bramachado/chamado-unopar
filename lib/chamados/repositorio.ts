/**
 * Serviço de chamados: leitura autorizada e gravação com as regras de negócio.
 * Independe do Next.js (recebe o perfil já autenticado) para poder ser testado contra o banco
 * de testes. As Server Actions são apenas adaptadores.
 */
import { z } from "zod";
import { sql } from "@/lib/db/pool";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import {
  dataCivilDoBanco,
  ehDataCivilValida,
  hojeCivil,
  instanteDoBanco,
  paraParametroDate,
  type DataCivil,
} from "@/lib/datas";
import { calcularPrazoPadrao } from "@/lib/sla";
import { carregarFeriadosExtras } from "@/lib/feriados";
import {
  dataConclusaoAposTransicao,
  ehFinal,
  ehSituacao,
  ROTULO_SITUACAO,
  validarTransicao,
  type Situacao,
} from "@/lib/chamados/situacoes";
import {
  podeEditarChamado,
  podeMarcarTeste,
  podeSerResponsavel,
  podeVerChamado,
  poloPermitidoParaGravacao,
  type PerfilAutorizacao,
} from "@/lib/auth/autorizacao";
import { limparCpf, validarCpf } from "@/lib/utils/cpf";
import { normalizarTelefone } from "@/lib/utils/telefone";
import { validarRa } from "@/lib/utils/ra";
import { salvarAnexosNaTransacao, type ArquivoRecebido } from "@/lib/storage/anexos";
import type { Chamado } from "@/types/database";

export interface PerfilServico extends PerfilAutorizacao {
  nome_completo: string;
}

export class ErroNegocio extends Error {
  constructor(
    message: string,
    public readonly errosCampo: Record<string, string> = {},
    public readonly codigo: "validacao" | "conflito" | "nao_encontrado" | "proibido" = "validacao"
  ) {
    super(message);
  }
}

/** Colunas do chamado com datas civis convertidas no SQL (sem passar por fuso). */
export const COLUNAS_CHAMADO = `
  CAST(c.id AS NVARCHAR(50)) AS id, c.protocolo, c.aluno_nome, c.aluno_ra, c.aluno_cpf,
  CAST(c.polo_id AS NVARCHAR(50)) AS polo_id, pol.nome AS polo_nome, pol.cidade AS polo_cidade, pol.codigo AS polo_codigo,
  c.contato_telefone, CAST(c.motivo_id AS NVARCHAR(50)) AS motivo_id, m.codigo AS motivo_codigo, m.nome AS motivo_nome,
  c.descricao, c.situacao, c.prioridade,
  CONVERT(CHAR(10), c.data_solicitacao, 23) AS data_solicitacao,
  CONVERT(CHAR(10), c.prazo, 23) AS prazo,
  CONVERT(CHAR(10), c.prazo_calculado, 23) AS prazo_calculado,
  c.prazo_ajuste_manual, c.prazo_ajuste_justificativa, c.prazo_ajustado_em, pAjuste.nome_completo AS prazo_ajustado_por_nome,
  c.data_conclusao, CAST(c.chamado_vinculado_id AS NVARCHAR(50)) AS chamado_vinculado_id, c.observacao,
  c.importado, c.eh_teste,
  CAST(c.criado_por AS NVARCHAR(50)) AS criado_por, COALESCE(c.criado_por_nome, pCriador.nome_completo) AS criado_por_nome,
  CAST(c.atualizado_por AS NVARCHAR(50)) AS atualizado_por, COALESCE(c.atualizado_por_nome, pAtual.nome_completo) AS atualizado_por_nome,
  CAST(COALESCE(c.responsavel_id, c.criado_por) AS NVARCHAR(50)) AS responsavel_id,
  pResp.nome_completo AS responsavel_nome, pResp.ativo AS responsavel_ativo,
  c.resolucao, c.motivo_encerramento, c.ultima_interacao_em, c.proxima_acao,
  CONVERT(CHAR(10), c.proxima_acao_em, 23) AS proxima_acao_em, c.status_externo, c.reaberturas,
  c.criado_em, c.atualizado_em`;

export const JUNCOES_CHAMADO = `
  LEFT JOIN dados.polos pol ON pol.id = c.polo_id
  LEFT JOIN dados.motivos m ON m.id = c.motivo_id
  LEFT JOIN dados.perfis pCriador ON pCriador.id = c.criado_por
  LEFT JOIN dados.perfis pAtual ON pAtual.id = c.atualizado_por
  LEFT JOIN dados.perfis pResp ON pResp.id = COALESCE(c.responsavel_id, c.criado_por)
  LEFT JOIN dados.perfis pAjuste ON pAjuste.id = c.prazo_ajustado_por`;

type LinhaBanco = Record<string, unknown>;

/** Normaliza a linha do banco: datas civis como AAAA-MM-DD, instantes como ISO UTC. */
export function mapearChamado(r: LinhaBanco): Chamado & {
  motivo_codigo?: string | null;
  motivo_nome?: string | null;
} {
  const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return {
    id: String(r.id),
    protocolo: String(r.protocolo),
    aluno_nome: String(r.aluno_nome),
    aluno_ra: s(r.aluno_ra),
    aluno_cpf: s(r.aluno_cpf),
    contato_telefone: s(r.contato_telefone),
    polo_id: s(r.polo_id),
    polo_nome: s(r.polo_nome),
    polo_cidade: s(r.polo_cidade),
    polo_codigo: s(r.polo_codigo),
    motivo_id: String(r.motivo_id),
    motivo_codigo: s(r.motivo_codigo),
    motivo_nome: s(r.motivo_nome),
    descricao: s(r.descricao),
    situacao: String(r.situacao) as Situacao,
    prioridade: (String(r.prioridade) as "normal" | "priorizar") ?? "normal",
    data_solicitacao: dataCivilDoBanco(r.data_solicitacao) ?? "",
    prazo: dataCivilDoBanco(r.prazo) ?? "",
    prazo_calculado: dataCivilDoBanco(r.prazo_calculado),
    prazo_ajuste_manual: Boolean(r.prazo_ajuste_manual),
    prazo_ajuste_justificativa: s(r.prazo_ajuste_justificativa),
    prazo_ajustado_por_nome: s(r.prazo_ajustado_por_nome),
    prazo_ajustado_em: instanteDoBanco(r.prazo_ajustado_em),
    data_conclusao: instanteDoBanco(r.data_conclusao),
    chamado_vinculado_id: s(r.chamado_vinculado_id),
    observacao: s(r.observacao),
    importado: Boolean(r.importado),
    eh_teste: Boolean(r.eh_teste),
    criado_por: String(r.criado_por),
    criado_por_nome: s(r.criado_por_nome),
    atualizado_por: s(r.atualizado_por),
    atualizado_por_nome: s(r.atualizado_por_nome),
    responsavel_id: s(r.responsavel_id),
    responsavel_nome: s(r.responsavel_nome),
    responsavel_ativo:
      r.responsavel_ativo === null || r.responsavel_ativo === undefined
        ? null
        : Boolean(r.responsavel_ativo),
    resolucao: s(r.resolucao),
    motivo_encerramento: s(r.motivo_encerramento),
    ultima_interacao_em: instanteDoBanco(r.ultima_interacao_em),
    proxima_acao: s(r.proxima_acao),
    proxima_acao_em: dataCivilDoBanco(r.proxima_acao_em),
    status_externo: s(r.status_externo),
    reaberturas: Number(r.reaberturas ?? 0),
    criado_em: instanteDoBanco(r.criado_em) ?? "",
    atualizado_em: instanteDoBanco(r.atualizado_em) ?? "",
  };
}

/** Carrega o chamado se existir E o perfil puder vê-lo; caso contrário, null (não revela existência). */
export async function carregarChamadoAutorizado(
  req: sql.Request,
  perfil: PerfilAutorizacao,
  id: string,
  opcoes: { bloquear?: boolean } = {}
) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const q = await req.input("id_chamado", sql.UniqueIdentifier, id).query(`
    SELECT ${COLUNAS_CHAMADO}
    FROM dados.chamados c ${opcoes.bloquear ? "WITH (UPDLOCK, ROWLOCK)" : ""}
    ${JUNCOES_CHAMADO}
    WHERE c.id = @id_chamado AND c.excluido_em IS NULL`);
  const linha = q.recordset[0];
  if (!linha) return null;
  const chamado = mapearChamado(linha);
  return podeVerChamado(perfil, chamado) ? chamado : null;
}

async function registrarEvento(
  tx: sql.Transaction,
  perfil: PerfilServico,
  chamadoId: string,
  evento: {
    tipo: string;
    situacao_anterior?: string | null;
    situacao_nova?: string | null;
    responsavel_anterior?: string | null;
    responsavel_novo?: string | null;
    texto?: string | null;
    dados?: Record<string, unknown> | null;
  }
) {
  await novaRequisicao(tx)
    .input("chamado_id", sql.UniqueIdentifier, chamadoId)
    .input("tipo", sql.VarChar(30), evento.tipo)
    .input("sa", sql.VarChar(20), evento.situacao_anterior ?? null)
    .input("sn", sql.VarChar(20), evento.situacao_nova ?? null)
    .input("ra", sql.UniqueIdentifier, evento.responsavel_anterior ?? null)
    .input("rn", sql.UniqueIdentifier, evento.responsavel_novo ?? null)
    .input("texto", sql.NVarChar(sql.MAX), evento.texto ?? null)
    .input("dados", sql.NVarChar(sql.MAX), evento.dados ? JSON.stringify(evento.dados) : null)
    .input("por", sql.UniqueIdentifier, perfil.id)
    .input("por_nome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200)).query(`
      INSERT INTO dados.chamado_eventos
        (chamado_id, tipo, situacao_anterior, situacao_nova, responsavel_anterior, responsavel_novo,
         texto, dados_json, criado_por, criado_por_nome, ip)
      VALUES (@chamado_id, @tipo, @sa, @sn, @ra, @rn, @texto, @dados, @por, @por_nome,
              CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45)))`);
}

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const entradaChamadoSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  versao: z.string().optional().nullable(),
  protocolo: z
    .string()
    .trim()
    .toUpperCase()
    .max(20, "O protocolo deve ter no máximo 20 caracteres.")
    .regex(
      /^[A-Z0-9-]{5,20}$/,
      "Protocolo inválido. Informe o código do PAD (ex: C345235256) ou deixe em branco."
    )
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  aluno_nome: z.string().trim().min(3, "Informe o nome completo do aluno.").max(200),
  aluno_ra: textoOpcional(50),
  confirmar_ra: z.boolean().optional(),
  aluno_cpf: textoOpcional(14),
  polo_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  contato_telefone: textoOpcional(30),
  motivo_id: z.string().uuid("Selecione um motivo válido do catálogo."),
  descricao: z.string().trim().min(1, "A descrição do chamado é obrigatória."),
  situacao: z.string().refine(ehSituacao, "Situação inválida."),
  prioridade: z.enum(["normal", "priorizar"]),
  data_solicitacao: z.string().refine(ehDataCivilValida, "Data de abertura inválida."),
  prazo_modo: z.enum(["automatico", "manual"]),
  prazo: z.string().optional().nullable(),
  prazo_justificativa: textoOpcional(500),
  chamado_vinculado_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  observacao: textoOpcional(8000),
  resolucao: textoOpcional(8000),
  motivo_encerramento: textoOpcional(40),
  justificativa_situacao: textoOpcional(1000),
  proxima_acao: textoOpcional(500),
  proxima_acao_em: z
    .string()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  status_externo: textoOpcional(120),
});

export type EntradaChamado = z.input<typeof entradaChamadoSchema>;

export interface ResultadoSalvar {
  chamadoId: string;
  alertas: string[];
}

/** Cria ou atualiza um chamado aplicando todas as regras, numa única transação. */
export async function salvarChamado(
  perfil: PerfilServico,
  entradaBruta: EntradaChamado,
  arquivos: ArquivoRecebido[] = [],
  opcoes: { agora?: Date; ip?: string | null } = {}
): Promise<ResultadoSalvar> {
  const parse = entradaChamadoSchema.safeParse(entradaBruta);
  if (!parse.success) {
    const errosCampo: Record<string, string> = {};
    for (const i of parse.error.issues) if (i.path[0]) errosCampo[String(i.path[0])] ??= i.message;
    throw new ErroNegocio("Corrija os campos destacados.", errosCampo);
  }
  const e = parse.data;
  const agora = opcoes.agora ?? new Date();
  const hoje = hojeCivil(undefined, agora);
  const alertas: string[] = [];

  return comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel, ip: opcoes.ip },
    async (_req, tx) => {
      const atual = e.id
        ? await carregarChamadoAutorizado(novaRequisicao(tx), perfil, e.id, { bloquear: true })
        : null;
      if (e.id && (!atual || !podeEditarChamado(perfil, atual))) {
        throw new ErroNegocio(
          "Chamado não encontrado ou sem permissão de acesso.",
          {},
          "nao_encontrado"
        );
      }
      const versaoInformada = e.versao ? new Date(e.versao) : null;
      if (versaoInformada && Number.isNaN(versaoInformada.getTime())) {
        throw new ErroNegocio("Versão do chamado inválida. Recarregue a página.", {}, "conflito");
      }
      if (atual && versaoInformada && atual.atualizado_em !== versaoInformada.toISOString()) {
        throw new ErroNegocio(
          `Este chamado foi alterado por ${atual.atualizado_por_nome ?? "outra pessoa"} depois que você o abriu. ` +
            "Recarregue a página para ver a versão atual antes de salvar.",
          {},
          "conflito"
        );
      }
      if (atual && !e.versao) {
        throw new ErroNegocio(
          "Versão do chamado ausente. Recarregue a página e tente novamente.",
          {},
          "conflito"
        );
      }

      const errosCampo: Record<string, string> = {};

      // --- Identificação: CPF, telefone e RA (valida o que foi informado ou alterado) ---
      const cpfLimpo = e.aluno_cpf ? limparCpf(e.aluno_cpf) : null;
      const cpfMudou = !atual || (cpfLimpo ?? null) !== (atual.aluno_cpf ?? null);
      if (cpfLimpo && cpfMudou && !validarCpf(cpfLimpo)) {
        errosCampo.aluno_cpf = "CPF inválido. Verifique os dígitos ou deixe o campo em branco.";
      }
      let telefone: string | null = atual?.contato_telefone ?? null;
      if (!atual || (e.contato_telefone ?? null) !== (atual.contato_telefone ?? null)) {
        const t = normalizarTelefone(e.contato_telefone);
        if (t.ok) telefone = t.valor;
        else errosCampo.contato_telefone = t.erro;
      }
      let ra: string | null = atual?.aluno_ra ?? null;
      if (!atual || (e.aluno_ra ?? null) !== (atual.aluno_ra ?? null) || cpfMudou) {
        const r = validarRa(e.aluno_ra, cpfLimpo);
        if (!r.ok) errosCampo.aluno_ra = r.erro;
        else {
          ra = r.valor;
          if (r.alerta && !e.confirmar_ra)
            errosCampo.aluno_ra = `${r.alerta} Marque a confirmação para salvar.`;
        }
      }

      // --- Polo ---
      const poloId = atual
        ? perfil.papel === "admin"
          ? (e.polo_id ?? atual.polo_id ?? null)
          : (atual.polo_id ?? null)
        : poloPermitidoParaGravacao(perfil, e.polo_id ?? null);
      if (!poloId) errosCampo.polo_id = "Selecione o polo do chamado.";

      // --- Datas e prazo ---
      const abertura = e.data_solicitacao;
      const aberturaMudou = !atual || abertura !== atual.data_solicitacao;
      if (aberturaMudou && abertura > hoje) {
        errosCampo.data_solicitacao =
          "A data de abertura não pode ser futura: use a data em que a solicitação foi registrada.";
      }
      const feriados = await carregarFeriadosExtras(novaRequisicao(tx), poloId);
      const prazoCalculado = calcularPrazoPadrao(abertura, feriados);
      let prazo: DataCivil = prazoCalculado;
      let ajusteManual = false;
      let justificativaPrazo: string | null = null;
      let ajusteNovo = false;
      if (e.prazo_modo === "manual") {
        if (!e.prazo || !ehDataCivilValida(e.prazo)) {
          errosCampo.prazo = "Informe um prazo válido ou volte ao cálculo automático.";
        } else {
          prazo = e.prazo;
          const prazoMudou = !atual || prazo !== atual.prazo || aberturaMudou;
          if (prazo !== prazoCalculado) {
            ajusteManual = true;
            ajusteNovo = prazoMudou;
            justificativaPrazo = ajusteNovo
              ? e.prazo_justificativa
              : (atual?.prazo_ajuste_justificativa ?? null);
            if (ajusteNovo && (e.prazo_justificativa ?? "").length < 10) {
              errosCampo.prazo_justificativa =
                "Justifique o ajuste manual do prazo (mínimo de 10 caracteres).";
            }
          }
        }
      }
      const datasMudaram = aberturaMudou || !atual || prazo !== atual.prazo;
      if (datasMudaram && prazo < abertura) {
        errosCampo.prazo = "O prazo não pode ser anterior à data de abertura.";
      }
      if (
        !datasMudaram &&
        atual &&
        (atual.prazo < atual.data_solicitacao || atual.data_solicitacao > hoje)
      ) {
        alertas.push(
          "As datas deste chamado estão inconsistentes e constam no relatório de revisão; elas não foram alteradas."
        );
      }
      if (e.proxima_acao_em && !ehDataCivilValida(e.proxima_acao_em)) {
        errosCampo.proxima_acao_em = "Data da próxima ação inválida.";
      }

      // --- Situação ---
      const situacaoNova = e.situacao as Situacao;
      const situacaoAnterior: Situacao = atual ? atual.situacao : "aguardando";
      // Na criação, valida como se partisse de "Aberto" (exige resolução/motivo se já nascer finalizado);
      // "Rascunho" também é situação inicial válida.
      const dadosTransicao = {
        resolucao: e.resolucao,
        motivo_encerramento: e.motivo_encerramento,
        justificativa: e.justificativa_situacao,
      };
      const trans =
        !atual && situacaoNova === "rascunho"
          ? ({ ok: true, ehReabertura: false } as const)
          : validarTransicao(situacaoAnterior, situacaoNova, dadosTransicao);
      if (!trans.ok) errosCampo[trans.campo ?? "situacao"] = trans.erro;

      if (Object.keys(errosCampo).length > 0) {
        throw new ErroNegocio("Corrija os campos destacados.", errosCampo);
      }

      // --- Protocolo ---
      let protocolo = atual ? atual.protocolo : e.protocolo;
      if (!protocolo) {
        const g = await novaRequisicao(tx)
          .input("data_solicitacao", sql.Date, paraParametroDate(abertura))
          .output("protocolo_gerado", sql.VarChar(20))
          .execute("dados.gerar_protocolo");
        protocolo = g.output.protocolo_gerado as string;
      } else if (!atual) {
        const dup = await novaRequisicao(tx).input("p", sql.VarChar(20), protocolo).query(`
        SELECT criado_por_nome, criado_em FROM dados.chamados WITH (UPDLOCK, HOLDLOCK)
        WHERE protocolo = @p`);
        if (dup.recordset[0]) {
          throw new ErroNegocio(`Protocolo ${protocolo} já cadastrado.`, {
            protocolo: `Já cadastrado por ${dup.recordset[0].criado_por_nome ?? "outra pessoa"}.`,
          });
        }
      }

      const agoraIso = agora.toISOString();
      const dataConclusao = atual
        ? dataConclusaoAposTransicao(
            situacaoAnterior,
            situacaoNova,
            atual.data_conclusao ?? null,
            agoraIso
          )
        : ehFinal(situacaoNova)
          ? agoraIso
          : null;
      const reabertura = atual && trans.ok && trans.ehReabertura;
      const resolucao =
        situacaoNova === "concluido" ? (e.resolucao ?? atual?.resolucao ?? null) : null;
      const motivoEnc =
        situacaoNova === "encerrado"
          ? (e.motivo_encerramento ?? atual?.motivo_encerramento ?? null)
          : null;

      const r = novaRequisicao(tx)
        .input("aluno_nome", sql.NVarChar(200), e.aluno_nome)
        .input("aluno_ra", sql.VarChar(50), ra)
        .input("aluno_cpf", sql.VarChar(11), cpfLimpo)
        .input("polo_id", sql.UniqueIdentifier, poloId)
        .input("contato_telefone", sql.VarChar(20), telefone)
        .input("motivo_id", sql.UniqueIdentifier, e.motivo_id)
        .input("descricao", sql.NVarChar(sql.MAX), e.descricao)
        .input("situacao", sql.VarChar(20), situacaoNova)
        .input("prioridade", sql.VarChar(20), e.prioridade)
        .input("data_solicitacao", sql.Date, paraParametroDate(abertura))
        .input("prazo", sql.Date, paraParametroDate(prazo))
        .input("prazo_calculado", sql.Date, paraParametroDate(prazoCalculado))
        .input("prazo_ajuste_manual", sql.Bit, ajusteManual)
        .input("prazo_justificativa", sql.NVarChar(500), ajusteManual ? justificativaPrazo : null)
        .input("ajuste_novo", sql.Bit, ajusteNovo)
        .input("data_conclusao", sql.DateTimeOffset, dataConclusao ? new Date(dataConclusao) : null)
        .input("chamado_vinculado_id", sql.UniqueIdentifier, e.chamado_vinculado_id ?? null)
        .input("observacao", sql.NVarChar(sql.MAX), e.observacao)
        .input("resolucao", sql.NVarChar(sql.MAX), resolucao)
        .input("motivo_encerramento", sql.VarChar(40), motivoEnc)
        .input("proxima_acao", sql.NVarChar(500), e.proxima_acao)
        .input(
          "proxima_acao_em",
          sql.Date,
          e.proxima_acao_em ? paraParametroDate(e.proxima_acao_em) : null
        )
        .input("status_externo", sql.NVarChar(120), e.status_externo)
        .input("usuario", sql.UniqueIdentifier, perfil.id)
        .input("usuario_nome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200));

      let chamadoId: string;
      if (atual) {
        const up = await r
          .input("id", sql.UniqueIdentifier, atual.id)
          .input("versao", sql.DateTimeOffset, new Date(atual.atualizado_em))
          .input("reabertura", sql.Int, reabertura ? 1 : 0).query(`
          UPDATE dados.chamados SET
            aluno_nome = @aluno_nome, aluno_ra = @aluno_ra, aluno_cpf = @aluno_cpf, polo_id = @polo_id,
            contato_telefone = @contato_telefone, motivo_id = @motivo_id, descricao = @descricao,
            situacao = @situacao, prioridade = @prioridade, data_solicitacao = @data_solicitacao,
            prazo = @prazo, prazo_calculado = @prazo_calculado, prazo_ajuste_manual = @prazo_ajuste_manual,
            prazo_ajuste_justificativa = @prazo_justificativa,
            prazo_ajustado_por = CASE WHEN @ajuste_novo = 1 THEN @usuario WHEN @prazo_ajuste_manual = 0 THEN NULL ELSE prazo_ajustado_por END,
            prazo_ajustado_em = CASE WHEN @ajuste_novo = 1 THEN SYSDATETIMEOFFSET() WHEN @prazo_ajuste_manual = 0 THEN NULL ELSE prazo_ajustado_em END,
            data_conclusao = @data_conclusao, chamado_vinculado_id = @chamado_vinculado_id,
            observacao = @observacao, resolucao = @resolucao, motivo_encerramento = @motivo_encerramento,
            proxima_acao = @proxima_acao, proxima_acao_em = @proxima_acao_em, status_externo = @status_externo,
            reaberturas = reaberturas + @reabertura, ultima_interacao_em = SYSDATETIMEOFFSET(),
            atualizado_por = @usuario, atualizado_por_nome = @usuario_nome, atualizado_em = SYSDATETIMEOFFSET()
          WHERE id = @id AND excluido_em IS NULL AND atualizado_em = @versao`);
        if (up.rowsAffected[0] !== 1) {
          throw new ErroNegocio(
            "O chamado foi alterado por outra pessoa. Recarregue e tente novamente.",
            {},
            "conflito"
          );
        }
        chamadoId = atual.id;

        if (situacaoNova !== situacaoAnterior) {
          await registrarEvento(tx, perfil, chamadoId, {
            tipo: reabertura ? "reabertura" : "situacao",
            situacao_anterior: situacaoAnterior,
            situacao_nova: situacaoNova,
            texto:
              situacaoNova === "concluido"
                ? resolucao
                : situacaoNova === "encerrado"
                  ? [motivoEnc, e.justificativa_situacao].filter(Boolean).join(" — ")
                  : e.justificativa_situacao,
          });
        }
        const alterados = (
          [
            ["aluno_nome", e.aluno_nome, atual.aluno_nome],
            ["aluno_ra", ra, atual.aluno_ra ?? null],
            ["aluno_cpf", cpfLimpo, atual.aluno_cpf ?? null],
            ["contato_telefone", telefone, atual.contato_telefone ?? null],
            ["polo_id", poloId, atual.polo_id ?? null],
            ["motivo_id", e.motivo_id.toLowerCase(), atual.motivo_id.toLowerCase()],
            ["descricao", e.descricao, atual.descricao ?? null],
            ["prioridade", e.prioridade, atual.prioridade],
            ["data_solicitacao", abertura, atual.data_solicitacao],
            ["observacao", e.observacao, atual.observacao ?? null],
            ["status_externo", e.status_externo, atual.status_externo ?? null],
            ["proxima_acao", e.proxima_acao, atual.proxima_acao ?? null],
          ] as const
        )
          .filter(([, novo, velho]) => (novo ?? null) !== (velho ?? null))
          .map(([campo]) => campo);
        if (alterados.length > 0) {
          await registrarEvento(tx, perfil, chamadoId, {
            tipo: "edicao",
            dados: { campos: alterados },
          });
        }
      } else {
        const ins = await r
          .input("protocolo", sql.VarChar(20), protocolo)
          .input("responsavel_id", sql.UniqueIdentifier, perfil.id).query(`
          DECLARE @out TABLE (id UNIQUEIDENTIFIER);
          INSERT INTO dados.chamados (
            protocolo, aluno_nome, aluno_ra, aluno_cpf, polo_id, contato_telefone, motivo_id, descricao,
            situacao, prioridade, data_solicitacao, prazo, prazo_calculado, prazo_ajuste_manual,
            prazo_ajuste_justificativa, prazo_ajustado_por, prazo_ajustado_em, data_conclusao,
            chamado_vinculado_id, observacao, resolucao, motivo_encerramento, proxima_acao, proxima_acao_em,
            status_externo, responsavel_id, ultima_interacao_em, criado_por, criado_por_nome)
          OUTPUT inserted.id INTO @out(id)
          VALUES (
            @protocolo, @aluno_nome, @aluno_ra, @aluno_cpf, @polo_id, @contato_telefone, @motivo_id, @descricao,
            @situacao, @prioridade, @data_solicitacao, @prazo, @prazo_calculado, @prazo_ajuste_manual,
            @prazo_justificativa, CASE WHEN @ajuste_novo = 1 THEN @usuario END,
            CASE WHEN @ajuste_novo = 1 THEN SYSDATETIMEOFFSET() END, @data_conclusao,
            @chamado_vinculado_id, @observacao, @resolucao, @motivo_encerramento, @proxima_acao, @proxima_acao_em,
            @status_externo, @responsavel_id, SYSDATETIMEOFFSET(), @usuario, @usuario_nome);
          SELECT CAST(id AS NVARCHAR(50)) AS id FROM @out;`);
        chamadoId = ins.recordset[0].id;
        await registrarEvento(tx, perfil, chamadoId, {
          tipo: "criacao",
          situacao_nova: situacaoNova,
          responsavel_novo: perfil.id,
          texto: `Chamado ${protocolo} aberto como "${ROTULO_SITUACAO[situacaoNova]}".`,
        });
      }

      if (ajusteNovo) {
        await registrarEvento(tx, perfil, chamadoId, {
          tipo: "ajuste_prazo",
          texto: justificativaPrazo,
          dados: {
            prazo_calculado: prazoCalculado,
            prazo_ajustado: prazo,
            prazo_anterior: atual?.prazo ?? null,
          },
        });
      }

      if (arquivos.length > 0) {
        await salvarAnexosNaTransacao(tx, chamadoId, arquivos, perfil);
      }

      return { chamadoId, alertas };
    }
  );
}

/** Atribui ou transfere o responsável, com justificativa na transferência. */
export async function atribuirResponsavel(
  perfil: PerfilServico,
  chamadoId: string,
  novoResponsavelId: string,
  justificativa: string | null,
  opcoes: { ip?: string | null } = {}
) {
  return comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel, ip: opcoes.ip },
    async (_req, tx) => {
      const atual = await carregarChamadoAutorizado(novaRequisicao(tx), perfil, chamadoId, {
        bloquear: true,
      });
      if (!atual)
        throw new ErroNegocio("Chamado não encontrado ou sem permissão.", {}, "nao_encontrado");
      if (ehFinal(atual.situacao)) throw new ErroNegocio("Reabra o chamado antes de transferi-lo.");
      if (!z.string().uuid().safeParse(novoResponsavelId).success) {
        throw new ErroNegocio("Selecione o novo responsável.", { responsavel_id: "Obrigatório." });
      }
      const cand = await novaRequisicao(tx).input("id", sql.UniqueIdentifier, novoResponsavelId)
        .query(`
      SELECT CAST(id AS NVARCHAR(50)) AS id, ativo, papel, CAST(polo_id AS NVARCHAR(50)) AS polo_id
      FROM dados.perfis WHERE id = @id`);
      const c = cand.recordset[0];
      if (
        !c ||
        !podeSerResponsavel(
          { ativo: Boolean(c.ativo), papel: c.papel, polo_id: c.polo_id },
          atual.polo_id ?? null
        )
      ) {
        throw new ErroNegocio("Selecione um responsável ativo do mesmo polo do chamado.", {
          responsavel_id: "Responsável inválido.",
        });
      }
      if (atual.responsavel_id?.toLowerCase() === novoResponsavelId.toLowerCase()) return;
      const ehTransferencia = !!atual.responsavel_id;
      if (ehTransferencia && (justificativa ?? "").trim().length < 10) {
        throw new ErroNegocio("Informe o motivo da transferência (mínimo de 10 caracteres).", {
          justificativa: "Obrigatório na transferência.",
        });
      }
      await novaRequisicao(tx)
        .input("id", sql.UniqueIdentifier, chamadoId)
        .input("resp", sql.UniqueIdentifier, novoResponsavelId)
        .input("usuario", sql.UniqueIdentifier, perfil.id)
        .input("usuario_nome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200)).query(`
        UPDATE dados.chamados SET responsavel_id = @resp, ultima_interacao_em = SYSDATETIMEOFFSET(),
          atualizado_por = @usuario, atualizado_por_nome = @usuario_nome, atualizado_em = SYSDATETIMEOFFSET()
        WHERE id = @id`);
      await registrarEvento(tx, perfil, chamadoId, {
        tipo: ehTransferencia ? "transferencia" : "atribuicao",
        responsavel_anterior: atual.responsavel_id ?? null,
        responsavel_novo: novoResponsavelId,
        texto: justificativa?.trim() || null,
      });
    }
  );
}

/** Registra interação (contato com aluno, retorno do PAD etc.) e a próxima ação prevista. */
export async function registrarInteracao(
  perfil: PerfilServico,
  chamadoId: string,
  dados: { texto: string; proxima_acao?: string | null; proxima_acao_em?: string | null },
  opcoes: { ip?: string | null } = {}
) {
  const texto = dados.texto.trim();
  if (texto.length < 3) throw new ErroNegocio("Descreva a interação.", { texto: "Obrigatório." });
  if (dados.proxima_acao_em && !ehDataCivilValida(dados.proxima_acao_em)) {
    throw new ErroNegocio("Data da próxima ação inválida.", { proxima_acao_em: "Data inválida." });
  }
  return comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel, ip: opcoes.ip },
    async (_req, tx) => {
      const atual = await carregarChamadoAutorizado(novaRequisicao(tx), perfil, chamadoId, {
        bloquear: true,
      });
      if (!atual)
        throw new ErroNegocio("Chamado não encontrado ou sem permissão.", {}, "nao_encontrado");
      await novaRequisicao(tx)
        .input("id", sql.UniqueIdentifier, chamadoId)
        .input("pa", sql.NVarChar(500), dados.proxima_acao?.trim() || null)
        .input(
          "pae",
          sql.Date,
          dados.proxima_acao_em ? paraParametroDate(dados.proxima_acao_em) : null
        )
        .input("usuario", sql.UniqueIdentifier, perfil.id)
        .input("usuario_nome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200)).query(`
        UPDATE dados.chamados SET ultima_interacao_em = SYSDATETIMEOFFSET(), proxima_acao = @pa,
          proxima_acao_em = @pae, atualizado_por = @usuario, atualizado_por_nome = @usuario_nome,
          atualizado_em = SYSDATETIMEOFFSET()
        WHERE id = @id`);
      await registrarEvento(tx, perfil, chamadoId, {
        tipo: "interacao",
        texto,
        dados: dados.proxima_acao
          ? { proxima_acao: dados.proxima_acao, proxima_acao_em: dados.proxima_acao_em ?? null }
          : null,
      });
    }
  );
}

/** Marca/desmarca como registro de teste (somente admin), com justificativa auditada. */
export async function marcarComoTeste(
  perfil: PerfilServico,
  chamadoId: string,
  ehTeste: boolean,
  justificativa: string,
  opcoes: { ip?: string | null } = {}
) {
  if (!podeMarcarTeste(perfil))
    throw new ErroNegocio(
      "Apenas administradores podem marcar registros de teste.",
      {},
      "proibido"
    );
  if (justificativa.trim().length < 10)
    throw new ErroNegocio("Justifique a marcação (mínimo de 10 caracteres).");
  return comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel, ip: opcoes.ip },
    async (_req, tx) => {
      const atual = await carregarChamadoAutorizado(novaRequisicao(tx), perfil, chamadoId, {
        bloquear: true,
      });
      if (!atual) throw new ErroNegocio("Chamado não encontrado.", {}, "nao_encontrado");
      await novaRequisicao(tx)
        .input("id", sql.UniqueIdentifier, chamadoId)
        .input("t", sql.Bit, ehTeste)
        .input("usuario", sql.UniqueIdentifier, perfil.id)
        .query(
          `UPDATE dados.chamados SET eh_teste = @t, atualizado_por = @usuario, atualizado_em = SYSDATETIMEOFFSET() WHERE id = @id`
        );
      await registrarEvento(tx, perfil, chamadoId, {
        tipo: "marcacao_teste",
        texto: justificativa.trim(),
        dados: { eh_teste: ehTeste },
      });
    }
  );
}

/** Lista o histórico estruturado do chamado. */
export async function listarEventos(req: sql.Request, chamadoId: string) {
  const q = await req.input("chamado_eventos_id", sql.UniqueIdentifier, chamadoId).query(`
    SELECT e.id, e.tipo, e.situacao_anterior, e.situacao_nova, e.texto, e.dados_json, e.criado_por_nome, e.criado_em,
      pa.nome_completo AS responsavel_anterior_nome, pn.nome_completo AS responsavel_novo_nome
    FROM dados.chamado_eventos e
    LEFT JOIN dados.perfis pa ON pa.id = e.responsavel_anterior
    LEFT JOIN dados.perfis pn ON pn.id = e.responsavel_novo
    WHERE e.chamado_id = @chamado_eventos_id
    ORDER BY e.id DESC`);
  return q.recordset.map((r) => ({
    id: Number(r.id),
    tipo: String(r.tipo),
    situacao_anterior: r.situacao_anterior,
    situacao_nova: r.situacao_nova,
    responsavel_anterior_nome: r.responsavel_anterior_nome,
    responsavel_novo_nome: r.responsavel_novo_nome,
    texto: r.texto,
    criado_por_nome: r.criado_por_nome,
    criado_em: instanteDoBanco(r.criado_em) ?? "",
  }));
}

/** Anexa arquivos a um chamado do escopo do usuário (validação de conteúdo já feita). */
export async function anexarArquivos(
  perfil: PerfilServico,
  chamadoId: string,
  arquivos: ArquivoRecebido[],
  descricao: string | null,
  opcoes: { ip?: string | null } = {}
) {
  if (arquivos.length === 0) throw new ErroNegocio("Nenhum arquivo informado.");
  return comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel, ip: opcoes.ip },
    async (_req, tx) => {
      const atual = await carregarChamadoAutorizado(novaRequisicao(tx), perfil, chamadoId, {
        bloquear: true,
      });
      if (!atual)
        throw new ErroNegocio("Chamado não encontrado ou sem permissão.", {}, "nao_encontrado");
      await salvarAnexosNaTransacao(tx, chamadoId, arquivos, perfil, descricao);
      await novaRequisicao(tx)
        .input("id", sql.UniqueIdentifier, chamadoId)
        .input("usuario", sql.UniqueIdentifier, perfil.id)
        .input("usuario_nome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200)).query(`
        UPDATE dados.chamados SET atualizado_por = @usuario, atualizado_por_nome = @usuario_nome,
          atualizado_em = SYSDATETIMEOFFSET(), ultima_interacao_em = SYSDATETIMEOFFSET()
        WHERE id = @id`);
    }
  );
}

/** Metadados de um anexo se o usuário pode ver o chamado ao qual pertence. */
export async function carregarAnexoAutorizado(
  req: () => sql.Request,
  perfil: PerfilAutorizacao,
  arquivoId: string
) {
  if (!z.string().uuid().safeParse(arquivoId).success) return null;
  const q = await req().input("id", sql.UniqueIdentifier, arquivoId).query(`
    SELECT CAST(a.id AS NVARCHAR(50)) AS id, CAST(a.chamado_id AS NVARCHAR(50)) AS chamado_id,
      a.nome_original, a.caminho_storage, a.tipo_mime, CAST(a.criado_por AS NVARCHAR(50)) AS criado_por,
      CAST(c.polo_id AS NVARCHAR(50)) AS polo_id, CAST(c.criado_por AS NVARCHAR(50)) AS chamado_criado_por,
      CAST(COALESCE(c.responsavel_id, c.criado_por) AS NVARCHAR(50)) AS responsavel_id
    FROM dados.arquivos_chamados a
    JOIN dados.chamados c ON c.id = a.chamado_id
    WHERE a.id = @id AND a.excluido_em IS NULL AND c.excluido_em IS NULL`);
  const a = q.recordset[0];
  if (!a) return null;
  return podeVerChamado(perfil, {
    polo_id: a.polo_id,
    criado_por: a.chamado_criado_por,
    responsavel_id: a.responsavel_id,
  })
    ? (a as {
        id: string;
        chamado_id: string;
        nome_original: string;
        caminho_storage: string;
        tipo_mime: string | null;
        criado_por: string;
      })
    : null;
}

/** Exclusão lógica de anexo: admin ou quem anexou; o conteúdo é preservado para auditoria. */
export async function excluirAnexo(
  perfil: PerfilServico,
  arquivoId: string,
  opcoes: { ip?: string | null } = {}
) {
  return comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel, ip: opcoes.ip },
    async (_req, tx) => {
      const a = await carregarAnexoAutorizado(() => novaRequisicao(tx), perfil, arquivoId);
      if (!a) throw new ErroNegocio("Anexo não encontrado ou sem permissão.", {}, "nao_encontrado");
      if (perfil.papel !== "admin" && a.criado_por.toLowerCase() !== perfil.id.toLowerCase()) {
        throw new ErroNegocio(
          "Somente quem anexou o arquivo ou um administrador pode removê-lo.",
          {},
          "proibido"
        );
      }
      await novaRequisicao(tx)
        .input("id", sql.UniqueIdentifier, arquivoId)
        .input("usuario", sql.UniqueIdentifier, perfil.id)
        .query(
          "UPDATE dados.arquivos_chamados SET excluido_em = SYSDATETIMEOFFSET(), excluido_por = @usuario WHERE id = @id"
        );
      await registrarEvento(tx, perfil, a.chamado_id, {
        tipo: "edicao",
        texto: `Anexo removido: ${a.nome_original}`,
        dados: { anexo_removido: arquivoId },
      });
      return a.chamado_id;
    }
  );
}

/** Exclusão lógica do chamado: admin ou quem criou, dentro do escopo. */
export async function excluirChamado(
  perfil: PerfilServico,
  chamadoId: string,
  opcoes: { ip?: string | null } = {}
) {
  return comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel, ip: opcoes.ip },
    async (_req, tx) => {
      const atual = await carregarChamadoAutorizado(novaRequisicao(tx), perfil, chamadoId, {
        bloquear: true,
      });
      if (!atual)
        throw new ErroNegocio("Chamado não encontrado ou sem permissão.", {}, "nao_encontrado");
      if (perfil.papel !== "admin" && atual.criado_por.toLowerCase() !== perfil.id.toLowerCase()) {
        throw new ErroNegocio(
          "Somente quem criou o chamado ou um administrador pode excluí-lo.",
          {},
          "proibido"
        );
      }
      await novaRequisicao(tx)
        .input("id", sql.UniqueIdentifier, chamadoId)
        .input("usuario", sql.UniqueIdentifier, perfil.id)
        .query(
          "UPDATE dados.chamados SET excluido_em = SYSDATETIMEOFFSET(), excluido_por = @usuario WHERE id = @id AND excluido_em IS NULL"
        );
    }
  );
}
