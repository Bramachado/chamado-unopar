/**
 * Catálogo de motivos: criação/edição com aviso de semelhança, duplicidade exata barrada pelo
 * índice único do banco (uq_motivos_chave_ativa) e consolidação rastreável.
 */
import { z } from "zod";
import { sql } from "@/lib/db/pool";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { podeConsolidarMotivos, podeGerirMotivos } from "@/lib/auth/autorizacao";
import { ErroNegocio, type PerfilServico } from "@/lib/chamados/repositorio";
import {
  encontrarSemelhantes,
  padronizarNome,
  type MotivoComparavel,
  type Semelhanca,
} from "./normalizacao";

export async function listarCatalogo(req: sql.Request): Promise<MotivoComparavel[]> {
  const q = await req.query(
    "SELECT CAST(id AS NVARCHAR(50)) AS id, codigo, nome, filtro, ativo FROM dados.motivos"
  );
  return q.recordset.map((m) => ({ ...m, ativo: Boolean(m.ativo) }));
}

const motivoSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  nome: z.string().trim().min(3, "O nome deve ter pelo menos 3 caracteres.").max(200),
  filtro: z.string().trim().max(500).optional().nullable(),
  descricao: z.string().trim().max(500).optional().nullable(),
  confirmarSemelhante: z.boolean().optional(),
});

export type ResultadoSalvarMotivo =
  { ok: true; id: string } | { ok: false; semelhantes: Semelhanca[]; mensagem: string };

const ehViolacaoUnica = (e: unknown) =>
  e instanceof Error && /2601|2627|duplicate key|UNIQUE KEY|uq_motivos/i.test(e.message);

export async function salvarMotivo(
  perfil: PerfilServico,
  entrada: z.input<typeof motivoSchema>,
  opcoes: { ip?: string | null } = {}
): Promise<ResultadoSalvarMotivo> {
  if (!podeGerirMotivos(perfil)) {
    throw new ErroNegocio(
      "Apenas administração e coordenação podem alterar o catálogo de motivos.",
      {},
      "proibido"
    );
  }
  const p = motivoSchema.safeParse(entrada);
  if (!p.success) throw new ErroNegocio(p.error.issues[0]?.message ?? "Dados inválidos.");
  const nome = padronizarNome(p.data.nome);
  const filtro = p.data.filtro ? padronizarNome(p.data.filtro) : null;

  try {
    return await comTransacao(
      { usuario_id: perfil.id, papel: perfil.papel, ip: opcoes.ip },
      async (_r, tx) => {
        // Trava o catálogo para serializar criações simultâneas (número sequencial + chave única)
        await novaRequisicao(tx).query(
          "SELECT COUNT(*) AS n FROM dados.motivos WITH (TABLOCKX, HOLDLOCK)"
        );
        const catalogo = await listarCatalogo(novaRequisicao(tx));
        const semelhantes = encontrarSemelhantes(
          { nome, filtro, id: p.data.id ?? undefined },
          catalogo.filter((m) => m.ativo)
        );
        const exatos = semelhantes.filter((s) => s.tipo === "duplicado_exato");
        if (exatos.length > 0) {
          return {
            ok: false as const,
            semelhantes: exatos,
            mensagem: `Já existe o motivo ativo ${exatos[0]!.motivo.codigo} com o mesmo nome e caminho.`,
          };
        }
        if (semelhantes.length > 0 && !p.data.confirmarSemelhante && !p.data.id) {
          return {
            ok: false as const,
            semelhantes,
            mensagem:
              "Existem motivos semelhantes no catálogo. Verifique se algum já atende antes de criar outro.",
          };
        }
        const req = novaRequisicao(tx)
          .input("nome", sql.NVarChar(200), nome)
          .input("filtro", sql.NVarChar(500), filtro)
          .input("descricao", sql.NVarChar(500), p.data.descricao || null)
          .input("usuario", sql.UniqueIdentifier, perfil.id);
        if (p.data.id) {
          const r = await req.input("id", sql.UniqueIdentifier, p.data.id).query(`
          UPDATE dados.motivos SET nome = @nome, filtro = @filtro, descricao = @descricao WHERE id = @id`);
          if (r.rowsAffected[0] !== 1)
            throw new ErroNegocio("Motivo não encontrado.", {}, "nao_encontrado");
          return { ok: true as const, id: p.data.id };
        }
        const r = await req.query(`
        DECLARE @numero INT = (SELECT ISNULL(MAX(numero), 0) + 1 FROM dados.motivos);
        DECLARE @out TABLE (id UNIQUEIDENTIFIER);
        INSERT INTO dados.motivos (numero, nome, filtro, descricao, ativo, criado_por)
        OUTPUT inserted.id INTO @out VALUES (@numero, @nome, @filtro, @descricao, 1, @usuario);
        SELECT CAST(id AS NVARCHAR(50)) AS id FROM @out;`);
        return { ok: true as const, id: r.recordset[0].id as string };
      }
    );
  } catch (e) {
    if (ehViolacaoUnica(e)) {
      throw new ErroNegocio(
        "Já existe um motivo com este nome (ou mesmo nome e caminho) no catálogo."
      );
    }
    throw e;
  }
}

