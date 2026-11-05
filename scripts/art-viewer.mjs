#!/usr/bin/env node
/* art-viewer.mjs — a fast way to look at the app's robots and pets: bundles ONLY cyber-avatar.tsx, pet-lab.tsx and the art CSS
   (no `npm run build`, a few seconds), renders them to static SVG markup exactly as scripts/bake-sprites.mjs does, and photographs
   them in Chromium on a dark arena floor with the app's own artwork styles.
     node scripts/art-viewer.mjs --robot vanguard,sentinel [--yaws 0,35,-35,90] [--pose idle] [--head] [--w 420 --h 560] [--dpr 2] [--out DIR]
     node scripts/art-viewer.mjs --pet sparkit,cindra [--levels 1,6,13,18] [--yaws 0,40] [--mood 80] [--w 420 --h 420]
     node scripts/art-viewer.mjs --list             print every robot id and pet id
     node scripts/art-viewer.mjs --robot all --sheet   one contact sheet (first variant of each) instead of one picture per item
   Writes DIR/<id>.png (one column per variant) and prints the files. --src DIR points at a worktree to view (default: this repo).
   Animations are frozen at their first frame so two runs of the same art give the same picture. The robot and pet components are
   live SVG in the app; this is a still of the same markup, so it shows the drawing, not the in-fight motion. */
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL, fileURLToPath } from "node:url";
const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith("--") ? [...a, [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "1"]] : a), []));
const ROOT = path.resolve(A.src || path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const OUT = path.resolve(A.out || "art-shots");
const csv = (v, d) => String(v == null || v === "1" ? d : v).split(",").map(s => s.trim()).filter(Boolean);
const num = (v, d) => (v == null || v === "1" ? d : +v);
const DPR = num(A.dpr, 1);
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href).catch(() => import("esbuild"));

/* the same filter bake-sprites uses: only rules that style the drawing itself (.ca-* / .pa-*), plus the keyframes they animate */
function artCss(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [], frames = new Map();
  let depth = 0, start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '"' || ch === "'") { const j = css.indexOf(ch, i + 1); i = j < 0 ? css.length : j; continue; }
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}" && --depth === 0) {
      const pre = css.slice(css.lastIndexOf("}", start) + 1, start).trim();
      const body = css.slice(start + 1, i).trim();
      const kf = /^@keyframes\s+([\w-]+)/.exec(pre);
      if (kf) frames.set(kf[1], `${pre}{${body}}`);
      else if (pre && !pre.startsWith("@") && pre.split(",").every(s => /^(svg)?\.(ca|pa)(-[\w-]+)?(?=$|[\s.:#[>+~])/.test(s.trim())))
        rules.push(`${pre}{${body}}`);
    }
  }
  const used = new Set(rules.flatMap(r => [...r.matchAll(/animation(?:-name)?\s*:\s*([\w-]+)/g)].map(m => m[1])));
  return [...rules, ...[...used].filter(n => frames.has(n)).map(n => frames.get(n))].join("\n");
}

const CACHE = path.join(ROOT, "node_modules/.cache/tiga-art-viewer-" + process.pid);
fs.mkdirSync(CACHE, { recursive: true });
const MANIFEST = path.join(ROOT, "sprites-manifest.ts");
if (!fs.existsSync(MANIFEST)) fs.writeFileSync(MANIFEST, "export const SPRITES = {\n};\n");
fs.writeFileSync(path.join(CACHE, "entry.jsx"), `
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CyberAvatar, CHAR_MODELS } from ${JSON.stringify(path.join(ROOT, "cyber-avatar.tsx"))};
import { PetArt, PET_SPECIES } from ${JSON.stringify(path.join(ROOT, "pet-lab.tsx"))};
import { CSS } from ${JSON.stringify(path.join(ROOT, "app-styles.ts"))};
const h = React.createElement;
export { CSS };
export const robots = CHAR_MODELS.map(m => m.id);
export const pets = PET_SPECIES.map(s => s.id);
export const robotSvg = (model, props) => renderToStaticMarkup(h(CyberAvatar, { model, ...props }));
export const petSvg = (species, props) => renderToStaticMarkup(h(PetArt, { species, ...props }));
`);
await build({
  entryPoints: [path.join(CACHE, "entry.jsx")], outfile: path.join(CACHE, "art.mjs"),
  bundle: true, format: "esm", platform: "node", packages: "external",
  loader: { ".ts": "tsx", ".tsx": "tsx" }, jsx: "automatic", logLevel: "error",
  absWorkingDir: ROOT, define: { __APP_BUILD__: '"art-viewer"' },
  external: ["@capacitor-community/text-to-speech"],
  plugins: [{ name: "stub", setup(b) {
    b.onResolve({ filter: /\?(worker|url)/ }, a => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: 'export default "";', loader: "js" }));
  } }],
});
const warn = console.error;
console.error = (...a) => { if (!/unique "key" prop/.test(String(a[0]))) warn(...a); };
const art = await import(pathToFileURL(path.join(CACHE, "art.mjs")).href);

if (A.list) {
  console.log("robots (" + art.robots.length + "): " + art.robots.join(" "));
  console.log("pets (" + art.pets.length + "): " + art.pets.join(" "));
  fs.rmSync(CACHE, { recursive: true, force: true }); process.exit(0);
}

