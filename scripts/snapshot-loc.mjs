// True LOC of the piano app at historical snapshots (accurate growth math).
// Excludes build artifacts, studio/, bos/, and pure data files for the "src" scope.
import { execSync } from "node:child_process";

const SNAP = [
  ["now", "76001f15090d16896e3049943a2a0fd1bc7c0c3b"],
  ["-1w", "be7c92bba2d51ccca7502664f09585f4d4a9c4e7"],
  ["-2w", "c930c248e9cbecf0efe89ef99b7925ece592075d"],
  ["-4w", "2cdae6c3dc728f2d83f1f00d85fe31e081c19e39"],
  ["-8w", "bf5b7a1cc610bf6908ce3d1d3ebf58d0362bade1"],
  ["-12w", "95cd85653b77ccbb28bb36f73ff846cd76896ef9"],
  ["-26w", "a2e0d94e2aa71eabe4aa2315967df31ede45c326"],
];

async function locAt(commit, exclude) {
  const files = execSync(`git ls-tree -r --name-only ${commit}`, { encoding: "utf8", maxBuffer: 1024 * 1024 * 32 })
    .split("\n").filter(Boolean)
    .filter(f => !exclude.some(x => f.startsWith(x) || f === x));
  let total = 0;
  for (const f of files) {
    try {
      const out = execSync(`git show ${commit}:${JSON.stringify(f)} 2>/dev/null | wc -l`, { encoding: "utf8", shell: "/bin/bash" });
      total += parseInt(out.trim(), 10) || 0;
    } catch (e) { /* binary etc */ }
  }
  return total;
}

const ART = ["bundle/", "dist", "landing", "updates/", "sw.js", "index.html", "package-lock.json", "android/", "ios/", "studio/", "bos/"];
const DATA = ["songs-data.ts", "pathway-data.ts", "app-styles.ts", "i18n.ts"];

const results = [];
for (const [label, c] of SNAP) {
  const all = await locAt(c, []);
  const piano = await locAt(c, ART);
  const src = await locAt(c, [...ART, ...DATA]);
  results.push({ label, all, piano, src });
  console.log(`${label.padEnd(5)} all=${all.toLocaleString().padStart(9)} piano=${piano.toLocaleString().padStart(9)} src=${src.toLocaleString().padStart(8)}`);
}
console.log("\nweek-over-week piano growth:");
for (let i = 1; i < results.length; i++) {
  const a = results[i], b = results[i - 1];
  const weeks = i === 1 ? 1 : i === 2 ? 1 : i === 3 ? 2 : i === 4 ? 4 : i === 5 ? 4 : 14;
  const g = a.piano > 0 ? (Math.pow(b.piano / a.piano, 1 / weeks) - 1) * 100 : 0;
  console.log(`${a.label} → ${b.label} (${weeks}w): piano ${(g >= 0 ? "+" : "") + g.toFixed(1)}%/wk · src ${(((b.src / Math.max(1, a.src)) ** (1 / weeks) - 1) * 100).toFixed(1)}%/wk`);
}
