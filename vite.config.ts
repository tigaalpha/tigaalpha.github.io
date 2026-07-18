import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    target: "esnext",
    outDir: "dist",
    rollupOptions: {
      input: resolve(__dirname, "index.template.html"),
    },
  },
});
