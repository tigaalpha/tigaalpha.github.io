// Robot Adventure 3D, the Luma level on the real Alien Hunt engine (plan 39): the level is valid, its creatures exist and behave, a bot clears it, the boss and its minions appear. No browser.
import { build } from "esbuild"; import { mkdtempSync } from "fs"; import { tmpdir } from "os"; import { join } from "path";
const d = mkdtempSync(join(tmpdir(), "ra-")); const out = join(d, "e.mjs"), out2 = join(d, "d.mjs");
await build({ entryPoints: ["ah-engine.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
await build({ entryPoints: ["ra-data.ts"], bundle: true, format: "esm", outfile: out2, logLevel: "silent", external: [] });
const E = await import(out), D = await import(out2); let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const L = D.RA_LEVELS.luma.level;
ok(D.RA_PLAYABLE.join() === "luma", "only Luma is playable in 3D so far");
ok(L.kit === "jungle" && L.boss === "lumawarden" && L.waves.length === 4, "Luma is a jungle level with four waves and the Luma Warden");
const kinds = new Set(L.waves.flat()); ok(["glowbug", "hound", "thornback", "sporecaster", "lumawarden"].every(k => kinds.has(k) && E.ALIENS[k]), "all five Luma creatures exist in the engine tables");
ok(["glowbug", "hound", "thornback", "sporecaster", "lumawarden"].every(k => E.ALIEN_SCALE[k] > 1 && E.behOf(k)), "each one has a scale and a behaviour it borrows");
const s = E.newState(5, 0, 1, [], null, L);
ok(s.lv === 1 && s.waves === L.waves && s.boxes === L.boxes && s.hz.length === 0, "the engine plays the level it was handed, not an Alien Hunt one");
ok(!E.collide(s.boxes, s.p.x, s.p.z, 0.6).some(Boolean) || (() => { const [x, z] = E.collide(s.boxes, s.p.x, s.p.z, 0.6); return x === s.p.x && z === s.p.z; })(), "the player's spawn is not inside a rock");
ok(L.boxes.every(b => Math.abs(b.x) + b.w / 2 < E.ARENA && Math.abs(b.z) + b.d / 2 < E.ARENA), "every rock is inside the arena");
// a bot that deletes every alien the moment it appears: the level must run through its four waves and end in a win
s.auto = false; const inp = E.noInput(); const seen = new Set(); let boss = 0, minions = 0, win = false;
for (let i = 0; i < 60 * 600 && !s.done; i++) {
  s.p.hp = 100; for (const e of s.enemies) { seen.add(e.kind); if (e.dead === 0) { if (e.kind === "lumawarden") { boss++; if (boss < 120) continue; } e.hp = 0; e.dead = 0.5; } }
  E.step(s, 1 / 60, inp); for (const ev of s.ev) if (ev.k === "win") win = true; s.ev = [];
}
ok(win && s.won, "the level ends in a win once every wave is down");
ok(seen.has("lumawarden") && ["glowbug", "hound", "thornback", "sporecaster"].every(k => seen.has(k)), "every creature of Luma showed up during the run");
// the boss fires and calls help of its own race
const b = E.newState(6, 0, 1, [], null, L); b.auto = false; b.wave = 3; b.between = 0; b.p.hp = 1e6;
for (let i = 0; i < 60 * 40; i++) { E.step(b, 1 / 60, inp); b.ev = []; if (b.enemies.filter(e => e.kind === "glowbug" || e.kind === "hound").length >= 3) minions++; if (minions) break; }
ok(b.enemies.some(e => e.kind === "lumawarden"), "the Warden is in the last wave"); ok(minions > 0, "the Warden has its own minions (glowbugs and hounds) around it");
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
