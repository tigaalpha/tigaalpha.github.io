/* ── chat-store.ts ──
   TIGA CHAT history: many conversations, sorted into categories, kept on the device first and
   synced to the account (table chat_threads, supabase-chat-history-migration.sql) when the learner
   is signed in. Local-first on purpose: guests get history too, nothing waits on the network, and
   while the table does not exist yet (the migration is the owner's to run) sync switches itself off
   and the app behaves exactly as a device-only history.

   Two kinds of key keep a streaming reply cheap: ONE small index (id, title, category, pinned, …)
   and one key per conversation for its messages, so a token arriving rewrites one conversation,
   never the whole archive. */
import { sb } from "./supabase-client";

const IDX = "tg_chat_idx", MSG = "tg_chat_t_", ACTIVE = "tg_chat_active", LEGACY = "tg_chat_history";
export const MAX_THREADS = 100, MAX_MSGS = 80, MAX_TEXT = 6000;
export const CATS = ["theory", "technique", "ear", "reading", "songs", "other"] as const;
export type Cat = typeof CATS[number];
export type Meta = { id: string; title: string; cat: Cat; pinned: boolean; lang: string; created: number; updated: number; n: number; last: string; locked?: boolean; deleted?: boolean };

const RX: [Cat, RegExp][] = [
  ["ear", /\bear\b|ear.?train|pitch|ฝึกหู|หู|听力|音准/i],
  ["reading", /sight|read(ing)? (music|notes)|staff|clef|อ่านโน้ต|อ่านเพลง|五线谱|视奏|读谱/i],
  ["theory", /scale|chord|\bkey\b|interval|theory|harmony|สเกล|คอร์ด|ทฤษฎี|บันไดเสียง|เมเจอร์|ไมเนอร์|音阶|和弦|乐理|大调|小调/i],
  ["technique", /finger|technique|posture|pedal|hand|นิ้ว|เทคนิค|ท่านั่ง|มือ|ฝึก|指法|技巧|手型/i],
  ["songs", /\bsong\b|\bpiece\b|\btune\b|เพลง|曲|歌/i],
];
/** The category of a conversation, from what the learner asked. No model call, no quota. */
export function categorize(text: string): Cat {
  const t = String(text || "");
  for (const [c, rx] of RX) if (rx.test(t)) return c;
  return "other";
}
export const CAT_ICON: Record<Cat, string> = { theory: "🎼", technique: "🖐", ear: "👂", reading: "📖", songs: "🎵", other: "💬" };
/** Small game layer: a category levels up with the questions asked in it (1 · 5 · 15 · 30 · 60). */
export function catLevel(askedInCat: number) {
  const steps = [0, 5, 15, 30, 60]; let lv = 1;
  for (let i = 1; i < steps.length; i++) if (askedInCat >= steps[i]) lv = i + 1;
  const lo = steps[lv - 1], hi = steps[lv] ?? null;
  return { lv, pct: hi == null ? 1 : (askedInCat - lo) / (hi - lo), into: askedInCat - lo, need: hi == null ? 0 : hi - lo };
}

const rd = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const wr = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
export const newId = () => (typeof crypto !== "undefined" && (crypto as any).randomUUID) ? (crypto as any).randomUUID()
  : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); });

export function listMeta(includeDeleted = false): Meta[] {
  const a = rd(IDX); const arr: Meta[] = Array.isArray(a) ? a : [];
  return arr.filter(m => m && m.id && (includeDeleted || !m.deleted)).sort((x, y) => (Number(y.pinned) - Number(x.pinned)) || (y.updated - x.updated));
}
const writeIdx = (arr: Meta[]) => {
  const live = arr.filter(m => !m.deleted).sort((a, b) => b.updated - a.updated).slice(0, MAX_THREADS);
  const dead = arr.filter(m => m.deleted).slice(0, 50);
  wr(IDX, live.concat(dead));
};
export const readMsgs = (id: string): any[] => { const m = rd(MSG + id); return Array.isArray(m) ? m : []; };
export const getActive = (): string | null => { try { return localStorage.getItem(ACTIVE) || null; } catch (e) { return null; } };
export const setActive = (id: string | null) => { try { id ? localStorage.setItem(ACTIVE, id) : localStorage.removeItem(ACTIVE); } catch (e) {} };

const clean = (msgs: any[]) => msgs.slice(-MAX_MSGS).map(m => ({ ...m, text: typeof m.text === "string" ? m.text.slice(0, MAX_TEXT) : m.text }));
const firstUser = (msgs: any[]) => (msgs.find(m => m && m.role === "user" && typeof m.text === "string") || {}).text || "";
const titleOf = (t: string) => { const s = String(t).replace(/\s+/g, " ").trim(); return s.length > 44 ? s.slice(0, 43) + "…" : s; };

/** Save a conversation's messages; creates or updates its index entry. Returns the meta. */
export function saveThread(id: string, lang: string, msgs: any[]): Meta | null {
  if (!id || !Array.isArray(msgs) || msgs.length <= 1) return null;
  const m = clean(msgs); wr(MSG + id, m);
  const idx = listMeta(true); const now = Date.now();
  const i = idx.findIndex(x => x.id === id);
  const users = m.filter(x => x.role === "user").map(x => x.text).slice(0, 3).join(" ");
  const last = String(m[m.length - 1] && m[m.length - 1].text || "").replace(/\s+/g, " ").slice(0, 90);
  const prev = i >= 0 ? idx[i] : null;
  const meta: Meta = { id, lang, created: prev ? prev.created : now, updated: now, n: m.length, last,
    title: prev && prev.title ? prev.title : (titleOf(firstUser(m)) || "…"), pinned: !!(prev && prev.pinned),
    cat: prev && prev.locked ? prev.cat : categorize(users), locked: !!(prev && prev.locked) };
  if (i >= 0) idx[i] = meta; else idx.unshift(meta);
  writeIdx(idx); return meta;
}
function patch(id: string, f: Partial<Meta>) {
  const idx = listMeta(true); const i = idx.findIndex(x => x.id === id); if (i < 0) return null;
  idx[i] = { ...idx[i], ...f, updated: Date.now() }; writeIdx(idx); return idx[i];
}
export const renameThread = (id: string, title: string) => patch(id, { title: titleOf(title) || "…" });
export const pinThread = (id: string, pinned: boolean) => patch(id, { pinned });
export const setThreadCat = (id: string, cat: Cat) => patch(id, { cat, locked: true });
export function deleteThread(id: string) { try { localStorage.removeItem(MSG + id); } catch (e) {} if (getActive() === id) setActive(null); return patch(id, { deleted: true, n: 0, last: "" }); }

