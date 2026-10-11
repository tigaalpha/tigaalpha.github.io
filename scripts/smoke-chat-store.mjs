// chat-store.ts with the real source: categories, levels, saving, pin/move/delete, legacy migration, sync merge.
import { build } from "esbuild"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cs-")), "m.mjs");
const stub = { name: "stub", setup(b) { b.onResolve({ filter: /supabase-client$/ }, () => ({ path: "sb", namespace: "stub" })); b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const sb = globalThis.__sb;", loader: "js" })); } };
await build({ entryPoints: ["chat-store.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent", plugins: [stub] });
const store = {}; globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
let remote = [], uidv = "u1", missingTable = false, upserts = [];
globalThis.__sb = {
  auth: { getSession: async () => ({ data: { session: uidv ? { user: { id: uidv } } : null } }) },
  from: () => ({ upsert: async (row) => { if (missingTable) return { error: { code: "42P01", message: 'relation "chat_threads" does not exist' } }; upserts.push(row); return { error: null }; },
    select: () => ({ order: () => ({ limit: async () => (missingTable ? { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.chat_threads' in the schema cache" } } : { data: remote, error: null }) }) }) }),
};
const m = await import(out); let fail = 0;
const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
ok("category: theory", m.categorize("What is a C major scale?") === "theory");
ok("category: ear (th)", m.categorize("ฝึกหูยังไง") === "ear");
ok("category: reading", m.categorize("how do I improve sight reading") === "reading");
ok("category: technique (zh)", m.categorize("手指的指法怎么练") === "technique");
ok("category: songs", m.categorize("recommend a song for me") === "songs");
ok("category: other", m.categorize("hello there") === "other");
ok("level 1 at 0", m.catLevel(0).lv === 1); ok("level 2 at 5", m.catLevel(5).lv === 2); ok("max level has pct 1", m.catLevel(500).pct === 1);
const welcome = { role: "ai", text: "hi" };
ok("welcome-only is not saved", m.saveThread("a", "en", [welcome]) === null && m.listMeta().length === 0);
const id1 = m.newId(); const meta = m.saveThread(id1, "en", [welcome, { role: "user", text: "What is a C major scale?" }, { role: "ai", text: "C D E F G A B." }]);
ok("saved, titled from the first question", meta && meta.title.startsWith("What is a C major") && meta.cat === "theory" && meta.n === 3);
ok("messages come back", m.readMsgs(id1).length === 3);
const id2 = m.newId(); m.saveThread(id2, "en", [welcome, { role: "user", text: "sight reading tips" }]);
ok("listed newest first", m.listMeta()[0].id === id2);
m.pinThread(id1, true); ok("pinned goes first", m.listMeta()[0].id === id1);
m.setThreadCat(id2, "songs"); m.saveThread(id2, "en", [welcome, { role: "user", text: "sight reading tips" }, { role: "ai", text: "x" }]);
ok("a moved category stays moved", m.listMeta().find(x => x.id === id2).cat === "songs");
m.deleteThread(id1); ok("deleted: gone from the list and the messages removed", m.listMeta().length === 1 && m.readMsgs(id1).length === 0);
ok("a tombstone is kept for sync", m.listMeta(true).some(x => x.id === id1 && x.deleted));
store["tg_chat_history"] = JSON.stringify({ lang: "th", msgs: [welcome, { role: "user", text: "ทฤษฎีดนตรี" }] });
const mid = m.migrateLegacy(); ok("legacy history becomes a conversation", !!mid && m.readMsgs(mid).length === 2 && !("tg_chat_history" in store));
ok("migration runs once", m.migrateLegacy() === null);
for (let i = 0; i < 110; i++) m.saveThread(m.newId(), "en", [welcome, { role: "user", text: "q" + i }]);
ok("capped at 100 live conversations", m.listMeta().length <= 100);
const big = Array.from({ length: 200 }, (_, i) => ({ role: i % 2 ? "ai" : "user", text: "x".repeat(8000) }));
const idb = m.newId(); m.saveThread(idb, "en", big); const back = m.readMsgs(idb);
ok("long thread is capped in length and size", back.length === m.MAX_MSGS && back[0].text.length === m.MAX_TEXT);
// knowledge log
const kid = m.newId(); m.saveThread(kid, "en", [welcome, { role: "user", text: "chord question" }, { role: "ai", text: "a" }, { role: "user", text: "more chords" }, { role: "ai", text: "b" }]);
ok("understood is counted under the conversation's category", m.addUnderstood(kid) === "theory" && m.readKnow().theory === 1);
ok("no thread, no count", m.addUnderstood(null) === null && m.readKnow().theory === 1);
const pts = m.catPoints(m.listMeta(), m.readKnow());
ok("points = questions asked + 2 per understood", pts.theory >= 2 * 1 + 2 && typeof pts.ear === "number", JSON.stringify(pts));
// sync
await m.pushThread(idb); ok("push sends a row owned by the user", upserts.length === 1 && upserts[0].user_id === "u1" && upserts[0].id === idb && upserts[0].category);
uidv = null; upserts = []; await m.pushThread(idb); ok("signed out: nothing is sent", upserts.length === 0);
uidv = "u1"; const t0 = Date.now() + 100000;
remote = [{ id: "r1", title: "from phone", category: "ear", pinned: true, lang: "en", msgs: [welcome, { role: "user", text: "ear q" }], deleted: false, created_at: new Date(t0).toISOString(), updated_at: new Date(t0).toISOString() }];
const ch = await m.pullThreads(); ok("pull brings a thread from another device", ch && m.listMeta().some(x => x.id === "r1" && x.cat === "ear") && m.readMsgs("r1").length === 2);
remote = [{ ...remote[0], deleted: true, updated_at: new Date(t0 + 5000).toISOString() }];
await m.pullThreads(); ok("a newer remote delete removes it here", !m.listMeta().some(x => x.id === "r1"));
missingTable = true; ok("a missing table switches sync off quietly", (await m.pullThreads()) === false);
upserts = []; missingTable = false; ok("and stays off for the session", (await m.pushThread(idb)) === false && upserts.length === 0);
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
