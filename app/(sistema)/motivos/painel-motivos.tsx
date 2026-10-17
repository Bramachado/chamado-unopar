"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Motivo } from "@/types/database";
import {
  salvarMotivoAction,
  alternarStatusMotivoAction,
  consolidarMotivosAction,
  type SimilaridadeResultado,
} from "./actions";
import { Plus, Search, Check, AlertCircle, Tag, GitMerge, AlertTriangle } from "lucide-react";
import { formatarInstante } from "@/lib/datas";
import type { TipoSemelhanca } from "@/lib/motivos/normalizacao";

interface Props {
  motivos: Motivo[];
  pares: { a: string; b: string; tipo: TipoSemelhanca; similaridade: number }[];
  podeGerir: boolean;
  podeConsolidar: boolean;
}

const ROTULO_TIPO: Record<TipoSemelhanca, string> = {
  duplicado_exato: "Mesmo nome e caminho",
  mesmo_caminho: "Mesmo caminho na plataforma",
  nome_semelhante: "Nome semelhante",
};

const campo =
  "w-full rounded-lg border border-borda bg-fundo px-3.5 py-2 text-xs font-medium text-texto focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20";

export function PainelMotivos({ motivos, pares, podeGerir, podeConsolidar }: Props) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [modal, setModal] = useState<null | "editar" | "consolidar">(null);
  const [motivoEditando, setMotivoEditando] = useState<Motivo | null>(null);
  const [nome, setNome] = useState("");
  const [filtro, setFiltro] = useState("");
  const [descricao, setDescricao] = useState("");
  const [similares, setSimilares] = useState<SimilaridadeResultado[]>([]);
  const [podeForcar, setPodeForcar] = useState(false);
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const porId = new Map(motivos.map((m) => [m.id, m]));
  const termo = busca.trim().toLowerCase();
  const lista = motivos.filter(
    (m) =>
      (mostrarInativos || m.ativo) &&
      (!termo ||
        m.codigo.toLowerCase().includes(termo) ||
        m.nome.toLowerCase().includes(termo) ||
        (m.filtro ?? "").toLowerCase().includes(termo))
  );

  const abrirEdicao = (m: Motivo | null) => {
    setMotivoEditando(m);
    setNome(m?.nome ?? "");
    setFiltro(m?.filtro ?? "");
    setDescricao(m?.descricao ?? "");
    setSimilares([]);
    setPodeForcar(false);
    setErro(null);
    setModal("editar");
  };

  const abrirConsolidacao = (a?: string, b?: string) => {
    const ma = a ? porId.get(a) : undefined;
    const mb = b ? porId.get(b) : undefined;
    // sugere manter como destino o que tem mais chamados (a decisão é de quem consolida)
    const [o, d] =
      ma && mb && (ma.total_chamados ?? 0) > (mb.total_chamados ?? 0) ? [b, a] : [a, b];
    setOrigem(o ?? "");
    setDestino(d ?? "");
    setJustificativa("");
    setErro(null);
    setModal("consolidar");
  };

  const salvar = (forcar: boolean) => {
    const fd = new FormData();
    if (motivoEditando) fd.set("id", motivoEditando.id);
    fd.set("nome", nome);
    fd.set("filtro", filtro);
    fd.set("descricao", descricao);
    if (forcar) fd.set("confirmacao_forcada", "true");
    startTransition(async () => {
      const r = await salvarMotivoAction({}, fd);
      if (r.sucesso) {
        setModal(null);
        setSucesso(motivoEditando ? "Motivo atualizado." : "Motivo cadastrado.");
        router.refresh();
        return;
      }
      setErro(r.erro ?? "Não foi possível salvar.");
      setSimilares(r.similares ?? []);
      setPodeForcar(!!r.requerConfirmacao);
    });
  };

  const opcoesMotivo = motivos.filter((m) => m.ativo);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Catálogo de Motivos de Chamados
          </h1>
          <p className="text-sm text-texto-suave mt-0.5">
            Nomes comparados sem acentos, maiúsculas e espaços extras. Semelhantes são sinalizados
            para revisão; nada é unido automaticamente.
          </p>
        </div>
        {podeGerir && (
          <button
            type="button"
            onClick={() => abrirEdicao(null)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-acento text-xs font-semibold text-white hover:bg-acento-hover"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Novo motivo
          </button>
        )}
      </div>

      {sucesso && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-sucesso/40 bg-sucesso-fundo/40 p-4 text-xs font-medium text-sucesso"
        >
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> {sucesso}
        </div>
      )}
      {erro && !modal && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-erro/40 bg-erro-fundo p-4 text-xs font-medium text-erro"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" /> {erro}
        </div>
      )}

      {pares.length > 0 && (
        <section
          className="rounded-xl border border-alerta/40 bg-alerta-fundo/40 p-4 space-y-3"
          aria-labelledby="titulo-duplicidades"
        >
          <h2
            id="titulo-duplicidades"
            className="text-sm font-bold text-texto flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 text-alerta" aria-hidden="true" /> Possíveis
            duplicidades entre motivos ativos ({pares.length})
          </h2>
          <p className="text-[11px] text-texto-suave">
            Revise cada par. Motivos com o mesmo caminho podem ser legítimos se atenderem contextos
            ou sistemas diferentes.
          </p>
          <ul className="space-y-2">
            {pares.map((p) => {
              const a = porId.get(p.a)!;
              const b = porId.get(p.b)!;
              return (
                <li
                  key={`${p.a}-${p.b}`}
                  className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="font-semibold text-alerta">{ROTULO_TIPO[p.tipo]}</span>
                    <div className="mt-0.5 text-texto">
                      <strong className="font-mono">{a.codigo}</strong> {a.nome} ({a.total_chamados}{" "}
                      chamados) · <strong className="font-mono">{b.codigo}</strong> {b.nome} (
                      {b.total_chamados} chamados)
                    </div>
                  </div>
                  {podeConsolidar && (
                    <button
                      type="button"
                      onClick={() => abrirConsolidacao(p.a, p.b)}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-borda bg-fundo text-[11px] font-semibold text-texto hover:bg-superficie"
                    >
                      <GitMerge className="h-3.5 w-3.5" aria-hidden="true" /> Consolidar…
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <label htmlFor="busca-motivo" className="sr-only">
            Buscar motivo
          </label>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-texto-suave" aria-hidden="true" />
          <input
            id="busca-motivo"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, nome ou caminho..."
            className={`${campo} pl-9`}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-texto">
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
          />{" "}
          Mostrar inativos e consolidados
        </label>
      </div>

      <div className="tabela-scroll overflow-x-auto rounded-xl border border-borda bg-superficie shadow-xs">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th scope="col" className="w-20">
                Código
              </th>
              <th scope="col">Nome</th>
              <th scope="col">Caminho na plataforma</th>
              <th scope="col" className="w-20 text-center">
                Chamados
              </th>
              <th scope="col" className="w-36 text-center">
                Status
              </th>
              {podeGerir && (
                <th scope="col" className="w-36 text-right">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td
                  colSpan={podeGerir ? 6 : 5}
                  className="py-12 text-center text-xs text-texto-suave"
                >
                  Nenhum motivo encontrado.
                </td>
              </tr>
            ) : (
              lista.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono text-xs font-semibold text-acento">{m.codigo}</td>
                  <td className="text-xs text-texto">
                    <span className="font-medium">{m.nome}</span>
                    {m.descricao && (
                      <span className="block text-[11px] text-texto-suave">{m.descricao}</span>
                    )}
                  </td>
                  <td className="text-[11px] text-texto-suave">{m.filtro || "—"}</td>
                  <td className="text-center text-xs tabular-nums">{m.total_chamados}</td>
                  <td className="text-center text-[11px]">
                    {m.consolidado_para_id ? (
                      <span
                        title={`${m.consolidacao_justificativa ?? ""} (${formatarInstante(m.consolidado_em, { somenteData: true })})`}
                        className="inline-block rounded border border-borda bg-fundo px-2 py-0.5 font-medium text-texto-suave"
                      >
                        Consolidado em {m.consolidado_para_codigo}
                      </span>
                    ) : (
                      <span
                        className={`inline-block rounded border px-2 py-0.5 font-medium ${m.ativo ? "bg-sucesso-fundo/40 text-sucesso border-sucesso/30" : "bg-erro-fundo text-erro border-erro/30"}`}
                      >
                        {m.ativo ? "Ativo" : "Inativo"}
                      </span>
                    )}
                  </td>
                  {podeGerir && (
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => abrirEdicao(m)}
                          className="h-7 px-2.5 rounded border border-borda bg-fundo text-[11px] font-medium text-texto hover:bg-superficie"
                        >
                          Editar
                        </button>
                        {!m.consolidado_para_id && (
                          <button
                            type="button"
                            disabled={pendente}
                            onClick={() =>
                              startTransition(async () => {
                                const r = await alternarStatusMotivoAction(m.id, !m.ativo);
                                if (!r.sucesso) setErro(r.erro ?? "Falha ao alterar status.");
                                router.refresh();
                              })
                            }
                            className="h-7 px-2.5 rounded border border-borda bg-fundo text-[11px] font-medium text-texto-suave hover:text-texto"
                          >
                            {m.ativo ? "Desativar" : "Ativar"}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {podeConsolidar && (
        <button
          type="button"
          onClick={() => abrirConsolidacao()}
          className="text-xs font-semibold text-acento hover:underline inline-flex items-center gap-1"
        >
          <GitMerge className="h-3.5 w-3.5" aria-hidden="true" /> Consolidar outros dois motivos
        </button>
      )}

      {modal === "editar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-editar-motivo"
            className="w-full max-w-lg rounded-lg border border-borda bg-superficie p-6 space-y-4 shadow-xl"
          >
            <h2
              id="titulo-editar-motivo"
              className="flex items-center gap-2 border-b border-borda pb-3 text-sm font-semibold text-texto"
            >
              <Tag className="h-4 w-4 text-acento" aria-hidden="true" />{" "}
              {motivoEditando ? `Editar motivo ${motivoEditando.codigo}` : "Cadastrar novo motivo"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                salvar(false);
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="motivo-nome"
                  className="block text-xs font-medium text-texto mb-1.5"
                >
                  Nome *
                </label>
                <input
                  id="motivo-nome"
                  required
                  value={nome}
                  maxLength={200}
                  onChange={(e) => {
                    setNome(e.target.value);
                    setSimilares([]);
                    setPodeForcar(false);
                  }}
                  className={campo}
                />
              </div>
              <div>
                <label
                  htmlFor="motivo-filtro"
                  className="block text-xs font-medium text-texto mb-1.5"
                >
                  Caminho na plataforma externa (PAD)
                </label>
                <input
                  id="motivo-filtro"
                  value={filtro}
                  maxLength={500}
                  onChange={(e) => {
                    setFiltro(e.target.value);
                    setSimilares([]);
                    setPodeForcar(false);
                  }}
                  placeholder="Ex.: GRAD/ EJA/ TEC > Financeiro > ..."
                  className={campo}
                />
              </div>
              <div>
                <label
                  htmlFor="motivo-descricao"
                  className="block text-xs font-medium text-texto mb-1.5"
                >
                  Descrição / quando usar
                </label>
                <textarea
                  id="motivo-descricao"
                  rows={2}
                  value={descricao}
                  maxLength={500}
                  onChange={(e) => setDescricao(e.target.value)}
                  className={campo}
                />
              </div>
              {erro && (
                <p role="alert" className="text-xs font-semibold text-erro">
                  {erro}
                </p>
              )}
              {similares.length > 0 && (
                <ul className="space-y-1.5 rounded-lg border border-alerta/40 bg-alerta-fundo/40 p-3 text-[11px]">
                  {similares.map((s) => (
                    <li key={s.id}>
                      <strong className="font-mono">{s.codigo}</strong> {s.nome} —{" "}
                      <span className="text-alerta font-semibold">{ROTULO_TIPO[s.tipo]}</span>
                      {s.filtro && <span className="block text-texto-suave">{s.filtro}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end gap-2 border-t border-borda pt-3">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto"
                >
                  Cancelar
                </button>
                {podeForcar ? (
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => salvar(true)}
                    className="h-9 px-5 rounded-lg bg-alerta text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Criar mesmo assim (contexto diferente)
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={pendente}
                    className="h-9 px-5 rounded-lg bg-acento text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {pendente ? "Salvando..." : "Salvar"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "consolidar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-consolidar"
            className="w-full max-w-lg rounded-lg border border-borda bg-superficie p-6 space-y-4 shadow-xl"
          >
            <h2
              id="titulo-consolidar"
              className="flex items-center gap-2 border-b border-borda pb-3 text-sm font-semibold text-texto"
            >
              <GitMerge className="h-4 w-4 text-acento" aria-hidden="true" /> Consolidar motivos
            </h2>
            <p className="text-[11px] text-texto-suave">
              Todos os chamados do motivo de origem passam para o destino (cada um recebe registro
              no histórico e na auditoria) e a origem é desativada, guardando para onde foi
              consolidada, por quem, quando e por quê.
            </p>
            <div className="space-y-3 text-xs">
              {(["origem", "destino"] as const).map((k) => (
                <div key={k}>
                  <label htmlFor={`consolidar-${k}`} className="block font-medium text-texto mb-1">
                    {k === "origem"
                      ? "Motivo de origem (será desativado)"
                      : "Motivo de destino (permanece)"}
                  </label>
                  <select
                    id={`consolidar-${k}`}
                    value={k === "origem" ? origem : destino}
                    onChange={(e) =>
                      k === "origem" ? setOrigem(e.target.value) : setDestino(e.target.value)
                    }
                    className={campo}
                  >
                    <option value="">Selecione...</option>
                    {opcoesMotivo.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.codigo} — {m.nome} ({m.total_chamados} chamados)
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div>
                <label
                  htmlFor="consolidar-justificativa"
                  className="block font-medium text-texto mb-1"
                >
                  Justificativa *
                </label>
                <textarea
                  id="consolidar-justificativa"
                  rows={2}
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  className={campo}
                />
              </div>
              {erro && (
                <p role="alert" className="font-semibold text-erro">
                  {erro}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-borda pt-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="h-9 px-4 rounded-lg border border-borda bg-superficie text-xs font-semibold text-texto"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  pendente ||
                  !origem ||
                  !destino ||
                  origem === destino ||
                  justificativa.trim().length < 10
                }
                onClick={() =>
                  startTransition(async () => {
                    const r = await consolidarMotivosAction(origem, destino, justificativa);
                    if (!r.sucesso) {
                      setErro(r.erro);
                      return;
                    }
                    setModal(null);
                    setSucesso(
                      `Consolidação concluída: ${r.chamadosMovidos} chamado(s) migrado(s).`
                    );
                    router.refresh();
                  })
                }
                className="h-9 px-5 rounded-lg bg-acento text-xs font-semibold text-white disabled:opacity-50"
              >
                {pendente ? "Consolidando..." : "Consolidar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
