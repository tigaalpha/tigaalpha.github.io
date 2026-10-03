#!/usr/bin/env node
/* smoke-chat-coach.mjs — pins chat-coach.ts's rules with fixtures.
     node tigamodel/scripts/smoke-chat-coach.mjs

   The one rule that must never break: a quiz the app cannot answer correctly
   is WORSE than no quiz, because it teaches the wrong note. So most of the
   checks here are about things that must NOT become a quiz:
     - fewer than three distinct octave-qualified notes → no question
     - a [?…] line with no marked answer → no question
     - two identical options → no question (that is a coin flip, not a check)
     - bare note letters without an octave → never used
   And on top of that: the answer index must actually point at the right note
   when the app derives the question itself. */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);

const STUBS = {
  "./i18n": `export function tr(x, lang) { return (x && (x[lang] || x.en)) || ""; }`,
};
const r = await build({
  entryPoints: [path.join(ROOT, "chat-coach.ts")],
  bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent",
  outdir: path.join(ROOT, "node_modules/.cache"),
  plugins: [{
    name: "stub",
    setup(b) {
      b.onResolve({ filter: /^\.\/i18n$/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path] || "export const tr=()=>'';", loader: "js" }));
    },
  }],
});
const out = path.join(ROOT, "node_modules/.cache", `chat-coach-smoke-${process.pid}.mjs`);
fs.writeFileSync(out, r.outputFiles[0].text);
const M = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${detail ? " — " + detail : ""}`); }
};

const TH = "th";

// ── 1. the model's own [? … ] line is used when it is well-formed ──
const wellFormed = "เสียงที่ 3 ในคีย์ C คือ G\n[? โน้ตที่ 3 คืออะไร | C4 | E4 | ✓ G4]";
const a1 = M.askQuestionOf(wellFormed, TH);
check("model quiz line is used", !!a1 && a1.source === "model");
check("model quiz keeps the question", !!a1 && a1.q.includes("โน้ตที่ 3"), a1 && a1.q);
check("model quiz marks the right answer", !!a1 && a1.opts[a1.answer] === "G4", a1 && JSON.stringify(a1.opts));
check("model quiz strips the tick off the option", !!a1 && a1.opts.every((o) => !/[✓✔✅|]/.test(o)), a1 && JSON.stringify(a1.opts));
check("model quiz has three distinct options", !!a1 && new Set(a1.opts).size === 3);

// ── 2. a malformed [?…] line must NOT become a quiz ──
check("no marked answer → no quiz", M.askQuestionOf("อธิบายเสียงที่ 3\n[? โน้ตที่ 3 คืออะไร | C4 | E4 | G4]", TH) === null);
check("duplicate options → no quiz", M.askQuestionOf("x\n[? q | C4 | C4 | G4 ✓]", TH) === null);
check("empty option → no quiz", M.askQuestionOf("x\n[? q | C4 |  | G4 ✓]", TH) === null);
check("only two options → no quiz", M.askQuestionOf("x\n[? q | C4 | ✓ G4]", TH) === null);
// prose WITH octave-qualified notes DOES produce a derived check on purpose —
// that is the feature. Prose without them does not.
check("prose with no octave notes is never a quiz", M.askQuestionOf("คีย์ C ประกอบด้วยเสียง เอ ซี จี ซึ่งง่ายมาก", TH) === null);
check("an empty answer is never a quiz", M.askQuestionOf("", TH) === null);

// ── 3. the app derives the check from note names the tutor wrote ──
const a2 = M.askQuestionOf("คีย์ C เมเจอร์คือ C4 E4 G4", TH);
check("notes alone produce a check", !!a2 && a2.source === "note");
check("derived check asks about the 3rd note", !!a2 && a2.q.includes("3"), a2 && a2.q);
check("derived check's answer is the 3rd note", !!a2 && a2.opts[a2.answer] === "G4", a2 && JSON.stringify(a2 && a2.opts));
check("derived check has three options", !!a2 && a2.opts.length === 3);
check("derived check options are distinct", !!a2 && new Set(a2.opts).size === 3, a2 && JSON.stringify(a2 && a2.opts));

// the whole point: the answer must be a FACT
check("derived check answers from the same answer", !!a2 && a2.opts.every((o) => /^[A-G]#?-?\d$/.test(o)), a2 && JSON.stringify(a2 && a2.opts));
check("four notes still ask a real one", (() => { const a = M.askQuestionOf("สเกล C: C4 D4 E4 F4 G4", TH); return !!a && a.opts[a.answer] === "E4"; })());
check("exactly three notes works", (() => { const a = M.askQuestionOf("คอร์ด A minor: A3 C4 E4", TH); return !!a && a.opts[a.answer] === "E4"; })());

// ── 4. two notes is not enough to make a real choice ──
check("two notes → no quiz", M.askQuestionOf("คอร์ดนี้มี C4 และ E4", TH) === null);
check("one note → no quiz", M.askQuestionOf("เล่นโน้ต C4", TH) === null);

// ── 5. bare letters without an octave are ambiguous and must be ignored ──
check("bare letters → no quiz", M.askQuestionOf("C E G B D F A เป็นโน้ตในคีย์ C", TH) === null);
check("no octave on two of them → no quiz", M.askQuestionOf("C4 E G B", TH) === null);

// ── 6. a repeated note is one note, not two options ──
check("a repeated note does not create a choice", (() => {
  const a = M.askQuestionOf("คอร์ด C: C4 E4 G4 C4", TH);
  return !!a && new Set(a.opts).size === 3;
})(), (() => { const a = M.askQuestionOf("คอร์ด C: C4 E4 G4 C4", TH); return a && JSON.stringify(a.opts); })());

// ── 7. enharmonics stay distinct but the set must still be three ──
check("sharps parse and answer correctly", (() => {
  const a = M.askQuestionOf("F# major: F#3 G#3 A#3", TH);
  return !!a && a.opts[a.answer] === "A#3";
})());
check("flats parse and answer correctly", (() => {
  const a = M.askQuestionOf("Eb major: Eb4 F4 G4", TH);
  return !!a && a.opts[a.answer] === "G4";
})());

// ── 8. the quiz line is stripped from what the learner reads ──
const split = M.splitAskLine(wellFormed);
check("quiz line removed from the visible text", !split.text.includes("[?"), JSON.stringify(split.text));
check("the explanation above it survives", split.text.includes("เสียงที่ 3"));
check("split reports that it removed something", split.had === true);
const noQ = M.splitAskLine("แค่คำตอบธรรมดา");
check("nothing removed when there is no quiz line", noQ.had === false && noQ.text === "แค่คำตอบธรรมดา");

// ── 9. the model's line wins over the derived one ──
const both = "คีย์ C คือ C4 E4 G4\n[? จำได้ไหม | ✓ C4 | E4 | G4]";
const a3 = M.askQuestionOf(both, TH);
check("the model's own line wins", !!a3 && a3.source === "model" && a3.opts[a3.answer] === "C4");

// ── 10. the quiz is optional — a long answer with no notes and no line gets none ──
check("a long prose answer gets no quiz", M.askQuestionOf("คีย์ประสานคือการจัดเรียงเสียงให้เข้ากันอย่างมีเหตุผล ซึ่งช่วยให้เพลงมีอารมณ์และความเคลื่อนไหว", TH) === null);

// ── 11. next action: only when the answer is actually about doing ──
check("ear question gets the ear button", (() => { const a = M.nextActionOf("ลองฝึกการได้ยินช่วงครึ่งเสียงด้วยหู", TH); return !!a && a.key === "ear"; })());
check("sight-reading question gets the read button", (() => { const a = M.nextActionOf("อย่าลืมอ่านโน้ตบนโน้ตเปียโน", TH); return !!a && a.key === "read"; })());
check("practice question gets the play button", (() => { const a = M.nextActionOf("ลองซ้อมดริลนี้ทีละมือ", TH); return !!a && a.key === "play"; })());
check("a pure history answer gets no action", M.nextActionOf("บาโรกเกิดราว ค.ศ. 1600 ในอิตาลี", TH) === null);
// the step MUST be a key handleCoachNavigate really knows (App.tsx), or the
// button drops the learner on the pathway list instead of into the drill
check("every action step is a real navigation key", ["ear_training", "sight_reading", "reading_course", "play_along", "hand_coach"].includes(M.nextActionOf("ลองฝึกหูด้วย ear training", TH).step));
check("ear step is ear_training", M.nextActionOf("ฟังด้วยหูว่าเป็นเสียงอะไร", TH).step === "ear_training");
check("read step is sight_reading", M.nextActionOf("อย่าลืมอ่านโน้ตบน staff ที่มี clef", TH).step === "sight_reading");
check("play step is play_along", M.nextActionOf("ลองซ้อมดริลนี้ด้วยการเล่นจริง", TH).step === "play_along");
check("an ear question wins over the generic practice word", M.nextActionOf("ลองซ้อมฝึกหูเรื่องช่วงครึ่งเสียง", TH).step === "ear_training");
check("no action step is ever 'practice' (not a real key)", !["practice", "pathway", ""].includes(M.nextActionOf("ลองซ้อม", TH).step));
check("an action label is in the learner's language", (() => {
  const th = M.nextActionOf("ลองซ้อมดริล", TH), en = M.nextActionOf("try practising this drill", "en");
  return !!th && !!en && th.label !== en.label;
})());

// ── 12. all three languages answer ──
for (const lang of ["th", "en", "zh"]) {
  const a = M.askQuestionOf("C major: C4 E4 G4", lang);
  check(`derived check works in ${lang}`, !!a && a.q.length > 0 && a.opts.length === 3);
}

console.log(`\n${pass}/${pass + fail} passed`);
fs.rmSync(out, { force: true });
process.exit(fail ? 1 : 0);