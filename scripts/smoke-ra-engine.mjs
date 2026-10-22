// Robot Adventure 3D, the Luma level on the real Alien Hunt engine (plan 39): the level is valid, its creatures exist and behave, a bot clears it, the boss and its minions appear. No browser.
import { build } from "esbuild"; import { mkdtempSync } from "fs"; import { tmpdir } from "os"; import { join } from "path";
const d = mkdtempSync(join(tmpdir(), "ra-")); const out = join(d, "e.mjs"), out2 = join(d, "d.mjs");
await build({ entryPoints: ["ah-engine.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
await build({ entryPoints: ["ra-factory.ts"], bundle: true, format: "esm", outfile: out2, logLevel: "silent", external: [] });
const E = await import(out), D = await import(out2); let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
ok(D.RA_ALL.length === 49 && D.RA_ALL.every(id => D.defOf(id)), "all 49 episodes have a definition (foot or ship)");
const SHIPS = D.RA_ALL.filter(id => D.defOf(id).kind === "ship"); ok(SHIPS.length >= 15, "the ship episodes are routed to the cockpit: " + SHIPS.length);
for (const id of D.RA_ALL.filter(id => D.defOf(id).kind === "foot")) {
  const R = D.defOf(id).data, L = R.level, tag = id + ": ";
  const M = L.mission; ok(L.kit && L.waves.length >= 3 && (M || (L.boss && E.ALIENS[L.boss].boss)), tag + "a kit, waves and a boss or a mission");
  ok(R.radio.length === 3 && R.brief[0] && R.win[2], tag + "briefing, three radio lines and a win line in all languages");
  const kinds = new Set(L.waves.flat()); ok([...kinds].every(k => E.ALIENS[k] && E.ALIEN_SCALE[k] && E.behOf(k)), tag + "every creature exists in the engine tables");
  const s = E.newState(5, 0, 1, [], null, L);
  ok(s.lv === L.id && s.waves === L.waves && s.boxes === L.boxes && s.hz === L.hazards, tag + "the engine plays the level it was handed");
  const [cx, cz] = E.collide(s.boxes, s.p.x, s.p.z, 0.6); ok(cx === s.p.x && cz === s.p.z, tag + "the spawn is clear of rocks");
  ok(L.boxes.every(b => Math.abs(b.x) + b.w / 2 < E.ARENA && Math.abs(b.z) + b.d / 2 < E.ARENA), tag + "every rock is inside the arena");
  ok(L.hazards.every(h => Math.hypot(h.x - s.p.x, h.z - s.p.z) > h.r + 1), tag + "no hazard on the spawn");
  s.auto = false; const inp = E.noInput(); const seen = new Set(); let boss = 0, win = false, pri = "";
  for (let i = 0; i < 60 * 900 && !s.done; i++) {
    s.p.hp = 100;
    for (const e of s.enemies) { seen.add(e.kind); if (e.dead === 0) { if (E.ALIENS[e.kind].boss) { boss++; if (boss < 120) continue; } e.hp = 0; e.dead = 0.5; } }
    if (s.ms && s.ms.type !== "survive") { const it = s.ms.items.find(q => !q.done); if (it && s.ms.phase === 0) { s.p.x = it.x; s.p.z = it.z; inp.dig = true; } }
    if (s.frozen && s.ms && s.ms.ask >= 0) E.answerTune(s, true);
    E.step(s, 1 / 60, inp); for (const ev of s.ev) { if (ev.k === "win") win = true; if (ev.k === "strike") pri = "strike"; } s.ev = [];
  }
  ok(win && s.won && (!L.boss || seen.has(L.boss)), tag + (M ? "a bot completes the " + M.type + " mission" : "a bot clears four waves and meets the boss"));
  if (M) ok(M.type !== "strike" || (pri === "strike" && seen.has(M.boss)), tag + (M.type === "strike" ? "the orbital strike fires and the commander lands" : "mission rules ran")); else ok(true, tag + "no mission");
  if (M && M.type === "survive") { const q = E.newState(8, 0, 1, [], null, L); q.auto = false; for (let i = 0; i < 60 * 60; i++) { q.p.hp = 100; E.step(q, 1 / 60, inp); q.ev = []; } ok(!q.done && q.ms.prog > 55, tag + "the clock runs and the level is not over early"); } else ok(true, tag + "n/a");
  if (!L.boss || M) { ok(true, tag + "no boss to check"); continue; }
  const b = E.newState(6, 0, 1, [], null, L); b.auto = false; b.wave = 3; b.between = 0; b.p.hp = 1e6; let help = 0;
  for (let i = 0; i < 60 * 40 && !help; i++) { E.step(b, 1 / 60, inp); b.ev = []; if (b.enemies.filter(e => !E.ALIENS[e.kind].boss).length >= 3) help = 1; }
  ok(help && b.enemies.some(e => e.kind === L.boss), tag + "the boss comes with its minions");
}
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
