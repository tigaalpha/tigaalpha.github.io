import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/* ── marketing landing page 1: its own build ──
   Not a second entry inside the app's build, and that distinction is the
   whole point.

   Tried the second-entry route first and measured it: Rollup hoists anything
   both entries touch into one shared chunk, and because music-engine.tsx is
   shared and statically imports songs-data.ts, the landing page ended up
   downloading a 523 kB chunk carrying all 192 songs — data it never reads.
   Chunking is decided per module, so tree-shaking cannot rescue a module that
   is in the graph for the other entry's sake.

   Built alone, the same source tree-shakes down to 407 kB / 121 kB gzip —
   React, the Supabase auth client, and the piano. songs-data, expandSong,
   buildNotation, the staff renderer: all correctly gone. That is 5.6x lighter
   than the app, which is what an ad click on a congested mobile connection
   actually needs, and it also means this page can never quietly get heavier
   because something unrelated was added to the app.

   root is landing/ so the page is the root of its own build and references
   ./bundle/... — self-contained under /landing/, sharing nothing with / that
   could be invalidated out from under it. ── */

export default defineConfig({
  root: resolve(__dirname, "landing"),
  base: "./",
  plugins: [react()],
  build: {
    target: "esnext",
    outDir: resolve(__dirname, "dist-landing"),
    assetsDir: "bundle",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "landing/index.template.html"),
      external: ["@capacitor-community/text-to-speech"],
    },
  },
});
