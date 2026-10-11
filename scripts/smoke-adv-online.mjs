// Adventure Online: the room logic of adv-online.ts against an in-memory stand-in for the Realtime channel (the container cannot reach Supabase).
import { build } from "esbuild"; import { pathToFileURL } from "node:url";
const fake = `
const rooms = new Map();
export const sb = { channel(name, cfg) {
  const key = cfg.config.presence.key; const r = rooms.get(name) || rooms.set(name, { subs: new Set(), pres: {} }).get(name);
  const me = { key, handlers: { broadcast: [], presence: [] }, self: cfg.config.broadcast.self };
  const api = {
    on(type, filter, fn) { me.handlers[type].push({ filter, fn }); return api; },
    subscribe(cb) { r.subs.add(me); setTimeout(() => cb("SUBSCRIBED"), 5); return api; },
    track(p) { r.pres[key] = [p]; setTimeout(() => { for (const s of r.subs) for (const h of s.handlers.presence) h.fn(); }, 2); return Promise.resolve(); },
    presenceState() { return r.pres; },
    send({ event, payload }) { setTimeout(() => { for (const s of r.subs) { if (s === me) continue; for (const h of s.handlers.broadcast) if (h.filter.event === event) h.fn({ payload }); } }, 1); return Promise.resolve(); },
    unsubscribe() { r.subs.delete(me); delete r.pres[key]; for (const s of r.subs) for (const h of s.handlers.presence) h.fn(); },
  }; return api; } };`;
const out = "/tmp/_advo.mjs";
await build({ entryPoints: ["adv-online.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent", plugins: [{ name: "fake-sb", setup(b) { b.onResolve({ filter: /supabase-client$/ }, () => ({ path: "fake", namespace: "fk" })); b.onLoad({ filter: /.*/, namespace: "fk" }, () => ({ contents: fake, loader: "js" })); } }] });
const M = await import(pathToFileURL(out).href);
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const host = await M.openAdvRoom(null, { name: "Ann", model: "vanguard", glow: "#ff0000" });
ok("the host gets a 6-character room code", /^[A-Z0-9]{6}$/.test(host.code) && host.host);
const guest = await M.openAdvRoom(host.code, { name: "Bo", model: "vanguard", glow: "#00ff00" });
await wait(30);
ok("both pilots see each other in the room", host.peers.size === 1 && guest.peers.size === 1 && [...host.peers.values()][0].name === "Bo");
let started = null; guest.on({ onStart: (p) => { started = p; } }); host.sendStart("ferro"); await wait(30);
ok("the host's start reaches the guest with the map", started === "ferro");
guest.sendPos(120, 0, 1, 77); await wait(30); const q = [...host.peers.values()][0];
ok("positions arrive (x, face, hp) for the ghost", q.tx === 120 && q.face === 1 && q.hp === 77);
let got = null; host.on({ onHit: (i, v, from) => { got = { i, v, from }; } }); guest.sendHit(3, 11); await wait(30);
ok("a hit on monster 3 reaches the teammate, tagged with who sent it", got && got.i === 3 && got.v === 11 && got.from === guest.id);
let feed = null; host.on({ onEv: (p, k, n) => { feed = [p && p.name, k, n]; } }); guest.sendEv("ore", 4); await wait(30);
ok("an ore event shows who dug it", feed && feed[0] === "Bo" && feed[1] === "ore" && feed[2] === 4);
guest.sendChat("👍"); await wait(30); ok("a quick emote sets the ghost's line", [...host.peers.values()][0].say === "👍");
let warSeen = null; guest.on({ onStart: (pl, w) => { warSeen = w; } }); host.sendStart("ferro", true); await wait(30);
ok("the host's war flag reaches the guest (and both nets know it)", warSeen === true && guest.war === true && host.war === true);
ok("war teams split the two pilots into different teams on both sides", M.warTeamOf(host, host.id) !== M.warTeamOf(host, guest.id) && M.warTeamOf(host, host.id) === M.warTeamOf(guest, host.id));
host.sendStart("ferro", false); await wait(30); ok("a normal start clears the war flag", guest.war === false && host.war === false);
guest.leave(); await wait(30); ok("leaving removes the pilot from the room", host.peers.size === 0);
let bad = false; try { await M.openAdvRoom("abc", { name: "x", model: "", glow: "" }); } catch (e) { bad = true; } ok("a malformed code is refused", bad);
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
