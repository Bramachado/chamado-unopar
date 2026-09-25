import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
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
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const temaCookie = cookieStore.get("unopar_tema")?.value;
  const temaInicial = temaCookie === "sepia" || temaCookie === "escuro" ? temaCookie : "claro";

  return (
    <html
      lang="pt-BR"
      data-theme={temaInicial}
      className={`${plusJakartaSans.variable} ${ibmPlexSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var cMatch = document.cookie.match(/unopar_tema=([^;]+)/);
                  var cTema = cMatch ? cMatch[1].trim() : null;
                  var sTema = localStorage.getItem('unopar-tema');
                  var temaFinal = sTema || cTema;
                  if (temaFinal && (temaFinal === 'claro' || temaFinal === 'sepia' || temaFinal === 'escuro')) {
                    document.documentElement.setAttribute('data-theme', temaFinal);
                    if (!cTema || cTema !== temaFinal) {
                      document.cookie = 'unopar_tema=' + temaFinal + '; path=/; max-age=31536000; SameSite=Lax';
                    }
                    if (!sTema || sTema !== temaFinal) {
                      localStorage.setItem('unopar-tema', temaFinal);
                    }
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
