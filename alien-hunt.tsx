/* Alien Hunt (plan 38): a first-person shooter against human-sized insect aliens, with a music question every 15 s of fighting.
   The shell: ready screen, input (touch sticks, mouse + keys), HUD, the tune-up question card, pause, results, Game Power. The rules are in ah-engine.ts, the picture in ah-render.ts. */
import { useEffect, useRef, useState } from "react";
import { newState, step, noInput, tuneResult, stats, setWeapon, WEAPONS, WAVES, WORDER, type State, type Input, type WeaponId } from "./ah-engine";
import { createRender, type Render } from "./ah-render";
import { nextQuestion, judgeKeys, recordAnswer, readLadder, learnedTopics, readDone, type Question } from "./quiz-quest";
import * as AU from "./ah-audio";
import { usePlayDrain, PowerSheet } from "./game-power-ui";
import { enterGame, COST as POWER_COST } from "./game-power";
import { gfxHigh } from "./adv-gfx";
import { enterFs, exitFsAndUnlock } from "./pvp-arena";
import { addRpgExp } from "./pvp-rpg";
import { logUsage } from "./shared-infra";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
const PCN = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const PC_OF: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOfName = (n: string) => { const m = /^([A-G])([#b♯♭]?)/.exec(n); if (!m) return -1; return (PC_OF[m[1]] + (m[2] === "#" || m[2] === "♯" ? 1 : m[2] ? -1 : 0) + 12) % 12; };
const WHITE = [0, 2, 4, 5, 7, 9, 11], BLACK: [number, number][] = [[1, 0.65], [3, 1.65], [6, 3.65], [8, 4.65], [10, 5.65]];
const addCrystals = (n: number) => { try { localStorage.setItem("tg_adv_crystals", String(Math.max(0, (parseInt(localStorage.getItem("tg_adv_crystals") || "0", 10) || 0) + n))); } catch (e) {} };
const readTune = (): number => { try { return localStorage.getItem("tg_ah_tune") === "15" ? 15 : 30; } catch (e) { return 30; } };   // owner 2026-10-18: every 30 s by default, 15 s is too often

type Quiz = { q: Question; phase: "gate" | "ask" | "done"; ok: boolean | null; sel: number[]; armed: boolean; lit: number };

export function AlienHuntPage({ lang, me, adminTier = 0, onBack, playUi }: { lang: string; me: string; adminTier?: number; onBack: () => void; playUi?: (k: string) => void }) {
  const t = (th: string, en: string, zh: string) => T3(lang, th, en, zh);
  const host = useRef<HTMLDivElement>(null), rdr = useRef<Render | null>(null), S = useRef<State>(newState(Date.now() & 0xffff, readTune()));
  const inp = useRef<Input>(noInput()), look = useRef({ x: 0, y: 0 }), keys = useRef<Record<string, boolean>>({}), stick = useRef({ id: -1, x0: 0, y0: 0, mx: 0, mz: 0 }), lookId = useRef(-1);
  const [phase, setPhase] = useState<"ready" | "play" | "result">("ready"), [paused, setPaused] = useState(false), [quiz, setQuiz] = useState<Quiz | null>(null);
  const [hud, setHud] = useState<any>({}), [high, setHigh] = useState(() => gfxHigh()), [powerNeed, setPowerNeed] = useState<number | null>(null), [res, setRes] = useState<any>(null);
  const [learned, setLearned] = useState<string[]>(() => learnedTopics(readDone())), [snd, setSnd] = useState(() => AU.soundOn()), tuneLog = useRef<{ topic: string; ok: boolean }[]>([]);
  const [hitM, setHitM] = useState(0), [hurt, setHurt] = useState(0), [banner, setBanner] = useState<string>(""), [tuneSecs, setTuneSecs] = useState<number>(readTune());
  const phaseRef = useRef(phase); phaseRef.current = phase; const pausedRef = useRef(paused); pausedRef.current = paused; const quizRef = useRef(quiz); quizRef.current = quiz;
  const hitT = useRef(0), hurtT = useRef(0), bannerT = useRef(0);

  usePlayDrain(phase === "play" && !paused && !quiz, adminTier, () => { finish(false, true); setPowerNeed(1); });

  const finish = (won: boolean, forced = false) => {
    const s = S.current; if (phaseRef.current === "result") return; const st = stats(s);
    const cry = Math.round(st.kills / 4 + st.stars * 3 + st.right * 2), exp = 20 + st.stars * 10 + st.right * 8;
    if (!forced || st.kills > 0) { addCrystals(cry); try { addRpgExp(me, exp); } catch (e) {} }
    try { logUsage("ah", `end:${won ? "win" : "lose"}:k${st.kills}:w${s.wave}:t${st.right}of${st.tunes}:${gfxHigh() ? "hd" : "sd"}`); } catch (e) {}
    AU.musicStop(); AU.sfx(won ? "win" : "lose"); const per: Record<string, [number, number]> = {}; for (const l of tuneLog.current) { per[l.topic] = per[l.topic] || [0, 0]; per[l.topic][1]++; if (l.ok) per[l.topic][0]++; }
    setRes({ ...st, won, cry, exp, wave: s.wave, per }); setPhase("result"); setPaused(false); setQuiz(null);   // full screen stays on for the result card; only Back leaves it
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
  };
  const begin = () => {
    if (!enterGame(POWER_COST.adventure, adminTier)) { setPowerNeed(POWER_COST.adventure); return; }
    if (playUi) playUi("click"); enterFs(); const lt = learnedTopics(readDone()); setLearned(lt); tuneLog.current = []; S.current = newState(Date.now() & 0xffff, lt.length ? readTune() : 0); AU.warm(); AU.setDucked(false); AU.musicStart(); AU.sfx("go"); setRes(null); setQuiz(null); setPaused(false); setPhase("play");
    try { logUsage("ah", `start:${gfxHigh() ? "hd" : "sd"}:${S.current.tuneEvery}s`); } catch (e) {}
  };

  /* renderer + loop */
  useEffect(() => {
    if (phase !== "play" || !host.current) return undefined;
    let r: Render; try { r = createRender(host.current, high); } catch (e) { setBanner("WebGL"); return undefined; }
    rdr.current = r; let raf = 0, last = performance.now(), acc = 0, slow = 0, hudT = 0;
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
          else if (e.k === "wave") { setBanner(t("คลื่นที่ ", "WAVE ", "第") + e.n + (lang === "zh" ? "波" : "")); bannerT.current = 2.2; }
          else if (e.k === "tune") { openQuiz(); if (document.pointerLockElement) try { document.exitPointerLock(); } catch (x) {} }
          else if (e.k === "win") finish(true); else if (e.k === "lose") finish(false);
        }
      }
      if (hitT.current > 0) { hitT.current -= dt; if (hitT.current <= 0) setHitM(0); } if (hurtT.current > 0) { hurtT.current -= dt; if (hurtT.current <= 0) setHurt(0); }
      if (bannerT.current > 0) { bannerT.current -= dt; if (bannerT.current <= 0) setBanner(""); }
      r.draw(s, dt);
      if (high && !pausedRef.current && !s.frozen) { if (dt > 0.031) slow++; else slow = Math.max(0, slow - 1); if (slow > 90) { slow = 0; try { localStorage.setItem("tg_adv_gfx", "standard"); } catch (e) {} setHigh(false); r.setHigh(false); try { logUsage("ah", "auto-lite"); } catch (e) {} } }
      hudT += dt; if (hudT > 0.1) { hudT = 0; { const near = s.enemies.filter(e => e.dead === 0 && Math.hypot(e.x - s.p.x, e.z - s.p.z) < 12).length; AU.setIntensity(s.p.hp < 35 || near >= 4 || s.wave >= 4 ? 3 : s.enemies.some(e => e.dead === 0) ? 2 : 1); } const w = s.weapon, a = s.ammo[w]; setHud({ hp: Math.round(s.p.hp), sh: Math.round(s.p.shield), w: WEAPONS[w].name, mag: a.mag, res: w === "pistol" ? "∞" : a.res, wave: s.wave, left: s.enemies.filter(e => e.dead === 0).length + s.spawnQ.length, score: s.score, streak: s.streak, reload: s.reload > 0, tune: Math.max(0, Math.ceil(s.tuneEvery - s.tuneT)), ts: s.tuneStreak, boost: s.boost > 0, own: WORDER.filter(w => s.owned[w]).join(","), cur: s.weapon, sl: s.p.slideCd <= 0, au: s.auto, between: s.between > 0 && s.enemies.every(e => e.dead !== 0) }); }
    };
    raf = requestAnimationFrame(loop);
    (window as any).__ah = { s: S.current, get state() { return S.current; }, step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) step(S.current, dt, inp.current); }, info: () => r.info(), killAll: () => { for (const e of S.current.enemies) e.hp = 0, e.dead = 0.5; }, tune: () => { S.current.tuneT = S.current.tuneEvery; }, setHigh: (h: boolean) => { setHigh(h); r.setHigh(h); }, creature: (k: string, m: string) => AU.creature(k, m as any, 3), quizQ: () => quizRef.current && quizRef.current.q, draw: () => r.draw(S.current, 0.016) };
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); r.dispose(); rdr.current = null; try { delete (window as any).__ah; } catch (e) {} };
  }, [phase]);
  useEffect(() => { if (rdr.current) rdr.current.setHigh(high); }, [high]);
  useEffect(() => () => { exitFsAndUnlock(); AU.dispose(); }, []);
  useEffect(() => { AU.setDucked(paused || !!quiz); }, [paused, !!quiz]);

  /* keyboard + mouse */
  useEffect(() => {
    if (phase !== "play") return undefined;
    const kd = (e: KeyboardEvent) => {
      if (quizRef.current) return; const k = e.key.toLowerCase(); keys.current[k === " " ? " " : k] = true;
      if (k === "r") inp.current.reload = true; { if (k === "v") S.current.auto = !S.current.auto; const n = parseInt(k, 10); if (n >= 1 && n <= WORDER.length) setWeapon(S.current, WORDER[n - 1]); }
      if (k === "escape" || k === "p") setPaused(p => !p); if (k === " ") e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); keys.current[k === " " ? " " : k] = false; };
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
  const answer = (ok: boolean) => {
    const c = quizRef.current; if (!c || c.phase !== "ask") return; recordAnswer(ok, c.q.topic); tuneLog.current.push({ topic: c.q.topic, ok }); AU.sfx(ok ? "tuneok" : "tunebad");
    if (ok) { try { addRpgExp(me, 10 + 6 * c.q.tier + (S.current.tuneStreak >= 2 ? 6 : 0)); } catch (e) {} }
    setQuiz({ ...c, phase: "done", ok, lit: 0 });
    if (!ok) { const n = c.q.teach.lit.length; let i = 0; const id = setInterval(() => { i++; setQuiz(q => (q ? { ...q, lit: Math.min(n, i) } : q)); if (i >= n) clearInterval(id); }, 450); }
  };
  const resume = (skipped = false) => {
    const c = quizRef.current; if (!c) return; tuneResult(S.current, skipped ? false : !!c.ok); AU.setDucked(false); AU.sfx("go"); setQuiz(null); setBanner(t("เตรียมสู้!", "GET READY", "准备")); bannerT.current = 1.2;
    try { logUsage("ah", `tune:${c.q.topic}:${skipped ? "skip" : c.ok ? "ok" : "bad"}`); } catch (e) {}
  };
  const tapKey = (pc: number) => {
    const c = quizRef.current; if (!c || c.phase !== "ask") return; const q = c.q;
    if (q.kind === "key") answer(judgeKeys(q, [pc])); else setQuiz({ ...c, sel: c.sel.includes(pc) ? c.sel.filter(x => x !== pc) : [...c.sel, pc] });
  };

  const setTune = (n: number) => { try { localStorage.setItem("tg_ah_tune", String(n)); } catch (e) {} setTuneSecs(n); S.current.tuneEvery = n; };
  const close = () => { exitFsAndUnlock(); onBack(); };

  const pad = phase === "play";
  const q = quiz && quiz.q;
  return (
    <div className="ah-root" data-ah={phase}>
      <style>{CSS}</style>
      {powerNeed != null && <PowerSheet lang={lang} need={powerNeed} onClose={() => setPowerNeed(null)} />}
      {phase === "ready" && (
        <div className="ah-ready">
          <button className="ah-x" onClick={close} aria-label="close">✕</button>
          <em>{t("ไฟต์ติ้งโหมด", "FIGHT MODE", "战斗模式")}</em><h1>ALIEN HUNT</h1>
          <p>{t("เอเลี่ยนแมลงยักษ์บุกอาณานิคม กำจัดให้ครบ 5 คลื่น — ทุก 30 วินาทีที่สู้ เกมจะหยุดถามคำถามดนตรี ตอบถูกได้โล่และกระสุนเต็ม", "Giant insect aliens are overrunning the colony. Beat 5 waves. Every 30 seconds of fighting the game freezes for a music question: answer right for a shield and a full reload.", "巨型昆虫外星人入侵殖民地。击退5波。战斗每30秒暂停一次，回答音乐问题，答对获得护盾和满弹药。")}</p>
          <div className="ah-keys"><span>WASD / {t("จอยซ้าย", "left stick", "左摇杆")}</span><span>{t("เมาส์ / ลากขวา = เล็ง", "mouse / drag right = aim", "鼠标/右侧拖动=瞄准")}</span><span>{t("คลิก / ปุ่ม FIRE = ยิง", "click / FIRE = shoot", "点击/FIRE=射击")}</span><span>R {t("รีโหลด", "reload", "换弹")} · 1-8 {t("เปลี่ยนปืน", "swap gun", "换枪")}</span></div>
          <div className="ah-opt"><b>{t("ถามทุก", "Question every", "每隔")}</b>
            {[30, 15].map(n => <button key={n} className={tuneSecs === n ? "on" : ""} onClick={() => setTune(n)} data-tune={n}>{n}s</button>)}
            <b style={{ marginLeft: 12 }}>{t("กราฟิก", "Graphics", "画质")}</b>
            {[true, false].map(h => <button key={String(h)} className={high === h ? "on" : ""} onClick={() => { try { localStorage.setItem("tg_adv_gfx", h ? "high" : "standard"); } catch (e) {} setHigh(h); }} data-gfx={h ? "high" : "lite"}>{h ? "High" : "Lite"}</button>)}
          </div>
          <p className="ah-note" data-learned={learned.length}>{learned.length ? t("คำถามจะมาจากเรื่องที่เรียนไปแล้วเท่านั้น: ", "Questions come only from what you have learned: ", "问题只来自你学过的内容：") + learned.join(" · ") : t("ยังไม่มีเรื่องที่เรียนแล้ว จึงยังไม่มีคำถามในเกม — ไปเรียนที่ My Class แล้วกลับมา คำถามจะเปิดเอง", "Nothing learned yet, so no questions in the game — learn something in My Class and they switch on by themselves.", "还没有学过的内容，所以游戏里暂时没有问题——先去 My Class 学习，问题会自动开启。")}</p>
          <div className="ah-opt"><b>{t("เสียง", "Sound", "声音")}</b>{[true, false].map(v => <button key={String(v)} className={snd === v ? "on" : ""} data-snd={v ? "on" : "off"} onClick={() => { setSnd(v); AU.setSoundOn(v); }}>{v ? "ON" : "OFF"}</button>)}</div>
          <button className="ah-go" data-start="1" onClick={begin}>{t("เริ่มภารกิจ", "START MISSION", "开始任务")}</button>
        </div>
      )}
      {pad && (
        <div className="ah-play" onPointerDown={tdown} onPointerMove={tmove} onPointerUp={tup} onPointerCancel={tup}>
          <div className="ah-host" ref={host} />
          <div className={"ah-vig" + (hurt ? " on" : "")} />
          <div className={"ah-cross" + (hitM ? " hit" : "")}><i /><i /><i /><i /></div>
          <div className="ah-top">
            <div className="ah-wave"><b>{t("คลื่น", "WAVE", "波")} {hud.wave || 0}/{WAVES.length}</b><span>{hud.between ? t("เตรียมตัว…", "get ready…", "准备…") : (hud.left ?? 0) + " " + t("ตัวเหลือ", "left", "剩余")}</span></div>
            <div className={"ah-tune" + ((hud.tune || 99) <= 3 ? " soon" : "")} data-tunechip="1"><b>♪ {hud.tune ?? 15}s</b>{(hud.ts || 0) > 0 && <span>TUNE ×{hud.ts}</span>}</div>
            <div className="ah-score"><b>{(hud.score || 0).toLocaleString()}</b>{(hud.streak || 0) >= 3 && <span>🔥 {hud.streak}</span>}</div>
            <button className="ah-gear" aria-label="pause" data-pause-btn="1" onClick={() => setPaused(true)}>⚙</button>
          </div>
          <div className="ah-bars"><div className="ah-hp"><i style={{ width: (hud.hp ?? 100) + "%" }} />{(hud.sh || 0) > 0 && <u style={{ width: Math.min(50, hud.sh) * 2 + "%" }} />}</div><span>❤ {hud.hp ?? 100}{(hud.sh || 0) > 0 ? " 🛡 " + hud.sh : ""}{hud.boost ? " ⚡" : ""}</span></div>
          <div className="ah-chips" data-chips="1">{(hud.own || "pistol,rifle").split(",").map((w: string) => <button key={w} data-wpn={w} className={hud.cur === w ? "on" : ""} onPointerDown={e => { e.stopPropagation(); setWeapon(S.current, w as WeaponId); }}>{(WORDER.indexOf(w as WeaponId) + 1)}<i>{WEAPONS[w as WeaponId].name}</i></button>)}</div>
          <div className="ah-ammo"><small>{hud.w}</small><b>{hud.reload ? "…" : hud.mag}</b><span>/ {hud.res}</span></div>
          {banner && <div className="ah-banner">{banner}</div>}
          <div className="ah-stick" style={{ transform: `translate(${(hud.jx || 0) * 22}px, ${-(hud.jz || 0) * 22}px)` }} />
          <div className="ah-btns">
            <button className="fire" aria-label="fire" data-fire="1" {...hold(v => { inp.current.fire = v; })}>FIRE</button>
            <button aria-label="reload" {...hold(v => { if (v) inp.current.reload = true; })}>R</button>
            <button aria-label="swap" {...hold(v => { if (v) inp.current.swap = 1; })}>⇄</button>
            <button aria-label="jump" data-jump="1" {...hold(v => { keys.current[" "] = v; })}>⤴</button>
            <button aria-label="auto walk" data-auto="1" className={hud.au ? "on" : ""} onPointerDown={e => { e.stopPropagation(); S.current.auto = !S.current.auto; }}>AUTO</button>
            <button aria-label="slide" data-slide="1" className={hud.sl === false ? "cool" : ""} {...hold(v => { keys.current.c = v; })}>⇊</button>
          </div>
        </div>
      )}
      {paused && phase === "play" && !quiz && (
        <div className="ah-pause" data-pause="1"><div className="ah-card">
          <b>{t("พักเกม", "PAUSED", "已暂停")}</b>
          <button className="ah-go" onClick={() => setPaused(false)} data-resume="1">{t("เล่นต่อ", "Resume", "继续")}</button>
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
              {q.kind !== "choice" && (
                <div className="ah-piano" data-piano="1">
                  {WHITE.map((pc, i) => <button key={pc} data-pc={pc} className={"w" + (quiz.sel.includes(pc) ? " sel" : "") + (quiz.phase === "done" && q.teach.lit.slice(0, quiz.lit).some(n => pcOfName(n) === pc) ? " lit" : "")} style={{ left: i * (100 / 7) + "%" }} onClick={() => tapKey(pc)}><span>{PCN[pc]}</span></button>)}
                  {BLACK.map(([pc, pos]) => <button key={pc} data-pc={pc} className={"b" + (quiz.sel.includes(pc) ? " sel" : "") + (quiz.phase === "done" && q.teach.lit.slice(0, quiz.lit).some(n => pcOfName(n) === pc) ? " lit" : "")} style={{ left: (pos * 100 / 7 + 0.5) + "%" }} onClick={() => tapKey(pc)}><span>{PCN[pc]}</span></button>)}
                </div>
              )}
              {quiz.phase === "ask" && q.kind === "keys" && <button className="ah-go" data-check="1" disabled={!quiz.sel.length} onClick={() => answer(judgeKeys(q, quiz.sel))}>{t("ตรวจ", "CHECK", "检查")}</button>}
              {quiz.phase === "ask" && <button className="ah-ghost" data-skip="1" onClick={() => resume(true)}>{t("ข้าม (ไม่ได้รางวัล)", "Skip (no reward)", "跳过（无奖励）")}</button>}
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
          <p>+{res.cry} ◆ · +{res.exp} EXP</p>
          <button className="ah-go" onClick={begin}>{t("เล่นอีกครั้ง", "PLAY AGAIN", "再玩一次")}</button><button className="ah-ghost" onClick={close}>{t("กลับ", "Back", "返回")}</button>
        </div>
      )}
    </div>
  );
}

