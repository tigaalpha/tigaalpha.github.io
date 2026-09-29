/* ── scripts/bake-sprites.mjs ──
   Pre-rendered character art.

   Every robot and pet in the app is drawn live as SVG. That is what lets the
   character page turn a chassis through a 3/4 view and the arena bend its
   limbs, and it is the wrong tool for a SHELF of them: the shop's robot tab is
   forty heads, each defining 54 gradients, and its pet tab is thirty-two pets
   at ~200 paths and 16 clip paths apiece. Well over ten thousand SVG elements
   for one grid, repainted whenever an optic pulses.

   A thumbnail never turns and never moves, so it does not need to be drawn on
   the phone at all. This script draws each one ONCE, here, from the very same
   components the app renders (so there is no second copy of the artwork to
   drift), and saves it as a small transparent WebP:

     public/sprites/<key>-<width>.<hash>.webp   the images (Vite copies public/ into dist/)
     sprites-manifest.ts                         key → files, imported by sprite.tsx

   A filename carries a hash of its bytes, so the service worker keeps it
   forever (public/sw.js) and a changed drawing is simply a new file.

   Usage
     npm run sprites                    bake whatever changed since the last bake
     npm run sprites -- --force         re-render everything
     npm run sprites -- --only=head/vanguard,pet/cindra/1
     node scripts/bake-sprites.mjs --check
         No browser: list sprites whose drawing changed after they were baked.
         `npm run build` runs this and only warns — a stale sprite shows the
         previous drawing, it breaks nothing.
     node scripts/bake-sprites.mjs --out=DIR [--raw] [--only=…]
         A preview: draws into DIR (plain names, no manifest, nothing pruned),
         so a change to the artwork can be judged before it ships; --raw
         leaves out the finishing pass (see FX) to compare with and without.

   Baking needs Playwright + Chromium, which are deliberately NOT dependencies
   of the app (the cloud dev containers ship both preinstalled). The check
   needs neither. */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/sprites");
