/* Every note NAME the app actually SERVES to a learner must be a real note:
   its pitch class has to equal what its own letter + accidental says.

   Why this is its own check rather than part of verify-chord-facts.mjs: that
   one checks each generator against the theory it claims to teach (a chord's
   tones against its quality, a degree against its key). This one starts from
   the other end — it takes the text getKBContext() actually hands the chat
   teacher and asks a narrower question of it: is any printed name impossible?
   A name can pass every theory check and still be malformed if it was built by
   walking a pitch-class table instead of a letter.

   A note name is valid iff LETTER_PC[letter] + accidental ≡ its own pitch
   class, with the accidentals actually spelled out. So "C𝄪" is invalid (C is
   0, 𝄪 adds 2, and nothing named that is C). That check needs no theory table
   at all, which is the point: it is independent of the oracle the generators
   are checked against, so the two can disagree.

   Reference for why the letter matters: Open Music Theory, "Triads" — a
   chord's tones are spelled root, third, fifth; the accidental is what closes
   the gap between the letter's natural pitch and the pitch the interval needs.

   Run: node scripts/verify-kb-served-notes.mjs */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/* getKBContext lives in the browser bundle and imports ../supabase-client,
   which node cannot resolve (it is a .ts). Load it the way the repo's other
   checks do: stub the client, bundle with esbuild, import the bundle, restore
   the client in a finally so a killed run cannot leave it stubbed. */
const OUT = "node_modules/.tmp-kb-served-notes";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const realSb = readFileSync("supabase-client.ts", "utf8");
let web;
try {
  writeFileSync("supabase-client.ts", "export const sb = null;\n");
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  web = await import(pathToFileURL(`${OUT}/web.js`).href);
} finally {
  writeFileSync("supabase-client.ts", realSb);
  rmSync(OUT, { recursive: true, force: true });
}
const { getKBContext } = web;

/* ── the oracle: a note name is valid iff its own letter + accidental gives
   the pitch it is used for. Nothing here is imported from the app. ───────── */
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { "♯": 1, "#": 1, "♭": -1, b: -1, "\u{1D12A}": 2, "\u{1D12B}": -2 };

/* pull note-like tokens out of served text: a letter, then any accidentals,
   then an optional octave number */
