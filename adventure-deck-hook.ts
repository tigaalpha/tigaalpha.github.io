// Shared 3D-quality logic for the farm and shipyard boards: lazy-loads the Three.js backdrop, falls back to 2D High when it is slow or fails.
import { useEffect, useRef, useState } from "react";
import { isLowEnd, spaceTier } from "./space-stage";
export const can3dDeck = () => { try { return !isLowEnd() && spaceTier() >= 2; } catch (e) { return false; } };
export function useDeck3D(kind: "plants" | "herd" | "yard") {
  const [gfx, setGfx] = useState<string>(() => { try { const v = localStorage.getItem("tg_adv_gfx"); if (v === "3d" && can3dDeck()) return "3d"; return v === "high" || v === "3d" ? "high" : "standard"; } catch (e) { return "standard"; } });
  const [msg, setMsg] = useState<string | null>(null), host = useRef<HTMLDivElement>(null);
  const setLevel = (v: string) => { setGfx(v); try { localStorage.setItem("tg_adv_gfx", v); } catch (e) {} };
  useEffect(() => {
    if (gfx !== "3d" || !host.current) return; let dead = false, raf = 0, sc: any = null, last = 0, sum = 0, n = 0; const el = host.current;
    import("./adventure-3d-deck").then(m => {
      if (dead) return; sc = m.createDeck3D(el, kind); if (!sc) { setMsg("3D is not available on this device: back to 2D High"); setLevel("high"); return; }
      const fit = () => sc.resize(el.clientWidth || 1, el.clientHeight || 1, window.devicePixelRatio || 1); fit(); window.addEventListener("resize", fit); const t0 = performance.now();
      const loop = () => { const now = performance.now(); if (last) { sum += now - last; n++; } last = now;
        try { sc.render((now - t0) / 1000); } catch (e) { sum = 1e9; n = 150; }
        if (n >= 150) { if (sum / n > 40) { setMsg("3D is too slow: back to 2D High"); setLevel("high"); return; } sum = n = 0; }
        raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
      (el as any).__off = () => window.removeEventListener("resize", fit);
    }).catch(() => { if (!dead) { setMsg("3D failed to load: back to 2D High"); setLevel("high"); } });
    return () => { dead = true; cancelAnimationFrame(raf); try { (el as any).__off && (el as any).__off(); } catch (e) {} if (sc) sc.dispose(); };
  }, [gfx]);
  return { gfx, setLevel, msg, host, is3d: gfx === "3d", high: gfx !== "standard" };
}