const MANIFEST = join(ROOT, "sprites-manifest.ts");
const CACHE = join(ROOT, "node_modules/.cache/tiga-sprites");
const argv = process.argv.slice(2);
const CHECK = argv.includes("--check"), FORCE = argv.includes("--force");
const ONLY = (argv.find(a => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const PREVIEW = (argv.find(a => a.startsWith("--out=")) || "").slice(6);

/* Render settings. Changing any of them re-bakes everything, because they are
   part of every sprite's source hash.
     ss  supersampling: drawn at ss× the width, then scaled down, which is
         what keeps the 0.3-unit panel lines crisp instead of speckled
     q   WebP quality */
const BAKE = { v: 1, ss: 2, q: 0.86 };

/* ── the finishing pass ──
   What a live SVG cannot afford on a phone and a bake does once, on the
   supersampled image, from its own silhouette:
     rim     a cool back light: the band of the figure whose neighbour up and
             to the right is empty, softened and screened on — the edge light
             that makes a render read as standing in a lit room
     under   the matching fall-off: the band whose neighbour below is empty,
             multiplied darker, so the underside of every form turns away
     bloom   whatever burns brighter than its own surroundings (optics,
             cores, a glint) lights the surface round it, at two radii
   Offsets and radii are in supersampled pixels. FX is part of every
   sprite's hash, so retuning it re-bakes everything. */
const FX = {
  rim: { dx: 5, dy: -3, blur: 2.5, color: "#d4f0ff", alpha: 0.5 },
  under: { dx: 0, dy: 7, blur: 6, color: "#050b1a", alpha: 0.28 },
  bloom: { t: 0.72, m: 0.08, r0: 14, r1: 4, a1: 0.55, r2: 12, a2: 0.35 },
};
const FXON = !argv.includes("--raw");

/* ── what gets baked ──
   `fit` is the range of box shapes (width / height) the sprite is shown in.
   A live <svg> fills its box with preserveAspectRatio "meet": the viewBox is
   scaled to fit, and whatever of the drawing lies in the letterbox either
   side still shows. A thumbnail box is not the viewBox's shape — the shop
   card is 1:1.05, the character picker 1:1.12, and every robot head has a
   viewBox of its own — so an image cut to the viewBox would lose the fins and
   antennae that reach into that margin. Each sprite is cut instead to the
   UNION of what every box in its range can show, and drawn with
   object-fit: cover: in a box at either end of the range it then lands at
   exactly the size and place the live SVG would have. Keep these in step with
   the aspect-ratio of the boxes in app-styles.ts.

   `w` is the image widths a sprite is saved at; the app picks one per surface
   through srcset/sizes. A head is shown both on a shop card and as a 34-46px
   chip in the PvP lobby, so it has a small file for the chips. A pet
   thumbnail is only ever card-sized, and every phone is at least 2x, so one
   width is all it needs. */
const HEAD = { fit: [1 / 1.12, 1 / 1.05], w: [128, 256] };   // .char-model-thumb … .mdlitem-head / .stgitem-head
const PET = { fit: [1 / 1.1, 1 / 1.06], w: [256] };          // .pc-art / .pcf-art … .petitem-art

const ENTRY = `
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CyberAvatar, CHAR_MODELS } from ${JSON.stringify(join(ROOT, "cyber-avatar.tsx"))};
import { PetArt, PET_SPECIES } from ${JSON.stringify(join(ROOT, "pet-lab.tsx"))};
import { CSS } from ${JSON.stringify(join(ROOT, "app-styles.ts"))};
const h = React.createElement;
export { CSS };
export const specs = [
  ...CHAR_MODELS.map(m => ({ key: "head/" + m.id, ...${JSON.stringify(HEAD)}, el: () => h(CyberAvatar, { model: m.id, headOnly: true }) })),
  ...PET_SPECIES.map(s => ({ key: "pet/" + s.id + "/1", ...${JSON.stringify(PET)}, el: () => h(PetArt, { species: s.id, level: 1 }) })),
];
export const markupOf = (spec) => renderToStaticMarkup(spec.el());
`;

const sha = (s, n) => createHash("sha256").update(s).digest("hex").slice(0, n);

/* The artwork's own styles live in the app stylesheet (.ca-led sets the
   colour its ring draws in, for one). Only rules that style the drawing
   itself are carried over — every selector must begin with one of its own
   classes — plus the @keyframes they animate with. Keeping it to those is
   also what stops an unrelated CSS edit from marking every sprite stale.

   The animations are kept rather than switched off, and each is frozen at a
   chosen moment instead (see FRAME): switching one off is not the same as
   showing its first frame. The LED ring's spin, for one, replaces the ring's
   own transform attribute while it runs; with the animation removed that
   attribute comes back under the rule's transform-origin and throws the ring
   off its socket — a picture the app never shows. */
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

/* Where in its loop each animation is caught. A pulsing light is caught at
   full brightness; everything else at its start, which is the rest pose —
   eyes open, LED blue, the pet not mid-bob. */
const FRAME = { caVisor: 0.5, caEmber: 0.5 };

/* A root <svg>'s viewBox → the region this sprite is cut to (see `fit`). */
function regionOf(markup, [amin, amax]) {
  const m = /<svg\b[^>]*?\sviewBox="([^"]+)"/.exec(markup);
  if (!m) throw new Error("no viewBox on the root <svg>");
  const [x, y, w, h] = m[1].trim().split(/[\s,]+/).map(Number);
  const W = Math.max(w, h * amax), H = Math.max(h, w / amin);
  const r = [x + w / 2 - W / 2, y + h / 2 - H / 2, W, H].map(v => +v.toFixed(3));
  return { vb: m[1], region: r, markup: markup.replace(m[0], m[0].replace(m[1], r.join(" "))) };
}

function readManifest() {
  if (!existsSync(MANIFEST)) return {};
  const m = /export const SPRITES = (\{[\s\S]*?\n\});/.exec(readFileSync(MANIFEST, "utf8"));
  try { return m ? JSON.parse(m[1]) : {}; } catch (e) { return {}; }
}

