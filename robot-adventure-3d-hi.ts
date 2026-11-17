/* The Robot Adventure 3D story map in High (owner 2026-11-17: "prettier and more real in the high-spec mode, keep the low-spec mode as it is").
   The map is DOM and CSS on a tilted floor. Its Lite picture has a few CSS radial-gradient "stars" that drift sideways and a flat teal / violet glow. In High a canvas behind the UI
   (nothing on top of it changes: no menu, button or text moves) draws a real sky: a painted nebula and three layers of stars, round and soft, twinkling slowly, that drift at
   different speeds and shift with the same pointer tilt that leans the floor (a parallax, so the planets sit in front of a deep sky). It paints its nebula a few rows per frame, stops
   when the page is hidden, draws a single still frame for people who asked for reduced motion, and removes itself completely when High is switched off or the page closes. */
import { fbm, sm } from "./adv3d-hi-util";

export function startHubSky(host: HTMLElement, stage: HTMLElement | null): () => void {
  const cv = document.createElement("canvas"); cv.className = "ra-sky"; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block";
  host.insertBefore(cv, host.firstChild);
  const ctx = cv.getContext("2d"); if (!ctx) { cv.remove(); return () => {}; }
  host.setAttribute("data-sky", "1");   // the CSS hides the old drifting dots only while this sky is really running, so a failure leaves the previous High look
  const reduced = (() => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } })();
  let alive = true, raf = 0, last = 0, W = 0, H = 0, tick = 0;
  /* layout size (clientWidth), not a bounding box: the map is turned a quarter in portrait and a bounding box would swap the two */
  const fit = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(200, host.clientWidth), h = Math.max(120, host.clientHeight); if (w !== W || h !== H) { W = w; H = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); } };
  fit(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null; if (ro) ro.observe(host);

  /* the nebula: 256 x 128 of layered noise (teal and violet, the map's own colours), painted 3 ms at a time, drawn stretched over the sky */
  const NW = 256, NH = 128, neb = document.createElement("canvas"); neb.width = NW; neb.height = NH; const nx = neb.getContext("2d")!, img = nx.createImageData(NW, NH); let ny = 0, nebDone = false, nebFade = 0;
  const paintRows = (ms: number) => { const t0 = performance.now(); while (ny < NH && performance.now() - t0 < ms) { for (let k = 0; k < 2 && ny < NH; k++, ny++) for (let x = 0; x < NW; x++) { const u = x / NW, v = ny / NH, a = fbm(u, v, 3, 701, 4), b = fbm(u + 0.4, v, 5, 711, 4), c = fbm(u + 0.8, v, 9, 721, 3), d1 = sm(0.44, 0.84, a) * (0.5 + 0.5 * (1 - v)), d2 = sm(0.5, 0.88, b) * (0.3 + 0.7 * v), dust = sm(0.55, 0.8, c);
      const i = (ny * NW + x) * 4, k2 = 1 - 0.6 * dust; img.data[i] = Math.min(255, (14 * d1 + 70 * d2 + 4) * k2); img.data[i + 1] = Math.min(255, (92 * d1 + 24 * d2 + 8) * k2); img.data[i + 2] = Math.min(255, (84 * d1 + 120 * d2 + 12) * k2); img.data[i + 3] = 255; } }
    if (ny >= NH) { nx.putImageData(img, 0, 0); nebDone = true; } };

  /* stars: three depths; unit coordinates so a resize keeps the sky */
  let s = 777; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const mkSprite = (r: number, g: number, b: number) => { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d")!, gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.18, `rgba(${r},${g},${b},.7)`); gr.addColorStop(0.5, `rgba(${r},${g},${b},.14)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return c; };
  const SP = [mkSprite(255, 255, 255), mkSprite(170, 205, 255), mkSprite(255, 214, 160)], COL = ["#ffffff", "#bcd6ff", "#ffe2b8"];
  const layers = [{ n: 150, sz: 0.7, a: 0.5, vx: 0.0016, par: 0.25 }, { n: 80, sz: 1.1, a: 0.75, vx: 0.0034, par: 0.6 }, { n: 28, sz: 6.5, a: 0.9, vx: 0.0062, par: 1.0 }].map(l => ({ ...l, st: Array.from({ length: l.n }, () => ({ x: R(), y: R(), t: R() * 6.28, c: Math.floor(R() * R() * 3), m: 0.5 + R() * 0.5 })) }));
  const draw = (now: number) => {
    if (!alive) return; raf = requestAnimationFrame(draw); if (document.hidden || now - last < 50) return; const dt = last ? Math.min(0.2, (now - last) / 1000) : 0; last = now; tick += dt; if (!nebDone) paintRows(3);
    const tx = stage ? parseFloat(stage.style.getPropertyValue("--tx")) || 0 : 0, ty = stage ? parseFloat(stage.style.getPropertyValue("--ty")) || 0 : 0;
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over";
    if (nebDone) { nebFade = reduced ? 1 : Math.min(1, nebFade + dt * 0.8); ctx.globalAlpha = 0.55 * nebFade; ctx.imageSmoothingEnabled = true; ctx.drawImage(neb, 0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.globalCompositeOperation = "lighter";
    for (const L of layers) for (const q of L.st) {
      const x = (((q.x - tick * L.vx * (reduced ? 0 : 1)) % 1) + 1) % 1 * W + tx * 5 * L.par, y = q.y * H + ty * 4 * L.par, tw = reduced ? 1 : 0.72 + 0.28 * Math.sin(tick * (0.8 + q.m * 1.6) + q.t);
      if (L.sz > 3) { const r = L.sz * (0.6 + q.m * 0.8); ctx.globalAlpha = L.a * tw * q.m; ctx.drawImage(SP[q.c], x - r, y - r, r * 2, r * 2); }
      else { ctx.globalAlpha = L.a * tw * q.m; ctx.fillStyle = COL[q.c]; ctx.fillRect(x, y, L.sz, L.sz); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    if (reduced && nebDone) { alive = false; cancelAnimationFrame(raf); }   // one still frame is enough
  };
  raf = requestAnimationFrame(draw);
  return () => { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); try { cv.remove(); host.removeAttribute("data-sky"); } catch (e) { /* */ } };
}
