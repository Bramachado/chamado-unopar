import { cache } from "react";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { type Perfil } from "@/types/database";
import {
  adicionarDiasCorridos,
  dataCivilDoBanco,
  diferencaDiasCorridos,
  hojeCivil,
  paraParametroDate,
} from "@/lib/datas";
import { REGRA_SLA, classificarPrazo } from "@/lib/sla";
import { montarWhere, lerFiltros } from "@/lib/chamados/filtros";

export interface ItemNotificacaoPrazo {
  id: string;
  protocolo: string;
  aluno_nome: string;
  /** Data civil AAAA-MM-DD. */
  prazo: string;
  situacao: string;
  prioridade: string;
  motivo_nome?: string;
  polo_nome?: string;
  statusPrazo: "vencido" | "vence_hoje" | "vence_breve";
  diasDiferenca: number;
  rotuloPrazo: string;
}

export interface DadosNotificacoesPrazos {
  vencidos: number;
  vencendoBreve: number;
  totalCriticos: number;
  itens: ItemNotificacaoPrazo[];
}

/**
 * Pendências vencidas ou que vencem em até 2 dias corridos, no escopo do usuário e sob sua
 * responsabilidade (admin: todas). Usa a mesma regra de prazo e o mesmo filtro da listagem.
 */
export const obterNotificacoesPrazos = cache(
  async (perfil: Perfil): Promise<DadosNotificacoesPrazos> => {
    try {
      const hoje = hojeCivil();
      const filtros = lerFiltros(
        { escopo: perfil.papel === "admin" ? "todos" : "meus", situacao: "pendentes" },
        perfil
      );
      return await comTransacao(
        { usuario_id: perfil.id, papel: perfil.papel },
        async (_req, tx) => {
          const req = novaRequisicao(tx);
          const where = montarWhere(req, perfil, filtros, hoje);
          req.input(
            "limite_notif",
            sql.Date,
            paraParametroDate(adicionarDiasCorridos(hoje, REGRA_SLA.alertaVencendoEmDiasCorridos))
          );
          const r = await req.query(`
        SELECT TOP 40 CAST(c.id AS NVARCHAR(50)) AS id, c.protocolo, c.aluno_nome,
          CONVERT(CHAR(10), c.prazo, 23) AS prazo, c.situacao, c.prioridade, m.nome AS motivo_nome, pol.nome AS polo_nome
        FROM dados.chamados c
        LEFT JOIN dados.motivos m ON m.id = c.motivo_id
        LEFT JOIN dados.polos pol ON pol.id = c.polo_id
        ${where} AND c.prazo <= @limite_notif
        ORDER BY c.prazo ASC`);

          let vencidos = 0;
          let breve = 0;
          const itens: ItemNotificacaoPrazo[] = r.recordset.map((row) => {
            const prazo = dataCivilDoBanco(row.prazo) ?? hoje;
            const diff = diferencaDiasCorridos(hoje, prazo);
            const classe = classificarPrazo(prazo, hoje);
            if (classe === "vencido") vencidos++;
            else breve++;
            return {
              id: row.id,
              protocolo: row.protocolo,
              aluno_nome: row.aluno_nome,
              prazo,
              situacao: row.situacao,
              prioridade: row.prioridade,
              motivo_nome: row.motivo_nome ?? undefined,
              polo_nome: row.polo_nome ?? undefined,
              statusPrazo:
                classe === "vencido"
                  ? "vencido"
                  : classe === "vence_hoje"
                    ? "vence_hoje"
                    : "vence_breve",
              diasDiferenca: diff,
              rotuloPrazo:
                diff < 0
                  ? diff === -1
                    ? "Vencido ontem"
                    : `Vencido há ${-diff} dias`
                  : diff === 0
                    ? "Vence hoje"
                    : diff === 1
                      ? "Vence amanhã"
                      : `Vence em ${diff} dias`,
            };
          });
          return { vencidos, vencendoBreve: breve, totalCriticos: vencidos + breve, itens };
        }
      );
    } catch (erro) {
      console.error(
        "Erro ao buscar notificações de prazos:",
        erro instanceof Error ? erro.message : erro
      );
      return { vencidos: 0, vencendoBreve: 0, totalCriticos: 0, itens: [] };
    }
  }
);
