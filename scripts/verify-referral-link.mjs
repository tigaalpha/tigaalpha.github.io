#!/usr/bin/env node
/* verify-referral-link.mjs — Step 3.4: share links back to www.tigaalpha.com with the referral code, and the ?ref= capture.
     node scripts/verify-referral-link.mjs        (no browser; transpiles the REAL share-links.ts and local-identity.ts with esbuild and runs them against a fake browser)
   (a) buildShareUrl: the real domain, utm_source=share, utm_medium, utm_campaign, and ref=<code> only when this browser knows the account's own code (tg_my_ref);
   (b) no user-visible share point still prints the old github.io host (share points are named; comments and the studio / OTA / edge-function files are not share points);
   (c) ?ref= is stored (tg_ref, 30 days), an invalid code is not, an old one expires, and the code rides handoffUrl; nothing here needs the landing page to work differently (it only calls attributionEvent). */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);
const tmp = path.join(ROOT, "node_modules/.cache"); fs.mkdirSync(tmp, { recursive: true });
const load = async (entry, name) => { const r = await build({ entryPoints: [path.join(ROOT, entry)], bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent" }); const f = path.join(tmp, name + ".mjs"); fs.writeFileSync(f, r.outputFiles[0].text); return import(pathToFileURL(f).href + "?t=" + Date.now()); };
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.error("FAIL", m); } else console.log("ok  ", m); };
const store = {}; let search = "", href = "https://www.tigaalpha.com/";
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.window = { location: { get search() { return search; }, get href() { return href; }, origin: "https://www.tigaalpha.com", pathname: "/" }, history: { state: null, replaceState() {} } };
Object.defineProperty(globalThis, "navigator", { value: { userAgent: "Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36", language: "en-US" }, configurable: true });
globalThis.document = { referrer: "" };
const S = await load("share-links.ts", "share-links-ref");
const u0 = new URL(S.buildShareUrl({ medium: "line", campaign: "song" }));
ok(u0.origin === "https://www.tigaalpha.com" && u0.pathname === "/landing/" && u0.searchParams.get("utm_source") === "share" && u0.searchParams.get("utm_medium") === "line" && u0.searchParams.get("utm_campaign") === "song" && !u0.searchParams.has("ref"), "buildShareUrl: real domain, utm_source=share, medium, campaign, no ref while the code is unknown");
store["tg_my_ref"] = "ab3k9xz";
const u1 = new URL(S.buildShareUrl({ medium: "native" }));
ok(u1.searchParams.get("ref") === "AB3K9XZ" && !u1.searchParams.has("utm_campaign"), "buildShareUrl: the account's own code rides as ref (upper-case), no empty campaign");
ok(S.shareUrl("copy").includes("ref=AB3K9XZ") && S.shareUrl("copy").includes("utm_medium=copy"), "shareUrl (the older name) goes through the same builder");
store["tg_my_ref"] = "<script>x";
ok(!S.buildShareUrl({ medium: "line" }).includes("script"), "a hostile stored value cannot inject into the link");
// (b) share points
const shareFiles = ["App.tsx", "SongPlayOverlay.tsx", "ReferralDashboard.tsx", "adventure.tsx", "share-links.ts", "PianoLevelQuiz.tsx"];
for (const f of shareFiles) { const t = fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").filter((l) => /tigaalpha\.github\.io/.test(l) && !/^\s*(\/\/|\/\*|\*)/.test(l) && !/\/\*.*tigaalpha\.github\.io/.test(l)); ok(t.length === 0, f + ": no user-visible old-domain text (" + t.length + ")"); }
const cat = fs.readFileSync(path.join(ROOT, "i18n-src/catalog.json"), "utf8"); ok(!/tigaalpha\.github\.io/.test(cat), "the translation catalog has no old-domain text");
// (c) ?ref=
const L = await load("local-identity.ts", "local-identity-ref");
for (const k of Object.keys(store)) delete store[k];
search = "?ref=ab3k9xz&utm_source=share"; L.captureRef();
ok(L.readRef() === "AB3K9XZ", "?ref= is stored (upper-case) and read back");
for (const k of Object.keys(store)) delete store[k]; search = "?ref=<b>"; L.captureRef(); ok(L.readRef() === null, "an invalid code is not stored");
search = "?ref=ABCDEFG"; L.captureRef(); const j = JSON.parse(store["tg_ref"]); j.at = Date.now() - 31 * 864e5; store["tg_ref"] = JSON.stringify(j); ok(L.readRef() === null, "a code older than 30 days is ignored");
search = "?ref=ABCDEFG"; L.captureRef(); const h = L.handoffUrl("https://www.tigaalpha.com/", { lg: "en", via: "mail" }); ok(/[?&]ref=ABCDEFG/.test(h), "the code rides the magic-link / handoff address");
L.clearRef(); ok(L.readRef() === null, "clearRef removes it");
const sql = fs.readFileSync(path.join(ROOT, "supabase-referral-migration.sql"), "utf8");
ok(/reward_enabled": false/.test(sql) && /on conflict \(key\) do nothing/.test(sql), "the SQL file ships the reward switched OFF and does not overwrite an existing setting");
ok(/referee_id uuid not null unique/.test(sql) && /v_created < now\(\) - interval '7 days'/.test(sql) && /v_ref = me/.test(sql), "the SQL file: one claim per account, accounts older than 7 days and your own code are refused");
console.log(fail ? `\n${fail} FAILED` : "\nall passed"); process.exit(fail ? 1 : 0);
