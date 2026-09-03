import { type NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";

export async function GET(request: NextRequest) {
  const perfil = await obterPerfilAtual();
  if (perfil.papel !== "admin") {
    return new NextResponse("Acesso restrito a administradores", { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;

  const logs = await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      let whereClause = "WHERE 1=1";

      const busca = searchParams.get("busca");
      if (busca && busca.trim() !== "") {
        const termo = busca.trim();
        req.input("termo", sql.VarChar(255), `%${termo}%`);
        req.input("termoPrefixo", sql.VarChar(50), `${termo}%`);
        whereClause += " AND (protocolo LIKE @termoPrefixo OR usuario_nome LIKE @termo)";
      }

      const tabela = searchParams.get("tabela");
      if (tabela) {
        req.input("tabela", sql.VarChar(50), tabela);
        whereClause += " AND tabela = @tabela";
      }

      const operacao = searchParams.get("operacao");
      if (operacao) {
        req.input("operacao", sql.VarChar(10), operacao);
        whereClause += " AND operacao = @operacao";
      }

      const dataInicio = searchParams.get("data_inicio");
      if (dataInicio) {
        req.input("data_inicio", sql.DateTimeOffset, new Date(dataInicio));
        whereClause += " AND criado_em >= @data_inicio";
      }

      const dataFim = searchParams.get("data_fim");
      if (dataFim) {
        req.input("data_fim", sql.DateTimeOffset, new Date(dataFim + "T23:59:59.999Z"));
        whereClause += " AND criado_em <= @data_fim";
      }

      const q = await req.query(`
        SELECT 
          id,
          tabela,
          registro_id,
          operacao,
          dados_antes,
          dados_depois,
          campos_alterados,
          usuario_nome,
          protocolo,
          ip,
          criado_em
        FROM auditoria.logs
        ${whereClause}
        ORDER BY criado_em DESC
      `).catch(() => ({ recordset: [] }));

      return q.recordset;
    }
  );

  const cabecalho = [
    "ID",
    "Data Hora",
    "Operação",
    "Tabela",
    "Protocolo",
    "Operador",
    "IP",
    "Campos Alterados",
    "Dados Antes (JSON)",
    "Dados Depois (JSON)",
  ];

  const escapeCSV = (val?: string | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const linhas = logs.map((l: any) => [
    escapeCSV(String(l.id)),
    escapeCSV(format(new Date(l.criado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })),
    escapeCSV(l.operacao),
    escapeCSV(l.tabela),
    escapeCSV(l.protocolo || ""),
    escapeCSV(l.usuario_nome || "Sistema"),
    escapeCSV(l.ip || "127.0.0.1"),
    escapeCSV(Array.isArray(l.campos_alterados) ? l.campos_alterados.join(", ") : l.campos_alterados || ""),
    escapeCSV(typeof l.dados_antes === "string" ? l.dados_antes : JSON.stringify(l.dados_antes || "")),
    escapeCSV(typeof l.dados_depois === "string" ? l.dados_depois : JSON.stringify(l.dados_depois || "")),
  ].join(";"));

  const conteudoCSV = "\uFEFF" + [cabecalho.join(";"), ...linhas].join("\r\n");
  const nomeArquivo = `auditoria_unopar_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(conteudoCSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
