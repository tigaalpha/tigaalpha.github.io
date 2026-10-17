// The authoritative room core: the server, not the phone, decides damage and kills (plan 35 level C). No network, no browser.
import { createRoom, join, move, hit, result, WEAPONS } from "../server/adv-room/core.mjs";
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const R = createRoom({ code: "ABC123", map: "luma", seed: 7, now: 0 }); join(R, "a", "Ann"); join(R, "b", "Bo");
ok("monsters are placed by the server", R.mons.length === 16 && R.mons.every(m => m.hp > 0));
const m0 = R.mons[0];
ok("too far away: refused", hit(R, "a", 0, "punch", 1).reason === "reach");
ok("a pilot cannot teleport", move(R, "a", m0.x, 0, 0.1) === false && R.pilots.get("a").x === 160);
let t = 1; for (let x = 160; x < m0.x; x += 400) { t += 0.6; move(R, "a", Math.min(x + 400, m0.x), 0, t); }   // walk there at ~670 px/s
ok("walking at a believable speed is accepted", Math.abs(R.pilots.get("a").x - m0.x) < 5, "x " + R.pilots.get("a").x + " vs " + m0.x);
const h = hit(R, "a", 0, "punch", t + 1); ok("in reach: the server works the damage out itself", h.ok && h.dmg === WEAPONS.punch.dmg);
ok("hitting again at once is refused (cooldown)", hit(R, "a", 0, "punch", t + 1.05).reason === "cooldown");
ok("an unknown weapon is refused", hit(R, "a", 0, "nuke", t + 3).reason === "bad");
let n = 0, tt = t + 2; while (!R.mons[0].dead && n++ < 40) { tt += 0.5; hit(R, "a", 0, "punch", tt); }
ok("a monster dies when the server's health runs out, and the killer is credited", R.mons[0].dead && R.pilots.get("a").kills === 1);
ok("a dead monster cannot be killed twice", hit(R, "a", 0, "punch", tt + 1).reason === "dead" && R.pilots.get("a").kills === 1);
ok("the other pilot has no kills", R.pilots.get("b").kills === 0);
const full = createRoom({ code: "ZZZ999", map: "luma", now: 0 }); for (const id of ["1", "2", "3", "4"]) join(full, id, id);
ok("a fifth pilot is refused", join(full, "5", "x") === false);
const res = result(R); ok("the result lists what the server will vouch for", res.pilots.length === 2 && res.pilots[0].kills === 1 && res.totalKills === 1);
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
