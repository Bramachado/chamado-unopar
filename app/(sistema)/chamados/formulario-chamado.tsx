"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Chamado, type Motivo } from "@/types/database";
import { salvarChamado, verificarProtocoloDuplicado, buscarChamadosParaVinculo } from "./actions";
import { 
  AlertCircle, 
  Link as LinkIcon, 
  ArrowLeft, 
  Paperclip, 
  FileText, 
  X, 
  UploadCloud 
} from "lucide-react";
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

  // Múltiplos arquivos
  const [arquivosSelecionados, setArquivosSelecionados] = useState<File[]>([]);

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
          `Atenção: este protocolo já foi cadastrado por ${duplicado.criado_por_nome} em ${new Date(
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
    setResultadosVinculo(res.filter((c) => c.id !== chamadoInicial?.id));
    setBuscandoVinculo(false);
  };

  const handleAdicionarArquivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const novos = Array.from(e.target.files);
      setArquivosSelecionados((prev) => [...prev, ...novos]);
    }
  };

  const handleRemoverArquivo = (index: number) => {
    setArquivosSelecionados((prev) => prev.filter((_, i) => i !== index));
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

    // Anexar todos os múltiplos arquivos selecionados
    for (const arq of arquivosSelecionados) {
      formData.append("arquivos", arq);
    }

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
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-superficie p-4 rounded-lg border border-borda shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/chamados"
            className="inline-flex items-center gap-1.5 rounded-md border border-borda bg-fundo px-3 py-1.5 text-xs font-semibold text-texto transition hover:bg-superficie shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
          </Link>
          <h1 className="font-heading text-lg font-bold text-texto">
            {chamadoInicial ? `Editar Chamado ${chamadoInicial.protocolo}` : "Novo Registro de Chamado"}
          </h1>
        </div>

        {chamadoInicial && (
          <span className="text-xs text-texto-suave font-medium">
            Edição colaborativa habilitada
          </span>
        )}
      </div>

      {mensagemErro && (
        <div className="flex items-start gap-2.5 rounded-lg border border-erro/40 bg-erro-fundo p-4 text-xs font-medium text-erro shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {/* Seção 1: Identificação do Chamado e Aluno */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4 shadow-sm">
        <h2 className="font-heading text-sm font-bold text-texto border-b border-borda pb-2">
          Identificação do Chamado e Solicitante
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-texto mb-1.5">
              Número do Protocolo (CS + 8 dígitos) *
            </label>
            <input
              type="text"
              required
              disabled={!!chamadoInicial}
              value={protocolo}
              onChange={(e) => handleVerificarProtocolo(e.target.value)}
              placeholder="CS12345678"
              maxLength={10}
              className="w-full rounded-md border border-borda bg-fundo px-3 py-2 font-mono text-xs font-bold text-texto tabular-nums placeholder:text-texto-suave focus:border-acento focus:outline-none disabled:opacity-60 shadow-xs"
            />
            {avisoDuplicado && (
              <p className="mt-1.5 text-[11px] font-semibold text-erro flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {avisoDuplicado}
              </p>
            )}
            {errosCampo.protocolo && (
              <p className="mt-1.5 text-[11px] font-semibold text-erro">{errosCampo.protocolo}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-texto mb-1.5">
              Catálogo de Motivo *
            </label>
            <select
              value={motivoId}
              onChange={(e) => setMotivoId(e.target.value)}
              required
              className="w-full rounded-md border border-borda bg-fundo px-3 py-2 text-xs font-medium text-texto focus:border-acento focus:outline-none shadow-xs"
            >
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo} — {m.nome}
                </option>
              ))}
            </select>
            {errosCampo.motivo_id && (
              <p className="mt-1.5 text-[11px] font-semibold text-erro">{errosCampo.motivo_id}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-texto mb-1.5">
              Nome Completo do Aluno *
            </label>
            <input
              type="text"
              required
              value={alunoNome}
              onChange={(e) => setAlunoNome(e.target.value)}
              placeholder="Nome do aluno"
              className="w-full rounded-md border border-borda bg-fundo px-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none shadow-xs"
            />
            {errosCampo.aluno_nome && (
              <p className="mt-1.5 text-[11px] font-semibold text-erro">{errosCampo.aluno_nome}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-texto mb-1.5">
              RA / Matrícula (opcional)
            </label>
            <input
              type="text"
              value={alunoRa}
              onChange={(e) => setAlunoRa(e.target.value)}
              placeholder="Ex: 1234567"
              className="w-full rounded-md border border-borda bg-fundo px-3 py-2 font-mono text-xs text-texto tabular-nums placeholder:text-texto-suave focus:border-acento focus:outline-none shadow-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-texto mb-1.5">
            Telefone de Contato (com DDD)
          </label>
          <input
            type="text"
            value={contatoTelefone}
            onChange={(e) => setContatoTelefone(e.target.value)}
            placeholder="(94) 99999-9999"
            className="w-full rounded-md border border-borda bg-fundo px-3 py-2 font-mono text-xs text-texto tabular-nums placeholder:text-texto-suave focus:border-acento focus:outline-none shadow-xs max-w-sm"
          />
        </div>
      </div>

      {/* Seção 2: Prazos e Situação */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4 shadow-sm">
        <h2 className="font-heading text-sm font-bold text-texto border-b border-borda pb-2">
          Controle de Prazo e Situação
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-texto mb-1.5">
              Data de Abertura *
            </label>
            <input
              type="date"
              required
              value={dataSolicitacao}
              onChange={(e) => setDataSolicitacao(e.target.value)}
              className="w-full rounded-md border border-borda bg-fundo px-3 py-2 font-mono text-xs font-semibold text-texto tabular-nums focus:border-acento focus:outline-none shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-texto mb-1.5">
              Prazo Limite *
            </label>
            <input
              type="date"
              required
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="w-full rounded-md border border-borda bg-fundo px-3 py-2 font-mono text-xs font-semibold text-texto tabular-nums focus:border-acento focus:outline-none shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-texto mb-1.5">
              Situação Atual *
            </label>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as "aguardando" | "concluido" | "encerrado")}
              className="w-full rounded-md border border-borda bg-fundo px-3 py-2 text-xs font-semibold text-texto focus:border-acento focus:outline-none shadow-xs"
            >
              <option value="aguardando">Aguardando (em andamento)</option>
              <option value="concluido">Concluído (resolvido)</option>
              <option value="encerrado">Encerrado (sem resolver)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-texto mb-1.5">
              Prioridade *
            </label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as "normal" | "priorizar")}
              className="w-full rounded-md border border-borda bg-fundo px-3 py-2 text-xs font-semibold text-texto focus:border-acento focus:outline-none shadow-xs"
            >
              <option value="normal">Normal</option>
              <option value="priorizar">Priorizar</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-texto mb-1.5">
            Descrição do Chamado
          </label>
          <textarea
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes ou contexto da solicitação aberta na plataforma externa..."
            className="w-full rounded-md border border-borda bg-fundo px-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none shadow-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-texto mb-1.5">
            Observações Internas (Visíveis a toda a equipe)
          </label>
          <textarea
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Notas de acompanhamento interno..."
            className="w-full rounded-md border border-borda bg-fundo px-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none shadow-xs"
          />
        </div>
      </div>

      {/* Seção 3: Anexos e Arquivos (Múltiplos Arquivos por Chamado) */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-4 shadow-sm">
        <h2 className="font-heading text-sm font-bold text-texto border-b border-borda pb-2 flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-acento" />
          <span>Arquivos e Comprovantes Anexados (1 ou mais arquivos)</span>
        </h2>

        <div>
          <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-borda hover:border-acento/60 bg-fundo/60 p-6 text-center cursor-pointer transition">
            <UploadCloud className="h-8 w-8 text-acento mb-2" />
            <span className="text-xs font-bold text-texto">
              Clique para selecionar arquivos ou arraste até aqui
            </span>
            <span className="text-[11px] text-texto-suave mt-0.5">
              PDFs, comprovantes, prints e documentos em geral (múltiplos permitidos)
            </span>
            <input
              type="file"
              multiple
              onChange={handleAdicionarArquivos}
              className="hidden"
            />
          </label>
        </div>

        {/* Lista de Arquivos Selecionados */}
        {arquivosSelecionados.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-texto">
              Arquivos selecionados ({arquivosSelecionados.length}):
            </span>
            <div className="divide-y divide-borda/60 rounded-md border border-borda bg-fundo">
              {arquivosSelecionados.map((arq, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 text-acento shrink-0" />
                    <span className="font-medium text-texto truncate">{arq.name}</span>
                    <span className="font-mono text-[11px] text-texto-suave shrink-0">
                      ({Math.round(arq.size / 1024)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoverArquivo(idx)}
                    className="text-texto-suave hover:text-erro p-1"
                    title="Remover anexo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Seção 4: Vínculo com Chamado Anterior */}
      <div className="rounded-lg border border-borda bg-superficie p-5 space-y-3 shadow-sm">
        <h2 className="font-heading text-sm font-bold text-texto border-b border-borda pb-2 flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-acento" />
          <span>Vínculo com Protocolo Anterior (Reincidência)</span>
        </h2>

        {chamadoVinculado ? (
          <div className="flex items-center justify-between rounded-md border border-borda bg-fundo p-3 shadow-xs">
            <div>
              <span className="text-xs font-bold font-mono text-acento">
                {chamadoVinculado.protocolo}
              </span>
              <span className="ml-2 text-xs font-medium text-texto">
                {chamadoVinculado.aluno_nome}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChamadoVinculado(null)}
              className="text-xs font-bold text-erro hover:underline"
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
                className="flex-1 rounded-md border border-borda bg-fundo px-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none shadow-xs"
              />
              <button
                type="button"
                onClick={handleBuscarVinculo}
                disabled={buscandoVinculo}
                className="rounded-md border border-borda bg-superficie px-4 py-2 text-xs font-bold text-texto hover:bg-fundo disabled:opacity-50 shadow-xs"
              >
                {buscandoVinculo ? "Buscando..." : "Buscar"}
              </button>
            </div>

            {resultadosVinculo.length > 0 && (
              <div className="rounded-md border border-borda bg-fundo divide-y divide-borda/60 max-h-40 overflow-y-auto shadow-xs">
                {resultadosVinculo.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 hover:bg-superficie text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-acento mr-2">
                        {r.protocolo}
                      </span>
                      <span className="text-texto font-medium">{r.aluno_nome}</span>
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
                      className="rounded bg-superficie px-2.5 py-1 text-[11px] font-bold text-texto border border-borda hover:bg-acento hover:text-white transition shadow-xs"
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
          className="rounded-md border border-borda bg-superficie px-5 py-2.5 text-xs font-bold text-texto hover:bg-fundo shadow-xs transition"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-acento px-6 py-2.5 text-xs font-bold text-white transition hover:bg-acento-hover disabled:opacity-50 shadow-sm"
        >
          {isPending
            ? "Gravando..."
            : chamadoInicial
            ? "Atualizar Chamado"
            : "Salvar Chamado"}
        </button>
      </div>
    </form>
  );
}
