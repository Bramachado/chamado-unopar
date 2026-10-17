import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { TabelaChamados } from "./tabela-chamados";
import { COLUNAS_CHAMADO, JUNCOES_CHAMADO, mapearChamado } from "@/lib/chamados/repositorio";
import { lerFiltros, montarWhere, sqlResumoPrazos } from "@/lib/chamados/filtros";
import { adicionarDiasCorridos, hojeCivil, instanteDoBanco, paraParametroDate } from "@/lib/datas";
import { REGRA_SLA } from "@/lib/sla";
import type { Motivo, Polo } from "@/types/database";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaChamados({ searchParams }: PageProps) {
  const perfilAtual = await obterPerfilAtual();
  const filtros = lerFiltros(await searchParams, perfilAtual);
  const hoje = hojeCivil();

  const dados = await comTransacao(
    { usuario_id: perfilAtual.id, papel: perfilAtual.papel },
    async (_req, tx) => {
      const reqLista = novaRequisicao(tx);
      const where = montarWhere(reqLista, perfilAtual, filtros, hoje);
      reqLista
        .input("offset", sql.Int, (filtros.pagina - 1) * filtros.por_pagina)
        .input("limite", sql.Int, filtros.por_pagina);
      const lista = await reqLista.query(`
      SELECT COUNT(*) OVER () AS total_filtrado, ${COLUNAS_CHAMADO}
      FROM dados.chamados c
      ${JUNCOES_CHAMADO}
      ${where}
      ORDER BY c.data_solicitacao DESC, c.criado_em DESC
      OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY`);

      const reqResumo = novaRequisicao(tx)
        .input("r_hoje", sql.Date, paraParametroDate(hoje))
        .input(
          "r_limite",
          sql.Date,
          paraParametroDate(adicionarDiasCorridos(hoje, REGRA_SLA.alertaVencendoEmDiasCorridos))
        );
      const resumo = await reqResumo.query(
        sqlResumoPrazos(
          montarWhere(reqResumo, perfilAtual, filtros, hoje, { semFiltroPrazo: true })
        )
      );

      const motivos = await novaRequisicao(tx).query(
        "SELECT CAST(id AS NVARCHAR(50)) AS id, numero, codigo, nome, nome_normalizado, ativo, criado_em FROM dados.motivos ORDER BY numero"
      );
      const reqPolos = novaRequisicao(tx);
      let filtroPolo = "";
      if (perfilAtual.papel !== "admin" && perfilAtual.polo_id) {
        reqPolos.input("meu_polo", sql.UniqueIdentifier, perfilAtual.polo_id);
        filtroPolo = " AND id = @meu_polo";
      }
      const polos = await reqPolos.query(
        `SELECT CAST(id AS NVARCHAR(50)) AS id, nome, codigo, cidade, estado, ativo, criado_em FROM dados.polos WHERE ativo = 1${filtroPolo} ORDER BY nome`
      );
      return {
        lista: lista.recordset,
        resumo: resumo.recordset[0] ?? {},
        motivos: motivos.recordset,
        polos: polos.recordset,
      };
    }
  );

  const total = Number(dados.lista[0]?.total_filtrado ?? 0);
  const n = (v: unknown) => Number(v ?? 0);

  return (
    <TabelaChamados
      chamados={dados.lista.map(mapearChamado)}
      motivos={dados.motivos.map((m): Motivo => ({
        ...m,
        ativo: Boolean(m.ativo),
        criado_em: instanteDoBanco(m.criado_em) ?? "",
      }))}
      polos={dados.polos.map((p): Polo => ({
        ...p,
        ativo: Boolean(p.ativo),
        criado_em: instanteDoBanco(p.criado_em) ?? "",
      }))}
      perfilAtual={perfilAtual}
      filtros={filtros}
      resumo={{
        pendentes: n(dados.resumo.pendentes),
        vencidos: n(dados.resumo.vencidos),
        vence_hoje: n(dados.resumo.vence_hoje),
        vence_em_breve: n(dados.resumo.vence_em_breve),
      }}
      paginacao={{ pagina: filtros.pagina, porPagina: filtros.por_pagina, total }}
    />
  );
}
