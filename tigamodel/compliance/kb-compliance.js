/* ── tigamodel/compliance/kb-compliance.js ──
   LEGAL CLEANLINESS SCANNER for the Knowledge Base (docs/07 strategy, items
   A + C + D — owner directive: "ปิดความเสี่ยงให้หมด"). Pure + deterministic:
   takes the real KB and the real SOURCES registry, returns a per-check report.
   Wired into the scorecard (bar 6) and smoke-kb-compliance.mjs so KB changes
   that dirty the KB fail CI.

   What Thai law / industry cases actually hinge on (docs/07):
   - facts are not copyrightable (Thai Copyright Act s.7) — but LONG VERBATIM
     passages are expression → check n-gram overlap against the stored source
     excerpt (the only original text we keep per source)
   - trademark lives in COMMERCIAL/ENDORSEMENT use, not attribution (Getty v
     Stability lesson) → flag endorsement/partnership phrasing
   - health claims need their framing ON the entry, not in a code comment
     (music-therapy wellbeing frame) → check the marker is inside body text

   Thresholds (conservative, documented):
   - verbatim: ≥8 consecutive shared WORDS (en) or ≥24 consecutive shared
     CHARACTERS (th/zh — no word spaces) between an entry and its source's
     stored excerpt → flag. Our entries are paraphrases, so real overlap
     should be ~zero; this catches regressions.
   - source ids: either "tiga-*" (our own reasoning/computed content) or a
     registered SOURCES id — anything else is an untraceable citation.
   - therapy: every music-therapy/health entry must carry the wellbeing frame
     marker inside its body and must avoid cure/diagnose claims. ── */

export const VERBATIM_WORDS = 8;      // consecutive words (latin scripts)
export const VERBATIM_CHARS = 24;     // consecutive chars (th/zh, no spaces)

/* Proper-noun runs are NOT copying (names/facts are not copyrightable —
   Thai Act s.7): course lists, people, institutions, theory names. Strip
   them from both sides before the char-run check, else a shared "Berklee
   Music Theory, Ear Training, Harmony" reads as plagiarism. */
const PROPER_NOUNS = [
  "music theory, ear training, harmony", "music theory, ear training, and harmony",
  "nikolai rubinstein; tchaikovsky", "louise farrenc, henri herz",
  "center for performance science", "centre for performance science",
  "czerny→leschetizky→neuhaus",
  "self-determination theory", "self determination theory",
  /* standard note-value vocabulary (semibreve/minim/crotchet/quaver) — the
     universal British names for note lengths, not anyone's sentence */
  "semibreve/minim/crotchet/quaver", "semibreve/minim/crotchet",
];
const stripProper = (s) => {
  let out = String(s || "").toLowerCase().replace(/[\s\u00A0]+/g, "");
  for (const n of PROPER_NOUNS) out = out.split(stripProperOnce(n)).join("|");
  return out;
};
const stripProperOnce = (s) => String(s || "").toLowerCase().replace(/[\s\u00A0]+/g, "");

const THERAPY_DOMAINS = new Set(["music-therapy", "health"]);
const WELLBEING_MARKERS = ["wellbeing frame", "ไม่ใช่บริการทางการแพทย์", "ไม่ใช่บริการทางการแพทย์"];
const CLAIM_PATTERNS = [/รักษา(โรค|ได้)/i, /\bcures?\b/i, /\btreats?\s+(disease|illness|depression|anxiety)/i, /วินิจฉัย/i, /\bdiagnos/i, /แทนที่(นักดนตรีบำบัด|แพทย์)/i, /replaces?\s+(a\s+)?(music\s+)?therapist/i];
const TRADEMARK_PATTERNS = [
  /ร่วมมือ(อย่างเป็นทางการ)?(กับ|ระหว่าง)/i, /\bofficial\s+(partner|collaboration)/i,
  /\bendorsed\s+by\b/i, /\bcertified\s+by\b/i, /\bpartnership\s+with\b/i,
  /ได้รับการรับรอง(จาก)?/i,
  /* institutional-partnership claims only — “ผู้ปกครองเป็นพันธมิตร” (parents as
     partners in teaching) is everyday pedagogy phrasing, not an org claim, so
     require an organisation-flavoured tail: สถาบัน/มหาวิทยาลัย/บริษัท/โรงเรียน/แบรนด์ */
  /พันธมิตร(กับ|ทางการ|เชิงพาณิชย์|ระหว่าง)/i,
  /พันธมิตร(กับ|ของ)\s*(สถาบัน|มหาวิทยาลัย|บริษัท|โรงเรียน|องค์กร|แบรนด์|เครือ)/i,
];

