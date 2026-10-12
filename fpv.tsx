/* ── First-person view (owner, 2026-10-12: "a button in the top right of every map and in PvP to switch to First Person View") ──
   One preference (`tg_fpv`), one button, and the pieces every screen shares: the visor, the cockpit frame, the crosshair, the first-person hands.
   The games themselves decide what "first person" means for them (the ground runs zoom in and hide the hero, the ship maps hide the ship and show
   a cockpit, PvP hides your own fighter and shows your weapon), this file only holds the switch and the common look. */
import { useEffect, useState } from "react";

const KEY = "tg_fpv";
export const readFpv = (): boolean => { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
const writeFpv = (on: boolean) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {} };

/** [on, flip]: the same value in every component that asks, so the button in one corner and the view in another never disagree. */
export function useFpv(): [boolean, () => void] {
  const [on, setOn] = useState(readFpv);
  useEffect(() => {
    const f = () => setOn(readFpv());
    window.addEventListener("tiga:fpv", f);
    return () => window.removeEventListener("tiga:fpv", f);
  }, []);
  const flip = () => { const n = !readFpv(); writeFpv(n); try { window.dispatchEvent(new Event("tiga:fpv")); } catch (e) {} setOn(n); };
  return [on, flip];
}

export const FPV_CSS = `
.fpv-btn{width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(140,255,220,.5);background:rgba(8,30,40,.72);color:#bff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;padding:0;-webkit-tap-highlight-color:transparent;position:relative}
.fpv-btn svg{width:26px;height:26px}
.fpv-btn.on{background:linear-gradient(135deg,#19e3b4,#2f7bff);color:#012;border-color:#fff;box-shadow:0 0 14px rgba(60,255,210,.5)}
.fpv-btn b{position:absolute;bottom:2px;left:0;right:0;text-align:center;font:800 8px/1 system-ui,sans-serif;letter-spacing:.04em}
.fpv-tr{margin-left:auto;display:flex;gap:8px;align-items:center}
.fpv-tr .adv-gear{margin-left:0}
.fpv-visor{position:absolute;inset:0;pointer-events:none;z-index:3;background:radial-gradient(ellipse at 50% 52%,rgba(0,0,0,0) 48%,rgba(0,8,16,.5) 82%,rgba(0,4,10,.8) 100%);box-shadow:inset 0 0 70px rgba(0,12,24,.65)}
.fpv-visor::before,.fpv-visor::after{content:"";position:absolute;left:6%;right:6%;height:2px;background:linear-gradient(90deg,transparent,rgba(120,255,230,.35),transparent)}
.fpv-visor::before{top:5%}.fpv-visor::after{bottom:5%}
.fpv-hurt{position:absolute;inset:0;pointer-events:none;z-index:3;opacity:0;transition:opacity .35s;background:radial-gradient(ellipse at 50% 50%,rgba(255,40,40,0) 35%,rgba(255,30,30,.55) 100%)}
.fpv-hurt.on{opacity:1;transition:opacity .04s}
.fpv-xh{position:absolute;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;pointer-events:none;z-index:3}
.fpv-xh svg{width:100%;height:100%}
.fpv-hands{position:absolute;left:0;right:0;bottom:0;height:46%;pointer-events:none;z-index:2;overflow:visible}
.fpv-rig{position:absolute;left:11%;bottom:-6%;width:min(52vw,420px);transform-origin:10% 100%;will-change:transform}
.fpv-hands.lf .fpv-rig{left:auto;right:11%;scale:-1 1;transform-origin:90% 100%}
.fpv-wpn svg{width:100%;height:auto;display:block;filter:drop-shadow(0 6px 10px rgba(0,0,0,.55))}
.fpv-arm{position:absolute;left:-20%;bottom:-34%;width:50%;height:auto}
.fpv-flash{position:absolute;right:-9%;top:-12%;width:34%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(255,255,230,.95),rgba(255,190,70,.55) 40%,rgba(255,120,30,0) 70%);opacity:0;mix-blend-mode:screen}
.fpv-flash.on{opacity:1}
.fpv-cockpit{position:absolute;inset:0;pointer-events:none;z-index:2}
.fpv-cockpit svg{width:100%;height:100%;display:block}
.fpv-fh{position:absolute;left:50%;bottom:0;width:min(62%,420px);transform:translateX(-50%);pointer-events:none;z-index:7}
.fpv-fh-rig{position:relative;transform-origin:50% 100%;transition:transform .12s ease-out}
.fpv-fh-wpn{width:78%;margin:0 auto -6%;transform:rotate(-10deg);filter:drop-shadow(0 8px 12px rgba(0,0,0,.6))}
.fpv-fh-wpn svg{width:100%!important;height:auto!important;display:block}
.fpv-fist{width:34%;aspect-ratio:1;margin:0 auto -8%;border-radius:38% 38% 30% 30%;background:linear-gradient(160deg,#6b7a96,#232c44);border:2px solid rgba(120,255,230,.6);box-shadow:0 8px 14px rgba(0,0,0,.5)}
.fpv-fh.act .fpv-fh-rig{animation:fpvThrust .3s ease-out}
.fpv-fh.guard .fpv-fh-rig{transform:translateY(-14%) rotate(-8deg) scale(.92)}
.fpv-fh.hit .fpv-fh-rig{animation:fpvKick .26s ease-out}
@keyframes fpvThrust{0%{transform:translateY(0) scale(1)}35%{transform:translateY(-22%) scale(1.16) rotate(-5deg)}100%{transform:translateY(0) scale(1)}}
@keyframes fpvKick{0%{transform:translateY(0)}30%{transform:translateY(16%) rotate(6deg)}100%{transform:translateY(0)}}
.pvppage.fpv .pvpfighter.me .pvpfbody{visibility:hidden}
.pvppage.fpv .pvpfighter.op{scale:1.28;transform-origin:50% 100%}
@media (prefers-reduced-motion:reduce){.fpv-hurt{transition:none}.fpv-fh.act .fpv-fh-rig,.fpv-fh.hit .fpv-fh-rig{animation:none}}
`;

