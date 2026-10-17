"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, Loader2, CheckCircle2, Undo2, AlertCircle, X } from "lucide-react";
import { delegarParaAgenteAction, cancelarTarefaAgenteAction } from "../actions-agente";
import { REGEX_PROTOCOLO_PAD, type TarefaAgente } from "@/lib/agente/tarefas-tipos";

interface CartaoAgenteProps {
  chamadoId: string;
  protocolo: string;
  situacao: string;
  tarefa: TarefaAgente | null;
}

const quando = (iso?: string | null) =>
  iso ? format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "";

/** Botão "Delegar para agente" + acompanhamento da tarefa do Agente Prisma. */
export function CartaoAgente({ chamadoId, protocolo, situacao, tarefa }: CartaoAgenteProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalAberto, setModalAberto] = useState(false);
  const [instrucoes, setInstrucoes] = useState("");
  const [faltas, setFaltas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const ativa = tarefa?.status === "pendente" || tarefa?.status === "em_execucao";
  const temProtocoloPad = REGEX_PROTOCOLO_PAD.test((protocolo || "").trim().toUpperCase());
  const podeDelegar =
    !ativa && !temProtocoloPad && situacao !== "concluido" && situacao !== "encerrado";

  // Enquanto o agente trabalha, atualiza a tela sozinha
  useEffect(() => {
    if (!ativa) return;
    const t = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(t);
  }, [ativa, router]);

  const delegar = () => {
    setErro(null);
    setFaltas([]);
    startTransition(async () => {
      const res = await delegarParaAgenteAction(chamadoId, instrucoes);
      if (res.faltas?.length) {
        setFaltas(res.faltas);
      } else if (res.erro) {
        setErro(res.erro);
      } else {
        setModalAberto(false);
        setInstrucoes("");
        router.refresh();
      }
    });
  };

  const cancelar = () => {
    if (!tarefa) return;
    startTransition(async () => {
      const res = await cancelarTarefaAgenteAction(tarefa.id, chamadoId);
      if (res.erro) setErro(res.erro);
      router.refresh();
    });
  };

  if (!tarefa && !podeDelegar) return null;

  return (
    <>
      <div className="rounded-xl border border-borda bg-superficie p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-xs">
            <Bot className="h-5 w-5 shrink-0 text-acento" />
            <div>
              <span className="block text-sm font-bold text-texto">Agente Prisma</span>
              {!tarefa && (
                <span className="text-texto-suave">
                  Delegue a abertura deste chamado no PAD. O agente preenche, envia e grava o
                  protocolo aqui.
                </span>
              )}
              {tarefa?.status === "pendente" && (
                <span className="inline-flex items-center gap-1 text-texto-suave">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Na fila desde{" "}
                  {quando(tarefa.solicitado_em)} (delegado por {tarefa.solicitado_por_nome}).
                </span>
              )}
              {tarefa?.status === "em_execucao" && (
                <span className="inline-flex items-center gap-1 text-acento font-semibold">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Abrindo no PAD agora…
                </span>
              )}
              {tarefa?.status === "concluida" && (
                <span className="inline-flex items-center gap-1 text-sucesso font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aberto no PAD: {tarefa.protocolo_pad} em{" "}
                  {quando(tarefa.finalizado_em)}
                </span>
              )}
              {tarefa?.status === "devolvida" && (
                <span className="inline-flex items-center gap-1 text-alerta font-semibold">
                  <Undo2 className="h-3.5 w-3.5" /> Devolvido pelo agente em{" "}
                  {quando(tarefa.finalizado_em)}
                </span>
              )}
              {tarefa?.status === "erro" && (
                <span className="inline-flex items-center gap-1 text-erro font-semibold">
                  <AlertCircle className="h-3.5 w-3.5" /> O agente não conseguiu concluir em{" "}
                  {quando(tarefa.finalizado_em)}
                </span>
              )}
              {tarefa?.status === "cancelada" && (
                <span className="text-texto-suave">Última delegação cancelada.</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {tarefa?.status === "pendente" && (
              <button
                type="button"
                disabled={isPending}
                onClick={cancelar}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto transition hover:bg-fundo disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            )}
            {podeDelegar && (
              <button
                type="button"
                onClick={() => {
                  setFaltas([]);
                  setErro(null);
                  setModalAberto(true);
                }}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white transition hover:bg-acento-hover"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>
                  {tarefa?.status === "devolvida" || tarefa?.status === "erro"
                    ? "Corrigido, delegar de novo"
                    : "Delegar para agente"}
                </span>
              </button>
            )}
          </div>
        </div>

        {(tarefa?.status === "devolvida" || tarefa?.status === "erro") && tarefa.pendencias && (
          <div className="rounded-md border border-alerta/40 bg-alerta-fundo p-3 text-xs text-texto whitespace-pre-wrap">
            <strong className="block mb-1">O que faltou:</strong>
            {tarefa.pendencias}
          </div>
        )}
        {erro && !modalAberto && <p className="text-xs font-semibold text-erro">{erro}</p>}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-borda bg-superficie p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-acento" />
              <h2 className="text-sm font-bold text-texto">Delegar para o Agente Prisma</h2>
            </div>
            <p className="text-xs text-texto-suave">
              O agente vai abrir este chamado no PAD usando os dados, a descrição e os anexos do
              registro. Se faltar alguma informação, ele devolve dizendo o que falta.
            </p>
            <label className="block text-xs font-semibold text-texto">
              Instruções para o agente (opcional)
              <textarea
                value={instrucoes}
                onChange={(e) => setInstrucoes(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Ex.: anexar só o comprovante de agosto; aluno pede retorno por e-mail."
                className="mt-1 w-full rounded-lg border border-borda bg-fundo p-2 text-xs font-normal text-texto"
              />
            </label>

            {faltas.length > 0 && (
              <div className="rounded-md border border-alerta/40 bg-alerta-fundo p-3 text-xs text-texto">
                <strong className="block mb-1">Complete antes de delegar:</strong>
                <ul className="list-disc pl-4 space-y-0.5">
                  {faltas.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {erro && <p className="text-xs font-semibold text-erro">{erro}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="h-9 px-4 rounded-lg border border-borda text-xs font-semibold text-texto hover:bg-fundo"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={delegar}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover disabled:opacity-60"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delegar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
