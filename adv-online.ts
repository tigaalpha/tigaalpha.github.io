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
  code: string; id: string; host: boolean; peers: Map<string, Peer>; war: boolean;
  sendStart: (planet: string, war?: boolean) => void; sendPos: (x: number, y: number, face: number, hp: number) => void; sendHit: (i: number, v: number) => void; sendEv: (k: string, n: number) => void; sendChat: (t: string) => void;
  on: (h: Partial<Handlers>) => void; leave: () => void;
};
type Handlers = { onPeers: (list: Peer[]) => void; onStart: (planet: string, war?: boolean) => void; onHit: (i: number, v: number, from: string) => void; onEv: (p: Peer | undefined, k: string, n: number) => void; onChat: (p: Peer | undefined, t: string) => void; onLeave: () => void };

export const newPeerId = () => Math.random().toString(36).slice(2, 10);
export const MAX_PILOTS = 4;

export async function openAdvRoom(code: string | null, me: { name: string; model: string; glow: string }): Promise<Net> {
  const host = !code, room = host ? makeRoomCode() : String(code).trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(room)) throw new Error("bad code");
  const id = newPeerId(); const peers = new Map<string, Peer>(); let H: Partial<Handlers> = {};
  const mkCh = (typeof window !== "undefined" && (window as any).__advChannelFactory) || ((n: string, c: any) => sb.channel(n, c));   // tests swap in an in-browser channel; production always uses Supabase Realtime
  const ch = mkCh(`advo:${room}`, { config: { broadcast: { self: false }, presence: { key: id } } });
  const on = (event: string, fn: (p: any) => void) => ch.on("broadcast", { event }, ({ payload }: any) => fn(payload));
  on("start", (p) => { net.war = !!p.war; H.onStart && H.onStart(p.planet, !!p.war); });
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
    code: room, id, host, peers, war: false,
    sendStart: (planet, war) => { net.war = !!war; send("start", { planet, war: !!war }); }, sendPos: (x, y, face, hp) => send("pos", { x, y, face, hp }), sendHit: (i, v) => send("hit", { i, v }), sendEv: (k, n) => send("ev", { k, n }), sendChat: (t) => send("chat", { t }),
    on: (h) => { H = { ...H, ...h }; }, leave: () => { try { ch.send({ type: "broadcast", event: "leave", payload: { id } }); } catch (e) {} try { ch.unsubscribe(); } catch (e) {} },
  };
  return net;
}

/** Team war (plan 33 O3): teams are the pilots sorted by id, alternating, so every client works out the same split with no extra message. */
export const warTeamOf = (net: Net, id: string): number => { const ids = [net.id, ...net.peers.keys()].sort(); return Math.max(0, ids.indexOf(id)) % 2; };

/* Public room list (plan 33 O4; the SQL is supabase-adv-public-rooms-migration.sql, applied by the owner 2026-10-12).
   Only an advertisement: gameplay still runs on the advo:<CODE> channel. Every call fails soft, so a missing table or a signed-out player
   just means "no public list" and never breaks the lobby. */
export type PublicRoom = { code: string; host_name: string; map_id: string; war: boolean; pilots: number };
export async function listPublicRooms(): Promise<PublicRoom[]> {
  try { const { data, error } = await sb.rpc("adv_rooms_list"); if (error || !Array.isArray(data)) return []; return data.filter((r: any) => r && /^[A-Z0-9]{6}$/.test(r.code)).slice(0, 20); } catch (e) { return []; }
}
export async function publicRoomOpen(code: string, name: string, map: string, war: boolean): Promise<boolean> {
  try { const { error } = await sb.rpc("adv_room_open", { p_code: code, p_name: name, p_map: map, p_war: war }); return !error; } catch (e) { return false; }
}
export async function publicRoomPing(code: string, pilots: number, map: string, war: boolean): Promise<void> {
  try { await sb.rpc("adv_room_ping", { p_code: code, p_pilots: pilots, p_map: map, p_war: war }); } catch (e) {}
}
export async function publicRoomClose(code: string): Promise<void> {
  try { await sb.rpc("adv_room_close", { p_code: code }); } catch (e) {}
}

/* Best times per map (plan 33 O5, supabase-adv-ranking-migration.sql — WRITTEN, NOT APPLIED by the owner yet). Both calls fail soft: with the SQL not applied, signed out or
   offline, a submit does nothing and the list is empty. The server refuses a time under the map's floor and flooding, so a false time can at worst sit on a board. */
export async function submitAdvTime(map: string, secs: number, pilot: string): Promise<void> {
  try { if (!(secs >= 8)) return; await sb.rpc("adv_submit_time", { p_map: map, p_secs: Math.round(secs), p_pilot: String(pilot || "Pilot").slice(0, 14) }); } catch (e) {}
}
export async function listAdvTop(map: string, limit = 10): Promise<{ pilot: string; secs: number }[]> {
  try { const { data, error } = await sb.rpc("adv_top_times", { p_map: map, p_limit: limit }); if (error || !Array.isArray(data)) return []; return data.map((r: any) => ({ pilot: String(r.pilot || "").slice(0, 14), secs: Number(r.secs) || 0 })); } catch (e) { return []; }
}