const T = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);

/** The round button for the top right corner. */
export function FpvButton({ lang, on, onClick }: { lang: string; on: boolean; onClick: () => void }) {
  const label = T(lang, "มุมมองบุคคลที่หนึ่ง", "First-person view", "第一人称视角");
  return (
    <>
      <style>{FPV_CSS}</style>
      <button className={"fpv-btn" + (on ? " on" : "")} data-fpv-btn="1" aria-pressed={on} aria-label={label} title={label}
        onPointerDown={(e) => e.stopPropagation()} onClick={onClick}>
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 16c3.5-6 8.2-9 13-9s9.5 3 13 9c-3.5 6-8.2 9-13 9S6.5 22 3 16z" /><circle cx="16" cy="16" r="4.4" fill="currentColor" stroke="none" /><circle cx="17.6" cy="14.4" r="1.2" fill="#fff" stroke="none" />
        </svg>
        <b>FPV</b>
      </button>
    </>
  );
}

/** A helmet visor: vignette and two HUD lines. Enough to make a flat screen read as looking out of a helmet. */
export function FpvVisor() { return <div className="fpv-visor" data-fpv="visor" aria-hidden="true" />; }

/** A red flash at the edges when the player is hit. The caller sets/clears the "on" class through the ref. */
export function FpvHurt({ hurtRef }: { hurtRef: any }) { return <div ref={hurtRef} className="fpv-hurt" aria-hidden="true" />; }

/** The reticle: a ring, four ticks and a dot. Placed by the caller. */
export function FpvCrosshair({ xhRef }: { xhRef?: any }) {
  return (
    <div ref={xhRef} className="fpv-xh" aria-hidden="true">
      <svg viewBox="0 0 46 46" fill="none" stroke="rgba(150,255,230,.9)" strokeWidth="2" strokeLinecap="round">
        <circle cx="23" cy="23" r="12" opacity=".8" /><path d="M23 3v9M23 34v9M3 23h9M34 23h9" /><circle cx="23" cy="23" r="1.8" fill="#fff" stroke="none" />
      </svg>
    </div>
  );
}

