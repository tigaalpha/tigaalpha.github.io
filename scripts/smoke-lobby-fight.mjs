// Hit-tests the landscape lobby Fight button: its centre and corners must land on it, never on a sibling.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const chromium = (pwm.chromium ? pwm : pwm.default).chromium;
const root = path.resolve("dist");
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, "index.html"); r.setHeader("content-type", {".js":"text/javascript",".css":"text/css",".html":"text/html",".json":"application/json"}[path.extname(f)] || "application/octet-stream"); r.end(fs.readFileSync(f)); }).listen(0);
const port = srv.address().port;
const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
let bad = 0;
for (const [w, h] of [[844, 390], [740, 340], [915, 412]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const p = await c.newPage();
  await p.addInitScript(() => { localStorage.setItem("tg_test_hook", "1"); localStorage.setItem("tg_gp_free", "1"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); sessionStorage.setItem("tiga_page", "pvp"); });
  await p.goto(`http://localhost:${port}/`); await p.waitForSelector(".pvpgo-hero",{state:"attached",timeout:20000}).catch(()=>{}); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll(".atpopup").forEach(x => x.remove())); const r = await p.evaluate(() => { const e = document.querySelector(".pvpgo-hero"); if (!e) return null; const b = e.getBoundingClientRect(); const pts = [[.5,.5],[.15,.3],[.85,.3],[.15,.8],[.85,.8]].map(([x,y]) => { const t = document.elementFromPoint(b.left + b.width*x, b.top + b.height*y); return t ? (t.closest(".pvpgo-hero") ? true : t.tagName + "." + String(t.className).slice(0,40)) : null; }); return { pts, rect: [b.left|0, b.top|0, b.width|0, b.height|0] }; });
  console.log(w + "x" + h, JSON.stringify(r)); if (!r || r.pts.some(x => x !== true)) bad++;
  await c.close();
}
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
