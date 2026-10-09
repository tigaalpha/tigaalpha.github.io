/* ── tab-bar.tsx ──
   The five places people actually go, a thumb away at the bottom of the
   screen — the way an iPhone app is navigated. The ☰ menu is still there
   for everything else (videos, games, plans, settings); nothing moved out
   of it, this only makes the common trips one tap instead of two.

   The active tab follows the page's family, so opening Ear Gym from the
   studio still reads as "Practice". Tapping the tab you are already on
   scrolls that page back to the top, as iOS does.

   Part of the premium interface (ux2.ts): drawn only while the `ux2` switch
   is on. It is the LAST child of the app's column (.tg is a full-height flex
   column and every page is flex:1), so the pages simply end above it — no
   page needs bottom padding for it, and nothing can hide behind it.

   Where it is not drawn: the video feed and the admin console (full-screen
   by design), pages outside the five families (the school dashboard), and
   while a text field has focus (the on-screen keyboard owns the bottom of
   the screen then — see the `kbd` class in PianoApp). Every overlay (a song,
   a practice run, the shop, the chat) is position:fixed above it. */
import { memo } from "react";
import { BookOpen, Piano, Sparkles, Swords } from "lucide-react";
import { RobotGlyph } from "./cyber-avatar";

export const TABS = [
  { k: "learn", page: "pathway", Icon: BookOpen, th: "เรียน", en: "Learn", zh: "学习" },
  { k: "practice", page: "studio", Icon: Piano, th: "ฝึกซ้อม", en: "Practice", zh: "练习" },
  { k: "teacher", page: "sensei", Icon: Sparkles, th: "ครู AI", en: "Teacher", zh: "AI老师" },
  { k: "arena", page: "pvp", Icon: Swords, th: "ประลอง", en: "Arena", zh: "竞技" },
  { k: "me", page: "profile", Icon: null, th: "ฉัน", en: "Me", zh: "我的" },
];
const FAMILY = {
  pathway: "learn",
  studio: "practice", reading: "practice", eargym: "practice", today: "practice", challenging: "practice", gamepage: "practice",
  sensei: "teacher", coach: "teacher",
  pvp: "arena",
  profile: "me", report: "me", insights: "me", storage: "me", pet: "me",
};
export const tabFor = (page) => FAMILY[page] || null;
export const TabBar = memo(function TabBar({ page, lang, onGo }) {
  const cur = tabFor(page);
  if (!cur) return null;
  const L = (t) => (lang === "th" ? t.th : lang === "zh" ? t.zh : t.en);
  return (
    <nav className="tabbar" aria-label={lang === "th" ? "เมนูหลัก" : lang === "zh" ? "主导航" : "Main"}>
      {TABS.map((t) => {
        const on = cur === t.k;
        return (
          <button key={t.k} type="button" className={`tab${on ? " on" : ""}`} data-tab={t.k} aria-current={on ? "page" : undefined} onClick={() => onGo(t, on)}>
            <span className="tab-ic" aria-hidden="true">
              {t.Icon ? <t.Icon size={24} strokeWidth={on ? 2.1 : 1.7} absoluteStrokeWidth /> : <RobotGlyph size={24} />}
            </span>
            <span className="tab-lb">{L(t)}</span>
          </button>
        );
      })}
    </nav>
  );
});
