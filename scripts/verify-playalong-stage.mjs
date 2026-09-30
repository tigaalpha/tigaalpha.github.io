/* Play Along, the world behind the falling notes (play-along-stage.ts).

   The stage is painted once per canvas size and kept, a song only adds its
   lanes to a copy, and the ready screen paints the world a slice at a time in
   the browser's idle time. That only works if a few things hold, and none of
   them can be seen in a screenshot, so this bundles the REAL module and runs
   it in Chromium:

     - paintWorld gives the world back only when its last slice has run, and
       the same object ever after (getWorld finds it); it keeps the newest two
     - a half-painted world is finished by the next caller, not started over
       (no canvas is made twice), and a world painted in slices is pixel for
       pixel the one painted at once — it does not depend on timing
     - the same size painted twice is the same picture (seeded, not random)
     - composeStage draws a song's lanes, hit-line and receptors on a COPY:
       the world is not touched, so the next song can use it again
     - the moving parts (drawStageFx) draw in every mode — Fever, MEGA, a fast
       tempo, before the first beat — and the shooting star appears in its
       second and is gone after it
     - the lowest graphics level has no moving parts (no sprites, no window
       layer) and the top level has them all

   It also prints what a world costs on this machine (informational only:
   the cost of a bake depends on the machine, and a test that timed it would
   only fail on a busy one).

     node scripts/verify-playalong-stage.mjs

   Needs Playwright + Chromium (preinstalled in the cloud containers) and
   esbuild (a Vite dependency). A few seconds. */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

let pwm;
try { pwm = await import("playwright"); } catch (e) {
  try { pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); }
  catch (e2) { console.error("Playwright is not installed (npm i -g playwright)."); process.exit(1); }
}
const pw = pwm.chromium ? pwm : pwm.default;
const EXE = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

const entry = `
import * as ST from "REAL_STAGE";
window.ST = ST;
`;
const plug = { name: "stage", setup(b) {
  b.onResolve({ filter: /^REAL_STAGE$/ }, () => ({ path: path.resolve("play-along-stage.ts") }));
  b.onResolve({ filter: /^ENTRY$/ }, () => ({ path: "entry.js", namespace: "entry" }));
  b.onLoad({ filter: /.*/, namespace: "entry" }, () => ({ contents: entry, loader: "js", resolveDir: path.resolve(".") }));
} };
const bundle = await build({ entryPoints: ["ENTRY"], bundle: true, format: "iife", write: false, plugins: [plug], loader: { ".ts": "ts" }, logLevel: "error" });

const results = [];
const rec = (name, ok, detail) => { results.push({ name, ok }); console.log((ok ? "PASS " : "FAIL ") + name + " — " + detail); };

const browser = await pw.chromium.launch({ ...(EXE ? { executablePath: EXE } : {}) });
const page = await browser.newPage();
const errs = []; page.on("pageerror", e => errs.push(e.message.slice(0, 200)));
await page.setContent("<html><body style='margin:0;background:#000'></body></html>");
await page.addScriptTag({ content: bundle.outputFiles[0].text });

