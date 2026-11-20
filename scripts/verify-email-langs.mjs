#!/usr/bin/env node
/* verify-email-langs.mjs — the two scheduled senders speak every app language (owner, 2026-11-17: "the weekly summary and the come-back
   reminder are still English in the new languages — deploy approved").

   What they are: supabase/functions/weekly-report (Monday, pg_cron) and supabase/functions/return-reminders (daily, days 1 / 3 / 7 after sign-up).
   Both write ONE short push text and the same words into the in-app inbox (`notifications`); there is no e-mail provider behind them. Until
   2026-11-17 a learner whose profile language was ja ko ru hi es fr ar got the English text; de joined them after (2026-11-20).

   What this runs (no network, no Deno: the real files are cut before `Deno.serve`, the type annotations are stripped by esbuild and the tables
   are evaluated):
     - all eleven languages exist for the weekly text and for day 1, 3 and 7;
     - th / en / zh are byte for byte what was already live (pinned below, copied from the deployed v6 / v2);
     - every text fits a push (title <= 45, body <= 120 characters), keeps its emoji, has no placeholder left over, and the weekly body prints the
       streak for 0, 1, 2, 12 and 365 (Latin digits 0-9 in every language, Arabic included);
     - each language is written in its own script (kana / kanji, hangul, Cyrillic, Devanagari, Arabic; es, fr and de carry their accents), no Thai in a
       non-Thai text, no English sentence in a non-Latin one (EXP / TIGA allowed);
     - pickLang: no language -> th, th -> th, every table language -> itself, anything else (an unknown code, "constructor") -> en;
     - the guard rails the deploy must not lose: the cron-secret check, the POST-only check, the app_settings switches, no secret in the file.
   Run: node scripts/verify-email-langs.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n); } };
const LANGS = ["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar", "de"];
const NEW = ["ja", "ko", "ru", "hi", "es", "fr", "ar", "de"];

async function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const cut = src.slice(0, src.indexOf("Deno.serve("));
  const js = transformSync(cut.replace(/^import .*$/gm, ""), { loader: "ts", target: "esnext" }).code + "\nexport { MSG, pickLang };";
  return { src, M: await import("data:text/javascript;base64," + Buffer.from(js).toString("base64")) };
}
const W = await load("supabase/functions/weekly-report/index.ts");
const R = await load("supabase/functions/return-reminders/index.ts");

/* the texts that were live before (weekly-report v6, return-reminders v2): they must not change by a byte */
const OLD_WEEKLY = {
  th: ["รายงานประจำสัปดาห์พร้อมแล้ว 📊", (s) => `สตรีค ${s} วัน — ครู TiGA สรุปจุดที่ควรฝึกต่อให้แล้ว แตะเพื่อดูเลย`],
  en: ["Your weekly report is ready 📊", (s) => `${s}-day streak — I've picked out exactly what to focus on next. Tap to see it`],
  zh: ["本周报告已生成 📊", (s) => `连续${s}天——老师已经帮你找出接下来该练的重点，点击查看`],
};
const OLD_RETURN = {
  1: { th: ["เพลงประจำวันใหม่รออยู่ 🎵", "เล่นเพลงเดียวใน 1 นาที รับเหรียญและ EXP ของวันนี้"], en: ["A new daily song is waiting 🎵", "One song, about a minute — today's coins and EXP are yours"], zh: ["新的每日歌曲在等你 🎵", "只弹一首，约 1 分钟——今天的金币和经验归你"] },
  3: { th: ["เล่นต่อจากที่ค้างไว้ไหม 🎹", "ลองเพลงที่สอง — ได้ดาวเพิ่ม และเห็นว่าคุณเก่งขึ้นแล้ว"], en: ["Pick up where you left off 🎹", "Try a second song — more stars, and you'll hear yourself improve"], zh: ["接着上次继续弹吧 🎹", "试试第二首歌——多拿星星，也能听出自己进步了"] },
  7: { th: ["ครบสัปดาห์แรกแล้ว 🌟", "มาดูว่าคุณเก่งขึ้นแค่ไหน แล้วเริ่มสัปดาห์ใหม่ด้วยเพลงเดียว"], en: ["Your first week is done 🌟", "See how far you've come, then start week two with a single song"], zh: ["第一周完成啦 🌟", "看看你进步了多少，然后用一首歌开启第二周"] },
};
const EMOJI = { weekly: "📊", 1: "🎵", 3: "🎹", 7: "🌟" };

