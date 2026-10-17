import { obterPerfilAtual } from "@/lib/auth/perfil";
import { comTransacao, novaRequisicao } from "@/lib/db/comUsuario";
import { carregarCatalogosFormulario, caminhoDeVolta } from "@/lib/chamados/catalogos";
import { FormularioChamado } from "../formulario-chamado";

interface PageProps {
  searchParams: Promise<{ voltar?: string }>;
}

export default async function PaginaNovoChamado({ searchParams }: PageProps) {
  const perfil = await obterPerfilAtual();
  const { voltar } = await searchParams;
  const dados = await comTransacao({ usuario_id: perfil.id, papel: perfil.papel }, (_req, tx) =>
    carregarCatalogosFormulario(() => novaRequisicao(tx), perfil)
  );

  return (
    <FormularioChamado
      motivos={dados.motivos}
      polos={dados.polos}
      poloUsuario={perfil.polo_id}
      feriados={dados.feriados}
      voltarPara={caminhoDeVolta(voltar)}
    />
  );
}
