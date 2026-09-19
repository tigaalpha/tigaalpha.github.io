/* ── mistake-drill.ts ──
   Pure, headless-testable logic for Play Along plan items 1/3/4/8:

   #1  Mistake Loop — bucket a finished run's missed notes into playable
       drill segments, rank the worst ones, and walk a tempo ladder.
   #3  Boss Battle — HP economics (boss size from song length, combo-chip
       bonus damage, defeat bounty by stars).
   #4  Knowledge Drops — pitch-class → one-line music fact in th/en/zh.
   #8  AI Backing — real per-song chord progressions (major I–V–vi–IV,
       minor i–VI–III–VII) instead of the old I–IV–V–I loop.

   No React, no audio, no DOM: the game (use-play-along) owns WHEN to call
   these; this file owns WHAT the numbers are. Kept dependency-free on
   purpose so verify scripts can import it directly. ── */

const PCS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/* ── #1 Mistake Loop ──────────────────────────────────────────────────────
   Notes come straight from the graded run (songNotesRef.current): each has
   .t (start sec), .note (e.g. "C5"), .missed. Misses land within ~8s of
   each other share a segment — one segment is one loopable drill. ── */
export const DRILL_WINDOW_SEC = 8;

export function buildDrillPlan(notes, opts) {
  const list = (notes || []).filter(n => n && n.missed);
  if (!list.length) return null;
  const segs = [];
  for (const n of list) {
    const last = segs[segs.length - 1];
    if (last && n.t - last.end <= DRILL_WINDOW_SEC) {
      last.end = Math.max(last.end, n.t);
      last.misses++;
      last.notes.push(n.note);
    } else {
      segs.push({ start: n.t, end: n.t, misses: 1, notes: [n.note] });
    }
  }
  const maxSegs = (opts && opts.max) || 4;
  const ranked = segs
    .sort((a, b) => b.misses - a.misses || a.start - b.start)
    .slice(0, maxSegs)
    .sort((a, b) => a.start - b.start); // display in play order
  return ranked.map((s, i) => ({
    idx: i,
    start: s.start,
    end: s.end,
    misses: s.misses,
    notes: [...new Set(s.notes)].slice(0, 5),
  }));
}

/* Tempo ladder for a drill: always start slower than the song's own tempo
   and climb toward 1× only once the segment is actually played through.
   Pass the CURRENT effective tempo; get the next rung (0.75 → 0.85 → 1). */
export function nextDrillTempo(t) {
  const cur = Number(t) || 1;
  for (const s of [0.75, 0.85, 1]) if (cur < s - 1e-9) return s;
  return 1;
}

/* First rung for a FRESH drill: start at 75% but never slower than the
   song's own tempo — a 0.5× song drills at its own 0.5×. */
export function firstDrillTempo(songTempo) {
  const t = Number(songTempo) || 1;
  return Math.min(0.75, t);
}

/* ── #3 Boss Battle ───────────────────────────────────────────────────────
   HP scales with song length so the boss dies around 80% of the notes —
   a full clear defeats it, a sloppy clear leaves it alive on the result
   screen. Combo chips (every 10×) are the skill expression. ── */
export function bossHpFor(totalNotes) {
  return Math.max(30, Math.round((totalNotes || 0) * 0.8));
}
export function bossComboChip(combo) {
  return combo > 0 && combo % 10 === 0 ? 2 : 0;
}
export function bossRewardCoins(stars) {
  return stars >= 3 ? 60 : stars === 2 ? 40 : stars === 1 ? 20 : 0;
}

/* ── #4 Knowledge Drops ───────────────────────────────────────────────────
   One-line, kid-readable facts keyed by pitch class — the fact is chosen
   from the note the player actually landed, so the knowledge is anchored
   to something their fingers just did. ── */
