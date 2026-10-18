/* class-teacher.ts (My Class's teacher), real file via esbuild: the foundation path reads evidence only, the week and the trend are honest,
   and the note says the right thing for a new learner, a returning one and one who practised today. No browser, no network. */
import { build } from "esbuild"; import { pathToFileURL } from "node:url"; import path from "node:path"; import os from "node:os"; import fs from "node:fs";
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ct-")), "ct.mjs");
await build({ entryPoints: ["class-teacher.ts"], outfile: out, bundle: true, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href);
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const NOW = new Date(2026, 9, 17, 12, 0, 0).getTime(), DAY = 86400000;
const e = (k, id, daysAgo, ok_ = 0, miss = 0, sec = 60) => ({ t: NOW - daysAgo * DAY, k, id, ok: ok_, miss, sec });
// path
let p = M.foundationPath([], []); ok("seven steps", p.steps.length === 7); ok("no data: first step current, none done", p.current.id === "hands" && p.doneN === 0 && !p.finished);
p = M.foundationPath([e("camera", "hand_coach", 1), e("game", "twinkle", 1)], []); ok("evidence ticks hands and song, current is ear", p.doneN === 2 && p.current.id === "ear");
p = M.foundationPath([e("ear", "int", 1), e("read", "L1", 1), e("camera", "hand_coach", 1), e("game", "x", 1)], ["scale"]); ok("scale step needs BOTH stages", p.current.id === "scale");
p = M.foundationPath([e("ear", "int", 1), e("read", "L1", 1), e("camera", "hand_coach", 1), e("game", "x", 1)], ["scale", "interval", "triad", "seventh", "progression"]); ok("everything done = finished", p.finished && p.current === null && p.doneN === 7);
// week
let w = M.weekStats([], NOW); ok("empty log: no days, no minutes, sinceDays null", w.daysN === 0 && w.minutes === 0 && w.sinceDays === null && w.accNow === null);
w = M.weekStats([e("drill", "a", 0, 8, 2, 120), e("drill", "a", 2, 9, 1, 180), e("drill", "a", 20, 1, 9, 60)], NOW); ok("three days counted, twenty days ago is not this week", w.daysN === 2 && w.practicedToday && w.minutes === 5, JSON.stringify({ n: w.daysN, m: w.minutes }));
ok("fewer than ten graded attempts this week = no accuracy quoted", M.weekStats([e("drill", "a", 0, 3, 1)], NOW).accNow === null);
// note
const note = (log, streak = 0, allDone = false) => M.teacherNote({ log, streak, allDone, now: NOW, track: M.foundationPath(log, []) }, "en");
ok("new learner is welcomed", note([]).tone === "new" && /Welcome/.test(note([]).hello));
ok("three days away = comeback with no guilt", (() => { const n = note([e("drill", "a", 5, 5, 1)]); return n.tone === "comeback" && /fine/.test(n.line) && /5 days/.test(n.line); })());
ok("practised today = praise and days left", (() => { const n = note([e("drill", "a", 0, 5, 1)]); return n.tone === "done" && /3 to go/.test(n.line); })());
ok("goal met says so", (() => { const n = note([0, 1, 2, 3].map(i => e("drill", "a", i, 5, 1))); return n.tone === "done" && /goal/.test(n.line) && !/to go/.test(n.line); })());
ok("a streak of 3+ is named", (() => { const n = note([e("drill", "a", 1, 5, 1)], 5); return n.tone === "streak" && /5 days in a row/.test(n.hello); })());
ok("trend: up", (() => { const log = [e("drill", "a", 1, 18, 2), e("drill", "a", 9, 10, 10)]; const n = note(log); return n.trend && /up from 50%/.test(n.trend); })());
ok("trend: down is gentle, not scolding", (() => { const log = [e("drill", "a", 1, 10, 10), e("drill", "a", 9, 18, 2)]; const n = note(log); return n.trend && /No worry/.test(n.trend); })());
ok("trend is silent without two weeks of data", note([e("drill", "a", 1, 18, 2)]).trend === null);
for (const l of ["th", "zh"]) { const n = M.teacherNote({ log: [], track: M.foundationPath([], []) }, l); ok(l + ": note is written in that language", n.hello && (l === "th" ? /[฀-๿]/ : /[一-鿿]/).test(n.hello + n.line)); }
const all = JSON.stringify(M.FOUNDATION) + JSON.stringify(note([])); ok("the word Berklee appears nowhere in the copy", !/berkl/i.test(all));
// daily foundation patch follows the learner's own data
{ const now = Date.now(), mk = (k, ok, miss, ago) => ({ t: now - ago * 86400000, d: "x", k, id: k, ok, miss, sec: 60 });
  const log = [mk("ear", 2, 8, 0), mk("read", 9, 1, 0), mk("game", 8, 2, 0), { t: now, d: "x", k: "x", id: "hand_coach" }];
  const tr = M.foundationPath(log, ["scale", "interval", "triad", "seventh", "progression"]), st = M.patchStats(log, now);
  const a = M.dailyPatch(tr, 0, st), b = M.dailyPatch(tr, 1, st);
  ok("the weakest area (ear, 80% missed) leads the patch", a && a.id === "ear" && /80%/.test(a.why2.en), a && a.id);
  ok("the patch changes from one day to the next", b && b.id !== a.id, b && b.id);
  ok("no evidence: falls back to the rotation, never invents a rate", !M.dailyPatch(M.foundationPath([], []), 0, {}).why2); }
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
