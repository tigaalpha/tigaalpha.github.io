#!/usr/bin/env node
/* alien-viewer.mjs — a fast way to look at Alien Hunt creatures: bundles ONLY ah-render.ts + ah-engine.ts (no `npm run build`, a few seconds) and
   photographs each kind in the real scene (software GL), from several angles.
     node scripts/alien-viewer.mjs --kinds huntsman,greyling [--dist 4.5] [--yaws 0,0.9,2.2,3.14] [--high 1] [--w 900 --h 560] [--out DIR] [--src DIR_WITH_ah-render.ts]
   Writes DIR/<kind>-<n>.png (one per yaw; yaw is the creature's own turn: 0 faces the camera) and prints the files. --src lets a worktree be viewed. */
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { execSync } from "node:child_process"; import { pathToFileURL, fileURLToPath } from "node:url";
const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith("--") ? [...a, [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "1"]] : a), []));
const ROOT = path.resolve(A.src || path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const OUT = path.resolve(A.out || "alien-shots"); fs.mkdirSync(OUT, { recursive: true });
const kinds = String(A.kinds || "skitter").split(","), yaws = String(A.yaws || "0,0.9,2.2").split(",").map(Number), dist = +(A.dist || 4.5), W = +(A.w || 900), H = +(A.h || 560), HIGH = A.high !== "0";
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href).catch(() => import("esbuild"));
const tmp = path.join(OUT, ".viewer"); fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, "entry.ts"), `
import { createRender } from ${JSON.stringify(path.join(ROOT, "ah-render.ts"))};
import { newState } from ${JSON.stringify(path.join(ROOT, "ah-engine.ts"))};
const host = document.getElementById("h"); host.style.cssText = "position:fixed;inset:0";
const s = newState(7, 0, 0, []); const r = createRender(host, ${HIGH}, 0, null); r.resize();
(window as any).__show = (kind, yaw, dist) => { s.enemies.length = 0; s.spawnQ = []; s.between = 99; s.p.x = 0; s.p.z = 0; s.p.yaw = 0; s.p.pitch = 0; s.p.hp = 100; s.autoFire = false;
  s.enemies.push({ id: 900, kind, x: 0, z: -dist, hp: 999, max: 999, yaw, t: 0.4, cd: 5, dead: 0, flash: 0, leap: 0 }); for (let i = 0; i < 6; i++) r.draw(s, 1 / 20); return true; };
(window as any).__ready = true;`);
await build({ entryPoints: [path.join(tmp, "entry.ts")], bundle: true, format: "iife", outfile: path.join(tmp, "entry.js"), platform: "browser", logLevel: "error", loader: { ".ts": "ts", ".tsx": "tsx" }, nodePaths: [path.join(ROOT, "node_modules")], define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "stub-vite-suffixes", setup(b) { b.onResolve({ filter: /\?(worker|url|raw)/ }, a => ({ path: a.path, namespace: "stubq" })); b.onLoad({ filter: /.*/, namespace: "stubq" }, () => ({ contents: "export default \"\";", loader: "js" })); } }] });
fs.writeFileSync(path.join(tmp, "index.html"), `<!doctype html><meta charset=utf8><style>html,body{margin:0;background:#000}</style><div id=h></div><script src="entry.js"></script>`);
const server = http.createServer((q, s) => { const f = path.join(tmp, q.url.split("?")[0] === "/" ? "index.html" : q.url.split("?")[0]); if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : "text/html" }); s.end(fs.readFileSync(f)); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: W, height: H } }); const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
await page.goto("http://127.0.0.1:" + server.address().port + "/"); await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
for (const k of kinds) for (let i = 0; i < yaws.length; i++) { await page.evaluate(([k, y, d]) => window.__show(k, y, d), [k, yaws[i], k === "tripod" ? dist * 2 : k === "leviathan" ? dist * 1.5 : dist]); await page.waitForTimeout(250); const f = path.join(OUT, `${k}-${i}.png`); await page.screenshot({ path: f }); console.log(f); }
if (errs.length) console.log("PAGE ERRORS:", [...new Set(errs)].slice(0, 5).join(" | "));
await browser.close(); server.close();
