import { build } from "esbuild";
import { pathToFileURL } from "url";
const out = "/tmp/ra-ship.mjs";
await build({ entryPoints: ["ra-ship.ts"], bundle: true, format: "esm", outfile: out, logLevel: "error" });
const m = await import(pathToFileURL(out).href);
let bad = 0; const ok = (c, msg) => { console.log((c ? "ok   " : "FAIL ") + msg); if (!c) bad++; };
for (const k of ["launch","belt","harvest","solar","skim","warp","dogfight","blackhole","evade"]) {
  const s = m.newShip(k, 2, 7); let asked = 0, t = 0;
  while (!s.done && t < 400) {
    if (s.frozen) { asked++; m.shipAnswerAny(s, true); continue; }
    s.p.hp = Math.max(s.p.hp, 60); m.stepShip(s, 1 / 30, { sx: 0, sy: 0, fire: false, boost: false }); t += 1 / 30;
  }
  ok(s.done && s.won, `${k}: bot wins (t=${t.toFixed(0)}s, questions=${asked})`);
}
const s = m.newShip("launch", 2, 3); let n = 0;
while (!s.frozen && n++ < 20000) { s.p.hp = 100; m.stepShip(s, 1 / 30, { sx: 0, sy: 0, fire: false, boost: false }); }
const g = s.ask.i; m.shipAnswerAny(s, false);
ok(!s.gates[g].done, "wrong answer: gate comes round again");
process.exit(bad ? 1 : 0);
