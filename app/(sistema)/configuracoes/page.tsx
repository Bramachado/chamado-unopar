import { obterPerfilAtual } from "@/lib/auth/perfil";
import { PainelConfiguracoes } from "./painel-configuracoes";

export default async function PaginaConfiguracoes() {
  const perfil = await obterPerfilAtual();

  return <PainelConfiguracoes perfil={perfil} />;
}
