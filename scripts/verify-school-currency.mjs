#!/usr/bin/env node
/* verify-school-currency.mjs — the School plan is charged the price it is shown (owner, 2026-11-17).

   The report: the School plan card said US$28.99 per seat for an English buyer while school-stripe-checkout opened every card session in
   baht (THB 920). One rule now: the CARD is charged in the buyer's language currency (payment.tsx currencyOf: baht for Thai, yuan for Chinese,
   US dollars for every other language), and ONLY the card. Every manual rail (PromptPay, bank transfer, Alipay, WeChat) stays baht exactly as
   today (owner brief 2026-11-17, rule 4): the original five-argument RPC, the baht amount, the same screens and QR lines.

   What this runs (no network, no live database, no Stripe, nothing deployed; the REAL files are evaluated, nothing is retyped):
     A  prices: b2bPriceByCur / b2bYearPriceByCur from the real payment.tsx for baht / dollars / yuan x month / year x both tiers, against the
        server table in supabase-school-currency-migration.sql (usd 28.99 / 334.99, cny 210 / 2360, baht 920 / 10700 from the 799 migration's
        own formula) and against the numbers the owner was told; every seat count 15..100,000 comes out as the same whole number of cents on the
        client, in the database number and in the smallest unit the edge function sends to Stripe.
     B  the real school-stripe-checkout and verify-school-payment (Deno stubbed, fetch faked), side by side with the same two functions as
        the base commit 9762c878e left them (git show): a baht row opens the byte-for-byte session the base function opened, a dollar / yuan row
        opens its own currency and amount, `expect` / `cur` are compared and never used as the amount, the session never carries `plan` / `kind`
        (stripe-webhook would fulfil it as a Premium purchase), and verify refuses to mark a row paid unless Stripe's own currency and
        amount_total equal the row's (read in the currency the session was OPENED in, so an Adaptive Pricing session of an older Stripe API
        version is compared on its currency_conversion). A dollar / yuan session is card-only (payment_method_types), a baht session is not
        touched. B7 is the DEPLOY ORDER: the client must come last, and what each wrong order really does is pinned (it is NOT a graceful fall
        back to baht: an old checkout charges a dollar row in baht, an old client before the SQL meets a raw "could not find the function").
        The CORS / return-URL behaviour the LIVE functions (v5 / v4, 2026-09-11) do not have yet is pinned too, with "nothing was weakened".
     C  the real SchoolCheckoutModal (real React, jsdom, Supabase faked), side by side with the base commit's modal: the Thai screens, RPC
        calls and edge calls are the same, and so are the Chinese Alipay / WeChat screens and calls (baht, the original RPC); each other
        language shows the price of the method it sits next to (card = language currency, every manual rail = baht); the headline is the price
        of a method the buyer can actually pick (card off: the baht rails' price); the refusal message of the database reads in all ten languages.
     D  the admin list's money text, and the migration file's shape (one transaction, the five-argument function untouched, one price table,
        only the card can carry a dollar / yuan charge): text pins, strict enough that the off-by-ten and "any method" mutants of the review fail.
     E  the migration on a REAL throwaway Postgres (initdb in a scratch folder on tmpfs, a private unix socket, never the live database; SKIP when
        no server binaries are found, then only the D text pins stand): the repo's real base migrations first, then this one, applied twice; the old
        five-argument function answers, stores and is granted exactly as before; the price table against the client's math; every refusal of the
        new function with its own message; the CHECK; the 8-digit card cap at its boundary; privileges, SECURITY DEFINER, the null auth.uid();
        the self-check rolling everything back and refusing each guarded price when it is wrong by one unit; the admin list in a session that cached its plan before the ALTER.

   Run: node scripts/verify-school-currency.mjs   (SCHOOL_TMP=<dir> moves the scratch folder, default node_modules/.tmp-school-currency;
        PG_BIN=<dir> names the Postgres bin folder for E, PG_OS_USER the account to run it as when this script runs as root, default "postgres")
   Without the base commit in the clone (a shallow clone) the side-by-side checks print SKIP and everything else still runs. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
let build, transformSync, JSDOM, VirtualConsole;
try { ({ build, transformSync } = require("esbuild")); ({ JSDOM, VirtualConsole } = require("jsdom")); }
catch (e) { console.error("esbuild and jsdom are needed (npm install): this check did NOT run. " + (e && e.message)); process.exit(1); }
const TMP = process.env.SCHOOL_TMP || path.join(ROOT, "node_modules", ".tmp-school-currency");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const BASE = "9762c878e";   // the commit the School currency work started from
const baseSrc = (rel) => { try { return execFileSync("git", ["show", `${BASE}:${rel}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }); } catch { return null; } };

let pass = 0, fail = 0, skipped = 0;
const ok = (c, n, d) => { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (d ? "  [" + d + "]" : "")); } };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n, "got " + JSON.stringify(a) + " want " + JSON.stringify(b));
const skip = (n, why) => { skipped++; console.log("SKIP " + n + "  [" + why + "]"); };

const CHECKOUT = "supabase/functions/school-stripe-checkout/index.ts", VERIFY = "supabase/functions/verify-school-payment/index.ts";
const baseCheckoutSrc = baseSrc(CHECKOUT), baseVerifySrc = baseSrc(VERIFY), basePaymentSrc = baseSrc("payment.tsx");
const haveBase = !!(baseCheckoutSrc && baseVerifySrc && basePaymentSrc);
if (!haveBase) console.log(`NOTE the base commit ${BASE} is not in this clone: the side-by-side checks are skipped (the golden strings still run)`);

/* ── the real payment.tsx (and the base commit's, side by side) as one bundle: real React + the stubs it imports ──────────────────────── */
async function stage(dir, { realCatalogs = false } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, "payment.tsx"), path.join(dir, "payment.tsx"));
  fs.copyFileSync(path.join(ROOT, "lang-extra.ts"), path.join(dir, "lang-extra.ts"));
  if (haveBase) fs.writeFileSync(path.join(dir, "payment-base.tsx"), basePaymentSrc);
  // the catalogs are lazy chunks: empty stand-ins (extra languages then read their English), or the real ones
  for (const m of read("lang-extra.ts").matchAll(/import\("\.\/i18n-([a-z]{2,3})"\)/g)) {
    if (realCatalogs) fs.copyFileSync(path.join(ROOT, `i18n-${m[1]}.ts`), path.join(dir, `i18n-${m[1]}.ts`));
    else fs.writeFileSync(path.join(dir, `i18n-${m[1]}.ts`), "export default {};\n");
  }
  fs.writeFileSync(path.join(dir, "supabase-client.ts"), `export const SUPABASE_URL = "https://sb.test";
export const sb: any = { rpc: (...a: any[]) => (globalThis as any).__rpc(...a), storage: { from: () => ({ upload: async () => ({ error: null }) }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };\n`);
  fs.writeFileSync(path.join(dir, "ai-backend.ts"), `export const apiHeaders = () => ({ apikey: "k" });\n`);
  fs.writeFileSync(path.join(dir, "analytics.ts"), `export const track = () => {};\n`);   // payment.tsx -> analytics.ts (Step 2.3); not under test
  fs.writeFileSync(path.join(dir, "entry.tsx"), `import * as P from "./payment.tsx"; ${haveBase ? 'import * as B from "./payment-base.tsx";' : "const B: any = null;"}
import * as L from "./lang-extra.ts"; import * as React from "react"; import { createRoot } from "react-dom/client";
(globalThis as any).__S = (globalThis as any).__S || {}; (globalThis as any).__S[${JSON.stringify(path.basename(dir))}] = { P, B, L, React, createRoot };\n`);
  await build({ entryPoints: [path.join(dir, "entry.tsx")], bundle: true, format: "esm", platform: "node", loader: { ".tsx": "tsx" }, jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' }, nodePaths: [path.join(ROOT, "node_modules")], outfile: path.join(dir, "bundle.mjs"), logLevel: "error" });
  await import(pathToFileURL(path.join(dir, "bundle.mjs")).href);
  return globalThis.__S[path.basename(dir)];
}

// a second, third... evaluation of an already built bundle: same code, new module state (payment.tsx keeps the Stripe mode probe's answer per instance), no second esbuild run
let freshN = 0;
async function fresh(dir = path.join(TMP, "app")) {
  await import(pathToFileURL(path.join(dir, "bundle.mjs")).href + "?fresh=" + (++freshN));
  return globalThis.__S[path.basename(dir)];
}
const rOf = (F) => ({ React: F.React, createRoot: F.createRoot, act: F.React.act });

const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "https://www.tigaalpha.com/", pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
for (const k of ["window", "document", "navigator", "HTMLElement", "Node", "Event", "MouseEvent", "localStorage"]) { try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); } }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
globalThis.__rpc = async () => ({ data: null, error: { message: "no rpc wired" } });
globalThis.fetch = async () => { throw new Error("no fetch wired"); };
const S = await stage(path.join(TMP, "app"));
const P = S.P, B = S.B, { React, createRoot } = S, act = React.act;

// ══ A. prices ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const MIG = read("supabase-school-currency-migration.sql"), MIG799 = read("supabase-price-799-migration.sql");
const cur = (c) => { const m = MIG.match(new RegExp("when '" + c + "' then case when p_cycle = 'year' then ([0-9.]+)\\s+else ([0-9.]+)\\s+end")); return m ? { year: +m[1], month: +m[2] } : null; };
const bahtF = MIG799.match(/when p_cycle = 'year' then (ceil\(round\(799 \* 12 \* 0\.97\) \* 1\.15 \/ 10\) \* 10)\s+else (ceil\(799 \* 1\.15 \/ 10\) \* 10)/);
ok(!!bahtF && !!cur("usd") && !!cur("cny"), "the server price table can be read out of the two migration files");
const ev = (e) => new Function("ceil", "round", "return " + e)(Math.ceil, Math.round);
const SERVER = { thb: { year: ev(bahtF[1]), month: ev(bahtF[2]) }, usd: cur("usd"), cny: cur("cny") };
const OWNER = { thb: { month: 920, year: 10700 }, usd: { month: 28.99, year: 334.99 }, cny: { month: 210, year: 2360 } };   // the numbers the card shows
for (const c of ["thb", "usd", "cny"]) for (const cy of ["month", "year"]) for (const tier of ["standard", "plus"]) {
  const client = cy === "year" ? P.b2bYearPriceByCur(c, tier) : P.b2bPriceByCur(c, tier);
  ok(client === SERVER[c][cy] && client === OWNER[c][cy], `${c} ${cy} ${tier}: the card (${client}) = the server table (${SERVER[c][cy]}) = what the owner was told (${OWNER[c][cy]})`);
}
eq(["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar", "de"].map((l) => P.currencyOf(l)), ["thb", "usd", "cny", "usd", "usd", "usd", "usd", "usd", "usd", "usd", "usd"], "currencyOf: Thai baht, Chinese yuan, every other language dollars");
ok(MIG.includes("when 'thb' then public._school_b2b_unit_price(p_tier, p_cycle)"), "baht keeps ONE source: the 3-argument price function delegates to _school_b2b_unit_price");
{
  const cents = { thb: { month: 92000, year: 1070000 }, usd: { month: 2899, year: 33499 }, cny: { month: 21000, year: 236000 } };
  let bad = 0, n = 0;
  for (const c of ["thb", "usd", "cny"]) for (const cy of ["month", "year"]) {
    const unit = cy === "year" ? P.b2bYearPriceByCur(c, "standard") : P.b2bPriceByCur(c, "standard");
    for (let seats = 15; seats <= 100000; seats++) {
      n++; const exact = cents[c][cy] * seats;                                  // whole cents, integer arithmetic
      const shown = Math.round(unit * seats * 100) / 100;                       // what the modal displays and sends as `expect`
      const dbNumber = Number((exact / 100).toFixed(2));                        // what PostgREST hands the edge function (the numeric, as a JS number)
      if (Math.round(shown * 100) !== exact || Math.round(dbNumber * 100) !== exact) bad++;
    }
  }
  ok(bad === 0, `every seat count 15..100,000 x 6 prices (${n}) is the same whole number of cents on the card, in the database number and in Stripe's unit_amount`, bad + " differ");
}

// ══ B. the real edge functions ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const UID = "11111111-1111-1111-1111-111111111111", OTHER = "22222222-2222-2222-2222-222222222222";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = (sub = UID, role = "authenticated") => "Bearer " + b64({ alg: "none" }) + "." + b64({ sub, role }) + ".sig";
let nonce = 0;
async function loadFnSrc(src) {
  src = src.replace(/^import \{ serve \} from .*$/m, "const serve = (h) => { globalThis.__handler = h; };");
  await import("data:text/javascript;base64," + Buffer.from(transformSync(src, { loader: "ts", format: "esm" }).code + "\n// " + (nonce++)).toString("base64"));
  const h = globalThis.__handler; globalThis.__handler = null; return h;
}
function world(rows, sessions = {}, opts = {}) {
  const log = { posts: [], patches: [], errors: [] };
  globalThis.Deno = { env: { get: (k) => ({ STRIPE_SECRET_KEY: "sk_test_x", SUPABASE_URL: "http://sb.test", SUPABASE_SERVICE_ROLE_KEY: "svc" })[k] } };
  const realErr = console.error; console.error = (...a) => { log.errors.push(a.join(" ")); };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const m = url.match(/\/rest\/v1\/school_payment_requests\?id=eq\.([^&]+)(?:&select=(.*))?$/);
    if (m && init.method === "PATCH") { log.patches.push(JSON.parse(init.body)); return new Response(opts.failPatch ? "db down" : null, { status: opts.failPatch ? 503 : 204 }); }
    if (m && (!init.method || init.method === "GET")) {
      const row = rows[decodeURIComponent(m[1])]; if (!row) return new Response("[]", { status: 200 });
      const sel = decodeURIComponent(m[2] || "*");
      return new Response(JSON.stringify([sel === "*" ? row : Object.fromEntries(sel.split(",").map((k) => [k, row[k]]))]), { status: 200 });   // a real select returns only the columns it names
    }
    if (url === "https://api.stripe.com/v1/checkout/sessions" && init.method === "POST") { log.posts.push(String(init.body)); return new Response(JSON.stringify({ url: "https://checkout.stripe.test/c/pay_1" }), { status: 200 }); }
    const sm = url.match(/^https:\/\/api\.stripe\.com\/v1\/checkout\/sessions\/(.+)$/);
    if (sm) { const s = sessions[decodeURIComponent(sm[1])]; return s ? new Response(JSON.stringify(s), { status: 200 }) : new Response(JSON.stringify({ error: { message: "No such session" } }), { status: 404 }); }
    throw new Error("unexpected fetch " + url);
  };
  return { log, restore: () => { console.error = realErr; } };
}
const req = (body, auth = JWT()) => new Request("http://fn.test/", { method: "POST", headers: { authorization: auth, origin: "https://www.tigaalpha.com", "content-type": "application/json" }, body: JSON.stringify(body) });
const row0 = (o = {}) => ({ id: "req-1", requester_id: UID, institution_name: "Test School", contact_email: "t@example.org", tier: "school_standard", seats: 15, cycle: "month", amount: 13800, method: "stripe", status: "pending", slip_path: null, stripe_session_id: null, ...o });
const checkout = await loadFnSrc(read(CHECKOUT)), verify = await loadFnSrc(read(VERIFY));
const baseCheckout = haveBase ? await loadFnSrc(baseCheckoutSrc) : null, baseVerify = haveBase ? await loadFnSrc(baseVerifySrc) : null;
async function pay(row, body = {}, auth, fn = checkout) {
  const w = world({ [row.id]: row }); const r = await fn(req({ requestId: row.id, ...body }, auth)); const j = await r.json().catch(() => null); w.restore();
  return { status: r.status, body: j, post: w.log.posts[0], posts: w.log.posts, errors: w.log.errors };
}
async function ver(row, session, auth, fn = verify) {
  const w = world({ [row.id]: row }, session ? { cs_1: session } : {}); const r = await fn(req({ requestId: row.id, sessionId: "cs_1" }, auth)); const j = await r.json().catch(() => null); w.restore();
  const patches = w.log.patches.map((p) => ({ ...p, reviewed_at: p.reviewed_at ? "<now>" : p.reviewed_at }));
  return { status: r.status, body: j, patches, errors: w.log.errors };
}
const form = (s) => Object.fromEntries(new URLSearchParams(s));

