/* One-off patch — the 30-day conversion funnel (owner-approved strategy
   2026-09-19, decisions 1A/2A/3A/4A/5A):

   1) App.tsx imports + PianoApp state/effect: convPopup/convWinBack are
      computed from plan+profile; auto-dismiss after payment lands (plan
      change clears any live popup); popup dismissals are remembered per
      device via use-conversion's localStorage map.
   2) TRIAL BANNER: last 5 days switch to loss-framing copy + urgent CTA
      that opens checkout directly (startCheckout("premium", billCycle)).
   3) CONV POPUP JSX: one .atpopup instance rendering the active kind
      (welcome/halfway/closing/winback) with copy from CONV_COPY; the
      closing CTA opens the PromptPay CheckoutModal in one tap (3A).
   4) SONG-CREATION GIFT (1A): free members who hit the locked creation
      endpoints get the exact-once gift instead of a dead end — gate stays
      FREE_LIMITS-compliant (FREE_LIMITS.song/compose stay 0; the gift is
      read BEFORE canUse, never writes tg_usage).
   5) Practice-result "keep it going" pill (3*): free-plan learners with a
      great result get a soft upgrade line under the stats.

   str_replace is out of sync with App.tsx (recurring) — applied via Node
   with literal anchors + idempotence guards. */
import { readFileSync, writeFileSync } from "node:fs";

const A = "App.tsx";
let s = readFileSync(A, "utf8");
let fails = 0;
function rep(oldStr, newStr, label) {
  if (s.includes(newStr)) { console.log(`ok (already): ${label}`); return; }
  if (!s.includes(oldStr)) { console.error(`MISS: ${label}`); fails++; return; }
  s = s.split(oldStr).join(newStr);
  console.log(`patched: ${label}`);
}

/* ── 1. import ── */
rep(
  `import { sb, SUPABASE_URL } from "./supabase-client";`,
  `import { sb, SUPABASE_URL } from "./supabase-client";\nimport { CONV_COPY, convPopupFor, convWinBack, convSeen, markConvSeen, trialDay, canUseSongGift, consumeSongGift } from "./use-conversion";`,
  "import use-conversion",
);

/* ── 2. PianoApp: state + effect right after usePayment ── */
rep(
  `  const [buyCurrencyOpen, setBuyCurrencyOpen] = useState(false);`,
  `  const [buyCurrencyOpen, setBuyCurrencyOpen] = useState(false);\n  /* Conversion funnel (owner-approved 2026-09-19): one trial-stage popup at a\n     time — welcome (d1-3), halfway price-lock (d15-28), closing + direct\n     checkout (d29-30) — plus the expired-trial win-back. Never fires for\n     paying members or admins: effectivePlan maps them to non-trial/non-free,\n     so neither probe matches. Recomputed when plan/profile changes, which\n     also auto-clears the popup the moment a payment lands. */\n  const [convPopup, setConvPopup] = useState(null);\n  useEffect(() => {\n    const next = convPopupFor(profile, plan) || convWinBack(profile, plan);\n    setConvPopup(next);\n  }, [profile, plan]);\n  function dismissConvPopup() {\n    if (convPopup) markConvSeen(convPopup.id);\n    setConvPopup(null);\n  }`,
  "PianoApp conv state",
);

/* ── 3. trial banner: urgent loss-framing in the last 5 days ── */
rep(
  `      {plan === "trial" && (() => {\n        const dLeft = trialDaysLeft(profile);\n        if (dLeft <= 0) return null;\n        return (\n          <div className="trial-banner">\n            <span className="trial-banner-txt">{lc.trialBanner} · {dLeft} {lc.trialDaysLeft}</span>\n            <button className="trial-banner-btn" onClick={() => { playUi("click"); setPricingOpen(true); }}>{lc.trialUpgrade}</button>\n          </div>\n        );\n      })()}`,
  `      {plan === "trial" && (() => {\n        const dLeft = trialDaysLeft(profile);\n        if (dLeft <= 0) return null;\n        /* Last 5 days switch to loss aversion (strategy phase 4): the banner\n           names exactly what expires and the CTA jumps straight to checkout\n           instead of the generic pricing sheet. */\n        const urgent = dLeft <= 5;\n        const cc = CONV_COPY[lang] || CONV_COPY.en;\n        return (\n          <div className={"trial-banner" + (urgent ? " urgent" : "")}>\n            <span className="trial-banner-txt">{urgent ? cc.bannerUrgent.replace("{n}", String(dLeft)) : <>{lc.trialBanner} · {dLeft} {lc.trialDaysLeft}</>}</span>\n            <button className="trial-banner-btn" onClick={() => { playUi("click"); urgent ? startCheckout("premium", billCycle) : setPricingOpen(true); }}>{urgent ? cc.bannerUrgentBtn : lc.trialUpgrade}</button>\n          </div>\n        );\n      })()}`,
  "trial banner urgent",
);

