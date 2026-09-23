// One-shot patcher: CSS for Play Along plan items 1/3/4/8 in app-styles.ts.
// #3 Boss Battle HUD + fx, #1 Mistake Loop drill card, #4 Knowledge Drops toast + shelf.
import { readFileSync, writeFileSync } from "node:fs";

function must(cond, msg) { if (!cond) { console.error("FAIL: " + msg); process.exit(1); } }

const F = "app-styles.ts";
let s = readFileSync(F, "utf8");
const orig = s;

must(!s.includes(".bosshud"), "CSS already patched");

/* Anchor: the existing song bonus toast rule — all new styles follow it so they
   inherit the same file region as the rest of the song HUD styles. */
const anchor = `.songbonus{`;
must(s.includes(anchor), "songbonus CSS anchor missing");
const idx = s.indexOf(anchor);

const css = `
/* ── #3 Boss Battle ─────────────────────────────────────────────────────── */
.bosshud {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  padding: 5px 12px; border-radius: 999px;
  background: rgba(20, 8, 30, 0.72); border: 1px solid rgba(168, 85, 247, 0.45);
  backdrop-filter: blur(6px); z-index: 6; pointer-events: none;
  box-shadow: 0 4px 18px rgba(0,0,0,0.35);
}
.bosshud-face { font-size: 17px; line-height: 1; filter: drop-shadow(0 0 6px rgba(168,85,247,0.7)); }
.bosshud-track { width: 130px; height: 9px; border-radius: 999px; background: rgba(255,255,255,0.14); overflow: hidden; }
.bosshud-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #a855f7, #ec4899); transition: width 0.18s ease; }
.bosshud-fill.low { background: linear-gradient(90deg, #f97316, #ef4444); }
.bosshud-pct { font-size: 11px; font-weight: 800; color: #e9d5ff; min-width: 32px; text-align: right; }
.bossfx {
  position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%);
  font-size: 54px; z-index: 7; pointer-events: none;
  animation: bossfx-pop 0.7s ease-out forwards;
}
.bossfx.hit { filter: drop-shadow(0 0 14px rgba(236,72,153,0.9)); }
.bossfx.attack { filter: drop-shadow(0 0 14px rgba(239,68,68,0.9)); }
.bossfx.defeat { filter: drop-shadow(0 0 18px rgba(250,204,21,0.95)); }
@keyframes bossfx-pop {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  25% { opacity: 1; transform: translate(-50%, -50%) scale(1.25); }
  60% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -80%) scale(0.9); }
}
/* ── #4 Knowledge Drops ─────────────────────────────────────────────────── */
.kdrop {
  position: absolute; left: 50%; bottom: 14%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; max-width: 86%;
  padding: 8px 14px; border-radius: 12px; z-index: 6; pointer-events: none;
  background: rgba(8, 20, 30, 0.85); border: 1px solid rgba(56, 189, 248, 0.5);
  backdrop-filter: blur(6px);
  box-shadow: 0 6px 22px rgba(14, 165, 233, 0.25);
  animation: kdrop-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.kdrop-badge { font-size: 18px; line-height: 1; }
.kdrop-text { font-size: 12.5px; font-weight: 600; color: #e0f2fe; line-height: 1.35; }
@keyframes kdrop-in {
  0% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.kshelf-modal {
  position: fixed; inset: 0; z-index: 90;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.kshelf-card {
  width: 100%; max-width: 400px; max-height: 72vh; display: flex; flex-direction: column;
  background: var(--card, #16161f); border: 1px solid var(--bd1, #33334a);
  border-radius: 18px; overflow: hidden; box-shadow: 0 18px 60px rgba(0,0,0,0.5);
}
.kshelf-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 16px; font-weight: 800; font-size: 15px;
  border-bottom: 1px solid var(--bd1, #33334a); background: rgba(56,189,248,0.06);
}
.kshelf-list { overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.kshelf-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 11px;
  border-radius: 11px; background: rgba(56,189,248,0.07); border: 1px solid rgba(56,189,248,0.18);
}
.kshelf-key {
  min-width: 34px; height: 26px; display: flex; align-items: center; justify-content: center;
  border-radius: 7px; font-size: 11.5px; font-weight: 800; color: #04121d;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
}
.kshelf-txt { font-size: 12.5px; color: var(--text, #dde3ea); line-height: 1.4; }
.kshelf-empty { padding: 22px 10px; text-align: center; font-size: 13px; color: var(--muted, #8b93a3); }
/* ── #1 Mistake Loop drill card ─────────────────────────────────────────── */
.drillcard {
  margin-top: 12px; padding: 12px;
  border-radius: 14px; border: 1px solid rgba(245, 158, 11, 0.35);
  background: rgba(245, 158, 11, 0.06);
}
.drillcard-title { font-size: 13.5px; font-weight: 800; margin-bottom: 9px; color: #fbbf24; }
.drillcard-segs { display: flex; flex-direction: column; gap: 7px; }
.drillseg {
  position: relative; overflow: hidden; display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 10px 12px; border-radius: 10px; cursor: pointer;
  border: 1px solid rgba(245, 158, 11, 0.28); background: rgba(30, 20, 8, 0.5);
  color: var(--text, #dde3ea); font-size: 12.5px; font-weight: 600; text-align: left;
  transition: transform 0.12s ease, border-color 0.12s ease;
}
.drillseg:active { transform: scale(0.98); }
.drillseg:hover { border-color: rgba(245, 158, 11, 0.7); }
.drillseg-num { font-weight: 800; color: #fbbf24; min-width: 22px; }
.drillseg-bar { position: absolute; left: 0; top: 0; bottom: 0; width: var(--w, 50%); background: linear-gradient(90deg, rgba(245,158,11,0.16), rgba(239,68,68,0.22)); z-index: -1; }
.drillseg-info { flex: 1; }
.drillcard-hint { margin-top: 8px; font-size: 11px; color: var(--muted, #8b93a3); line-height: 1.45; }
`;

s = s.slice(0, idx) + css + "\n" + s.slice(idx);
writeFileSync(F, s);
console.log("app-styles.ts patched, delta:", s.length - orig);
