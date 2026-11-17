#!/usr/bin/env node
/* verify-school-currency.mjs — the School plan is charged the price it is shown (owner, 2026-11-17).

   The report: the School plan card said US$28.99 per seat for an English buyer while school-stripe-checkout opened every card session in
   baht (THB 920). One rule now: the CARD is charged in the buyer's language currency (payment.tsx currencyOf: baht for Thai, yuan for Chinese,
   US dollars for every other language); PromptPay and bank transfer stay baht; Alipay and WeChat (Chinese only) are yuan.

   What this runs (no network, no database, no Stripe, nothing deployed; the REAL files are evaluated, nothing is retyped):
     A  prices: b2bPriceByCur / b2bYearPriceByCur from the real payment.tsx for baht / dollars / yuan x month / year x both tiers, against the
        server table in supabase-school-currency-migration.sql (usd 28.99 / 334.99, cny 210 / 2360, baht 920 / 10700 from the 799 migration's
        own formula) and against the numbers the owner was told; every seat count 15..100,000 comes out as the same whole number of cents on the
        client, in the database number and in the smallest unit the edge function sends to Stripe.
     B  the real school-stripe-checkout and verify-school-payment (Deno stubbed, fetch faked), side by side with the same two functions as
        the base commit 9762c878e left them (git show): a baht row opens the byte-for-byte session the base function opened, a dollar / yuan row
        opens its own currency and amount, `expect` / `cur` are compared and never used as the amount, the session never carries `plan` / `kind`
        (stripe-webhook would fulfil it as a Premium purchase), and verify refuses to mark a row paid unless Stripe's own currency and
        amount_total equal the row's. A rollout done in the wrong order is simulated too: it must fall back to the baht list price, never charge
        a smaller number.
     C  the real SchoolCheckoutModal (real React, jsdom, Supabase faked), side by side with the base commit's modal: the Thai screens, RPC
        calls and edge calls are the same; each other language shows the price of the method it sits next to (card = language currency,
        PromptPay / bank = baht, Alipay / WeChat = yuan); the refusal message of the database reads in all ten languages (the real catalogs).
     D  the admin list's money text, and the migration file's shape (one transaction, the five-argument function untouched, one price table).
   The SQL itself is exercised on a throwaway Postgres by hand (see docs/agents-history.md, 2026-11-17 School currency entry); this script reads it.

   Run: node scripts/verify-school-currency.mjs   (SCHOOL_TMP=<dir> moves the scratch folder, default node_modules/.tmp-school-currency)
   Without the base commit in the clone (a shallow clone) the side-by-side checks print SKIP and everything else still runs. */
