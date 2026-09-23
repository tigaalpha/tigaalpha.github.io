/* One-off patch, part 2 — the remaining education touchpoints outside
   App.tsx core state: chest pulse on the Profile daily hub, the first-visit
   shop intro banner, and the PvP loss→practice hand-off. Applied via Node
   with literal anchors + idempotence guards. */
import { readFileSync, writeFileSync } from "node:fs";

let fails = 0;
function rep(s, oldStr, newStr, label) {
  if (s.includes(newStr)) { console.log(`ok (already): ${label}`); return s; }
  if (!s.includes(oldStr)) { console.error(`MISS: ${label}`); fails++; return s; }
  console.log(`patched: ${label}`);
  return s.split(oldStr).join(newStr);
}

/* ── A. chest pulse (plan point 2) — ProfileDashboardPanel daily hub ── */
{
  const F = "ProfileDashboardPanel.tsx";
  let s = readFileSync(F, "utf8");
  s = rep(
    s,
    `                  {chestAvail\n                    ? <button className="dh-chest" onClick={openChestNow}>🎁<span>{lc.dhClaim}</span></button>`,
    `                  {chestAvail\n                    ? <button className="dh-chest chestpulse" onClick={openChestNow}>🎁<span>{lc.dhClaim}</span></button>`,
    "chest pulse button",
  );
  if (!fails) writeFileSync(F, s);
}

/* ── B. shop intro banner (plan point 6) — App.tsx shop IIFE ── */
{
  const F = "App.tsx";
  let s = readFileSync(F, "utf8");
  // anchor: the categories strip renders right after ALL_CATS/SUB_CATS are
  // defined; the intro banner goes just above the categories strip. Find the
  // shop card's category header render.
  s = rep(
    s,
    `        const shopIntroSeen = eduSeen("shopIntro");`,
    `        const shopIntroSeen = eduSeen("shopIntro");\n        const shopIntro = !shopIntroSeen;`,
    "shop intro flag",
  );
  if (!fails) writeFileSync(F, s);
}

/* ── C. PvP loss → practice CTA (plan point 5) — pvp-arena.tsx ── */
{
  const F = "pvp-arena.tsx";
  let s = readFileSync(F, "utf8");
  // The result screen knows which questions were missed; the simplest
  // correct hand-off is a back-to-practice button that exits the arena to
  // the practice surface, shown only on a loss (won → win lines already
  // carry the moment). The arena's parent passes onBack; practice entry is
  // App-level, so expose it via a new optional prop with a safe default.
  s = rep(
    s,
    `export const PvpPage = memo(function PvpPage({\n  lang, charModel = "vanguard", gear = [], onBack, onReward, playUi, friends = null, onChallenge, duels = null, onRespondDuel, onShare, onApplyLoadout,\n}) {`,
    `export const PvpPage = memo(function PvpPage({\n  lang, charModel = "vanguard", gear = [], onBack, onReward, playUi, friends = null, onChallenge, duels = null, onRespondDuel, onShare, onApplyLoadout, onPracticeWeakness = null,\n}) {`,
    "PvpPage prop",
  );
  s = rep(
    s,
    `            {result.practice && (\n              <div className="pvpres-flawless">🎓 {T("โหมดซ้อม — ไม่มีรางวัล", "Practice mode — no rewards", "陪练模式 — 无奖励")}</div>\n            )}`,
    `            {result.practice && (\n              <div className="pvpres-flawless">🎓 {T("โหมดซ้อม — ไม่มีรางวัล", "Practice mode — no rewards", "陪练模式 — 无奖励")}</div>\n            )}\n            {/* Loss → practice hand-off (owner plan 2026-09-19 point 5): turn a\n                defeat into the REASON to practice — the arena's wrong answers\n                came from real note-reading, so point straight back at it. */}\n            {!result.win && !result.practice && onPracticeWeakness && (\n              <button className="pvpres-practice" onClick={onPracticeWeakness}>{T("💪 ใกล้แล้ว! กลับไปซ้อมแล้วมาแก้มือ — หุ่นคุณมีสัตว์เลี้ยงช่วย", "💪 So close! Go practice, then rematch — your pet has your back", "💪 就差一点！先去练，再来复仇——你的宠物会帮你")}</button>\n            )}`,
    "loss→practice CTA",
  );
  if (!fails) writeFileSync(F, s);
}

/* ── D. pulse CSS — app-styles.ts (inside the CSS template literal) ── */
{
  const F = "app-styles.ts";
  let s = readFileSync(F, "utf8");
  const anchor = ".presultkeep{width:100%;margin-top:10px;padding:11px 12px;border:1px solid #d9775755;background:linear-gradient(135deg,#d9775722,#8b5cf622);border-radius:12px;color:var(--text);font-size:13px;font-weight:600;cursor:pointer}";
  const add = anchor + "\n/* game-feature education (owner plan 2026-09-19) */\n@keyframes chestpulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 #d9775766}50%{transform:scale(1.04);box-shadow:0 0 0 8px #d9775700}}\n.dh-chest.chestpulse{animation:chestpulse 1.6s ease-in-out infinite}\n.pvpres-practice{width:100%;margin-top:10px;padding:12px;border:1px solid #d9775755;background:linear-gradient(135deg,#d9775722,#8b5cf622);border-radius:12px;color:var(--text);font-size:13px;font-weight:600;cursor:pointer}";
  if (s.includes(add)) console.log("ok (already): css");
  else if (!s.includes(anchor)) { console.error("MISS: css anchor"); fails++; }
  else { s = s.replace(anchor, add); writeFileSync(F, s); console.log("patched: css"); }
}

if (fails) { console.error(`${fails} MISS`); process.exit(1); }
console.log("part 2 done");
