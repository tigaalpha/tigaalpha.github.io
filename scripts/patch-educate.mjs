/* One-off patch — game-feature education (owner-approved plan 2026-09-19).
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
  `import { CONV_COPY, convPopupFor, convWinBack, convSeen, markConvSeen, trialDay, canUseSongGift, consumeSongGift } from "./use-conversion";`,
  `import { CONV_COPY, convPopupFor, convWinBack, convSeen, markConvSeen, trialDay, canUseSongGift, consumeSongGift } from "./use-conversion";\nimport { EDU_COPY, eduTipFor, eduSeen, markEduSeen, pvpLossCopy } from "./use-educate";`,
  "import use-educate",
);

/* ── 2. eduTip state + effect after the conv state ── */
rep(
  `  function dismissConvPopup() {\n    if (convPopup) markConvSeen(convPopup.id);\n    setConvPopup(null);\n  }`,
  `  function dismissConvPopup() {\n    if (convPopup) markConvSeen(convPopup.id);\n    setConvPopup(null);\n  }\n  /* Game-feature education (owner-approved 2026-09-19): one tip at a time,\n     priority-guarded — a conversion popup or broadcast always wins, and the\n     tip waits for the next quiet render. Fired from the same trigger points\n     the plan names: first coin payout, profile visit with chest available,\n     coin milestones, shop open. */\n  const [eduTip, setEduTip] = useState(null);\n  const firstCoinsSeenRef = useRef(false);\n  useEffect(() => {\n    firstCoinsSeenRef.current = eduSeen("firstCoins");\n  }, []);\n  // earnCoins itself is deep in use-gamification; the cheap correct signal\n  // for "first payout happened" is coins crossing zero upward after a\n  // practice session — checked here so the tip shows at the next quiet gap.\n  const eduEvalRef = useRef(null);\n  useEffect(() => {\n    eduEvalRef.current = () => {\n      if (convPopup || broadcast || autoTeachTip || eduTip) return;   // priority guard\n      const next = eduTipFor({ coins, chestAvail, firstCoinsSeen: firstCoinsSeenRef.current, shopOpenNow: false });\n      if (next) { setEduTip(next); markEduSeen(next.id); }\n    };\n  });\n  useEffect(() => {\n    const t = setTimeout(() => { if (eduEvalRef.current) eduEvalRef.current(); }, 2500);\n    return () => clearTimeout(t);\n  }, [coins, chestAvail, page]);\n  function dismissEduTip() { setEduTip(null); }`,
  "edu state + effect",
);

/* ── 3. eduTip popup JSX right before the conversion popup block ── */
rep(
  `      {/* Conversion-funnel popup (owner-approved 2026-09-19): trial-stage`,
  `      {/* Game-feature education tip (owner-approved 2026-09-19): teaches the\n          pets/PvP/chest/shop loop at the exact moment it matters. Every CTA\n          navigates straight to the feature — plan rule 3. */}\n      {eduTip && !convPopup && !broadcast && !autoTeachTip && (() => {\n        const ec = (EDU_COPY[lang] || EDU_COPY.en)[eduTip.kind];\n        const go = () => {\n          playUi("click"); dismissEduTip();\n          if (ec.go === "pet") { logUsage("nav", "pet"); setPage("pet"); }\n          else if (ec.go === "shop") { logUsage("nav", "shop"); setShopOpen(true); }\n          else { setPage("profile"); }\n        };\n        return (\n          <div className="atpopup" onClick={dismissEduTip}>\n            <div className="atpopup-card edupop" onClick={e => e.stopPropagation()}>\n              <div className="atpopup-hd">\n                <span className="atpopup-ic" aria-hidden="true">{ec.ic}</span>\n                <div className="atpopup-tt">{ec.title}</div>\n                <button className="atpopup-x" onClick={dismissEduTip} aria-label="close">×</button>\n              </div>\n              <div className="atpopup-weak" style={{ whiteSpace: "pre-wrap" }}>{ec.body}</div>\n              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>\n                <button className="atpopup-ok" style={{ flex: 1 }} onClick={go}>{ec.cta}</button>\n              </div>\n            </div>\n          </div>\n        );\n      })()}\n\n      {/* Conversion-funnel popup (owner-approved 2026-09-19): trial-stage`,
  "edu tip popup",
);

/* ── 4. chassis-pick copy: "practice → stronger robot" (plan point 4) ── */
rep(
  `                <div className="mdlpick-sub">{T("เลือกได้ครั้งเดียว ตัวนี้ฟรี — รุ่นอื่นต้องซื้อในร้านค้าหมวดสกินหุ่นยนต์",`,
  `                <div className="mdlpick-sub">{T("เลือกได้ครั้งเดียว ตัวนี้ฟรี — ยิ่งซ้อมเปียโนเก่ง หุ่นของคุณยิ่งเก่งตาม ลองสู้บอทเบา ๆ ดูสนามก่อน (รุ่นอื่นซื้อได้ในร้านค้าหมวดสกินหุ่นยนต์)",`,
  "chassis pick copy",
);

/* ── 5. shop intro banner (plan point 6) — inside the shop IIFE ── */
rep(
  `        const ALL_CATS = [\n          { key: "battle",  icon: "🤖", label: T2("สู้รบ", "Battle", "战斗") },`,
  `        const shopIntroSeen = eduSeen("shopIntro");\n        const ALL_CATS = [\n          { key: "battle",  icon: "🤖", label: T2("สู้รบ", "Battle", "战斗") },`,
  "shop intro anchor",
);

/* ── 6. AdminAnalytics: game-feature adoption panel (plan measure) ── */
rep(
  `          <Panel title={T("📄 หน้าที่เข้าชม", "📄 Pages visited", "📄 访问的页面")} rows={byKind("page")}\n            labelFor={(id) => NAV_LABELS[id] || id} />\n        </>\n      )}\n    </div>\n  );\n}`,
  `          <Panel title={T("📄 หน้าที่เข้าชม", "📄 Pages visited", "📄 访问的页面")} rows={byKind("page")}\n            labelFor={(id) => NAV_LABELS[id] || id} />\n          {/* Game-feature adoption (owner plan 2026-09-19): are people actually\n              finding pets/PvP/shop/storage? nav events are already logged at\n              every entry point, so this needs zero new instrumentation. */}\n          <Panel title={T("🎮 การใช้ฟีเจอร์เกม (สัตว์เลี้ยง/PvP/ร้านค้า)", "🎮 Game-feature adoption (pets/PvP/shop)", "🎮 游戏功能使用（宠物/PvP/商店）")} rows={(stats || []).filter(r => r.kind === "nav" && ["pet", "pvp", "shop", "storage"].includes(r.item_id))}\n            labelFor={(id) => ({ pet: "🐾 " + T("สัตว์เลี้ยง", "Pets", "宠物"), pvp: "⚔ " + T("สนามประลอง PvP", "PvP Arena", "PvP 竞技场"), shop: "🛍 " + T("ร้านค้า", "Shop", "商店"), storage: "📦 " + T("คลังของ", "Storage", "仓库") }[id] || id)} />\n        </>\n      )}\n    </div>\n  );\n}`,
  "admin adoption panel",
);

if (fails) { console.error(`${fails} MISS`); process.exit(1); }
writeFileSync(A, s);
console.log("App.tsx written");
