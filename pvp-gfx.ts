/* ── pvp-gfx.ts ── the PvP graphics setting (owner, 2026-11-05)
   TWO levels only, chosen from the gear button in the Games lobby and in the
   fight header:

     low   for older / weaker phones: no 3D room, the fighters are stored
           pictures, 1x canvases at half the effects, no stage filters, no
           blur behind the pads, no shake
     high  for strong devices: the 3D room at the best tier the device
           supports and the full effects

   Nothing stored = the game picks for this device, as it always did
   (isLowEnd() / spaceTier()): weak devices run "low", the rest "high". The
   choice is kept under its own key (Adventure has tg_adv_gfx and is not
   touched). When the fight itself notices that a device left to "high" cannot
   keep up it writes "low" and remembers that the GAME did that, so the card
   can say so. A level the player picked by hand is never changed by the game. */
import { useSyncExternalStore } from "react";
import { isLowEnd, spaceTier } from "./space-stage";

export type PvpGfx = "low" | "high";
const KEY = "tg_pvp_gfx";
const AUTO_KEY = "tg_pvp_gfx_auto";

const subs = new Set<() => void>();
const emit = () => subs.forEach(f => { try { f(); } catch (e) {} });
export const subscribeGfx = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
if (typeof window !== "undefined") {
  // another tab (or the harness) changed it
  window.addEventListener("storage", (e) => { if (e.key === KEY || e.key === AUTO_KEY) { cache = undefined; emit(); } });
}

let cache: PvpGfx | null | undefined;
/** What is stored, if anything ("low" | "high"), else null. */
export function storedGfx(): PvpGfx | null {
  if (cache !== undefined) return cache;
  let v: PvpGfx | null = null;
  try { const s = localStorage.getItem(KEY); if (s === "low" || s === "high") v = s; } catch (e) {}
  return (cache = v);
}
/** The level the game would pick for this device on its own. */
export function defaultGfx(): PvpGfx {
  try { return isLowEnd() || spaceTier() <= 1 ? "low" : "high"; } catch (e) { return "low"; }
}
/** The level in effect right now. Readable synchronously. */
export function readGfx(): PvpGfx { return storedGfx() || defaultGfx(); }
/** True when the player picked the level by hand (the game never overrides that). */
export function gfxChosen(): boolean {
  if (storedGfx() == null) return false;
  try { return localStorage.getItem(AUTO_KEY) !== "1"; } catch (e) { return true; }
}
/** True when the game itself lowered the quality on this device. */
export function gfxLoweredByGame(): boolean {
  if (storedGfx() == null) return false;
  try { return localStorage.getItem(AUTO_KEY) === "1"; } catch (e) { return false; }
}
export function setGfx(v: PvpGfx, by: "user" | "auto" = "user") {
  if (v !== "low" && v !== "high") return;
  try {
    localStorage.setItem(KEY, v);
    if (by === "auto") localStorage.setItem(AUTO_KEY, "1"); else localStorage.removeItem(AUTO_KEY);
  } catch (e) {}
  cache = v;
  emit();
}
/** React: re-renders when the level changes (the lobby and the fight follow live). */
export function useGfx(): PvpGfx { return useSyncExternalStore(subscribeGfx, readGfx, readGfx); }
/** React: did the game lower it? (re-evaluated with the level) */
export function useGfxAuto(): boolean { return useSyncExternalStore(subscribeGfx, gfxLoweredByGame, gfxLoweredByGame); }

const touch = () => { try { return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); } catch (e) { return false; } };

/** The concrete switches a level turns into. */
export interface GfxPlan {
  level: PvpGfx;
  key: string;
  liteFight: boolean;   // idle SVG animations, drop-shadows, reflections and blur off (the "lite" class)
  room: boolean;        // the 3D room may be built (still needs the dark theme and WebGL)
  dprCap: number;       // largest pixel ratio of the two effect canvases
  pk: number;           // particle / debris / ember count multiplier
  hz: number;           // effects pass rate (0 = every frame)
  motes: number;        // ambient dust specks
  lobN: number;         // rockets in a salvo
  tone: boolean;        // no CSS filter on the whole stage (hit-stop and round tone are an overlay)
  calm: boolean;        // no stage shake, no backdrop blur on the pads
}
export function resolveGfx(level: PvpGfx): GfxPlan {
  if (level === "low") {
    return { level, key: "low", liteFight: true, room: false, dprCap: 1, pk: 0.4, hz: 30, motes: 0, lobN: 3, tone: true, calm: true };
  }
  const t = touch();
  let low = false; try { low = isLowEnd(); } catch (e) {}
  return { level, key: "high" + (t ? "t" : ""), liteFight: t, room: true, dprCap: t ? 1 : 1.5, pk: 1, hz: 0, motes: low ? 8 : 22, lobN: t ? 4 : 6, tone: true, calm: false };
}
