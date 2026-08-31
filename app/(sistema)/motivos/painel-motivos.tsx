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
import { CustomCheckbox } from "@/components/ui/custom-checkbox";

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-superficie p-5 rounded-xl border border-borda shadow-sm">
        <div>
          <h1 className="font-heading text-xl font-bold text-texto tracking-tight">
            Catálogo de Motivos de Chamados
          </h1>
          <p className="text-xs text-texto-suave">
            Catálogo padronizado. O sistema avisa quando um motivo parecido já existe.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAbrirCriacao}
          className="inline-flex items-center gap-1.5 rounded-lg bg-acento px-4 py-2 text-xs font-bold text-white transition hover:bg-acento-hover shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Motivo</span>
        </button>
      </div>

      {mensagemSucesso && (
        <div className="flex items-center gap-2 rounded-xl border border-sucesso/40 bg-sucesso-fundo p-4 text-xs font-bold text-sucesso shadow-sm">
          <Check className="h-4 w-4 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {mensagemErro && (
        <div className="flex items-start gap-2 rounded-xl border border-erro/40 bg-erro-fundo p-4 text-xs font-bold text-erro shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-texto-suave" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar motivo por código (#01) ou nome..."
          className="w-full rounded-lg border border-borda bg-superficie pl-9 pr-3 py-2 text-xs font-medium text-texto placeholder:text-texto-suave focus:border-acento focus:outline-none shadow-xs"
        />
      </div>

      {/* Tabela de Motivos */}
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie shadow-sm">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th className="w-28">Código</th>
              <th>Nome do Motivo</th>
              <th className="w-28 text-center">Status</th>
              {ehAdmin && <th className="w-32 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {motivosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={ehAdmin ? 4 : 3} className="py-12 text-center text-xs text-texto-suave font-medium">
                  Nenhum motivo encontrado.
                </td>
              </tr>
            ) : (
              motivosFiltrados.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono text-xs font-bold text-acento">
                    {m.codigo}
                  </td>
                  <td className="text-xs font-bold text-texto">
                    {m.nome}
                  </td>
                  <td className="text-center">
                    <span
                      className={`inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-bold ${
                        m.ativo
                          ? "bg-sucesso/15 text-sucesso border-sucesso/40"
                          : "bg-erro-fundo text-erro border-erro/40"
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
                          className="rounded-md border border-borda bg-fundo px-2.5 py-1 text-[11px] font-bold text-texto hover:bg-superficie shadow-xs"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAlternarStatus(m.id, m.ativo)}
                          className="rounded-md border border-borda bg-fundo px-2.5 py-1 text-[11px] font-bold text-texto-suave hover:text-texto hover:bg-superficie shadow-xs"
                        >
                          {m.ativo ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Criação / Edição de Motivo */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-borda bg-fundo p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-borda pb-3">
              <Tag className="h-5 w-5 text-acento" />
              <h2 className="font-heading text-sm font-bold text-texto">
                {motivoEditando ? `Editar Motivo ${motivoEditando.codigo}` : "Cadastrar Novo Motivo"}
              </h2>
            </div>

            <form onSubmit={handleSalvar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-texto mb-1.5">
                  Nome do Motivo *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => handleVerificarNome(e.target.value)}
                  placeholder="Ex: Correção de nota de prova presencial"
                  className="w-full rounded-lg border border-borda bg-superficie px-3.5 py-2 text-xs font-medium text-texto focus:border-acento focus:outline-none shadow-xs"
                />
              </div>

              {/* Alerta de Motivos Similares Encontrados */}
              {motivosSimilares.length > 0 && !motivoEditando && (
                <div className="rounded-lg border border-alerta/50 bg-alerta-fundo p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-alerta">
                    <AlertCircle className="h-4 w-4" />
                    <span>Motivos parecidos já cadastrados no sistema:</span>
                  </div>
                  <ul className="divide-y divide-borda/40 text-xs">
                    {motivosSimilares.map((s) => (
                      <li key={s.id} className="py-1.5 flex items-center justify-between">
                        <span className="text-texto font-bold">
                          <strong className="font-mono text-texto-suave mr-1">{s.codigo}</strong> {s.nome}
                        </span>
                        <span className="font-mono text-[10px] text-texto-suave tabular-nums font-semibold">
                          {Math.round(s.similaridade * 100)}% similar
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-1">
                    <CustomCheckbox
                      checked={confirmouCriacaoMesmoSimilar}
                      onChange={(chk) => setConfirmouCriacaoMesmoSimilar(chk)}
                      label="Confirmo que este novo motivo é diferente dos listados acima."
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-borda">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-lg border border-borda bg-superficie px-4 py-2 text-xs font-bold text-texto hover:bg-fundo"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-acento px-5 py-2 text-xs font-bold text-white hover:bg-acento-hover shadow-sm"
                >
                  Salvar Motivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