/** The one-thread history from before this existed becomes the first conversation. Once. */
export function migrateLegacy(): string | null {
  const raw = rd(LEGACY);
  if (!raw || !Array.isArray(raw.msgs) || raw.msgs.length <= 1) { try { localStorage.removeItem(LEGACY); } catch (e) {} return null; }
  const id = newId(); saveThread(id, raw.lang || "en", raw.msgs);
  try { localStorage.removeItem(LEGACY); } catch (e) {}
  return id;
}

/* ── the knowledge log ──
   Every "I understood" the learner taps on a tutor check is counted under the category of the
   conversation it happened in. Device-only, a plain tally: it feeds the category levels and the
   summary line, and nothing else (no EXP, no coins). */
const KNOW = "tg_chat_know";
export const readKnow = (): Record<string, number> => { const k = rd(KNOW); return k && typeof k === "object" ? k : {}; };
export function addUnderstood(threadId: string | null) {
  if (!threadId) return null;
  const m = listMeta(true).find(x => x.id === threadId); const cat: Cat = m ? m.cat : "other";
  const k = readKnow(); k[cat] = (k[cat] || 0) + 1; wr(KNOW, k); return cat;
}
/** What a category's level counts: the questions asked in it, plus two for every "understood". */
export function catPoints(threads: Meta[], know: Record<string, number>) {
  const out: Record<string, number> = {}; for (const c of CATS) out[c] = 2 * (know[c] || 0);
  for (const t of threads) out[t.cat] = (out[t.cat] || 0) + Math.max(0, Math.floor((t.n - 1) / 2));
  return out;
}

/* ── account sync ── */
let syncOff = false;
const missing = (e: any) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /chat_threads/.test(String(e.message || "")) && /does not exist|not find|schema cache/i.test(String(e.message || "")));
async function uid(): Promise<string | null> { try { const { data } = await sb.auth.getSession(); return (data && data.session && data.session.user && data.session.user.id) || null; } catch (e) { return null; } }

export async function pushThread(id: string): Promise<boolean> {
  if (syncOff) return false;
  const u = await uid(); if (!u) return false;
  const m = listMeta(true).find(x => x.id === id); if (!m) return false;
  const row = { id: m.id, user_id: u, title: m.title, category: m.cat, pinned: !!m.pinned, lang: m.lang || "en", deleted: !!m.deleted,
    msgs: m.deleted ? [] : readMsgs(id), created_at: new Date(m.created).toISOString(), updated_at: new Date(m.updated).toISOString() };
  try { const { error } = await sb.from("chat_threads").upsert(row, { onConflict: "id" }); if (error) { if (missing(error)) syncOff = true; return false; } return true; }
  catch (e) { return false; }
}

/** Pull the account's conversations and merge them in (newer wins, a tombstone wins when newer). Returns true if anything changed. */
export async function pullThreads(): Promise<boolean> {
  if (syncOff) return false;
  const u = await uid(); if (!u) return false;
  let rows: any[] = [];
  try {
    const { data, error } = await sb.from("chat_threads").select("id,title,category,pinned,lang,msgs,deleted,created_at,updated_at").order("updated_at", { ascending: false }).limit(MAX_THREADS);
    if (error) { if (missing(error)) syncOff = true; return false; }
    rows = data || [];
  } catch (e) { return false; }
  const idx = listMeta(true); let changed = false;
  for (const r of rows) {
    const upd = Date.parse(r.updated_at) || 0; const i = idx.findIndex(x => x.id === r.id);
    if (i >= 0 && idx[i].updated >= upd) continue;
    changed = true;
    if (r.deleted) { try { localStorage.removeItem(MSG + r.id); } catch (e) {} const dm = { ...(i >= 0 ? idx[i] : { id: r.id, title: "", cat: "other" as Cat, pinned: false, lang: "en", created: upd, n: 0, last: "" }), deleted: true, updated: upd }; i >= 0 ? idx[i] = dm : idx.push(dm); continue; }
    const msgs = Array.isArray(r.msgs) ? r.msgs : []; wr(MSG + r.id, msgs);
    const meta: Meta = { id: r.id, title: r.title || "…", cat: (CATS as readonly string[]).includes(r.category) ? r.category : "other", pinned: !!r.pinned, lang: r.lang || "en",
      created: Date.parse(r.created_at) || upd, updated: upd, n: msgs.length, last: String(msgs.length ? (msgs[msgs.length - 1].text || "") : "").replace(/\s+/g, " ").slice(0, 90), locked: true };
    i >= 0 ? idx[i] = meta : idx.push(meta);
  }
  if (changed) writeIdx(idx);
  // push up what only this device has
  const remote = new Set(rows.map(r => r.id));
  for (const m of idx) if (!remote.has(m.id)) await pushThread(m.id);
  return changed;
}
