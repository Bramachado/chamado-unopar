import { notFound } from "next/navigation";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { carregarChamadoAutorizado, listarEventos } from "@/lib/chamados/repositorio";
import { caminhoDeVolta } from "@/lib/chamados/catalogos";
import { escopoDeChamados, podeVerAuditoria } from "@/lib/auth/autorizacao";
import { dataCivilDoBanco, instanteDoBanco } from "@/lib/datas";
import { lerCamposAlterados } from "@/lib/auditoria/redacao";
import { PainelDetalheChamado } from "./painel-detalhe-chamado";

interface DetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltar?: string }>;
}

export default async function PaginaDetalheChamado({ params, searchParams }: DetailPageProps) {
  const { id } = await params;
  const { voltar } = await searchParams;
  const perfilAtual = await obterPerfilAtual();
  const escopo = escopoDeChamados(perfilAtual);

  const dados = await comTransacao(
    { usuario_id: perfilAtual.id, papel: perfilAtual.papel },
    async (_req, tx) => {
      const chamado = await carregarChamadoAutorizado(novaRequisicao(tx), perfilAtual, id);
      if (!chamado) return null;

      const arquivos = await novaRequisicao(tx).input("id", sql.UniqueIdentifier, chamado.id)
        .query(`
      SELECT CAST(id AS NVARCHAR(50)) AS id, CAST(chamado_id AS NVARCHAR(50)) AS chamado_id, nome_original,
        caminho_storage, tamanho_bytes, tipo_mime, descricao, CAST(criado_por AS NVARCHAR(50)) AS criado_por,
        criado_por_nome, criado_em
      FROM dados.arquivos_chamados
      WHERE chamado_id = @id AND excluido_em IS NULL
      ORDER BY criado_em DESC`);

      // Vínculos: só mostra chamados dentro do escopo de polo de quem consulta
      const reqVinc = novaRequisicao(tx)
        .input("id", sql.UniqueIdentifier, chamado.id)
        .input("anterior", sql.UniqueIdentifier, chamado.chamado_vinculado_id ?? null);
      let filtroEscopo = "";
      if (escopo.tipo === "polo") {
        reqVinc.input("polo", sql.UniqueIdentifier, escopo.poloId);
        filtroEscopo = " AND c.polo_id = @polo";
      } else if (escopo.tipo === "proprios") {
        reqVinc.input("usuario", sql.UniqueIdentifier, escopo.usuarioId);
        filtroEscopo = " AND (c.criado_por = @usuario OR c.responsavel_id = @usuario)";
      }
      const vinculos = await reqVinc.query(`
      SELECT CAST(c.id AS NVARCHAR(50)) AS id, c.protocolo, c.aluno_nome, c.situacao,
        CONVERT(CHAR(10), c.data_solicitacao, 23) AS data_solicitacao,
        CASE WHEN c.id = @anterior THEN 'anterior' ELSE 'posterior' END AS relacao
      FROM dados.chamados c
      WHERE c.excluido_em IS NULL AND (c.id = @anterior OR c.chamado_vinculado_id = @id) ${filtroEscopo}`);

      const responsaveis = await novaRequisicao(tx).input(
        "polo",
        sql.UniqueIdentifier,
        chamado.polo_id ?? null
      ).query(`
        SELECT CAST(id AS NVARCHAR(50)) AS id, nome_completo, papel FROM dados.perfis
        WHERE ativo = 1 AND (papel = 'admin' OR polo_id = @polo OR @polo IS NULL)
        ORDER BY nome_completo`);

      const eventos = await listarEventos(novaRequisicao(tx), chamado.id);

      const logs = podeVerAuditoria(perfilAtual)
        ? (
            await novaRequisicao(tx).input("id", sql.UniqueIdentifier, chamado.id).query(`
            SELECT id, operacao, campos_alterados, usuario_nome, ip, criado_em
            FROM auditoria.logs WHERE tabela = 'chamados' AND registro_id = @id
            ORDER BY id DESC`)
          ).recordset
        : [];

      return {
        chamado,
        arquivos: arquivos.recordset,
        vinculos: vinculos.recordset,
        responsaveis: responsaveis.recordset,
        eventos,
        logs,
      };
    }
  );

  if (!dados) notFound();

  const vinculo = (r: Record<string, unknown>) => ({
    id: String(r.id),
    protocolo: String(r.protocolo),
    aluno_nome: String(r.aluno_nome),
    situacao: String(r.situacao),
    data_solicitacao: dataCivilDoBanco(r.data_solicitacao) ?? "",
  });

  return (
    <PainelDetalheChamado
      chamado={dados.chamado}
      arquivos={dados.arquivos.map((a) => ({
        ...a,
        tamanho_bytes: a.tamanho_bytes === null ? null : Number(a.tamanho_bytes),
        criado_em: instanteDoBanco(a.criado_em) ?? "",
      }))}
      chamadoAnterior={
        dados.vinculos.filter((v) => v.relacao === "anterior").map(vinculo)[0] ?? null
      }
      chamadosPosteriores={dados.vinculos.filter((v) => v.relacao === "posterior").map(vinculo)}
      responsaveis={dados.responsaveis}
      eventos={dados.eventos}
      logs={dados.logs.map((l) => ({
        id: Number(l.id),
        operacao: l.operacao,
        campos_alterados: lerCamposAlterados(l.campos_alterados),
        usuario_nome: l.usuario_nome,
        ip: l.ip,
        criado_em: instanteDoBanco(l.criado_em) ?? "",
      }))}
      perfilAtual={perfilAtual}
      voltarPara={caminhoDeVolta(voltar)}
    />
  );
}
