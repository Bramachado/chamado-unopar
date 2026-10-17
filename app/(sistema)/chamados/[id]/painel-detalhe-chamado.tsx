"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  type Chamado,
  type Perfil,
  type ArquivoChamado,
  type EventoChamado,
} from "@/types/database";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Paperclip,
  FileText,
  Download,
  Plus,
  Link as LinkIcon,
  History,
  AlertCircle,
  Clock,
  UserCheck,
  MessageSquarePlus,
  ArrowRightLeft,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import {
  anexarArquivoAction,
  atribuirResponsavelAction,
  excluirArquivoAction,
  excluirChamadoAction,
  marcarComoTesteAction,
  registrarInteracaoAction,
} from "../actions";
import { CpfDisplay } from "@/components/ui/cpf-display";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { SituacaoBadge, PrazoBadge } from "@/components/ui/situacao-badge";
import { formatarTelefone } from "@/lib/utils/telefone";
import { formatarDataCivil, formatarInstante, hojeCivil } from "@/lib/datas";
import {
  ehFinal,
  ehPendente,
  MOTIVOS_ENCERRAMENTO,
  ROTULO_SITUACAO,
  ehSituacao,
} from "@/lib/chamados/situacoes";
import { DESCRICAO_TIPOS_ACEITOS, EXTENSOES_ACEITAS } from "@/lib/storage/validacao-arquivo";

type ChamadoDetalhe = Chamado & { motivo_codigo?: string | null; motivo_nome?: string | null };
interface Vinculo {
  id: string;
  protocolo: string;
  aluno_nome: string;
  situacao: string;
  data_solicitacao: string;
}
interface LogTecnico {
  id: number;
  operacao: string;
  campos_alterados: string[] | null;
  usuario_nome?: string | null;
  ip?: string | null;
  criado_em: string;
}

interface Props {
  chamado: ChamadoDetalhe;
  arquivos: ArquivoChamado[];
  chamadoAnterior: Vinculo | null;
  chamadosPosteriores: Vinculo[];
  responsaveis: { id: string; nome_completo: string; papel: string }[];
  eventos: EventoChamado[];
  logs: LogTecnico[];
  perfilAtual: Perfil;
  voltarPara: string;
}

const ROTULO_EVENTO: Record<string, string> = {
  criacao: "Abertura",
  situacao: "Mudança de situação",
  reabertura: "Reabertura",
  atribuicao: "Atribuição",
  transferencia: "Transferência",
  interacao: "Interação",
  ajuste_prazo: "Ajuste de prazo",
  consolidacao_motivo: "Consolidação de motivo",
  marcacao_teste: "Marcação de teste",
  edicao: "Edição",
};

const rotuloSit = (s?: string | null) => (s && ehSituacao(s) ? ROTULO_SITUACAO[s] : (s ?? "—"));