// ── 1. completeness and the old texts ─────────────────────────────────────────────────────────
ok(LANGS.every((l) => W.M.MSG[l] && typeof W.M.MSG[l].t === "string" && typeof W.M.MSG[l].b === "function"), "weekly-report: a title and a body(streak) for all eleven languages");
ok(Object.keys(W.M.MSG).length === 11, "weekly-report: exactly eleven languages in the table (" + Object.keys(W.M.MSG).join(" ") + ")");
ok([1, 3, 7].every((d) => LANGS.every((l) => R.M.MSG[d] && R.M.MSG[d][l] && R.M.MSG[d][l].t && R.M.MSG[d][l].b)), "return-reminders: a title and a body for all eleven languages on day 1, 3 and 7");
ok(Object.keys(R.M.MSG).join() === "1,3,7" && [1, 3, 7].every((d) => Object.keys(R.M.MSG[d]).length === 11), "return-reminders: exactly the days 1, 3, 7 and eleven languages each");
for (const l of ["th", "en", "zh"]) {
  ok(W.M.MSG[l].t === OLD_WEEKLY[l][0] && [0, 1, 5, 12, 365].every((s) => W.M.MSG[l].b(s) === OLD_WEEKLY[l][1](s)), `weekly-report: ${l} is byte for byte the text that was already live`);
  ok([1, 3, 7].every((d) => R.M.MSG[d][l].t === OLD_RETURN[d][l][0] && R.M.MSG[d][l].b === OLD_RETURN[d][l][1]), `return-reminders: ${l} is byte for byte the text that was already live (days 1, 3, 7)`);
}
ok(/type Lang = "th" \| "en" \| "zh" \| "ja" \| "ko" \| "ru" \| "hi" \| "es" \| "fr" \| "ar" \| "de";/.test(R.src), "return-reminders: the Lang type lists all eleven languages");