// B1. baht: the exact Stripe request the function has always sent (captured from the base function before this change)
const GOLD_STD = "mode=payment&client_reference_id=req-1&success_url=https%3A%2F%2Fwww.tigaalpha.com%2F%3Fschool_paid%3D1%26req%3Dreq-1%26session_id%3D%7BCHECKOUT_SESSION_ID%7D&cancel_url=https%3A%2F%2Fwww.tigaalpha.com%2F%3Fschool_paid%3D0&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=thb&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=1380000&line_items%5B0%5D%5Bprice_data%5D%5Bproduct_data%5D%5Bname%5D=TiGA+School+Plan+Standard+%E2%80%94+15+seats+%281+month%29&metadata%5Brequest_id%5D=req-1&metadata%5Buser_id%5D=11111111-1111-1111-1111-111111111111&metadata%5Bseats%5D=15&metadata%5Btier%5D=school_standard&metadata%5Bamount_thb%5D=13800";
const GOLD_PLUS = "mode=payment&client_reference_id=req-1&success_url=https%3A%2F%2Fwww.tigaalpha.com%2F%3Fschool_paid%3D1%26req%3Dreq-1%26session_id%3D%7BCHECKOUT_SESSION_ID%7D&cancel_url=https%3A%2F%2Fwww.tigaalpha.com%2F%3Fschool_paid%3D0&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=thb&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=21400000&line_items%5B0%5D%5Bprice_data%5D%5Bproduct_data%5D%5Bname%5D=TiGA+School+Plan+Plus+%E2%80%94+20+seats+%281+year%29&metadata%5Brequest_id%5D=req-1&metadata%5Buser_id%5D=11111111-1111-1111-1111-111111111111&metadata%5Bseats%5D=20&metadata%5Btier%5D=school_plus&metadata%5Bamount_thb%5D=214000";
for (const [label, row, gold] of [
  ["a baht row from before the migration (no charge_* fields at all)", row0(), GOLD_STD],
  ["the same row with charge_currency 'thb' and no charge_amount (the column default)", row0({ charge_currency: "thb", charge_amount: null }), GOLD_STD],
  ["a baht Plus / yearly / 20 seats row", row0({ tier: "school_plus", cycle: "year", seats: 20, amount: 214000 }), GOLD_PLUS],
  ["a baht row made for Alipay by a cached client", row0({ method: "alipay" }), GOLD_STD],
]) {
  const r = await pay(row);
  ok(r.status === 200 && r.post === gold && r.body.url === "https://checkout.stripe.test/c/pay_1", `baht: ${label} opens the byte-for-byte session it always opened`, r.post === gold ? "" : r.post);
}
// B1b. the same, but against the base commit's own function: every baht row x every request that can reach it
if (haveBase) {
  let n = 0; const bad = [];
  const unit = (cy) => cy === "year" ? 10700 : 920;
  for (const tier of ["school_standard", "school_plus"]) for (const cycle of ["month", "year"]) for (const seats of [15, 16, 20, 93, 1000]) for (const variant of ["old row", "thb column", "alipay by an old client"]) {
    const row = row0({ tier, cycle, seats, amount: unit(cycle) * seats, ...(variant === "thb column" ? { charge_currency: "thb", charge_amount: null } : {}), ...(variant === "alipay by an old client" ? { method: "alipay" } : {}) });
    const a = await pay(row, {}, undefined, baseCheckout);
    for (const extra of [{}, { expect: row.amount, cur: "thb" }]) {   // an old client sends {requestId}; a new one adds the figure it showed
      const b = await pay(row, extra); n++;
      if (a.status !== b.status || a.post !== b.post || JSON.stringify(a.body) !== JSON.stringify(b.body)) bad.push(`${tier} ${cycle} ${seats} ${variant} ${JSON.stringify(extra)}`);
    }
  }
  ok(bad.length === 0, `baht: ${n} rows x requests answer exactly what the base commit's function answers: same status, same body, same Stripe request`, bad.slice(0, 2).join(" ; "));
  // the paths that never reach Stripe: same status and body as before
  const usd = row0();
  let same = 0; const diff = [];
  for (const [label, row, body, auth] of [
    ["no JWT", usd, {}, "Bearer nope"], ["anon role", usd, {}, JWT(UID, "anon")], ["another user's request", usd, {}, JWT(OTHER)],
    ["already paid", { ...usd, status: "paid" }, {}], ["zero amount", { ...usd, amount: 0 }, {}], ["negative amount", { ...usd, amount: -5 }, {}], ["text amount", { ...usd, amount: "abc" }, {}],
    ["a null amount", { ...usd, amount: null }, {}], ["no requestId", usd, { requestId: "" }],
  ]) {
    const a = await pay(row, body, auth, baseCheckout), b = await pay(row, body, auth);
    if (a.status === b.status && JSON.stringify(a.body) === JSON.stringify(b.body)) same++; else diff.push(label + ": " + a.status + " vs " + b.status);
  }
  ok(diff.length === 0, `baht: the refusals (no JWT, anon, another user, paid, bad amounts, no id) answer exactly as before (${same})`, diff.join(" ; "));
  const probe = await (async () => { const w = world({}); const a = await (await baseCheckout(req({ probe: true }))).json(); const b = await (await checkout(req({ probe: true }))).json(); w.restore(); return [a, b]; })();
  eq(probe[1], probe[0], "the key-mode probe answers what it answered before");
} else skip("baht rows against the base commit's function", "base commit missing");