const FACTS = {
  "C":  { th: "C อยู่ซ้ายสุดของกุญแจดำคู่ — จุดเริ่มบันไดโน้ต", en: "C sits left of the two black keys — the scale's starting point", zh: "C 在两个黑键左侧——音阶的起点" },
  "C#": { th: "C# คือกุญแจดำแรกของกลุ่มสอง — สูงกว่า C ครึ่งเสียง", en: "C# is the first black key of the two-group, a half step above C", zh: "C# 是两个黑键组的第一个，比 C 高半音" },
  "D":  { th: "D อยู่ระหว่างกุญแจดำสองตัว — หาง่ายที่สุดบนคีย์บอร์ด", en: "D sits between the two black keys — the easiest note to find", zh: "D 在两个黑键之间——最容易找到的音" },
  "D#": { th: "D# คือกุญแจดำตัวที่สองของกลุ่มสอง ถัดจาก C#", en: "D# is the second black key of the two-group, next to C#", zh: "D# 是两个黑键组的第二个，紧邻 C#" },
  "E":  { th: "E ติดกับ F — ระยะครึ่งเสียง ไม่มีกุญแจดำคั่น", en: "E touches F directly — a half step with no black key between", zh: "E 紧邻 F——半音关系，中间没有黑键" },
  "F":  { th: "F คือกุญแจขาวแรกหลังกลุ่มกุญแจดำสามตัว", en: "F is the first white key after the three black keys", zh: "F 是三个黑键后的第一个白键" },
  "F#": { th: "F# คือกุญแจดำตัวแรกของกลุ่มสาม ถัดจาก F", en: "F# is the first black key of the three-group, right after F", zh: "F# 是三个黑键组的第一个，紧邻 F" },
  "G":  { th: "G ถัดจาก F — ครึ่งหลังของบันไดเริ่มที่นี่", en: "G follows F — the second half of the scale starts here", zh: "G 在 F 之后——音阶后半段从这里开始" },
  "G#": { th: "G# คือกุญแจดำตัวกลางของกลุ่มสาม", en: "G# is the middle black key of the three-group", zh: "G# 是三个黑键组的中间那个" },
  "A":  { th: "A คือเสียงมาตรฐานตั้งสายของวงดนตรี (440Hz)", en: "A is the tuning standard of the whole orchestra (440Hz)", zh: "A 是乐团调音的标准音（440Hz）" },
  "A#": { th: "A# คือกุญแจดำตัวสุดท้ายของกลุ่มสาม ถัดจาก A", en: "A# is the last black key of the three-group, after A", zh: "A# 是三个黑键组的最后一个，在 A 之后" },
  "B":  { th: "B ปิดท้ายบันได — ขึ้นไปอีกครึ่งเสียงคือ C วนใหม่", en: "B ends the scale — one half step up wraps around to C", zh: "B 是音阶的结尾——再升半音就回到 C" },
};

export function knowledgeDropFor(noteName) {
  const pc = String(noteName || "").replace(/-?\d+$/, "");
  const f = FACTS[pc];
  return f ? { pc, th: f.th, en: f.en, zh: f.zh } : null;
}

/* ── #8 AI Backing — real progressions ────────────────────────────────────
   Major songs get I–V–vi–IV (the "four chords every pop song uses"
   progression — far more musical than the old I–IV–V–I loop); minor songs
   get its natural-minor mirror i–VI–III–VII. Chords are pitch-class roots;
   playBackingChord voices the triad as before. ── */
export const BACKING_LABELS = { major: "I–V–vi–IV", minor: "i–VI–III–VII" };

export function backingProgression(tonicPc, isMinor) {
  const ri = PCS.indexOf(tonicPc);
  if (ri < 0) return backingProgression("C", false);
  const semis = isMinor ? [0, 8, 3, 10] : [0, 7, 9, 5];
  return semis.map(s => PCS[(ri + s) % 12]);
}

/* Minor detection from the song's own notes: compare how often the melody
   touches the tonic's minor third vs major third — whatever third the song
   actually lives on wins. Tonic = pitch class of the final note (the same
   convention music-engine's songTonic already uses). */
export function smartBackingPlan(songMeta) {
  const seq = (songMeta && songMeta.seq) || [];
  const FLATS = { "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#" };
  const pcOf = n => { const pc = String(n || "").replace(/-?\d+$/, ""); return FLATS[pc] || pc; }; // normalize enharmonics
  const played = seq.filter(x => x && x[0] && x[0] !== "R").map(x => x[0]);
  const tonicPc = pcOf(played[played.length - 1] || "C4");
  const ri = PCS.indexOf(tonicPc);
  if (ri < 0) return { tonic: "C", minor: false, chords: backingProgression("C", false), label: BACKING_LABELS.major };
  const thirdMin = PCS[(ri + 3) % 12], thirdMaj = PCS[(ri + 4) % 12];
  let cMin = 0, cMaj = 0;
  for (const n of played) {
    const pc = pcOf(n);
    if (pc === thirdMin) cMin++;
    else if (pc === thirdMaj) cMaj++;
  }
  const minor = cMin > cMaj;
  return { tonic: tonicPc, minor, chords: backingProgression(tonicPc, minor), label: minor ? BACKING_LABELS.minor : BACKING_LABELS.major };
}
