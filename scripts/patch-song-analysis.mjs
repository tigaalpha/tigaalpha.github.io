// One-shot patcher for use-play-along.ts (Play Along plan #7) — replaces the
// legacy direct-AI fetchSongAnalysis with the strategy-first pipeline.
// Same technique the repo already used for the Auto Teaching wiring
// (scripts/patch-autoteach*.mjs): regex surgery on the real source file,
// verifiable, re-runnable (no-ops once the new block is present).
import { readFileSync, writeFileSync } from "node:fs";

const P = "use-play-along.ts";
let s = readFileSync(P, "utf8");

if (s.includes("const analysis = await analyzeSongRun(")) {
  console.log("already patched — nothing to do");
  process.exit(0);
}

const startMarker = "  // Per-song mistake breakdown";
const endMarker = "  // D2: Style Transformer";
const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker, start); // search AFTER start — the hook's header comment also mentions "D2"
if (start < 0 || end < 0 || end <= start) {
  console.error("markers not found:", { start, end });
  process.exit(1);
}

const replacement = `  // Per-song mistake breakdown — Play Along plan #7 (strategy-first, same
  // architecture as the Auto Teaching accuracy upgrade): the TIGA teaching
  // loop decides strategy/diagnosis from the real run numbers, the external
  // AI only renders the language (validated — generic advice can never show),
  // and a real-data fallback catches every failure layer. Guests skip the AI
  // call entirely and get the real-data fallback directly.
  async function fetchSongAnalysis(result, label) {
    if (isGuest) { setSongAnalysis(buildSongFallback(lang, label, result)); return; }
    setSongAnalysisBusy(true);
    try {
      const analysis = await analyzeSongRun(lang, label, result, runTeachingLoopForPractice, ({ system, message }) =>
        fetchChatCompletion({ message, conversationHistory: [], system, feature: "song-analysis" }), profile);
      if (analysis) setSongAnalysis(analysis); // analyzeSongRun never returns null
    } catch (e) { /* silent — the score/stars result above already shown, this is a bonus */ }
    setSongAnalysisBusy(false);
  }
`;

s = s.slice(0, start) + replacement + s.slice(end);
writeFileSync(P, s);

// sanity: imports present exactly once each
for (const needle of ['import { analyzeSongRun, buildSongFallback } from "./song-analysis";', 'import { runTeachingLoopForPractice } from "./tigamodel/web.js";']) {
  const n = s.split(needle).length - 1;
  if (n !== 1) { console.error("import count wrong for:", needle, "→", n); process.exit(1); }
}
console.log("patched fetchSongAnalysis OK");