const robotIds = A.robot ? (A.robot === "all" ? art.robots : csv(A.robot)) : [];
const petIds = A.pet ? (A.pet === "all" ? art.pets : csv(A.pet)) : [];
if (!robotIds.length && !petIds.length) { console.log("nothing to draw: pass --robot <ids|all> and/or --pet <ids|all> (or --list)"); fs.rmSync(CACHE, { recursive: true, force: true }); process.exit(1); }
for (const id of robotIds) if (!art.robots.includes(id)) { console.log("unknown robot", id); process.exit(1); }
for (const id of petIds) if (!art.pets.includes(id)) { console.log("unknown pet", id); process.exit(1); }

const yaws = csv(A.yaws, "0,35,-35,90").map(Number);
const levels = csv(A.levels, "1,6,13,18").map(Number);
const poses = csv(A.pose, "idle");
const mood = num(A.mood, 80);
const W = num(A.w, 380), H = num(A.h, 480);

/* one entry per picture to draw: { id, kind, variants: [{label, svg}] } */
const items = [];
for (const id of robotIds) {
  const variants = [];
  for (const pose of poses) for (const yaw of yaws)
    variants.push({ label: `${A.head ? "head " : ""}yaw ${yaw}${poses.length > 1 || pose !== "idle" ? " " + pose : ""}`, svg: art.robotSvg(id, { yaw, pose, headOnly: !!A.head }) });
  items.push({ id, kind: "robot", variants });
}
for (const id of petIds) {
  const variants = [];
  for (const level of levels) for (const yaw of (A.yaws ? yaws : [0]))
    variants.push({ label: `lv ${level}${A.yaws ? " yaw " + yaw : ""}`, svg: art.petSvg(id, { level, yaw, mood }) });
  items.push({ id, kind: "pet", variants });
}

/* a budget the artists must keep: the figures are live SVG in the arena, so more elements, gradients and filters cost frame time on a phone */
const stat = (svg) => ({ el: (svg.match(/<[a-zA-Z]/g) || []).length, grad: (svg.match(/<(linear|radial)Gradient/g) || []).length, filt: (svg.match(/<filter/g) || []).length, blur: (svg.match(/<feGaussianBlur/g) || []).length, kb: Math.round(svg.length / 1024) });
for (const it of items) { const s0 = stat(it.variants[0].svg); console.log(`${it.kind} ${it.id}: ${s0.el} elements, ${s0.grad} gradients, ${s0.filt} filters (${s0.blur} blurs), ${s0.kb} KB of markup`); }
const css = artCss(art.CSS);
const pwm = await import("playwright").catch(async () => import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href));
const pw = pwm.chromium ? pwm : pwm.default;
const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: DPR });
const errs = []; page.on("pageerror", e => errs.push(e.message));
fs.mkdirSync(OUT, { recursive: true });

/* the obsidian arena floor the figures stand on in the app, a violet key from the upper left and a cyan fill from the lower right */
const shell = (cells, cols) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#05070f}
*,*::before,*::after{transition:none!important;animation-play-state:paused!important}
#g{display:grid;grid-template-columns:repeat(${cols},${W}px);gap:6px;padding:6px;width:max-content}
.c{position:relative;width:${W}px;height:${H}px;overflow:hidden;border-radius:6px;
  background:radial-gradient(120% 90% at 22% 8%,rgba(143,109,255,.22),transparent 55%),radial-gradient(110% 80% at 85% 100%,rgba(57,216,255,.16),transparent 60%),linear-gradient(#0b1020,#060912 70%,#0a0f1d)}
.c::after{content:"";position:absolute;left:0;right:0;bottom:0;height:22%;background:linear-gradient(transparent,rgba(120,150,255,.07))}
.c>svg{display:block;width:100%;height:100%;position:relative;z-index:1}
.l{position:absolute;left:8px;top:6px;z-index:2;font:600 12px/1.2 ui-monospace,Menlo,monospace;color:#9fb0d8;text-shadow:0 1px 2px #000}
${css}</style></head><body><div id="g">${cells}</div></body></html>`;

const cell = (label, svg) => `<div class="c"><div class="l">${label}</div>${svg}</div>`;
const files = [];
if (A.sheet) {
  const cols = num(A["sheet-cols"], 4);
  const cells = items.map(it => cell(`${it.kind} ${it.id} · ${it.variants[0].label}`, it.variants[0].svg)).join("");
  await page.setContent(shell(cells, cols));
  const f = path.join(OUT, "sheet.png");
  await page.locator("#g").screenshot({ path: f }); files.push(f);
} else {
  for (const it of items) {
    const cols = Math.min(it.variants.length, num(A.cols, 4));
    await page.setContent(shell(it.variants.map(v => cell(`${it.id} · ${v.label}`, v.svg)).join(""), cols));
    const f = path.join(OUT, `${it.kind}-${it.id}.png`);
    await page.locator("#g").screenshot({ path: f }); files.push(f);
  }
}
if (errs.length) console.log("PAGE ERRORS:", [...new Set(errs)].slice(0, 5).join(" | "));
for (const f of files) console.log(f);
await browser.close();
fs.rmSync(CACHE, { recursive: true, force: true });
