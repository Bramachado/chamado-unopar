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
      fontSize: {
        "3xl": ["32px", { lineHeight: "1.2" }],
        "2xl": ["24px", { lineHeight: "1.2" }],
        lg: ["18px", { lineHeight: "1.3" }],
        base: ["15px", { lineHeight: "1.5" }],
        sm: ["13px", { lineHeight: "1.5" }],
        xs: ["11px", { lineHeight: "1.4" }],
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        md: "6px",
        lg: "8px",
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
