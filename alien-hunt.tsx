/* Alien Hunt (plan 38): a first-person shooter against human-sized insect aliens, with a music question every 15 s of fighting.
   The shell: ready screen, input (touch sticks, mouse + keys), HUD, the tune-up question card, pause, results, Game Power. The rules are in ah-engine.ts, the picture in ah-render.ts. */
import { useEffect, useRef, useState } from "react";
import { ARENA, newState, step, noInput, tuneResult, answerTune, stats, setWeapon, WEAPONS, ALIENS, CLASSIC_WAVES, WORDER, type State, type Input, type WeaponId, type ShopW } from "./ah-engine";
import { LEVELS, gunsAfter } from "./ah-levels";
import { createRender, type Render } from "./ah-render";
import { orbPic } from "./planet-orb";
import { nextQuestion, judgeKeys, recordAnswer, readLadder, learnedTopics, readDone, type Question } from "./quiz-quest";
import * as AU from "./ah-audio";
import { usePlayDrain, PowerSheet } from "./game-power-ui";
import { enterGame, COST as POWER_COST } from "./game-power";
import { gfxHigh } from "./adv-gfx";
import { enterFs, exitFsAndUnlock } from "./pvp-arena";
import { addRpgExp } from "./pvp-rpg";
import { logUsage } from "./shared-infra";
import type { RaLevel } from "./ra-data";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
const PCN = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const PC_OF: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOfName = (n: string) => { const m = /^([A-G])([#b♯♭]?)/.exec(n); if (!m) return -1; return (PC_OF[m[1]] + (m[2] === "#" || m[2] === "♯" ? 1 : m[2] ? -1 : 0) + 12) % 12; };
const WHITE = [0, 2, 4, 5, 7, 9, 11], BLACK: [number, number][] = [[1, 0.65], [3, 1.65], [6, 3.65], [8, 4.65], [10, 5.65]];
const addCrystals = (n: number) => { try { localStorage.setItem("tg_adv_crystals", String(Math.max(0, (parseInt(localStorage.getItem("tg_adv_crystals") || "0", 10) || 0) + n))); } catch (e) {} };
type Camp = { cleared: number; stars: number[] };
const readCamp = (): Camp => { try { const j = JSON.parse(localStorage.getItem("tg_ah_camp") || "{}"); return { cleared: Math.max(0, Math.min(LEVELS.length, j.cleared | 0)), stars: Array.isArray(j.stars) ? j.stars.map((x: any) => x | 0) : [] }; } catch (e) { return { cleared: 0, stars: [] }; } };
const writeCamp = (c: Camp) => { try { localStorage.setItem("tg_ah_camp", JSON.stringify(c)); } catch (e) {} };
const readTune = (): number => 30;   // owner 2026-10-23: a music question every 30 s of fighting (was 20), fixed: no choice on the ready screen

/** a note name like "F#4" -> key index 0..23 on the two-octave keyboard (C4..B5), and its staff position */
const parseNote = (n: string) => { const m = /^([A-G])([#b♯♭]?)(-?\d)/.exec(n); if (!m) return null; const sh = m[2] === "#" || m[2] === "♯" ? 1 : m[2] ? -1 : 0; let oct = parseInt(m[3], 10); const pc = (PC_OF[m[1]] + sh + 12) % 12; if (PC_OF[m[1]] + sh < 0) oct--; if (PC_OF[m[1]] + sh > 11) oct++; oct = Math.max(4, Math.min(5, oct)); const L = "CDEFGAB".indexOf(m[1]); return { key: (oct - 4) * 12 + pc, letter: L, oct: Math.max(4, Math.min(5, parseInt(m[3], 10))), acc: sh }; };
/** the correctly spelled name of a pitch class for this question ("Eb", "F#", "E#"…) shown with real accidental signs */
export const prettyName = (n: string) => n.replace(/##/g, "𝄪").replace(/bb/g, "𝄫").replace(/#/g, "♯").replace(/b/g, "♭");
/** staff position + accidental for key k written as the question spells it (E♭ sits on the E line, not as D♯); falls back to sharps when the question gives no spelling */
export const keyToStaffNamed = (k: number, names?: Record<number, string>) => {
  const pc = k % 12, nm = names && names[pc], base = k % 24;
  const m = nm ? /^([A-G])(#*|b*)$/.exec(nm) : null; if (!m) return keyToStaff(k);
  const acc = m[2] === "" ? 0 : m[2][0] === "#" ? m[2].length : -m[2].length, L = "CDEFGAB".indexOf(m[1]);
  const abs = 48 + base, octL = Math.floor((abs - acc - (PC_OF[m[1]])) / 12);   // absolute pitch, then the octave the LETTER lives in
  return { pos: (octL - 4) * 7 + L, acc };
};
const keyToStaff = (k: number) => { const pc = k % 12, oct = 4 + Math.floor(k / 12); const nat = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pc]; return { pos: (oct - 4) * 7 + nat, acc: [1, 3, 6, 8, 10].includes(pc) ? 1 : 0 }; };
/** five-line treble staff with the notes written on it (C4..B5 plus ledger lines) */
function QStaff({ notes, hot }: { notes: { pos: number; acc: number }[]; hot?: boolean }) {
  const B = 70, st = 5, W = 300, x0 = 62, n = notes.length, gap = n > 1 ? Math.min(34, (W - x0 - 20) / (n - 1)) : 0, y = (pos: number) => B - (pos - 2) * st / 1;
  const lines = [2, 4, 6, 8, 10];
  return (
    <svg className="ah-staff" data-staff={n} viewBox="0 0 320 112" role="img" aria-label="staff">
      {lines.map(l => <line key={l} x1="8" x2="312" y1={y(l)} y2={y(l)} stroke="currentColor" strokeWidth="1.2" opacity="0.8" />)}
      <text x="12" y={y(2) + 8} fontSize="58" fill="currentColor" style={{ fontFamily: "serif" }}>𝄞</text>
      {notes.map((nt, i) => {
        const cx = x0 + 20 + i * gap, cy = y(nt.pos), led: number[] = [];
        for (let l = 0; l >= nt.pos; l -= 2) led.push(l); for (let l = 12; l <= nt.pos; l += 2) led.push(l);
        return <g key={i} className={hot ? "hot" : ""}>
          {led.map(l => <line key={l} x1={cx - 11} x2={cx + 11} y1={y(l)} y2={y(l)} stroke="currentColor" strokeWidth="1.2" />)}
          <ellipse cx={cx} cy={cy} rx="6.4" ry="4.6" transform={`rotate(-18 ${cx} ${cy})`} fill="currentColor" />
          <line x1={cx + (nt.pos < 6 ? 6 : -6)} x2={cx + (nt.pos < 6 ? 6 : -6)} y1={cy} y2={cy + (nt.pos < 6 ? -26 : 26)} stroke="currentColor" strokeWidth="1.4" />
          {nt.acc ? <text x={cx - (Math.abs(nt.acc) > 1 ? 21 : 17)} y={cy + 5} fontSize="15" fill="currentColor">{nt.acc === 1 ? "♯" : nt.acc === -1 ? "♭" : nt.acc === 2 ? "𝄪" : "𝄫"}</text> : null}
        </g>;
      })}
    </svg>
  );
}
const WHITE2 = [0, 2, 4, 5, 7, 9, 11], BLACK2: [number, number][] = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]];
type Quiz = { q: Question; phase: "gate" | "ask" | "done"; ok: boolean | null; sel: number[]; selK?: number[]; armed: boolean; lit: number };

/** the minimap: the arena seen from above, north up, with the player marked by an arrow and a "YOU" ring */
function drawMap(cv: HTMLCanvasElement | null, s: State, tint: string, mates: { x: number; z: number; glow: string }[] = []) {
  if (!cv) return; const g = cv.getContext("2d"); if (!g) return; const W = cv.width, k = W / (ARENA * 2 + 2), X = (x: number) => W / 2 + x * k, Z = (z: number) => W / 2 + z * k;
  g.clearRect(0, 0, W, W); g.fillStyle = "rgba(6,8,14,.72)"; g.fillRect(0, 0, W, W); g.strokeStyle = tint; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, W - 3);
  g.fillStyle = "rgba(255,255,255,.28)"; for (const b of s.boxes) g.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * k, b.d * k);
  for (const h of s.hz) { const on = s.hzClock % h.per < h.on; g.fillStyle = on ? "rgba(255,90,40,.65)" : "rgba(255,160,80,.2)"; g.beginPath(); g.arc(X(h.x), Z(h.z), h.r * k, 0, 7); g.fill(); }
  if (s.ms) for (const it of s.ms.items) { if (it.done && s.ms.type === "mine") continue; g.strokeStyle = it.done ? "#5aff7a" : s.ms.type === "mine" ? "#6ab0ff" : "#5affc8"; g.lineWidth = 3; g.beginPath(); g.arc(X(it.x), Z(it.z), Math.max(5, it.r * k), 0, 7); g.stroke(); }
  for (const q of s.pk) { g.fillStyle = "#ffd34a"; g.fillRect(X(q.x) - 3, Z(q.z) - 3, 6, 6); }
  for (const e of s.enemies) { if (e.dead !== 0) continue; const boss = !!ALIENS[e.kind].boss; g.fillStyle = boss ? "#ff3a8a" : "#ff5a3a"; g.beginPath(); g.arc(X(e.x), Z(e.z), boss ? 7 : 3.6, 0, 7); g.fill(); }
  for (const m of mates) { g.fillStyle = m.glow || "#7fe8ff"; g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(X(m.x), Z(m.z), 6, 0, 7); g.fill(); g.stroke(); }
  const px = X(s.p.x), pz = Z(s.p.z), fx = -Math.sin(s.p.yaw), fz = -Math.cos(s.p.yaw);
  g.strokeStyle = "#5affb0"; g.lineWidth = 3; g.beginPath(); g.arc(px, pz, 13, 0, 7); g.stroke();
  g.fillStyle = "#5affb0"; g.beginPath(); g.moveTo(px + fx * 11, pz + fz * 11); g.lineTo(px - fz * 6 - fx * 6, pz + fx * 6 - fz * 6); g.lineTo(px + fz * 6 - fx * 6, pz - fx * 6 - fz * 6); g.closePath(); g.fill();
}

const PLANET_POS: [number, number][] = [[7, 62], [16.5, 30], [26, 66], [35.5, 30], [45, 66], [54.5, 30], [64, 66], [73.5, 30], [83, 66], [92.5, 30]];
export const AH_COIN_DAY_CAP = 600;
const ahDayKey = () => new Date().toISOString().slice(0, 10);
const readAhDayCoins = () => { try { const v = JSON.parse(localStorage.getItem("tg_ah_coin_day") || "null"); return v && v.d === ahDayKey() ? Number(v.n) || 0 : 0; } catch (e) { return 0; } };
const addAhDayCoins = (n: number) => { try { localStorage.setItem("tg_ah_coin_day", JSON.stringify({ d: ahDayKey(), n: readAhDayCoins() + n })); } catch (e) {} };
export function AlienHuntPage({ lang, me, adminTier = 0, onBack, playUi, onReward = null, shopWeapon = null, ra = null }: { lang: string; me: string; adminTier?: number; onBack: () => void; playUi?: (k: string) => void; onReward?: any; shopWeapon?: ShopW | null; ra?: { data: RaLevel; hasNext?: () => boolean; onNext?: () => void; onWin: () => void; onBack: () => void; net?: any } | null }) {   // ra: Robot Adventure 3D plays this engine on one of its own levels (plan 39)
  const t = (th: string, en: string, zh: string) => T3(lang, th, en, zh);
  const host = useRef<HTMLDivElement>(null), rdr = useRef<Render | null>(null), S = useRef<State>(newState(Date.now() & 0xffff, readTune()));
  const inp = useRef<Input>(noInput()), look = useRef({ x: 0, y: 0 }), keys = useRef<Record<string, boolean>>({}), stick = useRef({ id: -1, x0: 0, y0: 0, mx: 0, mz: 0 }), lookId = useRef(-1);
  const [, setSwTick] = useState(0);
  const [phase, setPhase] = useState<"ready" | "play" | "result">("ready"), [paused, setPaused] = useState(false), [quiz, setQuiz] = useState<Quiz | null>(null);
  const [hud, setHud] = useState<any>({}), [high, setHigh] = useState(() => gfxHigh()), [powerNeed, setPowerNeed] = useState<number | null>(null), [res, setRes] = useState<any>(null);
  const [learned, setLearned] = useState<string[]>(() => learnedTopics(readDone())), [snd, setSnd] = useState(() => AU.soundOn()), tuneLog = useRef<{ topic: string; ok: boolean }[]>([]);
  const [camp, setCamp] = useState<Camp>(() => readCamp()), [curLv, setCurLv] = useState(0);
  const unlockAll = adminTier >= 3 || (() => { try { return localStorage.getItem("tg_test_hook") === "1" && localStorage.getItem("tg_ah_unlockall") === "1"; } catch (e) { return false; } })();   // the top admin inspects levels out of order; nobody else (the second door is for the bots)
  const [portrait, setPortrait] = useState(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth);
  const [hitM, setHitM] = useState(0), [hurt, setHurt] = useState(0), [banner, setBanner] = useState<string>(""), [tuneSecs, setTuneSecs] = useState<number>(readTune());
  const perf = useRef({ n: 0, t: 0 }); const phaseRef = useRef(phase); phaseRef.current = phase; const pausedRef = useRef(paused); pausedRef.current = paused; const quizRef = useRef(quiz); quizRef.current = quiz;
  const mapRef = useRef<HTMLCanvasElement>(null), fireId = useRef(-1);   // dragging while holding FIRE aims
  const hitT = useRef(0), hurtT = useRef(0), bannerT = useRef(0);

  usePlayDrain(phase === "play" && !paused && !quiz, adminTier, () => { finish(false, true); setPowerNeed(1); });

  const finish = (won: boolean, forced = false) => {
    const s = S.current; if (phaseRef.current === "result") return; const st = stats(s);
    const cry = Math.round(st.kills / 4 + st.stars * 3 + st.right * 2), exp = 20 + st.stars * 10 + st.right * 8;
    if (!forced || st.kills > 0) { addCrystals(cry); try { addRpgExp(me, exp); } catch (e) {} }
    try { logUsage(ra ? "ra" : "ah", `end:${won ? "win" : "lose"}:k${st.kills}:w${s.wave}:t${st.right}of${st.tunes}:${gfxHigh() ? "hd" : "sd"}`); } catch (e) {}
    if (ra && perf.current.t > 3) { try { logUsage("ra", `perf:${ra.data.id}:${gfxHigh() ? "hd" : "sd"}:${Math.round(perf.current.n / perf.current.t)}fps`); } catch (e) {} }
    AU.musicStop(); AU.sfx(won ? "win" : "lose"); const per: Record<string, [number, number]> = {}; for (const l of tuneLog.current) { per[l.topic] = per[l.topic] || [0, 0]; per[l.topic][1]++; if (l.ok) per[l.topic][0]++; }
    // coins (owner, 2026-10-18): every alien down pays, a cleared level pays a bonus; capped per day, paid through the app's one wallet
    const clearCoins = won ? 30 * Math.max(1, s.lv) : 0, wantCoins = st.coins + clearCoins, coinsPaid = Math.min(wantCoins, Math.max(0, AH_COIN_DAY_CAP - readAhDayCoins()));
    if (coinsPaid > 0 && onReward) { try { onReward(0, coinsPaid, { adventure: true, ah: true }); addAhDayCoins(coinsPaid); } catch (e) {} }
    let bonus = 0, newGuns: string[] = []; if (ra && won) { bonus = 10; addCrystals(bonus); try { ra.onWin(); } catch (e) {} } if (s.lv && won && !ra) { bonus = 10 * s.lv; addCrystals(bonus); const c = readCamp(); const first = c.cleared < s.lv; c.cleared = Math.max(c.cleared, s.lv); c.stars[s.lv - 1] = Math.max(c.stars[s.lv - 1] | 0, st.stars); writeCamp(c); setCamp(c); if (first) newGuns = LEVELS[s.lv - 1].guns.map(g => WEAPONS[g].name); }
    setRes({ ...st, ra: !!ra, won, coinsPaid, coinsWant: wantCoins, cry: cry + bonus, exp, wave: s.wave, per, lv: s.lv, newGuns }); setPhase("result"); setPaused(false); setQuiz(null);   // full screen stays on for the result card; only Back leaves it
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
  };
  const begin = (level = 0) => {
    if (!enterGame(POWER_COST.adventure, adminTier)) { setPowerNeed(POWER_COST.adventure); return; }
    if (playUi) playUi("click"); enterFs(); const lt = learnedTopics(readDone()); setLearned(lt); tuneLog.current = []; const cc = readCamp(); S.current = newState(Date.now() & 0xffff, lt.length ? readTune() : 0, level, level && !ra ? gunsAfter(unlockAll ? LEVELS.length : Math.min(cc.cleared, level - 1)) : [], shopWeapon, ra ? ra.data.level : null); setCurLv(level); if (level) { const L = ra ? ra.data.level : LEVELS[level - 1]; setBanner(t("ด่าน ", "LEVEL ", "第") + level + (lang === "zh" ? "关" : "") + " · " + T3(lang, ...L.name) + " — " + T3(lang, ...L.race)); bannerT.current = 3.2; if (ra) { setBanner(T3(lang, ...ra.data.brief)); bannerT.current = 4.5; } } AU.menuStop(); AU.warm(); AU.setDucked(false); AU.musicStart(); AU.sfx("go"); setRes(null); setQuiz(null); setPaused(false); setPhase("play");
    try { logUsage(ra ? "ra" : "ah", `start:L${level}:${gfxHigh() ? "hd" : "sd"}:${S.current.tuneEvery}s`); } catch (e) {}
  };


  /* the map screen: full screen + landscape, its own tune, and a quarter turn when the phone refuses to rotate */
  useEffect(() => {
    if (phase !== "ready" || ra) return undefined;
    const onR = () => setPortrait(window.innerHeight > window.innerWidth); window.addEventListener("resize", onR); onR();
    try { enterFs(); } catch (e) {}
    const startMenu = () => { try { AU.warm(); AU.menuStart(); } catch (e) {} };
    startMenu(); const first = () => { startMenu(); window.removeEventListener("pointerdown", first); }; window.addEventListener("pointerdown", first);
    return () => { window.removeEventListener("resize", onR); window.removeEventListener("pointerdown", first); AU.menuStop(); };
  }, [phase]);

  /* renderer + loop */
  useEffect(() => {
    if (phase !== "play" || !host.current) return undefined;
    let r: Render; try { r = createRender(host.current, high, S.current.lv, ra ? ra.data.level : null); } catch (e) { setBanner("WebGL"); return undefined; }
    rdr.current = r; let raf = 0, last = performance.now(), acc = 0, slow = 0, hudT = 0, netT = 0;
    const onResize = () => r.resize(); window.addEventListener("resize", onResize);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now; const s = S.current;
      if (!pausedRef.current && !s.frozen) {
        const k = keys.current, i = inp.current, st = stick.current;
        i.mx = Math.max(-1, Math.min(1, (k.d ? 1 : 0) - (k.a ? 1 : 0) + st.mx)); i.mz = Math.max(-1, Math.min(1, (k.w ? 1 : 0) - (k.s ? 1 : 0) + st.mz));
        i.sprint = !!k.shift || Math.hypot(st.mx, st.mz) > 0.92; i.lookX = look.current.x; i.lookY = look.current.y; look.current.x = 0; look.current.y = 0; i.jump = !!k[" "]; i.slide = !!k.c || !!k.control;
        acc += dt; while (acc >= 1 / 60) { acc -= 1 / 60; step(s, 1 / 60, i); i.swap = 0; i.reload = false; i.slide = false; i.lookX = 0; i.lookY = 0; }
      }
      if (s.ev.length) {
        const ev = s.ev; s.ev = []; r.events(ev); AU.events(ev);
        for (const e of ev) {
          if (e.k === "hit") { hitT.current = 0.15; setHitM(1); } else if (e.k === "hurt") { hurtT.current = 0.4; setHurt(1); if (navigator.vibrate) try { navigator.vibrate(30); } catch (x) {} }
          else if (e.k === "wave") { setBanner(t("คลื่นที่ ", "WAVE ", "第") + e.n + (lang === "zh" ? "波" : "")); bannerT.current = 2.2; { const rl = ra && ra.data.radio.find(x => x.wave === e.n); if (rl) setTimeout(() => { setBanner("📡 " + T3(lang, ...rl.line)); bannerT.current = 4.2; }, 2300); } }
          else if (e.k === "tune") { openQuiz(); if (document.pointerLockElement) try { document.exitPointerLock(); } catch (x) {} }
          else if (e.k === "win") finish(true); else if (e.k === "lose") finish(false);
        }
      }
      if (hitT.current > 0) { hitT.current -= dt; if (hitT.current <= 0) setHitM(0); } if (hurtT.current > 0) { hurtT.current -= dt; if (hurtT.current <= 0) setHurt(0); }
      if (bannerT.current > 0) { bannerT.current -= dt; if (bannerT.current <= 0) setBanner(""); }
      r.draw(s, dt);
      if (high && !pausedRef.current && !s.frozen) { if (dt > 0.031) slow++; else slow = Math.max(0, slow - 1); if (slow > 90) { slow = 0; try { localStorage.setItem("tg_adv_gfx", "standard"); } catch (e) {} setHigh(false); r.setHigh(false); try { logUsage(ra ? "ra" : "ah", "auto-lite"); } catch (e) {} } }
      if (!pausedRef.current && !s.frozen && !s.done) { perf.current.n++; perf.current.t += dt; }
      if (ra && ra.net) { netT += dt; if (netT > 0.2) { netT = 0; try { ra.net.sendPos(s.p.x, s.p.z, s.p.yaw, Math.round(s.p.hp)); r.mates([...ra.net.peers.values()].filter((q: any) => q.tx !== undefined).map((q: any) => ({ id: q.id, x: q.tx, z: q.ty, yaw: q.face || 0, glow: q.glow }))); } catch (e) {} } }
      hudT += dt; if (hudT > 0.1) { hudT = 0; drawMap(mapRef.current, s, s.lv ? "#" + (ra ? ra.data.level : LEVELS[s.lv - 1]).tint.toString(16).padStart(6, "0") : "#ff8a3a", ra && ra.net ? [...ra.net.peers.values()].filter((q: any) => q.tx !== undefined).map((q: any) => ({ x: q.tx, z: q.ty, glow: q.glow })) : []); { const near = s.enemies.filter(e => e.dead === 0 && Math.hypot(e.x - s.p.x, e.z - s.p.z) < 12).length; AU.setIntensity(s.p.hp < 35 || near >= 4 || s.wave >= 4 ? 3 : s.enemies.some(e => e.dead === 0) ? 2 : 1); } const w = s.weapon, a = s.ammo[w]; setHud({ hp: Math.round(s.p.hp), sh: Math.round(s.p.shield), w: s.shopW && s.shopW.as === w ? s.shopW.name : WEAPONS[w].name, coins: s.coins, mag: a.mag, res: w === "pistol" ? "∞" : a.res, wave: s.wave, nw: s.waves.length, boss: (() => { const b = s.enemies.find(e => e.dead === 0 && ALIENS[e.kind].boss); return b ? { n: ra && ra.data.level.bossName ? T3(lang, ...ra.data.level.bossName) : ALIENS[b.kind].name, p: Math.max(0, b.hp / b.max) } : null; })(), left: s.enemies.filter(e => e.dead === 0).length + s.spawnQ.length, score: s.score, streak: s.streak, reload: s.reload > 0, tune: Math.max(0, Math.ceil(s.tuneEvery - s.tuneT)), ts: s.tuneStreak, obj: s.ms ? { label: s.ms.label, peaceful: s.peaceful, type: s.ms.type, prog: s.ms.prog, goal: s.ms.goal, left: Math.max(0, Math.ceil(s.ms.secs - s.ms.t)), phase: s.ms.phase, cur: Math.round(100 * s.ms.items.reduce((m, it) => (it.done ? m : Math.max(m, it.p)), 0)) } : null, boost: s.boost > 0, own: WORDER.filter(w => s.owned[w]).join(","), cur: s.weapon, sl: s.p.slideCd <= 0, au: s.auto, af: s.autoFire, between: s.between > 0 && s.enemies.every(e => e.dead !== 0) }); }
    };
    raf = requestAnimationFrame(loop);
    (window as any).__ah = { s: S.current, get state() { return S.current; }, step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) step(S.current, dt, inp.current); }, info: () => r.info(), killAll: () => { for (const e of S.current.enemies) e.hp = 0, e.dead = 0.5; }, tune: () => { S.current.tuneT = S.current.tuneEvery; }, setHigh: (h: boolean) => { setHigh(h); r.setHigh(h); }, creature: (k: string, m: string) => AU.creature(k, m as any, 3), quizQ: () => quizRef.current && quizRef.current.q, draw: () => r.draw(S.current, 0.016) };
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); r.dispose(); rdr.current = null; try { delete (window as any).__ah; } catch (e) {} };
  }, [phase]);
  useEffect(() => { if (rdr.current) rdr.current.setHigh(high); }, [high]);
  useEffect(() => () => { if (!ra) exitFsAndUnlock(); AU.dispose(); }, []);
  useEffect(() => { if (ra) begin(1); }, []);   // Robot Adventure 3D starts its level straight away
  useEffect(() => { AU.setDucked(paused || !!quiz); }, [paused, !!quiz]);

  /* keyboard + mouse */
  useEffect(() => {
    if (phase !== "play") return undefined;
    const kd = (e: KeyboardEvent) => {
      if (quizRef.current) return; const k = e.key.toLowerCase(); keys.current[k === " " ? " " : k] = true;
      if (k === "r") inp.current.reload = true; if (k === "e") inp.current.dig = true; { if (k === "v") S.current.auto = !S.current.auto; const n = parseInt(k, 10); if (n >= 1 && n <= WORDER.length) setWeapon(S.current, WORDER[n - 1]); }
      if (k === "escape" || k === "p") setPaused(p => !p); if (k === " ") e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k === "e") inp.current.dig = false; keys.current[k === " " ? " " : k] = false; };
    const mm = (e: MouseEvent) => { if (document.pointerLockElement) { look.current.x += e.movementX * 0.0022; look.current.y += e.movementY * 0.0022; } };
    const md = (e: MouseEvent) => { if (e.button === 0 && !quizRef.current && !pausedRef.current) inp.current.fire = true; };
    const mu = (e: MouseEvent) => { if (e.button === 0) inp.current.fire = false; };
    const wh = (e: WheelEvent) => { if (!quizRef.current) { const own = WORDER.filter(w => S.current.owned[w]); setWeapon(S.current, own[(own.indexOf(S.current.weapon) + (e.deltaY > 0 ? 1 : own.length - 1)) % own.length]); } };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("mousemove", mm); window.addEventListener("mousedown", md); window.addEventListener("mouseup", mu); window.addEventListener("wheel", wh);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("mousemove", mm); window.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu); window.removeEventListener("wheel", wh); keys.current = {}; inp.current.fire = false; };
  }, [phase]);

  /* touch: the left third is a stick, the rest drags to aim */
  const tdown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return; const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect();
    if (e.pointerType === "mouse") { if (!document.pointerLockElement && !paused && !quiz) try { (rdr.current && rdr.current.canvas.requestPointerLock) && rdr.current.canvas.requestPointerLock(); } catch (x) {} return; }
    try { el.setPointerCapture(e.pointerId); } catch (x) {}
    if (e.clientX - r.left < r.width * 0.38 && stick.current.id < 0) stick.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, mx: 0, mz: 0 }; else if (lookId.current < 0) lookId.current = e.pointerId;
  };
  const tmove = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    if (e.pointerId === stick.current.id) { const dx = (e.clientX - stick.current.x0) / 60, dz = (e.clientY - stick.current.y0) / 60, L = Math.hypot(dx, dz) || 1, k = Math.min(1, L) / L; stick.current.mx = dx * k; stick.current.mz = -dz * k; setHud((h: any) => ({ ...h, jx: stick.current.mx, jz: stick.current.mz })); }
    else if (e.pointerId === lookId.current) { look.current.x += (e.movementX || 0) * 0.005; look.current.y += (e.movementY || 0) * 0.005; }
  };
  const tup = (e: React.PointerEvent) => { if (e.pointerId === stick.current.id) { stick.current = { id: -1, x0: 0, y0: 0, mx: 0, mz: 0 }; setHud((h: any) => ({ ...h, jx: 0, jz: 0 })); } if (e.pointerId === lookId.current) lookId.current = -1; };
  const hold = (f: (v: boolean) => void) => ({ onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); try { (e.currentTarget as any).setPointerCapture(e.pointerId); } catch (x) {} f(true); }, onPointerUp: () => f(false), onPointerCancel: () => f(false), onPointerLeave: () => f(false) });

  /* the tune-up question */
  const openQuiz = () => {
    inp.current.fire = false; inp.current.reload = false; keys.current = {}; stick.current = { id: -1, x0: 0, y0: 0, mx: 0, mz: 0 }; lookId.current = -1; look.current = { x: 0, y: 0 }; AU.setDucked(true);
    const nq = nextQuestion(lang as any, { done: readDone() }); setQuiz({ q: nq.q, phase: "gate", ok: null, sel: [], armed: false, lit: 0 });
    setTimeout(() => setQuiz(c => (c && c.phase === "gate" ? { ...c, armed: true } : c)), 900);
  };
  const answer = (ok: boolean, patch?: Partial<Quiz>) => {
    const c = quizRef.current; if (!c || c.phase !== "ask") return; recordAnswer(ok, c.q.topic); tuneLog.current.push({ topic: c.q.topic, ok }); AU.sfx(ok ? "tuneok" : "tunebad");
    if (ok) { try { addRpgExp(me, 10 + 6 * c.q.tier + (S.current.tuneStreak >= 2 ? 6 : 0)); } catch (e) {} }
    setQuiz({ ...c, ...patch, phase: "done", ok, lit: ok ? c.q.teach.lit.length : 0 });
    if (!ok) { const n = c.q.teach.lit.length; let i = 0; const id = setInterval(() => { i++; setQuiz(q => (q ? { ...q, lit: Math.min(n, i) } : q)); if (i >= n) clearInterval(id); }, 450); }
  };
  const resume = (skipped = false) => {
    const c = quizRef.current; if (!c) return; answerTune(S.current, skipped ? false : !!c.ok); AU.setDucked(false); AU.sfx("go"); setQuiz(null); setBanner(t("เตรียมสู้!", "GET READY", "准备")); bannerT.current = 1.2;
    try { logUsage(ra ? "ra" : "ah", `tune:${c.q.topic}:${skipped ? "skip" : c.ok ? "ok" : "bad"}`); } catch (e) {}
  };
  const tapKey = (pc: number, idx: number) => {
    const c = quizRef.current; if (!c || c.phase !== "ask") return; const q = c.q;
    if (q.kind === "key") answer(judgeKeys(q, [pc]), { sel: [pc], selK: [idx] });
    else { const sk = c.selK || []; const nk = sk.includes(idx) ? sk.filter(x => x !== idx) : [...sk, idx]; setQuiz({ ...c, selK: nk, sel: Array.from(new Set(nk.map(k => k % 12))) }); }
  };

    const close = () => { if (ra) { ra.onBack(); return; } exitFsAndUnlock(); onBack(); };

  const pad = phase === "play";
  const q = quiz && quiz.q;
  return (
    <div className="ah-root" data-ah={phase}>
      <style>{CSS}</style>
      {powerNeed != null && <PowerSheet lang={lang} need={powerNeed} onClose={() => { setPowerNeed(null); if (ra && phaseRef.current !== "play") ra.onBack(); }} />}
      {phase === "ready" && ra && <div className="ah-ready" data-ra-loading="1" />}
      {phase === "ready" && !ra && (
        <div className={"ah-ready ah-mapscr" + (portrait ? " rot" : "")} data-levels-screen="1">
          <button className="ah-x" onClick={close} aria-label="close">✕</button>
          <div className="ah-mhead"><h1>ALIEN HUNT</h1><span>{t("เลือกด่าน · เล่นเรียงจาก 1 ไป 10", "Choose a stage · play them in order, 1 to 10", "选择关卡 · 按 1 到 10 顺序通关")}</span></div>
          <div className="ah-sky" data-levels="1">
            <svg className="ah-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{LEVELS.slice(1).map((L, k) => { const a = PLANET_POS[k], b = PLANET_POS[k + 1], done = unlockAll || L.id <= camp.cleared + 1; return <path key={L.id} d={`M${a[0]} ${a[1]} Q${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + (k % 2 ? 9 : -9)} ${b[0]} ${b[1]}`} fill="none" vectorEffect="non-scaling-stroke" stroke={done ? "#7affb0" : "#ffffff44"} strokeWidth="2.5" strokeDasharray={done ? "0" : "5 6"} />; })}</svg>
            {LEVELS.map(L => { const open = unlockAll || L.id <= camp.cleared + 1, st = camp.stars[L.id - 1] | 0, c = "#" + L.tint.toString(16).padStart(6, "0"), pos = PLANET_POS[L.id - 1], cleared = L.id <= camp.cleared, size = 40 + (L.id * 7) % 5 * 5 + (L.boss ? 10 : 0); return (
              <button key={L.id} data-lv={L.id} disabled={!open} className={"ah-pl" + (open ? "" : " lock") + (L.id === camp.cleared + 1 ? " next" : "") + (cleared ? " clr" : "") + (L.boss ? " boss" : "")} style={{ left: pos[0] + "%", top: pos[1] + "%", ["--c" as any]: c, ["--s" as any]: size + "px" }} onClick={() => begin(L.id)}>
                <i className="ah-ball"><img className="ah-orb" alt="" src={orbPic("ah" + L.id, "#" + (L.tint as number).toString(16).padStart(6, "0"), "#ffffff")} />{open ? <b>{L.id}</b> : <b>🔒</b>}{cleared ? <em>✓</em> : null}</i>
                <span>{T3(lang, ...L.name)}</span><u>{"★".repeat(st)}{"☆".repeat(3 - st)}</u>{L.boss ? <s>BOSS</s> : null}
              </button>); })}
          </div>
          <div className="ah-mfoot">
            <div className="ah-opt"><b>{t("กราฟิก", "Graphics", "画质")}</b>{[true, false].map(h => <button key={String(h)} className={high === h ? "on" : ""} onClick={() => { try { localStorage.setItem("tg_adv_gfx", h ? "high" : "standard"); } catch (e) {} setHigh(h); }} data-gfx={h ? "high" : "lite"}>{h ? "High" : "Lite"}</button>)}</div>
            <div className="ah-opt"><b>{t("เสียง", "Sound", "声音")}</b>{[true, false].map(v => <button key={String(v)} className={snd === v ? "on" : ""} data-snd={v ? "on" : "off"} onClick={() => { setSnd(v); AU.setSoundOn(v); }}>{v ? "ON" : "OFF"}</button>)}</div>
            <p className="ah-note" data-learned={learned.length}>{learned.length ? t("คำถามมาจากเรื่องที่เรียนแล้ว: ", "Questions come from what you learned: ", "问题来自已学内容：") + learned.join(" · ") : t("ยังไม่มีเรื่องที่เรียนแล้ว จึงยังไม่มีคำถามในเกม — ไปเรียนที่ My Class", "Nothing learned yet, so no questions — learn in My Class first.", "还没有学过的内容，暂无问题——先去 My Class 学习。")}</p>
            <button className="ah-ghost" data-start="1" onClick={() => begin(0)}>{t("โหมดคลาสสิก 5 คลื่น", "Classic · 5 waves", "经典 · 5波")}</button>
          </div>
        </div>
      )}
      {pad && (
        <div className="ah-play" onPointerDown={tdown} onPointerMove={tmove} onPointerUp={tup} onPointerCancel={tup}>
          <div className="ah-host" ref={host} />
          <div className={"ah-vig" + (hurt ? " on" : "")} />
          <div className={"ah-cross" + (hitM ? " hit" : "")}><i /><i /><i /><i /></div>
          <div className="ah-top">
            <div className="ah-wave" style={hud.obj && hud.obj.peaceful ? { display: "none" } : undefined}><b>{t("คลื่น", "WAVE", "波")} {hud.wave || 0}/{hud.nw || CLASSIC_WAVES.length}</b><span>{hud.between ? t("เตรียมตัว…", "get ready…", "准备…") : (hud.left ?? 0) + " " + t("ตัวเหลือ", "left", "剩余")}</span></div>
            <div className={"ah-tune" + ((hud.tune || 99) <= 3 ? " soon" : "")} data-tunechip="1"><b>♪ {hud.tune ?? 15}s</b>{(hud.ts || 0) > 0 && <span>TUNE ×{hud.ts}</span>}</div>
            <div className="ah-score"><b>{(hud.score || 0).toLocaleString()}</b><span data-coins="1">🪙 {hud.coins || 0}</span>{(hud.streak || 0) >= 3 && <span>🔥 {hud.streak}</span>}</div>
            <button className="ah-gear" aria-label="pause" data-pause-btn="1" onClick={() => setPaused(true)}>⚙</button>
          </div>
          <div className="ah-bars"><div className="ah-hp"><i style={{ width: (hud.hp ?? 100) + "%" }} />{(hud.sh || 0) > 0 && <u style={{ width: Math.min(50, hud.sh) * 2 + "%" }} />}</div><span>❤ {hud.hp ?? 100}{(hud.sh || 0) > 0 ? " 🛡 " + hud.sh : ""}{hud.boost ? " ⚡" : ""}</span></div>
          <div className="ah-chips" data-chips="1">{(hud.own || "pistol").split(",").map((w: string) => <button key={w} data-wpn={w} className={hud.cur === w ? "on" : ""} onPointerDown={e => { e.stopPropagation(); setWeapon(S.current, w as WeaponId); }}>{(WORDER.indexOf(w as WeaponId) + 1)}<i>{WEAPONS[w as WeaponId].name}</i></button>)}</div>
          <div className="ah-ammo"><small>{hud.w}</small><b>{hud.reload ? "…" : hud.mag}</b><span>/ {hud.res}</span></div>
          {hud.obj && !quiz && <div className="ah-obj" data-obj={hud.obj.type}>{hud.obj.type === "survive" ? "⏱ " + t("ยืนหยัดอีก ", "Hold out ", "坚守 ") + hud.obj.left + t(" วินาที", " s", " 秒")
            : hud.obj.type === "task" ? "🔧 " + (hud.obj.label ? T3(lang, ...hud.obj.label) : t("ภารกิจ", "Task", "任务")) + " " + hud.obj.prog + "/" + hud.obj.goal + t(" — เดินเข้าวงเรืองแสงแล้วตอบคำถาม", " — walk into a glowing pad and answer", " — 走进发光圈并回答问题")
            : hud.obj.type === "mine" ? "⛏ " + t("แร่ ", "Ore ", "矿 ") + hud.obj.prog + "/" + hud.obj.goal + t(" — ยืนใกล้ก้อนแร่แล้วกด ⛏", " — stand by a node and press ⛏", " — 站在矿点旁按 ⛏")
            : hud.obj.phase === 1 ? "☄ " + t("ผู้บัญชาการลงมาแล้ว ปราบมัน!", "The commander has landed. Take it down!", "指挥官降落了，击败它！")
            : (hud.obj.type === "strike" ? "📡 " + t("เครื่องส่งสัญญาณ ", "Terminals ", "终端 ") : "⚡ " + t("สถานี ", "Stations ", "站点 ")) + hud.obj.prog + "/" + hud.obj.goal + (hud.obj.cur > 0 ? " · " + hud.obj.cur + "%" : "") + t(" — ยืนในวงให้ครบ", " — stand in the ring", " — 站在圈内")}</div>}
          {banner && !quiz && <div className="ah-banner">{banner}</div>}
          {hud.boss && <div className="ah-boss" data-boss="1"><b>{hud.boss.n}</b><div><i style={{ width: Math.round(hud.boss.p * 100) + "%" }} /></div></div>}
          <canvas className="ah-map" data-map="1" width={240} height={240} ref={mapRef} />
          <div className="ah-stick" style={{ transform: `translate(${(hud.jx || 0) * 22}px, ${-(hud.jz || 0) * 22}px)` }} />
          <div className="ah-btns">
            <button className="fire" aria-label="fire" data-fire="1" {...hold(v => { inp.current.fire = v; if (!v) fireId.current = -1; })} onPointerDown={e => { e.stopPropagation(); fireId.current = e.pointerId; try { (e.currentTarget as any).setPointerCapture(e.pointerId); } catch (x) {} inp.current.fire = true; }} onPointerMove={e => { if (e.pointerId === fireId.current) { look.current.x += (e.movementX || 0) * 0.005; look.current.y += (e.movementY || 0) * 0.005; } }}>FIRE</button>
            {hud.obj && hud.obj.type === "mine" && <button aria-label="dig" data-dig="1" className="dig" {...hold(v => { inp.current.dig = v; })}>⛏</button>}
            <button aria-label="reload" {...hold(v => { if (v) inp.current.reload = true; })}>R</button>
            <button aria-label="jump" data-jump="1" {...hold(v => { keys.current[" "] = v; })}>⤴</button>
            <button aria-label="slide" data-slide="1" className={hud.sl === false ? "cool" : ""} {...hold(v => { keys.current.c = v; })}>⇊</button>
          </div>
        </div>
      )}
      {paused && phase === "play" && !quiz && (
        <div className="ah-pause" data-pause="1"><div className="ah-card">
          <b>{t("พักเกม", "PAUSED", "已暂停")}</b>
          <button className="ah-go" onClick={() => setPaused(false)} data-resume="1">{t("เล่นต่อ", "Resume", "继续")}</button>
          <div className="ah-opt"><b>{t("เดินอัตโนมัติ", "Auto walk", "自动移动")}</b>{[true, false].map(v => <button key={String(v)} data-auto={v ? "on" : "off"} className={S.current.auto === v ? "on" : ""} onClick={() => { S.current.auto = v; setSwTick(n => n + 1); }}>{v ? "ON" : "OFF"}</button>)}</div>
          <div className="ah-opt"><b>{t("ยิงอัตโนมัติ", "Auto shoot", "自动射击")}</b>{[true, false].map(v => <button key={String(v)} data-afire={v ? "on" : "off"} className={S.current.autoFire === v ? "on" : ""} onClick={() => { S.current.autoFire = v; setSwTick(n => n + 1); }}>{v ? "ON" : "OFF"}</button>)}</div>
          <div className="ah-opt">{[true, false].map(h => <button key={String(h)} className={high === h ? "on" : ""} onClick={() => { try { localStorage.setItem("tg_adv_gfx", h ? "high" : "standard"); } catch (e) {} setHigh(h); }}>{h ? "High" : "Lite"}</button>)}</div>
          <button className="ah-ghost" onClick={() => finish(false, true)}>{t("จบภารกิจ", "Leave mission", "结束任务")}</button>
        </div></div>
      )}
      {quiz && q && (
        <div className="ah-quiz" data-tuneup="1" onPointerDown={e => e.stopPropagation()}>
          {quiz.phase === "gate" ? (
            <div className="ah-card">
              <span className="ah-ic">✋</span><em>{t("จูนอัพ · เกมหยุดอยู่", "TUNE-UP · FIGHT FROZEN", "调音时刻 · 战斗暂停")}</em><b>{t("ยกมือออกจากปุ่มก่อน", "HANDS OFF", "先放开手")}</b>
              <p>{t("ปล่อยปุ่มทุกปุ่ม หายใจสักครั้ง แล้วกดพร้อม", "Let go of every control, take a breath, then press ready.", "松开所有按键，喘口气，再按准备。")}</p>
              <button className={"ah-go" + (quiz.armed ? "" : " dim")} disabled={!quiz.armed} data-ready="1" onClick={() => setQuiz({ ...quiz, phase: "ask" })}>{quiz.armed ? t("พร้อมแล้ว", "I'M READY", "我准备好了") : t("เตรียมตัว…", "GET READY…", "准备中…")}</button>
            </div>
          ) : (
            <div className="ah-card wide">
              <div className="ah-qh"><em>{t("จูนอัพ", "TUNE-UP", "调音")} · {q.topic.toUpperCase()} · L{readLadder().lvl}</em></div>
              <b className="ah-q" data-q="1">{q.q}</b>
              {q.kind === "choice" && q.opts && <div className="ah-opts">{q.opts.map((o, i) => <button key={i} disabled={quiz.phase === "done"} className={quiz.phase === "done" ? (o.ok ? "good" : "") : ""} data-opt={o.ok ? "ok" : "no"} onClick={() => answer(o.ok)}>{o.label}</button>)}</div>}
              {(q.kind !== "choice" || quiz.phase === "done") && (() => {
                const done = quiz.phase === "done", tl = q.teach.lit.slice(0, done ? quiz.lit : 0).map(parseNote).filter(Boolean) as { key: number }[], litK = tl.map(x => x.key), selK = quiz.selK || [];
                const staffK = done ? (quiz.ok ? q.teach.lit.map(parseNote).filter(Boolean).map(x => (x as any).key as number) : litK) : selK.slice().sort((a, b) => a - b);
                const cls = (k: number, base: string) => base + (selK.includes(k) ? " sel" : "") + (done && (quiz.ok ? q.teach.lit.map(parseNote).some(x => x && x.key === k) : litK.includes(k)) ? " lit" : "");
                return <>
                  <QStaff notes={staffK.map(k => keyToStaffNamed(k, (q.teach as any).names))} hot={done} />
                  {q.kind === "choice" ? null : null}
                  <div className="ah-piano" data-piano="1" data-oct="2">
                    {[0, 1].flatMap(o => WHITE2.map((pc, i) => { const k = o * 12 + pc; return <button key={k} data-pc={pc} data-k={k} className={cls(k, "w")} style={{ left: (o * 7 + i) * (100 / 14) + "%" }} disabled={q.kind === "choice"} onClick={() => tapKey(pc, k)}><span>{o === 0 && pc === 0 ? "C4" : o === 1 && pc === 0 ? "C5" : (((q.teach as any).names && (q.teach as any).names[pc]) ? prettyName((q.teach as any).names[pc]) : PCN[pc])}</span></button>; }))}
                    {[0, 1].flatMap(o => BLACK2.map(([pc, wi]) => { const k = o * 12 + pc; return <button key={k} data-pc={pc} data-k={k} className={cls(k, "b")} style={{ left: ((o * 7 + wi + 1) * (100 / 14)) + "%" }} disabled={q.kind === "choice"} onClick={() => tapKey(pc, k)}><span>{((q.teach as any).names && (q.teach as any).names[pc]) ? prettyName((q.teach as any).names[pc]) : PCN[pc]}</span></button>; }))}
                  </div>
                </>;
              })()}
              {quiz.phase === "ask" && q.kind === "keys" && <button className="ah-go" data-check="1" disabled={!quiz.sel.length} onClick={() => answer(judgeKeys(q, quiz.sel))}>{t("ตรวจ", "CHECK", "检查")}</button>}
              {quiz.phase === "done" && <div className={"ah-verdict " + (quiz.ok ? "good" : "bad")} data-verdict={quiz.ok ? "good" : "bad"}>
                <b>{quiz.ok ? t("ถูก! ได้โล่ + กระสุนเต็ม", "RIGHT! Shield + full reload", "答对！护盾+满弹药") : t("ยังไม่ใช่ — ดูคีย์ที่ถูกต้อง", "Not quite — watch the right keys", "不对——看正确的键")}</b>
                {!quiz.ok && <span>{q.teach.why}</span>}
                <button className="ah-go" data-continue="1" onClick={() => resume(false)}>{t("สู้ต่อ", "BACK TO THE FIGHT", "继续战斗")}</button>
              </div>}
            </div>
          )}
        </div>
      )}
      {phase === "result" && res && (
        <div className="ah-ready" data-result="1">
          <em>{res.won ? t("ภารกิจสำเร็จ", "MISSION COMPLETE", "任务完成") : t("ภารกิจล้มเหลว", "MISSION FAILED", "任务失败")}</em>
          <h1>{"★".repeat(res.stars)}{"☆".repeat(3 - res.stars)}</h1>
          <div className="ah-stats"><span><b>{res.kills}</b>{t("เอเลี่ยนที่ล้ม", "aliens down", "击杀")}</span><span><b>{res.acc}%</b>{t("แม่นยำ", "accuracy", "命中")}</span><span><b>{res.heads}</b>{t("หัว", "headshots", "爆头")}</span><span><b>{res.right}/{res.tunes}</b>{t("ตอบถูก", "tune-ups right", "答对")}</span><span><b>{res.score.toLocaleString()}</b>{t("คะแนน", "score", "得分")}</span></div>
          {res.per && Object.keys(res.per).length > 0 && <div className="ah-stats" data-report="1">{Object.keys(res.per).map(k => <span key={k}><b>{res.per[k][0]}/{res.per[k][1]}</b>{k}</span>)}</div>}
          <p>+{res.cry} ◆ · +{res.exp} EXP · +{res.coinsPaid || 0} 🪙{res.coinsWant > (res.coinsPaid || 0) ? t(" (ครบเพดานวันนี้)", " (daily limit)", "（今日上限）") : ""}</p>
          {res.lv > 0 && res.newGuns && res.newGuns.length > 0 && <p data-newguns="1">{t("ได้ปืนใหม่: ", "New guns: ", "新枪：")}{res.newGuns.join(", ")}</p>}
          {res.ra && res.won && ra && <p data-radio="1">📡 {T3(lang, ...ra.data.win)}</p>}
          {!res.ra && res.won && res.lv > 0 && res.lv < LEVELS.length && <button className="ah-go" data-next="1" onClick={() => begin(res.lv + 1)}>{t("ด่านต่อไป", "NEXT LEVEL", "下一关")}</button>}
          {res.ra && res.won && ra && ra.onNext && ra.hasNext && ra.hasNext() && <button className="ah-next" data-next-map="1" onClick={() => ra.onNext && ra.onNext()}>{t("แผนที่ถัดไป", "NEXT MAP", "下一张地图")} ▶</button>}
          <button className={!res.ra && res.won && res.lv > 0 && res.lv < LEVELS.length ? "ah-ghost" : "ah-go"} onClick={() => begin(res.lv || 0)}>{t("เล่นอีกครั้ง", "PLAY AGAIN", "再玩一次")}</button>{res.ra ? <button className="ah-ghost" data-ra-map="1" onClick={close}>{t("กลับแผนที่", "Back to the map", "回到地图")}</button> : <button className="ah-ghost" onClick={() => { setPhase("ready"); }}>{t("เลือกด่าน", "Levels", "选关")}</button>}<button className="ah-ghost" onClick={close}>{t("กลับ", "Back", "返回")}</button>
        </div>
      )}
    </div>
  );
}