function Campo({
  rotulo,
  children,
  largo = false,
}: {
  rotulo: string;
  children: React.ReactNode;
  largo?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-borda/60 bg-fundo p-3 ${largo ? "sm:col-span-2" : ""}`}
    >
      <dt className="font-semibold text-texto-suave block text-[11px]">{rotulo}</dt>
      <dd className="text-texto font-bold block mt-0.5">{children}</dd>
    </div>
  );
}

function Modal({
  titulo,
  aoFechar,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(e) => e.key === "Escape" && aoFechar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-lg rounded-xl border border-borda bg-fundo p-6 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-borda pb-3">
          <h3 className="font-heading text-sm font-bold text-texto">{titulo}</h3>
          <button
            type="button"
            onClick={aoFechar}
            className="text-texto-suave hover:text-texto text-sm font-bold"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const campo =
  "w-full rounded-md border border-borda bg-superficie px-3 py-2 text-xs text-texto focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20";

export function PainelDetalheChamado({
  chamado,
  arquivos,
  chamadoAnterior,
  chamadosPosteriores,
  responsaveis,
  eventos,
  logs,
  perfilAtual,
  voltarPara,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<
    null | "anexo" | "excluir" | "excluirAnexo" | "responsavel" | "interacao" | "teste"
  >(null);
  const [anexoAlvo, setAnexoAlvo] = useState<ArquivoChamado | null>(null);
  const [descricaoAnexo, setDescricaoAnexo] = useState("");
  const [arquivosParaUpload, setArquivosParaUpload] = useState<File[]>([]);
  const [novoResponsavel, setNovoResponsavel] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [textoInteracao, setTextoInteracao] = useState("");
  const [proximaAcao, setProximaAcao] = useState(chamado.proxima_acao ?? "");
  const [proximaAcaoEm, setProximaAcaoEm] = useState(chamado.proxima_acao_em ?? "");
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const hoje = hojeCivil();
  const ehAdmin = perfilAtual.papel === "admin";
  const podeExcluir = ehAdmin || chamado.criado_por === perfilAtual.id;
  const pendente = ehPendente(chamado.situacao);
  const comVolta = (url: string) => `${url}?voltar=${encodeURIComponent(voltarPara)}`;

  const fechar = () => {
    setModal(null);
    setMensagemErro(null);
    setJustificativa("");
  };

  const executar = (
    acao: () => Promise<{ sucesso: boolean; erro?: string }>,
    aoConcluir?: () => void
  ) =>
    startTransition(async () => {
      setMensagemErro(null);
      const r = await acao();
      if (!r.sucesso) {
        setMensagemErro(r.erro ?? "Não foi possível concluir a ação.");
        return;
      }
      fechar();
      aoConcluir?.();
      router.refresh();
    });

  const teveEdicao = chamado.atualizado_em && chamado.atualizado_em !== chamado.criado_em;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={voltarPara}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto transition hover:bg-fundo"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar para chamados</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={comVolta(`/chamados/${chamado.id}/editar`)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white transition hover:bg-acento-hover"
          >
            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Editar / mudar situação</span>
          </Link>
          {podeExcluir && (
            <button
              type="button"
              onClick={() => setModal("excluir")}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-erro/40 bg-erro-fundo text-xs font-semibold text-erro transition hover:bg-erro hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Excluir</span>
            </button>
          )}
        </div>
      </div>

      {mensagemErro && !modal && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-erro/40 bg-erro-fundo p-4 text-xs font-semibold text-erro"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{mensagemErro}</span>
        </div>
      )}

      <section
        className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-5"
        aria-labelledby="titulo-chamado"
      >
        <div className="border-b border-borda pb-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1
              id="titulo-chamado"
              className="font-mono text-xl font-extrabold text-texto tabular-nums"
            >
              {chamado.protocolo}
            </h1>
            <SituacaoBadge situacao={chamado.situacao} className="text-xs" />
            {pendente && <PrazoBadge prazo={chamado.prazo} hoje={hoje} />}
            {chamado.prioridade === "priorizar" && (
              <span className="rounded-md border border-alerta/50 bg-alerta-fundo px-2.5 py-0.5 text-[11px] font-bold text-alerta">
                Priorizar
              </span>
            )}
            {chamado.eh_teste && (
              <span className="rounded-md border border-borda bg-fundo px-2.5 py-0.5 text-[11px] font-bold text-texto-suave">
                Registro de teste (fora dos indicadores)
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4 text-xs text-texto-suave">
            <div className="flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-acento" aria-hidden="true" />
              <span>
                Criado por{" "}
                <strong className="text-texto font-semibold">
                  {chamado.criado_por_nome ?? "—"}
                </strong>{" "}
                em {formatarInstante(chamado.criado_em)}
              </span>
            </div>
            {teveEdicao && (
              <div className="flex items-center gap-1 rounded bg-fundo px-2 py-0.5 border border-borda/60 text-[11px]">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>
                  Última alteração por{" "}
                  <strong className="text-texto font-semibold">
                    {chamado.atualizado_por_nome ?? "—"}
                  </strong>{" "}
                  em {formatarInstante(chamado.atualizado_em)}
                </span>
              </div>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <Campo rotulo="Aluno(a) solicitante" largo>
            <span className="text-sm">{chamado.aluno_nome}</span>
          </Campo>
          <Campo rotulo="Polo de origem">
            {chamado.polo_nome ? `${chamado.polo_nome} (${chamado.polo_cidade})` : "Não vinculado"}
          </Campo>
          <Campo rotulo="CPF do aluno">
            <CpfDisplay cpf={chamado.aluno_cpf} />
          </Campo>
          <Campo rotulo="RA / matrícula">
            <span className="font-mono tabular-nums">{chamado.aluno_ra || "Não informado"}</span>
          </Campo>
          <Campo rotulo="Telefone de contato">
            <span className="font-mono tabular-nums">
              {chamado.contato_telefone
                ? formatarTelefone(chamado.contato_telefone)
                : "Não informado"}
            </span>
          </Campo>
          <Campo rotulo="Motivo" largo>
            {chamado.motivo_codigo
              ? `${chamado.motivo_codigo} — ${chamado.motivo_nome}`
              : "Não categorizado"}
          </Campo>
          <Campo rotulo="Abertura / prazo">
            <span className="font-mono tabular-nums">
              {formatarDataCivil(chamado.data_solicitacao)} → {formatarDataCivil(chamado.prazo)}
            </span>
            {chamado.prazo_ajuste_manual && (
              <span className="mt-1 block text-[11px] font-medium text-texto-suave">
                Prazo ajustado manualmente
                {chamado.prazo_ajustado_por_nome ? ` por ${chamado.prazo_ajustado_por_nome}` : ""}
                {chamado.prazo_calculado
                  ? ` (calculado: ${formatarDataCivil(chamado.prazo_calculado)})`
                  : ""}
                {chamado.prazo_ajuste_justificativa
                  ? ` — “${chamado.prazo_ajuste_justificativa}”`
                  : ""}
              </span>
            )}
          </Campo>
          <Campo rotulo="Responsável atual">
            {chamado.responsavel_nome ?? "—"}
            {chamado.responsavel_ativo === false && (
              <span className="mt-1 block text-[11px] font-semibold text-erro">
                Conta desativada — reatribua este chamado.
              </span>
            )}
          </Campo>
          <Campo rotulo="Última interação">{formatarInstante(chamado.ultima_interacao_em)}</Campo>
          <Campo rotulo="Próxima ação prevista">
            {chamado.proxima_acao ? (
              <>
                {chamado.proxima_acao}
                {chamado.proxima_acao_em && (
                  <span className="block text-[11px] text-texto-suave">
                    até {formatarDataCivil(chamado.proxima_acao_em)}
                  </span>
                )}
              </>
            ) : (
              "—"
            )}
          </Campo>
          <Campo rotulo="Status na plataforma externa">{chamado.status_externo || "—"}</Campo>
          {ehFinal(chamado.situacao) && (
            <Campo
              rotulo={chamado.situacao === "concluido" ? "Resolução" : "Motivo do encerramento"}
              largo
            >
              {chamado.situacao === "concluido"
                ? chamado.resolucao || "Não registrada (registro anterior à exigência)"
                : chamado.motivo_encerramento
                  ? (MOTIVOS_ENCERRAMENTO[
                      chamado.motivo_encerramento as keyof typeof MOTIVOS_ENCERRAMENTO
                    ] ?? chamado.motivo_encerramento)
                  : "Não registrado (registro anterior à exigência)"}
              {chamado.data_conclusao && (
                <span className="block text-[11px] text-texto-suave">
                  em {formatarInstante(chamado.data_conclusao)}
                </span>
              )}
            </Campo>
          )}
        </dl>

        {chamado.descricao && (
          <div className="border-t border-borda pt-3 text-xs space-y-1">
            <h2 className="font-bold text-texto">Descrição do chamado</h2>
            <p className="text-texto whitespace-pre-wrap bg-fundo rounded-lg border border-borda p-3.5 leading-relaxed">
              {chamado.descricao}
            </p>
          </div>
        )}
        {chamado.observacao && (
          <div className="border-t border-borda pt-3 text-xs space-y-1">
            <h2 className="font-bold text-texto">Observações internas da equipe</h2>
            <p className="text-texto whitespace-pre-wrap bg-fundo rounded-lg border border-borda p-3.5 leading-relaxed">
              {chamado.observacao}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-borda pt-4">
          {pendente && (
            <button
              type="button"
              onClick={() => setModal("responsavel")}
              className="inline-flex items-center gap-1.5 rounded-md border border-borda bg-fundo px-3 py-1.5 text-xs font-bold text-texto hover:bg-superficie"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-acento" aria-hidden="true" /> Transferir
              responsável
            </button>
          )}
          <button
            type="button"
            onClick={() => setModal("interacao")}
            className="inline-flex items-center gap-1.5 rounded-md border border-borda bg-fundo px-3 py-1.5 text-xs font-bold text-texto hover:bg-superficie"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-acento" aria-hidden="true" /> Registrar
            interação
          </button>
          {ehAdmin && (
            <button
              type="button"
              onClick={() => setModal("teste")}
              className="inline-flex items-center gap-1.5 rounded-md border border-borda bg-fundo px-3 py-1.5 text-xs font-bold text-texto-suave hover:bg-superficie"
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />{" "}
              {chamado.eh_teste ? "Desmarcar teste" : "Marcar como teste"}
            </button>
          )}
        </div>
      </section>

      {/* Anexos */}
      <section
        className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-4"
        aria-labelledby="titulo-anexos"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-borda pb-3">
          <h2
            id="titulo-anexos"
            className="font-heading text-sm font-bold text-texto flex items-center gap-2"
          >
            <Paperclip className="h-4 w-4 text-acento" aria-hidden="true" /> Arquivos e comprovantes
            ({arquivos.length})
          </h2>
          <button
            type="button"
            onClick={() => setModal("anexo")}
            className="inline-flex items-center gap-1.5 rounded-md border border-borda bg-fundo px-3 py-1.5 text-xs font-bold text-texto hover:bg-superficie shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 text-acento" aria-hidden="true" /> Anexar arquivo
          </button>
        </div>
        {arquivos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda bg-fundo/40 p-6 text-center text-xs text-texto-suave">
            Nenhum documento anexado a este protocolo.
          </p>
        ) : (
          <ul className="divide-y divide-borda/60 rounded-lg border border-borda bg-fundo overflow-hidden shadow-xs">
            {arquivos.map((arq) => (
              <li
                key={arq.id}
                className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between text-xs"
              >
                <div className="flex items-start gap-3 truncate">
                  <FileText className="h-4 w-4 text-acento mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="truncate">
                    <div className="font-bold text-texto truncate">{arq.nome_original}</div>
                    <div className="text-[11px] text-texto-suave">
                      Anexado por{" "}
                      <strong className="text-texto font-medium">
                        {arq.criado_por_nome ?? "—"}
                      </strong>{" "}
                      em {formatarInstante(arq.criado_em)}
                      {arq.tamanho_bytes ? ` • ${Math.round(arq.tamanho_bytes / 1024)} KB` : ""}
                    </div>
                    {arq.descricao && (
                      <div className="text-[11px] text-texto font-medium mt-0.5 italic">
                        “{arq.descricao}”
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <a
                    href={`/api/anexos/${arq.id}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 rounded-md border border-borda bg-superficie px-3 py-1.5 text-xs font-bold text-texto hover:bg-fundo shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" /> Abrir
                  </a>
                  {(ehAdmin || arq.criado_por === perfilAtual.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnexoAlvo(arq);
                        setModal("excluirAnexo");
                      }}
                      className="rounded-md border border-erro/30 bg-erro-fundo p-1.5 text-erro hover:bg-erro hover:text-white shadow-xs"
                      aria-label={`Remover anexo ${arq.nome_original}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Vínculos */}
      <section
        className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-3"
        aria-labelledby="titulo-vinculos"
      >
        <h2
          id="titulo-vinculos"
          className="font-heading text-sm font-bold text-texto border-b border-borda pb-2 flex items-center gap-2"
        >
          <LinkIcon className="h-4 w-4 text-acento" aria-hidden="true" /> Vínculos e continuidade
        </h2>
        {[
          ...(chamadoAnterior ? [{ ...chamadoAnterior, rel: "Anterior" }] : []),
          ...chamadosPosteriores.map((p) => ({ ...p, rel: "Posterior" })),
        ].map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between rounded-lg border border-borda bg-fundo p-3 text-xs"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-texto-suave">{v.rel}:</span>
              <Link
                href={`/chamados/${v.id}`}
                className="font-mono font-bold text-acento hover:underline"
              >
                {v.protocolo}
              </Link>
              <span className="text-texto font-medium">{v.aluno_nome}</span>
              <SituacaoBadge situacao={v.situacao} />
            </div>
            <span className="font-mono text-texto-suave tabular-nums">
              {formatarDataCivil(v.data_solicitacao)}
            </span>
          </div>
        ))}
        {!chamadoAnterior && chamadosPosteriores.length === 0 && (
          <p className="text-xs text-texto-suave">Nenhum chamado vinculado.</p>
        )}
      </section>

      {/* Histórico estruturado */}
      <section
        className="rounded-xl border border-borda bg-superficie p-6 shadow-sm space-y-3"
        aria-labelledby="titulo-historico"
      >
        <h2
          id="titulo-historico"
          className="font-heading text-sm font-bold text-texto border-b border-borda pb-2 flex items-center gap-2"
        >
          <History className="h-4 w-4 text-acento" aria-hidden="true" /> Histórico do atendimento
        </h2>
        {eventos.length === 0 ? (
          <p className="text-xs text-texto-suave">
            Nenhum evento estruturado registrado (chamados anteriores à atualização mostram apenas a
            auditoria técnica).
          </p>
        ) : (
          <ol className="space-y-2.5">
            {eventos.map((ev) => (
              <li
                key={ev.id}
                className="rounded-lg border border-borda bg-fundo p-3 text-xs space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-texto">
                    {ROTULO_EVENTO[ev.tipo] ?? ev.tipo}
                    {ev.situacao_nova && ev.tipo !== "criacao" && (
                      <span className="font-medium text-texto-suave">
                        {" "}
                        · {rotuloSit(ev.situacao_anterior)} → {rotuloSit(ev.situacao_nova)}
                      </span>
                    )}
                    {ev.responsavel_novo_nome && (
                      <span className="font-medium text-texto-suave">
                        {" "}
                        · {ev.responsavel_anterior_nome ? `${ev.responsavel_anterior_nome} → ` : ""}
                        {ev.responsavel_novo_nome}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-texto-suave tabular-nums">
                    {formatarInstante(ev.criado_em)} · {ev.criado_por_nome ?? "—"}
                  </span>
                </div>
                {ev.texto && <p className="text-texto whitespace-pre-wrap">{ev.texto}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {ehAdmin && logs.length > 0 && (
        <details className="rounded-xl border border-borda bg-superficie p-6 shadow-sm">
          <summary className="cursor-pointer font-heading text-sm font-bold text-texto flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-acento" aria-hidden="true" /> Auditoria técnica (
            {logs.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {logs.map((l) => (
              <li
                key={l.id}
                className="rounded-lg border border-borda bg-fundo p-3 text-[11px] space-y-1"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-bold text-texto">
                    {l.operacao} por {l.usuario_nome ?? "sistema/manual"} · IP{" "}
                    {l.ip ?? "não registrado"}
                  </span>
                  <span className="font-mono text-texto-suave">
                    {formatarInstante(l.criado_em, { segundos: true })}
                  </span>
                </div>
                {l.campos_alterados && l.operacao === "UPDATE" && (
                  <div className="font-mono text-texto-suave">
                    Campos: {l.campos_alterados.join(", ")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {modal === "anexo" && (
        <Modal titulo={`Anexar arquivos ao chamado ${chamado.protocolo}`} aoFechar={fechar}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData();
              fd.set("chamado_id", chamado.id);
              fd.set("descricao", descricaoAnexo);
              arquivosParaUpload.forEach((a) => fd.append("arquivos", a));
              executar(
                () => anexarArquivoAction(fd),
                () => {
                  setArquivosParaUpload([]);
                  setDescricaoAnexo("");
                }
              );
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="anexo-arquivos" className="block text-xs font-bold text-texto mb-1.5">
                Arquivos *
              </label>
              <input
                id="anexo-arquivos"
                type="file"
                required
                multiple
                accept={EXTENSOES_ACEITAS.join(",")}
                onChange={(e) => setArquivosParaUpload(Array.from(e.target.files ?? []))}
                className={campo}
              />
              <p className="mt-1 text-[11px] text-texto-suave">{DESCRICAO_TIPOS_ACEITOS}</p>
            </div>
            <div>
              <label
                htmlFor="anexo-descricao"
                className="block text-xs font-bold text-texto mb-1.5"
              >
                Descrição (opcional)
              </label>
              <input
                id="anexo-descricao"
                type="text"
                value={descricaoAnexo}
                maxLength={255}
                onChange={(e) => setDescricaoAnexo(e.target.value)}
                className={campo}
              />
            </div>
            {mensagemErro && (
              <p role="alert" className="text-xs font-semibold text-erro">
                {mensagemErro}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-borda pt-3">
              <button
                type="button"
                onClick={fechar}
                className="rounded-md border border-borda bg-superficie px-4 py-2 text-xs font-bold text-texto"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || arquivosParaUpload.length === 0}
                className="rounded-md bg-acento px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {isPending ? "Enviando..." : "Salvar anexos"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "responsavel" && (
        <Modal titulo="Transferir responsável" aoFechar={fechar}>
          <div className="space-y-3 text-xs">
            <p className="text-texto-suave">
              Responsável atual:{" "}
              <strong className="text-texto">{chamado.responsavel_nome ?? "—"}</strong>. O criador
              do chamado não muda.
            </p>
            <div>
              <label htmlFor="novo-responsavel" className="block font-bold text-texto mb-1.5">
                Novo responsável *
              </label>
              <select
                id="novo-responsavel"
                value={novoResponsavel}
                onChange={(e) => setNovoResponsavel(e.target.value)}
                className={campo}
              >
                <option value="">Selecione...</option>
                {responsaveis
                  .filter((r) => r.id !== chamado.responsavel_id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome_completo}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="motivo-transferencia" className="block font-bold text-texto mb-1.5">
                Motivo da transferência *
              </label>
              <textarea
                id="motivo-transferencia"
                rows={2}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                className={campo}
              />
            </div>
            {mensagemErro && (
              <p role="alert" className="font-semibold text-erro">
                {mensagemErro}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-borda pt-3">
              <button
                type="button"
                onClick={fechar}
                className="rounded-md border border-borda bg-superficie px-4 py-2 font-bold text-texto"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending || !novoResponsavel}
                onClick={() =>
                  executar(() =>
                    atribuirResponsavelAction(chamado.id, novoResponsavel, justificativa)
                  )
                }
                className="rounded-md bg-acento px-5 py-2 font-bold text-white disabled:opacity-50"
              >
                {isPending ? "Salvando..." : "Transferir"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "interacao" && (
        <Modal titulo="Registrar interação" aoFechar={fechar}>
          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="texto-interacao" className="block font-bold text-texto mb-1.5">
                O que aconteceu? *
              </label>
              <textarea
                id="texto-interacao"
                rows={3}
                value={textoInteracao}
                onChange={(e) => setTextoInteracao(e.target.value)}
                placeholder="Ex.: Aluno enviou o comprovante por WhatsApp; PAD respondeu que está em análise."
                className={campo}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="proxima-acao" className="block font-bold text-texto mb-1.5">
                  Próxima ação (opcional)
                </label>
                <input
                  id="proxima-acao"
                  type="text"
                  value={proximaAcao}
                  maxLength={500}
                  onChange={(e) => setProximaAcao(e.target.value)}
                  className={campo}
                />
              </div>
              <CustomDatePicker
                label="Até quando"
                value={proximaAcaoEm}
                minDate={hoje}
                onChange={setProximaAcaoEm}
              />
            </div>
            <p className="text-[11px] text-texto-suave">
              Registrar uma interação não pausa o prazo do chamado.
            </p>
            {mensagemErro && (
              <p role="alert" className="font-semibold text-erro">
                {mensagemErro}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-borda pt-3">
              <button
                type="button"
                onClick={fechar}
                className="rounded-md border border-borda bg-superficie px-4 py-2 font-bold text-texto"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending || textoInteracao.trim().length < 3}
                onClick={() =>
                  executar(
                    () =>
                      registrarInteracaoAction(chamado.id, {
                        texto: textoInteracao,
                        proxima_acao: proximaAcao || null,
                        proxima_acao_em: proximaAcaoEm || null,
                      }),
                    () => setTextoInteracao("")
                  )
                }
                className="rounded-md bg-acento px-5 py-2 font-bold text-white disabled:opacity-50"
              >
                {isPending ? "Salvando..." : "Registrar"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "teste" && (
        <Modal
          titulo={
            chamado.eh_teste ? "Desmarcar registro de teste" : "Marcar como registro de teste"
          }
          aoFechar={fechar}
        >
          <div className="space-y-3 text-xs">
            <p className="text-texto-suave">
              Registros de teste ficam fora dos indicadores e do ranking, mas não são apagados. A
              marcação é auditada.
            </p>
            <label htmlFor="just-teste" className="block font-bold text-texto">
              Justificativa *
            </label>
            <textarea
              id="just-teste"
              rows={2}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className={campo}
            />
            {mensagemErro && (
              <p role="alert" className="font-semibold text-erro">
                {mensagemErro}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-borda pt-3">
              <button
                type="button"
                onClick={fechar}
                className="rounded-md border border-borda bg-superficie px-4 py-2 font-bold text-texto"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending || justificativa.trim().length < 10}
                onClick={() =>
                  executar(() =>
                    marcarComoTesteAction(chamado.id, !chamado.eh_teste, justificativa)
                  )
                }
                className="rounded-md bg-acento px-5 py-2 font-bold text-white disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "excluirAnexo" && anexoAlvo && (
        <Modal titulo="Remover anexo" aoFechar={fechar}>
          <p className="text-xs text-texto">
            Remover <strong>{anexoAlvo.nome_original}</strong>? O arquivo deixa de aparecer no
            chamado; o registro é mantido para auditoria.
          </p>
          {mensagemErro && (
            <p role="alert" className="text-xs font-semibold text-erro">
              {mensagemErro}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-borda pt-3 text-xs">
            <button
              type="button"
              onClick={fechar}
              className="rounded-md border border-borda bg-superficie px-4 py-2 font-bold text-texto"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => executar(() => excluirArquivoAction(anexoAlvo.id))}
              className="rounded-md bg-erro px-5 py-2 font-bold text-white disabled:opacity-50"
            >
              Remover
            </button>
          </div>
        </Modal>
      )}

      {modal === "excluir" && (
        <Modal titulo="Confirmar exclusão do chamado" aoFechar={fechar}>
          <p className="text-xs text-texto leading-relaxed">
            Excluir o chamado <strong>{chamado.protocolo}</strong>? Ele sai das listagens e dos
            indicadores; a exclusão é lógica e fica registrada na auditoria.
          </p>
          {mensagemErro && (
            <p role="alert" className="text-xs font-semibold text-erro">
              {mensagemErro}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-borda pt-3 text-xs">
            <button
              type="button"
              onClick={fechar}
              className="rounded-md border border-borda bg-superficie px-4 py-2 font-bold text-texto"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const r = await excluirChamadoAction(chamado.id);
                  if (r.sucesso) router.push(voltarPara);
                  else setMensagemErro(r.erro);
                })
              }
              className="rounded-md bg-erro px-5 py-2 font-bold text-white disabled:opacity-50"
            >
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
