import { obterPerfilAtual } from "@/lib/auth/perfil";
import { LayoutCliente } from "@/components/layout/layout-cliente";
import { obterNotificacoesPrazos } from "@/lib/chamados/notificacoes";

export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const perfil = await obterPerfilAtual();
  let notificacoesIniciais;
  try {
    notificacoesIniciais = await obterNotificacoesPrazos(perfil);
  } catch (err) {
    console.error("Erro ao obter notificações de prazos no layout:", err);
    notificacoesIniciais = {
      vencidos: 0,
      vencendoBreve: 0,
      totalCriticos: 0,
      itens: [],
    };
  }

  return (
    <LayoutCliente perfil={perfil} notificacoesIniciais={notificacoesIniciais}>
      {children}
    </LayoutCliente>
  );
}
