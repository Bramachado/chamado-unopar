/**
 * Montagem SQL dos filtros (somente servidor). A parte pura — tipos, leitura dos parâmetros e
 * montagem da query string — fica em ./filtros-comuns para poder ser usada em componentes cliente.
 */
import { sql } from "@/lib/db/pool";
import {
  adicionarDiasCorridos,
  fimDoDiaExclusivoEmUtc,
  inicioDoDiaEmUtc,
  paraParametroDate,
  type DataCivil,
} from "@/lib/datas";
import { REGRA_SLA } from "@/lib/sla";
import { SITUACOES } from "@/lib/chamados/situacoes";
import { escopoDeChamados, type PerfilAutorizacao } from "@/lib/auth/autorizacao";
import { SQL_FINAIS, SQL_PENDENTES, type FiltrosChamados } from "./filtros-comuns";

export * from "./filtros-comuns";

/**
 * Monta o WHERE (alias "c") com escopo de autorização + filtros. `semFiltroPrazo` permite calcular
 * os contadores dos cartões de prazo com os demais filtros aplicados.
 */
export function montarWhere(
  req: sql.Request,
  perfil: PerfilAutorizacao,
  f: FiltrosChamados,
  hoje: DataCivil,
  opcoes: { semFiltroPrazo?: boolean } = {}
): string {
  const w: string[] = ["c.excluido_em IS NULL"];
  if (!f.incluir_teste) w.push("c.eh_teste = 0");

  const escopo = escopoDeChamados(perfil);
  if (escopo.tipo === "polo") {
    req.input("f_escopo_polo", sql.UniqueIdentifier, escopo.poloId);
    w.push("c.polo_id = @f_escopo_polo");
  } else if (escopo.tipo === "proprios") {
    req.input("f_escopo_usuario", sql.UniqueIdentifier, escopo.usuarioId);
    w.push("(c.criado_por = @f_escopo_usuario OR c.responsavel_id = @f_escopo_usuario)");
  }
  if (f.escopo === "meus") {
    req.input("f_eu", sql.UniqueIdentifier, perfil.id);
    w.push("COALESCE(c.responsavel_id, c.criado_por) = @f_eu");
  }

  if (f.busca) {
    const digitos = f.busca.replace(/\D/g, "");
    if (digitos.length === 11 && digitos.length === f.busca.replace(/[.\-\s]/g, "").length) {
      req.input("f_cpf", sql.VarChar(11), digitos);
      w.push("c.aluno_cpf = @f_cpf");
    } else {
      req.input("f_busca", sql.NVarChar(120), `%${f.busca}%`);
      req.input("f_prefixo", sql.VarChar(60), `${f.busca}%`);
      w.push(
        "(c.protocolo LIKE @f_prefixo OR c.aluno_nome LIKE @f_busca OR c.aluno_ra LIKE @f_busca)"
      );
    }
  }
  if (f.situacao === "pendentes") w.push(`c.situacao IN ${SQL_PENDENTES}`);
  else if (f.situacao === "finalizados") w.push(`c.situacao IN ${SQL_FINAIS}`);
  else if (f.situacao && (SITUACOES as readonly string[]).includes(f.situacao)) {
    req.input("f_situacao", sql.VarChar(20), f.situacao);
    w.push("c.situacao = @f_situacao");
  }
  if (f.prioridade) {
    req.input("f_prioridade", sql.VarChar(20), f.prioridade);
    w.push("c.prioridade = @f_prioridade");
  }
  if (f.motivo_id) {
    req.input("f_motivo", sql.UniqueIdentifier, f.motivo_id);
    w.push("c.motivo_id = @f_motivo");
  }
  if (f.polo_id) {
    req.input("f_polo", sql.UniqueIdentifier, f.polo_id);
    w.push("c.polo_id = @f_polo");
  }
  if (f.responsavel_id) {
    req.input("f_responsavel", sql.UniqueIdentifier, f.responsavel_id);
    w.push("COALESCE(c.responsavel_id, c.criado_por) = @f_responsavel");
  }
  if (f.abertura_de) {
    req.input("f_ab_de", sql.Date, paraParametroDate(f.abertura_de));
    w.push("c.data_solicitacao >= @f_ab_de");
  }
  if (f.abertura_ate) {
    req.input("f_ab_ate", sql.Date, paraParametroDate(f.abertura_ate));
    w.push("c.data_solicitacao <= @f_ab_ate");
  }
  if (f.conclusao_de) {
    req.input("f_co_de", sql.DateTimeOffset, inicioDoDiaEmUtc(f.conclusao_de));
    w.push("c.data_conclusao >= @f_co_de");
  }
  if (f.conclusao_ate) {
    req.input("f_co_ate", sql.DateTimeOffset, fimDoDiaExclusivoEmUtc(f.conclusao_ate));
    w.push("c.data_conclusao < @f_co_ate");
  }
  if (f.reincidentes) {
    w.push(`EXISTS (SELECT 1 FROM dados.chamados r WHERE r.excluido_em IS NULL AND r.id <> c.id
      AND ((c.aluno_cpf IS NOT NULL AND r.aluno_cpf = c.aluno_cpf)
        OR (c.aluno_cpf IS NULL AND LOWER(LTRIM(RTRIM(r.aluno_nome))) = LOWER(LTRIM(RTRIM(c.aluno_nome))))))`);
  }
  if (f.filtro_prazo && !opcoes.semFiltroPrazo) {
    req.input("f_hoje", sql.Date, paraParametroDate(hoje));
    req.input(
      "f_limite",
      sql.Date,
      paraParametroDate(adicionarDiasCorridos(hoje, REGRA_SLA.alertaVencendoEmDiasCorridos))
    );
    w.push(`c.situacao IN ${SQL_PENDENTES}`);
    if (f.filtro_prazo === "vencidos") w.push("c.prazo < @f_hoje");
    if (f.filtro_prazo === "vence_hoje") w.push("c.prazo = @f_hoje");
    if (f.filtro_prazo === "vence_em_breve") w.push("c.prazo > @f_hoje AND c.prazo <= @f_limite");
    if (f.filtro_prazo === "ate_2_dias") w.push("c.prazo >= @f_hoje AND c.prazo <= @f_limite");
    if (f.filtro_prazo === "no_prazo") w.push("c.prazo > @f_limite");
  }
  return "WHERE " + w.join("\n  AND ");
}

/** Contadores dos cartões de prazo (com os demais filtros, sem o de prazo). */
export function sqlResumoPrazos(where: string): string {
  return `
    SELECT
      SUM(CASE WHEN c.situacao IN ${SQL_PENDENTES} THEN 1 ELSE 0 END) AS pendentes,
      SUM(CASE WHEN c.situacao IN ${SQL_PENDENTES} AND c.prazo < @r_hoje THEN 1 ELSE 0 END) AS vencidos,
      SUM(CASE WHEN c.situacao IN ${SQL_PENDENTES} AND c.prazo = @r_hoje THEN 1 ELSE 0 END) AS vence_hoje,
      SUM(CASE WHEN c.situacao IN ${SQL_PENDENTES} AND c.prazo > @r_hoje AND c.prazo <= @r_limite THEN 1 ELSE 0 END) AS vence_em_breve
    FROM dados.chamados c
    ${where}`;
}