const CSS = `
.ah-root{position:fixed;inset:0;z-index:2450;background:#07060c;color:#fff;font-family:system-ui,-apple-system,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}
.ah-root button{font:inherit;color:inherit;cursor:pointer}
.ah-ready{position:absolute;inset:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;background:radial-gradient(120% 90% at 50% 20%,#4a2744 0,#1a1020 55%,#07060c 100%)}
.ah-ready em,.ah-card em{font-style:normal;font-size:11px;letter-spacing:.2em;color:#ffb06a;font-weight:800}
.ah-ready h1{margin:0;font-size:clamp(34px,8vw,64px);letter-spacing:.12em;font-weight:900;color:#ff6a3a;text-shadow:0 0 28px #ff6a3a88}
.ah-ready p{max-width:560px;margin:0;font-size:13.5px;line-height:1.5;opacity:.88}
.ah-x{position:absolute;top:12px;left:12px;width:40px;height:40px;border-radius:50%;border:1px solid #ffffff44;background:#0008;font-size:16px}
.ah-keys{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}.ah-keys span{padding:4px 10px;border-radius:999px;background:#ffffff14;font-size:11.5px}
.ah-opt{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;font-size:12px}.ah-opt button{min-width:52px;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid #ffffff44;background:#ffffff10;font-weight:700}.ah-opt button.on{background:#ff6a3a;border-color:#ff6a3a;color:#1a0a04}
.ah-go{min-height:50px;padding:0 30px;border-radius:999px;border:0;background:linear-gradient(135deg,#ff8a3a,#ff4a2a);color:#1a0a04;font-weight:900;letter-spacing:.08em;font-size:15px;box-shadow:0 8px 22px -8px #ff6a3a}.ah-go.dim,.ah-go:disabled{opacity:.4}
.ah-next{min-height:50px;padding:0 30px;border-radius:999px;border:1px solid #e9b8ff;background:linear-gradient(135deg,#b44dff,#7a2cff);color:#fff;font-weight:900;letter-spacing:.08em;font-size:15px;box-shadow:0 0 14px #b44dffcc,0 0 34px #8a3cff88,inset 0 0 10px #ffffff44;text-shadow:0 0 8px #fff8;animation:ahnx 1.8s ease-in-out infinite}@keyframes ahnx{50%{box-shadow:0 0 22px #d27bff,0 0 52px #9a4cff,inset 0 0 12px #ffffff66}}@media (prefers-reduced-motion:reduce){.ah-next{animation:none}}
.ah-ghost{min-height:40px;padding:0 20px;border-radius:999px;border:1px solid #ffffff55;background:transparent;font-weight:700}
.ah-lvgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;width:min(860px,96vw)}
.ah-lv{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;padding:8px 6px;border-radius:14px;border:1px solid color-mix(in srgb,var(--c) 60%,#fff2);background:linear-gradient(180deg,color-mix(in srgb,var(--c) 22%,#0b0a12),#0b0a12);min-width:0}
.ah-lv b{font-size:18px;color:var(--c)}.ah-lv span{font-size:11px;font-weight:800;line-height:1.2}.ah-lv i{font-style:normal;font-size:9.5px;opacity:.7}.ah-lv u{text-decoration:none;font-size:11px;color:#ffd34a}
.ah-lv.next{box-shadow:0 0 0 2px var(--c),0 0 18px var(--c);animation:ahp .8s infinite alternate}.ah-lv.lock{opacity:.4}.ah-lv s{position:absolute;top:3px;right:5px;text-decoration:none;font-size:8px;font-weight:900;color:#ff6a6a;letter-spacing:.1em}
.ah-boss{position:absolute;top:58px;left:50%;transform:translateX(-50%);width:min(360px,60vw);pointer-events:none;text-align:center}.ah-boss b{font-size:12px;letter-spacing:.14em;text-shadow:0 0 6px #000}.ah-boss div{height:10px;border-radius:99px;background:#0009;border:1px solid #ff6a8a88;overflow:hidden}.ah-boss i{display:block;height:100%;background:linear-gradient(90deg,#ff3a6a,#ff8a3a)}
@media (max-width:640px){.ah-lvgrid{grid-template-columns:repeat(3,minmax(0,1fr))}}

.ah-mapscr{justify-content:flex-start;align-items:stretch;gap:4px;padding:8px 12px 6px;overflow:hidden;background:radial-gradient(90% 120% at 20% 10%,#2a1850 0,#0d0a1c 55%,#05030a 100%)}
.ah-mapscr:before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1px 1px at 12% 20%,#fff9,transparent),radial-gradient(1px 1px at 37% 70%,#fff8,transparent),radial-gradient(1.5px 1.5px at 62% 15%,#fffc,transparent),radial-gradient(1px 1px at 81% 55%,#fff9,transparent),radial-gradient(1px 1px at 92% 85%,#fff8,transparent),radial-gradient(1px 1px at 25% 90%,#fff7,transparent),radial-gradient(1.5px 1.5px at 50% 45%,#fff8,transparent),radial-gradient(1px 1px at 70% 92%,#fff9,transparent)}
.ah-mapscr.rot{inset:auto;top:0;left:100%;width:100vh;height:100vw;transform-origin:0 0;transform:rotate(90deg)}
.ah-mhead{display:flex;align-items:baseline;gap:12px;padding-left:52px;min-height:38px}.ah-mhead h1{font-size:clamp(22px,5vh,34px);margin:0}.ah-mhead span{font-size:12px;opacity:.8}
.ah-sky{position:relative;flex:1;min-height:0}.ah-route{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.ah-pl{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:1px;background:none;border:0;padding:0;width:78px;min-width:0}
.ah-ball{position:relative;display:flex;align-items:center;justify-content:center;width:var(--s);height:var(--s);border-radius:50%;background:none;box-shadow:none}
.ah-orb{position:absolute;inset:-14%;width:128%;height:128%;max-width:none;pointer-events:none;filter:drop-shadow(0 0 8px var(--c))}.ah-ball b{position:relative;z-index:1;font-size:calc(var(--s) * .42);color:#fff;text-shadow:0 1px 4px #000,0 0 6px #000}.ah-ball em{position:absolute;right:-4px;top:-4px;width:18px;height:18px;border-radius:50%;background:#2ad07a;color:#04210f;font-style:normal;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center}
.ah-pl span{font-size:10.5px;font-weight:800;line-height:1.15;text-align:center;text-shadow:0 1px 3px #000}.ah-pl u{text-decoration:none;font-size:10px;color:#ffd34a}.ah-pl s{position:absolute;top:-8px;left:50%;transform:translateX(-50%);text-decoration:none;font-size:8px;font-weight:900;letter-spacing:.12em;color:#ff6a8a;background:#000a;border-radius:99px;padding:0 5px}
.ah-pl.next .ah-ball{animation:ahp .8s infinite alternate;box-shadow:none}.ah-pl.next .ah-orb{filter:drop-shadow(0 0 14px #fff)}.ah-pl.lock{opacity:.45}.ah-pl.lock .ah-ball{filter:grayscale(.7)}.ah-pl.boss .ah-orb{filter:drop-shadow(0 0 10px #ff4a7a)}
.ah-mfoot{position:relative;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;min-height:42px}.ah-mfoot .ah-note{margin:0;max-width:340px;font-size:10.5px;line-height:1.25}.ah-mfoot .ah-ghost{min-height:34px;padding:0 14px;font-size:12px}.ah-mfoot .ah-opt button{min-width:44px;min-height:30px;padding:0 9px}
.ah-play{position:absolute;inset:0}.ah-host{position:absolute;inset:0}.ah-cv{display:block;width:100%;height:100%}
.ah-vig{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at center,transparent 45%,#ff1a1acc 100%)}.ah-vig.on{opacity:1}
.ah-cross{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none}.ah-cross i{position:absolute;background:#fff;box-shadow:0 0 3px #000}
.ah-cross i:nth-child(1){left:-1px;top:-14px;width:2px;height:8px}.ah-cross i:nth-child(2){left:-1px;top:6px;width:2px;height:8px}.ah-cross i:nth-child(3){left:-14px;top:-1px;width:8px;height:2px}.ah-cross i:nth-child(4){left:6px;top:-1px;width:8px;height:2px}
.ah-cross.hit i{background:#ff4a3a;transform:scale(1.4)}
.ah-top{position:absolute;top:8px;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;padding:0 12px;pointer-events:none}
.ah-top>*{pointer-events:none}.ah-top .ah-gear{pointer-events:auto}
.ah-wave,.ah-tune,.ah-score{display:flex;flex-direction:column;padding:6px 12px;border-radius:14px;background:#0009;border:1px solid #ffffff22;font-size:11px}.ah-wave b,.ah-tune b,.ah-score b{font-size:15px}
.ah-tune{border-color:#7ae0ff88;color:#aef}.ah-tune.soon{border-color:#ffb06a;color:#ffd9a8;animation:ahp .6s infinite alternate}.ah-tune span{color:#ffd34a;font-weight:800}
@keyframes ahp{to{box-shadow:0 0 14px #ffb06a}}
.ah-gear{width:42px;height:42px;border-radius:50%;border:1px solid #ffffff55;background:#000a;font-size:18px;margin-right:128px}
.ah-bars{position:absolute;left:12px;bottom:12px;pointer-events:none}.ah-bars span{font-size:12px;font-weight:800}
.ah-hp{position:relative;width:min(220px,40vw);height:12px;border-radius:99px;background:#0009;border:1px solid #ffffff44;overflow:hidden;margin-bottom:3px}.ah-hp i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#e83a3a,#ff8a5a)}.ah-hp u{position:absolute;left:0;top:0;height:4px;background:#5ac8ff}
.ah-chips{position:absolute;left:50%;transform:translateX(-50%);bottom:8px;display:flex;gap:4px;flex-wrap:nowrap;justify-content:center;max-width:50vw}.ah-chips button{min-height:30px;min-width:30px;padding:0 8px;justify-content:center;border-radius:999px;border:1px solid #ffffff44;background:#000a;font-size:12px;font-weight:800;display:flex;align-items:center;gap:5px}.ah-chips button i{display:none;font-style:normal;font-weight:600;font-size:10px;opacity:.85}.ah-chips button.on i{display:inline}.ah-chips button.on{border-color:#58e8ff;background:#0a3a4aaa;box-shadow:0 0 10px #58e8ff66}.ah-btns .cool{opacity:.4}.ah-btns .on{background:#2fae6acc;border-color:#6af0a6;box-shadow:0 0 12px #6af0a6aa}.ah-btns button[data-auto]{font-size:11px}
.ah-ammo{position:absolute;right:190px;bottom:14px;text-align:right;pointer-events:none;text-shadow:0 2px 6px #000}.ah-ammo small{display:block;font-size:11px;opacity:.8}.ah-ammo b{font-size:34px}.ah-ammo span{font-size:15px;opacity:.8}
.ah-banner{position:absolute;left:0;right:0;top:14%;text-align:center;font-size:clamp(16px,3.6vw,30px);font-weight:900;letter-spacing:.14em;color:#ffb06a;text-shadow:0 0 22px #ff6a3a;pointer-events:none}
.ah-auto{position:absolute;left:max(8px,calc(11% - 62px));bottom:calc(20% + 38px);width:52px;height:52px;border-radius:50%;border:2px solid #ffffff66;background:#0009;font-weight:900;font-size:12px}.ah-afire{left:calc(max(8px,calc(11% - 62px)) + 58px);font-size:10px}.ah-jumpl{position:absolute;left:calc(11% + 46px);bottom:calc(20% - 28px);width:56px;height:56px;border-radius:50%;border:2px solid #ffffff66;background:#0009;font-weight:900;font-size:20px;color:#fff}.ah-auto.on{background:#2ad07acc;border-color:#7affb0;color:#04210f}
.ah-map{position:absolute;right:10px;top:8px;width:116px;height:116px;border-radius:10px;pointer-events:none}
.ah-stick{position:absolute;left:11%;bottom:20%;width:56px;height:56px;margin:-28px;border-radius:50%;background:#ffffff22;border:2px solid #ffffff55;pointer-events:none}
.ah-btns{position:absolute;right:12px;bottom:12px;display:grid;grid-template-columns:repeat(3,52px);grid-auto-rows:52px;gap:8px;direction:rtl}.ah-btns button{width:52px;height:52px;border-radius:50%;border:2px solid #ffffff66;background:#0009;font-weight:900;font-size:13px;direction:ltr}
.ah-btns .fire{grid-column:span 1;width:64px;height:64px;margin:-6px;border-color:#ff6a3a;background:#ff4a2a99}
.ah-quiz{overflow:auto}.ah-pause,.ah-quiz{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#05030acc;backdrop-filter:blur(5px);z-index:5;padding:10px}
.ah-card{display:flex;flex-direction:column;align-items:center;gap:9px;max-width:min(560px,94vw);max-height:96vh;overflow:auto;padding:16px 20px;border-radius:26px;background:linear-gradient(160deg,#241a32,#120c1c);border:1px solid #ffffff2a;text-align:center}.ah-card.wide{width:min(720px,96vw)}
.ah-card p{margin:0;font-size:13px;opacity:.85}.ah-ic{font-size:30px}.ah-q{font-size:clamp(16px,3.4vw,22px);line-height:1.35}
.ah-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:6px;width:100%}.ah-opts button{min-height:35px;border-radius:12px;border:1px solid #ffffff44;background:#ffffff12;font-weight:700;padding:4px 7px;font-size:.7em}.ah-opts button.good{background:#2fae6a;border-color:#2fae6a}
.ah-piano{position:relative;width:min(560px,92vw);height:clamp(70px,18vh,110px)}.ah-piano button{position:absolute;border:1px solid #222;border-radius:0 0 8px 8px;padding:0;display:flex;align-items:flex-end;justify-content:center}
.ah-staff{width:min(720px,92vw);height:clamp(105px,30vh,156px);color:#f1ecff;background:#ffffff14;border-radius:12px}.ah-staff .hot{color:#ffb347;filter:drop-shadow(0 0 4px #ff8a3a)}
.ah-piano .w{top:0;width:calc(100% / 14);height:100%;background:#f4f1ea;color:#222}.ah-piano .b{top:0;width:4.2%;height:62%;background:#17151c;color:#ddd;z-index:2;margin-left:-2.1%}.ah-piano span{font-size:8.5px;font-weight:800;padding-bottom:4px}
.ah-piano .sel{background:#ff8a3a!important;color:#1a0a04}.ah-piano .lit{background:#ffb347!important;box-shadow:0 0 14px #ff8a3a;color:#1a0a04}
.ah-verdict{display:flex;flex-direction:column;gap:6px;align-items:center;width:100%}.ah-verdict.good b{color:#6af0a6}.ah-verdict.bad b{color:#ffb06a}.ah-verdict span{font-size:12.5px;opacity:.9}
.ah-note{font-size:12px!important;color:#ffd9a8}
.ah-stats{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.ah-stats span{display:flex;flex-direction:column;min-width:78px;padding:8px 10px;border-radius:14px;background:#ffffff12;font-size:11px}.ah-stats b{font-size:20px}
@media (max-height:520px){.ah-ready h1{font-size:30px}.ah-ready p{font-size:12px}.ah-card{padding:10px 14px;gap:6px}.ah-piano{height:clamp(70px,22vh,110px)}.ah-go{min-height:42px}}
.ah-obj{position:absolute;left:50%;top:44px;transform:translateX(-50%);max-width:min(80vw,520px);padding:5px 14px;border-radius:16px;background:#0a1620d9;border:1px solid #5affc866;color:#e8fff6;font-size:12.5px;font-weight:800;text-align:center;pointer-events:none;z-index:6}
.ah-btns .dig{background:linear-gradient(135deg,#2a7ab0,#1c4a78);font-size:22px}
`;
