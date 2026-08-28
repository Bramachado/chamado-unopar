import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fundo: "var(--fundo)",
        superficie: "var(--superficie)",
        borda: "var(--borda)",
        texto: {
          DEFAULT: "var(--texto)",
          suave: "var(--texto-suave)",
        },
        acento: {
          DEFAULT: "var(--acento)",
          hover: "var(--acento-hover)",
        },
        sucesso: "var(--sucesso)",
        alerta: "var(--alerta)",
        erro: "var(--erro)",
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        md: "6px",
        lg: "8px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Geist", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
