#!/usr/bin/env node
/* verify-inapp-escape.mjs — the way out of an in-app browser (Step 2.1, owner 2026-11-26). No browser needed: it runs the REAL code.
     node scripts/verify-inapp-escape.mjs
   (a) app-shell.tsx and landing/landing-utils.tsx must hold the SAME escape logic: the text between the <inapp-escape:begin> / <inapp-escape:end> markers is compared character for character
       (the landing bundle may not import the app, so the block exists twice; a change to one without the other is the bug this check catches);
   (b) that block is transpiled with esbuild and run against sample user agents: LINE (iOS, Android), Facebook iOS (FBAN/FBIOS), Instagram Android ("; wv)"), TikTok iOS, Safari, Chrome - which kind it is and which URL the
       button builds (LINE: openExternalBrowser=1; Android: intent:// with no package and S.browser_fallback_url; iOS: x-safari-https://), the flag helper (idempotent, fragment-safe), the address-bar clean-up, the clipboard-first
       order of openInRealBrowser, and the "did the page leave?" wait that decides when the iOS guide appears;
   (c) the guide words exist in all 11 landing languages and the 8 catalog languages, no source still names Chrome or googlechrome://, and campaign-funnel.ts counts the four escape:* rows as an escape tap.
   What this CANNOT tell: whether LINE, Facebook, Instagram or TikTok on a real phone honour these URLs, and whether iOS refuses x-safari-https:// in a given app version. That needs a phone. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { transformSync } = require("esbuild");
let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log("  ✓ " + n); } else { fails.push(n); console.log("  ✗ FAIL: " + n); } };
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const BEGIN = "// <inapp-escape:begin>", END = "// <inapp-escape:end>";
const blockOf = (f) => { const s = read(f), a = s.indexOf(BEGIN), b = s.indexOf(END); return a < 0 || b < 0 ? null : s.slice(a, b + END.length); };

console.log("(a) the two copies");
const A = blockOf("app-shell.tsx"), B = blockOf("landing/landing-utils.tsx");
ok(!!A && !!B, "both files carry the markers");
ok(A === B, "app-shell.tsx and landing/landing-utils.tsx hold the identical escape block (" + (A ? A.length : 0) + " characters)");

console.log("(b) the real code against sample user agents");
const js = transformSync("const handoffUrl = (u) => u;\n" + A, { loader: "ts", format: "esm" }).code;
const M = await import("data:text/javascript;base64," + Buffer.from(js + "\n// " + Math.random()).toString("base64"));
const UA = {
  lineIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.9.0",
  lineAndroid: "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.43 Mobile Safari/537.36 Line/13.9.0/IAB",
  fbIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/430.0.0.30.113;FBBV/500;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.1;FBSS/3;FBID/phone;FBLC/th_TH;FBOP/5]",
  igAndroid: "Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.43 Mobile Safari/537.36 Instagram 310.0.0.37.109 Android (33/13; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; th_TH; 543988301)",
  tiktokIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_32.0.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/th Region/TH",
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  chrome: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  iosWk: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
};
const U = "https://www.tigaalpha.com/landing/?utm_source=fb&hlg=th&hsrc=fb";
for (const [name, ua, kind] of [["LINE iOS", UA.lineIos, "line"], ["LINE Android", UA.lineAndroid, "line"], ["Facebook iOS (FBAN/FBIOS)", UA.fbIos, "facebook"], ["Instagram Android (; wv)", UA.igAndroid, "instagram"], ["TikTok iOS", UA.tiktokIos, "tiktok"], ["an iOS WKWebView with no app token", UA.iosWk, "other-webview"], ["Safari", UA.safari, ""], ["Chrome", UA.chrome, ""]])
  ok(M.inAppKindOf(ua) === kind, `${name}: kind "${kind}"`);
ok(["lineIos", "lineAndroid", "fbIos", "igAndroid", "tiktokIos", "iosWk"].every((k) => M.inAppKindOf(UA[k]) !== "") && M.inAppKindOf(UA.safari) === "" && M.inAppKindOf(UA.chrome) === "", "inAppBrowser() stays the boolean of 'any kind' (true for every webview above, false for Safari and Chrome)");

const lineIos = M.escapePlan(U, UA.lineIos), lineAnd = M.escapePlan(U, UA.lineAndroid);
ok(lineIos.method === "line-flag" && lineIos.target === U + "&openExternalBrowser=1", "LINE iOS: the same URL + &openExternalBrowser=1 (" + lineIos.target + ")");
ok(lineAnd.method === "line-flag" && lineAnd.target === U + "&openExternalBrowser=1", "LINE Android: the same URL + &openExternalBrowser=1");
const ig = M.escapePlan(U, UA.igAndroid);
ok(ig.method === "android-intent" && ig.target.startsWith("intent://www.tigaalpha.com/landing/?utm_source=fb&hlg=th&hsrc=fb#Intent;scheme=https;") && ig.target.includes(";S.browser_fallback_url=" + encodeURIComponent(U) + ";end") && !/package=/.test(ig.target), "Instagram Android: an intent:// URL, no package named (the phone's own browser), S.browser_fallback_url = the encoded URL");
const fb = M.escapePlan(U, UA.fbIos), tt = M.escapePlan(U, UA.tiktokIos);
ok(fb.method === "ios-safari" && fb.target === "x-safari-https://www.tigaalpha.com/landing/?utm_source=fb&hlg=th&hsrc=fb", "Facebook iOS: x-safari-https:// + the same address (the Chrome-only googlechrome:// is gone)");
ok(tt.method === "ios-safari" && tt.target.startsWith("x-safari-https://"), "TikTok iOS: x-safari-https://");
ok(M.escapePlan(U, "Mozilla/5.0 (Windows NT 10.0) Chrome/120").method === "window", "a desktop browser: window.open");

console.log("    the LINE flag");
const W = M.withExternalBrowserFlag;
ok(W("https://a.b/landing/") === "https://a.b/landing/?openExternalBrowser=1", "no query: adds ?openExternalBrowser=1");
ok(W("https://a.b/x?y=1") === "https://a.b/x?y=1&openExternalBrowser=1", "a query: adds &openExternalBrowser=1");
ok(W("https://a.b/x?y=1#frag") === "https://a.b/x?y=1&openExternalBrowser=1#frag" && W("https://a.b/x#frag") === "https://a.b/x?openExternalBrowser=1#frag", "a #fragment stays at the end");
ok(W(W("https://a.b/x?y=1")) === W("https://a.b/x?y=1") && W("https://a.b/x?openExternalBrowser=1&y=1") === "https://a.b/x?openExternalBrowser=1&y=1", "never added twice (idempotent, an existing flag is left alone)");

console.log("    the address bar and the order of the jump (a fake window)");
const fake = (ua, search = "", hash = "") => {
  const calls = [];
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: ua, clipboard: { writeText: (t) => { calls.push("copy:" + t); return Promise.resolve(); } } }, configurable: true, writable: true });
  const loc = { href: "https://www.tigaalpha.com/landing/" + search + hash, search, hash, pathname: "/landing/" };
  Object.defineProperty(loc, "href", { get: () => "https://www.tigaalpha.com/landing/" + search + hash, set: (v) => calls.push("go:" + v) });
  globalThis.window = { location: loc, history: { state: null, replaceState: (s, t, u) => calls.push("replace:" + u) }, open: (u) => { calls.push("open:" + u); return {}; } };
  return calls;
};
let calls = fake(UA.safari, "?openExternalBrowser=1&utm_source=share");
M.stripExternalBrowserFlag();
ok(calls.join() === "replace:/landing/?utm_source=share", "arrived in Safari with the flag first: it is removed, the other parameters stay (" + calls.join() + ")");
calls = fake(UA.safari, "?a=1&openExternalBrowser=1", "#x"); M.stripExternalBrowserFlag();
ok(calls.join() === "replace:/landing/?a=1#x", "the flag last: removed, the #fragment stays (" + calls.join() + ")");
calls = fake(UA.safari, "?openExternalBrowser=1"); M.stripExternalBrowserFlag();
ok(calls.join() === "replace:/landing/", "the flag alone: the address is clean again (" + calls.join() + ")");
calls = fake(UA.lineIos, "?openExternalBrowser=1"); M.stripExternalBrowserFlag();
ok(calls.length === 0, "still inside LINE: the flag is NOT removed (it is still needed there)");
calls = fake(UA.safari, "?a=1"); M.stripExternalBrowserFlag();
ok(calls.length === 0, "no flag: nothing is touched");
calls = fake(UA.fbIos, "?a=1"); const how = M.openInRealBrowser();
ok(how === "ios-safari" && calls[0].startsWith("copy:") && calls[1].startsWith("go:x-safari-https://"), "Facebook iOS: the link is copied FIRST, then the page goes to x-safari-https:// (" + calls.map((c) => c.slice(0, 22)).join(" | ") + ")");
calls = fake(UA.lineAndroid, "?a=1"); const how2 = M.openInRealBrowser();
ok(how2 === "line-flag" && calls[0].startsWith("copy:") && calls[1] === "go:https://www.tigaalpha.com/landing/?a=1&openExternalBrowser=1", "LINE: copied first, then the same address with the flag");
calls = fake(UA.igAndroid, ""); const how3 = M.openInRealBrowser();
ok(how3 === "android-intent" && calls[1].startsWith("go:intent://"), "Android webview: copied first, then the intent:// URL");

console.log("    did the page leave? (decides when the iOS guide appears)");
{
  const listeners = { doc: {}, win: {} };
  globalThis.document = { visibilityState: "visible", addEventListener: (e, f) => { listeners.doc[e] = f; }, removeEventListener: (e) => { delete listeners.doc[e]; } };
  globalThis.window = { addEventListener: (e, f) => { listeners.win[e] = f; }, removeEventListener: (e) => { delete listeners.win[e]; } };
  const stay = await M.waitForPageLeave(40);
  ok(stay === true && !listeners.doc.visibilitychange && !listeners.win.pagehide, "nothing happened for the whole wait: still here (true) and the listeners are removed");
  const p = M.waitForPageLeave(60); listeners.win.pagehide(); const left = await p;
  ok(left === false, "pagehide inside the wait: the page left (false), no guide");
  const p2 = M.waitForPageLeave(60); globalThis.document.visibilityState = "hidden"; listeners.doc.visibilitychange(); const left2 = await p2;
  ok(left2 === false, "the page went hidden inside the wait: it left (false), no guide");
}

console.log("(c) words, sources and the funnel");
const copy = read("landing/landing-copy.ts");
ok((copy.match(/escGuideT: "/g) || []).length === 11 && (copy.match(/escGuide1: "/g) || []).length === 11 && (copy.match(/escGuide2: "/g) || []).length === 11 && (copy.match(/escGuide3: "/g) || []).length === 11, "the guide title and its 3 steps exist in all 11 landing languages");
const cat = JSON.parse(read("i18n-src/catalog.json"));
const need = ["Open this page in your browser", "Tap the ⋯ (three dots) menu of this app — often at the top right or at the bottom.", "Choose “Open in browser” or “Open in Safari”.", "The link is already copied — you can also open your browser and paste it."];
ok(need.every((k) => cat[k] && ["ja", "ko", "ru", "hi", "es", "fr", "ar", "de"].every((l) => cat[k][l])), "the same four lines exist in the 8 catalog languages");
const noChrome = ["app-shell.tsx", "landing/landing-utils.tsx", "landing/LandingPage1.tsx", "guest-strips.tsx"].every((f) => !/googlechrome:\/\/|package=com\.android\.chrome/.test(read(f)));
ok(noChrome, "no source still forces Chrome (googlechrome:// / package=com.android.chrome)");
const fun = read("campaign-funnel.ts");
ok(["escape:line-flag", "escape:android-intent", "escape:ios-safari", "escape:ios-guide"].every((e) => fun.includes('"' + e + '"')), "campaign-funnel.ts counts the four escape:* rows as an escape tap");
const land = read("landing/LandingPage1.tsx"), shell = read("app-shell.tsx");
ok(/land\("escape:" \+ how\)/.test(land) && /land\("escape:ios-guide"\)/.test(land) && /logUsage\("land", "escape:" \+ how\)/.test(shell) && /logUsage\("land", "escape:ios-guide"\)/.test(shell), "both sides log escape:<method> and escape:ios-guide through their usual logger");
ok(/data-escape-guide/.test(land) && /data-escape-guide/.test(shell) && /lp-escguide-x/.test(land) && /egd-x/.test(shell), "the guide is a closable sheet on both sides");

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) console.log("failed:\n - " + fails.join("\n - "));
process.exit(fails.length ? 1 : 0);
