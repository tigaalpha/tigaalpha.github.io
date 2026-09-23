import { sb } from "./supabase-client";

/* ── pvp-online.ts — Online PvP for Play Along (plan #10) ──
   Realtime rooms over the EXISTING sb client's realtime channels — zero
   schema/RPC/edge-function changes (repo hard rule). Architecture:

   • A room is a Supabase Realtime **broadcast channel** named `pvp:<CODE>`,
     CODE = 6-char read-aloud-safe code the host generates. Anyone with the
     code joins; presence lists both players.
   • Both players pick the SAME built-in song (identified by SONGS id — every
     client already has every song locally, nothing to ship), then the host
     fires a synchronized start (startAt = wall-clock + ~4s) and each side
     plays their own local game.
   • During the race each side broadcasts its live score/combo every second;
     on finish each broadcasts its final result. First to finish sees
     "waiting"; when both results are in, the win/lose banner renders.
   • Trust model: scores are self-reported — deliberately the SAME trust
     level as the existing ?challenge= friend links (also self-reported).
     This is a friendly practice duel, not an esports ladder; no server
     authority was added for it on purpose.
   • Messages (channel.send broadcast events):
       join-request guest→host {name} · accept host→guest {ok,name} ·
       start host→all {songId,startAt} · score both {score,combo,acc} ·
       result both {score,acc,stars} · rematch both · leave both ── */

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/1/O/0 — read-aloud safe

export function makeRoomCode() {
  let c = "";
  for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

const active = { channel: null, code: null, role: null };

export function currentOnlineRoom() { return active.code ? { code: active.code, role: active.role } : null; }

export function leaveOnlineRoom() {
  if (active.channel) {
    try { active.channel.send({ type: "broadcast", event: "leave", payload: { t: Date.now() } }); } catch (e) {}
    try { active.channel.unsubscribe(); } catch (e) {}
  }
  active.channel = null; active.code = null; active.role = null;
}
try { window.addEventListener("pagehide", () => leaveOnlineRoom()); } catch (e) {}

function wire(channel, handlers) {
  const on = (event, fn) => channel.on("broadcast", { event }, ({ payload }) => fn && fn(payload));
  on("join-request", handlers.onJoinRequest);
  on("accept", handlers.onAccept);
  on("start", handlers.onStart);
  on("score", handlers.onScore);
  on("result", handlers.onResult);
  on("rematch", handlers.onRematch);
  on("leave", handlers.onLeave);
  channel.on("presence", { event: "sync" }, () => {
    try {
      const state = channel.presenceState();
      const ids = Object.keys(state || {});
      handlers.onPresence && handlers.onPresence({ count: ids.length, who: ids.map(k => (state[k] && state[k][0] && state[k][0].name) || k) });
    } catch (e) {}
  });
}

/* Host a room: creates the channel, tracks presence, waits for a challenger. */
export async function hostOnlineDuel(name, handlers) {
  leaveOnlineRoom();
  const code = makeRoomCode();
  const channel = sb.channel(`pvp:${code}`, { config: { broadcast: { self: false }, presence: { key: "host" } } });
  wire(channel, handlers);
  active.channel = channel; active.code = code; active.role = "host";
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      try { await channel.track({ name: name || "Host", role: "host" }); } catch (e) {}
      handlers.onReady && handlers.onReady({ code, role: "host" });
    }
  });
  return { code, channel };
}

/* Join a room by its 6-char code. */
export async function joinOnlineDuel(code, name, handlers) {
  leaveOnlineRoom();
  const clean = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(clean)) throw new Error("bad code");
  const channel = sb.channel(`pvp:${clean}`, { config: { broadcast: { self: false }, presence: { key: "guest" } } });
  wire(channel, handlers);
  active.channel = channel; active.code = clean; active.role = "guest";
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      try { await channel.track({ name: name || "Challenger", role: "guest" }); } catch (e) {}
      await channel.send({ type: "broadcast", event: "join-request", payload: { name: name || "Challenger" } });
      handlers.onReady && handlers.onReady({ code: clean, role: "guest" });
    }
  });
  return { code: clean, channel };
}

/* Senders — all no-op when no room is active. */
const send = (event, payload) => {
  if (!active.channel) return;
  try { active.channel.send({ type: "broadcast", event, payload }); } catch (e) {}
};
export const sendAccept = (ok, name) => send("accept", { ok, name });
export const sendStart = (songId, startAt) => send("start", { songId, startAt });
export const sendScore = (score, combo, acc) => send("score", { score, combo, acc });
export const sendResult = (score, acc, stars) => send("result", { score, acc, stars });
export const sendRematch = () => send("rematch", { t: Date.now() });
