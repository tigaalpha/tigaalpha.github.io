// smoke-learning-wire.mjs — proves the gate that decides whether the learning
// trace is written at all.
//
// WHY this exists: for a month the live tables learning_observations /
// diagnoses / interventions / practice_events were all exactly 0 while
// learning_sessions had 160 rows. The cause was one line in learning-data.ts:
//   return !!(sb && sb.auth && sb.auth._sessionReady && sb.auth._sessionReady())
// `sb.auth._sessionReady` does not exist in @supabase/supabase-js 2.x, so the
// expression short-circuited to false and every gated write returned null
// BEFORE the network — silently, because §20 says teaching must never crash.
//
// The rules now live in learning-session-gate.ts (pure, no imports) precisely
// so they can be tested without a browser, a network, or a database. This
// smoke transpiles the REAL source file with esbuild and imports the REAL
// exports — it never re-implements them.
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "smoke-wire-"));
await build({
  entryPoints: [new URL("../../learning-session-gate.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", outfile: join(dir, "gate.mjs"),
});
const { shouldAttemptWrite, shouldDropQueue, userFromSession } = await import(pathToFileURL(join(dir, "gate.mjs")).href);
rmSync(dir, { recursive: true, force: true });

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}`); } };

console.log("smoke-learning-wire — the gate that had silently swallowed every trace\n");

/* 1. the regression itself: an unknown auth state must NOT block the write.
   (The old `_sessionReady()` probe answered "signed out" for everyone.) */
t("unknown auth state still attempts the write (RLS decides, not the client)",
  shouldAttemptWrite(undefined) === true);
t("a known signed-out state does not attempt the write",
  shouldAttemptWrite(null) === false);
t("a known signed-in state attempts the write",
  shouldAttemptWrite("11111111-2222-3333-4444-555555555555") === true);

/* 2. the queue rule — a guest's queue must be dropped, not retried forever */
t("unknown auth state does not drop the queue", shouldDropQueue(undefined) === false);
t("signed-out state drops the queue", shouldDropQueue(null) === true);
t("signed-in state keeps the queue", shouldDropQueue("abc") === false);

/* 3. reading supabase's getSession() result */
t("a real session yields the user id", userFromSession({ user: { id: "u-1" } }) === "u-1");
t("a null session means signed out", userFromSession(null) === null);
t("an empty user means signed out", userFromSession({ user: {} }) === null);
t("a session with a non-string id is not trusted", userFromSession({ user: { id: 42 } }) === null);
t("a garbage value doesn't throw", userFromSession(undefined) === null);

/* 4. the exact failure mode that cost a month: every learner looked signed-out,
   which is indistinguishable from "no data" in every table. */
const asShippedBefore = (auth) => !!(auth && auth._sessionReady && auth._sessionReady());
const realAuthObject = { getSession: () => Promise.resolve({}), onAuthStateChange: () => ({}) };
t("the old probe would have said 'signed out' for a signed-in learner (why tables were empty)",
  asShippedBefore(realAuthObject) === false);
t("the new gate says 'write' for the same learner",
  shouldAttemptWrite(userFromSession({ user: { id: "u-1" } })) === true);

console.log(`\n${fail === 0 ? "🟢" : "🔴"} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);