// B2. dollars and yuan
for (const [label, row, c, minor, charge] of [
  ["usd monthly 15", row0({ charge_currency: "usd", charge_amount: 434.85 }), "usd", "43485", "434.85"],
  ["usd yearly 17 Plus", row0({ tier: "school_plus", cycle: "year", seats: 17, amount: 181900, charge_currency: "usd", charge_amount: 5694.83 }), "usd", "569483", "5694.83"],
  ["usd at Stripe's 8-digit ceiling (2,985 yearly seats)", row0({ cycle: "year", seats: 2985, amount: 31939500, charge_currency: "usd", charge_amount: 999945.15 }), "usd", "99994515", "999945.15"],
  ["cny monthly 15", row0({ charge_currency: "cny", charge_amount: 3150 }), "cny", "315000", "3150"],
  ["cny yearly 30", row0({ cycle: "year", seats: 30, amount: 321000, charge_currency: "cny", charge_amount: 70800 }), "cny", "7080000", "70800"],
  ["a float-noise amount (28.99 x 17 = 492.83000000000004)", row0({ seats: 17, amount: 15640, charge_currency: "usd", charge_amount: 28.99 * 17 }), "usd", "49283", "492.83"],
  ["an upper-case currency on the row", row0({ charge_currency: "USD", charge_amount: 434.85 }), "usd", "43485", "434.85"],
]) {
  const r = await pay(row), f = r.post ? form(r.post) : {};
  ok(r.status === 200 && f["line_items[0][price_data][currency]"] === c && f["line_items[0][price_data][unit_amount]"] === minor, `${label}: the session is ${c} ${minor}`, JSON.stringify(r.body) + " " + (r.post || ""));
  ok(f["metadata[amount_thb]"] === String(row.amount) && f["metadata[currency]"] === c && f["metadata[charge_amount]"] === charge, `${label}: the metadata keeps the baht list price and names the charge`);
  ok(f["metadata[user_id]"] === UID && f["metadata[request_id]"] === row.id && f.client_reference_id === row.id && f.success_url === "https://www.tigaalpha.com/?school_paid=1&req=req-1&session_id={CHECKOUT_SESSION_ID}", `${label}: verify-school-payment can still pair the session with the request`);
  ok(!("metadata[plan]" in f) && !("metadata[kind]" in f) && !("metadata[days]" in f) && !("metadata[payment_id]" in f), `${label}: no plan / kind / days / payment_id in the metadata: stripe-webhook and verify-stripe-payment would fulfil it as a Premium or currency purchase`);
}
{
  const src = read(CHECKOUT);
  ok(!/metadata\[(plan|kind|days|payment_id)\]/.test(src), "school-stripe-checkout never mentions metadata plan / kind / days / payment_id (stripe-webhook fulfils any paid session that has a user_id and a plan)");
  ok(!/price_data\]\[currency\]", "thb"/.test(src), "the session currency is not hard-coded to baht any more");
  ok(/const MINOR[^\n]*thb: 100, usd: 100, cny: 100/.test(src) && /const MINOR[^\n]*thb: 100, usd: 100, cny: 100/.test(read(VERIFY)), "both functions know the same three currencies, two decimals each (satang, cents, fen)");
}
// B2b. a dollar / yuan session is a CARD session (payment_method_types pinned to card); a baht session is not touched. Review finding: without the pin a method the Stripe
//      dashboard enabled for the currency that settles later leaves payment_status "unpaid" at the redirect, and nothing here waits for a webhook
{
  for (const [label, row] of [["usd", row0({ charge_currency: "usd", charge_amount: 434.85 })], ["cny", row0({ charge_currency: "cny", charge_amount: 3150 })], ["usd yearly Plus", row0({ tier: "school_plus", cycle: "year", seats: 17, amount: 181900, charge_currency: "usd", charge_amount: 5694.83 })]]) {
    const r = await pay(row), f = r.post ? form(r.post) : {};
    ok(r.status === 200 && f["payment_method_types[0]"] === "card" && Object.keys(f).filter((k) => /^payment_method_types/.test(k)).length === 1, `${label}: the session is pinned to card only (payment_method_types[0] = card, no other entry)`, r.post);
  }
  for (const [label, row] of [["a baht row from before the migration", row0()], ["a baht row with the column default", row0({ charge_currency: "thb", charge_amount: null })], ["a baht Plus / yearly / 20 seats row", row0({ tier: "school_plus", cycle: "year", seats: 20, amount: 214000 })], ["a baht row made for Alipay by a cached client", row0({ method: "alipay" })]]) {
    const r = await pay(row);
    ok(r.status === 200 && !/payment_method_types|adaptive_pricing|payment_method_options/.test(r.post), `baht: ${label}: no payment_method_types on the session (what the dashboard offers for baht stays what it was)`, r.post);
  }
}
// B3. expect / cur: compared, never used
{
  const usd = row0({ charge_currency: "usd", charge_amount: 434.85 });
  let r = await pay(usd, { expect: 434.85, cur: "usd" }); ok(r.status === 200, "expect = the displayed total opens the session");
  r = await pay(usd, { expect: 28.99 * 15, cur: "usd" }); ok(r.status === 200, "expect with float noise (28.99 x 15 = 434.84999999999997) is accepted");
  r = await pay(usd, { expect: 13800, cur: "usd" }); ok(r.status === 409 && r.body.error === "price_mismatch" && r.posts.length === 0 && r.errors.length === 1, "an expect that is not what the row charges is refused with 409 price_mismatch, logged, and NO session is created");
  r = await pay(usd, { expect: 434.85, cur: "thb" }); ok(r.status === 409 && r.body.error === "currency_mismatch" && r.posts.length === 0 && r.errors.length === 1, "a cur that is not the row's currency is refused with 409 currency_mismatch");
  r = await pay(usd, { expect: 13800, cur: "thb" }); ok(r.status === 409 && r.body.error === "currency_mismatch" && r.posts.length === 0, "when both differ the currency is named first (two amounts in different currencies cannot be compared)");
  r = await pay(row0(), { expect: 13800, cur: "thb" }); ok(r.status === 200 && r.post === GOLD_STD, "a new client's baht request (expect 13800, cur thb) opens the same session as an old client's");
  r = await pay(row0(), { expect: 920 * 15 + 1, cur: "thb" }); ok(r.status === 409 && r.posts.length === 0, "baht: a drifted expect is refused too (the guard that would have caught the 1,720-versus-920 episode)");
  r = await pay(usd, { expect: "434.85", cur: 5 }); ok(r.status === 200, "a non-number expect and a non-string cur are ignored, never trusted");
  r = await pay(usd, { expect: 1, cur: "usd", amount: 1, charge_amount: 1, currency: "thb", unit_amount: 100 }); ok(r.status === 409 && r.posts.length === 0, "a client-supplied amount / currency / unit_amount field changes nothing: only the row is read");
  r = await pay(usd, { amount: 1, charge_amount: 1, currency: "thb", unit_amount: 100 }); ok(r.status === 200 && form(r.post)["line_items[0][price_data][unit_amount]"] === "43485" && form(r.post)["line_items[0][price_data][currency]"] === "usd", "and without expect the same fields are ignored: the session is still usd 43485");
}
// B4. the guard rails that were already there, and the new ones
{
  const usd = row0({ charge_currency: "usd", charge_amount: 434.85 });
  let r = await pay(usd, {}, "Bearer nope"); ok(r.status === 401, "no valid JWT -> 401");
  r = await pay(usd, {}, JWT(UID, "anon")); ok(r.status === 401, "anon role -> 401");
  r = await pay(usd, {}, JWT(OTHER)); ok(r.status === 403 && r.posts.length === 0, "somebody else's request -> 403");
  r = await pay({ ...usd, status: "paid" }); ok(r.status === 409 && r.posts.length === 0, "an already paid request -> 409");
  r = await pay({ ...usd, amount: 0 }); ok(r.status === 500 && r.posts.length === 0, "a zero baht amount -> 500, no session");
  r = await pay({ ...usd, charge_currency: "eur", charge_amount: 400 }); ok(r.status === 500 && /bad currency/.test(r.body.error) && r.posts.length === 0, "a currency that is not thb / usd / cny -> 500, no session");
  for (const bad of [null, -5, 0, "abc"]) { r = await pay({ ...usd, charge_amount: bad }); ok(r.status === 500 && r.posts.length === 0, `a dollar row whose charge_amount is ${JSON.stringify(bad)} -> 500, no session`); }
  let w = world({}); r = await checkout(req({ requestId: "missing" })); ok(r.status === 404, "an unknown request -> 404"); w.restore();
  w = world({}); r = await checkout(req({})); ok(r.status === 400, "no requestId -> 400"); w.restore();
  w = world({}); r = await (await checkout(req({ probe: true }))).json(); ok(r.mode === "test", "the key-mode probe still answers"); w.restore();
}
// B5. verify-school-payment
const sess = (o = {}) => ({ id: "cs_1", payment_status: "paid", currency: "thb", amount_total: 1380000, metadata: { request_id: "req-1", user_id: UID }, client_reference_id: "req-1", ...o });
{
  let r = await ver(row0(), sess()); ok(r.body.status === "paid" && r.patches.length === 1 && r.patches[0].status === "paid" && r.patches[0].stripe_session_id === "cs_1", "a baht row + a paid baht session of the right amount -> paid");
  r = await ver(row0({ tier: "school_plus", cycle: "year", seats: 20, amount: 214000 }), sess({ amount_total: 21400000 })); ok(r.body.status === "paid", "a baht yearly row -> paid");
  r = await ver(row0(), sess({ payment_status: "unpaid" })); ok(r.body.status === "unpaid" && r.patches.length === 0, "unpaid stays unpaid, row untouched");
  r = await ver(row0(), sess({ metadata: { request_id: "other", user_id: UID }, client_reference_id: "other" })); ok(r.body.status === "unpaid" && r.patches.length === 0, "a session that belongs to another request is not accepted");
  r = await ver(row0({ status: "paid" }), null); ok(r.body.status === "paid" && r.patches.length === 0, "landing on the success URL twice is not an error and asks Stripe nothing");
  r = await ver(row0(), sess(), JWT(OTHER)); ok(r.status === 403, "somebody else's request -> 403");
  r = await ver(row0(), null); ok(r.status === 500, "Stripe does not know the session -> 500");
  const usd = row0({ charge_currency: "usd", charge_amount: 434.85 }), cny = row0({ charge_currency: "cny", charge_amount: 3150 });
  r = await ver(usd, sess({ currency: "usd", amount_total: 43485 })); ok(r.body.status === "paid" && r.patches.length === 1, "a dollar row + the exact dollar session -> paid");
  r = await ver(usd, sess({ currency: "USD", amount_total: 43485 })); ok(r.body.status === "paid", "Stripe's currency code is compared case-insensitively");
  r = await ver(cny, sess({ currency: "cny", amount_total: 315000 })); ok(r.body.status === "paid", "a yuan row + the exact yuan session -> paid");
  for (const [label, row, s] of [
    ["a dollar row paid as baht (an old checkout opened the session)", usd, sess({ currency: "thb", amount_total: 43485 })],
    ["a dollar row paid as baht at the baht list price", usd, sess({ currency: "thb", amount_total: 1380000 })],
    ["one cent short", usd, sess({ currency: "usd", amount_total: 43484 })],
    ["one cent over", usd, sess({ currency: "usd", amount_total: 43486 })],
    ["the baht figure in dollars", usd, sess({ currency: "usd", amount_total: 1380000 })],
    ["no amount_total on the session", usd, sess({ currency: "usd", amount_total: undefined })],
    ["no currency on the session", usd, sess({ currency: undefined, amount_total: 43485 })],
    ["a yuan row paid in dollars", cny, sess({ currency: "usd", amount_total: 315000 })],
    ["a baht row paid in dollars", row0(), sess({ currency: "usd", amount_total: 1380000 })],
    ["a baht row, a tenth of the amount", row0(), sess({ amount_total: 138000 })],
    ["a currency that is not in the table, even when Stripe agrees with the row", row0({ charge_currency: "eur", charge_amount: 400 }), sess({ currency: "eur", amount_total: 40000 })],
    ["a zero-amount row and a zero session", row0({ amount: 0 }), sess({ amount_total: 0 })],
  ]) {
    r = await ver(row, s);
    ok(r.status === 409 && r.body.status === "mismatch" && r.patches.length === 0 && r.errors.length === 1, `verify refuses: ${label}: 409 mismatch, row NOT marked paid, one log line`);
  }
}
// B5b. Adaptive Pricing is a setting of the Stripe ACCOUNT (the code never turns it on). On an API version before 2025-03-31 a session sold in the buyer's own currency reports that
//      currency at the top level and keeps the price we asked for in currency_conversion { source_currency, amount_total }. A buyer who legitimately paid must not be stranded
//      (review finding: he was, with "Couldn't confirm payment"); a session that does not add up must still be refused. The shape is Stripe's API reference's: NOT seen on a live account.
{
  const cv = (src, amt, extra = {}) => ({ amount_subtotal: amt, amount_total: amt, fx_rate: "0.9174", source_currency: src, ...extra });
  const usd = row0({ charge_currency: "usd", charge_amount: 434.85 }), cny = row0({ charge_currency: "cny", charge_amount: 3150 });
  let r = await ver(usd, sess({ currency: "eur", amount_total: 39896, currency_conversion: cv("usd", 43485) }));
  ok(r.body.status === "paid" && r.patches.length === 1 && r.patches[0].status === "paid" && r.patches[0].stripe_session_id === "cs_1" && r.errors.length === 0, "Adaptive Pricing (older API shape): a dollar row paid in euros (top level EUR 398.96, currency_conversion USD 434.85) -> paid, row marked");
  r = await ver(cny, sess({ currency: "jpy", amount_total: 66150, currency_conversion: cv("cny", 315000) })); ok(r.body.status === "paid" && r.patches.length === 1, "Adaptive Pricing: a yuan row paid in yen -> paid");
  r = await ver(row0(), sess({ currency: "sgd", amount_total: 53000, currency_conversion: cv("thb", 1380000) })); ok(r.body.status === "paid" && r.patches.length === 1, "Adaptive Pricing: a BAHT row paid by a foreign card in Singapore dollars -> paid (the new check must not strand a Thai checkout the base accepted)");
  r = await ver(usd, sess({ currency: "usd", amount_total: 43485, currency_conversion: null })); ok(r.body.status === "paid", "newer API shape (currency_conversion null, the top level is the price we asked for) -> paid");
  r = await ver(usd, sess({ currency: "usd", amount_total: 43485, currency_conversion: "yes" })); ok(r.body.status === "paid", "a currency_conversion that is not an object is ignored: the top level is compared");
  for (const [label, row, s] of [
    ["a converted amount one cent short", usd, sess({ currency: "eur", amount_total: 39896, currency_conversion: cv("usd", 43484) })],
    ["a converted amount one cent over", usd, sess({ currency: "eur", amount_total: 39896, currency_conversion: cv("usd", 43486) })],
    ["the right amount in the wrong source currency (thb for a usd row)", usd, sess({ currency: "eur", amount_total: 39896, currency_conversion: cv("thb", 43485) })],
    ["a yuan row whose source currency is dollars", cny, sess({ currency: "jpy", amount_total: 66150, currency_conversion: cv("usd", 315000) })],
    ["a conversion without source_currency", usd, sess({ currency: "eur", amount_total: 39896, currency_conversion: { amount_total: 43485 } })],
    ["a conversion without amount_total (the buyer's own EUR figure is never taken instead)", usd, sess({ currency: "eur", amount_total: 43485, currency_conversion: { source_currency: "usd" } })],
    ["an empty conversion object", usd, sess({ currency: "usd", amount_total: 43485, currency_conversion: {} })],
    ["a conversion that disagrees with a top level that matches (the conversion is the source: refuse)", usd, sess({ currency: "usd", amount_total: 43485, currency_conversion: cv("usd", 1) })],
    ["a session in another currency that carries no currency_conversion (a shape not known: fail closed)", usd, sess({ currency: "eur", amount_total: 39896 })],
    ["the buyer's euro figure equal to the row's number (EUR 434.85 for a USD 434.85 row)", usd, sess({ currency: "eur", amount_total: 43485 })],
    ["a baht row converted to dollars at the baht number", row0(), sess({ currency: "usd", amount_total: 1380000, currency_conversion: cv("usd", 1380000) })],
  ]) {
    r = await ver(row, s);
    ok(r.status === 409 && r.body.status === "mismatch" && r.patches.length === 0 && r.errors.length === 1, `verify refuses: ${label}: 409 mismatch, row NOT marked paid, one log line`);
  }
  r = await ver(usd, sess({ currency: "eur", amount_total: 39896 }));
  const logged = r.errors[0] ? JSON.parse(r.errors[0].replace(/^school payment mismatch /, "")) : {};
  ok(logged.sessionCurrency === "eur" && logged.sessionAmount === 39896 && logged.wantCurrency === "usd" && logged.want === 43485 && logged.converted === false, "a refusal's log line names both pairs (what the row wanted, what Stripe reports) so staff can approve a real payment by hand", r.errors[0]);
  r = await ver(usd, sess({ currency: "eur", amount_total: 39896, currency_conversion: cv("usd", 43484) }));
  const logged2 = r.errors[0] ? JSON.parse(r.errors[0].replace(/^school payment mismatch /, "")) : {};
  ok(logged2.converted === true && logged2.gotCurrency === "usd" && logged2.got === 43484 && logged2.sessionCurrency === "eur", "and for a converted session it says so (converted: true, the source pair, the buyer's pair)", r.errors[0]);
}
// B6. the base commit's verify on baht rows, side by side: only a session that does not match its row is answered differently
if (haveBase) {
  const rows = [row0(), row0({ tier: "school_plus", cycle: "year", seats: 20, amount: 214000 }), row0({ charge_currency: "thb", charge_amount: null })];
  const sessions = [sess(), sess({ amount_total: 21400000 }), sess({ payment_status: "unpaid" }), sess({ metadata: { request_id: "other" }, client_reference_id: "other" }), sess({ payment_status: "no_payment_required" })];
  let n = 0; const bad = [];
  for (const row of rows) for (const s of sessions) {
    const a = await ver(row, s, undefined, baseVerify), b = await ver(row, s);
    const matches = s.currency === "thb" && s.amount_total === Math.round(row.amount * 100);
    if (matches || s.payment_status !== "paid") { n++; if (a.status !== b.status || JSON.stringify(a.body) !== JSON.stringify(b.body) || JSON.stringify(a.patches) !== JSON.stringify(b.patches)) bad.push(JSON.stringify([row.seats, s.amount_total, s.payment_status])); }
  }
  ok(bad.length === 0 && n > 0, `baht: verify-school-payment answers and writes exactly what the base commit's did for every session that matches its row, and for every unpaid or foreign one (${n})`, bad.join(" ; "));
  for (const [label, who] of [["a baht row whose session Stripe does not know", undefined], ["another user", JWT(OTHER)]]) {
    const a = await ver(row0(), null, who, baseVerify), b = await ver(row0(), null, who);
    ok(a.status === b.status && JSON.stringify(a.body) === JSON.stringify(b.body), `verify: ${label} answers as before (${b.status})`);
  }
  const a = await ver(row0(), sess({ amount_total: 138000 }), undefined, baseVerify), b = await ver(row0(), sess({ amount_total: 138000 }));
  ok(a.body.status === "paid" && b.status === 409 && b.body.status === "mismatch", "THE deliberate difference: a baht session of the wrong amount was marked paid before and is refused now");
} else skip("verify-school-payment side by side with the base commit's", "base commit missing");
// B7. THE DEPLOY ORDER IS MANDATORY: 1. the SQL, 2. verify-school-payment, 3. school-stripe-checkout, 4. THE CLIENT LAST. A wrong order is NOT a graceful fall back to baht (the first
//     version of the commit message and the migration header said so; review finding): a dollar / yuan row that meets the OLD checkout is charged the baht list price, a currency and a
//     number the buyer was never shown. The old functions here are the base commit's, which charge exactly what the LIVE v5 / v4 charge (they differ only in CORS and the return URL, B8).
if (haveBase) {
  for (const [label, row, shown] of [
    ["US$434.85 (an English buyer)", row0({ charge_currency: "usd", charge_amount: 434.85 }), { cur: "usd", n: 434.85 }],
    ["¥3,150 (a Chinese buyer)", row0({ charge_currency: "cny", charge_amount: 3150 }), { cur: "cny", n: 3150 }],
  ]) {
    const old = await pay(row, { expect: shown.n, cur: shown.cur }, undefined, baseCheckout), f = old.post ? form(old.post) : {};
    ok(old.status === 200 && f["line_items[0][price_data][currency]"] === "thb" && f["line_items[0][price_data][unit_amount]"] === "1380000", `client + SQL before school-stripe-checkout: the OLD function opens THB 13,800 (the row's baht list price) for a buyer who was shown ${label}: it ignores expect and cur`);
    ok(f["line_items[0][price_data][currency]"] !== shown.cur && Number(f["line_items[0][price_data][unit_amount]"]) !== Math.round(shown.n * 100), `...so it is NOT a graceful fall back: the currency and the number Stripe asks are not the ones shown (${label})`);
    const paidAsBaht = sess({ currency: "thb", amount_total: 1380000 });
    const nv = await ver(row, paidAsBaht);
    ok(nv.status === 409 && nv.body.status === "mismatch" && nv.patches.length === 0 && nv.errors.length === 1, `...if he pays, the NEW verify-school-payment answers 409 amount_mismatch and the row stays pending (money taken, nothing recorded, one log line: staff reconcile in Stripe)`);
    const ov = await ver(row, paidAsBaht, undefined, baseVerify);
    ok(ov.body.status === "paid" && ov.patches.length === 1, `...and the OLD verify-school-payment marks the same row paid (it checks payment_status and the metadata pairing only)`);
  }
  // the order that IS harmless: the new edge functions before the SQL and before the client. A row made by the five-argument function (cached old clients, or no SQL yet) has no
  // charge_* fields: it is a baht row, charged and confirmed exactly as the old functions did (byte for byte in B1b / B6).
  for (const [label, row] of [["a baht row (no charge_* fields: the SQL is not applied yet)", row0()], ["a baht row made by a cached old client after the SQL", row0({ charge_currency: "thb", charge_amount: null })]]) {
    const a = await pay(row, {}, undefined, baseCheckout), b = await pay(row, {});
    ok(a.post === b.post && a.status === b.status, `edge functions first: the NEW school-stripe-checkout opens the same session as the old one for ${label}`);
    const va = await ver(row, sess(), undefined, baseVerify), vb = await ver(row, sess());
    ok(va.body.status === "paid" && vb.body.status === "paid" && JSON.stringify(va.patches) === JSON.stringify(vb.patches), `edge functions first: the NEW verify-school-payment confirms the same payment for ${label}`);
  }
  // and a new checkout + an OLD verify (the other half of a partial deploy) only lacks the strict check: a right session is accepted
  const usd = row0({ charge_currency: "usd", charge_amount: 434.85 }), okSession = sess({ currency: "usd", amount_total: 43485 });
  const ov2 = await ver(usd, okSession, undefined, baseVerify);
  ok(ov2.body.status === "paid", "a NEW dollar session meeting the OLD verify-school-payment is accepted when it is right (it only lacks the strict check: verify goes first as a precaution)");
} else skip("the deploy order against the base commit's functions", "base commit missing");
// B8. THE DEPLOY SHIPS A SECOND CHANGE. The LIVE functions (school-stripe-checkout v5, verify-school-payment v4, both deployed 2026-09-11) are older than the repo: they lack the
//     www.tigaalpha.com / tigaalpha.com origins (so a page on www gets Access-Control-Allow-Origin: https://tigaalpha.github.io and its browser blocks the call) and send the buyer back to
//     github.io whatever domain he paid from. Commit 7c9d46793 fixed both in the repo ("functions not deployed"); this deploy makes them live. Wanted, but a live behaviour change the owner
//     must know about, so it is pinned here, together with "nothing was weakened": ALLOW, siteOf, cors, jwtPayload and the sign-in / own-request gates are the base commit's, character for character.
{
  const ORIGINS = ["https://tigaalpha.github.io", "https://www.tigaalpha.com", "https://tigaalpha.com", "http://localhost:5173", "http://localhost:8080", "http://localhost:4173"];
  const SITE0 = "https://tigaalpha.github.io";
  const call = async (fn, { method = "POST", origin, auth = JWT(), body, row } = {}) => {
    const w = world({ "req-1": row || row0({ charge_currency: "usd", charge_amount: 434.85 }) });
    const r = await fn(new Request("http://fn.test/", { method, headers: { ...(auth ? { authorization: auth } : {}), "content-type": "application/json", ...(origin ? { origin } : {}) }, ...(method === "POST" ? { body: JSON.stringify(body || { requestId: "req-1", sessionId: "cs_1" }) } : {}) }));
    const text = await r.text(); w.restore();
    return { status: r.status, h: Object.fromEntries(r.headers), text, post: w.log.posts[0] };
  };
  for (const [name, fn] of [["school-stripe-checkout", checkout], ["verify-school-payment", verify]]) {
    const bad = [];
    for (const o of ORIGINS) {
      const r = await call(fn, { method: "OPTIONS", origin: o });
      if (r.h["access-control-allow-origin"] !== o || r.h.vary !== "Origin" || r.h["access-control-allow-methods"] !== "POST, OPTIONS" || !/authorization/.test(r.h["access-control-allow-headers"]) || !/apikey/.test(r.h["access-control-allow-headers"]) || !/content-type/.test(r.h["access-control-allow-headers"])) bad.push(o + " -> " + JSON.stringify(r.h));
    }
    ok(bad.length === 0, `${name}: a preflight from each of the six allowed origins (github.io, www.tigaalpha.com, tigaalpha.com, three localhost ports) is answered with that origin, Vary: Origin, POST / OPTIONS and the three headers the client sends`, bad.join(" ; "));
    const foreign = [];
    for (const o of ["https://evil.example", "http://www.tigaalpha.com", "https://www.tigaalpha.com.evil.example", "https://tigaalpha.com:8443", "null", undefined]) {
      const r = await call(fn, { method: "OPTIONS", origin: o });
      if (r.h["access-control-allow-origin"] !== SITE0) foreign.push(String(o) + " -> " + r.h["access-control-allow-origin"]);
    }
    ok(foreign.length === 0, `${name}: an origin that is not on the list (a look-alike, plain http, another port, "null", none) is never echoed: the answer names github.io`, foreign.join(" ; "));
    const r401 = await call(fn, { origin: "https://www.tigaalpha.com", auth: "Bearer nope" });
    ok(r401.status === 401 && r401.h["access-control-allow-origin"] === "https://www.tigaalpha.com", `${name}: the 401 for a page on www.tigaalpha.com also names www (the browser can read the refusal instead of a CORS failure)`);
  }
  // the buyer is sent back to the domain he paid from (https only); everything else goes to github.io as before
  const back = [];
  for (const [o, want] of [["https://www.tigaalpha.com", "https://www.tigaalpha.com"], ["https://tigaalpha.com", "https://tigaalpha.com"], ["https://tigaalpha.github.io", SITE0], ["http://localhost:5173", SITE0], ["https://evil.example", SITE0], [undefined, SITE0]]) {
    const r = await call(checkout, { origin: o, body: { requestId: "req-1" } }), f = r.post ? form(r.post) : {};
    if (f.success_url !== want + "/?school_paid=1&req=req-1&session_id={CHECKOUT_SESSION_ID}" || f.cancel_url !== want + "/?school_paid=0") back.push(String(o) + " -> " + f.success_url);
  }
  ok(back.length === 0, "school-stripe-checkout: success_url / cancel_url return the buyer to the https domain he paid from (www.tigaalpha.com, tigaalpha.com, github.io); localhost, an unknown origin and none go to github.io", back.join(" ; "));
  // character for character what the base commit shipped (the repo base already had these; the live v5 / v4 predate them)
  const norm = (t) => t.replace(/\s+/g, " ").trim();
  const parts = (src) => ({
    head: norm(src.slice(src.indexOf("const SITE ="), src.indexOf("serve(async"))),   // SITE, ALLOW, siteOf (checkout), cors, jwtPayload
    gate: norm((src.match(/const payload = jwtPayload\([\s\S]*?"Sign in required"[^\n]*\n\s*\}/) || [""])[0]),
    own: norm((src.match(/if \(row\.requester_id !== payload\.sub\)[\s\S]*?"not your request"[^\n]*\n?(?:\s*\})?/) || [""])[0]),
  });
  for (const [name, now, base] of [["school-stripe-checkout", read(CHECKOUT), baseCheckoutSrc], ["verify-school-payment", read(VERIFY), baseVerifySrc]]) {
    const a = parts(now);
    ok(a.head.includes("function cors(") && a.head.includes("function jwtPayload(") && a.gate.includes("payload.role !== \"authenticated\"") && a.gate.includes("status: 401") && a.own.includes("status: 403") && a.own.includes("row.requester_id !== payload.sub"), `${name}: the pieces compared below were found (CORS, jwtPayload, the sign-in gate, the own-request gate)`, JSON.stringify({ head: a.head.length, gate: a.gate, own: a.own }));
    const list = (a.head.match(/const ALLOW = \[([^\]]*)\]/) || [])[1] || "";
    eq(list.split(",").map((x) => x.trim().replace(/^SITE$/, JSON.stringify(SITE0)).replace(/"/g, "")), ORIGINS, `${name}: the allow-list is exactly the six origins (no wildcard, nothing added)`);
    if (haveBase) { const b = parts(base); eq([a.head, a.gate, a.own], [b.head, b.gate, b.own], `${name}: ALLOW, ${name === "school-stripe-checkout" ? "siteOf, " : ""}cors, jwtPayload, the sign-in gate and the own-request gate are the base commit's, character for character (nothing weakened)`); }
  }
  if (!haveBase) skip("the CORS / gate code against the base commit's", "base commit missing");
}

// B9. a failed write must never be answered "paid" (found by the final review; the base function ignored the PATCH result): the buyer has paid, the row would stay pending and staff would see nothing
{
  const sess = { id: "cs_1", payment_status: "paid", currency: "thb", amount_total: 1380000, metadata: { request_id: "req-1" }, client_reference_id: "req-1" };
  const w = world({ "req-1": row0() }, { cs_1: sess }, { failPatch: true });
  const r = await verify(req({ requestId: "req-1", sessionId: "cs_1" })); const j = await r.json().catch(() => null); w.restore();
  ok(r.status === 500 && j && j.error === "payment not recorded" && j.status !== "paid", "B9: when the database refuses the write the function answers 500 'payment not recorded', never {status: paid}", JSON.stringify({ s: r.status, j }));
  ok(w.log.errors.some((e) => /school payment not recorded/.test(e) && /req-1/.test(e) && /503/.test(e)), "B9: ... and logs one line with the request id, the session id and the HTTP status", JSON.stringify(w.log.errors));
}
// B10. a currency named after an Object.prototype key is refused by BOTH functions (the lookup used to be a truthiness test on a plain object)
for (const cur of ["constructor", "toString", "__proto__"]) {
  const row = row0({ charge_currency: cur, charge_amount: 434.85, method: "stripe" });
  const c = await pay(row); ok(c.status === 500 && c.body && c.body.error === "bad currency on request" && c.posts.length === 0, `B10: school-stripe-checkout refuses the currency '${cur}' and sends nothing to Stripe`, JSON.stringify(c.body));
  const v = await ver(row, { id: "cs_1", payment_status: "paid", currency: "usd", amount_total: 43485, metadata: { request_id: "req-1" } });
  ok(v.status === 409 && v.patches.length === 0, `B10: verify-school-payment refuses to mark a '${cur}' row paid (409, no write)`, JSON.stringify({ s: v.status, p: v.patches }));
}

// ══ C. the real modal ════════════════════════════════════════════════════════════════════════════════════════════════════════════
const rpcLog = [], fetchLog = [];
const UNIT = { thb: { month: 920, year: 10700 }, usd: { month: 28.99, year: 334.99 }, cny: { month: 210, year: 2360 } };
let rpcImpl = async (name, a) => {
  const id = "req-" + rpcLog.length;
  if (name === "school_submit_payment_request") return { data: { id, amount: UNIT.thb[a.p_cycle] * a.p_seats }, error: null };
  if (name === "school_submit_payment_request_v2") return { data: { id, amount_thb: UNIT.thb[a.p_cycle] * a.p_seats, currency: a.p_currency, charge_amount: Math.round(UNIT[a.p_currency][a.p_cycle] * a.p_seats * 100) / 100 }, error: null };
  return { data: null, error: { message: "unknown rpc " + name } };
};
const defaultRpc = rpcImpl;
globalThis.__rpc = async (name, args) => { rpcLog.push({ name, args }); return rpcImpl(name, args); };
let edgeReply = { status: 200, body: { url: "https://checkout.stripe.test/c/pay_1" } };
let edgeGate = null;   // a promise the edge-function stub waits on: a card checkout that is still opening
// what stripe-checkout answers to the mode probe. payment.tsx asks once per module instance and keeps the answer, so a scenario that needs another answer starts a fresh instance (fresh())
const PROBE = {
  live: () => new Response(JSON.stringify({ mode: "live" }), { status: 200 }),
  test: () => new Response(JSON.stringify({ mode: "test" }), { status: 200 }),
  none: () => new Response(JSON.stringify({ error: "Stripe not configured", mode: "none" }), { status: 503 }),
  down: () => { throw new Error("offline"); },
  pending: () => new Promise(() => {}),   // never answers: the probe is still in flight for as long as the scenario runs
};
let stripeProbe = PROBE.live;
globalThis.fetch = async (url, init = {}) => {
  url = String(url); fetchLog.push({ url, body: init.body ? JSON.parse(init.body) : null });
  if (url.endsWith("/functions/v1/stripe-checkout")) return stripeProbe();
  if (url.endsWith("/functions/v1/school-stripe-checkout")) { if (edgeGate) await edgeGate; return new Response(JSON.stringify(edgeReply.body), { status: edgeReply.status }); }
  throw new Error("unexpected fetch " + url);
};
const session = { user: { id: "u1" } }, payCfg = { promptpay: "0812345678", name: "TIGA", bank: "KBank", bank_account: "123-4-56789-0", bank_swift: "" };
async function mount(lang, { cfg = payCfg, tier = "standard", Comp = P.SchoolCheckoutModal, R = { React, createRoot, act } } = {}) {
  const host = document.getElementById("root"); host.innerHTML = "";
  const root = R.createRoot(host);
  await R.act(async () => { root.render(R.React.createElement(Comp, { lang, schoolCheckout: { tier }, payCfg: cfg, session, onClose() {}, playUi() {} })); });
  await R.act(async () => { await new Promise((r) => setTimeout(r, 20)); });   // the Stripe mode probe
  const btn = (re) => [...host.querySelectorAll("button")].find((b) => re.test(b.textContent));
  const tick = () => R.act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  return {
    host, btn, $: (s) => host.querySelector(s), text: () => host.textContent, sum: () => (host.querySelector(".paysum") || { textContent: "" }).textContent,
    labels: () => [...host.querySelectorAll("button")].map((b) => b.textContent),
    note: () => [...host.querySelectorAll("p.pr-sub")].map((p) => p.textContent).find((t) => /扫一扫/.test(t)),
    click: async (el) => {
      if (!el) throw new Error("a button this scenario needs is not on the screen (the screen changed under the script); buttons now: " + JSON.stringify([...host.querySelectorAll("button")].map((b) => b.textContent)));
      await R.act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); await tick();
    },
    type: async (el, v) => { await R.act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); }); },
    unmount: () => R.act(async () => root.unmount()),
  };
}
const NEXT = /Next|ถัดไป|下一步/;
async function toPay(m, { seats, yearly } = {}) {
  await m.type(m.$("input.aicreate-in"), "Test School");
  if (seats) await m.type(m.$("input[type=number]"), String(seats));
  if (yearly) await m.click([...m.host.querySelectorAll(".billtog")][1]);
  await m.click(m.btn(NEXT));
}
const reset = () => { rpcLog.length = 0; fetchLog.length = 0; edgeReply = { status: 200, body: { url: "https://checkout.stripe.test/c/pay_1" } }; edgeGate = null; rpcImpl = defaultRpc; stripeProbe = PROBE.live; };
const edgeCall = () => fetchLog.filter((f) => f.url.endsWith("/school-stripe-checkout")).pop();

