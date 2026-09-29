/* ── tab-bar.tsx ──
   The five places people actually go, a thumb away at the bottom of the
   screen — the way an iPhone app is navigated. The ☰ menu is still there
   for everything else (videos, games, plans, settings); nothing moved out
   of it, this only makes the common trips one tap instead of two.

   The active tab follows the page's family, so opening Ear Gym from the
   studio still reads as "Practice". Tapping the tab you are already on
   scrolls that page back to the top, as iOS does. */
import { memo } from "react";
import { BookOpen, Piano, Sparkles, Swords } from "lucide-react";
import { RobotGlyph } from "./cyber-avatar";

const TABS = [
  { k: "learn", page: "pathway", Icon: BookOpen, th: "เรียน", en: "Learn", zh: "学习" },
  { k: "practice", page: "studio", Icon: Piano, th: "ฝึกซ้อม", en: "Practice", zh: "练习" },
  { k: "teacher", page: "sensei", Icon: Sparkles, th: "ครู AI", en: "Teacher", zh: "AI老师" },
  { k: "arena", page: "pvp", Icon: Swords, th: "ประลอง", en: "Arena", zh: "竞技" },
  { k: "me", page: "profile", Icon: null, th: "ฉัน", en: "Me", zh: "我的" },
];
const FAMILY = {
  pathway: "learn",
  studio: "practice", reading: "practice", eargym: "practice", today: "practice", challenging: "practice", gamepage: "practice",
  sensei: "teacher",
  pvp: "arena",
  profile: "me", report: "me", insights: "me", coach: "me", storage: "me", pet: "me",
};
export const tabFor = (page) => FAMILY[page] || null;
/* the game rooms are dark; the bar that sits under them is too */
export const DARK_ROOMS = new Set(["pvp", "pet", "storage"]);

export const TabBar = memo(function TabBar({ page, lang, onGo }) {
  const cur = tabFor(page);
  if (!cur) return null;
  const L = (t) => (lang === "th" ? t.th : lang === "zh" ? t.zh : t.en);
  return (
    <nav className={`tabbar${DARK_ROOMS.has(page) ? " dark" : ""}`} aria-label={lang === "th" ? "เมนูหลัก" : lang === "zh" ? "主导航" : "Main"}>
      {TABS.map((t) => {
        const on = cur === t.k;
        return (
          <button key={t.k} type="button" className={`tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined} onClick={() => onGo(t, on)}>
            <span className="tab-ic" aria-hidden="true">
              {t.Icon ? <t.Icon size={24} strokeWidth={on ? 2 : 1.7} absoluteStrokeWidth /> : <RobotGlyph size={24} />}
            </span>
            <span className="tab-lb">{L(t)}</span>
          </button>
        );
      })}
    </nav>
  );
});
