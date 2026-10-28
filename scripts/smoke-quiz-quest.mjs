// quiz-quest.ts with the real source (no browser): only studied topics, a ladder that moves, teaching data, judging.
import { build } from "esbuild"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "qq-")), "m.mjs");
await build({ entryPoints: ["quiz-quest.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
const store = {}; globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const m = await import(out); let fail = 0;
const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
ok("nothing studied = basics only", m.nextQuestion("en", { done: [], rand }).q.topic === "basics");
ok("scale studied -> scale topics", m.learnedTopics(["scale"]).join() === "scale");
ok("triad + interval studied", m.learnedTopics(["triad", "interval"]).join() === "triad,interval");
// two learners, two different sets of topics
const topicsSeen = (done, lang = "en") => { const s = new Set(); for (let i = 0; i < 300; i++) for (const lvl of [1, 2, 3, 4, 5]) s.add(m.nextQuestion(lang, { done, level: lvl, rand }).q.topic); return [...s].sort().join(); };
ok("a scale-only learner is asked scale questions only", topicsSeen(["scale"]) === "scale", topicsSeen(["scale"]));
ok("a triad+interval learner never gets scale or sevenths", topicsSeen(["triad", "interval"]) === "interval,triad", topicsSeen(["triad", "interval"]));
ok("a learner of everything gets all four", topicsSeen(["scale", "triad", "interval", "seventh"]) === "interval,scale,seventh,triad");
// every generated question is answerable and teaches
let bad = 0, n = 0;
for (const lang of ["th", "en", "zh"]) for (const lvl of [1, 2, 3, 4, 5]) for (let i = 0; i < 120; i++) {
  const { q } = m.nextQuestion(lang, { done: ["scale", "triad", "interval", "seventh"], level: lvl, rand }); n++;
  const good = q.kind === "choice" ? q.opts.filter(o => o.ok).length === 1 && q.opts.length >= 2 : Array.isArray(q.ans) && q.ans.length >= 1;
  const teaches = q.teach && q.teach.lit.length >= 1 && q.teach.why.length > 8 && q.q.length > 8 && q.teach.lit.every(x => /^[A-G]#?\d$/.test(x));
  if (!good || !teaches) { bad++; if (bad < 4) console.log("  bad:", lang, lvl, JSON.stringify(q).slice(0, 200)); }
}
ok("every question (th/en/zh, levels 1-5) has exactly one right choice or a key answer, and teaches", bad === 0, `${n} checked`);
// judging
const q1 = { kind: "key", ans: [0, 1, 3] }, q2 = { kind: "keys", ans: [0, 4, 7] };
ok("a 'key' question accepts any of its answers", m.judgeKeys(q1, [3]) && m.judgeKeys(q1, [1]) && !m.judgeKeys(q1, [2]));
ok("a 'keys' question needs exactly the set", m.judgeKeys(q2, [7, 0, 4]) && !m.judgeKeys(q2, [0, 4]) && !m.judgeKeys(q2, [0, 4, 7, 9]));
// notes outside a scale: every such pc is right
let sawNotIn = false, build8 = 0, minorSeen = false;
for (let i = 0; i < 600; i++) { const { q } = m.nextQuestion("en", { done: ["scale", "natural_minor", "harmonic_minor", "melodic_minor"], level: 3, rand }); if (q.id === "notin") sawNotIn = true; if (q.id === "build" && q.ans.length === 7 && m.judgeKeys(q, q.ans)) build8++; if (q.id === "build" && /minor/.test(q.label)) minorSeen = true; }
ok("the odd-one-out 'NOT in the scale' question is retired", !sawNotIn);
ok("a scale learner is asked to tap every note (7 pitch classes), incl. minors they learned", build8 > 50 && minorSeen);
let majOnly = true; for (let i = 0; i < 300; i++) { const { q } = m.nextQuestion("en", { done: ["scale"], level: 3, rand }); if (q.id === "build" && /minor/.test(q.label)) majOnly = false; }
ok("a learner who only studied scales gets no minor scale question", majOnly);
// ladder
store["tg_adv_quiz"] = undefined; delete store["tg_adv_quiz"];
let l = m.readLadder(); ok("starts at level 1", l.lvl === 1);
for (let i = 0; i < 3; i++) l = m.recordAnswer(true, "scale"); ok("3 right in a row = level 2", l.lvl === 2);
l = m.recordAnswer(false, "scale"); l = m.recordAnswer(false, "scale"); ok("2 wrong in a row = back to level 1", l.lvl === 1);
for (let i = 0; i < 40; i++) l = m.recordAnswer(true, "scale"); ok("the ladder stops at level 5", l.lvl === 5);
// weak topics get asked more
store["tg_adv_weak"] = JSON.stringify({ triad: 6 }); let triad = 0, tot = 0; seed = 11;
for (let i = 0; i < 400; i++) { const { q } = m.nextQuestion("en", { done: ["scale", "triad"], level: 2, rand }); tot++; if (q.topic === "triad") triad++; }
ok("a missed topic is asked more often", triad / tot > 0.55, `${Math.round(100 * triad / tot)}% triad`);
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
