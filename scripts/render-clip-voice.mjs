/* Renders the concept-clip narration ONCE and saves it as static files (owner, 2026-10-23: "render the voice and keep it for reuse").
   Usage (on a machine that can reach Supabase):   node scripts/render-clip-voice.mjs [Charon]
   It calls the live `piano-tts` edge function with the public anon key, one line at a time (1.5 s apart, 3 tries), writes
   public/audio/clips/<en|zh>/<clipId>-<slideIndex>.<wav|mp3> and public/audio/clips/manifest.json, and skips lines already rendered, so it can be
   re-run after an interruption. The app then plays these files first (no cost per listen, the same voice for everybody) and only asks the cloud for a line that is missing. */
import fs from "node:fs"; import path from "node:path"; import { build } from "esbuild";
const VOICE = process.argv[2] || "Charon", OUT = path.resolve("public/audio/clips"), TMP = path.resolve("scripts/.clips-bundle.mjs");

const stub = { name: "stub", setup(b) {
  b.onResolve({ filter: /.*/ }, (a) => { if (a.kind === "entry-point" || /concept-clips-more/.test(a.path)) return null; return { path: a.path, namespace: "stub" }; });
  b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "module.exports = new Proxy(function(){}, { get: (t, k) => k === '__esModule' ? false : function(){ return null; } });", loader: "js" }));
} };
await build({ entryPoints: ["concept-clips.tsx"], bundle: true, platform: "node", format: "esm", outfile: TMP, jsx: "automatic", logLevel: "error", plugins: [stub] });
const { CLIPS, NARR_FOR_RENDER } = await import(TMP); fs.rmSync(TMP, { force: true });
const URL = "https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/piano-tts";
const ANON = fs.readFileSync("supabase-client.ts", "utf8").match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)[1];
const NARR = NARR_FOR_RENDER();
fs.mkdirSync(OUT, { recursive: true }); const mf = path.join(OUT, "manifest.json"); const man = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, "utf8")) : { voice: VOICE, en: {}, zh: {} };
if (man.voice !== VOICE) { man.voice = VOICE; man.en = {}; man.zh = {}; }
let done = 0, fail = 0;
for (const lang of ["en", "zh"]) for (const clip of CLIPS[lang]) for (let i = 0; i < clip.slides.length; i++) {
  const key = clip.id + "-" + i; if (man[lang][key] && fs.existsSync(path.join(OUT, lang, key + "." + man[lang][key]))) continue;
  const text = NARR[lang] + "\n\n\"" + clip.slides[i].b.replace(/"/g, "'") + "\"";
  let ok = false;
  for (let t = 0; t < 3 && !ok; t++) {
    try {
      const r = await fetch(URL, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON }, body: JSON.stringify({ text, lang, voice: VOICE, src: "clip" }) });
      const j = await r.json(); if (!r.ok || !j.audio) throw new Error(j.error || ("HTTP " + r.status));
      fs.mkdirSync(path.join(OUT, lang), { recursive: true }); fs.writeFileSync(path.join(OUT, lang, key + "." + (j.fmt || "wav")), Buffer.from(j.audio, "base64"));
      man[lang][key] = j.fmt || "wav"; ok = true; done++; fs.writeFileSync(mf, JSON.stringify(man));
    } catch (e) { console.log("retry", lang, key, String(e.message).slice(0, 120)); await new Promise((r) => setTimeout(r, 2500 * (t + 1))); }
  }
  if (!ok) fail++; else console.log("ok", lang, key); await new Promise((r) => setTimeout(r, 1500));
}
console.log("rendered", done, "failed", fail, "->", OUT);