/** First-person hands: the weapon (its markup is put into `wpnRef` by the game) held by an armoured forearm, with a muzzle flash. */
export function FpvHands({ rigRef, wpnRef, flashRef, handsRef }: { rigRef?: any; wpnRef?: any; flashRef?: any; handsRef?: any }) {
  return (
    <div ref={handsRef} className="fpv-hands" data-fpv="hands" aria-hidden="true">
      <div ref={rigRef} className="fpv-rig">
        <div ref={wpnRef} className="fpv-wpn" />
        <svg className="fpv-arm" viewBox="0 0 140 110" aria-hidden="true">
          <defs><linearGradient id="fpvA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6b7a96" /><stop offset=".5" stopColor="#2a3550" /><stop offset="1" stopColor="#141b2e" /></linearGradient></defs>
          <path d="M0 110 L24 50 Q30 32 50 30 L98 28 Q118 28 122 44 L124 60 Q124 72 112 76 L68 88 L44 110 Z" fill="url(#fpvA)" stroke="rgba(120,255,230,.55)" strokeWidth="2" />
          <path d="M34 62 L92 46 M26 84 L80 66 M20 100 L62 86" stroke="rgba(120,255,230,.5)" strokeWidth="2.4" />
          <circle cx="102" cy="52" r="15" fill="#1a2238" stroke="rgba(120,255,230,.7)" strokeWidth="2" />
        </svg>
        <div ref={flashRef} className="fpv-flash" />
      </div>
    </div>
  );
}

/** A ship's cockpit: canopy struts, a dashboard and a glow. Static; the game draws the reticle on its own canvas. */
export function FpvCockpit() {
  return (
    <div className="fpv-cockpit" data-fpv="cockpit" aria-hidden="true">
      <svg viewBox="0 0 800 400" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fpvC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d273f" /><stop offset="1" stopColor="#070b16" /></linearGradient>
          <linearGradient id="fpvG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(120,255,230,.0)" /><stop offset="1" stopColor="rgba(120,255,230,.35)" /></linearGradient>
        </defs>
        <path d="M0 0 H800 V34 Q400 54 0 34 Z" fill="url(#fpvC)" /><path d="M0 0 L0 400 L70 400 Q40 200 96 40 Z" fill="url(#fpvC)" /><path d="M800 0 L800 400 L730 400 Q760 200 704 40 Z" fill="url(#fpvC)" />
        <path d="M0 400 V338 Q400 300 800 338 V400 Z" fill="url(#fpvC)" /><path d="M0 338 Q400 300 800 338" stroke="rgba(120,255,230,.55)" strokeWidth="2.5" fill="none" />
        <rect x="0" y="300" width="800" height="50" fill="url(#fpvG)" opacity=".5" />
        <g stroke="rgba(120,255,230,.5)" strokeWidth="2" fill="none"><path d="M96 40 Q400 64 704 40" /><path d="M120 360 h70 M610 360 h70" /></g>
        <g fill="rgba(120,255,230,.8)"><circle cx="140" cy="372" r="3" /><circle cx="160" cy="372" r="3" /><circle cx="640" cy="372" r="3" fill="#ffb347" /><circle cx="660" cy="372" r="3" /></g>
      </svg>
    </div>
  );
}

/** PvP: your weapon (or fist) rising from the bottom of the arena. `act` thrusts it, `hit` kicks it back, `guard` raises it. */
export function FpvFightHands({ node, act, hit, guard }: { node?: any; act: boolean; hit: boolean; guard: boolean }) {
  return (
    <>
      <div className={"fpv-hurt" + (hit ? " on" : "")} aria-hidden="true" />
      <div className={"fpv-fh" + (act ? " act" : "") + (hit ? " hit" : "") + (guard ? " guard" : "")} data-fpv="fight-hands" aria-hidden="true">
        <div className="fpv-fh-rig">{node ? <div className="fpv-fh-wpn">{node}</div> : <div className="fpv-fist" />}</div>
      </div>
    </>
  );
}
