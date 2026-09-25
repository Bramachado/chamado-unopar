import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { TabelaChamados } from "./tabela-chamados";
import { type Motivo, type Polo } from "@/types/database";

interface PageProps {
  searchParams: Promise<{
    busca?: string;
    situacao?: string;
    prioridade?: string;
    motivo_id?: string;
    polo_id?: string;
    data_inicio?: string;
    data_fim?: string;
    reincidentes?: string;
    escopo?: string;
  }>;
}

export default async function PaginaChamados({ searchParams }: PageProps) {
  const perfilAtual = await obterPerfilAtual();
  const params = await searchParams;
  const ehAdmin = perfilAtual.papel === "admin";
  const escopo = params.escopo || (ehAdmin ? "todos" : "meus");

  const resultado = await comUsuario(
    { usuario_id: perfilAtual.id, papel: perfilAtual.papel },
    async (req) => {
      let sqlFiltros = "WHERE c.excluido_em IS NULL";

      // 1. Escopo de visualização: por padrão, colaboradora vê os que ela abriu (escopo === "meus")
      if (escopo === "meus") {
        req.input("meuUsuarioId", sql.UniqueIdentifier, perfilAtual.id);
        sqlFiltros += " AND c.criado_por = @meuUsuarioId";
      }

      // 2. Restrição de Polo: colaboradora associada a um polo só acessa o seu polo
      if (!ehAdmin && perfilAtual.polo_id) {
        req.input("poloUsuarioFixo", sql.UniqueIdentifier, perfilAtual.polo_id);
        sqlFiltros += " AND c.polo_id = @poloUsuarioFixo";
      }

      if (params.busca && params.busca.trim().length > 0) {
        const termo = params.busca.trim();
        const apenasDigitos = termo.replace(/\D/g, "");
        if (apenasDigitos.length === 11) {
          req.input("buscaCpfExato", sql.VarChar(11), apenasDigitos);
          sqlFiltros += " AND c.aluno_cpf = @buscaCpfExato";
        } else {
          req.input("busca", sql.VarChar(255), `%${termo}%`);
          req.input("buscaPrefixo", sql.VarChar(50), `${termo}%`);
          sqlFiltros +=
            " AND (c.protocolo LIKE @buscaPrefixo OR c.aluno_nome LIKE @busca OR c.aluno_ra LIKE @busca)";
        }
      }

      if (params.situacao && params.situacao !== "todos") {
        req.input("situacao", sql.VarChar(30), params.situacao);
        sqlFiltros += " AND c.situacao = @situacao";
      }

      if (params.prioridade && params.prioridade !== "todos") {
        req.input("prioridade", sql.VarChar(20), params.prioridade);
        sqlFiltros += " AND c.prioridade = @prioridade";
      }

      if (params.motivo_id && params.motivo_id !== "todos") {
        req.input("motivo_id", sql.UniqueIdentifier, params.motivo_id);
        sqlFiltros += " AND c.motivo_id = @motivo_id";
      }

      if (params.polo_id && params.polo_id !== "todos") {
        req.input("polo_id", sql.UniqueIdentifier, params.polo_id);
        sqlFiltros += " AND c.polo_id = @polo_id";
      }

      if (params.data_inicio) {
        req.input("data_inicio", sql.DateTimeOffset, new Date(params.data_inicio));
        sqlFiltros += " AND c.data_solicitacao >= @data_inicio";
      }

      if (params.data_fim) {
        req.input("data_fim", sql.DateTimeOffset, new Date(params.data_fim + "T23:59:59.999Z"));
        sqlFiltros += " AND c.data_solicitacao <= @data_fim";
      }

      let sqlPolos =
        "SELECT CAST(id AS NVARCHAR(50)) AS id, nome, codigo, cidade, estado, ativo, criado_em FROM dados.polos WHERE ativo = 1";
      if (!ehAdmin && perfilAtual.polo_id) {
        req.input("meuPoloFiltro", sql.UniqueIdentifier, perfilAtual.polo_id);
        sqlPolos += " AND id = @meuPoloFiltro";
      }
      sqlPolos += " ORDER BY nome ASC";

      const batch = await req.query(`
        -- 1. Chamados mais recentes com limite de segurança
        SELECT TOP 300
          CAST(c.id AS NVARCHAR(50)) AS id,
          c.protocolo,
          c.aluno_nome,
          c.aluno_ra,
          c.aluno_cpf,
          CAST(c.polo_id AS NVARCHAR(50)) AS polo_id,
          pol.nome AS polo_nome,
          pol.cidade AS polo_cidade,
          pol.codigo AS polo_codigo,
          c.contato_telefone,
          CAST(c.motivo_id AS NVARCHAR(50)) AS motivo_id,
          c.descricao,
          c.situacao,
          c.prioridade,
          c.data_solicitacao,
          c.prazo,
          c.data_conclusao,
          CAST(c.chamado_vinculado_id AS NVARCHAR(50)) AS chamado_vinculado_id,
          c.observacao,
          c.importado,
          CAST(c.criado_por AS NVARCHAR(50)) AS criado_por,
          c.criado_por_nome,
          CAST(c.atualizado_por AS NVARCHAR(50)) AS atualizado_por,
          c.atualizado_por_nome,
          c.criado_em,
          c.atualizado_em,
          CAST(m.id AS NVARCHAR(50)) AS motivo_id_join,
          m.codigo AS motivo_codigo,
          m.nome AS motivo_nome,
          CAST(p.id AS NVARCHAR(50)) AS autor_id,
          p.nome_completo AS autor_nome
        FROM dados.chamados c
        LEFT JOIN dados.polos pol ON pol.id = c.polo_id
        LEFT JOIN dados.motivos m ON m.id = c.motivo_id
        LEFT JOIN dados.perfis p ON p.id = c.criado_por
        ${sqlFiltros}
        ORDER BY c.data_solicitacao DESC;

        -- 2. Motivos
        SELECT 
          CAST(id AS NVARCHAR(50)) AS id,
          numero,
          codigo,
          nome,
          nome_normalizado,
          ativo,
          criado_em
        FROM dados.motivos
        ORDER BY numero ASC, codigo ASC;

        -- 3. Polos
        ${sqlPolos};
      `);

      const rsets = batch.recordsets as any[];

      return {
        chamadosBrutos: (rsets[0] || []) as any[],
        motivos: (rsets[1] || []) as any[],
        polos: (rsets[2] || []) as any[],
      };
    }
  );

  const chamadosFormatados = resultado.chamadosBrutos.map((c: any) => ({
    id: c.id,
    protocolo: c.protocolo,
    aluno_nome: c.aluno_nome,
    aluno_ra: c.aluno_ra,
    aluno_cpf: c.aluno_cpf,
    polo_id: c.polo_id,
    polo_nome: c.polo_nome,
    polo_cidade: c.polo_cidade,
    polo_codigo: c.polo_codigo,
    contato_telefone: c.contato_telefone,
    motivo_id: c.motivo_id,
    descricao: c.descricao,
    situacao: c.situacao,
    prioridade: c.prioridade,
    data_solicitacao: c.data_solicitacao
      ? new Date(c.data_solicitacao).toISOString()
      : new Date().toISOString(),
    prazo: c.prazo ? new Date(c.prazo).toISOString() : new Date().toISOString(),
    data_conclusao: c.data_conclusao ? new Date(c.data_conclusao).toISOString() : null,
    chamado_vinculado_id: c.chamado_vinculado_id,
    observacao: c.observacao,
    importado: Boolean(c.importado),
    criado_por: c.criado_por,
    criado_por_nome: c.criado_por_nome || c.autor_nome,
    atualizado_por: c.atualizado_por,
    atualizado_por_nome: c.atualizado_por_nome,
    criado_em: c.criado_em ? new Date(c.criado_em).toISOString() : new Date().toISOString(),
    atualizado_em: c.atualizado_em
      ? new Date(c.atualizado_em).toISOString()
      : new Date().toISOString(),
    motivos: c.motivo_id_join
      ? { id: c.motivo_id_join, codigo: c.motivo_codigo, nome: c.motivo_nome }
      : undefined,
    perfis: c.autor_id ? { id: c.autor_id, nome_completo: c.autor_nome } : undefined,
  }));

  const motivosFormatados: Motivo[] = resultado.motivos.map((m: any) => ({
    id: m.id,
    numero: m.numero,
    codigo: m.codigo,
    nome: m.nome,
    nome_normalizado: m.nome_normalizado,
    ativo: Boolean(m.ativo),
    criado_em: m.criado_em ? new Date(m.criado_em).toISOString() : new Date().toISOString(),
  }));

  const polosFormatados: Polo[] = resultado.polos.map((p: any) => ({
    id: p.id,
    nome: p.nome,
    codigo: p.codigo,
    cidade: p.cidade,
    estado: p.estado,
    ativo: Boolean(p.ativo),
    criado_em: p.criado_em ? new Date(p.criado_em).toISOString() : new Date().toISOString(),
  }));

  return (
    <TabelaChamados
      chamados={chamadosFormatados}
      motivos={motivosFormatados}
      polos={polosFormatados}
      perfilAtual={perfilAtual}
      filtros={params}
    />
  );
}
