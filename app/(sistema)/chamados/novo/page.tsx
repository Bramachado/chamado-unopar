import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { FormularioChamado } from "../formulario-chamado";
import { type Motivo } from "@/types/database";

export default async function PaginaNovoChamado() {
  const perfil = await obterPerfilAtual();

  const motivos = await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      const q = await req.query(`
        SELECT 
          CAST(id AS NVARCHAR(50)) AS id,
          numero,
          codigo,
          nome,
          nome_normalizado,
          ativo,
          criado_em
        FROM dados.motivos
        WHERE ativo = 1
        ORDER BY numero ASC, codigo ASC
      `);
      return q.recordset;
    }
  );

  const motivosFormatados: Motivo[] = motivos.map((m: any) => ({
    id: m.id,
    numero: m.numero,
    codigo: m.codigo,
    nome: m.nome,
    nome_normalizado: m.nome_normalizado,
    ativo: Boolean(m.ativo),
    criado_em: m.criado_em ? new Date(m.criado_em).toISOString() : new Date().toISOString(),
  }));

  return <FormularioChamado motivos={motivosFormatados} />;
}
