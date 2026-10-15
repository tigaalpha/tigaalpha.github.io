/* Shared "realistic finish" for the code-drawn canvases (owner, 2026-10-15: make it look more real and beautiful, same art style).
   Only blends and gradients, no per-pixel work: a warm key light from the upper left in soft light, long light shafts, ground haze,
   a gentle bloom of the bright parts, and a vignette. `warm` is the key light colour as "r,g,b". */
let bl: HTMLCanvasElement | null = null;
export function finishLook(x: CanvasRenderingContext2D, W: number, H: number, t: number, warm = "255,214,150", strength = 1) {
  try {
    x.save();
    // key light: warm from the upper left, cool fill at the lower right
    x.globalCompositeOperation = "soft-light"; x.globalAlpha = 0.5 * strength;
    const k = x.createRadialGradient(W * 0.15, H * 0.05, 0, W * 0.15, H * 0.05, Math.max(W, H) * 1.05); k.addColorStop(0, "rgba(" + warm + ",1)"); k.addColorStop(1, "rgba(40,70,120,1)"); x.fillStyle = k; x.fillRect(0, 0, W, H);
    // light shafts
    x.globalCompositeOperation = "lighter"; x.globalAlpha = 0.05 * strength;
    for (let i = 0; i < 5; i++) { const a = 0.15 + i * 0.09 + Math.sin(t * 0.2 + i) * 0.01, g = x.createLinearGradient(W * 0.15, 0, W * (a + 0.3), H); g.addColorStop(0, "rgba(" + warm + ",1)"); g.addColorStop(1, "rgba(" + warm + ",0)"); x.fillStyle = g; x.beginPath(); x.moveTo(W * (0.1 + i * 0.03), 0); x.lineTo(W * (0.16 + i * 0.03), 0); x.lineTo(W * (a + 0.34), H); x.lineTo(W * (a + 0.2), H); x.fill(); }
    // ground haze
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 0.16 * strength;
    const h = x.createLinearGradient(0, H * 0.55, 0, H); h.addColorStop(0, "rgba(" + warm + ",0)"); h.addColorStop(1, "rgba(" + warm + ",1)"); x.fillStyle = h; x.fillRect(0, H * 0.55, W, H * 0.45);
    // bloom of the bright parts
    const bw = Math.max(48, Math.round(W / 8)), bh = Math.max(32, Math.round(H / 8));
    if (!bl) bl = document.createElement("canvas"); if (bl.width !== bw || bl.height !== bh) { bl.width = bw; bl.height = bh; }
    const b = bl.getContext("2d");
    if (b) { b.globalCompositeOperation = "copy"; b.drawImage(x.canvas, 0, 0, bw, bh); x.globalCompositeOperation = "lighter"; x.globalAlpha = 0.22 * strength; (x as any).filter = "blur(" + Math.max(3, Math.round(W / 120)) + "px)"; x.drawImage(bl, 0, 0, W, H); (x as any).filter = "none"; }
    // vignette
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
    const v = x.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.98); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0," + 0.38 * strength + ")"); x.fillStyle = v; x.fillRect(0, 0, W, H);
    x.restore();
  } catch (e) {}
}
