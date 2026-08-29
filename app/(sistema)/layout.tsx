import { obterPerfilAtual } from "@/lib/auth/perfil";
import { CabecalhoPrincipal } from "@/components/layout/cabecalho";

export default async function LayoutSistema({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await obterPerfilAtual();

  return (
    <div className="min-h-screen flex flex-col bg-fundo text-texto">
      <CabecalhoPrincipal perfil={perfil} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-borda bg-superficie py-3 text-center text-xs text-texto-suave">
        Sistema de Controle de Chamados — UNOPAR Parauapebas (Grupo Edunorte)
      </footer>
    </div>
  );
}
