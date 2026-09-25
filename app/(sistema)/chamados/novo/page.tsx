import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { FormularioChamado } from "../formulario-chamado";
import { type Motivo, type Polo } from "@/types/database";

export default async function PaginaNovoChamado() {
  const perfil = await obterPerfilAtual();

  const dados = await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
    const qMotivos = await req.query(`
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

    let sqlPolos =
      "SELECT CAST(id AS NVARCHAR(50)) AS id, nome, codigo, cidade, estado, ativo, criado_em FROM dados.polos WHERE ativo = 1";
    if (perfil.papel !== "admin" && perfil.polo_id) {
      req.input("meuPoloId", sql.UniqueIdentifier, perfil.polo_id);
      sqlPolos += " AND id = @meuPoloId";
    }
    sqlPolos += " ORDER BY nome ASC";
    const qPolos = await req.query(sqlPolos);

    return {
      motivos: qMotivos.recordset,
      polos: qPolos.recordset,
    };
  });

  const motivosFormatados: Motivo[] = dados.motivos.map((m: any) => ({
    id: m.id,
    numero: m.numero,
    codigo: m.codigo,
    nome: m.nome,
    nome_normalizado: m.nome_normalizado,
    ativo: Boolean(m.ativo),
    criado_em: m.criado_em ? new Date(m.criado_em).toISOString() : new Date().toISOString(),
  }));

  const polosFormatados: Polo[] = dados.polos.map((p: any) => ({
    id: p.id,
    nome: p.nome,
    codigo: p.codigo,
    cidade: p.cidade,
    estado: p.estado,
    ativo: Boolean(p.ativo),
    criado_em: p.criado_em ? new Date(p.criado_em).toISOString() : new Date().toISOString(),
  }));

  return (
    <FormularioChamado
      motivos={motivosFormatados}
      polos={polosFormatados}
      poloUsuario={perfil.polo_id}
    />
  );
}
