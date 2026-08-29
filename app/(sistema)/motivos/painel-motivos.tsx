"use client";

import { useState } from "react";
import { type Motivo, type Perfil } from "@/types/database";
import { 
  salvarMotivoAction, 
  alternarStatusMotivoAction, 
  verificarSimilaridade,
  type SimilaridadeResultado 
} from "./actions";
import { Tag, Plus, Search, Check, AlertCircle } from "lucide-react";

interface PainelMotivosProps {
  motivos: Motivo[];
  perfilAtual: Perfil;
}

export function PainelMotivos({ motivos, perfilAtual }: PainelMotivosProps) {
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [motivoEditando, setMotivoEditando] = useState<Motivo | null>(null);

  // Estados do formulário
  const [nome, setNome] = useState("");
  const [motivosSimilares, setMotivosSimilares] = useState<SimilaridadeResultado[]>([]);
  const [confirmouCriacaoMesmoSimilar, setConfirmouCriacaoMesmoSimilar] = useState(false);

  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const ehAdmin = perfilAtual.papel === "admin";

  const motivosFiltrados = motivos.filter(
    (m) =>
      m.nome.toLowerCase().includes(busca.toLowerCase()) ||
      m.codigo.toLowerCase().includes(busca.toLowerCase())
  );

  const handleAbrirCriacao = () => {
    setMotivoEditando(null);
    setNome("");
    setMotivosSimilares([]);
    setConfirmouCriacaoMesmoSimilar(false);
    setMensagemErro(null);
    setModalAberto(true);
  };

  const handleAbrirEdicao = (m: Motivo) => {
    setMotivoEditando(m);
    setNome(m.nome);
    setMotivosSimilares([]);
    setConfirmouCriacaoMesmoSimilar(false);
    setMensagemErro(null);
    setModalAberto(true);
  };

  const handleVerificarNome = async (valor: string) => {
    setNome(valor);
    if (!motivoEditando && valor.trim().length >= 3) {
      const res = await verificarSimilaridade(valor);
      setMotivosSimilares(res);
    } else {
      setMotivosSimilares([]);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro(null);
    setMensagemSucesso(null);

    // Se houver motivos similares e o usuário ainda não confirmou
    if (!motivoEditando && motivosSimilares.length > 0 && !confirmouCriacaoMesmoSimilar) {
      setMensagemErro("Atenção: existem motivos muito semelhantes já cadastrados. Revise a lista ou confirme a criação.");
      return;
    }

    const formData = new FormData();
    formData.set("nome", nome);
    if (confirmouCriacaoMesmoSimilar) {
      formData.set("confirmacao_forcada", "true");
    }

    const res = await salvarMotivoAction({}, formData);
    if (res.erro) {
      setMensagemErro(res.erro);
      if (res.similares) {
        setMotivosSimilares(res.similares);
      }
    } else if (res.sucesso) {
      setModalAberto(false);
      setMensagemSucesso(motivoEditando ? "Motivo atualizado com sucesso." : "Novo motivo cadastrado com sucesso.");
    }
  };

  const handleAlternarStatus = async (id: string, ativoAtual: boolean) => {
    setMensagemErro(null);
    const res = await alternarStatusMotivoAction(id, !ativoAtual);
    if (!res.sucesso) {
      setMensagemErro(res.erro || "Falha ao alterar status do motivo.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto">
            Catálogo de motivos de chamados
          </h1>
          <p className="text-xs text-texto-suave">
            Catálogo padronizado. O sistema avisa quando um motivo parecido já existe.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAbrirCriacao}
          className="inline-flex items-center gap-1.5 rounded bg-acento px-3 py-1.5 text-xs font-medium text-white transition hover:bg-acento-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Novo motivo</span>
        </button>
      </div>

      {mensagemSucesso && (
        <div className="flex items-center gap-2 rounded border border-sucesso/30 bg-sucesso-fundo p-3 text-xs text-sucesso">
          <Check className="h-4 w-4 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {mensagemErro && (
        <div className="flex items-start gap-2 rounded border border-erro/30 bg-erro-fundo p-3 text-xs text-erro">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-texto-suave" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar motivo por código (#01) ou nome..."
          className="w-full rounded border border-borda bg-superficie pl-8 pr-3 py-1.5 text-xs text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none"
        />
      </div>

      {/* Tabela de Motivos */}
      <div className="overflow-x-auto rounded border border-borda bg-fundo shadow-sm">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th className="w-24">Código</th>
              <th>Nome do motivo</th>
              <th className="w-24 text-center">Status</th>
              {ehAdmin && <th className="w-28 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {motivosFiltrados.map((m) => (
              <tr key={m.id}>
                <td className="font-mono text-xs font-bold text-texto">
                  {m.codigo}
                </td>
                <td className="text-xs font-semibold text-texto">
                  {m.nome}
                </td>
                <td className="text-center">
                  <span
                    className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${
                      m.ativo
                        ? "bg-sucesso/10 text-sucesso border-sucesso/30"
                        : "bg-erro-fundo text-erro border-erro/30"
                    }`}
                  >
                    {m.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                {ehAdmin && (
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleAbrirEdicao(m)}
                        className="rounded border border-borda bg-superficie px-2 py-0.5 text-[11px] font-medium text-texto hover:bg-fundo"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAlternarStatus(m.id, m.ativo)}
                        className="rounded border border-borda bg-superficie px-2 py-0.5 text-[11px] font-medium text-texto-suave hover:text-texto hover:bg-fundo"
                      >
                        {m.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Criação / Edição de Motivo */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded border border-borda bg-fundo p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-2 border-b border-borda/40 pb-3">
              <Tag className="h-4 w-4 text-acento" />
              <h2 className="font-heading text-sm font-bold text-texto">
                {motivoEditando ? `Editar Motivo ${motivoEditando.codigo}` : "Cadastrar novo motivo"}
              </h2>
            </div>

            <form onSubmit={handleSalvar} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-texto mb-1">
                  Nome do motivo *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => handleVerificarNome(e.target.value)}
                  placeholder="Ex: Correção de nota de prova presencial"
                  className="w-full rounded border border-borda bg-superficie px-3 py-2 text-xs text-texto focus:border-acento focus:outline-none"
                />
              </div>

              {/* Alerta de Motivos Similares Encontrados */}
              {motivosSimilares.length > 0 && !motivoEditando && (
                <div className="rounded border border-alerta/40 bg-alerta-fundo/40 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-alerta">
                    <AlertCircle className="h-4 w-4" />
                    <span>Motivos parecidos já cadastrados no sistema:</span>
                  </div>
                  <ul className="divide-y divide-borda/40 text-xs">
                    {motivosSimilares.map((s) => (
                      <li key={s.id} className="py-1 flex items-center justify-between">
                        <span className="text-texto font-medium">
                          <strong className="font-mono text-texto-suave mr-1">{s.codigo}</strong> {s.nome}
                        </span>
                        <span className="font-mono text-[10px] text-texto-suave tabular-nums">
                          {Math.round(s.similaridade * 100)}% de similaridade
                        </span>
                      </li>
                    ))}
                  </ul>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer text-xs text-texto font-medium">
                    <input
                      type="checkbox"
                      checked={confirmouCriacaoMesmoSimilar}
                      onChange={(e) => setConfirmouCriacaoMesmoSimilar(e.target.checked)}
                      className="rounded border-borda text-acento focus:ring-acento"
                    />
                    <span>Confirmo que este novo motivo é diferente dos listados acima.</span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-borda/40">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded border border-borda bg-superficie px-3 py-1.5 text-xs font-medium text-texto hover:bg-fundo"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded bg-acento px-4 py-1.5 text-xs font-medium text-white hover:bg-acento-hover"
                >
                  Salvar motivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
