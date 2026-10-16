/* Space Ranch helpers: an autonomous tractor, a farm robot, a Cybertruck-style pickup and a flying roadster. Own code-drawn art in the farm's isometric style
   (angular pickup, sleek hovering coupe); nothing is copied from any maker's artwork. State and rules are pure so the screen only draws and applies them. */
export type HKind = "tractor" | "robot" | "truck" | "car";
export const HELPER_COST: Record<HKind, number> = { tractor: 20, robot: 25, truck: 30, car: 40 };   // food, used only when no wallet is connected
export const HELPER_COINS: Record<HKind, number> = { tractor: 150, robot: 200, truck: 300, car: 450 };   // game coins from the shared wallet
const LSK = "tg_ranch_helpers";
export const readOwnedHelpers = (): HKind[] => { try { const a = JSON.parse(localStorage.getItem(LSK) || "[]"); return Array.isArray(a) ? a.filter((k: any) => k in HELPER_COINS) : []; } catch (e) { return []; } };
export const saveOwnedHelpers = (l: HKind[]) => { try { localStorage.setItem(LSK, JSON.stringify(l)); } catch (e) {} };
export const HELPER_ICON: Record<HKind, string> = { tractor: "🚜", robot: "🤖", truck: "🛻", car: "🚗" };
export const HELPER_NAME: Record<HKind, [string, string, string]> = {
  tractor: ["รถไถอัตโนมัติ", "Auto tractor", "自动拖拉机"], robot: ["หุ่นยนต์ช่วยเก็บเกี่ยว", "Harvest robot", "收割机器人"],
  truck: ["รถกระบะไซเบอร์", "Cyber pickup", "赛博皮卡"], car: ["รถบินส่งของ", "Flying roadster", "飞行跑车"] };