// ── 2. every text is a push: short, with its emoji, nothing left over ────────────────────────
const cp = (s) => [...s].length;
for (const l of LANGS) {
  const items = [["weekly", W.M.MSG[l].t, W.M.MSG[l].b(12)], ...[1, 3, 7].map((d) => [d, R.M.MSG[d][l].t, R.M.MSG[d][l].b])];
  const bad = [];
  for (const [id, t, b] of items) {
    if (cp(t) > 45) bad.push(`${id} title ${cp(t)} chars`);
    if (cp(b) > 120) bad.push(`${id} body ${cp(b)} chars`);
    if (!t.includes(EMOJI[id])) bad.push(`${id} lost its emoji`);
    if (/undefined|NaN|null|\[object|\{streak\}|\$\{|\{[0-9]\}/.test(t + b)) bad.push(`${id} has a placeholder or junk left`);
    if (!t.trim() || !b.trim()) bad.push(`${id} empty`);
  }
  ok(!bad.length, `${l}: all four texts fit a push, keep their emoji and have nothing left over${bad.length ? " — " + bad.join("; ") : ""}`);
}
for (const l of LANGS) {
  const outs = [0, 1, 2, 12, 365].map((s) => [s, W.M.MSG[l].b(s)]);
  const digitsOk = outs.every(([s, o]) => o.includes(String(s)) && !/[٠-٩०-९]/.test(o));
  ok(digitsOk, `${l}: the weekly body prints the streak (0, 1, 2, 12, 365) in Latin digits`);
}
ok(/jour\b/.test(W.M.MSG.fr.b(1)) && /jours\b/.test(W.M.MSG.fr.b(2)) && /jours\b/.test(W.M.MSG.fr.b(0) === W.M.MSG.fr.b(0) ? W.M.MSG.fr.b(12) : ""), "fr: \"1 jour\" is singular and 2, 12 are plural");

ok(/Tag\b/.test(W.M.MSG.de.b(1)) && /Tage\b/.test(W.M.MSG.de.b(2)) && /Tage\b/.test(W.M.MSG.de.b(12)), "de: \"1 Tag\" is singular and 2, 12 are plural");
ok(/\bdu\b|\bdir\b|\bdeine?\b|\bdich\b/i.test(textOfDe()) && !/\b(Sie|Ihr|Ihre|Ihnen)\b/.test(textOfDe()), "de: written in the du-form (no Sie)");
function textOfDe() { return [W.M.MSG.de.t, W.M.MSG.de.b(7), ...[1, 3, 7].flatMap((d) => [R.M.MSG[d].de.t, R.M.MSG[d].de.b])].join("\n"); }

// ── 3. each language in its own script ────────────────────────────────────────────────────────
const SCRIPT = { ja: /[ぁ-んァ-ヶ一-龯]/, ko: /[가-힣]/, ru: /[а-яА-ЯёЁ]/, hi: /[ऀ-ॿ]/, ar: /[؀-ۿ]/ };
const textOf = (l) => [W.M.MSG[l].t, W.M.MSG[l].b(7), ...[1, 3, 7].flatMap((d) => [R.M.MSG[d][l].t, R.M.MSG[d][l].b])];
for (const l of NEW) {
  const all = textOf(l).join("\n");
  if (SCRIPT[l]) {
    const every = textOf(l).every((t) => SCRIPT[l].test(t));
    ok(every, `${l}: every one of the eight lines is in its own script`);
    const stripped = all.replace(/EXP|TIGA|\p{Extended_Pictographic}/gu, " ");
    ok(!/[A-Za-z]{4,}/.test(stripped), `${l}: no English word of 4+ letters is left (EXP and TIGA are kept as written)`);
  } else {
    ok(/[áéíóúñ¿¡]/.test(all) || /[éèêàçùôî]/.test(all) || /[äöüß]/.test(all), `${l}: carries its own accented letters`);
    const english = textOf(l).filter((t) => /\b(the|your|you|with|then|today)\b/i.test(t) || (l !== "de" && /\band\b/i.test(t)));
    ok(!english.length, `${l}: no English sentence among the eight lines`);
  }
  ok(!/[฀-๿]/.test(all), `${l}: no Thai character`);
  ok(l === "ja" || !/[㐀-鿿]/.test(all), `${l}: no Chinese character${l === "ja" ? " (Japanese may use kanji, so this one is skipped)" : ""}`);
}

// ── 4. the language pick, in both files ───────────────────────────────────────────────────────
for (const [name, X] of [["weekly-report", W], ["return-reminders", R]]) {
  const pk = X.M.pickLang;
  ok(pk(null) === "th" && pk(undefined) === "th" && pk("") === "th" && pk("th") === "th", `${name}: no language at all, or th, stays Thai as it always was`);
  ok(["en", "zh", ...NEW].every((l) => pk(l) === l), `${name}: every other table language gets its own text (en zh ${NEW.join(" ")})`);
  ok(["xx", "EN", "pt", "constructor", "__proto__", "toString", "pt-BR"].every((l) => pk(l) === "en"), `${name}: an unknown code (xx, pt, pt-BR, constructor, __proto__) falls back to English, never to a crash`);
}

// ── 5. what the deploy must not lose ──────────────────────────────────────────────────────────
for (const [name, X, key] of [["weekly-report", W, "weekly_report"], ["return-reminders", R, "return_reminders"]]) {
  ok(/x-cron-secret/.test(X.src) && /Unauthorized/.test(X.src) && /status: 401/.test(X.src), `${name}: still refuses a call without the cron secret (401)`);
  ok(/req\.method !== "POST"/.test(X.src), `${name}: still POST only`);
  ok(new RegExp('eq\\("key", "' + key + '"\\)').test(X.src) && /enabled/.test(X.src), `${name}: still gated on app_settings.${key}.enabled`);
  ok(!/eyJ[A-Za-z0-9_-]{20,}|sb_secret|sk_live|service_role\s*[:=]\s*["']/.test(X.src), `${name}: no key or secret in the file`);
}
ok(/lang\b/.test(W.src.slice(W.src.indexOf("Deno.serve("))) && /pickLang\(u\.lang\)/.test(W.src), "weekly-report: the language comes from profiles.lang through pickLang");
ok(/pickLang\(p\.lang\)/.test(R.src), "return-reminders: the language comes from profiles.lang through pickLang");

console.log(`\n--- ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
