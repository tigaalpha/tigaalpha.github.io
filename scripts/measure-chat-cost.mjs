#!/usr/bin/env node
/* measure-chat-cost.mjs — how big is a TIGA CHAT question really, and what does it cost?
   Everything in plan 19's cost section comes from here, run against the REAL
   tigamodel/web.js knowledge base (esbuild-bundled with Supabase stubbed), not
   from estimates. Re-run it after any change to the KB, the persona, the
   reference blocks or the context builders:

     node scripts/measure-chat-cost.mjs
     node scripts/measure-chat-cost.mjs --json          machine-readable
     node scripts/measure-chat-cost.mjs --question "minor chord คืออะไร"

   WHY this exists: a chat question costs (prompt tokens x price), and the
   prompt is built once per question from the persona + two reference blocks +
   the KB slice + the learner's own blocks. The KB slice is chosen by keyword
   matching, so its size for a given question is a property of the KB, not of
   the model — which makes it measurable here, offline, for free.

   THE NUMBER THAT MATTERS: with the knowledge-block switch OFF (how it ships)
   the median question carries ~41 KB of KB text and the worst carries ~1.4 MB
   — the whole corpus, because a common word matched everything. The switch's
   hot path caps that at 8,000 chars. This script is what decides whether
   turning it on changes answer quality (judge answers in Model Lab with the
   switch off and on); it is not a substitute for that judgement.

   Note: this measures PROMPT SIZE, not dollars. Price per token, and how many
   tokens the model actually bills, come from the provider's own usage. */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const qIdx = args.indexOf("--question");
const only = qIdx >= 0 ? args[qIdx + 1] : null;

// ── Supabase is stubbed: the KB is static data, and we ask for no rows ──
const STUBS = {
  "./supabase-client": `export const sb = {
    from: () => ({ select: () => ({ eq: () => ({ then: (f) => Promise.resolve(f({ data: null, error: null })) }),
      maybeSingle: () => Promise.resolve({ data: null }),
      limit: () => ({ then: (f) => Promise.resolve(f({ data: null, error: null })) }),
      single: () => Promise.resolve({ data: null, error: null }) }),
    rpc: () => Promise.resolve({ data: null, error: null }),
  };`,
  "@supabase/supabase-js": `export const createClient = () => ({ auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } });`,
};

