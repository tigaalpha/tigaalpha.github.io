// smoke-learner-signal.mjs — proves the ONE decision unit both Daily Mentor
// and Auto-Teaching read (learner-signal.ts) cannot guess, drift, or disagree.
//
// WHY this exists: the coaching popup and the Mentor page answered the same
// question ("what should I practise now?") from two different localStorage
// keys, so a learner could be told two contradictory things at once. The fix is
// one pure module both read. A pure module is only worth anything if the honesty
// rules are pinned down by a test, which is what this file is — it transpiles
// the REAL source with esbuild and imports the REAL exports, never a
// hand-mirrored copy.
//
// Rules under test (docs/18 §P1):
//   no data → null · <8 attempts → score null · <4 attempts → no topic
//   confidence < 0.5 must not move a level · deterministic · 3 sources of
//   evidence ranked hardest-first · no repeat inside 24h · free quota = 2/day
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "smoke-signal-"));
await build({
  entryPoints: [new URL("../../learner-signal.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", outfile: join(dir, "signal.mjs"),
});
const S = await import(pathToFileURL(join(dir, "signal.mjs")).href);
rmSync(dir, { recursive: true, force: true });

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}`); } };

console.log("smoke-learner-signal — หน่วยตัดสินใจเดียวของครู\n");

const DAY = 86400000;
const NOW = 1767225600000; // fixed clock — every case below is deterministic
// one act-log entry: kind, id, ok, miss, age in days
const ev = (k, id, ok, miss, ageDays = 0, skill = null) => {
  const e = { t: NOW - ageDays * DAY, d: "x", k, id, ok, miss, sec: 60 };
  if (skill) e.skill = skill;
  return e;
};
const labelOf = e => `${e.k}:${e.id}`;
const sig = (o = {}) => S.learnerSignal({ now: NOW, log: [], struggles: [], ...o });

/* 1. nothing at all → no advice, and NOT a fabricated zero */
{
  const s = sig();
  t("no data at all → nextAction is null (no guessing)", s.nextAction === null);
  t("no data → minutes is null, not 0", s.minutes === null);
  t("no data → evidence is empty", Array.isArray(s.evidence) && s.evidence.length === 0);
  t("no data → all 7 skills report score null, not 0",
    s.skillScores.length === 7 && s.skillScores.every(x => x.score === null));
}

/* 2. skill scores keep the ≥8-attempt floor (the honest-null rule) */
{
  const seven = Array.from({ length: 7 }, (_, i) => ev("game", "s" + i, 1, 0));
  const eight = Array.from({ length: 8 }, (_, i) => ev("game", "s" + i, 1, 0));
  const s7 = sig({ log: seven }), s8 = sig({ log: eight });
  const n7 = s7.skillScores.find(x => x.skill === "note_accuracy");
  const n8 = s8.skillScores.find(x => x.skill === "note_accuracy");
  t("7 attempts → score stays null (ยังไม่พอข้อมูล)", n7.score === null && n7.n === 7);
  t("8 attempts → a real number appears (100%)", n8.score === 100 && n8.n === 8);
}

/* 3. a topic needs ≥4 attempts AND a real miss — a single slip is not a weakness */
{
  const oneMiss = [ev("game", "twinkle", 2, 1)];   // 3 tries, 1 miss
  const enough = [ev("game", "twinkle", 6, 4), ev("game", "twinkle", 5, 2, 1)];
  t("1 miss in only 3 tries → not a weakness yet (rule: ≥4 tries)", sig({ log: oneMiss, labelOf }).weakest === null);
  const w = sig({ log: enough, labelOf }).weakest;
  t("6 misses on 17 tries → topic with a real miss rate", !!w && w.rate === Math.round(6 / 17 * 100) && w.n === 17);
}

/* 4. hardest evidence wins, and the ranking is stable (no sort jitter) */
{
  const log = [
    ev("game", "a", 8, 2), ev("game", "a", 7, 3), ev("game", "a", 8, 2), ev("game", "a", 8, 2), // rate 21%
    ev("game", "b", 2, 8), ev("game", "b", 2, 8), ev("game", "b", 1, 9), ev("game", "b", 2, 8), // rate 82%
  ];
  const w = sig({ log, labelOf }).weakest;
  t("the higher miss-rate topic is chosen, not the first-seen one", w && w.label === "game:b" && w.rate === 83);
  t("same input → same topic every time (deterministic)",
    JSON.stringify(sig({ log, labelOf })) === JSON.stringify(sig({ log, labelOf })));
  t("input order does not change the decision",
    JSON.stringify(sig({ log, labelOf })) === JSON.stringify(sig({ log: [...log].reverse(), labelOf })));
}

/* 5. nextAction carries the evidence line the card must show (real numbers) */
{
  const log = [ev("game", "ode", 3, 9), ev("game", "ode", 4, 8), ev("game", "ode", 3, 9), ev("game", "ode", 4, 8)];
  const s = sig({ log, labelOf });
  const a = s.nextAction;
  t("nextAction has a stable id built from the topic", a.id === "topic:game:ode");
  t("nextAction points at the real destination (play_along for a song)", a.feature === "play_along");
  t("nextAction carries its own evidence numbers", a.evidence[0].n === 48 && a.evidence[0].miss === 34);
  t("minutes scale with the miss rate (>50% → 15)", a.minutes === 15);
  t("confidence is null rather than invented from the act log", a.confidence === null);
}

/* 6. the memory source is used only when the act log has nothing, and only
      while it is fresh (half-life 6d, expires at 21d) */
{
  const fresh = [{ label: "chord C", acc: 40, count: 3, last: NOW - DAY }];
  const stale = [{ label: "chord C", acc: 40, count: 3, last: NOW - 22 * DAY }];
  const a1 = sig({ struggles: fresh }).nextAction;
  const a2 = sig({ struggles: stale }).nextAction;
  t("a fresh struggle becomes the action when nothing else is known", a1 && a1.id === "struggle:chord C");
  t("a struggle older than 21 days is dropped (no stale advice)", a2 === null);
  t("act-log evidence outranks memory evidence", (() => {
    const both = sig({ log: [ev("game", "ode", 3, 9), ev("game", "ode", 4, 8), ev("game", "ode", 3, 9), ev("game", "ode", 4, 8)], struggles: fresh, labelOf });
    return both.nextAction.id === "topic:game:ode";
  })());
}

/* 7. the skill route: real score, real destination, honest confidence */
{
  // 12 ear-chord attempts at 40% → chord_knowledge 40/100, remappable to a tab
  const log = Array.from({ length: 12 }, (_, i) => ev("ear", "chord", 2, 3));
  const s = sig({ log, labelOf });
  const chord = s.skillScores.find(x => x.skill === "chord_knowledge");
  t("the chord tab feeds BOTH ear_training and chord_knowledge", chord.score === 40);
  const a = s.nextAction;
  t("with a topic-level weakness present, the topic wins over the skill route", a.id === "topic:ear:chord");

  // no topic evidence at all (no misses) → skill route with a real number
  const clean = Array.from({ length: 12 }, (_, i) => ev("ear", "chord", 2, 0));
  const s2 = sig({ log: clean, labelOf });
  const ear = s2.skillScores.find(x => x.skill === "ear_training");
  t("a clean run gives 100%, not a fabricated weakness", ear.score === 100);
  t("no weakness anywhere → nextAction stays null", s2.nextAction === null);
}

/* 8. drill plans: the honest level rules ride along unchanged */
{
  const ability = [{ skill_id: "note_accuracy", ability: 0.25, confidence: 0.8 },
                   { skill_id: "rhythm", ability: 0.9, confidence: 0.8 }];
  const drills = [{ id: "d3", skill_id: "note_accuracy", level: 3 },
                  { id: "r3", skill_id: "rhythm", level: 3 }];
  const p = sig({ ability, drills }).drillPlan;
  t("weakest skill + high confidence + low ability → ease one level",
    p && p.skill_id === "note_accuracy" && p.adjust === "ease" && p.level === 3 /* the pool's nearest level */);

  const unsure = [{ skill_id: "note_accuracy", ability: 0.25, confidence: 0.3 }];
  const p2 = sig({ ability: unsure, drills }).drillPlan;
  t("confidence below 0.5 → level does NOT move (observe, don't conclude)",
    p2 && p2.adjust === "hold" && p2.level === 3);

  t("no ability rows → drillPlan null, never a guessed level", sig({ drills }).drillPlan === null);
}

/* 9. one card, one popup: the 24h repeat window */
{
  t("a topic shown 2h ago → do not fire again", S.repeatWindowOpen([{ id: "topic:a", t: NOW - 2 * 3600e3 }], "topic:a", NOW) === true);
  t("the same topic 30h ago → may fire again", S.repeatWindowOpen([{ id: "topic:a", t: NOW - 30 * 3600e3 }], "topic:a", NOW) === false);
  t("a DIFFERENT topic is not blocked by the window", S.repeatWindowOpen([{ id: "topic:a", t: NOW }], "topic:b", NOW) === false);
  t("no id → never blocked, never crashes", S.repeatWindowOpen([], null, NOW) === false && S.repeatWindowOpen(null, "x", NOW) === false);
}

/* 10. the free daily quota the owner chose: 2 a day, then point at a plan */
{
  t("0 used → 2 left", JSON.stringify(S.freeQuotaState(0)) === JSON.stringify({ used: 0, cap: 2, left: 2, spent: false }));
  t("1 used → 1 left", S.freeQuotaState(1).left === 1);
  t("2 used → spent, and left can never go negative", S.freeQuotaState(2).spent === true && S.freeQuotaState(9).left === 0);
  t("garbage input cannot produce a negative quota", S.freeQuotaState(-5).left === 2 && S.freeQuotaState(undefined).left === 2);
}

/* 11. bad input is never a crash and never a decision */
{
  t("null/garbage in → null out", S.learnerSignal(null).nextAction === null && S.learnerSignal({ log: "nope" }).nextAction === null);
  t("malformed entries are ignored, not counted", S.skillScoresOf([null, {}, { k: "game" }], NOW).every(x => x.score === null));
  t("activities with no signal kind contribute nothing", S.skillsOfActivity({ k: "voice" }).length === 0);
  t("an explicit skill tag wins over the kind guess", JSON.stringify(S.skillsOfActivity({ k: "game", skill: "dynamics" })) === JSON.stringify(["dynamics"]));
}

/* 12. the hours scale the card promises */
{
  t("miss >50% → 15 min, 21-50% → 10, ≤20% → 5",
    S.minutesForMissRate(60) === 15 && S.minutesForMissRate(30) === 10 && S.minutesForMissRate(10) === 5);
}

/* 13. React #31 guard for the card that renders these fields.
   The crash the owner screenshotted was "objects are not valid as a React
   child": an i18n {th,en,zh} object reaching a JSX slot. The Mentor card draws
   nextAction.label / .stepText / .feature / .evidence numbers directly, so
   every one of them must be a string or a number — never an object, whatever
   junk the caller passes in as a label. */
{
  const ok = a => a && ["label", "feature", "stepText"].every(k => typeof a[k] === "string");
  const log = [ev("ear", "chord", 6, 4), ev("ear", "chord", 5, 5, 1), ev("ear", "chord", 6, 4, 2), ev("ear", "chord", 6, 4, 3)];
  t("topic action: only strings reach the JSX slots", ok(sig({ log, labelOf }).nextAction));
  t("struggle action: only strings reach the JSX slots", ok(sig({ struggles: [{ label: "chord C", acc: 40, count: 3, last: NOW - DAY }] }).nextAction));
  t("a labelOf that returns an OBJECT cannot reach the card as one",
    (() => {
      const a = sig({ log, labelOf: () => ({ th: "ก", en: "e", zh: "z" }) }).nextAction;
      return !a || typeof a.label === "string";
    })());
  t("evidence numbers are numbers, never NaN",
    sig({ log, labelOf }).evidence.every(e => e && Number.isFinite(e.n) && Number.isFinite(e.miss) && Number.isFinite(e.rate)));
}

/* 14. when the tip is allowed to appear (owner 2026-10-02: never on top of a
   game in progress — a card across the falling notes costs the learner the
   moment AND the tutor's credibility; it waits for the activity to end) */
{
  t("mid-song → defer, never send", S.atipDelivery({ blocked: true }) === "defer");
  t("when the activity ends → send", S.atipDelivery({ blocked: false }) === "send");
  t("an unread card is never covered by another", S.atipDelivery({ blocked: false, tipShown: true }) === "skip");
  t("an in-flight fetch is never doubled", S.atipDelivery({ blocked: false, busy: true }) === "skip");
  t("blocked AND unread → still skip (don't queue work behind an open card)",
    S.atipDelivery({ blocked: true, tipShown: true }) === "skip");
  t("no arguments at all → send (the old default: fire when nothing blocks)",
    S.atipDelivery() === "send");
}

console.log(`\n${pass} ผ่าน · ${fail} ไม่ผ่าน`);
process.exit(fail ? 1 : 0);