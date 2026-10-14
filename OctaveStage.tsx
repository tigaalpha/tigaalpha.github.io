import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playPianoNote, stopAllPianoNotes, stopAmbient, setDisplaySpelling, FINGERINGS_LH, FINGERINGS_RH } from "./music-engine";
import { stopSpeaking, stopCloudTTS } from "./speech";
import { FingerHand } from "./PracticeOverlay";
/* ── OctaveStage ──
   Full-screen, landscape practice view for a scale or chord pattern played over 2, 3 or 4 octaves (Teacher page, owner 2026-10-13).
   The pattern comes from the one-octave demo (`notes`: name with octave + finger); each extra octave repeats it one octave higher.
   The keys are a wide horizontal keyboard, a hand shows the finger, and the note names are listed on top. */
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiOf = (n: string) => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); if (!m) return null; return (parseInt(m[3], 10) + 1) * 12 + SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (m: number) => NAMES[m % 12] + (Math.floor(m / 12) - 1);

const LETTER: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
// Four bars of the taught notes on ONE five-line staff (four quarter notes a bar, 4/4 shown in colour); the note being taught is orange. Treble staff, bottom line E4.
function StaffCard({ notes, active, title, bass, sp, count = 16 }: { notes: { m: number }[]; active: number; title: string; bass?: boolean; sp?: Sp | null; count?: number }) {
  const N = count, W = count === 8 ? 400 : 640, H = 112, left = 78, gap = (W - left - 12) / N, half = 7, bottom = 84;
  // A note is written on the line or space of its spelled letter: in a flat key the black keys are flats (D♭, not C♯), in a sharp key sharps; B♯ and C♭ sit in the octave of their letter.
  const spOf = (m: number): { L: number; acc: number } => { const e = sp && sp[m % 12]; if (e) return e; const nm = NAMES[m % 12]; return { L: LETTER[nm[0]], acc: nm.length > 1 ? 1 : 0 }; };
  const stepOf = (m: number) => { const e = spOf(m); return (Math.floor((m - e.acc) / 12) - 1) * 7 + e.L; };
  const base = bass ? 18 : 30;   // diatonic step of the bottom line: G2 in the bass clef, E4 in the treble clef
  const yOf = (st: number) => bottom - (st - base) * half;
  const top = bottom - 8 * half, mid = bottom - 4 * half;
  // High or low pages (3-4 octaves) are written the way scores do it, with an 8va / 15ma / 22ma (or 8vb) bracket, so the staff keeps the same size on every page.
  const stp = notes.slice(0, N).map(q => stepOf(q.m)), maxS = stp.length ? Math.max(...stp) : base, minS = stp.length ? Math.min(...stp) : base;
  const shift = maxS > base + 13 ? Math.ceil((maxS - (base + 13)) / 7) : minS < base - 5 ? -Math.ceil((base - 5 - minS) / 7) : 0;
  const nn = notes.slice(0, N).map(q => ({ m: q.m - 12 * shift })), ottava = shift > 0 ? ["8va", "15ma", "22ma"][Math.min(2, shift - 1)] : shift < 0 ? "8vb" : "";
  // Notes far above or below the staff (long ranges) would run off the card: stretch the view box to hold them, the drawing then scales down to fit.
  const ys = nn.map(q => yOf(stepOf(q.m))), vbTop = Math.min(0, Math.min(...ys, 99) - 32), vbBot = Math.max(H, Math.max(...ys, 0) + 32);
  return (
    <svg className="ost-staff" viewBox={`0 ${vbTop} ${W} ${vbBot - vbTop}`} role="img" aria-label={title}>
      {[0, 1, 2, 3, 4].map(i => <line key={i} x1={10} x2={W - 4} y1={bottom - i * 2 * half} y2={bottom - i * 2 * half} stroke="currentColor" strokeWidth="1" opacity=".55" />)}
      {/* The clefs are the real engraved glyphs of the Bravura music font (SIL Open Font License 1.1), as SVG paths: 1000 units to the em, 250 units to a staff space. */}
      {bass ? (
      <path aria-hidden="true" transform={`translate(12 ${bottom - 6 * half}) scale(${(2 * half) / 250} ${-(2 * half) / 250})`} fill="currentColor" d="M252 262C78 262 0 135 0 39C0 -41 42 -110 123 -110C186 -110 229 -66 229 -4C229 60 182 100 133 100C106 100 96 93 83 93C70 93 67 101 67 111C67 151 127 224 229 224C335 224 381 120 381 -37C381 -140 359 -260 297 -356C237 -449 134 -534 10 -605C1 -610 -5 -615 -5 -623C-5 -629 -1 -635 8 -635C13 -635 19 -633 25 -630C158 -565 286 -489 392 -375C479 -281 531 -159 531 -28C531 146 425 262 252 262ZM629 180C598 180 574 156 574 125C574 94 598 70 629 70C660 70 684 94 684 125C684 156 660 180 629 180ZM630 -71C599 -71 576 -94 576 -125C576 -156 599 -179 630 -179C661 -179 684 -156 684 -125C684 -94 661 -71 630 -71Z" />
      ) : (
      <path aria-hidden="true" transform={`translate(12 ${bottom - 2 * half}) scale(${(2 * half) / 250} ${-(2 * half) / 250})`} fill="currentColor" d="M376 415C374 427 376 428 382 434C398 449 419 470 438 491C522 583 572 702 572 815C572 902 548 988 507 1048C492 1070 466 1098 455 1098C441 1098 410 1072 390 1050C316 968 292 843 292 739C292 681 299 616 306 575C308 563 309 561 297 551C233 498 164 437 112 373C43 287 0 194 0 87C0 -87 119 -252 364 -252C387 -252 413 -250 433 -246C444 -244 446 -243 448 -255C460 -322 475 -409 475 -456C475 -604 375 -622 316 -622C262 -622 236 -606 236 -593C236 -586 245 -583 268 -576C299 -567 335 -540 335 -482C335 -427 300 -380 239 -380C172 -380 132 -433 132 -495C132 -560 171 -658 322 -658C389 -658 519 -628 519 -458C519 -401 501 -306 490 -244C488 -232 489 -233 503 -227C604 -187 671 -102 671 11C671 139 577 252 430 252C404 252 404 252 401 270ZM470 943C503 943 530 916 530 861C530 792 497 728 419 650C403 634 379 611 356 591C349 585 345 586 343 599C339 625 337 659 337 691C337 847 409 943 470 943ZM361 262C364 243 364 244 346 238C258 208 201 129 201 44C201 -46 248 -110 316 -133C324 -136 336 -139 343 -139C351 -139 355 -134 355 -128C355 -121 347 -118 340 -115C298 -97 268 -54 268 -8C268 49 307 92 368 109C384 113 386 112 388 101L438 -197C440 -208 439 -208 424 -211C408 -214 388 -216 368 -216C193 -216 80 -119 80 20C80 79 90 158 173 252C233 319 279 356 326 394C336 402 338 401 340 390ZM430 103C428 115 429 118 441 117C522 110 589 42 589 -46C589 -109 551 -160 495 -188C483 -194 481 -194 479 -182Z" />
      )}
      <g aria-hidden="true" fontFamily="Georgia,'Times New Roman',serif" fontWeight="900" fontSize="30" textAnchor="middle">
        <text x={64} y={mid - 6} fill="#d97757">4</text><text x={64} y={bottom - 6} fill="#2f9e8f">4</text>
      </g>
      <line x1={10} x2={10} y1={top} y2={bottom} stroke="currentColor" strokeWidth="1.5" />
      {Array.from({ length: N / 4 - 1 }, (_, i) => i + 1).map(k => <line key={k} x1={left + gap * 4 * k} x2={left + gap * 4 * k} y1={top} y2={bottom} stroke="currentColor" strokeWidth="1" opacity=".7" />)}
      <line x1={W - 8} x2={W - 8} y1={top} y2={bottom} stroke="currentColor" strokeWidth="1.5" /><line x1={W - 4} x2={W - 4} y1={top} y2={bottom} stroke="currentColor" strokeWidth="3" />
      {ottava && <g aria-hidden="true" fill="#d97757" stroke="#d97757"><text x={left + 6} y={shift > 0 ? -14 : bottom + 34} fontSize="15" fontStyle="italic" fontWeight="800" stroke="none">{ottava}</text><line x1={left + 44} x2={W - 10} y1={shift > 0 ? -18 : bottom + 30} y2={shift > 0 ? -18 : bottom + 30} strokeWidth="1.4" strokeDasharray="5 4" /></g>}
      {nn.map((q, i) => { const st = stepOf(q.m), y = yOf(st), x = left + gap * (i + 0.5), on = i === active, acc = spOf(q.m).acc;
        const ledgers: number[] = []; for (let l = base - 2; l >= st; l -= 2) ledgers.push(l); for (let l = base + 10; l <= st; l += 2) ledgers.push(l);
        return (<g key={i} className={on ? "on" : ""}>
          {ledgers.map(l => <line key={l} x1={x - 11} x2={x + 11} y1={yOf(l)} y2={yOf(l)} stroke="currentColor" strokeWidth="1" opacity=".7" />)}
          {acc !== 0 && <text x={x - (Math.abs(acc) === 2 ? 22 : 17)} y={y + 5} fontSize="14" fontWeight={acc === 2 ? 800 : 400} fill={on ? "#d97757" : "currentColor"}>{acc === 1 ? "♯" : acc === -1 ? "♭" : acc === 2 ? "x" : "♭♭"}</text>}
          <ellipse cx={x} cy={y} rx="6.5" ry="5" fill={on ? "#d97757" : "currentColor"} transform={`rotate(-18 ${x} ${y})`} />
          <line x1={st >= base + 4 ? x - 6 : x + 6} x2={st >= base + 4 ? x - 6 : x + 6} y1={y} y2={st >= base + 4 ? y + 26 : y - 26} stroke={on ? "#d97757" : "currentColor"} strokeWidth="1.6" />
        </g>); })}
    </svg>
  );
}
type Sp = Record<number, { L: number; acc: number }>;
// The spelling of each key as scores write it (one letter per degree): flat keys with flats, sharp keys with sharps. F♯ major is written with sharps; E♭, G♯ and B♭ minor are the usual minor keys.
const MAJOR_SP = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"], MINOR_SP = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const rootLabel = (pc: number, type: string) => (type === "major" ? MAJOR_SP : MINOR_SP)[pc].replace("#", "♯").replace("b", "♭");
/** pitch class -> its letter (0 = C … 6 = B) and accidental (-2..2) in the scale of this root and type. */
export function spellScale(pc: number, type: string): Sp {
  const nm = (type === "major" ? MAJOR_SP : MINOR_SP)[pc], L0 = LETTER[nm[0]], out: Sp = {}, nat = [0, 2, 4, 5, 7, 9, 11];
  (SCALE_STEPS[type] || SCALE_STEPS.major).slice(0, 7).forEach((st, i) => { const L = (L0 + i) % 7, target = (pc + st) % 12; out[target] = { L, acc: ((target - nat[L] + 18) % 12) - 6 }; });
  return out;
}
const SCALE_STEPS: Record<string, number[]> = { major: [0, 2, 4, 5, 7, 9, 11, 12], "natural minor": [0, 2, 3, 5, 7, 8, 10, 12], "harmonic minor": [0, 2, 3, 5, 7, 8, 11, 12], "melodic minor": [0, 2, 3, 5, 7, 9, 11, 12] };
// the Teacher page's fingering tables are keyed by these names (flats for the black-key majors); a minor scale of any type uses its minor table (harmonic and melodic go up the same way)
const MAJOR_KEY = ["c", "db", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"], MINOR_KEY = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
/** Which one-octave scale these eight notes are (root pitch class + type), or null when they are not a major or minor scale. */
export function scaleKind(notes: { note: string }[]): { pc: number; type: string } | null {
  const ms = notes.map(p => midiOf(p.note)); if (ms.length !== 8 || ms.some(v => v == null)) return null;
  const rel = ms.map(m => (m as number) - (ms[0] as number));
  for (const type of Object.keys(SCALE_STEPS)) if (SCALE_STEPS[type].every((v, i) => v === rel[i])) return { pc: (ms[0] as number) % 12, type };
  return null;
}
/** The one-octave notes of a scale of this type on this root (starting in octave 4). */
export function buildScale(pc: number, type: string): { note: string; finger: number | null }[] { return (SCALE_STEPS[type] || SCALE_STEPS.major).map(st => { const abs = pc + st; return { note: NAMES[abs % 12] + (4 + Math.floor(abs / 12)), finger: null }; }); }
/** The standard fingering of a recognised one-octave major/minor scale for the given hand (the same tables the Teacher page teaches), or null when the notes are not such a scale or the table has no entry for that key. */
export function scaleFingers(notes: { note: string; finger: number | null }[], hand: string): number[] | null {
  const k = scaleKind(notes); if (!k) return null;
  const name = (k.type === "major" ? MAJOR_KEY[k.pc] + " major scale" : MINOR_KEY[k.pc] + " minor scale");
  const t = (hand === "left" ? (FINGERINGS_LH as any) : (FINGERINGS_RH as any))[name];
  return t && t.length === 8 ? t.slice() : null;
}
export function extendPattern(notes: { note: string; finger: number | null }[], octaves: number, junctionF?: number | null) {
  const base = notes.map(p => ({ m: midiOf(p.note), f: p.finger })).filter(p => p.m != null) as { m: number; f: number | null }[];
  if (base.length < 2) return [] as { m: number; f: number | null }[];
  const out: { m: number; f: number | null }[] = [];
  // A chord / arpeggio demo does not reach the next root: each octave repeats every note, and the run ends on the root one octave above the last group.
  if (base[base.length - 1].m - base[0].m < 12) {
    for (let o = 0; o < octaves; o++) base.forEach(p => out.push({ m: p.m + 12 * o, f: p.f }));
    out.push({ m: base[0].m + 12 * octaves, f: base[base.length - 1].f });
    return out;
  }
  for (let o = 0; o < octaves; o++) base.forEach((p, i) => { if (o > 0 && i === 0) return; out.push({ m: p.m + 12 * o, f: i === base.length - 1 && o < octaves - 1 ? (junctionF != null ? junctionF : base[0].f) : p.f }); });
  return out;
}
const TYPE_NAME: Record<string, Record<string, string>> = { major: { th: "สเกลเมเจอร์", en: "Major Scale", zh: "大调音阶" }, "natural minor": { th: "สเกลไมเนอร์เนเชอรัล", en: "Natural Minor Scale", zh: "自然小调音阶" }, "harmonic minor": { th: "สเกลไมเนอร์ฮาร์โมนิก", en: "Harmonic Minor Scale", zh: "和声小调音阶" }, "melodic minor": { th: "สเกลไมเนอร์เมโลดิก", en: "Melodic Minor Scale", zh: "旋律小调音阶" } };
export function OctaveStage({ notes: notesProp, label: labelProp, octaves, setOctaves, hand, setHand, lang, onClose, onPractice }: any) {
  // Tap the title to change the key without leaving the page: any of the 12 keys of the same kind of scale (major, natural / harmonic / melodic minor).
  const kind0 = useMemo(() => scaleKind(notesProp), [notesProp]);
  const [pickPc, setPickPc] = useState<number | null>(null); const [keysOpen, setKeysOpen] = useState(false);
  // A different lesson replaces the chosen key, but switching hands rebuilds the same lesson with new fingers: the key the learner picked stays.
  const lessonSig = useMemo(() => notesProp.map((q: any) => q.note).join(), [notesProp]);
  useEffect(() => { setPickPc(null); }, [lessonSig]);
  const notes = useMemo(() => (kind0 && pickPc != null ? buildScale(pickPc, kind0.type) : notesProp), [kind0, pickPc, notesProp]);
  const kindNow = useMemo(() => scaleKind(notes), [notes]), sp = useMemo(() => (kindNow ? spellScale(kindNow.pc, kindNow.type) : null), [kindNow]);
  const curPc = kind0 ? (pickPc != null ? pickPc : kind0.pc) : -1;
  const label = kind0 && pickPc != null ? `${(TYPE_NAME[kind0.type] || TYPE_NAME.major)[lang] || TYPE_NAME[kind0.type].en} · ${rootLabel(pickPc, kind0.type)}` : labelProp;
  const [both, setBoth] = useState(true);   // up AND down by default: the demo, the orange light and the staff all follow the lesson back down
  // The left hand starts an octave lower (C3, bass clef), the way a left-hand scale is taught.
  const shift = hand === "left" ? -12 : 0, upBase = useMemo(() => {
    // The incoming fingers belong to whichever hand the lesson was built for (a rising 1..5 is right-hand style, 5..1 left-hand style); the stage's own hand switch must give THAT hand's fingers, so a pattern in the other style is mirrored (a left-hand scale is the right-hand fingering read backwards: C major RH 1 2 3 1 2 3 4 5, LH 5 4 3 2 1 3 2 1).
    const f0 = notes[0] && notes[0].finger, f1 = notes[notes.length - 1] && notes[notes.length - 1].finger;
    const style = f0 != null && f1 != null && f0 !== f1 ? (f0 < f1 ? "right" : "left") : hand;
    const std = scaleFingers(notes, hand);   // a recognised scale takes the real fingering of the chosen hand; anything else is mirrored from the other hand's
    const fixed = std ? notes.map((q: any, i: number) => ({ ...q, finger: std[i] })) : style === hand ? notes : notes.map((q: any, i: number) => ({ ...q, finger: notes[notes.length - 1 - i].finger }));
    // The piano voice is built for C2..C7 (NF in music-engine): a note above C7 used to be silent, so a 3-4 octave scale starts lower, as many octaves as it takes for its top note to stay at or below C7.
    const ext = extendPattern(fixed, octaves, std ? (hand === "left" ? std[7] : std[0]) : undefined), topM = Math.max(...ext.map(q => q.m)); let sh = shift; while (topM + sh > 96) sh -= 12;
    return ext.map(q => ({ ...q, m: q.m + sh }));
  }, [notes, octaves, shift, hand]);
  // The other hand's real fingering at the same degree (index for index), when the lesson is a recognised scale; otherwise the old mirror below.
  const otherUp = useMemo(() => {
    const oh = hand === "left" ? "right" : "left", std = scaleFingers(notes, oh);
    return std ? extendPattern(notes.map((q: any, i: number) => ({ ...q, finger: std[i] })), octaves, oh === "left" ? std[7] : std[0]) : null;
  }, [notes, octaves, hand]);
  const seq = useMemo(() => both ? [...upBase, ...upBase.slice(0, -1).reverse()] : upBase, [upBase, both]);
  const staffSeq = seq;   // the staff shows exactly what the light and the demo play (up only, or up and back down)
  const [cur, setCur] = useState(-1); const [next, setNext] = useState(0); const [bad, setBad] = useState(-1); const [misses, setMisses] = useState(0); const [rounds, setRounds] = useState(0); const [praise, setPraise] = useState<string | null>(null); const [playing, setPlaying] = useState(false); const [portrait, setPortrait] = useState(false);
  const timer = useRef<any>(null);
  const T = { th: { play: "เล่นให้ดู", stop: "หยุด", close: "ปิด", notes: "โน้ต", left: "มือซ้าย", perfect: "เยี่ยม! รอบนี้ไม่พลาดเลย", done: "จบรอบแล้ว พลาด {n} ครั้ง ลองอีกรอบ", round: "รอบที่ผ่าน", right: "มือขวา", tap: "ถึงตาคุณ: กดคีย์ที่ไฟส้มรออยู่" }, en: { play: "Play it", stop: "Stop", close: "Close", notes: "Notes", left: "Left hand", perfect: "Perfect! No slips this round", done: "Round done, {n} slips. Go again", round: "Rounds", right: "Right hand", tap: "Your turn: press the key the orange light is on" }, zh: { play: "示范", stop: "停止", close: "关闭", notes: "音符", left: "左手", perfect: "太棒了！这一轮没有失误", done: "本轮完成，失误 {n} 次，再来一轮", round: "完成轮数", right: "右手", tap: "轮到你：按橙色灯亮着的琴键" } }[lang as "th" | "en" | "zh"] || ({} as any);
  useEffect(() => {   // coming in from the page outside: cut whatever was sounding there (notes, ambience, speech) and start silent; sound only starts when the learner presses Play or a key
    try { stopAllPianoNotes(); } catch (e) {} try { stopAmbient(); } catch (e) {} try { stopSpeaking(); } catch (e) {} try { stopCloudTTS(); } catch (e) {}
  }, []);
  useEffect(() => {
    try { const el: any = document.documentElement; if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {}); (screen.orientation as any)?.lock?.("landscape").catch(() => {}); } catch (e) {}
    const chk = () => setPortrait(window.innerHeight > window.innerWidth); chk(); window.addEventListener("resize", chk);
    return () => { window.removeEventListener("resize", chk); clearInterval(timer.current); if ((window as any).__octKeepFs) return; /* handing over to the practice page: stay full screen and landscape */ try { (screen.orientation as any)?.unlock?.(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {} };
  }, []);
  const run = () => {
    if (playing) { clearInterval(timer.current); setPlaying(false); return; }
    setPlaying(true); let i = 0; const step = () => { if (i >= seq.length) { clearInterval(timer.current); setPlaying(false); return; } setCur(i); try { playPianoNote(nameOf(seq[i].m), 0.6, 1); } catch (e) {} i++; };
    step(); timer.current = setInterval(step, 520);
  };
  if (!seq.length) return null;
  const lo = Math.floor((Math.min(...seq.map(s => s.m)) - 12) / 12) * 12 + 12, hi = Math.max(Math.max(...seq.map(s => s.m)), Math.floor((Math.min(...seq.map(s => s.m)) - 12) / 12) * 12 + 12 + 47);   // at least 4 octaves of keys (the same key size for 2, 3 and 4 octaves) and always the top note
  const whites: number[] = [], blacks: number[] = []; for (let m = lo; m <= hi; m++) (NAMES[m % 12].length === 1 ? whites : blacks).push(m);
  const wIndex = (m: number) => whites.indexOf(m), wW = 100 / whites.length;
  // While the demo plays, the light follows it; otherwise it waits on the key the learner has to press next ("your turn").
  const idx = playing ? cur : Math.min(next, seq.length - 1), litM = idx >= 0 ? seq[idx].m : -1, finger = idx >= 0 ? seq[idx].f : 0;
  // The other hand plays the same degree in parallel octaves with the mirrored fingering (a scale's left-hand fingers are the right-hand ones read backwards: C major RH 1 2 3 1 2 3 4 5, LH 5 4 3 2 1 3 2 1), up and down alike, so both hand cards always show the finger of the note being taught.
  const pitchK = idx >= 0 ? upBase.findIndex(q => q.m === seq[idx].m) : -1, otherF = pitchK >= 0 ? (otherUp && otherUp[pitchK] ? (otherUp[pitchK].f || 0) : (upBase[upBase.length - 1 - pitchK].f || 0)) : 0;
  const tap = (m: number) => { try { playPianoNote(nameOf(m), 0.7, 1); } catch (e) {} if (playing) return; if (m === seq[idx].m) {
      if (idx + 1 >= seq.length) {   // one full round done: a short word of praise with the honest count of slips, no reward attached
        setRounds(r => r + 1);
        setPraise(misses === 0 ? T.perfect : T.done.replace("{n}", String(misses)));
        setTimeout(() => setPraise(null), 2600); setMisses(0);
      }
      setNext((idx + 1) % seq.length);
    } else { setBad(m); setMisses(x => x + 1); setTimeout(() => setBad(-1), 350); }
  };
  const staffIdx = idx < 0 ? -1 : both ? idx : idx;
  const inSeq = new Set(seq.map(s => s.m)); const fmap: Record<number, number | null> = {}; for (const q of seq) if (fmap[q.m] == null) fmap[q.m] = q.f;   // the finger to use on each taught key
  const litBlack = litM >= 0 && NAMES[litM % 12].length > 1, litW = litM >= 0 ? (litBlack ? wIndex(litM - 1) + 1 - 0.3 : wIndex(litM)) : 0, runLeft = litW * wW, runW = litBlack ? wW * 0.6 : wW;   // the orange running light sits on the key being taught and glides to the next
  return createPortal(
    <div className={"ost" + (portrait ? " rot" : "")} data-idx={idx} role="dialog" aria-label="octave practice">
      <div className="ost-top">
        <span className="ost-keywrap"><button type="button" className={"ost-title ost-titlebtn" + (kind0 ? "" : " plain")} data-keybtn="1" disabled={!kind0} aria-expanded={keysOpen} onClick={() => setKeysOpen(o => !o)}>{label}{kind0 ? " ▾" : ""}</button>
          {keysOpen && kind0 && (<><div className="ost-keyback" onClick={() => setKeysOpen(false)} /><div className="ost-keys" role="listbox" data-keys="1">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(pc => rootLabel(pc, kind0.type)).map((nm, pc) => <button key={pc} type="button" role="option" aria-selected={pc === curPc} data-pc={pc} className={"ost-keyb" + (pc === curPc ? " on" : "")} onClick={() => { clearInterval(timer.current); setPlaying(false); setCur(-1); setNext(0); setPickPc(pc); setKeysOpen(false); }}>{nm}</button>)}</div></>)}</span><span className="ost-oct" role="group" aria-label="octaves">{[1, 2, 3, 4].map(n => <button key={n} type="button" className={"ost-octb" + (n === octaves ? " on" : "")} aria-pressed={n === octaves} data-oct={n} onClick={() => { if (n !== octaves) { clearInterval(timer.current); setPlaying(false); setCur(-1); setNext(0); setOctaves && setOctaves(n); } }}>{n}×</button>)}</span>
        <button className="ost-btn" onClick={() => setHand(hand === "left" ? "right" : "left")}>{hand === "left" ? T.left : T.right} ⇄</button>
        {onPractice && <button className="ost-btn ost-prac" onClick={() => { clearInterval(timer.current); setPlaying(false); (window as any).__octKeepFs = true; setTimeout(() => { (window as any).__octKeepFs = false; }, 3000); (() => { const names = upBase.map((q: any) => nameOf(q.m)); if (sp) { const map: Record<string, string> = {}; Object.keys(sp).forEach(k => { const e = sp[+k]; map[NAMES[+k]] = "CDEFGAB"[e.L] + (e.acc === 1 ? "♯" : e.acc === -1 ? "♭" : e.acc === 2 ? "x" : e.acc === -2 ? "♭♭" : ""); }); setDisplaySpelling({ sig: names.slice(0, 8).join(), n: 8, map }); } else setDisplaySpelling(null); })(); onPractice({ notes: upBase.map((q: any) => nameOf(q.m)), fingers: upBase.map((q: any) => q.f), mode: "scale", key: null, label: (label || "Scale") + " · " + octaves + " " + (lang === "th" ? "ออกเตฟ" : lang === "zh" ? "个八度" : "octaves") }); }}>{lang === "th" ? "ฝึก" : lang === "zh" ? "练习" : "Practice"}</button>}
        <button className="ost-btn" onClick={() => { clearInterval(timer.current); setPlaying(false); setCur(-1); setNext(0); setBoth(!both); }} aria-pressed={both}>{both ? "↑↓" : "↑"}</button>
        <button className="ost-btn go" onClick={run}>{playing ? "⏸ " + T.stop : "▶ " + T.play}</button>
        <button className="ost-btn" onClick={onClose} aria-label={T.close}>✕</button>
      </div>
      <div className="ost-hands">
        {(["left", "right"] as const).map(h => (
          <div key={h} className={"ost-hand" + (hand === h ? " act" : "")} onClick={() => setHand(h)}>
            <FingerHand finger={hand === h ? (finger || 0) : otherF} hand={h} />
            <span>{h === "left" ? T.left : T.right}</span>
          </div>
        ))}
        {(() => { const start = Math.floor(Math.max(0, staffIdx) / 16) * 16, here = staffIdx - start; return (
          <div className="ost-card"><StaffCard notes={staffSeq.slice(start, start + 16)} active={here >= 0 && here < 16 ? here : -1} title={"bars " + (start / 4 + 1) + "-" + (start / 4 + 4)} bass={hand === "left"} sp={sp} /></div>); })()}
      </div>
      <div className="ost-kbwrap">
        <div className="ost-kb">
          {whites.map(m => <button key={m} className={"ow" + (m === litM ? " lit" : inSeq.has(m) ? " in" : "") + (m === bad ? " bad" : "")} style={{ left: wIndex(m) * wW + "%", width: wW + "%" }} onClick={() => tap(m)} aria-label={nameOf(m)}>{fmap[m] != null && <b className="fn">{fmap[m]}</b>}<i>{NAMES[m % 12] === "C" ? nameOf(m) : NAMES[m % 12]}</i></button>)}
          {blacks.map(m => { const w = wIndex(m - 1); return <button key={m} className={"ob" + (m === litM ? " lit" : inSeq.has(m) ? " in" : "") + (m === bad ? " bad" : "")} style={{ left: (w + 1) * wW - wW * 0.3 + "%", width: wW * 0.6 + "%" }} onClick={() => tap(m)} aria-label={nameOf(m)}>{fmap[m] != null && <b className="fn">{fmap[m]}</b>}</button>; })}
          {litM >= 0 && <div className="ost-run" style={{ left: runLeft + "%", width: runW + "%" }} />}
        </div>
      </div>
      {praise && <div className="ost-praise" role="status">{praise}</div>}
      <div className="ost-hint">{T.tap}{rounds > 0 ? " · " + T.round + " " + rounds : ""}</div>
    </div>,
    document.body
  );
}
export const OCTAVE_CSS = `
.ost{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;gap:10px;padding:12px calc(14px + env(safe-area-inset-right,0px)) 10px env(safe-area-inset-left,0px);background:var(--bg,#fff);color:var(--text,#222);font-family:var(--f-app,system-ui)}
.ost.rot{inset:auto;top:0;left:100vw;width:100vh;height:100vw;transform-origin:top left;transform:rotate(90deg)}
.ost-top{padding-left:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ost-title{font-size:18px}.ost-keywrap{position:relative;display:inline-block}.ost-titlebtn{font:inherit;font-weight:800;border:0;background:transparent;color:var(--text,#222);padding:4px 6px;border-radius:12px;cursor:pointer}.ost-titlebtn.plain{cursor:default}.ost-keyback{position:fixed;inset:0;z-index:5}.ost-keys{position:absolute;left:0;top:100%;z-index:6;margin-top:6px;display:grid;grid-template-columns:repeat(6,48px);gap:6px;padding:10px;background:var(--card,#fff);border:1.5px solid var(--bd2,#e3ddd2);border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.18)}.ost-keyb{height:44px;border-radius:999px;border:1.5px solid var(--bd2,#e3ddd2);background:var(--card2,#f6f2ea);color:var(--text,#222);font-weight:800;font-size:15px;cursor:pointer}.ost-keyb.on{background:var(--clay,#d97757);border-color:var(--clay,#d97757);color:#fff}.ost-oct{display:inline-flex;gap:4px}.ost-octb{min-width:40px;height:36px;border-radius:999px;border:1.5px solid var(--bd2,#e3ddd2);background:var(--card,#fff);color:var(--text2,#555);font-weight:800;font-size:15px;cursor:pointer}.ost-octb.on{background:var(--clay,#d97757);border-color:var(--clay,#d97757);color:#fff}
.ost-notes{flex:1;display:flex;flex-wrap:wrap;gap:4px;min-width:140px}.ost-notes span{padding:3px 7px;border-radius:999px;background:var(--card2,#f3f3f3);font-size:12px;font-weight:700}.ost-notes span.on{background:var(--clay,#d97757);color:#fff}
.ost-btn{min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid var(--bd3,rgba(0,0,0,.2));background:var(--card,#fff);color:var(--text);font-weight:800;cursor:pointer}.ost-btn.go{background:var(--clay,#d97757);color:#fff;border-color:transparent}
.ost-hands{flex:1;min-height:0;display:flex;gap:10px;justify-content:flex-start;align-items:stretch}.ost-hand{flex:0 0 112px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px;border-radius:18px;background:var(--card,#fff);border:1.5px solid var(--bd2,rgba(0,0,0,.12));opacity:.55;cursor:pointer;overflow:hidden}.ost-hand.act{opacity:1;border-color:var(--clay,#d97757)}.ost-hand span{font-size:11px;font-weight:800}.ost-hand svg{max-height:78%;width:auto;max-width:100%}
.tstaff{margin:8px 0;padding:6px 8px;border-radius:18px;background:var(--card,#fff);border:1.5px solid var(--bd2,#e3ddd2)}.tstaff .ost-staff{width:100%;height:auto;display:block;color:var(--text,#222)}.ost-prac{background:#d97757;color:#fff;border-color:#d97757;font-weight:800;padding:0 16px}.ost-card{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;border-radius:18px;background:var(--card,#fff);border:1.5px solid var(--bd2,rgba(0,0,0,.12));color:var(--text,#222);padding:2px 6px;overflow:hidden}.ost-staff{width:100%;height:100%;max-height:100%}
.ost-kbwrap{flex:1;min-height:0;display:flex}.ost-kb{position:relative;flex:1;border-radius:14px;overflow:hidden;background:#111}
.ost-kb .ow{position:absolute;top:0;bottom:0;border:1px solid #888;border-top:0;background:#fff;border-radius:0 0 8px 8px;padding:0;cursor:pointer;display:flex;align-items:flex-end;justify-content:center}.ost-kb .ow i{font-style:normal;font-size:11px;font-weight:700;color:#666;margin-bottom:6px}
.ost-kb .ow.in{background:#fde7de}.ost-kb .ow.lit{background:#ff9a5a;box-shadow:inset 0 0 18px rgba(217,119,87,.9)}.ost-kb .ow.lit i{color:#fff}
.ost-kb .ob{position:absolute;top:0;height:60%;background:#1b1b1b;border:0;border-radius:0 0 6px 6px;z-index:2;cursor:pointer}.ost-kb .ob.in{background:#a8543a}.ost-kb .ob.lit{background:#ff7a2a;box-shadow:0 0 14px #ff7a2a}
.ost-kb .ow.bad{background:#ffb4b4!important}.ost-kb .ob.bad{background:#c0392b!important}
.ost-kb .fn{position:absolute;left:50%;bottom:30px;transform:translateX(-50%);min-width:22px;height:22px;line-height:22px;border-radius:50%;background:#fff;color:#c4562f;font-size:13px;font-weight:900;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.3);pointer-events:none}.ost-kb .ob .fn{bottom:8px;background:#ff9a5a;color:#fff}.ost-kb .lit .fn{background:#c4562f;color:#fff;min-width:30px;height:30px;line-height:30px;font-size:17px;bottom:34px;box-shadow:0 0 12px rgba(255,255,255,.9)}
.ost-run{position:absolute;top:0;height:8px;z-index:3;background:linear-gradient(90deg,#ffb36b,#ff6a1f);border-radius:0 0 8px 8px;box-shadow:0 0 18px 4px rgba(255,122,42,.85);transition:left .16s ease-out,width .16s ease-out;pointer-events:none}
@media (prefers-reduced-motion:reduce){.ost-run{transition:none}}
.ost-praise{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);background:var(--clay,#d97757);color:#fff;font-weight:800;padding:10px 20px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:5;pointer-events:none}
.ost-hint{font-size:12px;color:var(--muted,#777);text-align:center}
`;

/** The names of a one-octave scale as a score spells them (D♭ in a flat key, F♯ in a sharp key); plain sharps for anything that is not a recognised major/minor scale. */
export function spellNames(notes: { note: string }[]): string[] {
  const k = scaleKind(notes), sp = k ? spellScale(k.pc, k.type) : null;
  return notes.map(p => { const m = midiOf(p.note); if (m == null) return p.note.replace(/[0-9]/g, ""); const e = sp && sp[m % 12]; if (!e) return NAMES[m % 12]; return "CDEFGAB"[e.L] + (e.acc === 1 ? "♯" : e.acc === -1 ? "♭" : e.acc === 2 ? "x" : e.acc === -2 ? "♭♭" : ""); });
}

/** The lesson on a five-line staff for the portrait Teacher page: two bars of four quarter notes, paging to the next two when the lit note moves on, the lit note in orange (real time, like the octave page). */
export function TeacherStaff({ notes, litNote }: { notes: { note: string }[]; litNote: string | null }) {
  const ms = useMemo(() => notes.map(p => midiOf(p.note)).filter((m): m is number => m != null), [notes]);
  const k = useMemo(() => scaleKind(notes), [notes]), sp = useMemo(() => (k ? spellScale(k.pc, k.type) : null), [k]);
  const lit = litNote ? midiOf(litNote) : null, at = lit == null ? -1 : ms.indexOf(lit);
  const page = at >= 0 ? Math.floor(at / 8) : 0, slice = ms.slice(page * 8, page * 8 + 8).map(m => ({ m }));
  if (ms.length < 2) return null;
  return (<div className="tstaff" data-tstaff="1"><StaffCard notes={slice} active={at >= 0 && at >= page * 8 && at < page * 8 + 8 ? at - page * 8 : -1} title="staff" sp={sp} count={8} /></div>);
}