// C0. Thai side by side: the base commit's modal and this one, driven by the same script, must show the same text at every step and make the same calls
// (the scenarios and drive() are defined once, outside the `if`, because C7 drives the same Thai script with the card off)
const scenarios = {
  "details, then PromptPay": async (m, snap) => { snap("details"); await toPay(m); snap("methods"); await m.click(m.btn(/PromptPay/)); snap("PromptPay"); },
  "yearly 20 seats, then bank transfer": async (m, snap) => { await toPay(m, { seats: 20, yearly: true }); snap("methods"); await m.click(m.btn(/โอนเข้าบัญชี/)); snap("bank"); },
  "16 seats, then the card": async (m, snap) => { await toPay(m, { seats: 16 }); snap("methods"); await m.click(m.btn(/บัตร/)); snap("after the card"); },
  "plus tier yearly, then PromptPay": async (m, snap) => { await toPay(m, { seats: 30, yearly: true }); await m.click(m.btn(/PromptPay/)); snap("PromptPay"); },
  "validation: no name, then 14 seats": async (m, snap) => { await m.click(m.btn(NEXT)); snap("no name"); await m.type(m.$("input.aicreate-in"), "X"); await m.type(m.$("input[type=number]"), "14"); await m.click(m.btn(NEXT)); snap("14 seats"); },
  "the database refuses": async (m, snap) => { rpcImpl = async () => ({ data: null, error: { message: "boom" } }); await toPay(m); await m.click(m.btn(/PromptPay/)); snap("refused"); },
  "a card that fails to open": async (m, snap) => { edgeReply = { status: 500, body: { error: "Stripe 500" } }; await toPay(m); await m.click(m.btn(/บัตร/)); snap("failed"); },
};
const drive = async (Comp, name, lang = "th", all = scenarios, R, probe = PROBE.live) => {
  reset(); stripeProbe = probe; const snaps = [];
  const m = await mount(lang, { Comp, tier: name.startsWith("plus") ? "plus" : "standard", ...(R ? { R } : {}) });
  await all[name](m, (label, text) => snaps.push([label, text === undefined ? m.text() : text, m.note() || null]));
  await m.unmount();
  return { snaps, rpc: rpcLog.map((r) => [r.name, r.args]), edge: fetchLog.filter((f) => f.url.endsWith("/school-stripe-checkout")).map((f) => { const b = { ...f.body }; delete b.expect; delete b.cur; return b; }) };
};
if (haveBase) {
  for (const name of Object.keys(scenarios)) {
    const a = await drive(B.SchoolCheckoutModal, name), b = await drive(P.SchoolCheckoutModal, name);
    ok(a.snaps.length > 0 && a.snaps.every((s) => s[1].length > 20), `th side by side: "${name}": the script really drove the base modal (${a.snaps.length} screens read)`);
    eq(b, a, `th side by side with the base commit's modal: "${name}": the same text at every step, the same RPC calls, the same edge call`);
  }
  // Review findings 1, 3, 5 (owner brief rule 4: "the manual channels stay in THB exactly as today"): the Chinese Alipay / WeChat rails are the base commit's, screen for screen and call for call.
  // Only the screens AFTER a rail is chosen are compared: before it, the headline is the card price in yuan and the baht rails say their baht price on the button (both on purpose, tested in C3).
  const zhScenarios = {
    "Alipay, 15 seats monthly": async (m, snap) => { await toPay(m); await m.click(m.btn(/支付宝付款/)); snap("Alipay"); },
    "WeChat, 20 seats yearly": async (m, snap) => { await toPay(m, { seats: 20, yearly: true }); await m.click(m.btn(/微信付款/)); snap("WeChat"); },
    "plus tier Alipay, 30 seats yearly": async (m, snap) => { await toPay(m, { seats: 30, yearly: true }); await m.click(m.btn(/支付宝付款/)); snap("Alipay"); },
    // no rail was chosen here, so the screen is the method screen, which differs from the base's on purpose (the headline is the card price, the baht rails name their baht price):
    // what must be the same is the refusal text on the red line, that the buyer is still on the method screen (the same four buttons), and the calls
    "Alipay, the database refuses": async (m, snap) => { rpcImpl = async () => ({ data: null, error: { message: "boom" } }); await toPay(m); await m.click(m.btn(/支付宝付款/)); snap("refused", `red line: ${(m.$(".aicreate-err") || { textContent: "(none)" }).textContent}; still on the method screen with ${m.labels().length} buttons; no QR line`); },
  };
  for (const name of Object.keys(zhScenarios)) {
    const a = await drive(B.SchoolCheckoutModal, name, "zh", zhScenarios), b = await drive(P.SchoolCheckoutModal, name, "zh", zhScenarios);
    ok(a.snaps.length > 0 && a.snaps.every((s) => s[1].length > 20) && (name.includes("refuses") || a.snaps.some((s) => /支付 ¥/.test(s[2] || ""))), `zh side by side: "${name}": the script really drove the base modal and reached its QR line / refusal (${a.snaps.length} screens read)`, JSON.stringify(a.snaps.map((s) => s[2])));
    eq(b, a, `zh side by side with the base commit's modal: "${name}": the same text (headline and QR line included), the same RPC calls (the ORIGINAL five-argument function, no currency), the same edge calls`);
  }
  // what is NOT the same, deliberately: the new client also tells the edge function which price it displayed (the server only compares it)
  reset(); const a = await mount("th", { Comp: B.SchoolCheckoutModal }); await toPay(a, { seats: 16 }); await a.click(a.btn(/บัตร/)); const oldBody = edgeCall().body; await a.unmount();
  reset(); const b = await mount("th"); await toPay(b, { seats: 16 }); await b.click(b.btn(/บัตร/)); const newBody = edgeCall().body; await b.unmount();
  eq([oldBody, newBody], [{ requestId: "req-1" }, { requestId: "req-1", expect: 14720, cur: "thb" }], "th: the one difference on the wire: the edge function also gets the price shown (14,720 baht) and its currency, which it only compares");
} else skip("the Thai modal side by side with the base commit's", "base commit missing");

