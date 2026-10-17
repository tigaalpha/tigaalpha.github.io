// Transport for the authoritative room core (plan 35, level C): a small always-on WebSocket server. NOT DEPLOYED. Needs `npm i ws` here and a host
// that keeps a process running (Fly.io, Railway, a VPS); Supabase Edge Functions cannot do it. Env: PORT. Clients connect to
// wss://<host>/?room=ABC123&name=Ann and send JSON: {t:"pos",x,y} {t:"hit",i,w}. The server answers {t:"state"} 10 times a second and
// {t:"kill"} events. Identity here is a random id: before real rewards ride on this, verify the Supabase JWT in the connection URL.
import http from "node:http";
import { createRoom, join, move, hit, result } from "./core.mjs";
let WebSocketServer; try { ({ WebSocketServer } = await import("ws")); } catch (e) { console.error("run `npm i ws` in server/adv-room first"); process.exit(1); }
const rooms = new Map(), srv = http.createServer((q, r) => { r.writeHead(200); r.end("adv-room ok"); }), wss = new WebSocketServer({ server: srv });
const clock = () => Date.now() / 1000;
wss.on("connection", (ws, req) => {
  const u = new URL(req.url, "http://x"), code = (u.searchParams.get("room") || "").toUpperCase(), name = u.searchParams.get("name") || "Pilot";
  if (!/^[A-Z0-9]{6}$/.test(code)) return ws.close();
  let room = rooms.get(code); if (!room) { room = createRoom({ code, map: u.searchParams.get("map") || "luma", seed: [...code].reduce((a, c) => a * 31 + c.charCodeAt(0), 7), now: clock() }); room.sock = new Set(); rooms.set(code, room); }
  const id = Math.random().toString(36).slice(2, 10);
  if (!join(room, id, name)) return ws.close();
  room.sock.add(ws); ws.send(JSON.stringify({ t: "hello", id, mons: room.mons.length }));
  ws.on("message", (b) => { let m; try { m = JSON.parse(String(b)); } catch (e) { return; }
    if (m.t === "pos") move(room, id, +m.x, +m.y, clock());
    else if (m.t === "hit") { const r = hit(room, id, m.i | 0, String(m.w), clock()); if (r.ok && r.killed) for (const s of room.sock) s.send(JSON.stringify({ t: "kill", i: m.i | 0, by: id })); }
  });
  ws.on("close", () => { room.sock.delete(ws); room.pilots.delete(id); if (!room.sock.size) { console.log(JSON.stringify(result(room))); rooms.delete(code); } });
});
setInterval(() => { for (const room of rooms.values()) { const st = JSON.stringify({ t: "state", mons: room.mons.map(m => [m.i, Math.round(m.x), m.hp]), pilots: [...room.pilots.values()].map(p => [p.id, Math.round(p.x), p.kills]), done: room.done }); for (const s of room.sock) s.send(st); } }, 100);
srv.listen(+process.env.PORT || 8787, () => console.log("adv-room listening"));
