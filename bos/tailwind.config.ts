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
          DEFAULT: "#FF5FA2",
          light: "#FF86C8",
          accent: "#FF4FA0",
        },
        secondary: "#121212",
        success: "#00C853",
        warning: "#FFC107",
        danger: "#E53935",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(180deg, #FF5FA2 0%, #FF86C8 100%)",
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