// C1. Thai: the screens read exactly what they read before this change (golden text, kept even when the base commit is missing)
{
  reset(); const m = await mount("th");
  eq(m.text(), "🏫 สมัคร School Plan — Standard✕กรอกข้อมูลสถาบันเพื่อคำนวณยอดชำระที่นั่ง (ขั้นต่ำ 15)รายเดือนรายปีStandard × 15 ที่นั่ง฿13,800/เดือนถัดไป: เลือกวิธีชำระเงิน", "th: the details screen is word for word what it was");
  await toPay(m);
  eq(m.text(), "🏫 สมัคร School Plan — Standard✕Test School · Standard × 15฿13,800/เดือน💳 จ่ายด้วยบัตร (รองรับทั่วโลก)🇹🇭 จ่ายผ่าน PromptPay🏦 โอนเข้าบัญชีธนาคาร‹ กลับ", "th: the method screen is word for word what it was (no price on any button)");
  await m.click(m.btn(/PromptPay/));
  eq(m.text(), "🏫 สมัคร School Plan — Standard✕Test School · Standard × 15฿13,800/เดือน📱 PromptPay: 0812345678👤 TIGAสแกน QR ด้วยแอปธนาคาร โอนตามยอด แล้วอัปโหลดสลิปเพื่อยืนยัน📤 อัปโหลดสลิป", "th: the PromptPay screen is word for word what it was");
  ok(rpcLog.length === 1 && rpcLog[0].name === "school_submit_payment_request" && Object.keys(rpcLog[0].args).sort().join() === "p_cycle,p_institution_name,p_method,p_seats,p_tier" && rpcLog[0].args.p_method === "promptpay", "th: PromptPay calls the original five-argument function", JSON.stringify(rpcLog));
  await m.unmount();
  reset(); const b = await mount("th"); await toPay(b, { seats: 20, yearly: true });
  eq(b.sum(), "Test School · Standard × 20฿214,000/ปี", "th: yearly 20 seats = ฿214,000/ปี");
  await b.click(b.btn(/โอนเข้าบัญชี/));
  eq(b.text(), "🏫 สมัคร School Plan — Standard✕Test School · Standard × 20฿214,000/ปี🏦 ธนาคาร: KBank👤 ชื่อบัญชี: TIGA#️⃣ เลขที่บัญชี: 123-4-56789-0💰 ยอดที่ต้องโอน: ฿214,000โอนตามยอดด้านบนเข้าบัญชีนี้ แล้วอัปโหลดสลิปเพื่อยืนยัน📤 อัปโหลดสลิป", "th: the bank-transfer screen is word for word what it was");
  await b.unmount();
  reset(); const c = await mount("th"); await toPay(c, { seats: 16 });
  await c.click(c.btn(/บัตร/));
  ok(rpcLog.length === 1 && rpcLog[0].name === "school_submit_payment_request" && rpcLog[0].args.p_method === "stripe" && rpcLog[0].args.p_seats === 16, "th: the card calls the original five-argument function");
  ok(edgeCall() && edgeCall().body.requestId === "req-1" && edgeCall().body.expect === 14720 && edgeCall().body.cur === "thb" && Object.keys(edgeCall().body).sort().join() === "cur,expect,requestId", "th: the edge function gets the row id and the figure shown (14,720 thb), which it only compares");
  await c.unmount();
}
// C2. English: dollars on the card, baht on the baht rails, never a number beside the wrong method
{
  reset(); const m = await mount("en");
  ok(/Standard × 15 seatsUS\$434\.85\/mo/.test(m.text()), "en: the details headline is the card price: US$28.99 x 15 = US$434.85/mo", m.text());
  await toPay(m);
  eq(m.sum(), "Test School · Standard × 15US$434.85/mo", "en: the method screen's headline is the card price");
  eq(m.labels().slice(1, 4), ["💳 Pay by card — worldwide", "🇹🇭 Pay via PromptPay · ฿13,800", "🏦 Pay by bank transfer · ฿13,800"], "en: the card names no price (the headline is its price), PromptPay and bank transfer name theirs in baht");
  await m.click(m.btn(/card/i));
  eq(rpcLog.map((r) => [r.name, r.args.p_method, r.args.p_currency, r.args.p_seats, r.args.p_cycle]), [["school_submit_payment_request_v2", "stripe", "usd", 15, "month"]], "en: the card calls _v2 with usd");
  eq(edgeCall().body, { requestId: "req-1", expect: 434.85, cur: "usd" }, "en: the edge function gets the row id and the figure shown, nothing else");
  await m.unmount();
  reset(); const p = await mount("en"); await toPay(p);
  await p.click(p.btn(/PromptPay/));
  ok(rpcLog.length === 1 && rpcLog[0].name === "school_submit_payment_request" && !("p_currency" in rpcLog[0].args), "en: PromptPay calls the ORIGINAL function, no currency");
  eq(p.sum(), "Test School · Standard × 15฿13,800/mo", "en: once PromptPay is chosen the headline is the baht amount of the row, not the dollar card price");
  ok(!!p.$("img.payqr"), "en: the PromptPay QR is drawn");
  await p.unmount();
  reset(); const y = await mount("en"); await toPay(y, { seats: 17, yearly: true });
  eq(y.sum(), "Test School · Standard × 17US$5,694.83/yr", "en: yearly 17 seats = US$5,694.83/yr");
  ok(y.btn(/PromptPay/).textContent.endsWith("· ฿181,900"), "en: and PromptPay says ฿181,900");
  await y.unmount();
}
// C3. Chinese: yuan on the CARD only. Alipay and WeChat stay what they always were (owner brief rule 4): baht, the original five-argument RPC, the same QR line.
//     Review findings 1, 3, 5: an earlier build moved them to yuan (_v2, 支付 ¥3,150); that is the owner's decision, not this branch's, and a Chinese client shipped before the SQL would have
//     lost both buttons to PostgREST's raw "could not find the function" text.
{
  reset(); const m = await mount("zh");
  ok(/¥3,150\/月/.test(m.text()), "zh: the details headline is the CARD price in yuan: ¥210 x 15 = ¥3,150/月", m.text());
  await toPay(m);
  eq(m.sum(), "Test School · Standard × 15¥3,150/月", "zh: the method screen's headline is the card price in yuan");
  eq(m.labels().slice(1, 4), ["💳 银行卡支付（支持全球）", "🔵 支付宝付款 · ฿13,800", "🟢 微信付款 · ฿13,800"], "zh: Alipay and WeChat are baht rails and say their baht price on the button (a yuan headline above must not be read as their price)");
  await m.click(m.btn(/支付宝付款/));
  eq(rpcLog.map((r) => [r.name, r.args.p_method, "p_currency" in r.args]), [["school_submit_payment_request", "alipay", false]], "zh: Alipay calls the ORIGINAL five-argument function, with no currency");
  eq(Object.keys(rpcLog[0].args).sort().join(), "p_cycle,p_institution_name,p_method,p_seats,p_tier", "zh: and exactly the five arguments it always sent");
  ok(/支付 ¥13,800$/.test(m.note()) && m.sum() === "Test School · Standard × 15฿13,800/月", "zh: the Alipay screen reads exactly what it always read: headline ฿13,800/月 and the QR line 支付 ¥13,800 (the baht figure behind a yen sign, the owner's call to change)", m.note() + " | " + m.sum());
  await m.unmount();
  reset(); const w = await mount("zh"); await toPay(w, { seats: 20, yearly: true });
  await w.click(w.btn(/微信付款/));
  ok(/支付 ¥214,000$/.test(w.note()) && rpcLog.length === 1 && rpcLog[0].name === "school_submit_payment_request" && rpcLog[0].args.p_method === "wechat" && rpcLog[0].args.p_cycle === "year" && !("p_currency" in rpcLog[0].args), "zh: WeChat yearly 20 seats: the original function, no currency, the QR line says 支付 ¥214,000 as before", w.note() + " " + JSON.stringify(rpcLog));
  await w.unmount();
  reset(); const k = await mount("zh"); await toPay(k);
  await k.click(k.btn(/银行卡支付/));
  eq([rpcLog[0].name, rpcLog[0].args.p_currency, edgeCall().body.expect, edgeCall().body.cur], ["school_submit_payment_request_v2", "cny", 3150, "cny"], "zh: the card is charged in yuan");
  await k.unmount();
  // no manual rail can ever reach _v2 or carry a currency, in any language (the one place a method becomes a currency is curOf)
  for (const lang of ["th", "en", "zh"]) {
    reset(); const probe = await mount(lang); await toPay(probe);
    const rails = [/PromptPay/, /โอนเข้าบัญชี|bank transfer/i, /支付宝付款/, /微信付款/].filter((re) => probe.btn(re));
    await probe.unmount();
    ok(rails.length === 2, `${lang}: the two manual rails this language shows are found`, String(rails));
    for (const re of rails) {
      reset(); const y = await mount(lang); await toPay(y); await y.click(y.btn(re));
      ok(rpcLog.length === 1 && rpcLog[0].name === "school_submit_payment_request" && !("p_currency" in rpcLog[0].args), `${lang}: ${re} is a manual rail: the original function, no currency`, JSON.stringify(rpcLog));
      await y.unmount();
    }
  }
}
// C4. every other language is dollars, card only
for (const lang of ["ja", "ko", "ru", "hi", "es", "fr", "ar", "de"]) {
  reset(); const m = await mount(lang);
  ok(/US\$434\.85/.test(m.text()), `${lang}: the details headline is dollars`);
  await toPay(m);
  ok(m.labels().length === 3 && !/PromptPay|Alipay|WeChat|支付宝|微信/.test(m.labels().join("|")), `${lang}: card only (no PromptPay, bank or Alipay button)`);
  await m.click(m.labels().length ? m.btn(/💳/) : null);
  ok(rpcLog.length === 1 && rpcLog[0].name === "school_submit_payment_request_v2" && rpcLog[0].args.p_currency === "usd", `${lang}: the card is charged in dollars`);
  await m.unmount();
}
// C5. retries and edits: one row per distinct request, and a failed attempt never blocks the next
{
  reset(); edgeReply = { status: 500, body: { error: "Stripe 500" } };
  const m = await mount("en"); await toPay(m);
  await m.click(m.btn(/card/i));
  ok(/Stripe unavailable/.test(m.text()), "a failed card attempt shows the existing error line");
  await m.click(m.btn(/card/i)); ok(rpcLog.length === 1, "clicking the card again reuses the row (one RPC call, not two)");
  await m.click(m.btn(/PromptPay/)); eq(rpcLog.map((r) => r.name + ":" + r.args.p_method), ["school_submit_payment_request_v2:stripe", "school_submit_payment_request:promptpay"], "choosing PromptPay after a failed card attempt creates its own baht row (the guard used to stay set and make this a silent no-op)");
  await m.unmount();
  reset(); edgeReply = { status: 500, body: { error: "x" } };
  const e = await mount("en"); await toPay(e, { seats: 15 });
  await e.click(e.btn(/card/i)); await e.click(e.btn(/Back/)); await e.type(e.$("input[type=number]"), "30"); await e.click(e.btn(NEXT)); await e.click(e.btn(/card/i));
  eq(rpcLog.map((r) => r.args.p_seats), [15, 30], "changing the seats after a row exists prices a NEW row (the modal used to reuse the 15-seat row)");
  eq(edgeCall().body.expect, 869.7, "and the card is asked for the 30-seat total, US$869.70");
  await e.unmount();
  // a second method tapped while the card checkout is still opening must not create a second request (the old guard that never released did this by accident; it is explicit now)
  const inflight = [["this build", P.SchoolCheckoutModal], ...(haveBase ? [["the base commit's modal", B.SchoolCheckoutModal]] : [])];
  for (const [label, Comp] of inflight) {
    reset(); let release; edgeGate = new Promise((r) => { release = r; });
    const m = await mount("th", { Comp }); await toPay(m);
    await m.click(m.btn(/บัตร/));                                  // the card: the request is made, the edge function has not answered yet
    const afterCard = rpcLog.length;
    await m.click(m.btn(/PromptPay/));                             // a second method meanwhile
    ok(afterCard === 1 && rpcLog.length === 1 && /จ่ายผ่าน PromptPay/.test(m.text()) && !/สแกน QR/.test(m.text()), `${label}: while the card checkout is opening, tapping PromptPay creates nothing (one RPC call, still on the method screen)`, JSON.stringify(rpcLog.map((r) => r.name)));
    release(); await m.click(m.$(".setcard")); await m.unmount();
  }
  reset(); rpcImpl = async () => ({ data: null, error: { message: "too many seats for one card payment: contact us" } });
  const big = await mount("en"); await toPay(big, { seats: 3000, yearly: true }); await big.click(big.btn(/card/i));
  ok(/over the limit for one card payment/.test(big.text()) && !/too many seats/.test(big.text()) && !fetchLog.some((f) => f.url.endsWith("/school-stripe-checkout")), "the database's refusal reads in the buyer's language, and nothing is sent to Stripe"); await big.unmount();
  reset(); rpcImpl = async () => ({ data: null, error: { message: "Could not find the function public.school_submit_payment_request_v2 in the schema cache" } });
  const early = await mount("en"); await toPay(early); await early.click(early.btn(/card/i));
  ok(/Could not find the function/.test(early.text()) && !fetchLog.some((f) => f.url.endsWith("/school-stripe-checkout")), "a client that runs before the SQL is applied shows the error and sends nothing to Stripe (it never falls back to another currency)"); await early.unmount();
  reset();
}
// C6. the refusal in every language, from the REAL catalogs (the stub catalogs of the bundle above are empty)
{
  const SR = await stage(path.join(TMP, "app-real"), { realCatalogs: true });
  const KEY = "This order is over the limit for one card payment — please contact us";
  const catalog = JSON.parse(read("i18n-src/catalog.json"));
  // i18n-de.ts is empty until the German translation is merged: de joins this check once it holds entries
  const deReady = /^\s*"[^"\n]+"\s*:/m.test(read("i18n-de.ts"));
  if (!deReady) console.log("de catalog empty: skipped (the refusal sentence in German is checked once i18n-de.ts holds the catalog)");
  const REFUSAL_LANGS = deReady ? ["ja", "ko", "ru", "hi", "es", "fr", "ar", "de"] : ["ja", "ko", "ru", "hi", "es", "fr", "ar"];
  ok(!!catalog[KEY] && REFUSAL_LANGS.every((l) => typeof catalog[KEY][l] === "string" && catalog[KEY][l].trim().length > 8), "the refusal sentence is in i18n-src/catalog.json for all seven extra languages");
  const WANT = { th: "ยอดสั่งซื้อเกินวงเงินต่อครั้งของการจ่ายด้วยบัตร กรุณาติดต่อเรา", en: KEY, zh: "订单金额超过单次刷卡限额，请联系我们", ...Object.fromEntries(REFUSAL_LANGS.map((l) => [l, catalog[KEY] && catalog[KEY][l]])) };
  const seen = [];
  for (const lang of Object.keys(WANT)) {
    await SR.L.loadCatalog(lang);
    reset(); rpcImpl = async () => ({ data: null, error: { message: "too many seats for one card payment: contact us" } });
    const m = await mount(lang, { Comp: SR.P.SchoolCheckoutModal, R: { React: SR.React, createRoot: SR.createRoot, act: SR.React.act } });
    // the buttons are in the buyer's language here, so they are found by their place, not their words: the only green button of the details step is "Next", the card button starts with 💳
    await m.type(m.$("input.aicreate-in"), "Test School"); await m.type(m.$("input[type=number]"), "3000"); await m.click([...m.host.querySelectorAll(".billtog")][1]); await m.click(m.$("button.songbtn.go"));
    const card = m.btn(/💳/); if (card) await m.click(card);
    const shown = (m.$(".aicreate-err") || { textContent: "" }).textContent;
    seen.push([lang, shown === WANT[lang], lang === "th" || lang === "zh" || lang === "en" ? "" : shown === KEY ? "English leaked" : ""]);
    await m.unmount();
  }
  eq(seen.map((s) => s[0] + ":" + s[1]), Object.keys(WANT).map((l) => l + ":true"), "the database's refusal reads in the buyer's own language in all ten languages (th, en, zh from the code, the other seven from the real catalogs)");
  ok(seen.every((s) => !s[2]), "and no extra language falls back to the English sentence");
  reset();
}

