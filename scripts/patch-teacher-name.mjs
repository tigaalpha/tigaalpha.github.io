/* One-off patch: the practice-result AI card header (practiceCoachSays)
   must read "ครู TIGA ALPHA …" in every language — owner asked that the teacher
   be called "ครู TIGA ALPHA" everywhere on this page. Idempotent: re-running
   reports "already applied". */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "i18n.ts";
let s = readFileSync(FILE, "utf8");
const orig = s;

const REPL = [
  // th — exactly "ครู TIGA ALPHA" (owner crossed out the old suffix)
  ['practiceCoachSays: "ครู TIGA ALPHA พูดว่า"', 'practiceCoachSays: "ครู TIGA ALPHA"'],
  ['practiceCoachSays: "ครู TiGA พูดว่า"', 'practiceCoachSays: "ครู TIGA ALPHA"'],
  // en
  ['practiceCoachSays: "Teacher TIGA ALPHA says"', 'practiceCoachSays: "Teacher TIGA ALPHA"'],
  ['practiceCoachSays: "Coach TiGA says"', 'practiceCoachSays: "Teacher TIGA ALPHA"'],
  // zh
  ['practiceCoachSays: "TIGA ALPHA老师说"', 'practiceCoachSays: "TIGA ALPHA老师"'],
  ['practiceCoachSays: "TiGA老师说"', 'practiceCoachSays: "TIGA ALPHA老师"'],
];

let changed = 0;
for (const [oldStr, newStr] of REPL) {
  if (s.includes(newStr)) { console.log(`ok (already): ${newStr}`); continue; }
  if (!s.includes(oldStr)) { console.error(`MISS: ${oldStr}`); process.exitCode = 1; continue; }
  s = s.split(oldStr).join(newStr);
  changed++;
  console.log(`patched: ${newStr}`);
}

if (s !== orig) { writeFileSync(FILE, s); console.log(`written (${changed} change[s])`); }
else console.log("no changes");
