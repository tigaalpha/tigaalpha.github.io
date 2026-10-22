// smoke-learn-plan.mjs - pins learn-plan.ts (ranking, cause, tempo, before/after) on the REAL source.
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const dir = mkdtempSync(join(tmpdir(), "smoke-plan-"));
await build({ entryPoints: [new URL("../learn-plan.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", outfile: join(dir, "p.mjs") });
const P = await import(pathToFileURL(join(dir, "p.mjs")).href);
rmSync(dir, { recursive: true, force: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok  " + m); } else { fail++; console.log("  FAIL " + m); } };
const D = 86400000, now = Date.UTC(2026, 9, 22);
const row = (id, okN, miss, daysAgo, skill) => ({ t: now - daysAgo * D, k: "drill", id, ok: okN, miss, ...(skill ? { skill } : {}) });

// 1/2: an old heavy miss pile must not beat a fresh weak topic
const log = [row("Old Song", 20, 80, 60), row("Db Major", 5, 5, 1), row("Db Major", 4, 6, 0)];
const r = P.rankTopics(log, now);
ok(r[0].id === "Db Major", "fresh weak topic outranks a 60-day-old pile");
ok(P.rankTopics([row("X", 1, 2, 0)], now).length === 0, "under 4 tries = no topic (never guessed)");
// idle nudge: same accuracy, the one untouched for 14 days ranks first
const r2 = P.rankTopics([row("A", 6, 4, 14), row("B", 6, 4, 0)], now);
ok(r2[0].id === "A", "spaced-repetition nudge: the topic idle 14 days comes first");
ok(P.rankTopics(log, now).map(x => x.id).join() === P.rankTopics([...log].reverse(), now).map(x => x.id).join(), "input order does not matter");
// 4: cause
ok(P.causeOf(2, 8, 0.2) === "rhythm", "rhythm misses far above note misses = rhythm");
ok(P.causeOf(1, 2, 0.2) === "notes", "under 4 rhythm tries = notes (honest default)");
const c = P.rankTopics([row("Z", 5, 5, 0), row("Z", 3, 7, 0, "rhythm"), row("Z", 2, 8, 0, "rhythm")], now)[0];
ok(c.cause === "rhythm" && c.n === 10, "rhythm rows set the cause and do not inflate the note count");
// 3: tempo
ok(P.stepTempo(1, [50]) === 0.9, "poor round slows down 10%");
ok(P.stepTempo(0.8, [90, 92]) === 0.9, "two clean rounds speed up 10%");
ok(P.stepTempo(0.8, [70, 90]) === 0.8, "one clean round alone does not move it");
ok(P.stepTempo(0.5, [10]) === 0.5 && P.stepTempo(1, [95, 95]) === 1, "clamped to 0.5..1");
// 5: before/after
const fx = [1, 2, 3].map(i => ({ method: "slow", before: 40, after: 60 })).concat([{ method: "repeat", before: 50, after: 45 }]);
ok(P.fxSummary(fx).slow.avg === 20 && P.bestMethod(fx) === "slow", "best method is the one with a measured gain");
ok(P.bestMethod([{ method: "repeat", before: 1, after: 99 }]) === "slow", "fewer than 3 results = fallback, not a guess");
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