async function loadArt() {
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(join(CACHE, "entry.jsx"), ENTRY);
  await build({
    entryPoints: [join(CACHE, "entry.jsx")], outfile: join(CACHE, "art.mjs"),
    bundle: true, format: "esm", platform: "node", packages: "external",
    loader: { ".ts": "tsx", ".tsx": "tsx" }, jsx: "automatic", logLevel: "error",
    absWorkingDir: ROOT, define: { __APP_BUILD__: '"sprites"' },
    external: ["@capacitor-community/text-to-speech"],
    // the 3D room's worker and ?url imports mean nothing to a still drawing
    plugins: [{ name: "stub", setup(b) {
      b.onResolve({ filter: /\?(worker|url)/ }, a => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: 'export default "";', loader: "js" }));
    } }],
  });
  // the pet drawing has a few unkeyed lists; React's dev warning is noise here
  const warn = console.error;
  console.error = (...a) => { if (!/unique "key" prop/.test(String(a[0]))) warn(...a); };
  const art = await import(pathToFileURL(join(CACHE, "art.mjs")).href + "?" + Date.now());
  const css = artCss(art.CSS);
  const specs = art.specs
    .filter(s => !ONLY.length || ONLY.includes(s.key))
    .map(s => {
      const { markup, region } = regionOf(art.markupOf(s), s.fit);
      return { key: s.key, markup, w: s.w, a: region[2] / region[3], k: sha(JSON.stringify([BAKE, FRAME, FXON ? FX : null, s.w, css, markup]), 12) };
    });
  console.error = warn;
  return { specs, css };
}

const fileOf = (key, w, bytes) => `${key.replace(/\//g, "-")}-${w}.${sha(bytes, 10)}.webp`;

async function chromium() {
  let pw;
  try { pw = await import("playwright"); } catch (e) {
    try {
      const g = execSync("npm root -g", { encoding: "utf8" }).trim();
      pw = await import(pathToFileURL(join(g, "playwright/index.js")).href);
    } catch (e2) {
      console.error("bake-sprites: Playwright is not installed (npm i -g playwright), so there is nothing to draw with.");
      process.exit(1);
    }
  }
  pw = pw.chromium ? pw : pw.default;
  const exe = process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  return pw.chromium.launch(exe ? { executablePath: exe } : {});
}

// the art modules import the manifest (through sprite.tsx), so there must be one to bundle
if (!existsSync(MANIFEST)) writeFileSync(MANIFEST, "export const SPRITES = {\n};\n");
let art;
try { art = await loadArt(); } catch (e) {
  // the build runs --check: a check that cannot run must not be what fails a release
  if (!CHECK) throw e;
  console.warn(`\n⚠ bake-sprites --check could not load the artwork, so sprites were not checked: ${e.message}\n`);
  process.exit(0);
}
const { specs, css } = art;
const old = readManifest();
const fresh = (s) => old[s.key] && old[s.key].k === s.k && old[s.key].f.length === s.w.length &&
  old[s.key].f.every(f => existsSync(join(OUT, f)));

if (PREVIEW) {
  // a preview draws everything asked for into its own folder and stops there
  mkdirSync(PREVIEW, { recursive: true });
}

if (CHECK) {
  const stale = specs.filter(s => !old[s.key] || old[s.key].k !== s.k).map(s => s.key);
  if (stale.length) {
    console.warn(`\n⚠ bake-sprites: ${stale.length} of ${specs.length} sprites no longer match their drawing — run \`npm run sprites\`:\n  ${stale.join(", ")}\n`);
  } else console.log(`bake-sprites: all ${specs.length} sprites match their drawings`);
  process.exit(0);
}

const todo = specs.filter(s => PREVIEW || FORCE || !fresh(s));
const next = ONLY.length ? { ...old } : {};
for (const s of specs) if (!todo.includes(s)) next[s.key] = old[s.key];
mkdirSync(OUT, { recursive: true });

