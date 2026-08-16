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
          DEFAULT: "#8b5cf6",
          light: "#a78bfa",
          accent: "#7c3aed",
        },
        secondary: "rgb(var(--foreground) / <alpha-value>)",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
        neon: {
          purple: "#a855f7",
          blue: "#3b82f6",
          green: "#22c55e",
          orange: "#f97316",
          teal: "#14b8a6",
        },
        page: "rgb(var(--page) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
        "neon-blue": "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
        "neon-green": "linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)",
        "neon-orange": "linear-gradient(135deg, #f97316 0%, #f59e0b 100%)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 4px 0 rgba(0,0,0,0.3), 0 2px 12px -2px rgba(0,0,0,0.3)",
        card: "0 2px 16px -4px rgba(0,0,0,0.45)",
        glass: "0 8px 32px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        glow: "0 0 24px -6px rgba(139, 92, 246, 0.55)",
        "glow-blue": "0 0 24px -6px rgba(59, 130, 246, 0.55)",
        "glow-green": "0 0 24px -6px rgba(34, 197, 94, 0.5)",
        "glow-orange": "0 0 24px -6px rgba(249, 115, 22, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
