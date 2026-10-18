// Alien Hunt engine checks (plan 38): the real ah-engine.ts, no browser.
import { build } from "esbuild"; import { writeFileSync, mkdtempSync } from "fs"; import { tmpdir } from "os"; import { join } from "path";
const d = mkdtempSync(join(tmpdir(), "ah-")); const out = join(d, "e.mjs");
await build({ entryPoints: ["ah-engine.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
const E = await import(out); let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const s = E.newState(3, 15), inp = E.noInput();
// waves start, aliens appear
s.p.hp = 1e6; for (let i = 0; i < 200; i++) E.step(s, 0.05, inp);
ok(s.wave === 1 && s.enemies.length > 0, "wave 1 spawns aliens");
// tune clock counts only active combat and freezes the sim
const t0 = s.t; let froze = false;
for (let i = 0; i < 600 && !s.frozen; i++) { s.p.hp = 100; E.step(s, 0.05, inp); }
froze = s.frozen; ok(froze && s.tunes === 1, "a question freezes the game after about 15 s of combat");
const before = JSON.stringify([s.enemies.map(e => [e.x, e.z]), s.p.hp, s.t]);
for (let i = 0; i < 100; i++) E.step(s, 0.05, inp);
ok(before === JSON.stringify([s.enemies.map(e => [e.x, e.z]), s.p.hp, s.t]), "nothing moves or hurts while frozen");
E.tuneResult(s, true); ok(!s.frozen && s.grace > 1 && s.p.shield === 25 && s.ammo.rifle.mag === 30, "right answer: shield + reload, grace period");
const hp = s.p.hp; for (let i = 0; i < 20; i++) E.step(s, 0.05, inp); ok(s.p.hp === hp, "no damage during the grace second");
E.tuneResult(s, false); ok(s.tuneStreak === 0, "wrong answer resets the streak only");
// shooting kills
const s2 = E.newState(5, 0); for (let i = 0; i < 100; i++) E.step(s2, 0.05, inp);
const e = s2.enemies.find(x => x.kind === "skitter") || (E.step(s2, 1, inp), s2.enemies[0]); e.x = s2.p.x; e.z = s2.p.z - 6; s2.p.yaw = 0; s2.p.pitch = Math.atan2(0.55 - 1.65, 6);
s2.weapon = "pistol"; const k0 = s2.kills; for (let i = 0; i < 30 && s2.kills === k0; i++) { E.step(s2, 0.3, { ...inp, fire: true }); e.x = s2.p.x; e.z = s2.p.z - 6; }
ok(s2.kills > k0, "the pistol kills an alien in the crosshair");
// the plasma launcher blows up a group
{ const s4 = E.newState(5, 0); for (let i = 0; i < 100; i++) E.step(s4, 0.05, inp); s4.weapon = "launcher"; const n = s4.enemies.length; s4.enemies.forEach((e, i) => { e.x = s4.p.x + i * 0.5; e.z = s4.p.z - 10; e.hp = 40; }); s4.p.yaw = 0; s4.p.pitch = -0.05; const k0 = s4.kills; let boom = false;
  E.step(s4, 0.05, { ...inp, fire: true }); for (let i = 0; i < 40; i++) { E.step(s4, 0.05, inp); if (s4.ev.some(e => e.k === "boom")) boom = true; s4.ev = []; }
  ok(boom && s4.kills > k0, "a rocket explodes and kills several aliens at once (" + (s4.kills - k0) + "/" + n + ")"); }
// the Doom-style roles
{ const mk = (kind, x, z) => { const q = E.newState(11, 0); q.wave = 1; q.between = 99; q.p.x = 0; q.p.z = 0; q.p.yaw = 0; q.enemies.push({ id: 99, kind, x, z, hp: 500, max: 500, yaw: 0, t: 0, cd: 0, dead: 0, flash: 0, leap: 0 }); return q; };
  const c = mk("charger", 0, -10); let charge = false, rushed = false; for (let i = 0; i < 60; i++) { E.step(c, 0.05, inp); if (c.ev.some(e => e.k === "charge")) charge = true; if ((c.enemies[0].rush || 0) > 0) rushed = true; c.ev = []; }
  ok(charge && rushed, "the Plated Charger telegraphs for a second, then rushes");
  const c2 = mk("charger", 0, -8); c2.enemies[0].stun = 5; c2.weapon = "rifle"; c2.p.pitch = Math.atan2(E.bodyY("charger") - 1.65, 8); const h0 = c2.enemies[0].hp; E.step(c2, 0.05, { ...inp, fire: true }); const dStun = h0 - c2.enemies[0].hp;
  const c3 = mk("charger", 0, -8); c3.weapon = "rifle"; c3.p.pitch = Math.atan2(E.bodyY("charger") - 1.65, 8); const h1 = c3.enemies[0].hp; E.step(c3, 0.05, { ...inp, fire: true }); const dFront = h1 - c3.enemies[0].hp;
  ok(dStun > dFront * 2, "its armour shrugs off front hits but a dizzy or charging one takes much more (" + dFront.toFixed(1) + " vs " + dStun.toFixed(1) + ")");
  const f = mk("flarecaster", 0, -14); let spit = 0; for (let i = 0; i < 80; i++) { E.step(f, 0.05, inp); spit += f.ev.filter(e => e.k === "spit").length; f.ev = []; } ok(spit >= 1 && f.acid.concat([]).every(a => a.big), "the Flarecaster lobs big plasma balls (" + spit + ")");
  const y = mk("skyeye", 0, -14); let bolts = 0, hurt = 0; for (let i = 0; i < 120; i++) { E.step(y, 0.05, inp); bolts += y.acid.filter(a => a.g === 0).length ? 1 : 0; y.ev = []; } ok(bolts > 0 && y.p.hp < 100, "the Sky Eye floats and fires a spread of straight bolts that can hit (hp " + Math.round(y.p.hp) + ")");
}
// collectible future guns, slide, arrival pace
{ const q = E.newState(21, 0); ok(!q.owned.rail && q.owned.rifle, "only the sidearm and the plasma rifle at the start");
  E.setWeapon(q, "rail"); ok(q.weapon !== "rail", "a gun you have not found cannot be equipped");
  q.pk.push({ id: 900, x: q.p.x, z: q.p.z, w: "rail" }); E.step(q, 0.05, inp); ok(q.owned.rail && q.weapon === "rail" && q.ev.some(e => e.k === "pickup"), "walking over a gun picks it up and equips it");
  const mkE = (x, z) => ({ id: q.nextId++, kind: "skitter", x, z, hp: 9999, max: 9999, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0 }); q.wave = 1; q.between = 99; q.p.yaw = 0; q.p.pitch = Math.atan2(E.bodyY("skitter") - 1.65, 5);
  q.p.pitch = 0.06; q.enemies = [mkE(0, q.p.z - 5), mkE(0, q.p.z - 9), mkE(0, q.p.z - 13)].map(e => ({ ...e, kind: "skyeye" })); q.cd = 0; E.step(q, 0.05, { ...inp, fire: true }); ok(q.enemies.filter(e => e.hp < 9999).length === 3, "the rail cannon pierces every alien on the line");
  E.setWeapon(q, "pistol"); q.owned.arc = true; E.setWeapon(q, "arc"); q.enemies = [mkE(0, q.p.z - 6), mkE(2, q.p.z - 8), mkE(-2, q.p.z - 9), mkE(30, q.p.z - 4)]; q.cd = 0; q.p.pitch = Math.atan2(E.bodyY("skitter") - 1.65, 6); q.ev = []; E.step(q, 0.05, { ...inp, fire: true });
  ok(q.ev.some(e => e.k === "arc") && q.enemies.filter(e => e.hp < 9999).length >= 3 && q.enemies[3].hp === 9999, "the arc caster chains lightning to nearby aliens only");
  const z0 = q.p.z, s0 = q.p.slideCd; E.step(q, 0.05, { ...inp, slide: true }); for (let i = 0; i < 8; i++) E.step(q, 0.05, inp); ok(Math.abs(q.p.z - z0) > 2 && q.p.slideCd > 0.5, "slide throws the player forward fast, with a cooldown");
  const w = E.newState(4, 0); let maxAlive = 0; w.p.hp = 100; for (let i = 0; i < 600; i++) { w.p.hp = 100; E.step(w, 0.05, inp); maxAlive = Math.max(maxAlive, w.enemies.filter(e => e.dead === 0).length); } ok(maxAlive <= 2, "aliens arrive one or two at a time on the early waves (max " + maxAlive + ")"); }
// stick directions: up = forward, down = back, left = left, right = right (yaw 0 faces -z, right is +x)
{ const q = E.newState(31, 0); q.wave = 1; q.between = 99; q.p.yaw = 0; q.p.x = 0; q.p.z = 0; const go = (mx, mz) => { q.p.x = 0; q.p.z = 0; for (let i = 0; i < 10; i++) E.step(q, 0.05, { ...inp, mx, mz }); return [q.p.x, q.p.z]; };
  const f = go(0, 1), b = go(0, -1), l = go(-1, 0), r = go(1, 0);
  ok(f[1] < -1 && b[1] > 1 && l[0] < -1 && r[0] > 1, "stick up walks forward, down back, left left, right right"); }
// walls block shots and movement
const [x, z] = E.collide(E.LEVEL_BOXES, -8, -6, 0.4); ok(Math.abs(x + 8) > 0.5 || Math.abs(z + 6) > 0.5, "a box pushes a circle out");
// a full run with a bot ends (win or lose), never hangs
const s3 = E.newState(9, 0); for (let i = 0; i < 20000 && !s3.done; i++) { const t = s3.enemies.filter(e => e.dead === 0).sort((a, b) => Math.hypot(a.x - s3.p.x, a.z - s3.p.z) - Math.hypot(b.x - s3.p.x, b.z - s3.p.z))[0]; const i2 = E.noInput(); if (t) { s3.p.yaw = Math.atan2(-(t.x - s3.p.x), -(t.z - s3.p.z)); { const A = E.ALIENS[t.kind]; s3.p.pitch = Math.atan2(E.bodyY(t.kind) - 1.65, Math.hypot(t.x - s3.p.x, t.z - s3.p.z)); } i2.fire = true; } E.step(s3, 0.05, i2); }
ok(s3.done && s3.kills > 3, "a bot-played run reaches an ending (" + (s3.won ? "won" : "lost") + ", " + s3.kills + " kills)");
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
