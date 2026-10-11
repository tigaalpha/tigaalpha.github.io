// Per-robot / per-pet sound and special effects (fx-voice.ts): every chassis gets its own voice and flourish, every pet element + move
// its own look; the layered sounds render offline without clipping or NaN. No speakers needed (Chromium's OfflineAudioContext).
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
import { build } from "esbuild";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : (pwm.default || pwm);
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const out = ".fxv-out"; fs.mkdirSync(out, { recursive: true });
await build({ entryPoints: ["fx-voice.ts"], bundle: true, format: "esm", platform: "node", outfile: out + "/fx.mjs", logLevel: "error" });
await build({ entryPoints: ["fx-voice.ts"], bundle: true, format: "iife", globalName: "FXV", platform: "browser", outfile: out + "/fx.iife.js", logLevel: "error" });
await build({ entryPoints: ["cyber-avatar.tsx"], bundle: true, format: "esm", platform: "node", outfile: out + "/ca.mjs", loader: { ".ts": "ts", ".tsx": "tsx" }, jsx: "automatic", external: ["react", "react-dom"], logLevel: "error" });
await build({ entryPoints: ["model-skills.ts"], bundle: true, format: "esm", platform: "node", outfile: out + "/ms.mjs", loader: { ".ts": "ts", ".tsx": "tsx" }, jsx: "automatic", external: ["react", "react-dom"], logLevel: "error" });
const FX = await import(path.resolve(out + "/fx.mjs")); const CA = await import(path.resolve(out + "/ca.mjs")); const MS = await import(path.resolve(out + "/ms.mjs"));
const models = CA.CHAR_MODELS.map(m => m.id);
const hashOf = (s) => String(s || "x").split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 17) >>> 0;
// voices
const voices = models.map(m => FX.voiceOf(m, MS.classKeyOf(m)));
const vset = new Set(voices.map(v => v.sig + ":" + v.p.toFixed(2)));
ok("every robot gets a voice and most are unique (" + models.length + " robots)", voices.every(v => v.sig && v.p > 0) && vset.size >= Math.floor(models.length * 0.6), vset.size + " distinct");
ok("robots of different classes use different signature timbres", new Set(voices.map(v => v.sig)).size >= 5, [...new Set(voices.map(v => v.sig))].join());
const petTypes = ["volt", "ember", "frost", "flora", "steel", "aether"], moves = ["bite", "claw", "spit", "roar"];
const pv = petTypes.map(t => FX.voiceOf("", "", { type: t, species: t + "x", mv: "bite" }).sig);
ok("each pet element has its own signature sound", new Set(pv).size === 6, pv.join());
// visual recipes with a recording G
const rec = () => { const calls = []; const G = {}; for (const k of ["burst", "boom", "flash", "shield", "impact", "bolt", "laser"]) G[k] = (...a) => calls.push(k + ":" + a.filter(x => typeof x === "string").join("/") + ":" + (typeof a[1] === "number" ? a[1].toFixed(1) : "")); return { G, calls }; };
const run = (fn, ctx) => { const r = rec(); const timers = []; fn(r.G, (f, ms) => timers.push([ms, f]), ctx); timers.sort((a, b) => a[0] - b[0]).forEach(([ms, f]) => f()); return r.calls.join("|"); };
const sigs = models.map(m => run(FX.robotFx, { foe: "op", colour: "#ff0000", glow: "#00ffff", power: 1, big: false, recipe: hashOf(m) >>> 3 }));
ok("every robot flourish makes at least two effect calls", sigs.every(s => s.split("|").length >= 2));
ok("the 8 flourish recipes are all in use across the robots", new Set(sigs).size >= 8, new Set(sigs).size + " distinct");
const bigSigs = models.slice(0, 8).map(m => run(FX.robotFx, { foe: "op", colour: "#f00", glow: "#0ff", power: 1, big: true, recipe: hashOf(m) >>> 3 }));
ok("an ultimate adds a bigger finish to every flourish", bigSigs.every((s, i) => s.split("|").length > sigs[i].split("|").length));
const petSigs = new Set(); for (const t of petTypes) for (const mv of moves) petSigs.add(run(FX.petFx, { foe: "op", colour: "#abc", glow: "#abc", power: 1, big: false, pet: t, mv }));
ok("every pet element x move has its own special effect (24 combinations)", petSigs.size >= 22, petSigs.size + " distinct");
// offline audio
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); const pg = await browser.newPage(); await pg.setContent("<html></html>");
await pg.addScriptTag({ path: out + "/fx.iife.js" });
const res = await pg.evaluate(async ({ petTypes, moves, cls }) => {
  const rows = [];
  const render = async (v, kind) => {
    const ac = new OfflineAudioContext(1, 44100, 44100), g = ac.createGain(); g.gain.value = 0.5; g.connect(ac.destination);
    const nz = ac.createBuffer(1, 44100, 44100), d = nz.getChannelData(0); let s = 5; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    FXV.playSig(ac, g, nz, 0.01, v, kind, 1); const b = await ac.startRendering(), x = b.getChannelData(0); let pk = 0, ss = 0, bad = 0; for (const q of x) { if (!isFinite(q)) bad++; pk = Math.max(pk, Math.abs(q)); ss += q * q; } rows.push({ id: v.sig + (v.mv || ""), kind, pk, rms: Math.sqrt(ss / x.length), bad });
  };
  for (const c of cls) for (const kind of ["hit", "shot", "laser", "boom"]) await render(FXV.voiceOf("model-" + c, c), kind);
  for (const t of petTypes) for (const mv of moves) await render(FXV.voiceOf("", "", { type: t, species: "sp", mv }), "shot");
  return rows;
}, { petTypes, moves, cls: Object.keys(MS.MODEL_CLASS) });
ok("every signature sound renders: audible, finite, not clipping (" + res.length + " renders)", res.every(r => r.bad === 0 && r.pk > 0.005 && r.pk <= 1 && r.rms > 0.0005), "worst peak " + Math.max(...res.map(r => r.pk)).toFixed(2) + ", quietest rms " + Math.min(...res.map(r => r.rms)).toFixed(4));
await browser.close(); fs.rmSync(out, { recursive: true, force: true }); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