const r = await page.evaluate(() => {
  const ST = window.ST, out = {};
  const px = (cv) => { const c = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261; for (let i = 0; i < c.length; i += 7) h = Math.imul(h ^ c[i], 16777619); return h >>> 0; };
  const at = (cv, x, y, dpr = 2) => Array.from(cv.getContext("2d").getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data);
  // count the canvases the module makes, to see whether a half-painted world is started over
  const made = { n: 0 }, real = document.createElement.bind(document);
  document.createElement = (t, ...a) => { const e = real(t, ...a); if (t === "canvas") made.n++; return e; };
  const count = (fn) => { const n0 = made.n; fn(); return made.n - n0; };

  // ── slices: null until the last one, then the world, always the same one ──
  const K = [300, 320, 2, true];
  out.before = ST.getWorld(...K);
  const first = ST.paintWorld(...K, 1);
  const slices = [first]; let guard = 0;
  while (slices[slices.length - 1] == null && guard++ < 20) slices.push(ST.paintWorld(...K, 1));
  const world = slices[slices.length - 1];
  out.sliceCount = slices.length; out.firstNull = first === null; out.gotWorld = !!world && !!world.cv;
  out.same = ST.paintWorld(...K) === world && ST.getWorld(...K) === world && ST.paintWorld(...K, 1) === world;
  const wHash = px(world.cv);

  // ── a world painted in slices is the one painted at once ──
  const K2 = [300, 320, 2, true];
  const fresh = ST.bakeWorld(...K2);
  out.sliceEqualsWhole = px(fresh.cv) === wHash;
  out.deterministic = px(ST.bakeWorld(...K2).cv) === px(fresh.cv);

  // ── a half-painted world is finished, not started over ──
  const K3 = [260, 300, 2, true];
  const whole = count(() => { ST.bakeWorld(...K3); });
  const split = count(() => { ST.paintWorld(...K3, 2); ST.paintWorld(...K3, 1); ST.paintWorld(...K3); });
  out.wholeCanvases = whole; out.splitCanvases = split;
  out.finished = !!ST.getWorld(...K3);

  // ── the newest two are kept ──
  ST.paintWorld(280, 300, 2, true); ST.paintWorld(290, 300, 2, true);
  out.evicted = ST.getWorld(...K) === null && ST.getWorld(...K3) === null && !!ST.getWorld(280, 300, 2, true) && !!ST.getWorld(290, 300, 2, true);

  // ── composeStage: lanes on a copy ──
  const W = 300, H = 320, hitY = H - 8;
  const w1 = ST.paintWorld(280, 300, 2, true);
  const lanes = [0, 1, 2, 3, 4].map(i => ({ cx: (i + 0.5) / 14, w: 1 / 14, hue: 40 * i }));
  const worldBefore = px(w1.cv);
  const stage = ST.composeStage(w1, { hitY: 292, noteScale: 1, lanes });
  out.worldUntouched = px(w1.cv) === worldBefore;
  out.stageSize = [stage.width, stage.height, w1.cv.width, w1.cv.height];
  const bar = at(stage, 280 / 2, 292, 2), barWorld = at(w1.cv, 280 / 2, 292, 2);
  out.hitLine = [bar.slice(0, 3), barWorld.slice(0, 3)];
  const lane0 = at(stage, (0.5 / 14) * 280, 100, 2), lane0w = at(w1.cv, (0.5 / 14) * 280, 100, 2);
  out.laneTint = [lane0.slice(0, 3), lane0w.slice(0, 3)];
  out.stageDiffers = px(stage) !== worldBefore;
  const none = ST.composeStage(w1, { hitY: 292, noteScale: 1, lanes: [] });
  out.noLanesStillWorks = none.width === stage.width;

  // ── the moving parts ──
  const top = ST.paintWorld(300, 320, 2, true);
  const low = ST.paintWorld(300, 320, 2, false);
  out.levels = { top: [!!top.spr, !!top.wheel, !!top.win, top.stars.length, top.beacons.length], low: [!!low.spr, !!low.wheel, !!low.win] };
  const cv = document.createElement("canvas"); cv.width = 600; cv.height = 640;
  const ctx = cv.getContext("2d");
  const S = (o) => ({ W: 300, H: 320, hz: top.hz, wx: top.wx, wy: top.wy, wR: top.wR, tSec: 6.4, beatF: 5.1, beatPhase: 0.1, pulse: 0.7, downbeat: true, fever: false, mega: false, calm: false, spr: top.spr, world: top, ...o });
  const draws = (o) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 600, 640); ctx.setTransform(2, 0, 0, 2, 0, 0); ST.drawStageFx(ctx, S(o)); return px(cv); };
  const blank = (() => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 600, 640); return px(cv); })();
  const modes = { plain: {}, fever: { fever: true }, mega: { fever: true, mega: true }, calm: { calm: true }, prestart: { beatF: -1, beatPhase: 1, pulse: 0, downbeat: false } };
  out.modes = {}; out.threw = null;
  for (const [k, o] of Object.entries(modes)) { try { out.modes[k] = draws(o) !== blank; } catch (e) { out.threw = k + ": " + e.message; } }
  // the shooting star, isolated: a green sprite, no stars or beacons, no beat
  const green = document.createElement("canvas"); green.width = 112; green.height = 8;
  const gx = green.getContext("2d"); gx.fillStyle = "#00ff00"; gx.fillRect(0, 0, 112, 8);
  const fake = { core: top.spr.core, beam: top.spr.beam, star: top.spr.star, beacon: top.spr.beacon, streak: { cv: green, len: 56 } };
  const empty = { ...top, stars: [], beacons: [] };
  const greens = (t) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 600, 640); ctx.setTransform(2, 0, 0, 2, 0, 0); ST.drawStageFx(ctx, S({ tSec: t, pulse: 0, beatF: -1, beatPhase: 1, downbeat: false, spr: fake, world: empty })); const d = ctx.getImageData(0, 0, 600, 640).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 100 && d[i] < 60 && d[i + 2] < 60) n++; return n; };
  out.star = { first: greens(0.5), during: greens(7.45), after: greens(8.4), later: greens(14.45), start: greens(0) };
  return out;
});