if (todo.length) {
  const browser = await chromium();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
html,body{margin:0;padding:0;background:transparent}
*,*::before,*::after{transition:none!important}
#s{position:absolute;left:0;top:0}
#s>svg{display:block;width:100%;height:100%}
${css}</style></head><body><div id="s"></div><script>
/* the finishing pass (see FX): image in, canvas out, same size. Colour
   only ever changes where the figure already is; its alpha is left exactly
   as drawn, so soft glows and contact shadows keep their fall-off. */
window.grade = (src, W, H, fx) => {
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return [c, c.getContext("2d", { willReadFrequently: true })]; };
  const [base, b] = mk(); b.drawImage(src, 0, 0);
  const img = b.getImageData(0, 0, W, H), d = img.data, N = W * H;
  const [mask, m] = mk(); m.drawImage(base, 0, 0);
  m.globalCompositeOperation = "source-in"; m.fillStyle = "#fff"; m.fillRect(0, 0, W, H);
  // how much of an edge band (see FX.rim / FX.under) each pixel is in, 0..1
  const band = ({ dx, dy, blur }) => {
    const [c, x] = mk(); x.drawImage(mask, 0, 0);
    x.globalCompositeOperation = "destination-out"; x.drawImage(mask, -dx, -dy);
    const [c2, x2] = mk(); x2.filter = "blur(" + blur + "px)"; x2.drawImage(c, 0, 0);
    const a = x2.getImageData(0, 0, W, H).data, out = new Float32Array(N);
    for (let i = 0; i < N; i++) out[i] = a[i * 4 + 3] / 255;
    return out;
  };
  const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  if (fx.under) {
    const u = band(fx.under), [r, g, bl] = hex(fx.under.color), k = fx.under.alpha;
    for (let i = 0; i < N; i++) {
      const s = u[i] * k; if (!s) continue;
      const j = i * 4;
      d[j] *= 1 - s * (1 - r); d[j + 1] *= 1 - s * (1 - g); d[j + 2] *= 1 - s * (1 - bl);
    }
  }
  if (fx.rim) {
    const u = band(fx.rim), [r, g, bl] = hex(fx.rim.color), k = fx.rim.alpha;
    for (let i = 0; i < N; i++) {
      const s = u[i] * k; if (!s) continue;
      const j = i * 4;
      d[j] = 255 - (255 - d[j]) * (1 - s * r); d[j + 1] = 255 - (255 - d[j + 1]) * (1 - s * g); d[j + 2] = 255 - (255 - d[j + 2]) * (1 - s * bl);
    }
  }
  const [out, o] = mk(); o.putImageData(img, 0, 0);
  if (fx.bloom) {
    /* Hot means brighter than its own neighbourhood — an optic, a core, a
       glint — not merely pale: a white helmet is bright everywhere and must
       not glow. The neighbourhood mean comes from blurring brightness with the
       figure's alpha, which the canvas keeps premultiplied, so what reads back
       is the mean over the figure alone, not over the empty air around it. */
    const { t, m: margin, r0, r1, a1, r2, a2 } = fx.bloom;
    const vi = new ImageData(W, H), v = vi.data;
    for (let j = 0; j < d.length; j += 4) { const x = Math.max(d[j], d[j + 1], d[j + 2]); v[j] = v[j + 1] = v[j + 2] = x; v[j + 3] = d[j + 3]; }
    const [vc, vx] = mk(); vx.putImageData(vi, 0, 0);
    const [mc, mx] = mk(); mx.filter = "blur(" + r0 + "px)"; mx.drawImage(vc, 0, 0);
    const mean = mx.getImageData(0, 0, W, H).data;
    const hot = new ImageData(W, H), h = hot.data;
    for (let j = 0; j < d.length; j += 4) {
      const V = v[j] / 255, k = Math.max(0, Math.min(1, (V - t) / (1 - t))) * Math.max(0, Math.min(1, (V - mean[j] / 255 - margin) / .15));
      if (!k) continue;
      h[j] = d[j]; h[j + 1] = d[j + 1]; h[j + 2] = d[j + 2]; h[j + 3] = Math.round(d[j + 3] * k);
    }
    const [hc, hx] = mk(); hx.putImageData(hot, 0, 0);
    /* The glow is light falling on the figure's own surface — a visor lighting
       the helmet round it — so it adds to colour and never to alpha. Light
       spilling into the empty air would be soft alpha all round the sprite,
       which WebP stores losslessly: a third more bytes on every thumbnail
       for a haze nobody would miss. */
    for (const [rad, al] of [[r1, a1], [r2, a2]]) {
      if (!al) continue;
      const [g, gc] = mk(); gc.filter = "blur(" + rad + "px)"; gc.drawImage(hc, 0, 0);
      const gl = gc.getImageData(0, 0, W, H).data;
      for (let j = 0; j < d.length; j += 4) {
        const s = gl[j + 3] / 255 * al; if (!s) continue;
        d[j] = Math.min(255, d[j] + gl[j] * s); d[j + 1] = Math.min(255, d[j + 1] + gl[j + 1] * s); d[j + 2] = Math.min(255, d[j + 2] + gl[j + 2] * s);
      }
    }
    o.putImageData(img, 0, 0);
  }
  return out;
};
</script></body></html>`);
  let n = 0;
  for (const s of todo) {
    const f = [];
    for (const w of s.w) {
      const h = Math.round(w / s.a);
      await page.evaluate(({ html, w, h, frame }) => {
        const el = document.getElementById("s");
        el.style.width = w + "px"; el.style.height = h + "px"; el.innerHTML = html;
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = (frame[a.animationName] || 0) * a.effect.getTiming().duration;
        }
      }, { html: s.markup, w: w * BAKE.ss, h: h * BAKE.ss, frame: FRAME });
      const png = await page.locator("#s").screenshot({ omitBackground: true, type: "png" });
      const b64 = await page.evaluate(async ({ png, w, h, q, fx }) => {
        const bin = atob(png), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const bmp = await createImageBitmap(new Blob([u8], { type: "image/png" }));
        const src = fx ? window.grade(bmp, bmp.width, bmp.height, fx) : bmp;
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const x = c.getContext("2d");
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
        x.drawImage(src, 0, 0, w, h);
        const blob = await new Promise(r => c.toBlob(r, "image/webp", q));
        const out = new Uint8Array(await blob.arrayBuffer());
        let str = "";
        for (let i = 0; i < out.length; i += 0x8000) str += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
        return btoa(str);
      }, { png: png.toString("base64"), w, h, q: BAKE.q, fx: FXON ? FX : null });
      const bytes = Buffer.from(b64, "base64");
      if (PREVIEW) { writeFileSync(join(PREVIEW, `${s.key.replace(/\//g, "-")}-${w}.webp`), bytes); continue; }
      const name = fileOf(s.key, w, bytes);
      writeFileSync(join(OUT, name), bytes);
      f.push(name);
    }
    if (!PREVIEW) next[s.key] = { a: +s.a.toFixed(4), w: s.w, f, k: s.k };
    if (++n % 10 === 0 || n === todo.length) console.log(`bake-sprites: drew ${n}/${todo.length}`);
  }
  await browser.close();
}
if (PREVIEW) { console.log(`bake-sprites: preview of ${todo.length} sprites in ${PREVIEW}`); process.exit(0); }

