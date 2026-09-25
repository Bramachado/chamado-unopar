import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comUsuario } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { PainelPerfil } from "./painel-perfil";

export default async function PaginaPerfil() {
  const perfil = await obterPerfilAtual();

  let acessosRaw: any[] = [];

  try {
    const res = await comUsuario({ usuario_id: perfil.id, papel: perfil.papel }, async (req) => {
      req.input("perfilId", sql.UniqueIdentifier, perfil.id);
      const q = await req.query(`
          SELECT 
            a.id,
            CAST(a.perfil_alvo AS NVARCHAR(50)) AS perfil_alvo,
            CAST(a.admin_id AS NVARCHAR(50)) AS admin_id,
            a.data_hora,
            a.ip,
            a.user_agent,
            p.nome_completo AS admin_nome
          FROM auditoria.credencial_acessos a
          LEFT JOIN dados.perfis p ON p.id = a.admin_id
          WHERE a.perfil_alvo = @perfilId
          ORDER BY a.data_hora DESC;
        `);

      return q.recordset || [];
    });
    acessosRaw = res || [];
  } catch (err) {
    console.error("Erro ao carregar acessos do cofre no perfil:", err);
    acessosRaw = [];
  }

  const acessosFormatados = acessosRaw.map((a: any) => ({
    id: a.id,
    perfil_alvo: a.perfil_alvo,
    admin_id: a.admin_id,
    data_hora: a.data_hora ? new Date(a.data_hora).toISOString() : new Date().toISOString(),
    ip: a.ip,
    user_agent: a.user_agent,
    admin_nome: a.admin_nome || "Administrador",
  }));

  return <PainelPerfil perfil={perfil} historicoAcessos={acessosFormatados} />;
}
