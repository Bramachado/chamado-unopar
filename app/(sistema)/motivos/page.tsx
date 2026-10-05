import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { PainelMotivos } from "./painel-motivos";

export default async function PaginaMotivos() {
  const perfil = await obterPerfilAtual();

  const motivos = await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
    // Verifica se a coluna filtro já existe na tabela dados.motivos
    const checkCol = await req.query(`
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dados.motivos') AND name = 'filtro'
      `);
    const temColunaFiltro = checkCol.recordset.length > 0;
    const colunaFiltroSql = temColunaFiltro
      ? "m.filtro,"
      : "CAST(NULL AS NVARCHAR(500)) AS filtro,";
    const groupByFiltroSql = temColunaFiltro ? ", m.filtro" : "";

    const q = await req.query(`
        SELECT 
          CAST(m.id AS NVARCHAR(50)) AS id,
          m.numero,
          m.codigo,
          m.nome,
          m.nome_normalizado,
          ${colunaFiltroSql}
          m.ativo,
          m.criado_em,
          COUNT(c.id) AS total_chamados
        FROM dados.motivos m
        LEFT JOIN dados.chamados c ON c.motivo_id = m.id AND c.excluido_em IS NULL
        GROUP BY m.id, m.numero, m.codigo, m.nome, m.nome_normalizado, m.ativo, m.criado_em ${groupByFiltroSql}
        ORDER BY m.numero ASC, m.codigo ASC
      `);
    return q.recordset;
  });

  const motivosFormatados = motivos.map((m: any) => ({
    id: m.id,
    numero: m.numero,
    codigo: m.codigo,
    nome: m.nome,
    nome_normalizado: m.nome_normalizado,
    filtro: m.filtro || null,
    ativo: Boolean(m.ativo),
    criado_em: m.criado_em ? new Date(m.criado_em).toISOString() : new Date().toISOString(),
    total_chamados: Number(m.total_chamados) || 0,
  }));

  return <PainelMotivos motivos={motivosFormatados} perfilAtual={perfil} />;
}
