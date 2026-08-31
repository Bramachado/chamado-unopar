import { obterPerfilAtual } from "@/lib/auth/perfil";
import { LayoutCliente } from "@/components/layout/layout-cliente";

export default async function LayoutSistema({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await obterPerfilAtual();

  return (
    <LayoutCliente perfil={perfil}>
      {children}
    </LayoutCliente>
  );
}
