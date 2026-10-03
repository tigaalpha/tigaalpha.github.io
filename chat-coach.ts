/* ── chat-coach.ts ──
   The two things that make a chat answer do something instead of just be read:
   a question back, and a next action. Both are derived from the ANSWER TEXT
   HERE, on the client, with no extra model call — a quiz that costs a second
   round-trip to produce would make the app slower and more expensive for the
   one feature it is meant to make better.

   1) askQuestionOf(text) — picks one comprehension check out of what the tutor
      just wrote, in the order:
        a) an explicit quiz the tutor wrote itself, in the
           `[? question | wrong | wrong | right]` line (the persona is asked for
           this; when the model doesn't do it, nothing is invented here)
        b) a note the tutor just named — "C4 E4 G4" → which note is the third?
           → the classic beginner check, and the app KNOWS the answer because
           the tutor wrote it down.
      Returns null when neither applies: a short answer with no note names gets
      no question rather than a made-up one. A wrong quiz is worse than none.

   2) nextActionOf(text, lang) — one button that takes the learner from the
      answer to the thing that trains it, resolved by the app's existing
      resolveCoachStep in PianoApp. This module only PROPOSES the step text;
      App.tsx decides where it goes, so there is exactly one routing table.

   Pure and synchronous: no localStorage, no network. That is deliberate —
   tigamodel/scripts/smoke-chat-coach.mjs pins the rules with fixtures, the same
   way smoke-learner-signal.mjs does for the Mentor card. */
import { tr } from "./i18n";

export type Ask = {
  id: string;
  q: string;
  opts: string[];     // exactly 3, in the order shown
  answer: number;     // index into opts
  source: "model" | "note";   // "model" = the tutor wrote [?...]; "note" = we derived it from note names
};
export type Action = { key: string; icon: string; label: string; step: string };

/* The persona asks for this on ONE line, at the very end, when a check makes
   sense: [? คำถาม | ผิด | ผิด | ถูก]. Square brackets keep it out of the way
   of the plain-text rules (no # headings, lists with "-"), and the pipe keeps
   the four parts unambiguous in any of the three languages. Anything that
   doesn't match exactly is ignored, never half-parsed. */
const ASK_LINE = /^\s*\[\?\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*\]\s*$/;

export function parseAskLine(line: string): Ask | null {
  const m = String(line || "").match(ASK_LINE);
  if (!m) return null;
  const q = m[1].trim();
  const opts = [m[2].trim(), m[3].trim(), m[4].trim()];
  if (!q || opts.some((o) => !o)) return null;
  if (new Set(opts.map((o) => o.toLowerCase())).size !== 3) return null; // two identical wrong answers = a guess, not a check
  const answer = opts.findIndex((o) => /^\s*(\||✓|✔|✅|\*)/.test(o) || /^\s*(correct|ถูก|正确)\b/i.test(o));
  if (answer < 0) return null;                                       // no marked answer = unplayable
  const clean = opts.map((o) => o.replace(/^\s*(\||✓|✔|✅|\*)/, "").replace(/^\s*(correct|ถูก|正确)\s*[:：]?\s*/i, "").trim());
  return { id: "a" + q.length + "-" + clean.join("").slice(0, 12), q, opts: clean, answer, source: "model" };
}

/* Note names the tutor actually wrote — the app's own notation, so the answer
   to "which is the third?" is a fact, not a guess. Octave numbers required
   (C4, E4, F#3): a bare "C" is ambiguous across octaves and would make a
   wrong quiz, which is the one thing this must never produce. */
