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

  const dados = await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
    const qUsuarios = await req.query(`
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
          p.criado_em,
          p.atualizado_em
        FROM dados.perfis p
        LEFT JOIN dados.polos pol ON pol.id = p.polo_id
        LEFT JOIN dados.credenciais_externas ce ON ce.perfil_id = p.id
        ORDER BY p.nome_completo ASC
      `);

    const qPolos = await req.query(`
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
        ORDER BY nome ASC
      `);

    const qAcessos = await req
      .query(
        `
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
        ORDER BY a.data_hora DESC
      `
      )
      .catch(() => ({ recordset: [] })); // Resiliente

    return {
      usuarios: qUsuarios.recordset,
      polos: qPolos.recordset,
      acessos: qAcessos.recordset,
    };
  });

  const usuariosFormatados: UsuarioComCredencial[] = dados.usuarios.map((u: any) => ({
    id: u.id,
    nome_completo: u.nome_completo,
    email: u.email,
    papel: u.papel,
    ativo: Boolean(u.ativo),
    polo_id: u.polo_id || null,
    polo_nome: u.polo_nome || null,
    polo_cidade: u.polo_cidade || null,
    tem_credencial_externa: Boolean(u.tem_credencial_externa),
    criado_em: u.criado_em ? new Date(u.criado_em).toISOString() : new Date().toISOString(),
    atualizado_em: u.atualizado_em
      ? new Date(u.atualizado_em).toISOString()
      : new Date().toISOString(),
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

  const acessosFormatados = dados.acessos.map((a: any) => ({
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
