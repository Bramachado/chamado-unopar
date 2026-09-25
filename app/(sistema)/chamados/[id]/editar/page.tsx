import { notFound } from "next/navigation";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { FormularioChamado } from "../../formulario-chamado";
import { type Chamado, type Motivo, type Polo } from "@/types/database";

interface EditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PaginaEditarChamado({ params }: EditPageProps) {
  const { id } = await params;
  const perfil = await obterPerfilAtual();

  const dados = await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
    req.input("id", sql.UniqueIdentifier, id);

    const qChamado = await req.query(`
        SELECT 
          CAST(id AS NVARCHAR(50)) AS id,
          protocolo,
          aluno_nome,
          aluno_ra,
          aluno_cpf,
          CAST(polo_id AS NVARCHAR(50)) AS polo_id,
          contato_telefone,
          CAST(motivo_id AS NVARCHAR(50)) AS motivo_id,
          descricao,
          situacao,
          prioridade,
          data_solicitacao,
          prazo,
          data_conclusao,
          CAST(chamado_vinculado_id AS NVARCHAR(50)) AS chamado_vinculado_id,
          observacao,
          importado,
          CAST(criado_por AS NVARCHAR(50)) AS criado_por,
          criado_por_nome,
          CAST(atualizado_por AS NVARCHAR(50)) AS atualizado_por,
          atualizado_por_nome,
          criado_em,
          atualizado_em
        FROM dados.chamados
        WHERE id = @id AND excluido_em IS NULL
      `);

    const chamado = qChamado.recordset[0];
    if (!chamado) return null;

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

    let chamadoVinculado = null;
    if (chamado.chamado_vinculado_id) {
      req.input("vincId", sql.UniqueIdentifier, chamado.chamado_vinculado_id);
      const qVinc = await req.query(`
          SELECT 
            CAST(id AS NVARCHAR(50)) AS id,
            protocolo,
            aluno_nome
          FROM dados.chamados
          WHERE id = @vincId
        `);
      chamadoVinculado = qVinc.recordset[0] || null;
    }

    return {
      chamado,
      motivos: qMotivos.recordset,
      polos: qPolos.recordset,
      chamadoVinculado,
    };
  });

  if (!dados || !dados.chamado) {
    notFound();
  }

  const { chamado, motivos, polos, chamadoVinculado } = dados;

  const chamadoFormatado: Chamado = {
    id: chamado.id,
    protocolo: chamado.protocolo,
    aluno_nome: chamado.aluno_nome,
    aluno_ra: chamado.aluno_ra,
    aluno_cpf: chamado.aluno_cpf,
    polo_id: chamado.polo_id,
    contato_telefone: chamado.contato_telefone,
    motivo_id: chamado.motivo_id,
    descricao: chamado.descricao,
    situacao: chamado.situacao,
    prioridade: chamado.prioridade,
    data_solicitacao: chamado.data_solicitacao
      ? new Date(chamado.data_solicitacao).toISOString().slice(0, 10)
      : "",
    prazo: chamado.prazo ? new Date(chamado.prazo).toISOString().slice(0, 10) : "",
    data_conclusao: chamado.data_conclusao ? new Date(chamado.data_conclusao).toISOString() : null,
    chamado_vinculado_id: chamado.chamado_vinculado_id,
    observacao: chamado.observacao,
    importado: Boolean(chamado.importado),
    criado_por: chamado.criado_por,
    criado_por_nome: chamado.criado_por_nome,
    atualizado_por: chamado.atualizado_por,
    atualizado_por_nome: chamado.atualizado_por_nome,
    criado_em: chamado.criado_em
      ? new Date(chamado.criado_em).toISOString()
      : new Date().toISOString(),
    atualizado_em: chamado.atualizado_em
      ? new Date(chamado.atualizado_em).toISOString()
      : new Date().toISOString(),
  };

  const motivosFormatados: Motivo[] = motivos.map((m: any) => ({
    id: m.id,
    numero: m.numero,
    codigo: m.codigo,
    nome: m.nome,
    nome_normalizado: m.nome_normalizado,
    ativo: Boolean(m.ativo),
    criado_em: m.criado_em ? new Date(m.criado_em).toISOString() : new Date().toISOString(),
  }));

  const polosFormatados: Polo[] = polos.map((p: any) => ({
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
      chamadoInicial={chamadoFormatado}
      motivos={motivosFormatados}
      polos={polosFormatados}
      poloUsuario={perfil.polo_id}
      chamadoVinculadoInicial={chamadoVinculado}
    />
  );
}
