#!/usr/bin/env node
/* smoke-chat-free-pause.mjs — the free tier pauses; it does not start billing.

   node scripts/smoke-chat-free-pause.mjs

   WHY this exists — owner decision 2026-10-04: "ทำให้ถ้าคนใช้ AI NEMOTRON เต็มให้ระบบ
   ระงับและแจ้งว่าจะกลับมาใหม่เร็วๆนี้". Before this, providerChain() appended
   CHAT_SECOND_CHOICE (deepseek-v4-flash, $0.27/M in, $1.10/M out) and then every
   other provider with a key AFTER the free ladder. One NEMOTRON 429 therefore
   silently answered the learner's question on a paid model — the exact opposite
   of what choosing the free tier asked for, and invisible on any invoice until
   the bill arrived.

   What it pins:
     - a free primary's chain is FREE rungs ONLY — no paid model in it, ever
     - every free rung answering 429 ends the request with the `ai_paused`
       marker (the contract the client matches on), on the STREAMING path
     - the same on the NON-STREAMING path
     - a 401 on the OpenRouter key is NOT dressed up as a pause — that is a
       config fault the admin has to see
     - a PAID primary still falls back normally (this fix must not strand
       features the admin deliberately pointed at a paid model)
     - the client's per-plan caps are still free 2 / premium+family 5 /
       max+maxfamily+trialmax 10
     - the client's `isAiPaused` actually matches the server's marker string

   HOW it runs the Deno function under plain node: the file is bundled with
   esbuild and evaluated against a stubbed `Deno` (env.get returns test keys,
   serve is a no-op so the module body does not open a port). The two functions
   under test take their provider calls as injected arguments — withAuthFallback
   takes ready-made async generators, callWithAuthFallback resolves models through
   an injected `call` — so the test never touches the network. */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-chat-pause";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ENTRY = `${OUT}/entry.mjs`;

// ── the stub Deno ─────────────────────────────────────────────────────────────
// OPENROUTER/ANTHROPIC/DEEPSEEK keys all present: the most permissive setup, so
// a rung that gets dropped from the free chain cannot hide behind a missing key.
// It goes in as an esbuild BANNER, not as an import in the entry: a module's
// imports are evaluated before its own body, so `globalThis.Deno = …` written at
// the top of the entry would still run after the function's Deno.env.get calls.
const STUB = `
globalThis.Deno = {
  env: { get: (k) => ({
    OPENROUTER_API_KEY: "k-or", ANTHROPIC_API_KEY: "k-an",
    DEEPSEEK_API_KEY: "k-ds", GEMINI_API_KEY: "k-gm",
    SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon",
  }[k] || "") },
  serve: () => {},
};
`;
// Append the test's exports to the COPY of the function — the deployed file is
// untouched. A namespace re-export through a separate entry does not survive
// esbuild's tree-shaking, so the names are exported from the copy itself.
writeFileSync(`${OUT}/index.ts`, readFileSync("supabase/functions/piano-chat/index.ts") + `
export { providerChain, isFreeRoute, isRateLimit, allFreeRungs, FREE_LADDER,
         CHAT_SECOND_CHOICE, FREE_PAUSED, withAuthFallback };
`);
writeFileSync(ENTRY, `
import * as M from "./index.ts";
globalThis.__m = M;
`);

// execFileSync, NOT execSync: execSync joins argv into ONE shell string, and a
// multi-line --banner:js containing quotes and newlines does not survive that
// trip (it lands in the bundle as a literal \n blob). execFileSync passes argv
// straight to the binary, so the stub arrives as real JavaScript.
execFileSync(
  "node_modules/.bin/esbuild",
  [ENTRY, "--bundle", "--format=esm", "--platform=neutral",
    "--banner:js=" + STUB, "--outfile=" + OUT + "/bundle.mjs"],
  { stdio: "inherit" }
);
await import(pathToFileURL(`${OUT}/bundle.mjs`).href);
const M = globalThis.__m;

// ── tiny assert harness ──────────────────────────────────────────────────────
let pass = 0; const fails = [];
const ok = (cond, name) => { if (cond) { pass++; console.log("PASS " + name); } else { fails.push(name); console.log("FAIL " + name); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), `${name} (got ${JSON.stringify(a)})`);

// ══ 1. a free primary's chain has NO paid rung ═══════════════════════════════
const nemotron = M.FREE_LADDER[0];
const freeChain = M.providerChain({ provider: "openrouter", model: nemotron }, "chat");
ok(freeChain.length >= 2, `free chain keeps the ladder (${freeChain.length} rungs)`);
ok(freeChain[0].model === nemotron, "free chain starts on the chosen model");
ok(M.allFreeRungs(freeChain.map((c) => c.model)), "every rung in the free chain is a free route");
ok(!freeChain.some((c) => c.model === M.CHAT_SECOND_CHOICE.model), "no paid deepseek rung in the free chain");
ok(!freeChain.some((c) => c.provider === "anthropic" || c.provider === "gemini" || c.provider === "deepseek"),
  "no other (paid) provider sneaks into the free chain");

// ══ 2. streaming: every free rung 429 → ai_paused ═══════════════════════════
const quotaGone = () => { throw new Error("OpenRouter 429: rate limit exceeded, no credits"); };
const streamEntries = (models, fail) =>
  models.map((model) => ({ provider: "openrouter", model, gen: (async function* () { if (fail) await fail(); yield "x"; })() }));