// C7. THE HEADLINE BELONGS TO A METHOD THE BUYER CAN PICK. Review finding: with the card off (a test key, no key, no answer) an English or Chinese buyer saw the CARD price in dollars / yuan
//     over buttons that all charge baht. Each case runs in a FRESH instance of the bundle because payment.tsx keeps the Stripe mode probe's answer per instance.
{
  const H = (F) => ({ Comp: F.P.SchoolCheckoutModal, R: rOf(F) });
  for (const [why, probe] of [["a test key (the probe says test)", PROBE.test], ["no Stripe key (503, mode none)", PROBE.none], ["the probe cannot be reached", PROBE.down]]) {
    reset(); stripeProbe = probe; const F = await fresh();
    // English: baht rails only
    let m = await mount("en", H(F));
    ok(/Standard × 15 seats฿13,800\/mo/.test(m.text()) && !/US\$/.test(m.text()), `en, card off (${why}): the details headline is the baht price ฿13,800, no dollar figure`, m.text());
    await toPay(m);
    eq(m.sum(), "Test School · Standard × 15฿13,800/mo", `en, card off (${why}): the method screen's headline is ฿13,800`);
    eq(m.labels().slice(1), ["🇹🇭 Pay via PromptPay", "🏦 Pay by bank transfer", "‹ Back"], `en, card off (${why}): no card button, and the baht buttons add no baht note (the headline already is baht)`);
    await m.click(m.btn(/PromptPay/));
    eq([m.sum(), rpcLog.map((r) => r.name + ":" + r.args.p_method + ":" + ("p_currency" in r.args))], ["Test School · Standard × 15฿13,800/mo", ["school_submit_payment_request:promptpay:false"]], `en, card off (${why}): PromptPay keeps its baht headline and the original five-argument function`);
    await m.unmount();
    // Chinese: Alipay / WeChat (baht rails) only
    reset(); stripeProbe = probe;
    m = await mount("zh", H(F));
    ok(/Standard × 15 席位฿13,800\/月/.test(m.text()) && !/¥/.test(m.text()), `zh, card off (${why}): the details headline is the baht price ฿13,800, no yuan figure`, m.text());
    await toPay(m);
    eq(m.sum(), "Test School · Standard × 15฿13,800/月", `zh, card off (${why}): the method screen's headline is ฿13,800`);
    eq(m.labels().slice(1), ["🔵 支付宝付款", "🟢 微信付款", "‹ 返回"], `zh, card off (${why}): no card button, Alipay and WeChat add no baht note`);
    await m.click(m.btn(/支付宝付款/));
    ok(/支付 ¥13,800$/.test(m.note()) && rpcLog.length === 1 && rpcLog[0].name === "school_submit_payment_request" && !("p_currency" in rpcLog[0].args), `zh, card off (${why}): Alipay still prints the line it always printed and uses the original function`, m.note());
    await m.unmount();
    // a card-only language with the card off: nothing at all can be picked, so the card price stays (it is what the pricing card said)
    reset(); stripeProbe = probe;
    m = await mount("ja", H(F)); await toPay(m);
    ok(m.labels().length === 2 && /US\$434\.85/.test(m.sum()), `ja, card off (${why}): no method at all is offered, the headline stays the card price (nothing wrong can be picked)`, JSON.stringify(m.labels()) + m.sum());
    await m.unmount();
    // English with the card off and no PromptPay / bank account configured: nothing offered either
    reset(); stripeProbe = probe;
    m = await mount("en", { ...H(F), cfg: {} }); await toPay(m);
    ok(m.labels().length === 2 && /US\$434\.85/.test(m.sum()), `en, card off (${why}) and no PromptPay / bank account configured: nothing offered, the headline stays the card price`, JSON.stringify(m.labels()) + m.sum());
    await m.unmount();
    // Chinese needs no configured account (its two rails always show), so with the card off the headline is baht even with an empty payment config
    reset(); stripeProbe = probe;
    m = await mount("zh", { ...H(F), cfg: {} }); await toPay(m);
    eq(m.sum(), "Test School · Standard × 15฿13,800/月", `zh, card off (${why}), empty payment config: Alipay / WeChat are still offered, so the headline is baht`);
    await m.unmount();
    // Thai: the base commit's modal and this one, side by side, with the card off: the same text at every step, the same calls
    if (haveBase) {
      const thScenarios = {
        "details, then PromptPay": scenarios["details, then PromptPay"], "yearly 20 seats, then bank transfer": scenarios["yearly 20 seats, then bank transfer"],
        "plus tier yearly, then PromptPay": scenarios["plus tier yearly, then PromptPay"], "validation: no name, then 14 seats": scenarios["validation: no name, then 14 seats"],
        "the database refuses": scenarios["the database refuses"],
      };
      const bad = [];
      for (const name of Object.keys(thScenarios)) {
        const a = await drive(F.B.SchoolCheckoutModal, name, "th", thScenarios, rOf(F), probe);
        const b = await drive(F.P.SchoolCheckoutModal, name, "th", thScenarios, rOf(F), probe);
        if (!(a.snaps.length > 0 && a.snaps.every((x) => x[1].length > 20)) || JSON.stringify(a) !== JSON.stringify(b)) bad.push(name);
      }
      ok(bad.length === 0, `th, card off (${why}): the base commit's modal and this one show the same text at every step and make the same calls (${Object.keys(thScenarios).length} scenarios)`, bad.join(" ; "));
    }
    reset();
  }
  // the probe has not answered yet: the card is still expected, so no flip to baht and back (the normal case, a moment after the modal opens)
  reset(); stripeProbe = PROBE.pending; const FP = await fresh();
  let m = await mount("en", H(FP));
  ok(/US\$434\.85/.test(m.text()), "en, the Stripe probe not answered yet: the details headline is still the card price (US$434.85): no flicker through baht", m.text());
  await toPay(m);
  eq(m.sum(), "Test School · Standard × 15US$434.85/mo", "en, probe pending: the method screen's headline is the card price");
  eq(m.labels().slice(1), ["🇹🇭 Pay via PromptPay · ฿13,800", "🏦 Pay by bank transfer · ฿13,800", "‹ Back"], "en, probe pending: no card button yet, but every baht button names its own baht price, so no number sits beside a method that does not charge it");
  await m.unmount();
  // and the live case is what C2 / C3 / C4 check; here: live, the card is offered, so the dollar headline and the baht notes stay
  reset(); const FL = await fresh();
  m = await mount("en", H(FL)); await toPay(m);
  eq([m.sum(), m.labels().slice(1)], ["Test School · Standard × 15US$434.85/mo", ["💳 Pay by card — worldwide", "🇹🇭 Pay via PromptPay · ฿13,800", "🏦 Pay by bank transfer · ฿13,800", "‹ Back"]], "en, card live: the dollar headline, the baht notes on the baht buttons (unchanged)");
  await m.unmount(); reset();
}
// C8. THE CLIENT BEFORE THE SQL (the other half of the wrong order in B7): only the dollar / yuan CARD needs school_submit_payment_request_v2. Everything else uses the original five-argument
//     function and works; the dollar / yuan card shows PostgREST's raw refusal on the red line and sends nothing to Stripe, creating no row.
{
  const noV2 = async (name, a) => name === "school_submit_payment_request_v2"
    ? { data: null, error: { message: "Could not find the function public.school_submit_payment_request_v2(p_currency, p_cycle, p_institution_name, p_method, p_seats, p_tier) in the schema cache" } }
    : defaultRpc(name, a);
  for (const [lang, what, re, works] of [
    ["th", "the card", /บัตร/, true], ["th", "PromptPay", /PromptPay/, true], ["en", "PromptPay", /PromptPay/, true], ["en", "the card", /💳/, false],
    ["zh", "Alipay", /支付宝付款/, true], ["zh", "WeChat", /微信付款/, true], ["zh", "the card", /💳/, false], ["ja", "the card", /💳/, false],
  ]) {
    reset(); rpcImpl = noV2;
    const m = await mount(lang); await toPay(m); await m.click(m.btn(re));
    const edge = fetchLog.some((f) => f.url.endsWith("/school-stripe-checkout")), raw = /Could not find the function public\.school_submit_payment_request_v2/.test(m.text());
    const ranOk = works ? (what === "the card" ? edge : /PromptPay|支付 ¥|微信|支付/.test(m.text()) && !raw) : (raw && !edge);
    ok(ranOk && rpcLog.filter((r) => r.name === "school_submit_payment_request_v2").length === (works ? 0 : 1), `client before the SQL: ${lang} ${what} ${works ? "still works (the original function)" : "shows the raw 'could not find the function' line, nothing goes to Stripe"}`, JSON.stringify({ raw, edge, rpc: rpcLog.map((r) => r.name) }));
    await m.unmount();
  }
  reset();
}