export async function alternarStatusMotivo(
  perfil: PerfilServico,
  id: string,
  ativo: boolean,
  opcoes: { ip?: string | null } = {}
) {
  if (!podeGerirMotivos(perfil)) {
    throw new ErroNegocio(
      "Apenas administração e coordenação podem alterar o catálogo de motivos.",
      {},
      "proibido"
    );
  }
  try {
    await comTransacao({ usuario_id: perfil.id, papel: perfil.papel, ip: opcoes.ip }, (req) =>
      req
        .input("id", sql.UniqueIdentifier, id)
        .input("ativo", sql.Bit, ativo)
        .query(
          "UPDATE dados.motivos SET ativo = @ativo WHERE id = @id AND (consolidado_para_id IS NULL OR @ativo = 0)"
        )
    );
  } catch (e) {
    if (ehViolacaoUnica(e))
      throw new ErroNegocio("Há outro motivo ativo com o mesmo nome e caminho; consolide-os.");
    throw e;
  }
}

/**
 * Consolida `origem` em `destino`: move os chamados (cada um com evento e auditoria), desativa a
 * origem e registra destino, autor, data e justificativa. Decisão humana, nunca automática.
 */
export async function consolidarMotivos(
  perfil: PerfilServico,
  origemId: string,
  destinoId: string,
  justificativa: string,
  opcoes: { ip?: string | null } = {}
): Promise<number> {
  if (!podeConsolidarMotivos(perfil))
    throw new ErroNegocio("Apenas administradores podem consolidar motivos.", {}, "proibido");
  if (origemId.toLowerCase() === destinoId.toLowerCase())
    throw new ErroNegocio("Escolha motivos diferentes.");
  if (justificativa.trim().length < 10)
    throw new ErroNegocio("Justifique a consolidação (mínimo de 10 caracteres).");
  return comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel, ip: opcoes.ip },
    async (_r, tx) => {
      const ms = await novaRequisicao(tx)
        .input("o", sql.UniqueIdentifier, origemId)
        .input("d", sql.UniqueIdentifier, destinoId)
        .query(
          `SELECT CAST(id AS NVARCHAR(50)) AS id, codigo, nome, ativo FROM dados.motivos WITH (UPDLOCK) WHERE id IN (@o, @d)`
        );
      const origem = ms.recordset.find((m) => m.id.toLowerCase() === origemId.toLowerCase());
      const destino = ms.recordset.find((m) => m.id.toLowerCase() === destinoId.toLowerCase());
      if (!origem || !destino)
        throw new ErroNegocio("Motivo não encontrado.", {}, "nao_encontrado");
      if (!destino.ativo) throw new ErroNegocio("O motivo de destino precisa estar ativo.");
      const texto = `Motivo ${origem.codigo} "${origem.nome}" consolidado em ${destino.codigo} "${destino.nome}": ${justificativa.trim()}`;
      const r = await novaRequisicao(tx)
        .input("o", sql.UniqueIdentifier, origemId)
        .input("d", sql.UniqueIdentifier, destinoId)
        .input("usuario", sql.UniqueIdentifier, perfil.id)
        .input("usuario_nome", sql.NVarChar(200), perfil.nome_completo.slice(0, 200))
        .input("texto", sql.NVarChar(sql.MAX), texto)
        .input(
          "dados",
          sql.NVarChar(sql.MAX),
          JSON.stringify({ motivo_origem: origemId, motivo_destino: destinoId })
        )
        .input("just", sql.NVarChar(500), justificativa.trim().slice(0, 500)).query(`
        DECLARE @afetados TABLE (id UNIQUEIDENTIFIER);
        UPDATE dados.chamados SET motivo_id = @d, atualizado_por = @usuario, atualizado_por_nome = @usuario_nome,
          atualizado_em = SYSDATETIMEOFFSET()
        OUTPUT inserted.id INTO @afetados
        WHERE motivo_id = @o;
        INSERT INTO dados.chamado_eventos (chamado_id, tipo, texto, dados_json, criado_por, criado_por_nome, ip)
        SELECT id, 'consolidacao_motivo', @texto, @dados, @usuario, @usuario_nome, CAST(SESSION_CONTEXT(N'ip') AS VARCHAR(45))
        FROM @afetados;
        UPDATE dados.motivos SET ativo = 0, consolidado_para_id = @d, consolidado_em = SYSDATETIMEOFFSET(),
          consolidado_por = @usuario, consolidacao_justificativa = @just
        WHERE id = @o;
        SELECT COUNT(*) AS n FROM @afetados;`);
      return Number(r.recordset[0].n);
    }
  );
}
