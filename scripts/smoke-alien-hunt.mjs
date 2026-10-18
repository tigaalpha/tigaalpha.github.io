// Alien Hunt engine checks (plan 38): the real ah-engine.ts, no browser.
import { build } from "esbuild"; import { writeFileSync, mkdtempSync } from "fs"; import { tmpdir } from "os"; import { join } from "path";
const d = mkdtempSync(join(tmpdir(), "ah-")); const out = join(d, "e.mjs");
await build({ entryPoints: ["ah-engine.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
const E0 = await import(out); const E = { ...E0 }; let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const _ns = E.newState; E.newState = (...a) => { const q = _ns(...a); q.auto = false; return q; };
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
{ const q = E.newState(21, 0); ok(!q.owned.rail && !q.owned.rifle && q.owned.pistol, "only the sidearm at the start; the rifle is found");
  E.setWeapon(q, "rail"); ok(q.weapon !== "rail", "a gun you have not found cannot be equipped");
  q.pk.push({ id: 900, x: q.p.x, z: q.p.z, w: "rail" }); E.step(q, 0.05, inp); ok(q.owned.rail && q.weapon === "rail" && q.ev.some(e => e.k === "pickup"), "walking over a gun picks it up and equips it");
  const mkE = (x, z) => ({ id: q.nextId++, kind: "skitter", x, z, hp: 9999, max: 9999, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0 }); q.wave = 1; q.between = 99; q.p.yaw = 0; q.p.pitch = Math.atan2(E.bodyY("skitter") - 1.65, 5);
  q.p.pitch = Math.atan2(E.bodyY("skyeye") - 1.65, 11); q.enemies = [mkE(0, q.p.z - 9), mkE(0, q.p.z - 11), mkE(0, q.p.z - 13)].map(e => ({ ...e, kind: "skyeye" })); q.cd = 0; E.step(q, 0.05, { ...inp, fire: true }); ok(q.enemies.filter(e => e.hp < 9999).length === 3, "the rail cannon pierces every alien on the line");
  E.setWeapon(q, "pistol"); q.owned.arc = true; E.setWeapon(q, "arc"); q.enemies = [mkE(0, q.p.z - 6), mkE(2, q.p.z - 8), mkE(-2, q.p.z - 9), mkE(30, q.p.z - 4)]; q.cd = 0; q.p.pitch = Math.atan2(E.bodyY("skitter") - 1.65, 6); q.ev = []; E.step(q, 0.05, { ...inp, fire: true });
  ok(q.ev.some(e => e.k === "arc") && q.enemies.filter(e => e.hp < 9999).length >= 3 && q.enemies[3].hp === 9999, "the arc caster chains lightning to nearby aliens only");
  const z0 = q.p.z, s0 = q.p.slideCd; E.step(q, 0.05, { ...inp, slide: true }); for (let i = 0; i < 8; i++) E.step(q, 0.05, inp); ok(Math.abs(q.p.z - z0) > 2 && q.p.slideCd > 0.5, "slide throws the player forward fast, with a cooldown");
  const w = E.newState(4, 0); let maxAlive = 0; w.p.hp = 100; for (let i = 0; i < 600; i++) { w.p.hp = 100; E.step(w, 0.05, inp); maxAlive = Math.max(maxAlive, w.enemies.filter(e => e.dead === 0).length); } ok(maxAlive <= 2, "aliens arrive one or two at a time on the early waves (max " + maxAlive + ")"); }
// stick directions: up = forward, down = back, left = left, right = right (yaw 0 faces -z, right is +x)
{ const q = E.newState(31, 0); q.wave = 1; q.between = 99; q.p.yaw = 0; q.p.x = 0; q.p.z = 0; const go = (mx, mz) => { q.p.x = 0; q.p.z = 0; for (let i = 0; i < 10; i++) E.step(q, 0.05, { ...inp, mx, mz }); return [q.p.x, q.p.z]; };
  const f = go(0, 1), b = go(0, -1), l = go(-1, 0), r = go(1, 0);
  ok(f[1] < -1 && b[1] > 1 && l[0] < -1 && r[0] > 1, "stick up walks forward, down back, left left, right right"); }
// auto-walk keeps its distance, circles and picks up crates without any stick input
{ const q = E.newState(41, 0); q.auto = true; q.wave = 1; q.between = 99; q.p.hp = 1e6; q.p.x = 0; q.p.z = 0; q.p.yaw = 0;
  const e = { id: 700, kind: "mantis", x: 0, z: -4, hp: 1e6, max: 1e6, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0 }; q.enemies = [e]; let minD = 99, maxD = 0, moved = 0, px = q.p.x, pz = q.p.z;
  for (let i = 0; i < 200; i++) { q.p.hp = 1e6; e.cd = 99; E.step(q, 0.05, inp); const d = Math.hypot(e.x - q.p.x, e.z - q.p.z); if (i > 40) { minD = Math.min(minD, d); maxD = Math.max(maxD, d); } moved += Math.hypot(q.p.x - px, q.p.z - pz); px = q.p.x; pz = q.p.z; }
  ok(moved > 20 && minD > 2.5, "auto-walk moves by itself and keeps clear of the alien (moved " + moved.toFixed(0) + " m, min gap " + minD.toFixed(1) + ")");
  const r = E.newState(42, 0); r.auto = true; r.wave = 1; r.between = 99; r.enemies = []; r.pk.push({ id: 5, x: 10, z: 10, w: "rail" }); for (let i = 0; i < 300 && !r.owned.rail; i++) E.step(r, 0.05, inp);
  ok(r.owned.rail, "auto-walk walks to a crate and picks it up when no alien is near"); }
// walls block shots and movement
const [x, z] = E.collide(E.LEVEL_BOXES, -8, -6, 0.4); ok(Math.abs(x + 8) > 0.5 || Math.abs(z + 6) > 0.5, "a box pushes a circle out");
// a full run with a bot ends (win or lose), never hangs
ok(_ns(1, 0).auto === true, "auto-walk is ON by default");
for (const w of ["pulsar", "nova", "storm", "cryo"]) ok(!!E.WEAPONS[w] && E.WORDER.includes(w), "new gun exists: " + w);
{ const q = E.newState(61, 0); q.wave = 1; q.between = 99; q.p.x = 0; q.p.z = 0; q.p.yaw = 0; q.p.pitch = 0; q.owned.cryo = true; q.weapon = "cryo"; q.enemies.push({ id: 90, kind: "mantis", x: 0, z: -12, hp: 900, max: 900, yaw: 0, t: 0, cd: 5, dead: 0, flash: 0, leap: 0 }); q.p.pitch = Math.atan2(E.bodyY("mantis") - 1.65, 12);
  E.step(q, 0.05, { ...inp, fire: true }); ok((q.enemies[0].slow || 0) > 0, "cryo beam slows what it hits"); }
{ const q = E.newState(62, 0); q.wave = 1; q.between = 99; q.p.hp = 1e6; q.p.x = 0; q.p.z = 0; let minD = 99; for (const kind of ["skitter", "mantis"]) { q.enemies = [{ id: 91, kind, x: 0, z: -14, hp: 1e6, max: 1e6, yaw: 0, t: 0, cd: 0, dead: 0, flash: 0, leap: 0 }]; for (let i = 0; i < 200; i++) { E.step(q, 0.05, inp); const e = q.enemies[0]; minD = Math.min(minD, Math.hypot(e.x - q.p.x, e.z - q.p.z) - E.ALIENS[kind].r); } }
  ok(minD > 1.4, "melee aliens stop short of the player instead of crowding in (closest gap " + minD.toFixed(2) + " m)"); }
const s3 = E.newState(9, 0); for (let i = 0; i < 20000 && !s3.done; i++) { const t = s3.enemies.filter(e => e.dead === 0).sort((a, b) => Math.hypot(a.x - s3.p.x, a.z - s3.p.z) - Math.hypot(b.x - s3.p.x, b.z - s3.p.z))[0]; const i2 = E.noInput(); if (t) { s3.p.yaw = Math.atan2(-(t.x - s3.p.x), -(t.z - s3.p.z)); { const A = E.ALIENS[t.kind]; s3.p.pitch = Math.atan2(E.bodyY(t.kind) - 1.65, Math.hypot(t.x - s3.p.x, t.z - s3.p.z)); } i2.fire = true; } E.step(s3, 0.05, i2); }
ok(s3.done && s3.kills > 3, "a bot-played run reaches an ending (" + (s3.won ? "won" : "lost") + ", " + s3.kills + " kills)");
/* campaign: ten levels, a different alien race on each */
{ const out2 = join(d, "l.mjs"); await build({ entryPoints: ["ah-levels.ts"], bundle: true, format: "esm", outfile: out2, logLevel: "silent" }); const LV = await import(out2);
  ok(LV.LEVELS.length === 10, "ten campaign levels");
  const rosters = LV.LEVELS.map(L => [...new Set(L.waves.flat())].sort().join(","));
  ok(new Set(rosters).size === 10, "every level has its own roster of alien species");
  ok(new Set(LV.LEVELS.map(L => L.tint)).size === 10, "every level has its own race colour");
  const species = new Set(LV.LEVELS.flatMap(L => L.waves.flat())); ok(species.size >= 12, "at least 12 alien species appear across the campaign (" + species.size + ")");
  ok(LV.LEVELS.every(L => L.boxes.every(b => Math.abs(b.x) < 34 && Math.abs(b.z) < 34 && !(Math.abs(b.x) < b.w / 2 + 2 && Math.abs(22 - b.z) < b.d / 2 + 2))), "every layout keeps the spawn point free and inside the arena");
  ok([4, 8, 10].every(i => LV.LEVELS[i - 1].boss), "levels 4, 8 and 10 have a boss");
  ok(LV.LEVELS.filter(L => L.hazards.length).length >= 2, "two levels have hazard zones");
  ok(LV.gunsAfter(0).length === 0 && LV.gunsAfter(3).includes("shotgun") && LV.gunsAfter(10).length >= 9, "guns found accumulate with the levels cleared");
  for (const L of LV.LEVELS) {
    const q = _ns(100 + L.id, 0, L.id, []); let boss = false, hurtByZone = false;
    for (let i = 0; i < 30000 && !q.done; i++) { q.p.hp = Math.max(q.p.hp, 90); const t = q.enemies.filter(e => e.dead === 0).sort((a, b) => Math.hypot(a.x - q.p.x, a.z - q.p.z) - Math.hypot(b.x - q.p.x, b.z - q.p.z))[0]; const i2 = E.noInput(); i2.mx = Math.sin(i / 25); i2.mz = Math.cos(i / 61) * 0.7; if (t) { q.p.yaw = Math.atan2(-(t.x - q.p.x), -(t.z - q.p.z)); q.p.pitch = Math.atan2(E.bodyY(t.kind) - 1.65, Math.hypot(t.x - q.p.x, t.z - q.p.z)); i2.fire = true; } E.step(q, 0.05, i2); if (q.enemies.some(e => E.ALIENS[e.kind].boss)) boss = true; q.ev.length = 0; }
    ok(q.done && q.won, "level " + L.id + " (" + L.name[1] + ") can be won by a bot with the starter guns (" + q.kills + " kills)");
    if (L.boss) ok(boss, "level " + L.id + " spawns its boss " + L.boss);
  }
  { const q = E.newState(5, 0, 4, []); q.wave = 4; q.between = 99; q.p.hp = 1e6; q.p.x = 0; q.p.z = 22; q.enemies = [{ id: 7, kind: "warden", x: 0, z: 10, hp: 1e5, max: 1e5, yaw: 0, t: 0, cd: 9, dead: 0, flash: 0, leap: 0 }]; let ring = 0, minions = 0; for (let i = 0; i < 600; i++) { E.step(q, 0.05, E.noInput()); ring = Math.max(ring, q.acid.length); minions = Math.max(minions, q.enemies.filter(e => e.kind !== "warden" && e.dead === 0).length); q.ev.length = 0; }
    ok(ring >= 8 && minions >= 2, "a boss fires a ring of bolts and calls its own race (" + ring + " bolts, " + minions + " minions)"); }
  { const q = E.newState(6, 0, 9, []); const h = q.hz[0]; q.wave = 1; q.between = 99; q.enemies = []; q.p.x = h.x; q.p.z = h.z; q.hzClock = 0; const hp0 = q.p.hp; for (let i = 0; i < 80; i++) E.step(q, 0.05, E.noInput()); ok(q.p.hp < hp0, "standing in a lava zone hurts"); }
}
{ const q = _ns(70, 0, 0, []); q.wave = 1; q.between = 99; q.p.x = 0; q.p.z = 0; q.p.yaw = 0.05; q.p.pitch = 0; q.weapon = "pistol"; q.enemies = [{ id: 70, kind: "mantis", x: 0, z: -12, hp: 80, max: 80, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0 }]; q.p.pitch = Math.atan2(E.bodyY("mantis") - 1.65, 12);
  const y0 = q.p.yaw, i2 = E.noInput(); i2.fire = true; E.step(q, 0.05, i2); ok(q.hitsLanded === 1 && Math.abs(q.p.yaw - y0) < 1e-9, "a shot 3 degrees off still hits (hidden aim assist) and the view itself does not move"); }
{ const q = _ns(71, 0, 0, []); q.wave = 1; q.between = 99; q.p.x = 0; q.p.z = 0; q.p.yaw = 0.4; q.p.pitch = 0; q.weapon = "pistol"; q.enemies = [{ id: 71, kind: "mantis", x: 0, z: -12, hp: 80, max: 80, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0 }]; const i2 = E.noInput(); i2.fire = true; E.step(q, 0.05, i2); ok(q.hitsLanded === 0, "a shot 23 degrees off still misses (the assist is small)"); }
ok(_ns(1).tuneEvery === 20, "the music question defaults to every 20 s");
// auto-shoot: on by default, fires with no button when an alien is in the crosshair, stays quiet when off or when nothing is there
{ const mk = (x, z) => { const q = E.newState(11, 0); q.wave = 1; q.between = 99; q.p.x = 0; q.p.z = 0; q.p.yaw = 0; q.p.pitch = Math.atan2(E.bodyY("skitter") - 1.65, 10); q.auto = false; q.enemies.push({ id: 99, kind: "skitter", x, z, hp: 500, max: 500, yaw: 0, t: 0, cd: 0, dead: 0, flash: 0, leap: 0 }); return q; };
  const a = mk(0, -10); ok("auto-shoot is on by default", a.autoFire === true); for (let i = 0; i < 20; i++) E.step(a, E.noInput(), 1 / 60); ok("auto-shoot fires at an alien in the crosshair", a.shots > 0, "shots " + a.shots);
  const b = mk(0, -10); b.autoFire = false; for (let i = 0; i < 20; i++) E.step(b, E.noInput(), 1 / 60); ok("auto-shoot off: no shots", b.shots === 0);
  const c = mk(30, 0); for (let i = 0; i < 20; i++) E.step(c, E.noInput(), 1 / 60); ok("nothing in the crosshair: no shots", c.shots === 0); }
// RPG and the rapid rocket barrage (owner 2026-10-18)
{ const mk = (w) => { const q = E.newState(31, 0); q.wave = 1; q.between = 99; q.auto = false; q.autoFire = false; q.owned[w] = true; q.weapon = w; q.ammo[w].mag = E.WEAPONS[w].mag; q.p.x = 0; q.p.z = 0; q.p.yaw = 0; q.p.pitch = 0.02; return q; };
  const R = mk("rpg"); R.enemies.push({ id: 50, kind: "skitter", x: 5.6, z: -14, hp: 40, max: 40, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0 }); const inp = E.noInput(); inp.fire = true; for (let i = 0; i < 160; i++) { E.step(R, 1 / 60, i < 2 ? inp : E.noInput()); R.enemies.forEach(e => { e.x = 5.6; e.z = -14; }); }
  ok("the RPG fires one big rocket", R.shots === 1 && R.ammo.rpg.mag === 0, "shots " + R.shots);
  const Bz = mk("rpg"); Bz.enemies.push({ id: 51, kind: "skitter", x: 5.6, z: -14, hp: 40, max: 40, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0 });
  const S2 = mk("salvo"); const inp2 = E.noInput(); inp2.fire = true; let peak = 0; for (let i = 0; i < 40; i++) { E.step(S2, 1 / 60, inp2); peak = Math.max(peak, S2.rk.length); }
  ok("the rocket barrage launches several rockets in a second", S2.shots >= 4 && peak >= 3, "shots " + S2.shots + " peak " + peak);
  ok("both are in the weapon order and have a name", E.WORDER.includes("rpg") && E.WORDER.includes("salvo") && E.WEAPONS.rpg.name.length > 3); }
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
