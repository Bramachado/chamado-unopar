import { sql } from "@/lib/db/pool";
import { ehDataCivilValida, fimDoDiaExclusivoEmUtc, inicioDoDiaEmUtc } from "@/lib/datas";
import { TABELAS_TECNICAS } from "./redacao";

export interface FiltrosAuditoria {
  busca?: string;
  tabela?: string;
  operacao?: string;
  data_inicio?: string;
  data_fim?: string;
}

/**
 * WHERE comum da tela e da exportação de auditoria. Datas são dias civis no fuso institucional.
 * Registros técnicos (conteúdo de anexo e foto de perfil) ficam fora, a não ser que a tabela
 * seja pedida explicitamente.
 */
export function montarWhereAuditoria(req: sql.Request, f: FiltrosAuditoria): string {
  const w: string[] = ["1 = 1"];
  if (f.busca?.trim()) {
    req.input("termo", sql.NVarChar(255), `%${f.busca.trim()}%`);
    req.input("termoPrefixo", sql.VarChar(50), `${f.busca.trim()}%`);
    w.push("(protocolo LIKE @termoPrefixo OR usuario_nome LIKE @termo)");
  }
  if (f.tabela) {
    req.input("tabela", sql.VarChar(100), f.tabela);
    w.push("tabela = @tabela");
  } else {
    w.push(`tabela NOT IN (${TABELAS_TECNICAS.map((t) => `'${t}'`).join(", ")})`);
  }
  if (f.operacao && ["INSERT", "UPDATE", "DELETE"].includes(f.operacao)) {
    req.input("operacao", sql.VarChar(10), f.operacao);
    w.push("operacao = @operacao");
  }
  if (f.data_inicio && ehDataCivilValida(f.data_inicio)) {
    req.input("data_inicio", sql.DateTimeOffset, inicioDoDiaEmUtc(f.data_inicio));
    w.push("criado_em >= @data_inicio");
  }
  if (f.data_fim && ehDataCivilValida(f.data_fim)) {
    req.input("data_fim", sql.DateTimeOffset, fimDoDiaExclusivoEmUtc(f.data_fim));
    w.push("criado_em < @data_fim");
  }
  return "WHERE " + w.join(" AND ");
}
