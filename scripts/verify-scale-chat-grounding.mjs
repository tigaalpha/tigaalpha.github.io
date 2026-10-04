/* Does a Scale question actually reach TIGA Chat's Scale knowledge?
   Runs the REAL getKBContext / kbKeywordHit from tigamodel/web.js (repo
   convention: esbuild the actual source, supabase-client stubbed, import it).
   Run: node scripts/verify-scale-chat-grounding.mjs */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-scale-grounding";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
/* sb=null is the switch-OFF case getKBContext already handles; the switch only
   gates ranking/caps, never WHICH facts are served. */
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
const { getKBContext, kbKeywordHit, KB_PROMPT_CHAR_CAP } = M;

let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) console.log("PASS  " + name);
  else { fail++; console.log("FAIL  " + name + (detail ? "\n        " + detail : "")); }
};

/* The words a Thai student actually types for a scale — read out of the real
   source rather than transcribed here, so this check cannot drift from the app
   (it already did once: it hardcoded the old list and "passed" a broken table). */
const webSrc = readFileSync(new URL("../tigamodel/web.js", import.meta.url), "utf8");
const theoryLine = webSrc.match(/^\s*theory:\s*\[([^\]]+)\]/m)[1];
const THEORY_KEYWORDS = [...theoryLine.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const THAI_SCALE = "สเกล";

console.log("=== 1. does the word Thai students type reach the THEORY domain? ===");
ok(`"${THAI_SCALE}" is a THEORY keyword in the retrieval table`,
   THEORY_KEYWORDS.includes(THAI_SCALE),
   `the table has ${JSON.stringify(THEORY_KEYWORDS)} — "บันไดเสียง" is there but "${THAI_SCALE}" (the word a student actually types) is NOT`);
ok(`kbKeywordHit confirms the miss: hit("${THAI_SCALE}", theory keywords)`,
   THEORY_KEYWORDS.some((k) => kbKeywordHit(THAI_SCALE, k)));

console.log("\n=== 2. so what does a scale question actually retrieve? ===");
const QS = [
  "สอนสเกลให้หน่อย",
  "สเกล C major มีโน้ตอะไรบ้าง",
  "อยากรู้ว่า minor scale ต่างจาก major ยังไง",
  "ช่วยสอนเรื่องสเกล",
  "บันไดเสียงคืออะไร",
];
const labelsIn = (ctx) => [...new Set((ctx.match(/• \[[^\]]+\]/g) || []).map((s) => s.slice(3, -1)))];
for (const q of QS) {
  const ctx = getKBContext(q);
  const labels = labelsIn(ctx);
  const hasTheory = labels.includes("THEORY");
  console.log(`  "${q}"\n     -> domains: ${labels.join(", ") || "(none)"}  [${ctx.length} chars${ctx.length > KB_PROMPT_CHAR_CAP ? ", OVER CAP" : ""}]`);
  if (q.includes("บันไดเสียง")) {
    ok(`"${q}" reaches THEORY`, hasTheory, "control: the Thai synonym that IS in the table does fire — so retrieval works, the keyword list is simply missing the common word");
  } else {
    ok(`"${q}" reaches THEORY knowledge`, hasTheory,
       "the chat is told MOTIVATION + PRACTICE PLANS instead, and is explicitly forbidden to contradict them; it has NO scale fact to ground on");
  }
}

console.log("\n=== 3. when a question DOES hit theory, is the scale knowledge real? ===");
const ctxTheory = getKBContext("บันไดเสียง");
const theoryLines = ctxTheory.split("\n").filter((l) => l.includes("[THEORY]"));
console.log("  THEORY lines served for a scale question:");
for (const l of theoryLines) console.log("    " + l.slice(0, 150));
ok("the theory domain serves lines that mention a scale formula",
   theoryLines.some((l) => /W-W-H|บันได|สเกล/.test(l)));

console.log("\n=== 4. same question, the chord/triad words ===");
const CHORD_QS = ["สอนคอร์ดให้หน่อย", "ทริแอดต่างกันยังไง", "คอร์ดเสียงแล้ว", "อธิบาย diminished triad"];
for (const q of CHORD_QS) {
  const labels = labelsIn(M.getKBContext(q));
  const okHarmony = labels.includes("HARMONY");
  console.log(`  "${q}" -> ${labels.join(", ")}`);
  ok(`"${q}" reaches HARMONY knowledge`, okHarmony,
     "the chat is given MOTIVATION + PRACTICE PLANS instead, with no chord fact to ground on");
}

console.log(fail ? `\n${fail} CHECK(S) FAILED — these are the reasons the chat answers Scale/Chord questions wrong` : "\nALL CHECKS PASSED");
process.exit(fail ? 1 : 0);