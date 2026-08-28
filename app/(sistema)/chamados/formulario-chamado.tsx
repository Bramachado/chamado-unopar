"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Chamado, type Motivo } from "@/types/database";
import { salvarChamado, verificarProtocoloDuplicado, buscarChamadosParaVinculo } from "./actions";
import { AlertCircle, Link as LinkIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface FormularioChamadoProps {
  chamadoInicial?: Chamado | null;
  motivos: Motivo[];
  chamadoVinculadoInicial?: {
    id: string;
    protocolo: string;
    aluno_nome: string;
  } | null;
}

export function FormularioChamado({
  chamadoInicial,
  motivos,
  chamadoVinculadoInicial,
}: FormularioChamadoProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [protocolo, setProtocolo] = useState(chamadoInicial?.protocolo || "");
  const [alunoNome, setAlunoNome] = useState(chamadoInicial?.aluno_nome || "");
  const [alunoRa, setAlunoRa] = useState(chamadoInicial?.aluno_ra || "");
  const [contatoTelefone, setContatoTelefone] = useState(chamadoInicial?.contato_telefone || "");
  const [motivoId, setMotivoId] = useState(chamadoInicial?.motivo_id || (motivos[0]?.id || ""));
  const [descricao, setDescricao] = useState(chamadoInicial?.descricao || "");
  const [situacao, setSituacao] = useState(chamadoInicial?.situacao || "aguardando");
  const [prioridade, setPrioridade] = useState(chamadoInicial?.prioridade || "normal");
  const [dataSolicitacao, setDataSolicitacao] = useState(
    chamadoInicial?.data_solicitacao || new Date().toISOString().split("T")[0]
  );
  const [prazo, setPrazo] = useState(
    chamadoInicial?.prazo || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [observacao, setObservacao] = useState(chamadoInicial?.observacao || "");

  // Estado de verificação de protocolo duplicado
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);

  // Estado de vínculo com chamado anterior
  const [chamadoVinculado, setChamadoVinculado] = useState(chamadoVinculadoInicial || null);
  const [buscaVinculo, setBuscaVinculo] = useState("");
  const [resultadosVinculo, setResultadosVinculo] = useState<
    { id: string; protocolo: string; aluno_nome: string; data_solicitacao: string; situacao: string }[]
  >([]);
  const [buscandoVinculo, setBuscandoVinculo] = useState(false);

  // Mensagens de retorno do formulário
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});

  const handleVerificarProtocolo = async (valor: string) => {
    const limpo = valor.trim().toUpperCase();
    setProtocolo(limpo);
    setAvisoDuplicado(null);

    if (limpo.length === 10 && limpo.match(/^CS[0-9]{8}$/)) {
      const duplicado = await verificarProtocoloDuplicado(limpo, chamadoInicial?.id);
      if (duplicado) {
        setAvisoDuplicado(
          `Atenção: Este protocolo já foi cadastrado por ${duplicado.criado_por_nome} em ${new Date(
            duplicado.criado_em
          ).toLocaleDateString("pt-BR")}.`
        );
      }
    }
  };

  const handleBuscarVinculo = async () => {
    if (!buscaVinculo || buscaVinculo.length < 2) return;
    setBuscandoVinculo(true);
    const res = await buscarChamadosParaVinculo(buscaVinculo);
    // Não permitir vincular a si mesmo
    setResultadosVinculo(res.filter((c) => c.id !== chamadoInicial?.id));
    setBuscandoVinculo(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro(null);
    setErrosCampo({});

    const formData = new FormData();
    if (chamadoInicial?.id) {
      formData.set("id", chamadoInicial.id);
    }
    formData.set("protocolo", protocolo);
    formData.set("aluno_nome", alunoNome);
    formData.set("aluno_ra", alunoRa || "");
    formData.set("contato_telefone", contatoTelefone || "");
    formData.set("motivo_id", motivoId);
    formData.set("descricao", descricao || "");
    formData.set("situacao", situacao);
    formData.set("prioridade", prioridade);
    formData.set("data_solicitacao", dataSolicitacao || "");
    formData.set("prazo", prazo || "");
    formData.set("chamado_vinculado_id", chamadoVinculado?.id || "");
    formData.set("observacao", observacao || "");

    startTransition(async () => {
      const res = await salvarChamado({}, formData);
      if (res.erro) {
        setMensagemErro(res.erro);
        if (res.errosCampo) {
          setErrosCampo(res.errosCampo);
        }
      } else if (res.sucesso && res.chamadoId) {
        router.push(`/chamados/${res.chamadoId}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/chamados"
          className="inline-flex items-center gap-1 text-xs text-texto-suave hover:text-texto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Voltar para chamados</span>
        </Link>
        <h1 className="text-base font-semibold text-texto">
          {chamadoInicial ? "Editar Chamado" : "Novo Chamado"}
        </h1>
      </div>

      {mensagemErro && (
        <div className="flex items-start gap-2.5 rounded border border-erro/30 bg-erro-fundo p-3 text-xs text-erro">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {/* Seção 1: Identificação do Chamado e Aluno */}
      <div className="rounded border border-borda bg-superficie p-4 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2">
          Identificação do Chamado
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-texto mb-1">
              Número do Protocolo (CS + 8 dígitos) *
            </label>
            <input
              type="text"
              required
              disabled={!!chamadoInicial} // Protocolo não pode ser alterado após criação
              value={protocolo}
              onChange={(e) => handleVerificarProtocolo(e.target.value)}
              placeholder="CS12345678"
              maxLength={10}
              className="w-full rounded border border-borda bg-fundo px-3 py-1.5 font-mono text-xs text-texto tabular-nums placeholder:text-texto-suave/60 focus:border-acento focus:outline-none disabled:opacity-60"
            />
            {avisoDuplicado && (
              <p className="mt-1 text-[11px] font-medium text-erro flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {avisoDuplicado}
              </p>
            )}
            {errosCampo.protocolo && (
              <p className="mt-1 text-[11px] text-erro">{errosCampo.protocolo}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-texto mb-1">
              Catálogo de Motivo *
            </label>
            <select
              value={motivoId}
              onChange={(e) => setMotivoId(e.target.value)}
              required
              className="w-full rounded border border-borda bg-fundo px-3 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
            >
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo} — {m.nome}
                </option>
              ))}
            </select>
            {errosCampo.motivo_id && (
              <p className="mt-1 text-[11px] text-erro">{errosCampo.motivo_id}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-texto mb-1">
              Nome Completo do Aluno *
            </label>
            <input
              type="text"
              required
              value={alunoNome}
              onChange={(e) => setAlunoNome(e.target.value)}
              placeholder="Nome do aluno"
              className="w-full rounded border border-borda bg-fundo px-3 py-1.5 text-xs text-texto placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
            />
            {errosCampo.aluno_nome && (
              <p className="mt-1 text-[11px] text-erro">{errosCampo.aluno_nome}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-texto mb-1">
              RA / Matrícula (Opcional)
            </label>
            <input
              type="text"
              value={alunoRa}
              onChange={(e) => setAlunoRa(e.target.value)}
              placeholder="Ex: 1234567"
              className="w-full rounded border border-borda bg-fundo px-3 py-1.5 font-mono text-xs text-texto tabular-nums placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-texto mb-1">
            Telefone de Contato (com DDD)
          </label>
          <input
            type="text"
            value={contatoTelefone}
            onChange={(e) => setContatoTelefone(e.target.value)}
            placeholder="(94) 99999-9999"
            className="w-full rounded border border-borda bg-fundo px-3 py-1.5 font-mono text-xs text-texto tabular-nums placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
          />
        </div>
      </div>

      {/* Seção 2: Prazos e Situação */}
      <div className="rounded border border-borda bg-superficie p-4 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2">
          Controle de Prazo e Status
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-texto mb-1">
              Data de Solicitação *
            </label>
            <input
              type="date"
              required
              value={dataSolicitacao}
              onChange={(e) => setDataSolicitacao(e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-3 py-1.5 font-mono text-xs text-texto tabular-nums focus:border-acento focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-texto mb-1">
              Prazo Final *
            </label>
            <input
              type="date"
              required
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="w-full rounded border border-borda bg-fundo px-3 py-1.5 font-mono text-xs text-texto tabular-nums focus:border-acento focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-texto mb-1">
              Situação *
            </label>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as "aguardando" | "concluido" | "encerrado")}
              className="w-full rounded border border-borda bg-fundo px-3 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="aguardando">Aguardando (Em andamento)</option>
              <option value="concluido">Concluído (Problema resolvido)</option>
              <option value="encerrado">Encerrado (Fechado sem resolver)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-texto mb-1">
              Prioridade *
            </label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as "normal" | "priorizar")}
              className="w-full rounded border border-borda bg-fundo px-3 py-1.5 text-xs text-texto focus:border-acento focus:outline-none"
            >
              <option value="normal">Normal</option>
              <option value="priorizar">Priorizar</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-texto mb-1">
            Descrição do Chamado
          </label>
          <textarea
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes ou contexto da solicitação aberta na plataforma externa..."
            className="w-full rounded border border-borda bg-fundo px-3 py-2 text-xs text-texto placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-texto mb-1">
            Observações Internas
          </label>
          <textarea
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Notas de acompanhamento interno..."
            className="w-full rounded border border-borda bg-fundo px-3 py-2 text-xs text-texto placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
          />
        </div>
      </div>

      {/* Seção 3: Vínculo com Chamado Anterior */}
      <div className="rounded border border-borda bg-superficie p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2 flex items-center gap-1.5">
          <LinkIcon className="h-3.5 w-3.5" />
          <span>Vínculo com Protocolo Anterior (Reincidência / Continuidade)</span>
        </h2>

        {chamadoVinculado ? (
          <div className="flex items-center justify-between rounded border border-borda bg-fundo p-3">
            <div>
              <span className="text-xs font-semibold font-mono text-acento">
                {chamadoVinculado.protocolo}
              </span>
              <span className="ml-2 text-xs text-texto">
                {chamadoVinculado.aluno_nome}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChamadoVinculado(null)}
              className="text-xs text-erro hover:underline"
            >
              Remover vínculo
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={buscaVinculo}
                onChange={(e) => setBuscaVinculo(e.target.value)}
                placeholder="Buscar chamado anterior por protocolo (CS...) ou nome do aluno"
                className="flex-1 rounded border border-borda bg-fundo px-3 py-1.5 text-xs text-texto placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
              />
              <button
                type="button"
                onClick={handleBuscarVinculo}
                disabled={buscandoVinculo}
                className="rounded border border-borda bg-superficie px-3 py-1.5 text-xs font-medium text-texto hover:bg-fundo disabled:opacity-50"
              >
                {buscandoVinculo ? "Buscando..." : "Buscar"}
              </button>
            </div>

            {resultadosVinculo.length > 0 && (
              <div className="rounded border border-borda bg-fundo divide-y divide-borda/40 max-h-40 overflow-y-auto">
                {resultadosVinculo.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 hover:bg-superficie text-xs"
                  >
                    <div>
                      <span className="font-mono font-semibold text-acento mr-2">
                        {r.protocolo}
                      </span>
                      <span className="text-texto">{r.aluno_nome}</span>
                      <span className="ml-2 text-[11px] text-texto-suave">
                        ({r.situacao})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setChamadoVinculado(r);
                        setResultadosVinculo([]);
                        setBuscaVinculo("");
                      }}
                      className="rounded bg-superficie px-2 py-1 text-[11px] font-medium text-texto border border-borda hover:bg-acento hover:text-white"
                    >
                      Vincular
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/chamados"
          className="rounded border border-borda bg-superficie px-4 py-2 text-xs font-medium text-texto hover:bg-fundo"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-acento px-5 py-2 text-xs font-medium text-white transition hover:bg-acento-hover disabled:opacity-50"
        >
          {isPending
            ? "Salvando..."
            : chamadoInicial
            ? "Atualizar chamado"
            : "Salvar chamado"}
        </button>
      </div>
    </form>
  );
}