rec("paint-in-slices", r.before === null && r.firstNull && r.gotWorld && r.sliceCount >= 4 && r.same, `${r.sliceCount} slices; null until the last, then the same world every time (getWorld finds it)`);
rec("slices-equal-whole", r.sliceEqualsWhole && r.deterministic, `a world painted a slice at a time is the one painted at once: ${r.sliceEqualsWhole}; the same size twice is the same picture: ${r.deterministic}`);
rec("half-painted-is-finished", r.finished && r.splitCanvases === r.wholeCanvases, `${r.splitCanvases} canvases made when painted in three visits, ${r.wholeCanvases} when painted at once`);
rec("keeps-two", r.evicted, "the newest two worlds are kept, the older ones let go");
const hl = r.hitLine, lt = r.laneTint, sum = (a) => a[0] + a[1] + a[2];
rec("compose-on-a-copy", r.worldUntouched && r.stageSize[0] === r.stageSize[2] && r.stageSize[1] === r.stageSize[3] && r.stageDiffers && sum(hl[0]) > sum(hl[1]) + 150 && sum(lt[0]) !== sum(lt[1]) && r.noLanesStillWorks, `the world is untouched (${r.worldUntouched}); the hit-line is ${JSON.stringify(hl[0])} over ${JSON.stringify(hl[1])}; lane 0's tint ${JSON.stringify(lt[0])} over ${JSON.stringify(lt[1])}; no lanes is fine`);
rec("levels", r.levels.top[0] && r.levels.top[1] && r.levels.top[2] && r.levels.top[3] >= 3 && r.levels.top[4] <= 9 && !r.levels.low[0] && !r.levels.low[1] && !r.levels.low[2], `top: sprites ${r.levels.top[0]}, wheel ${r.levels.top[1]}, window layer ${r.levels.top[2]}, ${r.levels.top[3]} twinkling stars, ${r.levels.top[4]} mast beacons (chance decides how many) · lowest: sprites ${r.levels.low[0]}, wheel ${r.levels.low[1]}, window layer ${r.levels.low[2]}`);
rec("moving-parts-draw", !r.threw && Object.values(r.modes).every(Boolean), `${Object.entries(r.modes).map(([k, v]) => k + " " + v).join(" · ")}${r.threw ? " · threw " + r.threw : ""}`);
rec("shooting-star", r.star.during > 30 && r.star.first === 0 && r.star.start === 0 && r.star.after === 0 && r.star.later > 30, `green pixels at 0 s ${r.star.start}, 0.5 s ${r.star.first}, during the second of the first star (7.45 s) ${r.star.during}, after it (8.4 s) ${r.star.after}, during the second one (14.45 s) ${r.star.later}`);
rec("no-page-errors", errs.length === 0, errs.length ? errs[0] : "none");

// what it costs here, for the record
const cost = await page.evaluate(() => {
  const ST = window.ST, t = (fn, n) => { const a = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); fn(); a.push(performance.now() - t0); } a.sort((x, y) => x - y); return a[a.length >> 1]; };
  const lanes = [0, 1, 2, 3, 4].map(i => ({ cx: (i + 0.5) / 14, w: 1 / 14, hue: 40 * i }));
  const world = ST.bakeWorld(376, 344, 2, true);
  return { world: t(() => ST.bakeWorld(376, 344, 2, true), 9), compose: t(() => { const s = ST.composeStage(world, { hitY: 336, noteScale: 1, lanes }); s.getContext("2d").getImageData(0, 0, 1, 1); }, 9) };
});
console.log(`(for the record, 376×344 at 2×: a world ${cost.world.toFixed(1)} ms, a song's lanes on it ${cost.compose.toFixed(1)} ms)`);

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed` + (failed.length ? " · failed: " + failed.map(f => f.name).join(", ") : ""));
process.exit(failed.length ? 1 : 0);
