/* One-off patch: the practice-result AI card header (practiceCoachSays)
   must read "ครู TIGA AI …" in every language — owner asked that the teacher
   be called "ครู TIGA AI" everywhere on this page. Idempotent: re-running
   reports "already applied". */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "i18n.ts";
let s = readFileSync(FILE, "utf8");
const orig = s;

const REPL = [
  // th — exactly "ครู TIGA AI" (owner crossed out the old suffix)
  ['practiceCoachSays: "ครู TIGA AI พูดว่า"', 'practiceCoachSays: "ครู TIGA AI"'],
  ['practiceCoachSays: "ครู TiGA พูดว่า"', 'practiceCoachSays: "ครู TIGA AI"'],
  // en
  ['practiceCoachSays: "Teacher TIGA AI says"', 'practiceCoachSays: "Teacher TIGA AI"'],
  ['practiceCoachSays: "Coach TiGA says"', 'practiceCoachSays: "Teacher TIGA AI"'],
  // zh
  ['practiceCoachSays: "TIGA AI老师说"', 'practiceCoachSays: "TIGA AI老师"'],
  ['practiceCoachSays: "TiGA老师说"', 'practiceCoachSays: "TIGA AI老师"'],
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
