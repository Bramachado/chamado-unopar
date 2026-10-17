import { notFound } from "next/navigation";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { sql } from "@/lib/db/pool";
import { carregarChamadoAutorizado } from "@/lib/chamados/repositorio";
import { carregarCatalogosFormulario, caminhoDeVolta } from "@/lib/chamados/catalogos";
import { FormularioChamado } from "../../formulario-chamado";

interface EditPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltar?: string }>;
}

export default async function PaginaEditarChamado({ params, searchParams }: EditPageProps) {
  const { id } = await params;
  const { voltar } = await searchParams;
  const perfil = await obterPerfilAtual();

  const dados = await comTransacao(
    { usuario_id: perfil.id, papel: perfil.papel },
    async (_req, tx) => {
      const chamado = await carregarChamadoAutorizado(novaRequisicao(tx), perfil, id);
      if (!chamado) return null;
      const catalogos = await carregarCatalogosFormulario(() => novaRequisicao(tx), perfil, {
        motivoAtualId: chamado.motivo_id,
        poloId: chamado.polo_id,
      });
      let vinculado = null;
      if (chamado.chamado_vinculado_id) {
        const q = await novaRequisicao(tx)
          .input("vinc", sql.UniqueIdentifier, chamado.chamado_vinculado_id)
          .query(
            "SELECT CAST(id AS NVARCHAR(50)) AS id, protocolo, aluno_nome FROM dados.chamados WHERE id = @vinc"
          );
        vinculado = q.recordset[0] ?? null;
      }
      return { chamado, ...catalogos, vinculado };
    }
  );

  if (!dados) notFound();

  const voltarPara = caminhoDeVolta(voltar);
  return (
    <FormularioChamado
      chamadoInicial={dados.chamado}
      motivos={dados.motivos}
      polos={dados.polos}
      poloUsuario={perfil.polo_id}
      feriados={dados.feriados}
      voltarPara={voltarPara === "/chamados" ? `/chamados/${dados.chamado.id}` : voltarPara}
      chamadoVinculadoInicial={dados.vinculado}
    />
  );
}
