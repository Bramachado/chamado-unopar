import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { notFound } from "next/navigation";
import { PainelDetalheChamado } from "./painel-detalhe-chamado";
import { type Chamado, type Motivo, type Perfil, type ArquivoChamado, type LogAuditoria } from "@/types/database";

interface DetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PaginaDetalheChamado({ params }: DetailPageProps) {
  const { id } = await params;
  const perfilAtual = await obterPerfilAtual();
  const supabase = await criarClienteServidor();

  // 1. Carregar chamado principal com motivo e perfil do autor e atualizador
  const { data: chamado, error } = await supabase
    .from("chamados")
    .select(`
      *,
      motivos:motivo_id(id, codigo, nome),
      perfisCriador:criado_por(id, nome_completo, email),
      perfisAtualizador:atualizado_por(id, nome_completo, email)
    `)
    .eq("id", id)
    .is("excluido_em", null)
    .single();

  if (error || !chamado) {
    notFound();
  }

  // 2. Carregar arquivos vinculados a este chamado
  const { data: arquivos } = await supabase
    .from("arquivos")
    .select(`
      *,
      perfis:criado_por(nome_completo)
    `)
    .eq("chamado_id", id)
    .order("criado_em", { ascending: false });

  // 3. Carregar chamado vinculado anterior (se houver)
  let chamadoAnterior = null;
  if (chamado.chamado_vinculado_id) {
    const { data: ant } = await supabase
      .from("chamados")
      .select("id, protocolo, aluno_nome, situacao, data_solicitacao")
      .eq("id", chamado.chamado_vinculado_id)
      .single();
    chamadoAnterior = ant;
  }

  // 4. Carregar chamados subsequentes que vincularam a este
  const { data: chamadosPosteriores } = await supabase
    .from("chamados")
    .select("id, protocolo, aluno_nome, situacao, data_solicitacao, perfis:criado_por(nome_completo)")
    .eq("chamado_vinculado_id", id)
    .is("excluido_em", null);

  // 5. Carregar histórico de auditoria deste chamado específico
  const { data: logs } = await supabase
    .from("logs_auditoria")
    .select("*")
    .eq("tabela", "chamados")
    .eq("registro_id", id)
    .order("criado_em", { ascending: false });

  return (
    <PainelDetalheChamado
      chamado={chamado as unknown as (Chamado & { motivos?: Pick<Motivo, "id" | "codigo" | "nome">; perfisCriador?: Pick<Perfil, "id" | "nome_completo" | "email">; perfisAtualizador?: Pick<Perfil, "id" | "nome_completo" | "email"> })}
      arquivos={(arquivos as unknown as (ArquivoChamado & { perfis?: Pick<Perfil, "nome_completo"> })[]) || []}
      chamadoAnterior={chamadoAnterior}
      chamadosPosteriores={chamadosPosteriores}
      logs={(logs as LogAuditoria[]) || []}
      perfilAtual={perfilAtual}
    />
  );
}