import fs from "node:fs";
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
  fs.writeFileSync(path.join(dir, "entry.tsx"), `import * as P from "./payment.tsx"; ${haveBase ? 'import * as B from "./payment-base.tsx";' : "const B: any = null;"}
import * as L from "./lang-extra.ts"; import * as React from "react"; import { createRoot } from "react-dom/client";
(globalThis as any).__S = (globalThis as any).__S || {}; (globalThis as any).__S[${JSON.stringify(path.basename(dir))}] = { P, B, L, React, createRoot };\n`);
  await build({ entryPoints: [path.join(dir, "entry.tsx")], bundle: true, format: "esm", platform: "node", loader: { ".tsx": "tsx" }, jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' }, nodePaths: [path.join(ROOT, "node_modules")], outfile: path.join(dir, "bundle.mjs"), logLevel: "error" });
  await import(pathToFileURL(path.join(dir, "bundle.mjs")).href);
  return globalThis.__S[path.basename(dir)];
}

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
eq(["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar"].map((l) => P.currencyOf(l)), ["thb", "usd", "cny", "usd", "usd", "usd", "usd", "usd", "usd", "usd"], "currencyOf: Thai baht, Chinese yuan, every other language dollars");
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
function world(rows, sessions = {}) {
  const log = { posts: [], patches: [], errors: [] };
  globalThis.Deno = { env: { get: (k) => ({ STRIPE_SECRET_KEY: "sk_test_x", SUPABASE_URL: "http://sb.test", SUPABASE_SERVICE_ROLE_KEY: "svc" })[k] } };
  const realErr = console.error; console.error = (...a) => { log.errors.push(a.join(" ")); };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const m = url.match(/\/rest\/v1\/school_payment_requests\?id=eq\.([^&]+)(?:&select=(.*))?$/);
    if (m && init.method === "PATCH") { log.patches.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
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
  ["a cny Alipay row paid by card in its own currency", row0({ method: "alipay", charge_currency: "cny", charge_amount: 3150 }), "cny", "315000", "3150"],
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
// B7. a rollout done in the wrong order falls back to the baht list price and never to a smaller number
if (haveBase) {
  const usd = row0({ charge_currency: "usd", charge_amount: 434.85 });
  const old = await pay(usd, {}, undefined, baseCheckout), f = old.post ? form(old.post) : {};
  ok(old.status === 200 && f["line_items[0][price_data][currency]"] === "thb" && f["line_items[0][price_data][unit_amount]"] === "1380000", "an OLD school-stripe-checkout meeting a dollar row (client deployed first) charges the BAHT list price (1,380,000 satang), never 43,485 of anything");
  const r = await ver(usd, sess({ currency: "thb", amount_total: 1380000 }));
  ok(r.status === 409 && r.patches.length === 0 && r.errors.length === 1, "and the NEW verify then refuses to call that row paid (it was paid in the wrong currency): staff see the log line and the pending row");
  const oldVerify = await ver(usd, sess({ currency: "thb", amount_total: 1380000 }), undefined, baseVerify);
  ok(oldVerify.body.status === "paid", "an OLD verify-school-payment would have accepted it (the order is: SQL, verify, checkout, client)");
} else skip("misordered rollout against the base commit's functions", "base commit missing");

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
globalThis.fetch = async (url, init = {}) => {
  url = String(url); fetchLog.push({ url, body: init.body ? JSON.parse(init.body) : null });
  if (url.endsWith("/functions/v1/stripe-checkout")) return new Response(JSON.stringify({ mode: "live" }), { status: 200 });
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
const reset = () => { rpcLog.length = 0; fetchLog.length = 0; edgeReply = { status: 200, body: { url: "https://checkout.stripe.test/c/pay_1" } }; edgeGate = null; rpcImpl = defaultRpc; };
const edgeCall = () => fetchLog.filter((f) => f.url.endsWith("/school-stripe-checkout")).pop();

// C0. Thai side by side: the base commit's modal and this one, driven by the same script, must show the same text at every step and make the same calls
if (haveBase) {
  const scenarios = {
    "details, then PromptPay": async (m, snap) => { snap("details"); await toPay(m); snap("methods"); await m.click(m.btn(/PromptPay/)); snap("PromptPay"); },
    "yearly 20 seats, then bank transfer": async (m, snap) => { await toPay(m, { seats: 20, yearly: true }); snap("methods"); await m.click(m.btn(/โอนเข้าบัญชี/)); snap("bank"); },
    "16 seats, then the card": async (m, snap) => { await toPay(m, { seats: 16 }); snap("methods"); await m.click(m.btn(/บัตร/)); snap("after the card"); },
    "plus tier yearly, then PromptPay": async (m, snap) => { await toPay(m, { seats: 30, yearly: true }); await m.click(m.btn(/PromptPay/)); snap("PromptPay"); },
    "validation: no name, then 14 seats": async (m, snap) => { await m.click(m.btn(NEXT)); snap("no name"); await m.type(m.$("input.aicreate-in"), "X"); await m.type(m.$("input[type=number]"), "14"); await m.click(m.btn(NEXT)); snap("14 seats"); },
    "the database refuses": async (m, snap) => { rpcImpl = async () => ({ data: null, error: { message: "boom" } }); await toPay(m); await m.click(m.btn(/PromptPay/)); snap("refused"); },
    "a card that fails to open": async (m, snap) => { edgeReply = { status: 500, body: { error: "Stripe 500" } }; await toPay(m); await m.click(m.btn(/บัตร/)); snap("failed"); },
  };
  const drive = async (Comp, name) => {
    reset(); const snaps = [];
    const m = await mount("th", { Comp, tier: name.startsWith("plus") ? "plus" : "standard" });
    await scenarios[name](m, (label) => snaps.push([label, m.text()]));
    await m.unmount();
    return { snaps, rpc: rpcLog.map((r) => [r.name, r.args]), edge: fetchLog.filter((f) => f.url.endsWith("/school-stripe-checkout")).map((f) => { const b = { ...f.body }; delete b.expect; delete b.cur; return b; }) };
  };
  for (const name of Object.keys(scenarios)) {
    const a = await drive(B.SchoolCheckoutModal, name), b = await drive(P.SchoolCheckoutModal, name);
    ok(a.snaps.length > 0 && a.snaps.every((s) => s[1].length > 20), `th side by side: "${name}": the script really drove the base modal (${a.snaps.length} screens read)`);
    eq(b, a, `th side by side with the base commit's modal: "${name}": the same text at every step, the same RPC calls, the same edge call`);
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
// C3. Chinese: yuan on the card and on Alipay / WeChat (the old screen printed the baht amount behind a ¥)
{
  reset(); const m = await mount("zh");
  ok(/¥3,150\/月/.test(m.text()), "zh: the details headline is yuan: ¥210 x 15 = ¥3,150/月", m.text());
  await toPay(m);
  ok(m.btn(/支付宝付款/).textContent === "🔵 支付宝付款" && m.btn(/微信付款/).textContent === "🟢 微信付款", "zh: Alipay and WeChat carry no extra price (the headline is yuan already)");
  await m.click(m.btn(/支付宝付款/));
  eq(rpcLog.map((r) => [r.name, r.args.p_method, r.args.p_currency]), [["school_submit_payment_request_v2", "alipay", "cny"]], "zh: Alipay calls _v2 with cny");
  ok(/支付 ¥3,150$/.test(m.note()) && /¥3,150\/月/.test(m.sum()), "zh: the Alipay screen says pay ¥3,150 (it said ¥13,800 before)", m.note() + " | " + m.sum());
  await m.unmount();
  reset(); const w = await mount("zh"); await toPay(w, { seats: 20, yearly: true });
  await w.click(w.btn(/微信付款/));
  ok(/支付 ¥47,200$/.test(w.note()) && rpcLog[0].args.p_method === "wechat" && rpcLog[0].args.p_cycle === "year", "zh: WeChat yearly 20 seats says ¥47,200", w.note());
  await w.unmount();
  reset(); const k = await mount("zh"); await toPay(k);
  await k.click(k.btn(/银行卡支付/));
  eq([rpcLog[0].name, rpcLog[0].args.p_currency, edgeCall().body.expect, edgeCall().body.cur], ["school_submit_payment_request_v2", "cny", 3150, "cny"], "zh: the card is charged in yuan");
  await k.unmount();
}
// C4. every other language is dollars, card only
for (const lang of ["ja", "ko", "ru", "hi", "es", "fr", "ar"]) {
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
  ok(!!catalog[KEY] && ["ja", "ko", "ru", "hi", "es", "fr", "ar"].every((l) => typeof catalog[KEY][l] === "string" && catalog[KEY][l].trim().length > 8), "the refusal sentence is in i18n-src/catalog.json for all seven extra languages");
  const WANT = { th: "ยอดสั่งซื้อเกินวงเงินต่อครั้งของการจ่ายด้วยบัตร กรุณาติดต่อเรา", en: KEY, zh: "订单金额超过单次刷卡限额，请联系我们", ...Object.fromEntries(["ja", "ko", "ru", "hi", "es", "fr", "ar"].map((l) => [l, catalog[KEY] && catalog[KEY][l]])) };
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

// ══ D. the admin list's money and the migration's shape ═══════════════════════════════════════════════════════════════════════════
eq([P.schoolReqAmount({ amount: 13800 }), P.schoolReqAmount({ amount: 13800, charge_currency: "thb", charge_amount: null }), P.schoolReqAmount({ amount: "214000.00" })], ["฿13,800", "฿13,800", "฿214,000"], "admin: a baht row prints what it always printed, with or without the new fields");
eq([P.schoolReqAmount({ amount: 13800, charge_currency: "usd", charge_amount: 434.85 }), P.schoolReqAmount({ amount: 321000, charge_currency: "cny", charge_amount: 70800 })], ["US$434.85 (฿13,800)", "¥70,800 (฿321,000)"], "admin: a dollar / yuan row prints the charge first and the baht list price in brackets");
ok(/\{schoolReqAmount\(r\)\}/.test(read("App.tsx")) && !/฿\{Number\(r\.amount\)\.toLocaleString\(\)\}/.test(read("App.tsx")), "App.tsx's admin list prints the request with schoolReqAmount, not a hard-coded ฿");
ok(/^begin;/m.test(MIG) && /^commit;/m.test(MIG), "the migration is one transaction (begin ... commit)");
ok(!/create (or replace )?function\s+public\.school_submit_payment_request\s*\(/i.test(MIG), "the migration does not touch the five-argument school_submit_payment_request");
ok(/school_submit_payment_request_v2\(\s*p_institution_name text, p_tier text, p_seats int, p_cycle text, p_method text, p_currency text\s*\)/.test(MIG), "the new function is school_submit_payment_request_v2 with a sixth, undefaulted p_currency (a defaulted overload makes five-argument calls ambiguous)");
ok(/charge_currency text\s+not null default 'thb'/.test(MIG) && /add column if not exists charge_amount\s+numeric/.test(MIG) && /school_payment_requests_charge_ck/.test(MIG), "the migration adds charge_currency (default thb), charge_amount and the CHECK, all re-runnable");
ok(/raise exception 'the school price table does not match payment\.tsx/.test(MIG) && /notify pgrst, 'reload schema'/.test(MIG), "the migration rolls itself back on a wrong price and reloads the API schema");
ok(/coalesce\(p_currency, ''\) not in \('usd','cny'\)/.test(MIG) && /coalesce\(\(p_method = 'stripe'[^\n]*\), false\)/.test(MIG), "v2 accepts only usd / cny and refuses a null method itself (null-safe checks)");
ok(/v_charge \* 100 > 99999999/.test(MIG) && /too many seats for one card payment/.test(MIG), "v2 refuses a card order Stripe could never open (8 digits of the smallest unit)");
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
  ok(/\{ \.\.\.args, p_currency: curM \}/.test(src) && /curOf\(method\)/.test(src) && /method === "stripe" \? cardCur : \(method === "alipay" \|\| method === "wechat"\) \? "cny" : "thb"/.test(src), "p_currency is only ever the whitelisted result of curOf(method): usd / cny for the card, cny for Alipay / WeChat");
  ok(/body: JSON\.stringify\(\{ requestId: data\.id, expect: totalPreview, cur: cardCur \}\)/.test(src), "the edge function body is the row id plus the figure shown and its currency, nothing else");
}
console.log(`\n${pass} passed, ${fail} failed${skipped ? ", " + skipped + " skipped" : ""}`);
process.exit(fail ? 1 : 0);
