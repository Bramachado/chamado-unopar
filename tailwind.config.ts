import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="escuro"]'],
  theme: {
    extend: {
      colors: {
        fundo: "var(--fundo)",
        superficie: "var(--superficie)",
        "superficie-destaque": "var(--superficie-destaque)",
        borda: "var(--borda)",
        "borda-suave": "var(--borda-suave)",
        texto: {
          DEFAULT: "var(--texto)",
          suave: "var(--texto-suave)",
        },
        acento: {
          DEFAULT: "var(--acento)",
          hover: "var(--acento-hover)",
        },
        sucesso: {
          DEFAULT: "var(--sucesso)",
          fundo: "var(--sucesso-fundo)",
        },
        alerta: {
          DEFAULT: "var(--alerta)",
          fundo: "var(--alerta-fundo)",
        },
        erro: {
          DEFAULT: "var(--erro)",
          fundo: "var(--erro-fundo)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "IBM Plex Sans", "sans-serif"],
        heading: ["var(--font-heading)", "Plus Jakarta Sans", "sans-serif"],
        mono: ["monospace"],
      },
      maxWidth: {
        container: "1400px",
      },
    },
  },
  plugins: [],
};

export default config;
