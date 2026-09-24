import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));

export default defineConfig({
  base: "./",
  /* The app used to ship as ONE file: vite-plugin-singlefile inlined every
     chunk into index.html. That is tidy, and it cost us the first paint.
     The plugin puts the inlined script in <head>, so <body> began at 99.92%
     of a 2.3 MB document — a phone on a slow connection had to receive
     essentially the whole bundle before it could paint a single pixel, which
     is why a boot screen placed in the body never appeared early.

     Emitting a normal asset instead means index.html is a few kB: it arrives
     in one round trip, paints immediately, and the bundle streams in behind
     it. Assets are content-hashed, so the service worker can serve them
     cache-first and a returning visitor pays nothing at all. */
  plugins: [react()],
  /* the app's version, for anything on the device that should start over
     with a new release (the 3D room's learned quality tier, for one) */
  define: { __APP_BUILD__: JSON.stringify(pkg.version) },
  /* The 3D room renders inside a Web Worker. One classic-script bundle: no
     chunks to chase inside the worker, and it loads in every browser that
     can transfer a canvas at all. */
  worker: { format: "iife" },
  build: {
    target: "esnext",
    outDir: "dist",
    /* A directory of its own, holding nothing but build output.
       Not "assets" and not "app": both already exist in this repo and carry
       hand-made files — the Capacitor icon sources and web assets in one, the
       beta APK in the other. The deploy step has to wipe this folder on every
       release (hashed filenames pile up forever otherwise, and this project has
       been buried by stale build artefacts before), so it must be a directory
       where deleting everything is always the right thing to do. */
    assetsDir: "bundle",
    rollupOptions: {
      input: resolve(__dirname, "index.template.html"),
      external: ["@capacitor-community/text-to-speech"],
    },
  },
});