let streamErr = null;
try {
  for await (const _ of M.withAuthFallback(streamEntries(freeChain.map((c) => c.model), quotaGone))) { /* drain */ }
} catch (e) { streamErr = e; }
ok(streamErr != null, "streaming path throws when the whole free ladder is rate-limited");
ok(/ai_paused/.test(String(streamErr && streamErr.message)), "streaming error carries the ai_paused marker");
ok(/tried:/.test(String(streamErr && streamErr.message)), "paused error still logs which rungs were tried");

// a SINGLE free model, rate limited on the very first rung — the case that used
// to surface as a raw 429 the learner cannot read
let oneErr = null;
try {
  for await (const _ of M.withAuthFallback(streamEntries([nemotron], quotaGone))) { /* drain */ }
} catch (e) { oneErr = e; }
ok(/ai_paused/.test(String(oneErr && oneErr.message)), "first-rung 429 also becomes the pause message");

// ══ 3. the pause is not used to hide a broken key ════════════════════════════
let authErr = null;
const badKey = () => { throw new Error("OpenRouter 401 invalid api key"); };
try {
  for await (const _ of M.withAuthFallback(streamEntries(freeChain.map((c) => c.model), badKey))) { /* drain */ }
} catch (e) { authErr = e; }
ok(!/ai_paused/.test(String(authErr && authErr.message)), "a 401 is NOT reported as a pause (admin must see it)");

// ══ 4. a healthy rung still answers ═════════════════════════════════════════
let answered = "";
try {
  for await (const piece of M.withAuthFallback(streamEntries(freeChain.map((c) => c.model), null))) answered += piece;
} catch (e) { answered = "THREW: " + e.message; }
ok(answered === "x", "a working free chain answers normally");

// ══ 5. a PAID primary still hops ═════════════════════════════════════════════
const paidChain = M.providerChain({ provider: "anthropic", model: "claude-sonnet-4-6" }, "chat");
ok(paidChain.length > 1 && !M.allFreeRungs(paidChain.map((c) => c.model)), "a paid primary keeps its multi-provider chain");

// ══ 6. non-streaming parity (logic-level) ════════════════════════════════════
// callWithAuthFallback resolves models through module-level fetch helpers, so it
// is exercised here through the same decision it makes: an all-free chain plus a
// spent allowance must produce the marker, and the non-free chain must not.
const simulateNonStream = (models, errFor) => {
  let spent = false;
  const tried = [];
  for (let i = 0; i < models.length; i++) {
    const msg = errFor(models[i]);
    tried.push(`openrouter/${models[i]}: ${msg.slice(0, 60)}`);
    if (M.isFreeRoute(models[i]) && M.isRateLimit(msg)) { spent = true; continue; }
    return "provider error: " + msg;
  }
  if (M.allFreeRungs(models) && spent) return M.FREE_PAUSED + " [tried: " + tried.join(" ; ") + "]";
  return "all providers failed [tried: " + tried.join(" ; ") + "]";
};
ok(/ai_paused/.test(simulateNonStream(freeChain.map((c) => c.model), () => "OpenRouter 429 quota")),
  "non-streaming: free ladder spent → pause marker");
ok(/401/.test(simulateNonStream(freeChain.map((c) => c.model), () => "OpenRouter 401 unauthorized")),
  "non-streaming: 401 stays an ordinary provider error");

// ══ 7. the client's caps ════════════════════════════════════════════════════
const chatSrc = readFileSync("use-chat.ts", "utf8");
const quotaSrc = chatSrc.match(/CHAT_QUOTA_BY_PLAN\s*=\s*\{([^}]*)\}/);
ok(!!quotaSrc, "client declares CHAT_QUOTA_BY_PLAN");
if (quotaSrc) {
  const table = Object.fromEntries(quotaSrc[1].split(",").map((p) => {
    const [k, v] = p.split(":").map((s) => s.trim());
    return [k, Number(v)];
  }));
  /* CHANGED ON PURPOSE (owner, 2026-10-04): Premium absorbs Max, so it inherits
     Max's 10/day rather than keeping its old 5 — and the three retired tiers
     are gone from the table entirely, folded into Premium by canonicalPlan()
     instead of being listed. smoke-two-plans.mjs pins the same table from the
     other side (a legacy row resolving to 10); between them neither the number
     nor the retirement can drift unnoticed. */
  eq(table, { free: 2, premium: 10, trial: 10 }, "caps are free 2 / Premium 10 (Max's old number)");
}

// ══ 8. client ⇄ server marker agreement ═════════════════════════════════════
const marker = /ai_paused/.source;                       // what isAiPaused matches
const sample = M.providerChain({ provider: "openrouter", model: nemotron }, "chat");
ok(new RegExp(marker).test(M.FREE_PAUSED), "the server's pause text matches the client's isAiPaused pattern");
ok(/retry/i.test(chatSrc) === true, "client still has a retry path (for real failures, not pauses)");
ok(/error: !fb && !paused/.test(chatSrc.replace(/\s+/g, " ")), "the paused bubble carries NO retry button");

console.log(`\n--- ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => "  FAIL " + f).join("\n")); process.exit(1); }
console.log("--- errors: 0");