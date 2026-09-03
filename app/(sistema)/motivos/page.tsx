import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { PainelMotivos } from "./painel-motivos";

export default async function PaginaMotivos() {
  const perfil = await obterPerfilAtual();

  const motivos = await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      const q = await req.query(`
        SELECT 
          CAST(m.id AS NVARCHAR(50)) AS id,
          m.numero,
          m.codigo,
          m.nome,
          m.nome_normalizado,
          m.ativo,
          m.criado_em,
          COUNT(c.id) AS total_chamados
        FROM dados.motivos m
        LEFT JOIN dados.chamados c ON c.motivo_id = m.id AND c.excluido_em IS NULL
        GROUP BY m.id, m.numero, m.codigo, m.nome, m.nome_normalizado, m.ativo, m.criado_em
        ORDER BY m.numero ASC, m.codigo ASC
      `);
      return q.recordset;
    }
  );

  const motivosFormatados = motivos.map((m: any) => ({
    id: m.id,
    numero: m.numero,
    codigo: m.codigo,
    nome: m.nome,
    nome_normalizado: m.nome_normalizado,
    ativo: Boolean(m.ativo),
    criado_em: m.criado_em ? new Date(m.criado_em).toISOString() : new Date().toISOString(),
    total_chamados: Number(m.total_chamados) || 0,
  }));

  return <PainelMotivos motivos={motivosFormatados} perfilAtual={perfil} />;
}