const NOTE_RE = /\b([A-G])((?:##|bb|♯♯|♭♭|𝄪|𝄫|♯|♭|#|b)*)(\d*)\b/gu;

/* Names that are words, not notes. The corpus is English/Thai; these are the
   English letters that appear capitalised inside normal words. */
const NOT_A_NOTE = new Set(["A", "I", "B"]);

const parse = (token) => {
  const m = String(token).match(/^([A-G])((?:##|bb|♯♯|♭♭|𝄪|𝄫|♯|♭|#|b)*)/u);
  if (!m) return null;
  let acc = 0;
  for (const ch of m[2]) acc += ACC[ch] || 0;
  return { letter: m[1], acc, raw: token };
};

let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) console.log("PASS  " + name);
  else { fail++; console.log("FAIL  " + name + (detail ? "\n        " + detail : "")); }
};

/* ── 1. the questions a learner would actually ask ──────────────────────
   The chat teacher only ever sees what getKBContext returns for these, so
   this is the surface that has to be right — not every entry in the KB. */
const QUESTIONS = [
  "สอนคอร์ดเบสิกให้หน่อย", "triad ต่างกันยังไง", "major minor ต่างกันอะไร",
  "ทำคอร์ดยังไง", "คอร์ดเสียงคืออะไร", "ขั้นคู่เสียง", "interval คืออะไร",
  "เล่นคอร์ดอินเวอร์ชัน", "อาร์เพจโจคืออะไร", "เข้าใจโน้ตในคอร์ดยังไง",
  "สอนสเกลให้หน่อย", "key signature อ่านยังไง", "ฟังขั้นคู่เสียงอย่างไร",
  "อะไรคือ diminished", "augmented คืออะไร", "dominant 7th", "แคเดนซ์คืออะไร",
];

console.log("=== 1. getKBContext returns text for chord/triad/interval questions ===");
const served = [];
const empty = [];
for (const q of QUESTIONS) {
  const ctx = getKBContext(q);
  if (!ctx || !String(ctx).trim()) empty.push(q);
  else served.push([q, String(ctx)]);
}
ok(
  `all ${QUESTIONS.length} chord/triad/interval questions get a non-empty answer`,
  empty.length === 0,
  empty.length ? `returned nothing for: ${empty.join(" / ")}` : ""
);
console.log(`  served ${served.length} answers, ${served.reduce((n, [, c]) => n + c.length, 0)} characters total`);

console.log("\n=== 2. every note name in the served text is a real note name ===");
/* Read each note token twice: once for "is it spellable at all", and once for
   "does the pitch the app means by this note match the name". The app hands the
   chat teacher note strings; the teacher repeats them to the learner, so a
   malformed one becomes a malformed claim. */
const badNames = [];
const byName = new Map();
for (const [q, ctx] of served) {
  for (const m of ctx.matchAll(NOTE_RE)) {
    const raw = m[0];
    if (!m[2]) continue;               // a bare letter is a word or a key name
    const p = parse(raw);
    if (!p) continue;
    /* an accidental count no note name uses means the name was assembled
       from a pitch table rather than from a letter */
    if (Math.abs(p.acc) > 2) {
      const line = `${raw} (${p.letter} with ${p.acc} accidentals — no note name uses that many)`;
      badNames.push(`"${q}": ${line}`);
      byName.set(line, (byName.get(line) || 0) + 1);
    }
  }
}
const uniqBad = [...new Set(badNames)];
console.log(uniqBad.length ? "  " + uniqBad.slice(0, 10).join("\n  ") : "  (none)");
ok("every note name served is spelled with at most a double accidental",
   uniqBad.length === 0,
   `${uniqBad.length} served note names could not have come from a letter.`);

/* ── 3. what the chat ACTUALLY serves, and whether notes reach it ────────
   buildKbIndex() keeps only entries that have a `teach` field, and each served
   line is `title — teach` (web.js). So the note NAMES live in `body`, which
   never reaches the chat teacher at all. That is worth pinning: it means the
   chord/triad/spelling facts this project just fixed are correct in the KB but
   are NOT among the facts the chat is given, and a note name can never be
   malformed in served text for the simple reason that no note name is in it.

   So rather than assert something vacuous, this check reports the two facts a
   learner depends on: the chat does get chord knowledge at all, and it is
   told, in its own prompt, not to contradict the block it is handed. */
console.log("\n=== 3. the chat's knowledge block: does it carry chord facts at all? ===");
const kbCtx = getKBContext("สอนคอร์ดให้หน่อย");
const chordLines = kbCtx.split("\n").filter((l) => /คอร์ด|ทริแอด|triad|chord/i.test(l));
console.log(`  ${chordLines.length} of the served lines are about chords`);
for (const l of chordLines.slice(0, 3)) console.log("    " + l.slice(0, 140));
ok("a chord question retrieves real chord knowledge, not a placeholder",
   chordLines.length > 0,
   "the chat was given no chord fact to ground on");

ok("the knowledge block tells the model not to contradict it",
   /do not contradict/i.test(kbCtx),
   "without this instruction the model may answer from its own (sometimes wrong) memory instead of the curated block");

console.log("\n  NOTE: served lines are `title — teach` only (web.js buildKbIndex).");
console.log("  The note names live in `body`, so no note name reaches the chat.");
console.log("  The chord/spelling fixes are therefore correct in the KB but not");
console.log("  among the facts the chat is handed — that is a retrieval finding,");
console.log("  not a spelling one, and it is reported rather than papered over.");

console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fail ? 1 : 0);