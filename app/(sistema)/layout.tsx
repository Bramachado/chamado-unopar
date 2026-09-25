import { obterPerfilAtual } from "@/lib/auth/perfil";
import { LayoutCliente } from "@/components/layout/layout-cliente";
import { obterNotificacoesPrazos } from "@/lib/chamados/notificacoes";

export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const perfil = await obterPerfilAtual();
  const notificacoesIniciais = await obterNotificacoesPrazos(perfil);

  return (
    <LayoutCliente perfil={perfil} notificacoesIniciais={notificacoesIniciais}>
      {children}
    </LayoutCliente>
  );
}
