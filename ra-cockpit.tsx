/* Robot Adventure 3D cockpit (plan 39 P4): the Adventure's ship episodes flown in first person. The rules are ra-ship.ts; this is the picture, the controls and the music-question card
   (a gate, ring or ♪ relay that counts asks ONE question; the flight freezes while it is answered, like the tune-up on foot). */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { newShip, stepShip, shipAnswerAny, shipStats, type Ship, type SInput } from "./ra-ship";
import type { ShipDef } from "./ra-factory";
import { nextQuestion, judgeKeys, recordAnswer, readDone, type Question } from "./quiz-quest";
import * as AU from "./ah-audio";
import { usePlayDrain, PowerSheet } from "./game-power-ui";
import { gfxHigh } from "./adv-gfx";
import { addRpgExp } from "./pvp-rpg";
import { logUsage } from "./shared-infra";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
const PCN = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const WHITE = [0, 2, 4, 5, 7, 9, 11], BLACK: [number, number][] = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]];
const hexc = (s: string) => parseInt(String(s || "#88aaff").replace("#", ""), 16);
const addCrystals = (n: number) => { try { localStorage.setItem("tg_adv_crystals", String(Math.max(0, (parseInt(localStorage.getItem("tg_adv_crystals") || "0", 10) || 0) + n))); } catch (e) {} };
type Quiz = { q: Question; phase: "gate" | "ask" | "done"; ok: boolean | null; sel: number[]; armed: boolean; lit: number };
const parseNote = (n: string) => { const m = /^([A-G])([#b♯♭]?)(-?\d)/.exec(n); if (!m) return -1; const pc = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as any)[m[1]] + (m[2] === "#" || m[2] === "♯" ? 1 : m[2] ? -1 : 0); return ((pc % 12) + 12) % 12; };

export function RaShipPage({ lang, me, adminTier = 0, def, onWin, onBack }: { lang: string; me: string; adminTier?: number; def: ShipDef; onWin: () => void; onBack: () => void }) {
  const t = (th: string, en: string, zh: string) => T3(lang, th, en, zh);
  const host = useRef<HTMLDivElement>(null), S = useRef<Ship>(newShip(def.kind, def.P.hard || 2, (Date.now() & 0xffff) | 1)), inp = useRef<SInput>({ sx: 0, sy: 0, fire: false, boost: false });
  const [hud, setHud] = useState<any>({}), [quiz, setQuiz] = useState<Quiz | null>(null), [res, setRes] = useState<any>(null), [paused, setPaused] = useState(false), [powerNeed, setPowerNeed] = useState<number | null>(null), [banner, setBanner] = useState("");
  const quizRef = useRef<Quiz | null>(null); quizRef.current = quiz; const pausedRef = useRef(false); pausedRef.current = paused; const log = useRef<{ topic: string; ok: boolean }[]>([]);
  const stick = useRef({ id: -1, x0: 0, y0: 0 }); const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth); const doneRef = useRef(false);
  usePlayDrain(!res && !paused, adminTier, () => { if (!doneRef.current) { S.current.done = true; setPowerNeed(1); } });

  useEffect(() => {
    const onR = () => setPortrait(window.innerHeight > window.innerWidth); window.addEventListener("resize", onR);
    const high = gfxHigh(), el = host.current!; let raf = 0, last = performance.now(), disposed = false, bn = 0;
    const tint = (def.P.c || ["#1c2a55", "#5a7aff", "#9be8ff"]).map(hexc);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x02040a); scene.fog = new THREE.FogExp2(0x02040a, 0.0016);
    const cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.5, 4000); const rd = new THREE.WebGLRenderer({ antialias: high, powerPreference: "high-performance" }); rd.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1)); el.appendChild(rd.domElement); rd.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    const fit = () => { const w = el.clientWidth || 640, h = el.clientHeight || 360; rd.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }; fit(); const ro = new ResizeObserver(fit); ro.observe(el);
    scene.add(new THREE.HemisphereLight(0xaac8ff, 0x20243a, 1.1)); const sun = new THREE.DirectionalLight(0xfff0d8, 2.2); sun.position.set(-200, 120, 80); scene.add(sun);
    // stars: a shell that rides with the camera, so there is always depth to fly through
    const sp = new Float32Array(1400 * 3); for (let i = 0; i < 1400; i++) { const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), r = 1500 + Math.random() * 400; sp[i * 3] = Math.sin(b) * Math.cos(a) * r; sp[i * 3 + 1] = Math.cos(b) * r; sp[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 3.2, sizeAttenuation: false, fog: false })); scene.add(stars);
    const planet = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), new THREE.MeshStandardMaterial({ color: tint[1], roughness: 0.9, emissive: tint[0], emissiveIntensity: 0.25 })); planet.position.set(-900, -200, -2200); scene.add(planet);
    const ring = new THREE.Mesh(new THREE.RingGeometry(380, 520, 64), new THREE.MeshBasicMaterial({ color: tint[2], transparent: true, opacity: 0.3, side: THREE.DoubleSide, fog: false })); ring.position.copy(planet.position); ring.rotation.x = 1.2; scene.add(ring);
    const M = (c: number, e = 0.5) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.4, metalness: 0.3 });
    const gGate = new THREE.TorusGeometry(15, 0.9, 10, 40), gRock = new THREE.IcosahedronGeometry(1, 1), gFoe = new THREE.ConeGeometry(2.2, 6, 5), gBolt = new THREE.SphereGeometry(0.55, 6, 6), gPick = new THREE.OctahedronGeometry(1.8), gRelay = new THREE.TorusGeometry(16, 1.1, 8, 32), gRing = new THREE.TorusGeometry(1, 0.06, 8, 40);
    const mGate = M(0x5affc8, 0.9), mGateDone = M(0x335544, 0.1), mRock = new THREE.MeshStandardMaterial({ color: 0x6a625a, roughness: 1, flatShading: true }), mFoe = M(0xff4466, 0.7), mBoss = M(0xff2288, 0.8), mBolt = M(0xffee88, 2), mEBolt = M(0xff5533, 2), mOre = M(0xffc84a, 0.9), mSol = M(0x66ccff, 0.9), mRelay = M(0xb06aff, 1.2), mRing = M(0x66ffcc, 0.8);
    const ents = new Map<any, THREE.Object3D>(); const grp = new THREE.Group(); scene.add(grp);
    const sync = <T,>(list: T[], make: (o: T) => THREE.Object3D, upd: (m: THREE.Object3D, o: T) => void) => { const seen = new Set<any>(); for (const o of list) { seen.add(o); let m = ents.get(o); if (!m) { m = make(o); ents.set(o, m); grp.add(m); } upd(m, o); } };
    let bh: THREE.Group | null = null; if (S.current.bh) { bh = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(32, 24, 16), new THREE.MeshBasicMaterial({ color: 0x000000 })); const disc = new THREE.Mesh(new THREE.RingGeometry(40, 110, 64), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.7, side: THREE.DoubleSide })); disc.rotation.x = 1.25; bh.add(core, disc); bh.position.set(S.current.bh.x, S.current.bh.y, S.current.bh.z); scene.add(bh); }
    const flashes: { m: THREE.Mesh; t: number }[] = [];
    const boom = (x: number, y: number, z: number, r: number) => { const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(2, r), 12, 10), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.9, fog: false })); m.position.set(x, y, z); scene.add(m); flashes.push({ m, t: 0 }); };
    const askNow = () => { inp.current.fire = false; inp.current.sx = 0; inp.current.sy = 0; stick.current.id = -1; AU.setDucked(true); const nq = nextQuestion(lang as any, { done: readDone() }); setQuiz({ q: nq.q, phase: "gate", ok: null, sel: [], armed: false, lit: 0 }); setTimeout(() => setQuiz(c => (c && c.phase === "gate" ? { ...c, armed: true } : c)), 900); };
    try { AU.warm(); AU.musicStart(); } catch (e) {}
    setBanner(T3(lang, ...(def.brief as [string, string, string]))); bn = 4.5;
    const frame = (now: number) => {
      if (disposed) return; raf = requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; const s = S.current;
      if (!pausedRef.current && !quizRef.current) stepShip(s, dt, inp.current);
      for (const e of s.ev.splice(0)) { try { if (e.k === "shot") AU.sfx("shot", "pistol" as any); else if (e.k === "boom") { boom(e.x!, e.y!, e.z!, (e.n || 4) * 0.8); AU.sfx("boom" as any); } else if (e.k === "pick" || e.k === "gate") AU.sfx("tuneok"); else if (e.k === "hurt") AU.sfx("hurt" as any); else if (e.k === "ask") askNow(); else if (e.k === "win" || e.k === "lose") { /* handled below */ } else if (e.k === "warn") AU.sfx("horn" as any); } catch (x) {} }
      const p = s.p; cam.position.set(p.x, p.y, p.z); cam.rotation.order = "YXZ"; cam.rotation.set(p.pitch, p.yaw, p.roll); stars.position.copy(cam.position);
      planet.rotation.y += dt * 0.02; if (bh) bh.children[1].rotation.z += dt * 0.5;
      grp.children.forEach(c => ((c as any).__keep = false));
      const live = new Set<any>();
      sync(s.gates, g => new THREE.Mesh(gGate, mGate), (m, g) => { live.add(g); m.position.set(g.x, g.y, g.z); m.lookAt(g.x + g.nx, g.y + g.ny, g.z + g.nz); (m as THREE.Mesh).material = g.done ? mGateDone : mGate; m.visible = !g.done || Math.hypot(g.x - p.x, g.z - p.z) < 200; m.scale.setScalar(g.cd > 0 ? 0.6 : 1); });
      sync(s.rocks.filter(r => !r.dead), r => { const m = new THREE.Mesh(gRock, mRock); return m; }, (m, r) => { live.add(r); m.position.set(r.x, r.y, r.z); m.scale.setScalar(r.r); m.rotation.x += dt * 0.2; m.rotation.y += dt * 0.15; });
      sync(s.foes.filter(f => !f.dead), f => { const m = new THREE.Mesh(gFoe, f.boss ? mBoss : mFoe); m.scale.setScalar(f.boss ? 5 : 1); return m; }, (m, f) => { live.add(f); m.position.set(f.x, f.y, f.z); m.lookAt(p.x, p.y, p.z); m.rotateX(Math.PI / 2); });
      sync(s.bolts, b => new THREE.Mesh(gBolt, mBolt), (m, b) => { live.add(b); m.position.set(b.x, b.y, b.z); });
      sync(s.ebolts, b => new THREE.Mesh(gBolt, mEBolt), (m, b) => { live.add(b); m.position.set(b.x, b.y, b.z); m.scale.setScalar(1.6); });
      sync(s.picks.filter(q => !q.got), q => new THREE.Mesh(gPick, q.kind === "ore" ? mOre : mSol), (m, q) => { live.add(q); m.position.set(q.x, q.y, q.z); m.rotation.y += dt * 2; });
      sync(s.relays.filter(r => !r.got), r => new THREE.Mesh(gRelay, mRelay), (m, r) => { live.add(r); m.position.set(r.x, r.y, r.z); m.lookAt(p.x, p.y, p.z); m.scale.setScalar(1 + Math.sin(s.t * 4) * 0.08); });
      sync(s.rings.filter(r => !r.done), r => new THREE.Mesh(gRing, mRing), (m, r) => { live.add(r); m.position.set(r.x, r.y, r.z); m.scale.setScalar(r.r); m.lookAt(p.x, p.y, p.z + 1e4 * 0); (m as THREE.Mesh).rotation.x = Math.PI / 2; const k = 1 + r.p * 0.4; m.scale.setScalar(r.r * k); });
      for (const [o, m] of ents) if (!live.has(o)) { grp.remove(m); ents.delete(o); }
      for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; f.m.scale.setScalar(1 + f.t * 3); (f.m.material as any).opacity = Math.max(0, 0.9 - f.t * 1.6); if (f.t > 0.6) { scene.remove(f.m); flashes.splice(i, 1); } }
      rd.render(scene, cam);
      if (bn > 0) { bn -= dt; if (bn <= 0) setBanner(""); }
      if ((frame as any)._h = ((frame as any)._h || 0) + dt, (frame as any)._h > 0.1) { (frame as any)._h = 0; setHud({ hp: Math.round(p.hp), max: p.max, sh: Math.round(p.shield), prog: s.prog, goal: s.goal || s.secs, t: s.t, kills: s.kills, ore: s.ore, ans: s.answers, need: s.needAnswers, boss: s.foes.find(f => f.boss && !f.dead), boost: p.boost, kind: s.kind, secs: s.secs }); }
      if (s.done && !doneRef.current) { doneRef.current = true; AU.setDucked(false); const st = shipStats(s); const cry = s.won ? 8 + Math.round((def.P.hard || 2) * 4) : 0; if (s.won) { addCrystals(cry); try { onWin(); } catch (e) {} } try { logUsage("ra", `ship:${def.id}:${s.won ? "win" : "lose"}:${Math.round(s.t)}s`); } catch (e) {} setRes({ ...st, won: s.won, cry, per: log.current.reduce((a: any, x) => { a[x.topic] = a[x.topic] || [0, 0]; a[x.topic][1]++; if (x.ok) a[x.topic][0]++; return a; }, {}) }); }
    };
    raf = requestAnimationFrame(frame);
    (window as any).__raShip = { S: () => S.current, quiz: () => quizRef.current, setBot: (v: boolean) => { S.current.auto = v; }, step: (sec: number) => { for (let i = 0; i < sec * 30 && !S.current.frozen && !S.current.done; i++) { S.current.p.hp = Math.max(S.current.p.hp, 60); stepShip(S.current, 1 / 30, inp.current); } } };
    return () => { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", onR); try { AU.musicStop(); AU.setDucked(false); } catch (e) {} rd.dispose(); if (rd.domElement.parentNode) rd.domElement.parentNode.removeChild(rd.domElement); delete (window as any).__raShip; };
  }, []);

  // keyboard: arrows / WASD steer, space fires, shift boosts
  useEffect(() => {
    const k: Record<string, boolean> = {}; const upd = () => { inp.current.sx = (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.a ? 1 : 0); inp.current.sy = (k.ArrowUp || k.w ? 1 : 0) - (k.ArrowDown || k.s ? 1 : 0); inp.current.fire = !!k[" "]; inp.current.boost = !!k.Shift; };
    const dn = (e: KeyboardEvent) => { k[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true; upd(); if (e.key === "Escape" || e.key === "p") setPaused(v => !v); }; const up = (e: KeyboardEvent) => { k[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; upd(); };
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up); return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);
  const pd = (e: React.PointerEvent) => { if (stick.current.id < 0 && e.pointerType !== "mouse") { stick.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; try { (e.currentTarget as any).setPointerCapture(e.pointerId); } catch (x) {} } };
  const pm = (e: React.PointerEvent) => { if (e.pointerId === stick.current.id) { inp.current.sx = Math.max(-1, Math.min(1, (e.clientX - stick.current.x0) / 60)) * (portrait ? 1 : 1); inp.current.sy = Math.max(-1, Math.min(1, -(e.clientY - stick.current.y0) / 60)); } };
  const pu = (e: React.PointerEvent) => { if (e.pointerId === stick.current.id) { stick.current.id = -1; inp.current.sx = 0; inp.current.sy = 0; } };
  const hold = (f: (v: boolean) => void) => ({ onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); try { (e.currentTarget as any).setPointerCapture(e.pointerId); } catch (x) {} f(true); }, onPointerUp: () => f(false), onPointerCancel: () => f(false) });

  /* the question card (same flow as the tune-up on foot: HANDS OFF, ask, verdict) */
  const q = quiz && quiz.q;
  const answer = (ok: boolean, patch?: Partial<Quiz>) => { const c = quizRef.current; if (!c || c.phase !== "ask") return; recordAnswer(ok, c.q.topic); log.current.push({ topic: c.q.topic, ok }); AU.sfx(ok ? "tuneok" : "tunebad"); if (ok) { try { addRpgExp(me, 10 + 6 * c.q.tier); } catch (e) {} } setQuiz({ ...c, ...patch, phase: "done", ok, lit: ok ? c.q.teach.lit.length : 0 }); if (!ok) { const n = c.q.teach.lit.length; let i = 0; const id = setInterval(() => { i++; setQuiz(z => (z ? { ...z, lit: Math.min(n, i) } : z)); if (i >= n) clearInterval(id); }, 450); } };
  const resume = (skipped = false) => { const c = quizRef.current; if (!c) return; shipAnswerAny(S.current, skipped ? false : !!c.ok); AU.setDucked(false); setQuiz(null); try { logUsage("ra", `tune:${c.q.topic}:${skipped ? "skip" : c.ok ? "ok" : "bad"}`); } catch (e) {} };
  const tap = (pc: number) => { const c = quizRef.current; if (!c || c.phase !== "ask") return; if (c.q.kind === "key") answer(judgeKeys(c.q, [pc]), { sel: [pc] }); else setQuiz({ ...c, sel: c.sel.includes(pc) ? c.sel.filter(x => x !== pc) : [...c.sel, pc] }); };
  const litPcs = q ? q.teach.lit.map(parseNote).filter(x => x >= 0) : [];
  const objective = () => { const h = hud, k = def.kind; if (k === "launch" || k === "skim" || k === "warp") return t(`บินผ่านประตู ${h.prog || 0}/${h.goal || 0} · ตอบคำถามที่ประตูสีเขียว`, `Fly through the gates ${h.prog || 0}/${h.goal || 0} · answer at the green ones`, `飞过关口 ${h.prog || 0}/${h.goal || 0} · 在绿色关口答题`); if (k === "harvest") return t(`ค้างในวงแหวน ${h.prog || 0}/${h.goal || 0}`, `Hold the rings ${h.prog || 0}/${h.goal || 0}`, `停留在光环内 ${h.prog || 0}/${h.goal || 0}`); if (k === "belt") return t(`ยิงหิน เก็บแร่ ${h.prog || 0}/${h.goal || 0}`, `Shoot rocks, collect ore ${h.prog || 0}/${h.goal || 0}`, `击碎岩石收集矿石 ${h.prog || 0}/${h.goal || 0}`); if (k === "solar") return t(`เก็บแผงโซลาร์ ${h.prog || 0}/${h.goal || 0}`, `Collect solar panels ${h.prog || 0}/${h.goal || 0}`, `收集太阳能板 ${h.prog || 0}/${h.goal || 0}`); if (k === "dogfight") return t(`ล้มศัตรู ${h.kills || 0}/${h.goal || 0} แล้วสู้กับเรือแม่`, `Down ${h.kills || 0}/${h.goal || 0} fighters, then the mothership`, `击落 ${h.kills || 0}/${h.goal || 0} 架，然后打母舰`); return t(`รอดให้ได้ ${Math.max(0, Math.round((h.secs || 0) - (h.t || 0)))} วินาที`, `Survive ${Math.max(0, Math.round((h.secs || 0) - (h.t || 0)))} s`, `坚持 ${Math.max(0, Math.round((h.secs || 0) - (h.t || 0)))} 秒`); };
  return (
    <div className={"rs-root" + (portrait ? " rot" : "")} data-rs={def.kind} data-rs-id={def.id}>
      <style>{CSS}</style>
      {powerNeed != null && <PowerSheet lang={lang} need={powerNeed} onClose={() => { setPowerNeed(null); onBack(); }} />}
      <div className="rs-host" ref={host} onPointerDown={pd} onPointerMove={pm} onPointerUp={pu} onPointerCancel={pu} />
      <div className="rs-cockpit" aria-hidden="true"><i className="l" /><i className="r" /><i className="b" /></div>
      <div className="rs-hud">
        <div className="rs-bars"><span className="hp"><i style={{ width: Math.max(0, (hud.hp || 0) / (hud.max || 100) * 100) + "%" }} /><b>{t("ตัวยาน", "HULL", "船体")} {hud.hp ?? 100}</b></span>{hud.sh > 0 && <span className="sh"><i style={{ width: Math.min(100, hud.sh * 2) + "%" }} /><b>{t("โล่", "SHIELD", "护盾")}</b></span>}</div>
        <div className="rs-obj" data-rs-obj="1">{objective()}{hud.need > 0 && def.kind !== "launch" && <em> · ♪ {hud.ans || 0}/{hud.need}</em>}</div>
        {hud.boss && <div className="rs-boss"><i style={{ width: (hud.boss.hp / hud.boss.max * 100) + "%" }} /></div>}
        {banner && <div className="rs-banner" data-rs-banner="1">{banner}</div>}
      </div>
      <button className="rs-x" data-rs-gear="1" onClick={() => setPaused(true)} aria-label="pause">⚙</button>
      <div className="rs-pad">
        <button className="fire" data-rs-fire="1" {...hold(v => (inp.current.fire = v))}>{t("ยิง", "FIRE", "开火")}</button>
        <button className="boost" data-rs-boost="1" {...hold(v => (inp.current.boost = v))}>⚡</button>
      </div>
      {paused && !quiz && !res && <div className="rs-card" data-rs-pause="1"><h2>{t("พักเกม", "PAUSED", "暂停")}</h2><button className="rs-go" onClick={() => setPaused(false)}>{t("เล่นต่อ", "RESUME", "继续")}</button><button className="rs-ghost" onClick={() => { S.current.auto = !S.current.auto; setHud((h: any) => ({ ...h })); }}>{t("นักบินอัตโนมัติ: ", "Auto-pilot: ", "自动驾驶：")}{S.current.auto ? "ON" : "OFF"}</button><button className="rs-ghost" data-rs-back="1" onClick={onBack}>{t("กลับแผนที่", "Back to the map", "回到地图")}</button></div>}
      {quiz && q && (
        <div className="rs-quiz" data-rs-quiz="1">
          {quiz.phase === "gate" ? (
            <div className="rs-card"><em>{t("ภารกิจ · ยานหยุดอยู่", "MISSION · FLIGHT FROZEN", "任务 · 飞行暂停")}</em><h2>✋ {t("ยกมือออกก่อน", "HANDS OFF", "先放开手")}</h2><p>{t("ตอบคำถามดนตรีเพื่อทำภารกิจต่อ", "Answer a music question to carry out the mission.", "回答音乐问题来完成任务。")}</p><button className={"rs-go" + (quiz.armed ? "" : " dim")} data-ready="1" disabled={!quiz.armed} onClick={() => setQuiz({ ...quiz, phase: "ask" })}>{quiz.armed ? t("พร้อมแล้ว", "I'M READY", "我准备好了") : "…"}</button></div>
          ) : (
            <div className="rs-card wide"><em>{q.topic.toUpperCase()}</em><b className="rs-q" data-q="1">{q.q}</b>
              {q.kind === "choice" && q.opts && <div className="rs-opts">{q.opts.map((o, i) => <button key={i} disabled={quiz.phase === "done"} data-opt={o.ok ? "ok" : "no"} className={quiz.phase === "done" && o.ok ? "good" : ""} onClick={() => answer(o.ok)}>{o.label}</button>)}</div>}
              {q.kind !== "choice" && <div className="rs-piano" data-piano="1">{[0, 1].flatMap(o => WHITE.map((pc, i) => { const k = o * 12 + pc; const lit = quiz.phase === "done" && (quiz.ok ? litPcs.includes(pc) : litPcs.slice(0, quiz.lit).includes(pc)); return <button key={k} className={"w" + (quiz.sel.includes(pc) ? " sel" : "") + (lit ? " lit" : "")} data-pc={pc} data-k={k} style={{ left: (o * 7 + i) * (100 / 14) + "%" }} onClick={() => tap(pc)}><span>{PCN[pc]}</span></button>; }))}{[0, 1].flatMap(o => BLACK.map(([pc, wi]) => { const k = o * 12 + pc; const lit = quiz.phase === "done" && (quiz.ok ? litPcs.includes(pc) : litPcs.slice(0, quiz.lit).includes(pc)); return <button key={k} className={"b" + (quiz.sel.includes(pc) ? " sel" : "") + (lit ? " lit" : "")} data-pc={pc} data-k={k} style={{ left: (o * 7 + wi + 0.65) * (100 / 14) + "%" }} onClick={() => tap(pc)}><span>{PCN[pc]}</span></button>; }))}</div>}
              {quiz.phase === "ask" && q.kind === "keys" && <button className="rs-go" data-check="1" disabled={!quiz.sel.length} onClick={() => answer(judgeKeys(q, quiz.sel))}>{t("ตรวจ", "CHECK", "检查")}</button>}
              {quiz.phase === "ask" && <button className="rs-ghost" data-skip="1" onClick={() => resume(true)}>{t("ข้าม (ไม่ได้รางวัล)", "Skip (no reward)", "跳过（无奖励）")}</button>}
              {quiz.phase === "done" && <div className={"rs-verdict " + (quiz.ok ? "good" : "bad")} data-verdict={quiz.ok ? "good" : "bad"}><b>{quiz.ok ? t("ถูก! ภารกิจก้าวหน้า", "RIGHT! The mission moves on", "答对！任务推进") : t("ยังไม่ใช่ — ดูคีย์ที่ถูก", "Not quite — watch the right keys", "不对——看正确的键")}</b>{!quiz.ok && <span>{q.teach.why}</span>}<button className="rs-go" data-continue="1" onClick={() => resume(false)}>{t("บินต่อ", "FLY ON", "继续飞行")}</button></div>}
            </div>
          )}
        </div>
      )}
      {res && (
        <div className="rs-quiz" data-result="1"><div className="rs-card"><em>{res.won ? t("ภารกิจสำเร็จ", "MISSION COMPLETE", "任务完成") : t("ภารกิจล้มเหลว", "MISSION FAILED", "任务失败")}</em><h2>{"★".repeat(res.stars)}{"☆".repeat(3 - res.stars)}</h2>
          <div className="rs-stats"><span><b>{res.right}/{res.tunes}</b>{t("ตอบถูก", "answers right", "答对")}</span><span><b>{res.kills}</b>{t("ศัตรู", "enemies", "击杀")}</span><span><b>{res.ore}</b>{t("แร่", "ore", "矿石")}</span><span><b>{res.score}</b>{t("คะแนน", "score", "得分")}</span></div>
          <p>+{res.cry} ◆</p>{res.won && <p data-radio="1">📡 {T3(lang, ...(def.win as [string, string, string]))}</p>}
          <button className="rs-go" data-ra-map="1" onClick={onBack}>{t("กลับแผนที่", "Back to the map", "回到地图")}</button></div></div>
      )}
    </div>
  );
}
export default RaShipPage;

