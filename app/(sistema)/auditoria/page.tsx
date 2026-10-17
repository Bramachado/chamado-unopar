import { redirect } from "next/navigation";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { PainelAuditoria } from "./painel-auditoria";
import { type LogAuditoria } from "@/types/database";
import { montarWhereAuditoria } from "@/lib/auditoria/filtros";
import { lerCamposAlterados, lerJsonAuditoria } from "@/lib/auditoria/redacao";

interface AuditPageProps {
  searchParams: Promise<{
    busca?: string;
    tabela?: string;
    operacao?: string;
    data_inicio?: string;
    data_fim?: string;
    pagina?: string;
    por_pagina?: string;
  }>;
}

export default async function PaginaAuditoria({ searchParams }: AuditPageProps) {
  const perfil = await obterPerfilAtual();

  if (perfil.papel !== "admin") {
    redirect("/painel");
  }

  const params = await searchParams;
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const porPagina = Math.min(100, Math.max(10, Number(params.por_pagina) || 25));
  const offset = (pagina - 1) * porPagina;

  const dados = await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
    const whereClause = montarWhereAuditoria(req, params);

    req.input("offset", sql.Int, offset);
    req.input("limit", sql.Int, porPagina);

    const qTotal = await req
      .query(
        `
        SELECT COUNT(id) AS total
        FROM auditoria.logs
        ${whereClause}
      `
      )
      .catch(() => ({ recordset: [{ total: 0 }] }));

    const qLogs = await req
      .query(
        `
        SELECT 
          id,
          tabela,
          registro_id,
          operacao,
          dados_antes,
          dados_depois,
          campos_alterados,
          CAST(usuario_id AS NVARCHAR(50)) AS usuario_id,
          usuario_nome,
          protocolo,
          ip,
          criado_em
        FROM auditoria.logs
        ${whereClause}
        ORDER BY criado_em DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `
      )
      .catch(() => ({ recordset: [] }));

    return {
      total: qTotal.recordset[0]?.total || 0,
      logs: qLogs.recordset,
    };
  });

  const logsFormatados: LogAuditoria[] = dados.logs.map((l: any) => ({
    id: l.id,
    tabela: l.tabela,
    registro_id: l.registro_id,
    operacao: l.operacao,
    dados_antes: lerJsonAuditoria(l.dados_antes),
    dados_depois: lerJsonAuditoria(l.dados_depois),
    campos_alterados: lerCamposAlterados(l.campos_alterados),
    usuario_id: l.usuario_id,
    usuario_nome: l.usuario_nome,
    protocolo: l.protocolo,
    ip: l.ip,
    criado_em: l.criado_em ? new Date(l.criado_em).toISOString() : new Date().toISOString(),
  }));

  return (
    <PainelAuditoria
      logs={logsFormatados}
      totalRegistros={dados.total}
      paginaAtual={pagina}
      porPagina={porPagina}
      filtrosAtuais={params}
    />
  );
}