// drop images nothing points at any more
const keep = new Set(Object.values(next).flatMap(e => e.f));
let dropped = 0;
for (const f of readdirSync(OUT)) if (f.endsWith(".webp") && !keep.has(f)) { unlinkSync(join(OUT, f)); dropped++; }

// one sprite per line, sorted, so a re-bake diffs as the handful it changed
const keys = Object.keys(next).sort();
writeFileSync(MANIFEST, `/* Generated by scripts/bake-sprites.mjs — do not edit by hand.
   Pre-rendered stills of the live drawings in cyber-avatar.tsx and pet-lab.tsx
   (sprite.tsx shows them). After changing either file's artwork, run
   \`npm run sprites\`; \`npm run build\` warns when a sprite has gone stale.
     a  width / height of the image
     w  the widths it was saved at, and f the file for each, in public/sprites/
     k  hash of the drawing it was made from */
export const SPRITES = {
${keys.map(k => `${JSON.stringify(k)}: ${JSON.stringify(next[k])}`).join(",\n")}
};
`);

const bytes = [...keep].reduce((t, f) => t + readFileSync(join(OUT, f)).length, 0);
console.log(`bake-sprites: ${keys.length} sprites, ${keep.size} files, ${(bytes / 1024).toFixed(0)} KB` +
  ` (${todo.length} drawn, ${dropped} old files removed)`);
