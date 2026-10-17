import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { instanteDoBanco } from "@/lib/datas";
import { paresSemelhantes } from "@/lib/motivos/normalizacao";
import { podeConsolidarMotivos, podeGerirMotivos } from "@/lib/auth/autorizacao";
import { PainelMotivos } from "./painel-motivos";
import type { Motivo } from "@/types/database";

export default async function PaginaMotivos() {
  const perfil = await obterPerfilAtual();

  const linhas = await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
    const q = await req.query(`
      SELECT CAST(m.id AS NVARCHAR(50)) AS id, m.numero, m.codigo, m.nome, m.nome_normalizado, m.filtro,
        m.descricao, m.ativo, m.criado_em, CAST(m.consolidado_para_id AS NVARCHAR(50)) AS consolidado_para_id,
        d.codigo AS consolidado_para_codigo, m.consolidado_em, m.consolidacao_justificativa,
        (SELECT COUNT(*) FROM dados.chamados c WHERE c.motivo_id = m.id AND c.excluido_em IS NULL) AS total_chamados
      FROM dados.motivos m
      LEFT JOIN dados.motivos d ON d.id = m.consolidado_para_id
      ORDER BY m.numero`);
    return q.recordset;
  });

  const motivos: Motivo[] = linhas.map((m) => ({
    id: m.id,
    numero: m.numero,
    codigo: m.codigo,
    nome: m.nome,
    nome_normalizado: m.nome_normalizado,
    filtro: m.filtro ?? null,
    descricao: m.descricao ?? null,
    ativo: Boolean(m.ativo),
    criado_em: instanteDoBanco(m.criado_em) ?? "",
    total_chamados: Number(m.total_chamados) || 0,
    consolidado_para_id: m.consolidado_para_id ?? null,
    consolidado_para_codigo: m.consolidado_para_codigo ?? null,
    consolidado_em: instanteDoBanco(m.consolidado_em),
    consolidacao_justificativa: m.consolidacao_justificativa ?? null,
  }));

  // Pares de ativos semelhantes para revisão humana (nada é unido automaticamente)
  const pares = paresSemelhantes(
    motivos.map((m) => ({
      id: m.id,
      codigo: m.codigo,
      nome: m.nome,
      filtro: m.filtro ?? null,
      ativo: m.ativo,
    }))
  ).map((p) => ({ a: p.a.id, b: p.b.id, tipo: p.tipo, similaridade: p.similaridade }));

  return (
    <PainelMotivos
      motivos={motivos}
      pares={pares}
      podeGerir={podeGerirMotivos(perfil)}
      podeConsolidar={podeConsolidarMotivos(perfil)}
    />
  );
}
