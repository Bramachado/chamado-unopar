import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, 
  Edit2, 
  Link as LinkIcon, 
  History
} from "lucide-react";

interface DetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PaginaDetalheChamado({ params }: DetailPageProps) {
  const { id } = await params;
  const perfil = await obterPerfilAtual();
  const supabase = await criarClienteServidor();

  // 1. Carregar chamado principal com motivo e perfil do autor
  const { data: chamado, error } = await supabase
    .from("chamados")
    .select(`
      *,
      motivos:motivo_id(id, codigo, nome),
      perfis:criado_por(id, nome_completo, email)
    `)
    .eq("id", id)
    .is("excluido_em", null)
    .single();

  if (error || !chamado) {
    notFound();
  }

  // 2. Carregar chamado vinculado anterior (se houver)
  let chamadoAnterior = null;
  if (chamado.chamado_vinculado_id) {
    const { data: ant } = await supabase
      .from("chamados")
      .select("id, protocolo, aluno_nome, situacao, data_solicitacao")
      .eq("id", chamado.chamado_vinculado_id)
      .single();
    chamadoAnterior = ant;
  }

  // 3. Carregar chamados subsequentes que vincularam a este
  const { data: chamadosPosteriores } = await supabase
    .from("chamados")
    .select("id, protocolo, aluno_nome, situacao, data_solicitacao, perfis:criado_por(nome_completo)")
    .eq("chamado_vinculado_id", id)
    .is("excluido_em", null);

  // 4. Carregar histórico de auditoria deste chamado específico
  const { data: logs } = await supabase
    .from("logs_auditoria")
    .select("*")
    .eq("tabela", "chamados")
    .eq("registro_id", id)
    .order("criado_em", { ascending: false });

  const podeEditar = perfil.papel === "admin" || chamado.criado_por === perfil.id;

  const formatarTelefone = (tel?: string | null) => {
    if (!tel) return "-";
    const d = tel.replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return tel;
  };