const words = (s) => String(s || "").toLowerCase().match(/[a-z0-9']+/g) || [];
const stripSpaces = (s) => String(s || "").toLowerCase().replace(/[\s\u00A0]+/g, "");

function longestSharedRun(hayWords, needleWords, minRun) {
  if (!hayWords.length || !needleWords.length) return 0;
  const index = new Map();
  hayWords.forEach((w, i) => { if (!index.has(w)) index.set(w, []); index.get(w).push(i); });
  let best = 0;
  for (let j = 0; j + minRun <= needleWords.length; j++) {
    for (const i of index.get(needleWords[j]) || []) {
      let run = 0;
      while (j + run < needleWords.length && i + run < hayWords.length && hayWords[i + run] === needleWords[j + run]) run++;
      if (run > best) best = run;
      if (best >= needleWords.length) return best;
    }
  }
  return best;
}

function longestSharedChars(hay, needle, minRun) {
  const h = stripProper(hay), n = stripProper(needle);
  if (!h || !n || n.length < minRun) return 0;
  let best = 0;
  const step = Math.max(1, Math.floor(minRun / 2));
  for (let start = 0; start + minRun <= n.length; start += step) {
    const probe = n.slice(start, start + minRun);
    let idx = h.indexOf(probe);
    while (idx !== -1) {
      // extend the match as far as it goes
      let run = minRun;
      while (idx + run < h.length && start + run < n.length && h[idx + run] === n[start + run]) run++;
      if (run > best) best = run;
      idx = h.indexOf(probe, idx + 1);
    }
    if (best >= n.length) return best;
  }
  return best;
}

/* source excerpt = the stored `notes`/`title` text of the registered source
   (the original phrasing we actually kept) — bodies must paraphrase AWAY
   from it, so any long shared run is a regression. */
function excerptFor(sources, sourceId) {
  const s = sources && sources[sourceId];
  if (!s) return "";
  return `${s.notes || ""} ${s.title || ""}`;
}

export function auditKB(entries, sources, { wordRun = VERBATIM_WORDS, charRun = VERBATIM_CHARS } = {}) {
  const flags = [];
  let unregistered = 0, checked = 0;

  for (const e of entries) {
    checked++;
    const srcId = typeof e.source === "string" ? e.source : (e.source && e.source.source_id);
    const isOwn = !srcId || String(srcId).startsWith("tiga-");

    // A1 — every citation must be traceable
    if (!isOwn && !(sources && sources[srcId])) {
      unregistered++;
      flags.push({ check: "attribution", id: e.id, detail: `source "${srcId}" is neither tiga-* nor in the SOURCES registry` });
    }

    // A2 — verbatim distance from the stored source excerpt
    if (!isOwn && sources && sources[srcId]) {
      const excerpt = excerptFor(sources, srcId);
      if (excerpt) {
        const wRun = longestSharedRun(words(e.body), words(excerpt), 3);
        if (wRun >= wordRun) flags.push({ check: "verbatim-en", id: e.id, detail: `${wRun} shared words with source excerpt (limit ${wordRun})` });
        const cRun = longestSharedChars(e.body, excerpt, 6);
        if (cRun >= charRun) flags.push({ check: "verbatim-thzh", id: e.id, detail: `${cRun} shared chars with source excerpt (limit ${charRun})` });
      }
    }

    // C — trademark/endorsement phrasing
    const text = `${e.title || ""} ${e.body || ""}`;
    for (const re of TRADEMARK_PATTERNS) {
      if (re.test(text)) { flags.push({ check: "trademark", id: e.id, detail: `endorsement/partnership phrasing matched ${re}` }); break; }
    }

    // D — health/therapy entries carry the frame and make no claims
    if (THERAPY_DOMAINS.has(e.domain)) {
      const hasFrame = WELLBEING_MARKERS.some(m => String(e.body || "").includes(m));
      if (!hasFrame) flags.push({ check: "therapy-frame", id: e.id, detail: "wellbeing frame marker missing from body" });
      for (const re of CLAIM_PATTERNS) {
        if (re.test(text)) { flags.push({ check: "therapy-claim", id: e.id, detail: `health claim pattern matched ${re}` }); break; }
      }
    }
  }

  const byCheck = {};
  for (const f of flags) byCheck[f.check] = (byCheck[f.check] || 0) + 1;
  return { checked, unregistered, flags, byCheck, clean: flags.length === 0 };
}
