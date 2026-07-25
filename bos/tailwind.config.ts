import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#D4570A",
          light: "#E8722B",
          accent: "#C24D08",
        },
        secondary: "rgb(var(--foreground) / <alpha-value>)",
        success: "#2E7D32",
        warning: "#E65100",
        danger: "#C62828",
        page: "rgb(var(--page) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(180deg, #D4570A 0%, #E8722B 100%)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 1px 4px 0 rgba(28,22,14,0.06), 0 2px 12px -2px rgba(28,22,14,0.06)",
        card: "0 2px 16px -4px rgba(28,22,14,0.10)",
        glass: "0 8px 32px -4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
        "glass-dark": "0 8px 32px -4px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
