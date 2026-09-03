import { redirect } from "next/navigation";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { PainelUsuarios } from "./painel-usuarios";
import { type Perfil } from "@/types/database";

export default async function PaginaUsuarios() {
  const perfil = await obterPerfilAtual();

  if (perfil.papel !== "admin") {
    redirect("/painel");
  }

  const dados = await comUsuario(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (req) => {
      const qUsuarios = await req.query(`
        SELECT 
          CAST(id AS NVARCHAR(50)) AS id,
          nome_completo,
          email,
          papel,
          ativo,
          criado_em,
          atualizado_em
        FROM dados.perfis
        ORDER BY nome_completo ASC
      `);

      const qAcessos = await req.query(`
        SELECT TOP 10
          a.id,
          CAST(a.perfil_alvo_id AS NVARCHAR(50)) AS perfil_alvo_id,
          CAST(a.acessado_por AS NVARCHAR(50)) AS acessado_por,
          a.data_hora,
          a.ip,
          a.user_agent,
          pAlvo.nome_completo AS perfil_alvo_nome,
          pAdmin.nome_completo AS admin_nome
        FROM auditoria.credencial_acessos a
        LEFT JOIN dados.perfis pAlvo ON pAlvo.id = a.perfil_alvo_id
        LEFT JOIN dados.perfis pAdmin ON pAdmin.id = a.acessado_por
        ORDER BY a.data_hora DESC
      `).catch(() => ({ recordset: [] })); // Resiliente

      return {
        usuarios: qUsuarios.recordset,
        acessos: qAcessos.recordset,
      };
    }
  );

  const usuariosFormatados: Perfil[] = dados.usuarios.map((u: any) => ({
    id: u.id,
    nome_completo: u.nome_completo,
    email: u.email,
    papel: u.papel,
    ativo: Boolean(u.ativo),
    criado_em: u.criado_em ? new Date(u.criado_em).toISOString() : new Date().toISOString(),
    atualizado_em: u.atualizado_em ? new Date(u.atualizado_em).toISOString() : new Date().toISOString(),
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
      acessosRecentes={acessosFormatados as any}
      perfilAtualId={perfil.id}
    />
  );
}
