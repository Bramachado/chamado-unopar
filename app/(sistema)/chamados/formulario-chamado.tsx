"use client";

import { useMemo, useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import { type Chamado, type Motivo, type Polo } from "@/types/database";
import { salvarChamado, verificarProtocoloDuplicado, buscarChamadosParaVinculo } from "./actions";
import {
  AlertCircle,
  Link as LinkIcon,
  ArrowLeft,
  Paperclip,
  FileText,
  X,
  UploadCloud,
  Search,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { formatarCpf } from "@/lib/utils/cpf";
import { formatarTelefone } from "@/lib/utils/telefone";
import { formatarDataCivil, hojeCivil, formatarInstante } from "@/lib/datas";
import { calcularPrazoPadrao, REGRA_SLA } from "@/lib/sla";
import {
  DESCRICAO_SITUACAO,
  MOTIVOS_ENCERRAMENTO,
  ROTULO_SITUACAO,
  SITUACOES_INICIAIS,
  TRANSICOES,
  ehFinal,
  type Situacao,
} from "@/lib/chamados/situacoes";
import { DESCRICAO_TIPOS_ACEITOS, EXTENSOES_ACEITAS } from "@/lib/storage/validacao-arquivo";

interface FormularioChamadoProps {
  chamadoInicial?: Chamado | null;
  motivos: Motivo[];
  polos?: Polo[];
  poloUsuario?: string | null;
  feriados?: string[];
  voltarPara?: string;
  chamadoVinculadoInicial?: { id: string; protocolo: string; aluno_nome: string } | null;
}

const campoBase =
  "w-full rounded-lg border bg-fundo px-3.5 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:outline-none shadow-xs";
const campoClasse = (erro?: string) =>
  `${campoBase} ${erro ? "border-erro ring-1 ring-erro/50" : "border-borda focus:border-acento focus:ring-2 focus:ring-acento/20"}`;

function Erro({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[11px] font-semibold text-erro">
      {texto}
    </p>
  );
}

export function FormularioChamado({
  chamadoInicial,
  motivos,
  polos = [],
  poloUsuario,
  feriados = [],
  voltarPara = "/chamados",
  chamadoVinculadoInicial,
}: FormularioChamadoProps) {
  const router = useRouter();
  const uid = useId();
  const [isPending, startTransition] = useTransition();
  const hoje = hojeCivil();
  const editando = !!chamadoInicial;
  const situacaoOriginal: Situacao = chamadoInicial?.situacao ?? "aguardando";

  const [protocolo, setProtocolo] = useState(chamadoInicial?.protocolo || "");
  const [alunoNome, setAlunoNome] = useState(chamadoInicial?.aluno_nome || "");
  const [alunoRa, setAlunoRa] = useState(chamadoInicial?.aluno_ra || "");
  const [confirmarRa, setConfirmarRa] = useState(false);
  const [alunoCpf, setAlunoCpf] = useState(
    chamadoInicial?.aluno_cpf ? formatarCpf(chamadoInicial.aluno_cpf) : ""
  );
  const [poloId, setPoloId] = useState(
    chamadoInicial?.polo_id || poloUsuario || polos[0]?.id || ""
  );
  const [contatoTelefone, setContatoTelefone] = useState(
    chamadoInicial?.contato_telefone ? chamadoInicial.contato_telefone : ""
  );
  const [motivoId, setMotivoId] = useState(chamadoInicial?.motivo_id || "");
  const [descricao, setDescricao] = useState(chamadoInicial?.descricao || "");
  const [situacao, setSituacao] = useState<Situacao>(situacaoOriginal);
  const [prioridade, setPrioridade] = useState(chamadoInicial?.prioridade || "normal");
  const [dataSolicitacao, setDataSolicitacao] = useState(chamadoInicial?.data_solicitacao || hoje);
  const prazoCalculado = useMemo(
    () => (dataSolicitacao ? calcularPrazoPadrao(dataSolicitacao, feriados) : ""),
    [dataSolicitacao, feriados]
  );
  const [prazoModo, setPrazoModo] = useState<"automatico" | "manual">(
    chamadoInicial &&
      chamadoInicial.prazo !== calcularPrazoPadrao(chamadoInicial.data_solicitacao, feriados)
      ? "manual"
      : "automatico"
  );
  const [prazoManual, setPrazoManual] = useState(chamadoInicial?.prazo || "");
  const [prazoJustificativa, setPrazoJustificativa] = useState("");
  const [observacao, setObservacao] = useState(chamadoInicial?.observacao || "");
  const [resolucao, setResolucao] = useState(chamadoInicial?.resolucao || "");
  const [motivoEncerramento, setMotivoEncerramento] = useState(
    chamadoInicial?.motivo_encerramento || ""
  );
  const [justificativaSituacao, setJustificativaSituacao] = useState("");
  const [proximaAcao, setProximaAcao] = useState(chamadoInicial?.proxima_acao || "");
  const [proximaAcaoEm, setProximaAcaoEm] = useState(chamadoInicial?.proxima_acao_em || "");
  const [statusExterno, setStatusExterno] = useState(chamadoInicial?.status_externo || "");
  const [arquivosSelecionados, setArquivosSelecionados] = useState<File[]>([]);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
  const [chamadoVinculado, setChamadoVinculado] = useState(chamadoVinculadoInicial || null);
  const [buscaVinculo, setBuscaVinculo] = useState("");
  const [resultadosVinculo, setResultadosVinculo] = useState<
    {
      id: string;
      protocolo: string;
      aluno_nome: string;
      data_solicitacao: string;
      situacao: string;
    }[]
  >([]);
  const [buscandoVinculo, setBuscandoVinculo] = useState(false);
  const [buscaFeita, setBuscaFeita] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});

  const prazoEfetivo = prazoModo === "automatico" ? prazoCalculado : prazoManual;
  const prazoManualDiferente =
    prazoModo === "manual" && prazoManual !== "" && prazoManual !== prazoCalculado;
  const prazoAlterado =
    !editando ||
    prazoEfetivo !== chamadoInicial?.prazo ||
    dataSolicitacao !== chamadoInicial?.data_solicitacao;
  const exigeJustificativaPrazo = prazoManualDiferente && prazoAlterado;
  const ehReabertura = editando && ehFinal(situacaoOriginal) && !ehFinal(situacao);
  const datasInconsistentes =
    editando &&
    (chamadoInicial!.prazo < chamadoInicial!.data_solicitacao ||
      chamadoInicial!.data_solicitacao > hoje);

  const situacoesPermitidas: Situacao[] = editando
    ? [situacaoOriginal, ...TRANSICOES[situacaoOriginal]]
    : [...SITUACOES_INICIAIS, "concluido", "encerrado"];
  const opcoesSituacao: CustomSelectOption[] = situacoesPermitidas.map((s) => ({
    value: s,
    label: ROTULO_SITUACAO[s] + (s === situacaoOriginal && editando ? " (atual)" : ""),
    sublabel: DESCRICAO_SITUACAO[s],
  }));
  const opcoesMotivo: CustomSelectOption[] = motivos.map((m) => ({
    value: m.id,
    label: `${m.codigo} — ${m.nome}`,
    sublabel: m.filtro ? `Caminho: ${m.filtro}` : undefined,
  }));
  const opcoesPolo: CustomSelectOption[] = polos.map((p) => ({
    value: p.id,
    label: `${p.nome} — ${p.cidade} (${p.estado})`,
  }));
  const opcoesEncerramento: CustomSelectOption[] = Object.entries(MOTIVOS_ENCERRAMENTO).map(
    ([v, l]) => ({ value: v, label: l })
  );

  const limparErro = (campo: string) =>
    setErrosCampo((prev) => {
      if (!prev[campo]) return prev;
      const novo = { ...prev };
      delete novo[campo];
      return novo;
    });

  const handleVerificarProtocolo = async (valor: string) => {
    const limpo = valor.trim().toUpperCase();
    setProtocolo(limpo);
    setAvisoDuplicado(null);
    if (limpo.length >= 6) {
      const duplicado = await verificarProtocoloDuplicado(limpo, chamadoInicial?.id);
      if (duplicado) {
        setAvisoDuplicado(
          `Atenção: este protocolo já foi cadastrado por ${duplicado.criado_por_nome} em ${formatarInstante(duplicado.criado_em, { somenteData: true })}.`
        );
      }
    }
  };

  const handleBuscarVinculo = async () => {
    if (!buscaVinculo || buscaVinculo.length < 2) return;
    setBuscandoVinculo(true);
    const res = await buscarChamadosParaVinculo(buscaVinculo);
    setResultadosVinculo(res.filter((c) => c.id !== chamadoInicial?.id));
    setBuscaFeita(true);
    setBuscandoVinculo(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro(null);
    setConflito(false);
    setErrosCampo({});

    const formData = new FormData();
    if (chamadoInicial?.id) {
      formData.set("id", chamadoInicial.id);
      formData.set("versao", chamadoInicial.atualizado_em);
    }
    const valores: Record<string, string> = {
      protocolo,
      aluno_nome: alunoNome,
      aluno_ra: alunoRa,
      confirmar_ra: confirmarRa ? "true" : "false",
      aluno_cpf: alunoCpf,
      polo_id: poloId,
      contato_telefone: contatoTelefone,
      motivo_id: motivoId,
      descricao,
      situacao,
      prioridade,
      data_solicitacao: dataSolicitacao,
      prazo_modo: prazoModo,
      prazo: prazoEfetivo,
      prazo_justificativa: prazoJustificativa,
      observacao,
      resolucao,
      motivo_encerramento: motivoEncerramento,
      justificativa_situacao: justificativaSituacao,
      proxima_acao: proximaAcao,
      proxima_acao_em: proximaAcaoEm,
      status_externo: statusExterno,
      chamado_vinculado_id: chamadoVinculado?.id ?? "",
    };
    for (const [k, v] of Object.entries(valores)) formData.set(k, v ?? "");
    for (const arq of arquivosSelecionados) formData.append("arquivos", arq);

    startTransition(async () => {
      const resultado = await salvarChamado({}, formData);
      if (resultado.sucesso) {
        router.push(resultado.chamadoId ? `/chamados/${resultado.chamadoId}` : voltarPara);
        router.refresh();
        return;
      }
      setConflito(!!resultado.conflito);
      setErrosCampo(resultado.errosCampo ?? {});
      setMensagemErro(resultado.erro ?? "Não foi possível salvar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const ids = (campo: string) => ({ campo: `${uid}-${campo}`, erro: `${uid}-${campo}-erro` });
  const aria = (campo: string) => ({
    id: ids(campo).campo,
    "aria-invalid": !!errosCampo[campo],
    "aria-describedby": errosCampo[campo] ? ids(campo).erro : undefined,
  });

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-8 pb-12" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={voltarPara}
            className="btn-tátil h-9 w-9 rounded-lg border border-borda bg-superficie flex items-center justify-center text-texto-suave hover:bg-fundo hover:text-texto transition shadow-xs"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-texto">
              {chamadoInicial
                ? `Editar Chamado: ${chamadoInicial.protocolo}`
                : "Abertura de Novo Chamado"}
            </h1>
            <p className="text-sm text-texto-suave mt-0.5">
              {chamadoInicial
                ? "Atualize os dados e complemente o protocolo com novos arquivos."
                : "Cadastre as informações da solicitação aberta na plataforma externa."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={voltarPara}
            className="btn-tátil h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto hover:bg-fundo transition inline-flex items-center shadow-xs"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="btn-tátil h-9 px-5 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover disabled:opacity-50 transition inline-flex items-center shadow-xs"
          >
            {isPending ? "Salvando..." : chamadoInicial ? "Salvar Alterações" : "Salvar Chamado"}
          </button>
        </div>
      </div>

      {mensagemErro && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-erro/40 bg-erro-fundo p-4 text-xs font-medium text-erro"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-2">
            <span>{mensagemErro}</span>
            {conflito && (
              <button
                type="button"
                onClick={() => router.refresh()}
                className="flex items-center gap-1.5 rounded-md border border-erro/40 px-2.5 py-1 font-bold hover:bg-erro hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Recarregar a versão atual
              </button>
            )}
          </div>
        </div>
      )}

      {datasInconsistentes && (
        <div className="flex items-start gap-2.5 rounded-lg border border-alerta/50 bg-alerta-fundo p-4 text-xs font-medium text-alerta">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Datas inconsistentes neste registro: abertura em{" "}
            {formatarDataCivil(chamadoInicial!.data_solicitacao)} e prazo em{" "}
            {formatarDataCivil(chamadoInicial!.prazo)}. Elas só mudam se você corrigi-las aqui.
          </span>
        </div>
      )}

      {/* Seção 1: Identificação */}
      <fieldset className="rounded-xl border border-borda bg-superficie p-6 space-y-4 shadow-xs">
        <legend className="font-heading text-sm font-bold text-texto px-1">
          Identificação do Protocolo e Aluno
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={ids("protocolo").campo}
              className="block text-xs font-bold text-texto mb-1.5"
            >
              Número do Protocolo (PAD){" "}
              <span className="text-texto-suave font-normal text-[11px]">
                (opcional — gerado automaticamente se vazio)
              </span>
            </label>
            <input
              {...aria("protocolo")}
              type="text"
              value={protocolo}
              readOnly={editando}
              onChange={(e) => handleVerificarProtocolo(e.target.value)}
              placeholder="Ex: C345235256 ou deixe vazio para gerar"
              maxLength={20}
              className={`${campoClasse(errosCampo.protocolo)} font-mono font-bold uppercase ${editando ? "opacity-70" : ""}`}
            />
            <Erro id={ids("protocolo").erro} texto={errosCampo.protocolo} />
            {avisoDuplicado && (
              <div
                role="status"
                className="mt-2 flex items-center gap-1.5 rounded-md border border-alerta/50 bg-alerta-fundo p-2 text-xs font-bold text-alerta"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{avisoDuplicado}</span>
              </div>
            )}
          </div>
          <div>
            <CustomSelect
              label="Motivo do Chamado *"
              options={opcoesMotivo}
              value={motivoId}
              placeholder="Selecione o motivo..."
              onChange={(v) => {
                setMotivoId(v);
                limparErro("motivo_id");
              }}
            />
            <Erro id={ids("motivo_id").erro} texto={errosCampo.motivo_id} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label
              htmlFor={ids("aluno_nome").campo}
              className="block text-xs font-bold text-texto mb-1.5"
            >
              Nome Completo do Aluno{" "}
              <span className="text-erro" aria-hidden="true">
                *
              </span>
            </label>
            <input
              {...aria("aluno_nome")}
              type="text"
              required
              value={alunoNome}
              onChange={(e) => {
                setAlunoNome(e.target.value);
                limparErro("aluno_nome");
              }}
              placeholder="Nome do aluno"
              maxLength={200}
              autoComplete="off"
              className={campoClasse(errosCampo.aluno_nome)}
            />
            <Erro id={ids("aluno_nome").erro} texto={errosCampo.aluno_nome} />
          </div>
          <div>
            <CustomSelect
              label="Polo de Origem *"
              options={opcoesPolo}
              value={poloId}
              disabled={opcoesPolo.length <= 1}
              onChange={(v) => setPoloId(v)}
            />
            <Erro id={ids("polo_id").erro} texto={errosCampo.polo_id} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor={ids("aluno_cpf").campo}
              className="block text-xs font-bold text-texto mb-1.5"
            >
              CPF do Aluno <span className="text-texto-suave font-normal">(opcional)</span>
            </label>
            <input
              {...aria("aluno_cpf")}
              type="text"
              inputMode="numeric"
              value={alunoCpf}
              onChange={(e) => {
                setAlunoCpf(formatarCpf(e.target.value));
                limparErro("aluno_cpf");
              }}
              placeholder="000.000.000-00"
              maxLength={14}
              className={`${campoClasse(errosCampo.aluno_cpf)} font-mono tabular-nums`}
            />
            <Erro id={ids("aluno_cpf").erro} texto={errosCampo.aluno_cpf} />
          </div>
          <div>
            <label
              htmlFor={ids("aluno_ra").campo}
              className="block text-xs font-bold text-texto mb-1.5"
            >
              RA / Matrícula <span className="text-texto-suave font-normal">(opcional)</span>
            </label>
            <input
              {...aria("aluno_ra")}
              type="text"
              value={alunoRa}
              onChange={(e) => {
                setAlunoRa(e.target.value);
                setConfirmarRa(false);
                limparErro("aluno_ra");
              }}
              placeholder="Matrícula do aluno (não o CPF)"
              maxLength={50}
              className={`${campoClasse(errosCampo.aluno_ra)} font-mono tabular-nums`}
            />
            <Erro id={ids("aluno_ra").erro} texto={errosCampo.aluno_ra} />
            {errosCampo.aluno_ra?.includes("confirmação") && (
              <label className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-texto">
                <input
                  type="checkbox"
                  checked={confirmarRa}
                  onChange={(e) => setConfirmarRa(e.target.checked)}
                />
                Confirmo que este número é o RA do aluno
              </label>
            )}
          </div>
          <div>
            <label
              htmlFor={ids("contato_telefone").campo}
              className="block text-xs font-bold text-texto mb-1.5"
            >
              Telefone de Contato{" "}
              <span className="text-texto-suave font-normal">(opcional, com DDD)</span>
            </label>
            <input
              {...aria("contato_telefone")}
              type="tel"
              inputMode="tel"
              value={contatoTelefone}
              onChange={(e) => {
                setContatoTelefone(e.target.value);
                limparErro("contato_telefone");
              }}
              onBlur={() => {
                const d = contatoTelefone.replace(/\D/g, "");
                if (d.length === 10 || d.length === 11) setContatoTelefone(formatarTelefone(d));
              }}
              placeholder="(94) 99999-9999 — deixe vazio se não houver"
              maxLength={20}
              className={`${campoClasse(errosCampo.contato_telefone)} font-mono tabular-nums`}
            />
            <Erro id={ids("contato_telefone").erro} texto={errosCampo.contato_telefone} />
          </div>
        </div>
      </fieldset>

      {/* Seção 2: Prazo e situação */}
      <fieldset className="rounded-xl border border-borda bg-superficie p-6 space-y-4 shadow-xs">
        <legend className="font-heading text-sm font-bold text-texto px-1">
          Controle de Prazo e Situação
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CustomDatePicker
            label="Data de Abertura"
            required
            value={dataSolicitacao}
            maxDate={hoje}
            onChange={(val) => {
              setDataSolicitacao(val);
              limparErro("data_solicitacao");
            }}
            erro={errosCampo.data_solicitacao}
            descricao="Dia em que a solicitação foi registrada na plataforma externa (não pode ser futura)."
          />

          <div>
            <span className="block text-xs font-bold text-texto mb-1.5">Prazo Limite *</span>
            <div
              role="radiogroup"
              aria-label="Forma de definir o prazo"
              className="flex gap-2 mb-2"
            >
              {(["automatico", "manual"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={prazoModo === m}
                  onClick={() => {
                    setPrazoModo(m);
                    if (m === "manual" && !prazoManual) setPrazoManual(prazoCalculado);
                    limparErro("prazo");
                  }}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-bold transition ${
                    prazoModo === m
                      ? "border-acento bg-acento/10 text-acento"
                      : "border-borda text-texto-suave hover:bg-fundo"
                  }`}
                >
                  {m === "automatico"
                    ? `Automático (${REGRA_SLA.diasUteisPadrao} dias úteis)`
                    : "Ajuste manual"}
                </button>
              ))}
            </div>
            {prazoModo === "automatico" ? (
              <div className="rounded-lg border border-borda bg-fundo px-3 py-2 text-xs">
                <span className="font-mono font-semibold tabular-nums">
                  {formatarDataCivil(prazoCalculado)}
                </span>
                <p className="mt-1 text-[11px] text-texto-suave">
                  {REGRA_SLA.diasUteisPadrao} dias úteis após a abertura (o dia da abertura não
                  conta; sábados, domingos e feriados cadastrados não contam).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <CustomDatePicker
                  value={prazoManual}
                  minDate={dataSolicitacao}
                  onChange={(v) => {
                    setPrazoManual(v);
                    limparErro("prazo");
                  }}
                  erro={errosCampo.prazo}
                  descricao={`Prazo calculado pela regra: ${formatarDataCivil(prazoCalculado)}.`}
                />
                {exigeJustificativaPrazo && (
                  <div>
                    <label
                      htmlFor={ids("prazo_justificativa").campo}
                      className="block text-[11px] font-bold text-texto mb-1"
                    >
                      Justificativa do ajuste{" "}
                      <span className="text-erro" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <textarea
                      {...aria("prazo_justificativa")}
                      rows={2}
                      value={prazoJustificativa}
                      onChange={(e) => {
                        setPrazoJustificativa(e.target.value);
                        limparErro("prazo_justificativa");
                      }}
                      placeholder="Por que o prazo difere do calculado? (fica registrado na auditoria)"
                      className={campoClasse(errosCampo.prazo_justificativa)}
                    />
                    <Erro
                      id={ids("prazo_justificativa").erro}
                      texto={errosCampo.prazo_justificativa}
                    />
                  </div>
                )}
                {editando &&
                  chamadoInicial?.prazo_ajuste_manual &&
                  !prazoAlterado &&
                  chamadoInicial.prazo_ajuste_justificativa && (
                    <p className="text-[11px] text-texto-suave">
                      Ajustado por {chamadoInicial.prazo_ajustado_por_nome ?? "—"}: “
                      {chamadoInicial.prazo_ajuste_justificativa}”
                    </p>
                  )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <CustomSelect
              label="Situação *"
              options={opcoesSituacao}
              value={situacao}
              onChange={(val) => {
                setSituacao(val as Situacao);
                limparErro("situacao");
              }}
            />
            <Erro id={ids("situacao").erro} texto={errosCampo.situacao} />
          </div>
          <div>
            <CustomSelect
              label="Prioridade *"
              options={[
                { value: "normal", label: "Normal" },
                { value: "priorizar", label: "Priorizar" },
              ]}
              value={prioridade}
              onChange={(val) => setPrioridade(val as "normal" | "priorizar")}
            />
          </div>
        </div>

        {situacao === "concluido" && (
          <div>
            <label
              htmlFor={ids("resolucao").campo}
              className="block text-xs font-bold text-texto mb-1.5"
            >
              Resolução{" "}
              <span className="text-erro" aria-hidden="true">
                *
              </span>
            </label>
            <textarea
              {...aria("resolucao")}
              rows={2}
              value={resolucao}
              onChange={(e) => {
                setResolucao(e.target.value);
                limparErro("resolucao");
              }}
              placeholder="O que foi feito para atender à solicitação?"
              className={campoClasse(errosCampo.resolucao)}
            />
            <Erro id={ids("resolucao").erro} texto={errosCampo.resolucao} />
          </div>
        )}

        {situacao === "encerrado" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <CustomSelect
                label="Motivo do encerramento sem solução *"
                options={opcoesEncerramento}
                value={motivoEncerramento}
                placeholder="Selecione..."
                onChange={(v) => {
                  setMotivoEncerramento(v);
                  limparErro("motivo_encerramento");
                }}
              />
              <Erro id={ids("motivo_encerramento").erro} texto={errosCampo.motivo_encerramento} />
            </div>
            <div>
              <label
                htmlFor={ids("justificativa_situacao").campo}
                className="block text-xs font-bold text-texto mb-1.5"
              >
                Detalhes {motivoEncerramento === "outro" && <span className="text-erro">*</span>}
              </label>
              <textarea
                {...aria("justificativa")}
                id={ids("justificativa_situacao").campo}
                rows={2}
                value={justificativaSituacao}
                onChange={(e) => {
                  setJustificativaSituacao(e.target.value);
                  limparErro("justificativa");
                }}
                className={campoClasse(errosCampo.justificativa)}
              />
              <Erro id={ids("justificativa").erro} texto={errosCampo.justificativa} />
            </div>
          </div>
        )}

        {ehReabertura && (
          <div>
            <label
              htmlFor={ids("reabertura").campo}
              className="block text-xs font-bold text-texto mb-1.5"
            >
              Justificativa da reabertura{" "}
              <span className="text-erro" aria-hidden="true">
                *
              </span>
            </label>
            <textarea
              {...aria("justificativa")}
              id={ids("reabertura").campo}
              rows={2}
              value={justificativaSituacao}
              onChange={(e) => {
                setJustificativaSituacao(e.target.value);
                limparErro("justificativa");
              }}
              placeholder="Por que o chamado precisa ser reaberto?"
              className={campoClasse(errosCampo.justificativa)}
            />
            <Erro id={ids("justificativa").erro} texto={errosCampo.justificativa} />
          </div>
        )}

        <div>
          <label
            htmlFor={ids("descricao").campo}
            className="block text-xs font-bold text-texto mb-1.5"
          >
            Descrição do Chamado{" "}
            <span className="text-erro" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            {...aria("descricao")}
            rows={3}
            required
            value={descricao}
            onChange={(e) => {
              setDescricao(e.target.value);
              limparErro("descricao");
            }}
            placeholder="Detalhes ou contexto da solicitação aberta na plataforma externa..."
            className={campoClasse(errosCampo.descricao)}
          />
          <Erro id={ids("descricao").erro} texto={errosCampo.descricao} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label
              htmlFor={ids("proxima_acao").campo}
              className="block text-xs font-bold text-texto mb-1.5"
            >
              Próxima ação prevista <span className="text-texto-suave font-normal">(opcional)</span>
            </label>
            <input
              {...aria("proxima_acao")}
              type="text"
              value={proximaAcao}
              maxLength={500}
              onChange={(e) => setProximaAcao(e.target.value)}
              placeholder="Ex.: cobrar retorno do PAD"
              className={campoClasse(errosCampo.proxima_acao)}
            />
          </div>
          <CustomDatePicker
            label="Data da próxima ação"
            value={proximaAcaoEm}
            minDate={editando ? undefined : hoje}
            onChange={setProximaAcaoEm}
            erro={errosCampo.proxima_acao_em}
          />
        </div>
        <div>
          <label
            htmlFor={ids("status_externo").campo}
            className="block text-xs font-bold text-texto mb-1.5"
          >
            Status na plataforma externa (PAD){" "}
            <span className="text-texto-suave font-normal">
              (opcional; independe da situação interna)
            </span>
          </label>
          <input
            {...aria("status_externo")}
            type="text"
            value={statusExterno}
            maxLength={120}
            onChange={(e) => setStatusExterno(e.target.value)}
            placeholder="Ex.: Em análise no PAD"
            className={campoClasse()}
          />
        </div>
      </fieldset>

      {/* Seção 3: Anexos */}
      <fieldset className="rounded-xl border border-borda bg-superficie p-6 space-y-4 shadow-sm">
        <legend className="font-heading text-sm font-bold text-texto px-1 flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-acento" aria-hidden="true" /> Arquivos e Documentos
          Anexos
        </legend>
        <p className="text-[11px] font-semibold text-texto-suave">{DESCRICAO_TIPOS_ACEITOS}</p>
        <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-borda bg-fundo/70 p-6 text-center hover:border-acento focus-within:border-acento cursor-pointer transition shadow-inner">
          <UploadCloud className="h-8 w-8 text-texto-suave mb-2" aria-hidden="true" />
          <span className="text-xs font-bold text-texto">
            Clique para selecionar um ou mais arquivos do computador
          </span>
          <span className="text-[11px] text-texto-suave mt-0.5">
            Comprovantes, protocolos escaneados e declarações.
          </span>
          <input
            type="file"
            multiple
            accept={EXTENSOES_ACEITAS.join(",")}
            onChange={(e) => {
              if (e.target.files?.length)
                setArquivosSelecionados((prev) => [...prev, ...Array.from(e.target.files!)]);
              limparErro("arquivos");
            }}
            className="sr-only"
          />
        </label>
        <Erro id={ids("arquivos").erro} texto={errosCampo.arquivos} />
        {arquivosSelecionados.length > 0 && (
          <ul className="divide-y divide-borda/60 rounded-lg border border-borda bg-fundo">
            {arquivosSelecionados.map((arq, idx) => (
              <li
                key={`${arq.name}-${idx}`}
                className="flex items-center justify-between p-2.5 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 text-acento shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-texto truncate">{arq.name}</span>
                  <span className="text-[11px] font-mono text-texto-suave">
                    ({(arq.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setArquivosSelecionados((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-texto-suave hover:text-erro rounded-md p-1 transition"
                  aria-label={`Remover ${arq.name} da lista`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {/* Seção 4: Vínculo */}
      <fieldset className="rounded-xl border border-borda bg-superficie p-6 space-y-4 shadow-sm">
        <legend className="font-heading text-sm font-bold text-texto px-1 flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-acento" aria-hidden="true" /> Vínculo com Protocolo
          Anterior (Reincidência)
        </legend>
        {chamadoVinculado ? (
          <div className="flex items-center justify-between rounded-lg border border-acento/40 bg-acento/10 p-3.5 text-xs shadow-xs">
            <div className="flex items-center gap-2 font-medium text-texto">
              <span>Vinculado ao protocolo anterior:</span>
              <strong className="font-mono text-acento font-bold">
                {chamadoVinculado.protocolo}
              </strong>
              <span className="text-texto-suave">({chamadoVinculado.aluno_nome})</span>
            </div>
            <button
              type="button"
              onClick={() => setChamadoVinculado(null)}
              className="font-bold text-xs text-erro hover:underline"
            >
              Remover vínculo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-texto-suave">
              Se este chamado for a reabertura ou continuação de um problema já tratado, busque o
              protocolo anterior.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <label htmlFor={ids("vinculo").campo} className="sr-only">
                  Buscar protocolo anterior
                </label>
                <input
                  id={ids("vinculo").campo}
                  type="search"
                  value={buscaVinculo}
                  onChange={(e) => {
                    setBuscaVinculo(e.target.value);
                    setBuscaFeita(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBuscarVinculo();
                    }
                  }}
                  placeholder="Buscar por protocolo ou nome do aluno..."
                  className={`${campoClasse()} pl-9`}
                />
                <Search
                  className="absolute left-3 top-2.5 h-4 w-4 text-texto-suave"
                  aria-hidden="true"
                />
              </div>
              <button
                type="button"
                onClick={handleBuscarVinculo}
                disabled={buscandoVinculo}
                className="rounded-lg border border-borda bg-fundo px-4 py-2 text-xs font-bold text-texto hover:bg-superficie shadow-xs transition"
              >
                {buscandoVinculo ? "Buscando..." : "Buscar"}
              </button>
            </div>
            {buscaFeita && resultadosVinculo.length === 0 && (
              <p role="status" className="text-[11px] text-texto-suave">
                Nenhum chamado encontrado para “{buscaVinculo}”.
              </p>
            )}
            {resultadosVinculo.length > 0 && (
              <ul className="divide-y divide-borda/60 rounded-lg border border-borda bg-fundo max-h-48 overflow-y-auto">
                {resultadosVinculo.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between p-3 text-xs hover:bg-superficie transition"
                  >
                    <div>
                      <span className="font-mono font-bold text-acento mr-2">{r.protocolo}</span>
                      <span className="font-semibold text-texto mr-2">{r.aluno_nome}</span>
                      <span className="text-[11px] text-texto-suave font-mono">
                        ({formatarDataCivil(r.data_solicitacao)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setChamadoVinculado(r);
                        setResultadosVinculo([]);
                        setBuscaVinculo("");
                      }}
                      className="rounded-md bg-acento px-3 py-1 text-xs font-bold text-white hover:bg-acento-hover shadow-xs transition"
                    >
                      Vincular
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </fieldset>

      {/* Seção 5: Observações */}
      <fieldset className="rounded-xl border border-borda bg-superficie p-6 space-y-3 shadow-sm">
        <legend className="font-heading text-sm font-bold text-texto px-1">
          Observações Internas (Opcional)
        </legend>
        <label htmlFor={ids("observacao").campo} className="sr-only">
          Observações internas
        </label>
        <textarea
          id={ids("observacao").campo}
          rows={3}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Notas internas da equipe, instruções ou tratativas do atendimento..."
          className={campoClasse()}
        />
        <p className="text-[11px] text-texto-suave">
          Para registrar contatos e retornos com data e autor, use “Registrar interação” na página
          do chamado.
        </p>
      </fieldset>

      <div className="flex items-center justify-end gap-3 border-t border-borda pt-4">
        <Link
          href={voltarPara}
          className="rounded-lg border border-borda bg-superficie px-4 py-2.5 text-xs font-bold text-texto hover:bg-fundo shadow-xs transition"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-acento px-6 py-2.5 text-xs font-bold text-white hover:bg-acento-hover disabled:opacity-50 shadow-md transition"
        >
          {isPending
            ? "Salvando..."
            : chamadoInicial
              ? "Salvar Alterações"
              : "Concluir Abertura do Chamado"}
        </button>
      </div>
    </form>
  );
}