const r = await build({
  entryPoints: [path.join(ROOT, "tigamodel/web.js")],
  bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent",
  outdir: path.join(ROOT, "node_modules/.cache"),
  plugins: [{
    name: "stub-supabase",
    setup(b) {
      b.onResolve({ filter: /^\.\.?\/supabase-client$|^@supabase\/supabase-js$/ },
        (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" },
        (a) => ({ contents: STUBS[a.path] || "export const sb={};", loader: "js" }));
    },
  }],
});
const out = path.join(ROOT, "node_modules/.cache", `chat-cost-${process.pid}.mjs`);
fs.writeFileSync(out, r.outputFiles[0].text);

// ── a browser-shaped localStorage, because the KB reads it at init ──
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
globalThis.window = { localStorage: globalThis.localStorage };
globalThis.indexedDB = undefined;

/* A learner with a real history. Without this the student/coach blocks are
   empty and the fixed part looks smaller than it ever is for a returning
   learner — the number that matters, since a new learner is a one-day state. */
store["tg_memory"] = JSON.stringify({
  struggles: [{ label: "minor scales", acc: 60, last: Date.now(), count: 2, interval: 2 },
              { label: "chords", acc: 71, last: Date.now(), count: 1, interval: 1 }],
  mastered: ["C major scale"],
  recent: [{ label: "Für Elise", acc: 72, t: "2026-10-01" }],
  lastSession: Date.now() - 3 * 86400000, sessions: 12,
});

const web = await import(pathToFileURL(out).href);

// The 20 questions below are the ones a beginner actually types, in the mix
// the app sees (theory, songs, practice, history, general). Fix the list and
// you fix the report — that is deliberate, so the number means "this app's
// real traffic", not "the worst case I could think of".
const QUESTIONS = [
  "major scale คืออะไร", "minor chord ต่างจาก major ยังไง", "อะไรคือ inversion",
  "ฉันเพิ่งเริ่มเรียนเปียโน", "เรียน piano ยังไง", "ทำไมเปียโนสำคัญ",
  "ช่วยแนะนำเพลงง่ายๆ หน่อย", "อยากเล่นคลาสสิก", "เล่นเพลงไทยด้วยเปียโน",
  "แนะนำนักแต่งเพลงคลาสสิก", "ประวัติคีย์ประสาน", "ดนตรีบางอย่างคืออะไร",
  "วิธีซ้อมดริลลมือ", "ฝึก ear training ยังไง", "ฉันจับจังหวะไม่ได้",
  "อย่างไรอ่านโน้ตสองชั้น", "ต่าง chord กับ triad", "โมดเสียงต่างกันยังไง",
  "ผมเล่นช้าไม่ได้", "hand position คืออะไร",
];

const HOT_CAP = 8000;   // kb-hot-path.js maxChars — the switch's own ceiling

// The fixed part of the prompt (persona + FINGERING_REF + THEORY_REF +
// studentBlock + coachBlock + curriculumContext + memoryContext) never
// depends on the question, so it is measured once and added to every row.
function fixedPromptChars() {
  const i18n = fs.readFileSync(path.join(ROOT, "i18n.ts"), "utf8");
  const sys = (i18n.match(/\n {4}sys: "([\s\S]*?)(?=\n {4}err:)/) || [, ""])[1].length;
  const music = fs.readFileSync(path.join(ROOT, "music-engine.tsx"), "utf8");
  const ref = (name) => {
    const i = music.indexOf(`export const ${name} =`);
    const j = music.indexOf("export const", i + 10);
    let n = 0;
    for (const m of (music.slice(i, j).match(/"((?:[^"\\]|\\.)*)"/g) || [])) n += m.length - 2;
    return n;
  };
  const student = web.getStudentContextBlock().length;
  const coach = web.getCoachContextBlock().length;
  return { sys, fingering: ref("FINGERING_REF"), theory: ref("THEORY_REF"), student, coach };
}

const fixed = fixedPromptChars();
const fixedTotal = fixed.sys + fixed.fingering + fixed.theory + fixed.student + fixed.coach;

// corpus size = the ceiling a KB slice could ever approach
let corpus = 0, entries = 0;
try {
  const hub = web.initTigamodelWeb && web.initTigamodelWeb();
  if (hub && hub.kb && hub.kb._entries) {
    for (const [, v] of hub.kb._entries) {
      corpus += String((v && (v.text || v.body || v.content)) || JSON.stringify(v)).length;
      entries++;
    }
  }
} catch (e) { /* corpus is a nicety; the slices are the measurement */ }

const list = only ? [only] : QUESTIONS;
const rows = list.map((q) => {
  const kb = web.getKBContext(q).length;
  const shipped = fixedTotal + kb;             // switch OFF = how it ships today
  const hot = fixedTotal + Math.min(kb, HOT_CAP); // switch ON = capped
  return { q, kb, shipped, hot, saved: shipped - hot };
});
const sizes = rows.map((r) => r.shipped).sort((a, b) => a - b);
const med = sizes[Math.floor(sizes.length / 2)];
const worst = rows.reduce((a, b) => (b.shipped > a.shipped ? b : a), rows[0]);
const best = rows.reduce((a, b) => (b.shipped < a.shipped ? b : a), rows[0]);

if (jsonOut) {
  console.log(JSON.stringify({ fixed, fixedTotal, entries, corpus, hotCap: HOT_CAP, median: med, best, worst, rows }, null, 2));
} else {
  console.log("\n# fixed part of every prompt (does not depend on the question)");
  console.log(`  persona(sys) ${String(fixed.sys).padStart(6)} · FINGERING_REF ${String(fixed.fingering).padStart(5)} · THEORY_REF ${String(fixed.theory).padStart(5)} · student ${String(fixed.student).padStart(4)} · coach ${String(fixed.coach).padStart(4)}  = ${fixedTotal} chars`);
  if (entries) console.log(`# KB corpus: ${entries} entries, ${corpus.toLocaleString()} chars total`);
  console.log(`\n# per question — KB slice | whole prompt as shipped (switch OFF) | with the hot path ON (cap ${HOT_CAP})\n`);
  for (const r of rows) {
    const pct = r.shipped ? ((r.saved / r.shipped) * 100).toFixed(0) : "0";
    console.log(`  ${String(r.kb).padStart(9)} ${String(r.shipped).padStart(9)} ${String(r.hot).padStart(8)}   ${pct.padStart(3)}% saved  ${r.q}`);
  }
  console.log(`\n  median prompt as shipped : ${med.toLocaleString()} chars`);
  console.log(`  best  (${best.q}) : ${best.shipped.toLocaleString()}`);
  console.log(`  worst (${worst.q}) : ${worst.shipped.toLocaleString()} chars — ${(worst.shipped / Math.max(1, med)).toFixed(1)}x the median`);
  console.log(`\n  Median saving from the hot-path cap: ${(((med - (fixedTotal + HOT_CAP)) / med) * 100).toFixed(1)}%`);
  console.log(`  Worst-case saving: ${(((worst.shipped - (fixedTotal + HOT_CAP)) / worst.shipped) * 100).toFixed(1)}%\n`);
  console.log("  This is prompt SIZE. Whether the shorter prompt still answers well is judged in Model Lab");
  console.log("  with the switch off and on (tigamodel/scripts/eval-kb-capped-vs-legacy.mjs measures what");
  console.log("  the model is given). The switch is flipped by the owner, never from code.\n");
}

fs.rmSync(out, { force: true });