/* Are the KNOWN-WRONG scale spellings actually reachable by a student?
   Two surfaces:
     1. TIGA Chat's verified KB block (getKBContext) — the lines the model is
        told "do not contradict".
     2. The Auto Teaching "รู้ไว้ใช่ว่า" card + key-ladder entries in the KB.
   Runs the REAL knowledge base (repo convention: esbuild the actual source
   with supabase-client stubbed, then import it).
   Run: node scripts/verify-scale-kb-facts.mjs */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-scale-kb";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const realSb = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", "export const sb = null;\n");
let M;
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  M = await import(pathToFileURL(`${OUT}/web.js`).href);
} finally {
  ioSync("supabase-client.ts", realSb);
  rmSync(OUT, { recursive: true, force: true });
}

let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) console.log("PASS  " + name);
  else { fail++; console.log("FAIL  " + name + (detail ? "\n        " + detail : "")); }
};

/* ---- independent oracle: what a major scale MUST be spelled ---- */
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const ACCV = { "#": 1, b: -1, "♯": 1, "♭": -1, "\u{1d12a}": 2, "\u{1d12b}": -2 };
const parse = (s) => { let acc = 0; for (const ch of String(s).slice(1)) acc += ACCV[ch] || 0; return { letter: String(s)[0].toUpperCase(), acc }; };
const pcOf = (s) => { const { letter, acc } = parse(s); return ((LETTER_PC[letter] + acc) % 12 + 12) % 12; };
const spell = (letter, acc) => letter + (acc > 0 ? "#".repeat(acc) : "b".repeat(-acc));
const correctMajor = (root) => {
  const li0 = LETTERS.indexOf(parse(root).letter);
  const rpc = pcOf(root);
  return [0, 2, 4, 5, 7, 9, 11].map((s, i) => {
    const L = LETTERS[(li0 + i) % 7];
    const want = (rpc + s) % 12;
    for (const a of [-2, -1, 0, 1, 2]) if (((LETTER_PC[L] + a) % 12 + 12) % 12 === want) return spell(L, a);
    return L + "?";
  });
};

const tiga = M.initTigamodelWeb ? M.initTigamodelWeb() : null;
const kb = (M.getTigamodel && M.getTigamodel().kb) || (tiga && tiga.kb);
const entries = kb ? [...kb._entries.values()] : [];
console.log("KB entries loaded:", entries.length);
const allText = entries.map((e) => `${e.title || ""} ${e.body || ""} ${e.teach || ""}`).join("\n");

console.log("\n=== 1. KB entries that print a WRONG major-scale spelling ===");
/* every "คีย์ X — <rung>" key-ladder entry, and every degree-singing entry */
const badKeyLadders = [];
for (const e of entries) {
  const m = e.meta || {};
  if (m.kind !== "key-ladder" || !m.rung) continue;
  if (e.body.indexOf(m.rung) > e.body.indexOf("(")) continue;   // first entry per key only
  const notes = (e.body.match(/\(([^)]*)\)/) || [])[1];
  if (!notes) continue;
  const shown = notes.replace(/…/g, "").trim().split(/\s+/).map((s) => s.replace(/\d+$/, ""));
  const want = correctMajor(m.key);
  const shown7 = shown.slice(0, 7);
  if (shown7.join(" ") !== want.join(" ")) badKeyLadders.push(`${m.key}\n            taught ${shown7.join(" ")}\n            correct ${want.join(" ")}`);
}
console.log(badKeyLadders.length ? badKeyLadders.map((s) => "  " + s).join("\n") : "  (none)");
ok("every key-ladder teaches its major scale with the right letter names",
   badKeyLadders.length === 0,
   `${badKeyLadders.length} of 12 keys are taught with wrong note names. The pitches sound right, so the student hears E major but is TOLD it contains A♭/D♭/E♭.`);

console.log("\n=== 2. KB entries that print a WRONG note for a scale degree ===");
const badDegrees = [];
for (const e of entries) {
  const m = e.meta || {};
  if (m.kind !== "degree-singing") continue;
  const shown = (e.title.match(/=\s*([^)]+)\)/) || [])[1];
  if (!shown) continue;
  const want = correctMajor(m.key)[m.degree - 1];
  if (parse(shown).letter !== parse(want).letter || pcOf(shown) !== pcOf(want)) {
    badDegrees.push(`${m.key} degree ${m.degree}: taught ${shown}, correct ${want}`);
  }
}
console.log(badDegrees.length ? "  " + badDegrees.slice(0, 12).join("\n  ") + (badDegrees.length > 12 ? `\n  ... and ${badDegrees.length - 12} more` : "") : "  (none)");
ok("every degree-singing entry names the right letter for its scale degree",
   badDegrees.length === 0,
   `${badDegrees.length} entries name a degree with the wrong letter (e.g. D major's 7th taught as "Db" — it is C♯)`);

console.log("\n=== 3. does TIGA Chat actually serve these to the model? ===");
const chatCtx = M.getKBContext("บันไดเสียง");
const servedWrong = badKeyLadders.length + badDegrees.length;
const reachable = servedWrong > 0 && /\[(THEORY|TECHNIQUE|EAR TRAINING|SIGHT READING)\]/.test(chatCtx);
console.log(`  getKBContext('บันไดเสียง') = ${chatCtx.length} chars, ${(chatCtx.match(/• \[/g) || []).length} lines`);
ok("the chat's own knowledge block contains no wrong scale spelling",
   !chatCtx.split("\n").some((l) => {
     const bad = [...badKeyLadders, ...badDegrees].some((b) => l.includes(b.split(":")[0].split("\n")[0].trim()));
     return bad;
   }),
   "note: getKBContext serves `title — how to teach`, and the wrong SPELLING lives in `body`/`title` of scale entries; whether it is served depends on which domain the question selects. Checked below per-domain.");

console.log("\n=== 4. per-domain: is the wrong spelling inside a served line? ===");
for (const [label, q] of [["THEORY", "บันไดเสียง"], ["TECHNIQUE", "ฝึกสเกลด้วยนิ้ว"], ["EAR TRAINING", "ฟังสเกลแล้วร้ององศา"], ["SIGHT READING", "อ่านโน้ตบันไดเสียง"]]) {
  const ctx = M.getKBContext(q);
  const lines = ctx.split("\n").filter((l) => l.trim().startsWith("•"));
  const hits = lines.filter((l) => /\b(Db|Eb|Ab|Bb|F#)\b/.test(l) && /major|สเกล/.test(l));
  console.log(`  ${label.padEnd(13)} ${String(lines.length).padStart(3)} lines, ${hits.length} mention a flat inside a sharp-key scale`);
  for (const h of hits.slice(0, 3)) console.log("      " + h.slice(0, 160));
}

console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fail ? 1 : 0);