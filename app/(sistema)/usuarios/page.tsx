import { redirect } from "next/navigation";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { PainelUsuarios } from "./painel-usuarios";
import { type Perfil, type Polo } from "@/types/database";

interface UsuarioComCredencial extends Perfil {
  tem_credencial_externa?: boolean;
}

export default async function PaginaUsuarios() {
  const perfil = await obterPerfilAtual();

  if (perfil.papel !== "admin") {
    redirect("/painel");
  }

  let listaUsuariosDb: any[] = [];
  let listaPolosDb: any[] = [];
  let listaAcessosDb: any[] = [];

  try {
    const dados = await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
      const batch = await req.query(`
        -- 1. Usuários e seus avatares mais recentes
        SELECT 
          CAST(p.id AS NVARCHAR(50)) AS id,
          p.nome_completo,
          p.email,
          p.papel,
          p.ativo,
          CAST(p.polo_id AS NVARCHAR(50)) AS polo_id,
          pol.nome AS polo_nome,
          pol.cidade AS polo_cidade,
          CASE WHEN ce.perfil_id IS NOT NULL THEN 1 ELSE 0 END AS tem_credencial_externa,
          av.dados_depois AS avatar_json,
          av.operacao AS avatar_operacao,
          p.criado_em,
          p.atualizado_em
        FROM dados.perfis p
        LEFT JOIN dados.polos pol ON pol.id = p.polo_id
        LEFT JOIN dados.credenciais_externas ce ON ce.perfil_id = p.id
        OUTER APPLY (
          SELECT TOP 1 dados_depois, operacao
          FROM auditoria.logs
          WHERE tabela = 'perfis_avatar' AND registro_id = p.id
          ORDER BY id DESC
        ) av
        WHERE p.email NOT LIKE 'excluido_%'
          AND p.email NOT LIKE 'teste.%'
          AND p.nome_completo <> 'Conta Teste Desativada'
        ORDER BY p.nome_completo ASC;

        -- 2. Polos ativos
        SELECT 
          CAST(id AS NVARCHAR(50)) AS id,
          nome,
          codigo,
          cidade,
          estado,
          ativo,
          criado_em
        FROM dados.polos
        WHERE ativo = 1
        ORDER BY nome ASC;

        -- 3. Acessos recentes do cofre
        SELECT TOP 10
          a.id,
          CAST(a.perfil_alvo AS NVARCHAR(50)) AS perfil_alvo_id,
          CAST(a.admin_id AS NVARCHAR(50)) AS acessado_por,
          a.data_hora,
          a.ip,
          a.user_agent,
          pAlvo.nome_completo AS perfil_alvo_nome,
          pAdmin.nome_completo AS admin_nome
        FROM auditoria.credencial_acessos a
        LEFT JOIN dados.perfis pAlvo ON pAlvo.id = a.perfil_alvo
        LEFT JOIN dados.perfis pAdmin ON pAdmin.id = a.admin_id
        ORDER BY a.data_hora DESC;
      `);

      const rsets = (batch.recordsets || []) as any[];

      return {
        usuarios: (rsets[0] || []) as any[],
        polos: (rsets[1] || []) as any[],
        acessos: (rsets[2] || []) as any[],
      };
    });

    listaUsuariosDb = dados.usuarios;
    listaPolosDb = dados.polos;
    listaAcessosDb = dados.acessos;
  } catch (err) {
    console.error("Erro ao carregar dados em /usuarios:", err);
  }

  const usuariosFormatados: UsuarioComCredencial[] = listaUsuariosDb.map((u: any) => {
    let avatarUrl: string | null = null;
    if (u.avatar_json && u.avatar_operacao !== "DELETE") {
      try {
        const parsed = JSON.parse(u.avatar_json);
        avatarUrl = parsed.avatar || null;
      } catch {}
    }

    return {
      id: u.id,
      nome_completo: u.nome_completo || "Sem nome",
      email: u.email || "",
      papel: u.papel || "atendente",
      ativo: Boolean(u.ativo),
      polo_id: u.polo_id || null,
      polo_nome: u.polo_nome || null,
      polo_cidade: u.polo_cidade || null,
      avatar_url: avatarUrl,
      tem_credencial_externa: Boolean(u.tem_credencial_externa),
      criado_em: u.criado_em ? new Date(u.criado_em).toISOString() : new Date().toISOString(),
      atualizado_em: u.atualizado_em
        ? new Date(u.atualizado_em).toISOString()
        : new Date().toISOString(),
    };
  });

  const polosFormatados: Polo[] = listaPolosDb.map((p: any) => ({
    id: p.id,
    nome: p.nome,
    codigo: p.codigo,
    cidade: p.cidade,
    estado: p.estado,
    ativo: Boolean(p.ativo),
    criado_em: p.criado_em ? new Date(p.criado_em).toISOString() : new Date().toISOString(),
  }));

  const acessosFormatados = listaAcessosDb.map((a: any) => ({
    id: a.id,
    perfil_alvo: a.perfil_alvo_id,
    admin_id: a.acessado_por,
    data_hora: a.data_hora ? new Date(a.data_hora).toISOString() : new Date().toISOString(),
    ip: a.ip,
    user_agent: a.user_agent,
    perfil_alvo_nome: a.perfil_alvo_nome,
    admin_nome: a.admin_nome,
  }));

  return (
    <PainelUsuarios
      usuarios={usuariosFormatados}
      polos={polosFormatados}
      acessosRecentes={acessosFormatados as any}
      perfilAtualId={perfil.id}
    />
  );
}
