"use client";

import { useState, useTransition } from "react";
import { type Perfil, type Motivo } from "@/types/database";
import { 
  salvarMotivoAction, 
  alternarStatusMotivoAction, 
  type SimilaridadeResultado,
  type EstadoSalvarMotivo 
} from "./actions";
import { Plus, AlertCircle, Check, AlertTriangle } from "lucide-react";

interface MotivoComContagem extends Motivo {
  total_chamados?: number;
}

interface PainelMotivosProps {
  motivos: MotivoComContagem[];
  perfilAtual: Perfil;
}

export function PainelMotivos({ motivos, perfilAtual }: PainelMotivosProps) {
  const [isPending, startTransition] = useTransition();

  const [nome, setNome] = useState("");
  const [similares, setSimilares] = useState<SimilaridadeResultado[]>([]);
  const [requerConfirmacao, setRequerConfirmacao] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const ehAdmin = perfilAtual.papel === "admin";

  const handleCadastrar = async (confirmacaoForcada = false) => {
    setMensagemErro(null);
    setMensagemSucesso(null);

    const formData = new FormData();
    formData.set("nome", nome);
    if (confirmacaoForcada) {
      formData.set("confirmacao_forcada", "true");
    }

    startTransition(async () => {
      const res: EstadoSalvarMotivo = await salvarMotivoAction({}, formData);

      if (res.requerConfirmacao && res.similares) {
        setSimilares(res.similares);
        setRequerConfirmacao(true);
        setMensagemErro(res.erro || null);
      } else if (res.erro) {
        setMensagemErro(res.erro);
      } else if (res.sucesso) {
        setNome("");
        setSimilares([]);
        setRequerConfirmacao(false);
        setMensagemSucesso("Motivo cadastrado com sucesso no catálogo oficial.");
      }
    });
  };

  const handleAlternarStatus = async (id: string, ativoAtual: boolean) => {
    if (!ehAdmin) return;
    setMensagemErro(null);
    const res = await alternarStatusMotivoAction(id, !ativoAtual);
    if (!res.sucesso) {
      setMensagemErro(res.erro || "Falha ao alterar status do motivo.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div>
        <h1 className="text-lg font-semibold text-texto">
          Catálogo de Motivos de Atendimento
        </h1>
        <p className="text-xs text-texto-suave">
          Padronização e numeração sequencial inviolável com proteção anti-duplicatas por similaridade fonética e trigramas.
        </p>
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

      {/* Bloco de Cadastro com Detecção Anti-Duplicata */}
      <div className="rounded border border-borda bg-superficie p-4 space-y-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2 flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>Cadastrar Novo Motivo no Catálogo</span>
        </h2>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setRequerConfirmacao(false);
              setSimilares([]);
            }}
            placeholder="Digite o nome do motivo (ex: Revisão de notas e frequência)"
            className="flex-1 rounded border border-borda bg-fundo px-3 py-1.5 text-xs text-texto placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
          />

          {!requerConfirmacao ? (
            <button
              type="button"
              disabled={isPending || nome.trim().length < 3}
              onClick={() => handleCadastrar(false)}
              className="rounded bg-acento px-4 py-1.5 text-xs font-medium text-white transition hover:bg-acento-hover disabled:opacity-50"
            >
              {isPending ? "Verificando..." : "Cadastrar Motivo"}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleCadastrar(true)}
                className="rounded border border-alerta/40 bg-alerta-fundo px-3 py-1.5 text-xs font-semibold text-alerta hover:bg-alerta/20"
              >
                {isPending ? "Gravando..." : "Criar mesmo assim"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRequerConfirmacao(false);
                  setSimilares([]);
                }}
                className="rounded border border-borda bg-fundo px-3 py-1.5 text-xs text-texto hover:bg-superficie"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Alerta de Similaridade Detectada */}
        {requerConfirmacao && similares.length > 0 && (
          <div className="rounded border border-alerta/40 bg-alerta-fundo/40 p-3 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-alerta">
              <AlertTriangle className="h-4 w-4" />
              <span>Atenção: Identificamos motivos com alta semelhança no banco de dados</span>
            </div>
            <p className="text-texto-suave text-[11px]">
              Para manter a consistência dos gráficos e relatórios, prefira utilizar os motivos já homologados:
            </p>
            <div className="divide-y divide-borda/40 rounded border border-borda bg-fundo">
              {similares.map((sim) => (
                <div key={sim.id} className="flex items-center justify-between p-2.5">
                  <div>
                    <span className="font-mono font-bold text-acento mr-2">
                      {sim.codigo}
                    </span>
                    <span className="font-medium text-texto">{sim.nome}</span>
                  </div>
                  <span className="rounded bg-superficie border border-borda px-2 py-0.5 font-mono text-[11px] font-semibold text-texto-suave">
                    {Math.round(sim.similaridade * 100)}% de semelhança
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabela do Catálogo de Motivos */}
      <div className="overflow-x-auto rounded border border-borda bg-fundo shadow-sm">
        <table className="tabela-densa">
          <thead>
            <tr>
              <th className="w-20">Código</th>
              <th>Nome do Motivo</th>
              <th className="w-28 text-center">Chamados</th>
              <th className="w-24 text-center">Status</th>
              {ehAdmin && <th className="w-24 text-right">Ação</th>}
            </tr>
          </thead>
          <tbody>
            {motivos.length === 0 ? (
              <tr>
                <td colSpan={ehAdmin ? 5 : 4} className="py-8 text-center text-xs text-texto-suave">
                  Nenhum motivo cadastrado no catálogo.
                </td>
              </tr>
            ) : (
              motivos.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono text-xs font-bold tabular-nums text-acento">
                    {m.codigo}
                  </td>
                  <td className="text-xs font-medium text-texto">
                    {m.nome}
                  </td>
                  <td className="font-mono text-xs tabular-nums text-center text-texto-suave">
                    {m.total_chamados ?? 0}
                  </td>
                  <td className="text-center">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${
                        m.ativo
                          ? "bg-sucesso/10 text-sucesso border-sucesso/30"
                          : "bg-texto-suave/10 text-texto-suave border-borda"
                      }`}
                    >
                      {m.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  {ehAdmin && (
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleAlternarStatus(m.id, m.ativo)}
                        className="rounded border border-borda bg-superficie px-2 py-0.5 text-[11px] font-medium text-texto hover:bg-fundo"
                      >
                        {m.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
