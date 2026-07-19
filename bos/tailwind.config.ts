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
          DEFAULT: "#C15F3C",
          light: "#DE7356",
          accent: "#B8523C",
        },
        secondary: "rgb(var(--foreground) / <alpha-value>)",
        success: "#00C853",
        warning: "#FFC107",
        danger: "#E53935",
        page: "rgb(var(--page) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(180deg, #C15F3C 0%, #DE7356 100%)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 2px 20px -4px rgba(18,18,18,0.08)",
        card: "0 4px 24px -8px rgba(18,18,18,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
