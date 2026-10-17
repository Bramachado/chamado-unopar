import { type NextRequest, NextResponse } from "next/server";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { podeVerAuditoria } from "@/lib/auth/autorizacao";
import { montarWhereAuditoria } from "@/lib/auditoria/filtros";
import { lerCamposAlterados, lerJsonAuditoria } from "@/lib/auditoria/redacao";
import { formatarInstante, hojeCivil } from "@/lib/datas";
import { montarCsv } from "@/lib/utils/csv";

const LIMITE = 50_000;

export async function GET(request: NextRequest) {
  const perfil = await obterPerfilAtual();
  if (!podeVerAuditoria(perfil)) {
    return new NextResponse("Acesso restrito a administradores", { status: 403 });
  }
  const p = request.nextUrl.searchParams;

  const logs = await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
    const where = montarWhereAuditoria(req, {
      busca: p.get("busca") ?? undefined,
      tabela: p.get("tabela") ?? undefined,
      operacao: p.get("operacao") ?? undefined,
      data_inicio: p.get("data_inicio") ?? undefined,
      data_fim: p.get("data_fim") ?? undefined,
    });
    req.input("limite", sql.Int, LIMITE);
    const q = await req.query(`
      SELECT TOP (@limite) id, tabela, registro_id, operacao, dados_antes, dados_depois, campos_alterados,
        usuario_nome, protocolo, ip, origem, criado_em
      FROM auditoria.logs ${where}
      ORDER BY id DESC`);
    return q.recordset;
  });

  const csv = montarCsv(
    [
      "ID",
      "Data e hora",
      "Operação",
      "Tabela",
      "Registro",
      "Protocolo",
      "Operador",
      "Origem",
      "IP",
      "Campos alterados",
      "Dados antes (JSON)",
      "Dados depois (JSON)",
    ],
    logs.map((l) => [
      String(l.id),
      formatarInstante(l.criado_em, { segundos: true }),
      l.operacao,
      l.tabela,
      l.registro_id ? String(l.registro_id) : "",
      l.protocolo ?? "",
      l.usuario_nome ?? "Sistema/manual",
      l.origem ?? "",
      l.ip ?? "não registrado",
      (lerCamposAlterados(l.campos_alterados) ?? []).join(", "),
      JSON.stringify(lerJsonAuditoria(l.dados_antes) ?? ""),
      JSON.stringify(lerJsonAuditoria(l.dados_depois) ?? ""),
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria_${hojeCivil()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
