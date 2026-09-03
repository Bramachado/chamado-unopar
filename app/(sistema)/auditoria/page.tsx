import { redirect } from "next/navigation";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { PainelAuditoria } from "./painel-auditoria";
import { type LogAuditoria } from "@/types/database";

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
  const pagina = Number(params.pagina) || 1;
  const porPagina = Number(params.por_pagina) || 25;
  const offset = (pagina - 1) * porPagina;

  const dados = await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      let whereClause = "WHERE 1=1";

      if (params.busca && params.busca.trim() !== "") {
        const termo = params.busca.trim();
        req.input("termo", sql.VarChar(255), `%${termo}%`);
        req.input("termoPrefixo", sql.VarChar(50), `${termo}%`);
        whereClause += " AND (protocolo LIKE @termoPrefixo OR usuario_nome LIKE @termo)";
      }

      if (params.tabela) {
        req.input("tabela", sql.VarChar(50), params.tabela);
        whereClause += " AND tabela = @tabela";
      }

      if (params.operacao) {
        req.input("operacao", sql.VarChar(10), params.operacao);
        whereClause += " AND operacao = @operacao";
      }

      if (params.data_inicio) {
        req.input("data_inicio", sql.DateTimeOffset, new Date(params.data_inicio));
        whereClause += " AND criado_em >= @data_inicio";
      }

      if (params.data_fim) {
        req.input("data_fim", sql.DateTimeOffset, new Date(params.data_fim + "T23:59:59.999Z"));
        whereClause += " AND criado_em <= @data_fim";
      }

      req.input("offset", sql.Int, offset);
      req.input("limit", sql.Int, porPagina);

      const qTotal = await req.query(`
        SELECT COUNT(id) AS total
        FROM auditoria.logs
        ${whereClause}
      `).catch(() => ({ recordset: [{ total: 0 }] }));

      const qLogs = await req.query(`
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
      `).catch(() => ({ recordset: [] }));

      return {
        total: qTotal.recordset[0]?.total || 0,
        logs: qLogs.recordset,
      };
    }
  );

  const logsFormatados: LogAuditoria[] = dados.logs.map((l: any) => ({
    id: l.id,
    tabela: l.tabela,
    registro_id: l.registro_id,
    operacao: l.operacao,
    dados_antes: typeof l.dados_antes === "string" ? JSON.parse(l.dados_antes) : l.dados_antes,
    dados_depois: typeof l.dados_depois === "string" ? JSON.parse(l.dados_depois) : l.dados_depois,
    campos_alterados: l.campos_alterados,
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
