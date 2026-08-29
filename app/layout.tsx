import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

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
    <html
      lang="pt-BR"
      data-theme="claro"
      className={`${plusJakartaSans.variable} ${ibmPlexSans.variable}`}
      suppressHydrationWarning
    >
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
      <body className="antialiased font-sans min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