const CSS = `
.rs-root{position:fixed;inset:0;z-index:2460;background:#02040a;color:#eaf6ff;font-family:system-ui,-apple-system,sans-serif;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.rs-root.rot{inset:auto;top:0;left:100%;width:100vh;height:100vw;transform-origin:0 0;transform:rotate(90deg)}
.rs-host{position:absolute;inset:0}
.rs-cockpit{position:absolute;inset:0;pointer-events:none}
.rs-cockpit i{position:absolute;background:linear-gradient(#0b1220,#05080f);box-shadow:0 0 24px #000}
.rs-cockpit .l{left:-3%;top:0;bottom:0;width:11%;clip-path:polygon(0 0,70% 0,100% 100%,0 100%);opacity:.92}
.rs-cockpit .r{right:-3%;top:0;bottom:0;width:11%;clip-path:polygon(30% 0,100% 0,100% 100%,0 100%);opacity:.92}
.rs-cockpit .b{left:8%;right:8%;bottom:-2%;height:13%;clip-path:polygon(0 100%,6% 0,94% 0,100% 100%);border-top:2px solid #5affc866}
.rs-hud{position:absolute;left:0;right:0;top:0;padding:8px 56px 0 12px;pointer-events:none}
.rs-bars{display:flex;gap:8px;flex-direction:column;width:190px}.rs-bars span{position:relative;height:14px;border-radius:7px;background:#0007;border:1px solid #ffffff33;overflow:hidden}.rs-bars i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#ff5577,#ffcc55)}.rs-bars .sh i{background:linear-gradient(90deg,#46b6ff,#9be8ff)}.rs-bars b{position:relative;font-size:10px;padding-left:8px;line-height:14px}
.rs-obj{position:absolute;left:50%;top:8px;transform:translateX(-50%);background:#06121ccc;border:1px solid #5affc855;border-radius:16px;padding:5px 14px;font-weight:800;font-size:13px;text-align:center;max-width:60%}.rs-obj em{font-style:normal;color:#c79bff}
.rs-boss{position:absolute;left:30%;right:30%;top:44px;height:10px;border-radius:5px;background:#0008;border:1px solid #ff5599;overflow:hidden}.rs-boss i{display:block;height:100%;background:linear-gradient(90deg,#ff2288,#ffaa66)}
.rs-banner{position:absolute;left:50%;top:38%;transform:translateX(-50%);max-width:70%;text-align:center;background:#000a;border-radius:14px;padding:10px 16px;font-size:14px;font-weight:700}
.rs-x{position:absolute;right:10px;top:8px;width:38px;height:38px;border-radius:50%;border:1px solid #ffffff44;background:#0b1a24cc;color:#fff;font-size:18px;cursor:pointer;z-index:3}
.rs-pad{position:absolute;right:16px;bottom:16px;display:flex;gap:12px;align-items:flex-end;z-index:3}
.rs-pad button{border-radius:50%;border:2px solid #ffffff55;background:#0b1a24bb;color:#fff;font-weight:900;cursor:pointer}.rs-pad .fire{width:84px;height:84px;background:#d0224488;font-size:14px}.rs-pad .boost{width:56px;height:56px;font-size:20px;background:#2266dd88}
.rs-quiz{position:absolute;inset:0;z-index:5;background:#000b;display:flex;align-items:center;justify-content:center;padding:10px;overflow:auto}
.rs-card{background:#0b1620;border:1px solid #5affc866;border-radius:18px;padding:14px 18px;max-width:92%;display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center}.rs-card.wide{width:min(760px,96%)}
.rs-card h2{margin:0;font-size:22px}.rs-card em{font-style:normal;font-size:11px;letter-spacing:1.5px;color:#5affc8;font-weight:800}.rs-q{font-size:16px}
.rs-go{min-height:44px;padding:0 24px;border-radius:22px;border:0;background:linear-gradient(#5affc8,#2ab890);color:#022;font-weight:900;font-size:15px;cursor:pointer}.rs-go.dim,.rs-go:disabled{opacity:.45}
.rs-ghost{min-height:38px;padding:0 16px;border-radius:19px;border:1px solid #ffffff44;background:transparent;color:#cfe;font-weight:700;cursor:pointer}
.rs-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}.rs-opts button{min-height:42px;border-radius:12px;border:1px solid #ffffff44;background:#13212c;color:#fff;font-weight:700;cursor:pointer;padding:4px 8px}.rs-opts .good{background:#1a6a4a}
.rs-piano{position:relative;width:100%;height:96px;background:#111;border-radius:6px}.rs-piano button{position:absolute;border:1px solid #333;cursor:pointer;padding:0;font-size:9px}
.rs-piano .w{top:0;height:100%;width:7.14%;background:#f4f4f4;color:#444;border-radius:0 0 5px 5px;display:flex;align-items:flex-end;justify-content:center}.rs-piano .b{top:0;height:58%;width:4.4%;background:#161616;color:#aaa;z-index:2;border-radius:0 0 4px 4px;margin-left:-1.5%;display:flex;align-items:flex-end;justify-content:center}
.rs-piano .sel{outline:3px solid #ffcc33}.rs-piano .lit{background:#ff9d33!important;color:#000}
.rs-verdict{display:flex;flex-direction:column;gap:6px;align-items:center}.rs-verdict.good b{color:#7affb0}.rs-verdict.bad b{color:#ffb070}.rs-verdict span{font-size:12px;opacity:.85}
.rs-stats{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}.rs-stats span{display:flex;flex-direction:column;font-size:11px}.rs-stats b{font-size:18px}
`;
