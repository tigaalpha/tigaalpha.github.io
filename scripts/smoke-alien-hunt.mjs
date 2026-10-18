// Alien Hunt engine checks (plan 38): the real ah-engine.ts, no browser.
import { build } from "esbuild"; import { writeFileSync, mkdtempSync } from "fs"; import { tmpdir } from "os"; import { join } from "path";
const d = mkdtempSync(join(tmpdir(), "ah-")); const out = join(d, "e.mjs");
await build({ entryPoints: ["ah-engine.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
const E = await import(out); let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const s = E.newState(3, 15), inp = E.noInput();
// waves start, aliens appear
for (let i = 0; i < 200; i++) E.step(s, 0.05, inp);
ok(s.wave === 1 && s.enemies.length > 0, "wave 1 spawns aliens");
// tune clock counts only active combat and freezes the sim
const t0 = s.t; let froze = false;
for (let i = 0; i < 600 && !s.frozen; i++) E.step(s, 0.05, inp);
froze = s.frozen; ok(froze && s.tunes === 1, "a question freezes the game after about 15 s of combat");
const before = JSON.stringify([s.enemies.map(e => [e.x, e.z]), s.p.hp, s.t]);
for (let i = 0; i < 100; i++) E.step(s, 0.05, inp);
ok(before === JSON.stringify([s.enemies.map(e => [e.x, e.z]), s.p.hp, s.t]), "nothing moves or hurts while frozen");
E.tuneResult(s, true); ok(!s.frozen && s.grace > 1 && s.p.shield === 25 && s.ammo.rifle.mag === 30, "right answer: shield + reload, grace period");
const hp = s.p.hp; for (let i = 0; i < 20; i++) E.step(s, 0.05, inp); ok(s.p.hp === hp, "no damage during the grace second");
E.tuneResult(s, false); ok(s.tuneStreak === 0, "wrong answer resets the streak only");
// shooting kills
const s2 = E.newState(5, 0); for (let i = 0; i < 100; i++) E.step(s2, 0.05, inp);
const e = s2.enemies[0] || (E.step(s2, 1, inp), s2.enemies[0]); e.x = s2.p.x; e.z = s2.p.z - 6; s2.p.yaw = 0; s2.p.pitch = Math.atan2(0.55 - 1.65, 6);
s2.weapon = "pistol"; const k0 = s2.kills; for (let i = 0; i < 30 && s2.kills === k0; i++) { E.step(s2, 0.3, { ...inp, fire: true }); e.x = s2.p.x; e.z = s2.p.z - 6; }
ok(s2.kills > k0, "the pistol kills an alien in the crosshair");
// walls block shots and movement
const [x, z] = E.collide(E.LEVEL_BOXES, -8, -6, 0.4); ok(Math.abs(x + 8) > 0.5 || Math.abs(z + 6) > 0.5, "a box pushes a circle out");
// a full run with a bot ends (win or lose), never hangs
const s3 = E.newState(9, 0); for (let i = 0; i < 20000 && !s3.done; i++) { const t = s3.enemies.filter(e => e.dead === 0).sort((a, b) => Math.hypot(a.x - s3.p.x, a.z - s3.p.z) - Math.hypot(b.x - s3.p.x, b.z - s3.p.z))[0]; const i2 = E.noInput(); if (t) { s3.p.yaw = Math.atan2(-(t.x - s3.p.x), -(t.z - s3.p.z)); { const A = E.ALIENS[t.kind]; s3.p.pitch = Math.atan2(A.hy * 0.62 - 1.65, Math.hypot(t.x - s3.p.x, t.z - s3.p.z)); } i2.fire = true; } E.step(s3, 0.05, i2); }
ok(s3.done && s3.kills > 3, "a bot-played run reaches an ending (" + (s3.won ? "won" : "lost") + ", " + s3.kills + " kills)");
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