// ══ D. the admin list's money and the migration's shape ═══════════════════════════════════════════════════════════════════════════
eq([P.schoolReqAmount({ amount: 13800 }), P.schoolReqAmount({ amount: 13800, charge_currency: "thb", charge_amount: null }), P.schoolReqAmount({ amount: "214000.00" })], ["฿13,800", "฿13,800", "฿214,000"], "admin: a baht row prints what it always printed, with or without the new fields");
eq([P.schoolReqAmount({ amount: 13800, charge_currency: "usd", charge_amount: 434.85 }), P.schoolReqAmount({ amount: 321000, charge_currency: "cny", charge_amount: 70800 })], ["US$434.85 (฿13,800)", "¥70,800 (฿321,000)"], "admin: a dollar / yuan row prints the charge first and the baht list price in brackets");
ok(/\{schoolReqAmount\(r\)\}/.test(read("App.tsx")) && !/฿\{Number\(r\.amount\)\.toLocaleString\(\)\}/.test(read("App.tsx")), "App.tsx's admin list prints the request with schoolReqAmount, not a hard-coded ฿");
ok(/^begin;/m.test(MIG) && /^commit;/m.test(MIG), "the migration is one transaction (begin ... commit)");
ok(!/create (or replace )?function\s+public\.school_submit_payment_request\s*\(/i.test(MIG), "the migration does not touch the five-argument school_submit_payment_request");
ok(/school_submit_payment_request_v2\(\s*p_institution_name text, p_tier text, p_seats int, p_cycle text, p_method text, p_currency text\s*\)/.test(MIG), "the new function is school_submit_payment_request_v2 with a sixth, undefaulted p_currency (a defaulted overload makes five-argument calls ambiguous)");
ok(/charge_currency text\s+not null default 'thb'/.test(MIG) && /add column if not exists charge_amount\s+numeric/.test(MIG) && /school_payment_requests_charge_ck/.test(MIG), "the migration adds charge_currency (default thb), charge_amount and the CHECK, all re-runnable");
ok(/raise exception 'the school price table does not match payment\.tsx/.test(MIG) && /notify pgrst, 'reload schema'/.test(MIG), "the migration rolls itself back on a wrong price and reloads the API schema");
{
  // the SQL without its comments and without the column documentation strings (those name PromptPay and the others in prose)
  const code = MIG.replace(/--[^\n]*/g, "").replace(/comment on column [^;]*;/g, "");
  const v2 = (code.match(/create or replace function public\.school_submit_payment_request_v2\([\s\S]*?\bend; \$\$;/) || [""])[0];
  ok(v2.length > 600, "the body of school_submit_payment_request_v2 was found in the migration", String(v2.length));
  ok(/coalesce\(p_currency, ''\) not in \('usd','cny'\)/.test(v2) && /if p_method is distinct from 'stripe' then\s*raise exception 'invalid method for this currency';/.test(v2), "v2 accepts only usd / cny, only for the card (p_method 'stripe'), and refuses a null method itself (null-safe checks)");
  ok(!/alipay|wechat|promptpay|banktransfer/i.test(code), "the migration's code never names a manual rail: only the card can carry a dollar / yuan charge, PromptPay / bank transfer / Alipay / WeChat rows can only be baht (owner brief rule 4)");
  // the five survivors of the review's mutation run, as strict text pins (E proves each one by behaviour on a real Postgres; these stand when no Postgres is installed)
  ok(/check \(\s*\(charge_currency = 'thb' and charge_amount is null\)\s*or \(charge_currency in \('usd','cny'\) and charge_amount is not null and charge_amount > 0 and method = 'stripe'\)\s*\)/.test(code), "pin 1 of 5, the CHECK: a baht row has no charge_amount; a dollar / yuan row has a positive one AND is a card row (method = 'stripe'): 'and true' or a second method fails here");
  ok(/if p_method = 'stripe' and v_charge \* 100 > 99999999(?![0-9]) then raise exception 'too many seats for one card payment: contact us'; end if;/.test(v2), "pin 2 of 5, the Stripe cap: v2 refuses a card order of more than 99,999,999 of the smallest unit (8 digits), with that exact number (the 'off by ten' mutant 999999999 fails here)");
  ok(/if coalesce\(p_seats, 0\) < 15 then raise exception 'minimum 15 seats'; end if;/.test(v2), "pin 3 of 5, the minimum: v2 itself refuses fewer than 15 seats with 'minimum 15 seats'");
  ok(/\) returns jsonb\s*language plpgsql security definer set search_path = public as \$\$\s*declare v_uid uuid := auth\.uid\(\);/.test(v2), "pin 4 of 5, v2 is SECURITY DEFINER with search_path = public (a buyer has no INSERT policy on the table: without it the call fails)");
  ok(/declare v_uid uuid := auth\.uid\(\);[^\n]*\n\s*begin\s*if v_uid is null then raise exception 'not authenticated'; end if;/.test(v2), "pin 5 of 5, the first statement of v2 refuses a null auth.uid() with 'not authenticated'");
}
ok(/revoke all on function public\.school_submit_payment_request_v2\([^)]*\) from public, anon;/.test(MIG) && /grant execute on function public\.school_submit_payment_request_v2\([^)]*\) to authenticated;/.test(MIG), "v2 is for signed-in buyers only (revoke from public, anon; grant to authenticated)");
ok(MIG.lastIndexOf("commit;") < MIG.lastIndexOf("select 'price'") && /order by 1, 2;\s*$/.test(MIG), "the file ends with a read-only read-back SELECT the integrator can run");
ok(/--\s+drop function if exists public\.school_submit_payment_request_v2/.test(MIG) && /--\s+alter table public\.school_payment_requests drop constraint if exists school_payment_requests_charge_ck/.test(MIG), "the undo statements are in the header comment");
{
  const definers = fs.readdirSync(ROOT).filter((f) => /^supabase-.*\.sql$/.test(f)).filter((f) => /_school_b2b_unit_price_cur\s*\(/.test(read(f)) && /create (or replace )?function\s+public\._school_b2b_unit_price_cur/i.test(read(f)));
  eq(definers, ["supabase-school-currency-migration.sql"], "exactly one SQL file defines the dollar / yuan price table");
}
{
  // what the client may put on the wire: never an amount
  const src = read("payment.tsx");
  const args = src.match(/const args = \{([^}]*)\};/);
  ok(!!args && !/amount|currency|price/i.test(args[1]), "the RPC arguments the modal builds carry no amount and no price", args && args[1]);
  ok(/\{ \.\.\.args, p_currency: curM \}/.test(src) && /curOf\(method\)/.test(src) && /const curOf = \(method\) => method === "stripe" \? cardCur : "thb";/.test(src), "p_currency is only ever the whitelisted result of curOf(method): the language currency for the card, baht for every other method (PromptPay, bank transfer, Alipay, WeChat)");
  ok(!/curOf[^\n]*"cny"/.test(src) && (src.match(/支付 ¥\$\{amount\.toLocaleString\(\)\}/g) || []).length === 2 && !/支付 ¥\$\{chargeAmt/.test(src), "the school modal's two Alipay / WeChat QR lines print the baht `amount` of the row exactly as before, never chargeAmt, and curOf never answers yuan");
  ok(/body: JSON\.stringify\(\{ requestId: data\.id, expect: totalPreview, cur: cardCur \}\)/.test(src), "the edge function body is the row id plus the figure shown and its currency, nothing else");
}
// ══ E. the migration on a REAL throwaway Postgres ═════════════════════════════════════════════════════════════════════════════════════
//    initdb in a scratch folder (tmpfs when there is one), a private unix socket, no TCP port, never the live database. The repo's real base migrations are applied first
//    (supabase-school-payment-migration.sql, supabase-price-799-migration.sql), on a minimal Supabase-shaped layer (roles anon / authenticated / service_role, auth.uid(),
//    profiles, and the default privileges Supabase gives every new function and table). SKIP, with the reason, when no server binaries are found: then only the D text pins stand.
//    Review finding: five mutants of this SQL survived the first version of this script (the 8-digit cap off by ten, the CHECK admitting a PromptPay dollar row, the minimum of
//    seats, SECURITY DEFINER, the null auth.uid()): each is pinned here by BEHAVIOUR, with the exact message the buyer's screen would show.
function findPgBin() {
  const dirs = [];
  if (process.env.PG_BIN) dirs.push(process.env.PG_BIN);
  try { dirs.push(execFileSync("pg_config", ["--bindir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()); } catch { /* not installed */ }
  try { for (const v of fs.readdirSync("/usr/lib/postgresql").sort((a, b) => parseFloat(b) - parseFloat(a))) dirs.push(`/usr/lib/postgresql/${v}/bin`); } catch { /* none */ }
  for (const d of ["/usr/local/pgsql/bin", "/usr/pgsql-16/bin", "/opt/homebrew/opt/postgresql@16/bin", "/usr/local/opt/postgresql@16/bin"]) dirs.push(d);
  return dirs.find((d) => d && ["initdb", "pg_ctl", "psql"].every((b) => fs.existsSync(path.join(d, b))));
}
function startPg(bin) {
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;   // Postgres refuses to run as root: then it runs as another account
  let osUser = null, uid = 0, gid = 0;
  if (isRoot) {
    osUser = process.env.PG_OS_USER || "postgres";
    try { uid = Number(execFileSync("id", ["-u", osUser], { encoding: "utf8" })); gid = Number(execFileSync("id", ["-g", osUser], { encoding: "utf8" })); }
    catch { return { skip: `this script runs as root and there is no "${osUser}" account to run Postgres as (PG_OS_USER=<name>)` }; }
    try { execFileSync("runuser", ["--version"], { stdio: "ignore" }); } catch { return { skip: "this script runs as root and runuser is missing" }; }
  }
  const dir = fs.mkdtempSync(path.join(fs.existsSync("/dev/shm") ? "/dev/shm" : os.tmpdir(), "tg-school-pg-"));
  const data = path.join(dir, "data"), sock = path.join(dir, "sock"), port = 54000 + (process.pid % 900);   // the port only names the socket file inside our private folder
  fs.mkdirSync(sock); if (isRoot) { fs.chownSync(dir, uid, gid); fs.chownSync(sock, uid, gid); }
  const asPg = (cmd, args) => isRoot
    ? execFileSync("runuser", ["-u", osUser, "--", path.join(bin, cmd), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 })
    : execFileSync(path.join(bin, cmd), args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 });
  let running = false;
  const stop = () => { if (running) { try { asPg("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]); } catch { /* already down */ } running = false; } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } };
  try {
    asPg("initdb", ["-D", data, "-A", "trust", "-U", "postgres", "--no-sync", "-E", "UTF8"]);
    fs.appendFileSync(path.join(data, "postgresql.conf"), `\nlisten_addresses = ''\nunix_socket_directories = '${sock}'\nport = ${port}\nfsync = off\nsynchronous_commit = off\nfull_page_writes = off\nmax_connections = 20\nshared_buffers = 32MB\n`);
    asPg("pg_ctl", ["-D", data, "-l", path.join(dir, "log"), "-w", "-t", "60", "start"]); running = true;
  } catch (e) { stop(); return { skip: "Postgres did not start: " + String((e && (e.stderr || e.message)) || e).split("\n")[0] }; }
  const psql = path.join(bin, "psql");
  const args = (db) => ["-X", "-q", "-A", "-t", "-h", sock, "-p", String(port), "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"];
  // run a whole script; { out, err }: err is the first "ERROR:" line of the script's failure (the script stops at it), null when it ran to the end
  const run = (sql, db = "postgres") => {
    try { return { out: execFileSync(psql, args(db), { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 1 << 26, timeout: 120000 }), err: null }; }
    catch (e) { return { out: String((e && e.stdout) || ""), err: (String((e && e.stderr) || "").match(/ERROR:\s+([^\n]*)/) || [null, String((e && e.message) || e).split("\n")[0]])[1] }; }
  };
  const version = run("select split_part(version(), ' on ', 1);").out.trim();
  return { run, stop, bin, sock, port, psql, args, version };
}

const PGBIN = findPgBin();
if (!PGBIN) skip("E: the migration on a real Postgres", "no Postgres server binaries found (PG_BIN=<bin dir> names them); the D text pins above stand");
else {
  const pg = startPg(PGBIN);
  if (pg.skip) skip("E: the migration on a real Postgres", pg.skip + "; the D text pins above stand");
  else {
    process.on("exit", () => pg.stop());
    for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { pg.stop(); process.exit(1); });
    try {
      console.log("NOTE E runs on " + pg.version + " (a private throwaway cluster, a unix socket in a scratch folder; removed at the end)");
      const BUYER = "11111111-1111-1111-1111-111111111111", OTHERB = "22222222-2222-2222-2222-222222222222", ADMIN3 = "33333333-3333-3333-3333-333333333333", ADMIN1 = "44444444-4444-4444-4444-444444444444";
      const MIGP = path.join(ROOT, "supabase-school-currency-migration.sql");
      const BASE_SCHOOL = read("supabase-school-payment-migration.sql");
      const ROLES = `create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;`;
      const SCAFFOLD = `
create schema auth;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create function public.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, email text, admin_tier smallint not null default 0);
insert into auth.users (id, email) values ('${BUYER}', 'buyer@example.org'), ('${OTHERB}', 'other@example.org'), ('${ADMIN3}', 'admin3@example.org'), ('${ADMIN1}', 'admin1@example.org');
insert into public.profiles (id, email, admin_tier) values ('${BUYER}', 'buyer@example.org', 0), ('${OTHERB}', 'other@example.org', 0), ('${ADMIN3}', 'admin3@example.org', 3), ('${ADMIN1}', 'admin1@example.org', 1);
`;
      const must = (r, what) => { if (r.err) throw new Error(`E setup step "${what}" failed: ${r.err}`); return r.out; };
      must(pg.run(ROLES), "roles");
      const mkdb = (db, { prices799 = true } = {}) => {
        must(pg.run(`create database ${db};`), "create database " + db);
        must(pg.run(SCAFFOLD, db), "scaffold");
        must(pg.run(BASE_SCHOOL, db), "base school payment migration");
        if (prices799) must(pg.run(MIG799, db), "799 price migration");
      };
      const lines = (s) => s.split("\n").filter((l) => l.length);
      const q = (sql, db) => lines(must(pg.run(sql, db), sql.slice(0, 60)));
      const lit = (v) => v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
      const asRole = (role, sub, body) => `set role ${role};\n${sub ? `select set_config('request.jwt.claim.sub', '${sub}', false) \\gset\n` : ""}${body}`;
      // one call per case in a DO block, each in its own sub-transaction: "OK {json without the id}" or "ERROR <message>" (the message is what PostgREST hands the page)
      const battery = (db, fn, cases, { role = "authenticated", sub = BUYER } = {}) => {
        const calls = cases.map((c, i) => `begin r := public.${fn}(${c.map(lit).join(", ")}); insert into out values (${i + 1}, 'OK ' || (r - 'id')::text); exception when others then insert into out values (${i + 1}, 'ERROR ' || sqlerrm); end;`).join("\n");
        const out = q(asRole(role, sub, `create temp table out (n int, res text);\ndo $$ declare r jsonb; begin\n${calls}\nend $$;\nselect n || '|' || res from out order by n;`), db);
        return out.map((l) => l.slice(l.indexOf("|") + 1));
      };
      const rowCount = (db) => Number(q("select count(*) from public.school_payment_requests;", db)[0]);

      // ── E1. the old function before and after: results, definition, privileges (hard rule 3: a cached old client keeps working and keeps getting baht) ────────────────────
      const OLD5 = [
        ["Alpha School", "school_standard", 15, "month", "stripe"], ["Alpha School", "school_standard", 15, "year", "stripe"], ["Beta School", "school_plus", 20, "year", "promptpay"],
        ["Gamma School", "school_plus", 16, "month", "alipay"], ["Delta School", "school_standard", 1000, "month", "wechat"], ["Zeta School", "school_standard", 100000, "year", "stripe"],
        ["  Trim School  ", "school_standard", 15, "month", "stripe"], ["Bad tier", "school_gold", 15, "month", "stripe"], ["Bad cycle", "school_standard", 15, "week", "stripe"],
        ["Bad method", "school_standard", 15, "month", "paypal"], ["Bank", "school_standard", 15, "month", "banktransfer"], ["Few seats", "school_standard", 14, "month", "stripe"],
        ["", "school_standard", 15, "month", "stripe"], ["   ", "school_standard", 15, "month", "stripe"],
      ];
      const OLD5_SIG = "public.school_submit_payment_request(text,text,int,text,text)";
      mkdb("tg1");
      const defOf = (db) => q(`select pg_get_functiondef('${OLD5_SIG}'::regprocedure);`, db).join("\n");
      const aclOf = (db) => q(`select coalesce(proacl::text, 'default') from pg_proc where oid = '${OLD5_SIG}'::regprocedure;`, db)[0];
      const before = battery("tg1", "school_submit_payment_request", OLD5), defBefore = defOf("tg1"), aclBefore = aclOf("tg1");
      ok(before.filter((r) => r.startsWith("OK")).length === 7 && before.filter((r) => r.startsWith("ERROR")).length === 7, "E1: the repo's real base migrations apply to a plain Postgres and the old five-argument function answers 7 requests and refuses 7 (the baseline)", JSON.stringify(before));
      ok(before[0] === 'OK {"amount": 13800}' && before[1] === 'OK {"amount": 160500}' && before[2] === 'OK {"amount": 214000}' && before[3] === 'OK {"amount": 14720}', "E1: the old function prices in baht from the 799 migration: 15 x 920 = 13,800, 15 x 10,700 = 160,500, 20 x 10,700 = 214,000, 16 x 920 = 14,720", JSON.stringify(before.slice(0, 4)));
      ok(before[9] === "ERROR invalid method" && before[10] === "ERROR invalid method", "E1: the old function refuses 'banktransfer' as it always did (a limit that is not this change's: see docs/agents-history.md)", before[10]);
      const nBefore = rowCount("tg1");

      const a1 = pg.run(read("supabase-school-currency-migration.sql"), "tg1");
      ok(!a1.err, "E2: the migration applies without an error (one transaction)", a1.err);
      const a2 = pg.run(read("supabase-school-currency-migration.sql"), "tg1");
      ok(!a2.err && a2.out === a1.out, "E2: and applies a second time without an error, its read-back identical to the first (re-runnable)", a2.err || "read-backs differ");
      const rb = lines(a1.out);
      const rbEq = (what, item, value) => rb.includes(`${what}|${item}|${value}`);
      ok(["price|cny month|210", "price|cny year|2360", "price|thb month|920", "price|thb year|10700", "price|usd month|28.99", "price|usd year|334.99"].every((l) => rb.includes(l)), "E2: the read-back SELECT at the end of the file prints the six prices the header promises (cny 210 / 2360, thb 920 / 10700, usd 28.99 / 334.99)", rb.filter((l) => l.startsWith("price")).join(" ; "));
      ok(rbEq("column", "charge_amount", "numeric, nullable") && rbEq("column", "charge_currency", "text, default 'thb'::text, not null") && rb.some((l) => l.startsWith("constraint|school_payment_requests_charge_ck|CHECK")) && rb.some((l) => /^function\|(public\.)?school_submit_payment_request_v2\(.*\)\|security definer$/.test(l)) && rb.some((l) => /^function\|(public\.)?school_submit_payment_request\(text,text,integer,text,text\)\|security definer$/.test(l)), "E2: ... and the columns, the CHECK and both functions (the old one, v2: security definer) it promises", rb.filter((l) => !l.startsWith("price")).join(" ; "));
      ok(rb.some((l) => l === `rows|thb|${nBefore}`) && !rb.some((l) => /^rows\|(usd|cny)\|/.test(l)), `E2: every row made before the migration reads thb (${nBefore} rows, none usd / cny)`, rb.filter((l) => l.startsWith("rows")).join(" ; "));
      const after = battery("tg1", "school_submit_payment_request", OLD5);
      eq(after, before, "E3: the old five-argument function answers the same 14 requests with the same results and the same error messages after the migration (an old cached client is untouched)");
      ok(defOf("tg1") === defBefore && aclOf("tg1") === aclBefore, "E3: ... and its definition and its privileges are byte for byte what they were");
      eq(q("select count(*) filter (where charge_currency <> 'thb' or charge_amount is not null) from public.school_payment_requests;", "tg1"), ["0"], "E3: ... and every row it wrote, before and after, is thb with no charge_amount");

      // ── E4. the price table against the client's math (hard rule 5) ──────────────────────────────────────────────────────────────────────────────────────────────────────
      const grid = [];
      for (const cur of ["thb", "usd", "cny"]) for (const cy of ["month", "year"]) for (const tier of ["standard", "plus"])
        grid.push([cur, cy, tier, cy === "year" ? P.b2bYearPriceByCur(cur, tier) : P.b2bPriceByCur(cur, tier)]);
      const got = q(grid.map(([cur, cy, tier]) => `select '${cur}|${cy}|${tier}|' || public._school_b2b_unit_price_cur('school_${tier}', '${cy}', '${cur}')::text;`).join("\n"), "tg1");
      const bad = grid.filter(([cur, cy, tier, want], i) => got[i] !== `${cur}|${cy}|${tier}|${want}`);
      ok(got.length === 12 && bad.length === 0, "E4: the server price table (a SELECT in Postgres) gives EXACTLY the numbers the client math gives, for 3 currencies x month / year x both tiers (12)", bad.map((b) => b.join(":")).join(" ; ") + " got " + got.join(" ; "));

      // ── E5. v2: every currency x cycle x tier x seat count, against the client's math; the row it stores ──────────────────────────────────────────────────────────────────────
      {
        const seatsList = [15, 16, 17, 20, 30, 93, 100, 423], cases = [];   // 423 is the most seats one yearly yuan card payment can hold (E6)
        for (const tier of ["school_standard", "school_plus"]) for (const cy of ["month", "year"]) for (const cur of ["usd", "cny"]) for (const seats of seatsList) cases.push([tier, cy, cur, seats]);
        const calls = cases.map(([tier, cy, cur, seats], i) => `r := public.school_submit_payment_request_v2('  School ${i}  ', '${tier}', ${seats}, '${cy}', 'stripe', '${cur}'); insert into out select ${i + 1}, r->>'amount_thb', r->>'currency', r->>'charge_amount', jsonb_typeof(r->'id'), jsonb_typeof(r->'amount_thb'), jsonb_typeof(r->'charge_amount'), (select concat_ws(',', amount::text, method, charge_currency, charge_amount::text, status, requester_id::text, contact_email, institution_name, tier, seats::text, cycle) from public.school_payment_requests where id = (r->>'id')::uuid);`).join("\n");
        const rows = q(asRole("authenticated", BUYER, `create temp table out (n int, a text, c text, ch text, t1 text, t2 text, t3 text, st text);\ndo $$ declare r jsonb; begin\n${calls}\nend $$;\nselect concat_ws('|', n, a, c, ch, t1, t2, t3, st) from out order by n;`), "tg1");
        const badv = [];
        cases.forEach(([tier, cy, cur, seats], i) => {
          const t = tier.replace("school_", ""), thbU = cy === "year" ? P.b2bYearPriceByCur("thb", t) : P.b2bPriceByCur("thb", t), curU = cy === "year" ? P.b2bYearPriceByCur(cur, t) : P.b2bPriceByCur(cur, t);
          const wantThb = thbU * seats, wantCharge = Math.round(curU * seats * 100) / 100;
          const f = (rows[i] || "").split("|"), st = (f[7] || "").split(",");
          const good = f[0] === String(i + 1) && Number(f[1]) === wantThb && f[2] === cur && Number(f[3]) === wantCharge && f[4] === "string" && f[5] === "number" && f[6] === "number"
            && Number(st[0]) === wantThb && st[1] === "stripe" && st[2] === cur && Number(st[3]) === wantCharge && st[4] === "pending" && st[5] === BUYER && st[6] === "buyer@example.org" && st[7] === `School ${i}` && st[8] === tier && Number(st[9]) === seats && st[10] === cy;
          if (!good) badv.push(`${tier} ${cy} ${cur} x${seats}: ${rows[i]} (want ${wantThb} / ${wantCharge})`);
        });
        ok(rows.length === cases.length && badv.length === 0, `E5: school_submit_payment_request_v2 over ${cases.length} orders (2 tiers x month / year x usd / cny x 8 seat counts): the baht list price, the currency, the charge, the JSON types and the stored row are all what the client's math says`, badv.slice(0, 2).join(" ; "));
      }

      // ── E6. v2 refusals, each with its own message, and none of them writes a row ─────────────────────────────────────────────────────────────────────────────────────────────
      {
        const V = (over) => ["V School", "school_standard", 15, "month", "stripe", "usd"].map((x, i) => (i in over ? over[i] : x));
        const REFUSE = [
          [V({ 1: "school_gold" }), "invalid tier"], [V({ 1: null }), "invalid tier"], [V({ 3: "week" }), "invalid cycle"], [V({ 3: null }), "invalid cycle"],
          [V({ 5: "thb" }), "invalid currency"], [V({ 5: "eur" }), "invalid currency"], [V({ 5: "USD" }), "invalid currency"], [V({ 5: "" }), "invalid currency"], [V({ 5: null }), "invalid currency"],
          [V({ 4: "promptpay" }), "invalid method for this currency"], [V({ 4: "banktransfer" }), "invalid method for this currency"], [V({ 4: "alipay", 5: "cny" }), "invalid method for this currency"],
          [V({ 4: "wechat", 5: "cny" }), "invalid method for this currency"], [V({ 4: "alipay" }), "invalid method for this currency"], [V({ 4: "wechat" }), "invalid method for this currency"],
          [V({ 4: "STRIPE" }), "invalid method for this currency"], [V({ 4: null }), "invalid method for this currency"], [V({ 4: "promptpay", 5: "cny" }), "invalid method for this currency"],
          [V({ 2: 14 }), "minimum 15 seats"], [V({ 2: 1 }), "minimum 15 seats"], [V({ 2: 0 }), "minimum 15 seats"], [V({ 2: -5 }), "minimum 15 seats"], [V({ 2: null }), "minimum 15 seats"],
          [V({ 0: null }), "institution name required"], [V({ 0: "" }), "institution name required"], [V({ 0: "   " }), "institution name required"],
        ];
        const n0 = rowCount("tg1");
        const res = battery("tg1", "school_submit_payment_request_v2", REFUSE.map((r) => r[0]));
        const badr = REFUSE.filter((r, i) => res[i] !== "ERROR " + r[1]).map((r, i) => `${JSON.stringify(r[0])} -> ${res[REFUSE.indexOf(r)]} (want ${r[1]})`);
        ok(badr.length === 0, `E6: v2 refuses ${REFUSE.length} bad requests, each with its own exact message (invalid tier / cycle / currency / method for this currency, minimum 15 seats, institution name required)`, badr.slice(0, 3).join(" ; "));
        ok(rowCount("tg1") === n0, "E6: and none of the refused calls wrote a row");
        // minimum seats, pinned on its own: 14 refused with THE message (not the table's own seats >= 15 CHECK, whose text the buyer's screen would show raw), 15 accepted
        const edge = battery("tg1", "school_submit_payment_request_v2", [V({ 2: 14 }), V({ 2: 15 })]);
        ok(edge[0] === "ERROR minimum 15 seats" && edge[1].startsWith("OK"), "E6: minimum seats: 14 is refused with 'minimum 15 seats' by the function itself, 15 is accepted (the 'minimum seats 1' mutant would let 14 reach the table CHECK and its raw message)", edge.join(" ; "));
        // the Stripe 8-digit cap at its boundary (99,999,999 of the smallest unit), for each money and cycle
        const capCases = [];
        for (const [cur, cy] of [["usd", "month"], ["usd", "year"], ["cny", "month"], ["cny", "year"]]) {
          const cents = Math.round((cy === "year" ? P.b2bYearPriceByCur(cur, "standard") : P.b2bPriceByCur(cur, "standard")) * 100), top = Math.floor(99999999 / cents);
          capCases.push([cur, cy, top, true], [cur, cy, top + 1, false]);
        }
        const nCap = rowCount("tg1");
        const cap = battery("tg1", "school_submit_payment_request_v2", capCases.map(([cur, cy, seats]) => V({ 2: seats, 3: cy, 5: cur })));
        const badc = capCases.filter(([cur, cy, seats, accepted], i) => accepted ? !cap[i].startsWith("OK") : cap[i] !== "ERROR too many seats for one card payment: contact us");
        ok(badc.length === 0, `E6: the Stripe 8-digit cap, at its boundary (usd month ${capCases[0][2]} / ${capCases[1][2]}, usd year ${capCases[2][2]} / ${capCases[3][2]}, cny month ${capCases[4][2]} / ${capCases[5][2]}, cny year ${capCases[6][2]} / ${capCases[7][2]} seats): the last order that fits is accepted, one seat more is refused with 'too many seats for one card payment: contact us'`, badc.map((c) => c.join(":")).join(" ; "));
        ok(rowCount("tg1") === nCap + 4, "E6: ... and only the four orders that fit wrote a row");
        // the whole order is paid in one card payment: 2,147,483,647 seats (the int maximum) is refused by the cap, not by an overflow
        const huge = battery("tg1", "school_submit_payment_request_v2", [V({ 2: 2147483647, 3: "year" })]);
        ok(huge[0] === "ERROR too many seats for one card payment: contact us", "E6: the largest int seat count is refused by the cap, not by an arithmetic overflow", huge[0]);
      }

      // ── E7. who may call it: null auth.uid(), anon, authenticated, PUBLIC ─────────────────────────────────────────────────────────────────────────────────────────────────────
      {
        const V2SIG = "public.school_submit_payment_request_v2(text,text,int,text,text,text)";
        const nobody = battery("tg1", "school_submit_payment_request_v2", [["V School", "school_standard", 15, "month", "stripe", "usd"]], { sub: null });
        ok(nobody[0] === "ERROR not authenticated", "E7: a signed-in role with no auth.uid() (no sub in the token) is refused with 'not authenticated' by the function's own first line (not by the table's NOT NULL)", nobody[0]);
        const anon = q(asRole("anon", null, `create temp table out (res text);\ndo $$ begin begin perform public.school_submit_payment_request_v2('V School', 'school_standard', 15, 'month', 'stripe', 'usd'); insert into out values ('OK'); exception when others then insert into out values (sqlerrm); end; end $$;\nselect res from out;`), "tg1");
        ok(/^permission denied for function school_submit_payment_request_v2/.test(anon[0]), "E7: anon cannot execute v2 at all ('permission denied for function ...', not merely 'not authenticated')", anon[0]);
        const priv = q(`select has_function_privilege('anon', '${V2SIG}', 'execute') || ',' || has_function_privilege('authenticated', '${V2SIG}', 'execute') || ',' || has_function_privilege('service_role', '${V2SIG}', 'execute') || ',' || (select count(*) from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = '${V2SIG}'::regprocedure and a.grantee = 0);`, "tg1")[0];
        eq(priv, "false,true,true,0", "E7: privileges on v2: anon no, authenticated yes, service_role yes, PUBLIC none");
        const meta = q(`select prosecdef::text || '|' || coalesce(proconfig::text, '') from pg_proc where oid = '${V2SIG}'::regprocedure;`, "tg1")[0];
        eq(meta, "true|{search_path=public}", "E7: v2 is SECURITY DEFINER with search_path = public");
        const meta2 = q(`select prosecdef::text || '|' || provolatile::text || '|' || coalesce(proconfig::text, '') from pg_proc where proname = '_school_b2b_unit_price_cur';`, "tg1")[0];
        eq(meta2, "false|i|{search_path=public}", "E7: the price function is IMMUTABLE with search_path = public and not a definer");
        // SECURITY DEFINER proved by behaviour: the buyer may not insert into the table himself (RLS: no insert policy), yet v2 inserts for him
        const direct = q(asRole("authenticated", BUYER, `create temp table out (res text);\ndo $$ begin begin insert into public.school_payment_requests (requester_id, institution_name, contact_email, tier, seats, cycle, amount, method) values ('${BUYER}', 'Direct', 'x', 'school_standard', 15, 'month', 13800, 'stripe'); insert into out values ('INSERTED'); exception when others then insert into out values (sqlerrm); end; end $$;\nselect res from out;`), "tg1");
        ok(/violates row-level security policy/.test(direct[0]), "E7: control: a buyer's own INSERT into school_payment_requests is refused by row-level security (so the harness really has RLS in force)", direct[0]);
        const viaV2 = battery("tg1", "school_submit_payment_request_v2", [["Through V2", "school_standard", 15, "month", "stripe", "usd"]]);
        ok(viaV2[0].startsWith("OK"), "E7: ... and the same buyer's call of v2 inserts (v2 is SECURITY DEFINER: dropping that fails here)", viaV2[0]);
        // the signed-in buyer reads only his own rows through RLS, the admin list (tier 3) reads all: the migration did not change who sees what
        const seen = q(asRole("authenticated", OTHERB, "select count(*) from public.school_payment_requests;"), "tg1")[0];
        eq(seen, "0", "E7: another signed-in user still sees none of the buyer's requests (the RLS policies are untouched)");
      }

      // ── E8. the CHECK: nothing but a card row may carry dollars or yuan, whatever function wrote it ───────────────────────────────────────────────────────────────────────────
      {
        const ins = (method, cur, amt) => `begin insert into public.school_payment_requests (requester_id, institution_name, contact_email, tier, seats, cycle, amount, method, charge_currency, charge_amount) values ('${BUYER}', 'CK ${method} ${cur}', 'x', 'school_standard', 15, 'month', 13800, '${method}', ${lit(cur)}, ${lit(amt)}); insert into out (res) values ('OK'); exception when check_violation then get stacked diagnostics cn = constraint_name; insert into out (res) values ('CHECK ' || cn); when others then insert into out (res) values ('OTHER ' || sqlerrm); end;`;
        const ILLEGAL = [["promptpay", "usd", 434.85], ["promptpay", "cny", 3150], ["alipay", "cny", 3150], ["alipay", "usd", 434.85], ["wechat", "cny", 3150], ["wechat", "usd", 434.85],
          ["stripe", "usd", null], ["stripe", "cny", null], ["stripe", "thb", 920], ["promptpay", "thb", 920], ["stripe", "eur", 100], ["stripe", "usd", 0], ["stripe", "usd", -5], ["stripe", "USD", 434.85]];
        const LEGAL = [["stripe", "usd", 434.85], ["stripe", "cny", 3150], ["stripe", "thb", null], ["promptpay", "thb", null], ["alipay", "thb", null], ["wechat", "thb", null]];
        const out = q(`create temp table out (n serial, res text);\ndo $$ declare cn text; begin\n${[...ILLEGAL, ...LEGAL].map((c) => ins(...c)).join("\n")}\nend $$;\nselect res from out order by n;\ndelete from public.school_payment_requests where institution_name like 'CK %';`, "tg1");
        const badck = ILLEGAL.filter((c, i) => out[i] !== "CHECK school_payment_requests_charge_ck");
        ok(badck.length === 0, `E8: the CHECK refuses all ${ILLEGAL.length} illegal shapes by name: a PromptPay / bank / Alipay / WeChat row carrying dollars or yuan (the 'CHECK allows promptpay + usd' mutant), a card row with no charge or a zero / negative one, a baht row with a charge_amount, another currency, an upper-case one`, badck.map((c) => c.join(":")).join(" ; ") + " got " + out.slice(0, ILLEGAL.length).join(" ; "));
        const badlegal = LEGAL.filter((c, i) => out[ILLEGAL.length + i] !== "OK");
        ok(badlegal.length === 0, `E8: ... and accepts the ${LEGAL.length} legal shapes (a card row in usd / cny with its charge, a baht row on any method with none)`, badlegal.map((c) => c.join(":")).join(" ; "));
      }

      // ── E9. the self-check aborts the whole transaction, and a half-applied state is impossible ───────────────────────────────────────────────────────────────────────────────
      {
        const left = (db) => q(`select (select count(*) from information_schema.columns where table_name = 'school_payment_requests' and column_name in ('charge_currency', 'charge_amount')) || ',' || (select count(*) from pg_proc where proname in ('school_submit_payment_request_v2', '_school_b2b_unit_price_cur')) || ',' || (select count(*) from pg_constraint where conname = 'school_payment_requests_charge_ck');`, db)[0];
        mkdb("tg2", { prices799: false });   // the old prices (1,720 per seat): the 799 migration was never applied
        const r2 = pg.run(read("supabase-school-currency-migration.sql"), "tg2");
        ok(/the school price table does not match payment\.tsx/.test(r2.err || ""), "E9: with the 799 migration missing (old baht prices) the self-check raises 'the school price table does not match payment.tsx ...'", r2.err);
        eq(left("tg2"), "0,0,0", "E9: ... and nothing was left behind: no column, no function, no constraint (the whole transaction rolled back)");
        mkdb("tg3");
        must(pg.run("drop function public.school_submit_payment_request(text, text, int, text, text);", "tg3"), "drop the five-argument function");
        const r3 = pg.run(read("supabase-school-currency-migration.sql"), "tg3");
        ok(/school_submit_payment_request \(5 arguments\) is missing/.test(r3.err || ""), "E9: with the five-argument function missing the self-check raises 'school_submit_payment_request (5 arguments) is missing ...'", r3.err);
        eq(left("tg3"), "0,0,0", "E9: ... and again nothing was left behind");
        // each price the self-check guards, wrong by one unit, is refused (the guard against the client and the server drifting apart, the 1,720-versus-920 episode): a template database
        // holds the base migrations once, every case clones it. The uncorrupted file applies to such a clone (E2), so a refusal here is the corrupted number's.
        must(pg.run("create database tgtpl;"), "template database");
        must(pg.run(SCAFFOLD, "tgtpl"), "scaffold"); must(pg.run(BASE_SCHOOL, "tgtpl"), "base"); must(pg.run(MIG799, "tgtpl"), "799");
        const MIGTXT = read("supabase-school-currency-migration.sql");
        const drift = [
          ["baht month 921 (the 799 migration's function)", "create or replace function public._school_b2b_unit_price(p_tier text, p_cycle text) returns numeric language sql immutable as $$ select case when p_cycle = 'year' then 10700 else 921 end $$;", MIGTXT],
          ["baht year 10701 (the 799 migration's function)", "create or replace function public._school_b2b_unit_price(p_tier text, p_cycle text) returns numeric language sql immutable as $$ select case when p_cycle = 'year' then 10701 else 920 end $$;", MIGTXT],
          ["usd month 28.98", "", MIGTXT.replace("else 28.99 end", "else 28.98 end")], ["usd year 334.98", "", MIGTXT.replace("then 334.99 else", "then 334.98 else")],
          ["cny month 211", "", MIGTXT.replace("else 210   end", "else 211   end")], ["cny year 2361", "", MIGTXT.replace("then 2360   else", "then 2361   else")],
        ];
        const slipped = [];
        drift.forEach(([label, patch, text], i) => {
          const db = "tgdrift" + i;
          must(pg.run(`create database ${db} template tgtpl;`), "clone " + db);
          if (patch) must(pg.run(patch, db), "patch " + label);
          const r = pg.run(text, db);
          if (!/the school price table does not match payment\.tsx/.test(r.err || "") || left(db) !== "0,0,0") slipped.push(`${label}: ${r.err || "applied"} / left ${left(db)}`);
        });
        ok(drift.every((d) => d[1] || d[2] !== MIGTXT), "E9: every corrupted copy of the file really differs from it (each replacement matched)");
        ok(slipped.length === 0, "E9: the self-check refuses each guarded price when it is wrong by one unit (baht month and year, dollar month and year, yuan month and year) and leaves nothing behind", slipped.join(" ; "));
      }

      // ── E10. PostgREST keeps connections for hours: a session that already ran the admin list (plpgsql plan cached) must still work after the ALTER, in the same session ─────────────
      {
        mkdb("tg4");
        battery("tg4", "school_submit_payment_request", [["Cache School", "school_standard", 15, "month", "stripe"], ["Cache School 2", "school_plus", 20, "year", "promptpay"]]);
        const script = asRole("authenticated", ADMIN3, `select count(*) from public.admin_list_school_payment_requests();\nselect count(*) from public.admin_list_school_payment_requests();\n\\! '${pg.psql}' -X -q -h '${pg.sock}' -p ${pg.port} -U postgres -d tg4 -v ON_ERROR_STOP=1 -f '${MIGP}' > /dev/null\nselect count(*) || '|' || bool_and(to_jsonb(r) ? 'charge_currency') || '|' || bool_and(r.charge_currency = 'thb' and r.charge_amount is null) from public.admin_list_school_payment_requests() r;`);
        const r = pg.run(script, "tg4"), outl = lines(r.out);
        ok(!r.err && outl.length === 3 && outl[0] === "2" && outl[1] === "2" && outl[2] === "2|true|true", "E10: one session runs the admin list twice, the migration is applied from another session in the middle, and the SAME session then lists the rows again: no error, the new columns are there, the old rows read thb", r.err || outl.join(" ; "));
      }
    } catch (e) { ok(false, "E: the real-Postgres section ran to its end", String((e && e.message) || e)); }
    finally { pg.stop(); }
  }
}

console.log(`\n${pass} passed, ${fail} failed${skipped ? ", " + skipped + " skipped" : ""}`);
process.exit(fail ? 1 : 0);
