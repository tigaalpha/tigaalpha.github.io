/* One-off fix — Practice v4 Step 1 build break (v2, corrected):

   scripts/patch-practice-v4-step1.mjs appended the 5 chip-CSS rules to the
   END of app-styles.ts as raw CSS at top level of the TypeScript module
   (after useInjectCSS), which esbuild rejects: `Unexpected "."`.

   v1 of THIS script had a broken idempotence guard (its removal step's
   newStr "  return ready;\n" is always present, so removal never ran) —
   the rules ended up in BOTH the CSS string and the broken top-level tail.
   v2 keys on occurrence COUNT of a unique rule instead of substring
   presence: exactly 1 occurrence (inside the template string) = done,
   2+ occurrences = strip the top-level copy. */
import { readFileSync, writeFileSync } from "node:fs";

const F = "app-styles.ts";
let s = readFileSync(F, "utf8");

const RULE = ".pchip--ok{background:rgba(52,199,89,.14);border-color:#34c759;color:#34c759}";
const RULES_BLOCK = `/* Practice Mode v4 (plan §4): per-note miss-state chips (A2) — green = clean
   hit is the existing .pchip.done; amber = missed this round; red = was
   missed at finish (spot launcher list) */
.pchip--ok{background:rgba(52,199,89,.14);border-color:#34c759;color:#34c759}
.pchip--retry{background:rgba(255,159,10,.14);border-color:#ffa502;color:#ffa502}
.pchip--miss{background:rgba(255,82,82,.14);border-color:#ff5252;color:#ff5252}
.pspot{text-align:left}
.pspot .pchip{margin:2px}
`;

const count = s.split(RULE).length - 1;
if (count === 0) { console.error("MISS: rules found nowhere — nothing to fix"); process.exit(1); }

if (count >= 2) {
  // strip the top-level copy: the block preceded by the doubled blank line
  // after useInjectCSS's closing brace
  const BROKEN_TAIL = `\n\n\n${RULES_BLOCK}`;
  if (s.includes(BROKEN_TAIL)) {
    s = s.replace(BROKEN_TAIL, "\n");
    writeFileSync(F, s);
    console.log("patched: removed top-level CSS copy");
  } else {
    // anchor drift — remove by locating the LAST occurrence and cutting from
    // its comment header to the end of the block
    const last = s.lastIndexOf(RULES_BLOCK);
    if (last < 0) { console.error("MISS: duplicate rules but block anchor drifted"); process.exit(1); }
    // cut the block plus the blank lines that preceded it
    let start = last;
    while (start > 0 && (s[start - 1] === "\n" || s[start - 1] === " ")) start--;
    if (start > 0) start++; // keep exactly the newline after the previous code
    s = s.slice(0, start) + "\n" + s.slice(last + RULES_BLOCK.length);
    writeFileSync(F, s);
    console.log("patched: removed top-level CSS copy (fallback cut)");
  }
} else {
  console.log("ok: exactly one copy of the rules present");
  // ensure that one copy is INSIDE the template string (before the closing
  // backtick), not still stranded at top level
  const closeIdx = s.indexOf("color:#cdb9ff}\n\n`;");
  const ruleIdx = s.indexOf(RULE);
  if (closeIdx >= 0 && ruleIdx > closeIdx) {
    console.error("MISS: single copy sits AFTER the CSS string's closing backtick (top level) — refusing to guess; fix manually");
    process.exit(1);
  }
  console.log("ok: rules verified inside the CSS template string");
}

console.log("\nPractice v4 CSS placement fix (v2) complete.");
