import { sql } from "@/lib/db/pool";
import { dataCivilDoBanco, type DataCivil } from "@/lib/datas";

/**
 * Feriados estaduais/municipais/institucionais cadastrados (dados.feriados) que valem para o
 * polo (ou para todos). Os nacionais são calculados em lib/sla.ts.
 * Se a migração 0001 ainda não foi aplicada, retorna lista vazia.
 */
export async function carregarFeriadosExtras(
  req: sql.Request,
  poloId: string | null
): Promise<DataCivil[]> {
  try {
    const r = await req.input("polo_feriado", sql.VarChar(50), poloId).query(`
      SELECT data FROM dados.feriados
      WHERE ativo = 1 AND abrangencia <> 'ponto_facultativo'
        AND (polo_id IS NULL OR polo_id = TRY_CAST(@polo_feriado AS UNIQUEIDENTIFIER))`);
    return r.recordset.map((f) => dataCivilDoBanco(f.data)).filter((d): d is DataCivil => !!d);
  } catch (e) {
    if (/Invalid object name 'dados\.feriados'/i.test((e as Error).message)) return [];
    throw e;
  }
}
