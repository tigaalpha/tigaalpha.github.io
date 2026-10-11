/* adv-online.ts — Adventure Online (owner, 2026-10-11: play Adventure together with other users, fight monsters and do the missions as a team).
   Same idea and the same hard-rule compliance as pvp-online.ts: a Supabase Realtime BROADCAST + PRESENCE channel named `advo:<CODE>`, no table, no
   RPC, no edge function, nothing to deploy. Up to 4 pilots share a room by its 6-character code. Trust model: friendly co-op, every client runs
   its own game and self-reports; there is no server authority (the same level as the friend duels). What is shared:
     presence   {id, name, model, glow}                     who is in the room
     start      host -> all {planet}                       everybody opens the same map (each sees its own film first)
     pos        each -> all {id, x, y, face, hp}           ~8 per second; teammates are drawn as ghosts that follow
     hit        each -> all {i, v}                         damage on monster number i (-1 = the boss): the same fixed monsters die for everyone
     ev         each -> all {id, k, n}                     "ore", "panel", "kill" shown as a team feed
     chat       each -> all {id, t}                        a quick line / emote above the head
   Monsters that spawn at random during a wave (Jovia, Helios) are not numbered, so only the fixed-spawn maps share kills. */
import { sb } from "./supabase-client";
import { makeRoomCode } from "./pvp-online";

export type Peer = { id: string; name: string; model: string; glow: string; x?: number; y?: number; tx?: number; ty?: number; face?: number; hp?: number; t?: number; say?: string; sayT?: number };
export type Net = {
  code: string; id: string; host: boolean; peers: Map<string, Peer>;
  sendStart: (planet: string) => void; sendPos: (x: number, y: number, face: number, hp: number) => void; sendHit: (i: number, v: number) => void; sendEv: (k: string, n: number) => void; sendChat: (t: string) => void;
  on: (h: Partial<Handlers>) => void; leave: () => void;
};
type Handlers = { onPeers: (list: Peer[]) => void; onStart: (planet: string) => void; onHit: (i: number, v: number, from: string) => void; onEv: (p: Peer | undefined, k: string, n: number) => void; onChat: (p: Peer | undefined, t: string) => void; onLeave: () => void };

export const newPeerId = () => Math.random().toString(36).slice(2, 10);
export const MAX_PILOTS = 4;

export async function openAdvRoom(code: string | null, me: { name: string; model: string; glow: string }): Promise<Net> {
  const host = !code, room = host ? makeRoomCode() : String(code).trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(room)) throw new Error("bad code");
  const id = newPeerId(); const peers = new Map<string, Peer>(); let H: Partial<Handlers> = {};
  const ch = sb.channel(`advo:${room}`, { config: { broadcast: { self: false }, presence: { key: id } } });
  const on = (event: string, fn: (p: any) => void) => ch.on("broadcast", { event }, ({ payload }: any) => fn(payload));
  on("start", (p) => H.onStart && H.onStart(p.planet));
  on("pos", (p) => { const q = peers.get(p.id); if (q) { q.tx = p.x; q.ty = p.y; q.face = p.face; q.hp = p.hp; q.t = Date.now(); if (q.x === undefined) { q.x = p.x; q.y = p.y; } } });
  on("hit", (p) => H.onHit && H.onHit(p.i, p.v, p.id));
  on("ev", (p) => H.onEv && H.onEv(peers.get(p.id), p.k, p.n));
  on("chat", (p) => { const q = peers.get(p.id); if (q) { q.say = String(p.t || "").slice(0, 40); q.sayT = Date.now(); } H.onChat && H.onChat(q, p.t); });
  ch.on("presence", { event: "sync" }, () => {
    try {
      const st = ch.presenceState(); const seen = new Set<string>();
      for (const k of Object.keys(st || {})) { const m: any = st[k] && st[k][0]; if (!m || k === id) continue; seen.add(k); const old = peers.get(k); peers.set(k, { ...(old || {}), id: k, name: m.name || "Pilot", model: m.model || "", glow: m.glow || "#7fe8ff" }); }
      for (const k of [...peers.keys()]) if (!seen.has(k)) peers.delete(k);
      H.onPeers && H.onPeers([...peers.values()]);
    } catch (e) {}
  });
  const send = (event: string, payload: any) => { try { ch.send({ type: "broadcast", event, payload: { ...payload, id } }); } catch (e) {} };
  await new Promise<void>((res, rej) => { const to = setTimeout(() => rej(new Error("timeout")), 9000); ch.subscribe(async (status: string) => { if (status === "SUBSCRIBED") { try { await ch.track({ name: me.name, model: me.model, glow: me.glow }); } catch (e) {} clearTimeout(to); res(); } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(to); rej(new Error(status)); } }); });
  const net: Net = {
    code: room, id, host, peers,
    sendStart: (planet) => send("start", { planet }), sendPos: (x, y, face, hp) => send("pos", { x, y, face, hp }), sendHit: (i, v) => send("hit", { i, v }), sendEv: (k, n) => send("ev", { k, n }), sendChat: (t) => send("chat", { t }),
    on: (h) => { H = { ...H, ...h }; }, leave: () => { try { ch.send({ type: "broadcast", event: "leave", payload: { id } }); } catch (e) {} try { ch.unsubscribe(); } catch (e) {} },
  };
  return net;
}