export type Helper = { kind: HKind; x: number; y: number; tx: number; ty: number; cd: number; face: number; job: number; carry: number };
export const mkHelper = (kind: HKind, x: number, y: number): Helper => ({ kind, x, y, tx: x, ty: y, cd: 2, face: 1, job: -1, carry: 0 });
const SPEED: Record<HKind, number> = { tractor: 70, robot: 90, truck: 130, car: 170 };
/* Moves toward the target; true on arrival. */
export function stepMove(h: Helper, dt: number): boolean {
  const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy), s = SPEED[h.kind] * dt;
  if (d <= Math.max(3, s)) { h.x = h.tx; h.y = h.ty; return true; }
  h.x += dx / d * s; h.y += dy / d * s; if (Math.abs(dx) > 2) h.face = dx > 0 ? 1 : -1; return false;
}
const rr = (x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number) => { x.beginPath(); x.roundRect(a, b, w, h, r); };
function wheel(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, T: number) { x.fillStyle = "#1c1f24"; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.strokeStyle = "#9aa3ad"; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, r * 0.5, 0, 7); x.stroke(); x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(T * 8) * r * 0.5, cy + Math.sin(T * 8) * r * 0.5); x.stroke(); }
export function drawHelper(x: CanvasRenderingContext2D, h: Helper, T: number, moving: boolean) {
  x.save(); x.translate(h.x, h.y); x.scale(h.face, 1);
  const hover = h.kind === "car" ? 26 + Math.sin(T * 3 + h.x) * 3 : 0;
  x.fillStyle = "rgba(10,40,10," + (h.kind === "car" ? 0.22 : 0.3) + ")"; x.beginPath(); x.ellipse(0, 4, h.kind === "car" ? 26 : 22, 6, 0, 0, 7); x.fill();
  x.translate(0, -hover);
  if (h.kind === "tractor") {
    wheel(x, -14, -6, 9, T); wheel(x, 16, -2, 5.5, T);
    x.fillStyle = "#2f9e44"; rr(x, -22, -26, 34, 16, 4); x.fill(); x.fillStyle = "#37b24d"; rr(x, 2, -22, 20, 12, 4); x.fill();
    x.fillStyle = "rgba(160,220,255,.85)"; rr(x, -12, -38, 18, 13, 3); x.fill(); x.strokeStyle = "#1e6f31"; x.lineWidth = 1.4; x.stroke();
    x.fillStyle = "#ffd43b"; x.beginPath(); x.arc(22, -14, 2.4, 0, 7); x.fill(); x.fillStyle = "#555"; x.fillRect(-4, -46, 3, 9);
    if (moving) { x.fillStyle = "rgba(220,220,220,.5)"; x.beginPath(); x.arc(-5 - ((T * 20) % 10), -48 - ((T * 24) % 10), 3, 0, 7); x.fill(); }
  } else if (h.kind === "robot") {
    const w = moving ? Math.sin(T * 9) * 3 : 0;
    x.fillStyle = "#b8c2cc"; rr(x, -9 + w, -10, 6, 12, 2); x.fill(); rr(x, 3 - w, -10, 6, 12, 2); x.fill();
    x.fillStyle = "#e9edf1"; rr(x, -11, -32, 22, 24, 7); x.fill(); x.strokeStyle = "#7d8791"; x.lineWidth = 1.2; x.stroke();
    x.fillStyle = "#2b3440"; rr(x, -8, -46, 16, 13, 5); x.fill(); x.fillStyle = "#4dd8ff"; x.beginPath(); x.arc(-3, -40, 2, 0, 7); x.arc(3, -40, 2, 0, 7); x.fill();
    x.strokeStyle = "#e9edf1"; x.lineWidth = 4; x.lineCap = "round"; x.beginPath(); x.moveTo(11, -26); x.lineTo(18, -18 + (moving ? Math.sin(T * 9) * 3 : 0)); x.stroke();
    x.fillStyle = "#ffb020"; x.beginPath(); x.arc(0, -20, 2.6, 0, 7); x.fill();
  } else if (h.kind === "truck") {
    // angular, flat-panel pickup: one wedge of cabin over a long flat bed
    x.fillStyle = "#c5ccd3"; x.beginPath(); x.moveTo(-28, -8); x.lineTo(-28, -20); x.lineTo(2, -22); x.lineTo(20, -34); x.lineTo(30, -16); x.lineTo(30, -8); x.closePath(); x.fill();
    x.strokeStyle = "#6c757d"; x.lineWidth = 1.2; x.stroke();
    x.fillStyle = "rgba(30,40,55,.9)"; x.beginPath(); x.moveTo(6, -22); x.lineTo(19, -32); x.lineTo(26, -17); x.lineTo(6, -17); x.closePath(); x.fill();
    x.fillStyle = "#e8edf1"; x.fillRect(-26, -22, 26, 3);
    x.fillStyle = "#6fe3ff"; x.fillRect(22, -13, 8, 2.5);
    if (h.carry > 0) { x.fillStyle = "#e8a23a"; rr(x, -24, -29, 10, 8, 2); x.fill(); x.fillStyle = "#74c76a"; rr(x, -13, -28, 9, 7, 2); x.fill(); }
    wheel(x, -16, -6, 7, T); wheel(x, 18, -6, 7, T);
  } else {
    // flying roadster: low sleek body, glass canopy, hover jets
    x.fillStyle = "#d62839"; x.beginPath(); x.moveTo(-30, -8); x.quadraticCurveTo(-32, -18, -16, -19); x.lineTo(6, -20); x.quadraticCurveTo(20, -20, 32, -11); x.lineTo(32, -7); x.closePath(); x.fill();
    x.strokeStyle = "#8d1621"; x.lineWidth = 1.2; x.stroke();
    x.fillStyle = "rgba(170,225,255,.9)"; x.beginPath(); x.moveTo(-8, -19); x.quadraticCurveTo(2, -29, 14, -19); x.closePath(); x.fill();
    x.fillStyle = "#fff"; x.fillRect(24, -14, 6, 2);
    const g = x.createRadialGradient(-14, -3, 1, -14, -3, 12); g.addColorStop(0, "rgba(120,220,255,.95)"); g.addColorStop(1, "rgba(120,220,255,0)"); x.fillStyle = g; x.beginPath(); x.arc(-14, -3, 12, 0, 7); x.arc(16, -3, 12, 0, 7); x.fill();
    if (h.carry > 0) { x.fillStyle = "#ffd23f"; rr(x, -26, -24, 14, 7, 3); x.fill(); }
  }
  x.restore();
}