/* ── 4. popup JSX before the Auto-Teaching tip block ── */
rep(
  `      {/* Auto Teaching — real-time coaching card (Max plan, fires on a timer while on the Pathway page) */}`,
  `      {/* Conversion-funnel popup (owner-approved 2026-09-19): trial-stage\n          messaging from ครู TIGA AI — welcome / halfway price-lock / closing\n          (checkout in one tap) / expired win-back. One instance, highest-\n          priority phase first; dismissal is remembered per device. */}\n      {convPopup && (() => {\n        const cc = CONV_COPY[lang] || CONV_COPY.en;\n        const c = cc[convPopup.kind];\n        return (\n          <div className="atpopup" onClick={dismissConvPopup}>\n            <div className="atpopup-card convpop" onClick={e => e.stopPropagation()}>\n              <div className="atpopup-hd">\n                <span className="atpopup-ic" aria-hidden="true">{c.ic}</span>\n                <div className="atpopup-tt">{c.title}</div>\n                <button className="atpopup-x" onClick={dismissConvPopup} aria-label="close">×</button>\n              </div>\n              <div className="atpopup-weak" style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>\n              {convPopup.kind === "closing" && <div className="convpop-items">{c.items}</div>}\n              {convPopup.kind === "closing"\n                ? <div style={{ display: "flex", gap: 8, marginTop: 12 }}>\n                    <button className="atpopup-ok" style={{ flex: 1.4 }} onClick={() => { markConvSeen(convPopup.id); setConvPopup(null); startCheckout("premium", billCycle); }}>{c.cta}</button>\n                    <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => { markConvSeen(convPopup.id); setConvPopup(null); setPricingOpen(true); }}>{c.alt}</button>\n                  </div>\n                : <div style={{ display: "flex", gap: 8, marginTop: 12 }}>\n                    <button className="atpopup-ok" style={{ flex: 1 }} onClick={dismissConvPopup}>{c.cta}</button>\n                    {convPopup.kind === "winback" && <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => { markConvSeen(convPopup.id); setConvPopup(null); setPricingOpen(true); }}>{(CONV_COPY[lang] || CONV_COPY.en).halfway.cta}</button>\n                  </div>}\n            </div>\n          </div>\n        );\n      })()}\n\n      {/* Auto Teaching — real-time coaching card (Max plan, fires on a timer while on the Pathway page) */}`,
  "conv popup jsx",
);

/* ── 5. song gift: generateSong ── */
rep(
  `    if (!canUse("song", premium)) { setCreateOpen(false); if (onUpsell) onUpsell(); return; }\n    setGenerating(true); setGenErr(false);\n    try {\n      const sys = "You turn a song request into`,
  `    /* Conversion gift (1A): a free member gets song creation exactly once,\n       ever. The regular cap stays 0 — the gift is checked before canUse and\n       burns its own lifetime flag, not the daily bucket. */\n    if (!premium && !canUse("song", premium) && canUseSongGift()) {\n      consumeSongGift();\n    } else if (!canUse("song", premium)) { setCreateOpen(false); if (onUpsell) onUpsell(); return; }\n    setGenerating(true); setGenErr(false);\n    try {\n      const sys = "You turn a song request into`,
  "song gift generateSong",
);

/* ── 6. song gift: composeGenerate ── */
rep(
  `    if (!canUse("compose", premium)) { setComposeOpen(false); if (onUpsell) onUpsell(); return; }`,
  `    /* Same exact-once gift on the second creation endpoint (1A). */\n    if (!premium && !canUse("compose", premium) && canUseSongGift()) {\n      consumeSongGift();\n    } else if (!canUse("compose", premium)) { setComposeOpen(false); if (onUpsell) onUpsell(); return; }`,
  "song gift composeGenerate",
);

/* ── 8. CSS for the two new pieces ── */
const CSS_FILE = "app-styles.ts";
let c = readFileSync(CSS_FILE, "utf8");
const cssAdd = [
  "",
  "/* conversion funnel (owner-approved 2026-09-19) */",
  ".trial-banner.urgent{background:linear-gradient(90deg,#b45309,#d97757)}",
  ".convpop-items{background:var(--card2);border:1px solid var(--bd2);border-radius:12px;padding:10px 12px;margin-top:10px;font-size:13px;line-height:1.9;white-space:pre-wrap}",
  ".presultkeep{width:100%;margin-top:10px;padding:11px 12px;border:1px solid #d9775755;background:linear-gradient(135deg,#d9775722,#8b5cf622);border-radius:12px;color:var(--text);font-size:13px;font-weight:600;cursor:pointer}",
].join("\n") + "\n";
if (!c.includes(".presultkeep")) { writeFileSync(CSS_FILE, c + cssAdd); console.log("patched: css"); }
else console.log("ok (already): css");

if (fails) { console.error(`${fails} MISS — nothing written for those anchors`); process.exit(1); }
writeFileSync(A, s);
console.log("App.tsx written");
