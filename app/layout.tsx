import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema de Registro e Controle de Protocolos — UNOPAR",
  description: "Sistema interno de registro, auditoria e acompanhamento de protocolos de chamados.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="claro" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var temaSalvo = localStorage.getItem('unopar-tema');
                  if (temaSalvo) {
                    document.documentElement.setAttribute('data-theme', temaSalvo);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
