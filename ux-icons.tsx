/* ── ux-icons.tsx ──
   One icon language for the premium interface (ux2.ts, AX-3). The app's chrome
   and lessons were drawn with emoji — colourful, different on every phone, a
   toy box next to the cream-and-terracotta finish. While the `ux2` switch is on,
   each emoji that names a place, a mode or a lesson is drawn instead as a
   Lucide line icon in the colour of the text around it, the way the tab bar and
   the robot glyph already are. Anything not in the map keeps its emoji, and with
   the switch off every call returns the emoji untouched — so a spot can be
   converted by wrapping its glyph in <Ico e="🎼" /> and nothing else.

   Emoji that are CONTENT stay emoji: the coin, the medals, a streak's flame, the
   reactions in the chat. Only chrome and lesson icons are mapped here.

   Named imports only (never `import *`), so each icon costs about 1 kB. */
import { createContext, useContext } from "react";
import {
  BookOpen, Briefcase, CalendarDays, ChevronLeft, CalendarHeart, CalendarRange, ChartColumn, ChevronRight, ClipboardList, Clapperboard,
  Crown, Divide, Ear, FileMusic, Flag, Gamepad2, Globe, GraduationCap, Hand, HeartPulse, Layers, ListMusic, Lock, LogOut,
  Megaphone, MessageCircle, Moon, Music, Music2, Piano, Rocket, Route, Ruler, Settings, Shield, Signal, Sparkles,
  Sprout, Sunrise, Swords, Target, Triangle, Trophy, Users, Waves, Zap, Brain, Blocks,
} from "lucide-react";

export const UxCtx = createContext(false);

const MAP: Record<string, any> = {
  // chrome: the drawer, the studio, the song list
  "⬡": Route, "◈": MessageCircle, "🎯": Target, "🎵": Music, "🎶": Music2, "▶": Piano, "🎬": Clapperboard, "🎮": Gamepad2,
  "✦": Sparkles, "⚙": Settings, "⏻": LogOut, "🔒": Lock, "👑": Crown,
  // the studio's modes
  "📄": FileMusic, "🎼": ListMusic, "👂": Ear, "📅": CalendarDays, "⚡": Zap, "🎓": GraduationCap, "✋": Hand, "🧠": Brain,
  "🎪": CalendarHeart, "⚔": Swords, "👨‍👩‍👧": Users, "🏆": Trophy, "📋": ClipboardList, "🗓": CalendarRange, "📊": ChartColumn, "🌅": Sunrise,
  // the pathway: its four groups and its lessons
  "🌱": Sprout, "🎹": Piano, "🚀": Rocket, "🌍": Globe,
  "📏": Ruler, "🔺": Triangle, "7\u20E3": Layers, "🧭": Route, "🧱": Blocks, "➗": Divide, "🌫": Waves, "🌙": Moon,
  "‹": ChevronLeft, "💼": Briefcase, "🎺": Shield, "🇹🇭": Flag, "💚": HeartPulse, "📣": Megaphone, "📚": BookOpen,
};
// "⚔️" and "⚔" are the same glyph with and without the emoji selector; so are the others
const norm = (e: string) => String(e).replace(/️/g, "");
export const hasIco = (e: string) => !!MAP[norm(e)];

export function Ico({ e, size = 22, stroke = 1.8, className = "" }: { e: string; size?: number; stroke?: number; className?: string }) {
  const on = useContext(UxCtx);
  const C = on ? MAP[norm(e)] : null;
  if (!C) return <>{e}</>;
  return <C size={size} strokeWidth={stroke} absoluteStrokeWidth className={"uxi" + (className ? " " + className : "")} aria-hidden="true" />;
}

/* the "▶" that ends a card: a chevron while the switch is on */
export function Chev({ size = 18, className = "" }: { size?: number; className?: string }) {
  const on = useContext(UxCtx);
  if (!on) return <>▶</>;
  return <ChevronRight size={size} strokeWidth={2} absoluteStrokeWidth className={"uxi" + (className ? " " + className : "")} aria-hidden="true" />;
}