  const motivoInfo = chamado.motivos as unknown as { id: string; codigo: string; nome: string } | null;
  const perfilInfo = chamado.perfis as unknown as { id: string; nome_completo: string; email: string } | null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Barra de Ações Superior */}
      <div className="flex items-center justify-between">
        <Link
          href="/chamados"
          className="inline-flex items-center gap-1 text-xs text-texto-suave hover:text-texto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Voltar para chamados</span>
        </Link>

        {podeEditar && (
          <Link
            href={`/chamados/${chamado.id}/editar`}
            className="inline-flex items-center gap-1.5 rounded bg-acento px-3 py-1.5 text-xs font-medium text-white transition hover:bg-acento-hover"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Editar Chamado</span>
          </Link>
        )}
      </div>

      {/* Cartão de Detalhes Principais */}
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-2 border-b border-borda/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-base font-bold text-texto tabular-nums">
                {chamado.protocolo}
              </h1>
              <span
                className={`inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize ${
                  chamado.situacao === "concluido"
                    ? "bg-sucesso/10 text-sucesso border-sucesso/30"
                    : chamado.situacao === "encerrado"
                    ? "bg-texto-suave/10 text-texto-suave border-borda"
                    : "bg-fundo text-texto border-borda"
                }`}
              >
                {chamado.situacao}
              </span>
              {chamado.prioridade === "priorizar" && (
                <span className="rounded border border-alerta/40 bg-alerta-fundo px-2 py-0.5 text-xs font-semibold text-alerta">
                  Priorizar
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-texto-suave">
              Registrado por {perfilInfo?.nome_completo || "Histórico"} em{" "}
              {format(parseISO(chamado.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Informações Estruturadas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div>
            <span className="font-medium text-texto-suave block">Aluno</span>
            <span className="text-texto font-medium">{chamado.aluno_nome}</span>
          </div>

          <div>
            <span className="font-medium text-texto-suave block">RA / Matrícula</span>
            <span className="text-texto font-mono tabular-nums">
              {chamado.aluno_ra || "Não informado"}
            </span>
          </div>

          <div>
            <span className="font-medium text-texto-suave block">Telefone de Contato</span>
            <span className="text-texto font-mono tabular-nums">
              {formatarTelefone(chamado.contato_telefone)}
            </span>
          </div>

          <div>
            <span className="font-medium text-texto-suave block">Catálogo de Motivo</span>
            <span className="text-texto font-medium">
              {motivoInfo ? `${motivoInfo.codigo} ${motivoInfo.nome}` : "-"}
            </span>
          </div>

          <div>
            <span className="font-medium text-texto-suave block">Data de Solicitação</span>
            <span className="text-texto font-mono tabular-nums">
              {format(parseISO(chamado.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>

          <div>
            <span className="font-medium text-texto-suave block">Prazo de Resolução</span>
            <span className="text-texto font-mono tabular-nums">
              {format(parseISO(chamado.prazo), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>

        {chamado.descricao && (
          <div className="border-t border-borda/40 pt-3 text-xs">
            <span className="font-medium text-texto-suave block mb-1">Descrição</span>
            <p className="text-texto whitespace-pre-wrap bg-fundo rounded border border-borda p-3">
              {chamado.descricao}
            </p>
          </div>
        )}

        {chamado.observacao && (
          <div className="border-t border-borda/40 pt-3 text-xs">
            <span className="font-medium text-texto-suave block mb-1">Observações Internas</span>
            <p className="text-texto whitespace-pre-wrap bg-fundo rounded border border-borda p-3">
              {chamado.observacao}
            </p>
          </div>
        )}
      </div>

      {/* Cadeia de Chamados Vinculados */}
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2 flex items-center gap-1.5">
          <LinkIcon className="h-3.5 w-3.5" />
          <span>Cadeia de Vínculos e Continuidade de Atendimento</span>
        </h2>

        {chamadoAnterior && (
          <div className="rounded border border-borda bg-fundo p-3 text-xs">
            <span className="text-texto-suave block text-[11px] mb-1">Vínculo com Protocolo Anterior:</span>
            <div className="flex items-center justify-between">
              <div>
                <Link
                  href={`/chamados/${chamadoAnterior.id}`}
                  className="font-mono font-bold text-acento hover:underline mr-2"
                >
                  {chamadoAnterior.protocolo}
                </Link>
                <span className="text-texto">{chamadoAnterior.aluno_nome}</span>
                <span className="ml-2 text-texto-suave">({chamadoAnterior.situacao})</span>
              </div>
              <span className="font-mono text-texto-suave tabular-nums">
                {format(parseISO(chamadoAnterior.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>
        )}

        {chamadosPosteriores && chamadosPosteriores.length > 0 && (
          <div className="space-y-2">
            <span className="text-texto-suave block text-[11px]">Protocolos Posteriores Vinculados a este:</span>
            <div className="rounded border border-borda bg-fundo divide-y divide-borda/40">
              {chamadosPosteriores.map((post) => (
                <div key={post.id} className="flex items-center justify-between p-2.5 text-xs">
                  <div>
                    <Link
                      href={`/chamados/${post.id}`}
                      className="font-mono font-bold text-acento hover:underline mr-2"
                    >
                      {post.protocolo}
                    </Link>
                    <span className="text-texto">{post.aluno_nome}</span>
                    <span className="ml-2 text-texto-suave">({post.situacao})</span>
                  </div>
                  <span className="font-mono text-texto-suave tabular-nums">
                    {format(parseISO(post.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!chamadoAnterior && (!chamadosPosteriores || chamadosPosteriores.length === 0) && (
          <p className="text-xs text-texto-suave">
            Nenhum chamado anterior ou posterior vinculado a este protocolo.
          </p>
        )}
      </div>

      {/* Histórico de Auditoria do Chamado (Visível a todas as usuárias) */}
      <div className="rounded border border-borda bg-superficie p-5 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-suave border-b border-borda/40 pb-2 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          <span>Histórico de Alterações e Auditoria deste Chamado</span>
        </h2>

        {!logs || logs.length === 0 ? (
          <p className="text-xs text-texto-suave">Nenhum evento registrado em auditoria.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded border border-borda bg-fundo p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between border-b border-borda/30 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-acento">
                      {log.operacao}
                    </span>
                    <span className="text-texto-suave">por</span>
                    <span className="font-medium text-texto">
                      {log.usuario_nome || "Sistema"}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-texto-suave tabular-nums">
                    {format(parseISO(log.criado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </span>
                </div>

                {log.campos_alterados && log.campos_alterados.length > 0 && (
                  <div className="pt-1 text-[11px]">
                    <span className="text-texto-suave">Campos alterados: </span>
                    <span className="font-mono text-texto font-medium">
                      {log.campos_alterados.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