const NOTE_RE = /\b([A-Ga-g])([#b]?)(-?\d)\b/g;

type Note = { name: string; pc: number; midi: number };
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function notesOf(text: string): Note[] {
  const out: Note[] = [];
  let m: RegExpExecArray | null;
  NOTE_RE.lastIndex = 0;
  while ((m = NOTE_RE.exec(String(text || "")))) {
    const letter = m[1].toUpperCase();
    let pc = PC[letter] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    pc = ((pc % 12) + 12) % 12;
    const midi = (Number(m[3]) + 1) * 12 + pc;
    const name = letter + m[2] + m[3];
    if (!out.some((n) => n.midi === midi)) out.push({ name, pc, midi }); // "C4" then "C4" is one note, not two choices
  }
  return out;
}

/* The check we can always get right: a run of distinct notes, "which is the
   Nth?", with the distractors taken from the SAME answer (so they're plausible
   to a beginner) and never from outside it (which would need the model). Needs
   at least three distinct notes — two notes give one option too few to make a
   real choice. */
export function noteAsk(text: string, lang: string): Ask | null {
  const notes = notesOf(text);
  if (notes.length < 3) return null;
  const L = (th: string, en: string, zh: string) => tr({ th, en, zh } as any, lang);
  const i = Math.min(2, notes.length - 1);           // the third note, or the last if there are only three
  const right = notes[i];
  const others = notes.filter((n) => n.midi !== right.midi);
  if (others.length < 2) return null;
  const picked = [others[0], others[others.length - 1] !== others[0] ? others[others.length - 1] : others[1 % others.length]];
  const q = L(`โน้ตที่ ${i + 1} คือโน้ตอะไร`, `Which note is #${i + 1}?`, `第 ${i + 1} 个音是什么？`);
  const opts = [right.name, picked[0].name, picked[1].name];
  return { id: "n" + right.midi + "-" + i, q, opts, answer: 0, source: "note" };
}

/* The question for one answer, in the order the persona's own [?…] wins. */
export function askQuestionOf(text: string, lang: string): Ask | null {
  const lines = String(text || "").split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {       // the line the tutor closed with
    const a = parseAskLine(lines[i]);
    if (a) return a;
  }
  /* The tutor TRIED to ask and the line is broken (no marked answer, a
     duplicated option, a missing pipe). Silently building a DIFFERENT question
     out of the note names inside that same broken line would show the learner
     a check nobody wrote — and if the line's notes were the wrong ones, a
     question with a wrong answer attached. A broken attempt is worth nothing;
     answer null and let the tutor's plain explanation stand on its own. */
  for (const l of lines) if (/^\s*\[\?/.test(l)) return null;
  return noteAsk(text, lang);
}

/* Strip the quiz line out of what the learner reads — the buttons ARE the
   quiz; leaving the raw [? … | … ] line above them would be showing the
   markup. Returns the visible text and whether anything was removed. */
export function splitAskLine(text: string): { text: string; had: boolean } {
  const lines = String(text || "").split("\n");
  const keep: string[] = [];
  let had = false;
  for (const l of lines) {
    /* Every [?… line is markup, whether or not it parsed into a playable
       check — a broken one that stayed on screen would read as raw syntax to
       the learner ("[? โน้ตที่ 3 คืออะไร | C4 | E4 | G4]"). Removing all of
       them keeps the two honest together: what askQuestionOf decides and what
       the learner sees come from the same rule. */
    if (/^\s*\[\?/.test(l)) { had = true; continue; }
    keep.push(l);
  }
  return { text: keep.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd(), had };
}

/* ── The next action ──
   Ordered by how strongly the answer implies it, and each one only fires on
   words the tutor actually used — a button that appears on every answer is a
   button nobody reads. `step` goes to resolveCoachStep(), which is the app's
   ONE routing table (App.tsx), so this module never invents a destination. */
/* `step` is a key of PianoApp's handleCoachNavigate — the app's ONE navigation
   table (App.tsx), the same one the Mentor card and the auto-teaching popup go
   through. Not resolveCoachStep: that resolves free TEXT (a song title, a
   pathway stage name) and falls back to `setPage("pathway")` for anything it
   doesn't recognise, which would drop "practice" onto the pathway list instead
   of into the thing that trains it. These keys are its real ones. */
const ACTIONS: Array<{ key: string; icon: string; re: RegExp; step: string; label: { th: string; en: string; zh: string } }> = [
  { key: "ear", icon: "👂",
    re: /(ลงหู|ฟังด้วยหู|ear\s*training|ear\b|หู|听|interval|ช่วงครึ่งเสียง)/i,
    step: "ear_training",
    label: { th: "ลองฝึกหู", en: "Try ear training", zh: "练听力" } },
  { key: "read", icon: "📖",
    re: /(อ่านโน้ต|โน้ตเปียโน|staff|clef|谱|读谱|sight)/i,
    step: "sight_reading",
    label: { th: "ลองอ่านโน้ต", en: "Try sight reading", zh: "试试视奏" } },
  { key: "play", icon: "🎹",
    re: /(เล่น|ซ้อม|ดริล|ฝึกเล่น|practice|drill|เพลง|song|play)/i,
    step: "play_along",
    label: { th: "ลองเล่นจริง", en: "Play it now", zh: "现在弹一下" } },
];

export function nextActionOf(text: string, lang: string): Action | null {
  const t = String(text || "");
  for (const a of ACTIONS) {
    if (a.re.test(t)) return { key: a.key, icon: a.icon, label: tr(a.label as any, lang), step: a.step };
  }
  return null;
}
