/* The two graphics modes of the Adventure farm and colony (owner, 2026-10-17): High = the three.js layer with shadows, reflections, motion and particles; Lite = the cached 2D drawing for weak phones.
   It is the same setting as the gear pop-up (`tg_adv_gfx`: "high" | "standard"); when nobody has chosen, a weak or low-tier device starts on Lite. */
import { isLowEnd, spaceTier } from "./space-stage";
export function gfxHigh(): boolean {
  try { const v = localStorage.getItem("tg_adv_gfx"); if (v === "high") return true; if (v === "standard") return false; } catch (e) {}
  try { return !(isLowEnd() || spaceTier() <= 1); } catch (e) { return false; }
}