const CSS = `
.ah-root{position:fixed;inset:0;z-index:2450;background:#07060c;color:#fff;font-family:system-ui,-apple-system,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}
.ah-root button{font:inherit;color:inherit;cursor:pointer}
.ah-ready{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;background:radial-gradient(120% 90% at 50% 20%,#4a2744 0,#1a1020 55%,#07060c 100%)}
.ah-ready em,.ah-card em{font-style:normal;font-size:11px;letter-spacing:.2em;color:#ffb06a;font-weight:800}
.ah-ready h1{margin:0;font-size:clamp(34px,8vw,64px);letter-spacing:.12em;font-weight:900;color:#ff6a3a;text-shadow:0 0 28px #ff6a3a88}
.ah-ready p{max-width:560px;margin:0;font-size:13.5px;line-height:1.5;opacity:.88}
.ah-x{position:absolute;top:12px;left:12px;width:40px;height:40px;border-radius:50%;border:1px solid #ffffff44;background:#0008;font-size:16px}
.ah-keys{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}.ah-keys span{padding:4px 10px;border-radius:999px;background:#ffffff14;font-size:11.5px}
.ah-opt{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;font-size:12px}.ah-opt button{min-width:52px;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid #ffffff44;background:#ffffff10;font-weight:700}.ah-opt button.on{background:#ff6a3a;border-color:#ff6a3a;color:#1a0a04}
.ah-go{min-height:50px;padding:0 30px;border-radius:999px;border:0;background:linear-gradient(135deg,#ff8a3a,#ff4a2a);color:#1a0a04;font-weight:900;letter-spacing:.08em;font-size:15px;box-shadow:0 8px 22px -8px #ff6a3a}.ah-go.dim,.ah-go:disabled{opacity:.4}
.ah-ghost{min-height:40px;padding:0 20px;border-radius:999px;border:1px solid #ffffff55;background:transparent;font-weight:700}
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
.ah-gear{width:42px;height:42px;border-radius:50%;border:1px solid #ffffff55;background:#000a;font-size:18px}
.ah-bars{position:absolute;left:12px;bottom:12px;pointer-events:none}.ah-bars span{font-size:12px;font-weight:800}
.ah-hp{position:relative;width:min(220px,40vw);height:12px;border-radius:99px;background:#0009;border:1px solid #ffffff44;overflow:hidden;margin-bottom:3px}.ah-hp i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#e83a3a,#ff8a5a)}.ah-hp u{position:absolute;left:0;top:0;height:4px;background:#5ac8ff}
.ah-chips{position:absolute;left:50%;transform:translateX(-50%);bottom:8px;display:flex;gap:4px;flex-wrap:nowrap;justify-content:center;max-width:50vw}.ah-chips button{min-height:30px;min-width:30px;padding:0 8px;justify-content:center;border-radius:999px;border:1px solid #ffffff44;background:#000a;font-size:12px;font-weight:800;display:flex;align-items:center;gap:5px}.ah-chips button i{display:none;font-style:normal;font-weight:600;font-size:10px;opacity:.85}.ah-chips button.on i{display:inline}.ah-chips button.on{border-color:#58e8ff;background:#0a3a4aaa;box-shadow:0 0 10px #58e8ff66}.ah-btns .cool{opacity:.4}.ah-btns .on{background:#2fae6acc;border-color:#6af0a6;box-shadow:0 0 12px #6af0a6aa}.ah-btns button[data-auto]{font-size:11px}
.ah-ammo{position:absolute;right:190px;bottom:14px;text-align:right;pointer-events:none;text-shadow:0 2px 6px #000}.ah-ammo small{display:block;font-size:11px;opacity:.8}.ah-ammo b{font-size:34px}.ah-ammo span{font-size:15px;opacity:.8}
.ah-banner{position:absolute;left:0;right:0;top:26%;text-align:center;font-size:clamp(26px,6vw,44px);font-weight:900;letter-spacing:.14em;color:#ffb06a;text-shadow:0 0 22px #ff6a3a;pointer-events:none}
.ah-stick{position:absolute;left:11%;bottom:20%;width:56px;height:56px;margin:-28px;border-radius:50%;background:#ffffff22;border:2px solid #ffffff55;pointer-events:none}
.ah-btns{position:absolute;right:12px;bottom:12px;display:grid;grid-template-columns:repeat(3,52px);grid-auto-rows:52px;gap:8px;direction:rtl}.ah-btns button{width:52px;height:52px;border-radius:50%;border:2px solid #ffffff66;background:#0009;font-weight:900;font-size:13px;direction:ltr}
.ah-btns .fire{grid-column:span 1;width:64px;height:64px;margin:-6px;border-color:#ff6a3a;background:#ff4a2a99}
.ah-pause,.ah-quiz{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#05030acc;backdrop-filter:blur(5px);z-index:5;padding:10px}
.ah-card{display:flex;flex-direction:column;align-items:center;gap:9px;max-width:min(560px,94vw);max-height:96vh;overflow:auto;padding:16px 20px;border-radius:26px;background:linear-gradient(160deg,#241a32,#120c1c);border:1px solid #ffffff2a;text-align:center}.ah-card.wide{width:min(720px,96vw)}
.ah-card p{margin:0;font-size:13px;opacity:.85}.ah-ic{font-size:30px}.ah-q{font-size:clamp(16px,3.4vw,22px);line-height:1.35}
.ah-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;width:100%}.ah-opts button{min-height:50px;border-radius:16px;border:1px solid #ffffff44;background:#ffffff12;font-weight:700;padding:6px 10px}.ah-opts button.good{background:#2fae6a;border-color:#2fae6a}
.ah-piano{position:relative;width:min(560px,92vw);height:clamp(90px,26vh,150px)}.ah-piano button{position:absolute;border:1px solid #222;border-radius:0 0 8px 8px;padding:0;display:flex;align-items:flex-end;justify-content:center}
.ah-piano .w{top:0;width:calc(100% / 7);height:100%;background:#f4f1ea;color:#222}.ah-piano .b{top:0;width:7%;height:62%;background:#17151c;color:#ddd;z-index:2;margin-left:-3.5%}.ah-piano span{font-size:10.5px;font-weight:800;padding-bottom:4px}
.ah-piano .sel{background:#ff8a3a!important;color:#1a0a04}.ah-piano .lit{background:#ffb347!important;box-shadow:0 0 14px #ff8a3a;color:#1a0a04}
.ah-verdict{display:flex;flex-direction:column;gap:6px;align-items:center;width:100%}.ah-verdict.good b{color:#6af0a6}.ah-verdict.bad b{color:#ffb06a}.ah-verdict span{font-size:12.5px;opacity:.9}
.ah-note{font-size:12px!important;color:#ffd9a8}
.ah-stats{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.ah-stats span{display:flex;flex-direction:column;min-width:78px;padding:8px 10px;border-radius:14px;background:#ffffff12;font-size:11px}.ah-stats b{font-size:20px}
@media (max-height:520px){.ah-ready h1{font-size:30px}.ah-ready p{font-size:12px}.ah-card{padding:10px 14px;gap:6px}.ah-piano{height:clamp(70px,22vh,110px)}.ah-go{min-height:42px}}
`;
