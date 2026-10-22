/* Robot Adventure 3D (plan 39, owner 2026-10-22): the Adventure story played in first person. This file is the shell: the story map (the Adventure lobby, laid on a tilted
   3D floor), the film before a map, and the hand-over to the Alien Hunt engine, which plays the level (ra-data.ts holds the level and the story lines).
   Progress is the Adventure's own `tg_adv_done`, so a planet cleared here is cleared there. All 49 episodes are playable: on foot (Alien Hunt engine) or in a cockpit (ra-cockpit.tsx), see ra-factory.ts. */
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { RA_PLANETS, RA_SECT } from "./ra-planets";
import { defOf } from "./ra-factory";
import { orbPic, orbKind } from "./planet-orb";
import * as AU from "./ah-audio";
import { enterGame, COST as POWER_COST } from "./game-power";
import { PowerSheet } from "./game-power-ui";
import { gfxHigh } from "./adv-gfx";
import { enterFs, exitFsAndUnlock } from "./pvp-arena";
import { CSS as ADV_CSS } from "./adventure";
import { logUsage } from "./shared-infra";
import { openAdvRoom, MAX_PILOTS, type Net, type Peer } from "./adv-online";
import type { ShopW } from "./ah-engine";

const AlienHuntPage = lazy(() => import("./alien-hunt").then(m => ({ default: m.AlienHuntPage })));
const RaShipPage = lazy(() => import("./ra-cockpit"));
const AdventureCine = lazy(() => import("./adventure-cine"));
const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
const readDone = (): string[] => { try { const v = JSON.parse(localStorage.getItem("tg_adv_done") || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const markDone = (id: string) => { try { const d = readDone(); if (!d.includes(id)) { d.push(id); localStorage.setItem("tg_adv_done", JSON.stringify(d)); } } catch (e) {} };
const PARTS: [string, string, string, string][] = [["prep", "ภาค 0 · เตรียมออกเดินทาง", "Part 0 · Liftoff", "第0部 · 启程"], ["solar", "ภาค 1 · ออกจากโลก", "Part 1 · Leaving Earth", "第1部 · 离开地球"], ["space", "ภาค 2 · ไททันและอาร์ก", "Part 2 · Titan & Ark", "第2部 · 土卫六与方舟"], ["ground", "ภาค 3 · โลกใหม่", "Part 3 · New worlds", "第3部 · 新世界"], ["act2", "ภาค 4 · ผู้เก็บเกี่ยว", "Part 4 · The Harvesters", "第4部 · 收割者"]];
/** where each episode of a part stands on the floor: two staggered rows, left to right (percent of the floor) */
/* Part 0 = the first seven episodes of the old Part 1 (they crowded one screen); the rest stays Part 1 */
const SOLAR_IDS = RA_PLANETS.filter(p => (RA_SECT[p.id] || "ground") === "solar").map(p => p.id);
const secOf = (id: string) => { const k = RA_SECT[id] || "ground"; return k === "solar" && SOLAR_IDS.indexOf(id) < 7 ? "prep" : k; };
const posOf = (n: number): [number, number][] => { const rows = n > 10 ? 3 : 2, per = Math.ceil(n / rows); return Array.from({ length: n }, (_, i) => { const r = Math.floor(i / per), c = i - r * per, cols = r === rows - 1 ? n - per * (rows - 1) : per, full = per; const span = 80; const x = 8 + (cols > 1 ? c * (span / (cols - 1)) : 40) + (r % 3) * 1.6; const ys = rows === 3 ? [13, 43, 73] : [34, 72]; return [x, ys[r] + (c % 2) * 5] as [number, number]; }); };
const SIZE: Record<string, number> = { star: 52, saturn: 50, jupiter: 48, earth: 38, venus: 34, mars: 30, titan: 30, blackhole: 40, moon: 26, mercury: 24, rock: 26, generic: 30 };
const shortName = (s: string) => s.split(" · ")[0];

export function RobotAdventure3DPage({ lang, me, adminTier = 0, onBack, playUi, onReward = null, shopWeapon = null }: { lang: string; me: string; adminTier?: number; onBack: () => void; playUi?: (k: string) => void; onReward?: any; shopWeapon?: ShopW | null }) {
  const t = (th: string, en: string, zh: string) => T3(lang, th, en, zh);
  const [screen, setScreen] = useState<"hub" | "film" | "play">("hub"), [done, setDone] = useState<string[]>(() => readDone());
  const firstOpen = () => { const d = readDone(); const k = RA_PLANETS.findIndex(p => !d.includes(p.id)); return k < 0 ? RA_PLANETS[0].id : RA_PLANETS[k].id; };
  const [sel, setSel] = useState<string>(firstOpen), [part, setPart] = useState<string>("prep");
  const [portrait, setPortrait] = useState(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth), [high, setHigh] = useState(() => gfxHigh()), [snd, setSnd] = useState(() => AU.soundOn());
  const [powerNeed, setPowerNeed] = useState<number | null>(null);
  /* co-op (plan 39 P5): a room on the Adventure Online channel; every client runs its own game and shows teammates as ghosts, the host starts an episode for everyone */
  const [coop, setCoop] = useState(false), [net, setNet] = useState<Net | null>(null), [peers, setPeers] = useState<Peer[]>([]), [codeIn, setCodeIn] = useState(""), [coErr, setCoErr] = useState("");
  const netRef = useRef<Net | null>(null), goRef = useRef<(id: string) => void>(() => {});
  const joinRoom = async (code: string | null) => {
    setCoErr(""); try { const n = await openAdvRoom(code, { name: me || "Pilot", model: "", glow: "#7fe8ff" }); n.on({ onPeers: l => setPeers(l), onStart: pid => { if (n.host) return; goRef.current(pid); }, onLeave: () => {} }); netRef.current = n; setNet(n); setPeers([...n.peers.values()]); try { logUsage("ra", "coop:" + (code ? "join" : "create")); } catch (e) {} }
    catch (e) { setCoErr(t("เข้าห้องไม่ได้ ตรวจรหัสแล้วลองใหม่", "Could not join. Check the code and try again.", "无法加入，请检查房间码。")); }
  };
  const leaveRoom = () => { try { netRef.current && netRef.current.leave(); } catch (e) {} netRef.current = null; setNet(null); setPeers([]); };
  useEffect(() => () => { try { netRef.current && netRef.current.leave(); } catch (e) {} }, []);
  const unlockAll = adminTier >= 3 || (() => { try { return localStorage.getItem("tg_test_hook") === "1" && localStorage.getItem("tg_adv_unlockall") === "1"; } catch (e) { return false; } })();
  const open = (i: number) => unlockAll || i === 0 || done.includes(RA_PLANETS[i - 1].id) || (i > 1 && done.includes(RA_PLANETS[i - 2].id));
  const playable = (id: string) => !!defOf(id);
  const cur = RA_PLANETS.find(p => p.id === sel) || RA_PLANETS[0], curIdx = RA_PLANETS.indexOf(cur);
  const next3d = RA_PLANETS.findIndex((p, i) => playable(p.id) && open(i) && !done.includes(p.id));
  const inPart = RA_PLANETS.map((p, gi) => ({ p, gi })).filter(x => secOf(x.p.id) === part), POS = posOf(inPart.length);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => { if (screen === "film") { try { enterFs(); } catch (e) {} } }, [screen]);   // same as Adventure: every film is full screen

  /* the map: full screen, landscape (a quarter turn when the phone refuses to rotate), and its own tune */
  useEffect(() => {
    if (screen !== "hub") return undefined;
    const onR = () => setPortrait(window.innerHeight > window.innerWidth); window.addEventListener("resize", onR); onR();
    try { enterFs(); } catch (e) {}
    const startMenu = () => { try { AU.warm(); AU.menuStart(); } catch (e) {} };
    startMenu(); const first = () => { startMenu(); window.removeEventListener("pointerdown", first); }; window.addEventListener("pointerdown", first);
    return () => { window.removeEventListener("resize", onR); window.removeEventListener("pointerdown", first); AU.menuStop(); };
  }, [screen]);
  useEffect(() => { try { logUsage("ra", "open"); } catch (e) {} return () => { exitFsAndUnlock(); }; }, []);
  /* the floor leans a little with the pointer: a cheap parallax that makes the map read as 3D */
  useEffect(() => {
    if (screen !== "hub") return undefined; const el = stage.current; if (!el) return undefined;
    const mv = (e: PointerEvent) => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; el.style.setProperty("--tx", (x * 6).toFixed(2) + "deg"); el.style.setProperty("--ty", (y * -3).toFixed(2) + "deg"); };
    window.addEventListener("pointermove", mv); return () => window.removeEventListener("pointermove", mv);
  }, [screen]);

  const go = (id: string, fromHost = false) => {
    if (!playable(id)) return;
    if (net && net.host && !fromHost) { try { net.sendStart(id); } catch (e) {} } if (playUi) playUi("click");
    if (!enterGame(POWER_COST.adventure, adminTier)) { setPowerNeed(POWER_COST.adventure); return; }
    setSel(id); let nocine = false; try { nocine = localStorage.getItem("tg_adv_nocine") === "1"; } catch (e) {}
    try { logUsage("ra", "start:" + id + ":" + (gfxHigh() ? "hd" : "sd")); } catch (e) {}
    setScreen(nocine ? "play" : "film");
  };
  goRef.current = (pid: string) => go(pid, true);
  const dfn = defOf(sel);

  if (screen === "film") return (
    <div className="adv" role="region" aria-label="Film"><style>{ADV_CSS}</style>
      <Suspense fallback={<div className="adv-cine" />}><AdventureCine P={cur} lang={lang} me={me} colorway={undefined} onDone={() => setScreen("play")} /></Suspense>
    </div>
  );
  if (screen === "play" && dfn && dfn.kind === "ship") return (
    <Suspense fallback={<div className="ra-load"><style>{CSS}</style>…</div>}>
      <RaShipPage net={net} lang={lang} me={me} adminTier={adminTier} def={dfn.data} onWin={() => { markDone(sel); setDone(readDone()); try { logUsage("ra", "clear:" + sel); } catch (e) {} }} onBack={() => { setDone(readDone()); setScreen("hub"); }} />
    </Suspense>
  );
  if (screen === "play" && dfn && dfn.kind === "foot") return (
    <Suspense fallback={<div className="ra-load"><style>{CSS}</style>…</div>}>
      <AlienHuntPage lang={lang} me={me} adminTier={adminTier} onBack={onBack} playUi={playUi} onReward={onReward} shopWeapon={shopWeapon}
        ra={{ net, data: dfn.data, onWin: () => { markDone(sel); setDone(readDone()); try { logUsage("ra", "clear:" + sel); } catch (e) {} }, onBack: () => { setDone(readDone()); setScreen("hub"); } }} />
    </Suspense>
  );

  const brief = dfn && sel === cur.id ? dfn.data.brief : null;
  return (
    <div className={"ra-hub" + (portrait ? " rot" : "")} data-ra="hub">
      <style>{CSS}</style>
      {powerNeed != null && <PowerSheet lang={lang} need={powerNeed} onClose={() => setPowerNeed(null)} />}
      <div className="ra-stars s1" /><div className="ra-stars s2" /><div className="ra-neb" />
      <header className="ra-head">
        <button className="ra-x" data-ra-close="1" onClick={() => { if (playUi) playUi("click"); onBack(); }} aria-label="close">✕</button>
        <div className="ra-title"><h1>ROBOT ADVENTURE <b>3D</b></h1><span>{t("เล่นตามเนื้อเรื่อง · มุมมองบุคคลที่ 1 · ตอบคำถามดนตรีเพื่อทำภารกิจ", "Follow the story · first-person · answer music questions to carry out missions", "跟随剧情 · 第一人称 · 回答音乐问题完成任务")}</span></div>
        <div className="ra-tabs" data-ra-tabs="1">{PARTS.map(pt => <button key={pt[0]} data-part={pt[0]} className={part === pt[0] ? "on" : ""} onClick={() => setPart(pt[0])}>{T3(lang, pt[1], pt[2], pt[3])}</button>)}</div>
        <div className="ra-opts"><button data-ra-coop-btn="1" className={net ? "on" : ""} onClick={() => setCoop(v => !v)}>👥 {net ? net.code : t("ร่วมเล่น", "Co-op", "合作")}</button>
          <span>{t("กราฟิก", "Graphics", "画质")}</span>{[true, false].map(h => <button key={String(h)} data-gfx={h ? "high" : "lite"} className={high === h ? "on" : ""} onClick={() => { try { localStorage.setItem("tg_adv_gfx", h ? "high" : "standard"); } catch (e) {} setHigh(h); }}>{h ? "High" : "Lite"}</button>)}
          <button className={"ra-snd" + (snd ? " on" : "")} data-ra-snd="1" aria-label="sound" onClick={() => { const v = !snd; setSnd(v); AU.setSoundOn(v); }}>{snd ? "♪" : "✕"}</button>
        </div>
      </header>
      {coop && (
        <div className="ra-coop" data-ra-coop="1">
          <button className="ra-coop-x" onClick={() => setCoop(false)} aria-label="close">✕</button>
          <b>{t("เล่นร่วมกัน (สูงสุด 4 คน)", "Co-op (up to 4 pilots)", "合作（最多4人）")}</b>
          {!net ? (<>
            <button className="ra-go" data-coop-create="1" onClick={() => joinRoom(null)}>{t("สร้างห้องใหม่", "Make a room", "创建房间")}</button>
            <div className="ra-coop-row"><input data-coop-code="1" value={codeIn} maxLength={6} placeholder={t("รหัสห้อง", "Room code", "房间码")} onChange={e => setCodeIn(e.target.value.toUpperCase())} /><button data-coop-join="1" onClick={() => joinRoom(codeIn)}>{t("เข้าร่วม", "Join", "加入")}</button></div>
            {coErr && <small data-coop-err="1">{coErr}</small>}
          </>) : (<>
            <div className="ra-coop-code" data-coop-room="1">{net.code}</div>
            <div className="ra-coop-peers" data-coop-peers="1">{[{ id: net.id, name: me || "Pilot", isHost: net.host } as Peer, ...peers].slice(0, MAX_PILOTS).map(q => <span key={q.id}>{q.isHost ? "★ " : ""}{q.name}</span>)}</div>
            <small>{net.host ? t("แตะดาวแล้วกดเริ่ม ทุกคนจะเริ่มพร้อมกัน", "Pick an episode and deploy: everyone starts together.", "选择关卡并出发，所有人同时开始。") : t("รอหัวห้องเลือกด่าน", "Wait for the host to pick an episode.", "等待房主选关。")}</small>
            <small>{t("แต่ละคนเล่นเกมของตัวเอง เห็นเพื่อนเป็นเงาในฉาก ไม่มีรางวัลเพิ่ม", "Each pilot plays their own game and sees the others as ghosts; no extra rewards.", "每人独立游戏，队友以幽灵显示；无额外奖励。")}</small>
            <button className="ra-ghost" data-coop-leave="1" onClick={leaveRoom}>{t("ออกจากห้อง", "Leave room", "离开房间")}</button>
          </>)}
        </div>
      )}
      <div className="ra-stage" ref={stage}>
        <div className="ra-plane" data-ra-plane="1">
          <div className="ra-grid" />
          <svg className="ra-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {inPart.slice(1).map((x, k) => { const p = x.p, a = POS[k], b = POS[k + 1], ok = open(x.gi); return <path key={p.id} d={`M${a[0]} ${a[1]} Q${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + (k % 2 ? 8 : -8)} ${b[0]} ${b[1]}`} fill="none" vectorEffect="non-scaling-stroke" stroke={ok ? "#7affd0" : "#ffffff44"} strokeWidth="2.6" strokeDasharray={ok ? "0" : "5 6"} />; })}
          </svg>
          {inPart.map((x, pi) => {
            const p = x.p, i = x.gi, isOpen = open(i), cleared = done.includes(p.id), d3 = playable(p.id), size = (SIZE[orbKind(p.id)] || 30) + (i * 5) % 3 * 2 + (p.id === sel ? 6 : 0), pos = POS[pi];
            return (
              <button key={p.id} data-planet={p.id} data-open={isOpen ? "1" : "0"} data-3d={d3 ? "1" : "0"} className={"ra-pl" + (isOpen ? "" : " lock") + (cleared ? " clr" : "") + (p.id === sel ? " sel" : "") + (i === next3d ? " next" : "")}
                style={{ left: pos[0] + "%", top: pos[1] + "%", ["--s" as any]: size + "px", ["--c" as any]: p.c[2], ["--d" as any]: (i % 5) * 0.4 + "s" }} onClick={() => { if (playUi) playUi("click"); setSel(p.id); }}>
                <i className="ra-orb"><img alt="" src={orbPic(p.id, p.c[2], p.c[1])} />{!isOpen ? <b>🔒</b> : cleared ? <em>✓</em> : null}</i>
                <span className="ra-nm">{shortName(T3(lang, p.th, p.en, p.zh))}</span>
                <u className="g">{defOf(p.id)!.kind === "ship" ? "🚀" : "👣"}</u>
              </button>
            );
          })}
        </div>
      </div>
      <aside className="ra-card" data-ra-card="1">
        <b>{shortName(T3(lang, cur.th, cur.en, cur.zh))}</b>
        <small>{t("ตอน ", "Ep. ", "第")}{curIdx + 1}{lang === "zh" ? "集" : ""} · {t("ความยาก ", "Hardness ", "难度 ")}{cur.hard}</small>
        <p>{brief ? T3(lang, ...brief) : playable(cur.id) ? "" : t("ด่านนี้กำลังสร้างเป็น 3D — เล่นแบบ 2D ได้ที่โหมด Adventure", "This map is being built in 3D — play it in 2D in Adventure for now.", "这张地图的3D版正在制作中——目前可在Adventure中玩2D版。")}</p>
        {cur.boss && cur.boss[0] !== "-" && <small>👹 {T3(lang, cur.boss[0], cur.boss[1], cur.boss[2])}</small>}
        <button className="ra-go" data-ra-play="1" disabled={!playable(cur.id) || !open(curIdx)} onClick={() => go(cur.id)}>{!open(curIdx) ? t("🔒 เคลียร์ด่านก่อนหน้า", "🔒 Clear the map before", "🔒 先通关前一关") : playable(cur.id) ? t("▶ เล่น", "▶ PLAY", "▶ 开始") : t("เร็วๆ นี้", "Coming soon", "即将推出")}</button>
      </aside>
      <button className="ra-cont" data-ra-continue="1" disabled={next3d < 0} onClick={() => { if (next3d >= 0) { setSel(RA_PLANETS[next3d].id); go(RA_PLANETS[next3d].id); } }}>
        {next3d >= 0 ? t("▶ เริ่มต่อ · ", "▶ Continue · ", "▶ 继续 · ") + shortName(T3(lang, RA_PLANETS[next3d].th, RA_PLANETS[next3d].en, RA_PLANETS[next3d].zh)) : t("ด่าน 3D ที่มีตอนนี้เคลียร์หมดแล้ว — ด่านใหม่กำลังมา", "Every 3D map so far is cleared — more are coming", "目前的3D关卡已全部通关——新关卡即将推出")}
      </button>
    </div>
  );
}

const CSS = `
.ra-coop{position:absolute;right:12px;top:52px;z-index:8;width:250px;background:#0b1620f0;border:1px solid #5affc877;border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:12px}.ra-coop-x{position:absolute;right:6px;top:6px;width:26px;height:26px;border-radius:50%;border:1px solid #ffffff44;background:transparent;color:#fff;cursor:pointer}.ra-coop-row{display:flex;gap:6px}.ra-coop-row input{flex:1;min-width:0;height:34px;border-radius:17px;border:1px solid #ffffff44;background:#13212c;color:#fff;padding:0 12px;text-transform:uppercase}.ra-coop-row button,.ra-coop .ra-go{height:34px;border-radius:17px;border:0;background:#1f7a5a;color:#fff;font-weight:800;padding:0 14px;cursor:pointer}.ra-coop-code{font-size:26px;letter-spacing:6px;font-weight:900;text-align:center;color:#5affc8}.ra-coop-peers{display:flex;flex-wrap:wrap;gap:6px}.ra-coop-peers span{background:#13212c;border-radius:12px;padding:3px 9px}.ra-coop .ra-ghost{height:30px;border-radius:15px;border:1px solid #ffffff44;background:transparent;color:#cfe;cursor:pointer}.ra-coop small{opacity:.8}
.ra-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;max-width:48%}.ra-tabs button{white-space:nowrap;height:30px;padding:0 12px;border-radius:15px;border:1px solid #ffffff33;background:#0b1a24cc;color:#cfe;font-weight:800;font-size:11px;cursor:pointer}.ra-tabs button.on{background:#1f7a5a;border-color:#5affc8;color:#fff}
.ra-load{position:fixed;inset:0;z-index:2450;background:#02070c;color:#9dffd6;display:flex;align-items:center;justify-content:center;font-weight:800}
.ra-hub{position:fixed;inset:0;z-index:2450;overflow:hidden;color:#e8fff6;font-family:system-ui,-apple-system,sans-serif;background:radial-gradient(120% 100% at 50% 0,#0a2a3a 0,#04121c 55%,#010509 100%);user-select:none;-webkit-user-select:none}
.ra-hub.rot{inset:auto;top:0;left:100%;width:100vh;height:100vw;transform-origin:0 0;transform:rotate(90deg)}
.ra-stars{position:absolute;inset:-10% -10%;pointer-events:none;background-repeat:repeat}
.ra-stars.s1{background-image:radial-gradient(1px 1px at 12% 20%,#fff9,transparent),radial-gradient(1px 1px at 37% 70%,#fff8,transparent),radial-gradient(1.4px 1.4px at 62% 15%,#fffc,transparent),radial-gradient(1px 1px at 83% 55%,#fff9,transparent),radial-gradient(1px 1px at 92% 12%,#fff7,transparent);background-size:340px 260px;animation:ra-drift 120s linear infinite}
.ra-stars.s2{background-image:radial-gradient(1.8px 1.8px at 22% 40%,#9dffe8,transparent),radial-gradient(1.6px 1.6px at 70% 80%,#ffc8ff,transparent),radial-gradient(2px 2px at 48% 8%,#fff,transparent);background-size:520px 380px;animation:ra-drift 70s linear infinite}
@keyframes ra-drift{to{background-position:-520px 0}}
.ra-neb{position:absolute;inset:0;pointer-events:none;background:radial-gradient(40% 50% at 22% 78%,#1c8a6a33,transparent 70%),radial-gradient(35% 45% at 80% 30%,#7a3aff2a,transparent 70%)}
.ra-head{position:absolute;left:0;right:0;top:0;z-index:5;display:flex;align-items:center;gap:10px;padding:8px 12px}
.ra-x{width:36px;height:36px;border-radius:50%;border:1px solid #ffffff33;background:#0b1a24cc;color:#fff;font-size:16px;font-weight:900;cursor:pointer}
.ra-title{flex:1;min-width:0}.ra-title h1{margin:0;white-space:nowrap;font-size:15px;letter-spacing:2px;font-weight:900;text-shadow:0 0 18px #5affc8aa}.ra-title h1 b{color:#5affc8}.ra-title span{display:block;font-size:11px;opacity:.75}
.ra-opts{display:flex;align-items:center;gap:6px;font-size:11px}.ra-opts button{min-width:44px;height:30px;padding:0 10px;border-radius:15px;border:1px solid #ffffff33;background:#0b1a24cc;color:#cfe;font-weight:800;cursor:pointer}.ra-opts button.on{background:#1c8a6a;border-color:#5affc8;color:#fff}
.ra-stage{position:absolute;left:0;right:0;top:72px;bottom:58px;perspective:900px;perspective-origin:50% 8%;--tx:0deg;--ty:0deg}
.ra-plane{position:absolute;left:3%;right:3%;top:0;height:100%;transform-style:preserve-3d;transform:rotateX(calc(30deg + var(--ty))) rotateZ(var(--tx));transition:transform .25s ease-out}
.ra-grid{position:absolute;inset:-6% -2%;border-radius:18px;background:linear-gradient(#5affc844 1px,transparent 1px) 0 0/52px 52px,linear-gradient(90deg,#5affc844 1px,transparent 1px) 0 0/52px 52px,radial-gradient(70% 70% at 50% 50%,#0f3a4c88,#06141c00 75%);box-shadow:inset 0 0 60px #5affc822;-webkit-mask-image:radial-gradient(75% 75% at 50% 50%,#000 55%,transparent 100%);mask-image:radial-gradient(75% 75% at 50% 50%,#000 55%,transparent 100%)}
.ra-route{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 6px #5affc8)}
.ra-pl{position:absolute;transform:translate(-50%,-100%) rotateX(-30deg);transform-origin:50% 100%;background:none;border:0;padding:0;color:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:96px}
.ra-pl:before{content:"";position:absolute;left:50%;bottom:-6px;width:calc(var(--s) * 1.3);height:calc(var(--s) * .42);margin-left:calc(var(--s) * -.65);border-radius:50%;background:radial-gradient(closest-side,#000a,transparent);transform:rotateX(46deg) translateZ(0)}
.ra-orb{position:relative;display:block;width:var(--s);height:var(--s);animation:ra-bob 3.6s ease-in-out var(--d) infinite;transform-style:preserve-3d}
.ra-orb:before{content:"";position:absolute;inset:-26%;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--c) 60%,transparent),transparent 72%);opacity:.65}
.ra-orb img{position:relative;width:100%;height:100%;border-radius:50%;display:block;box-shadow:inset -8px -10px 18px #000a,0 8px 18px #0008}
.ra-orb b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;background:#0008;border-radius:50%}.ra-orb em{position:absolute;right:-4px;top:-4px;width:20px;height:20px;border-radius:50%;background:#2ecf7a;color:#fff;font-style:normal;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center}
@keyframes ra-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.ra-nm{font-size:10px;font-weight:800;text-align:center;line-height:1.15;text-shadow:0 1px 6px #000;max-width:76px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ra-pl u{font-size:9px;text-decoration:none;font-weight:900;letter-spacing:.5px;padding:1px 7px;border-radius:9px;background:#ffffff1a;opacity:.75}.ra-pl u.g{background:#2ecf7a;color:#03140c;opacity:1}
.ra-pl.lock{opacity:.7;filter:grayscale(.55)}.ra-pl.next .ra-orb{animation:ra-bob 2.2s ease-in-out var(--d) infinite}.ra-pl.next .ra-orb:before{opacity:1;inset:-40%;background:radial-gradient(closest-side,#ffb04acc,transparent 72%)}
.ra-pl.sel .ra-nm{color:#5affc8}.ra-pl.sel .ra-orb:before{opacity:1;inset:-34%}
.ra-card{position:absolute;right:12px;bottom:10px;z-index:6;width:min(300px,42vw);max-height:40%;overflow:auto;padding:9px 12px;border-radius:18px;background:linear-gradient(160deg,#0b2634ee,#06141cee);border:1px solid #5affc855;box-shadow:0 10px 30px #000a;display:flex;flex-direction:column;gap:3px}
.ra-card b{font-size:15px}.ra-card small{opacity:.75;font-size:11px}.ra-card p{margin:2px 0;font-size:11.5px;line-height:1.35;opacity:.92}
.ra-go{margin-top:4px;align-self:flex-end;min-width:112px;padding:0 22px;height:30px;border-radius:15px;letter-spacing:.5px;border:0;background:linear-gradient(135deg,#1fd69a,#0aa070);color:#03140c;font-weight:900;font-size:12.5px;cursor:pointer;box-shadow:0 4px 12px -5px #1fd69a}.ra-go:disabled{background:#ffffff1f;color:#ffffff88;box-shadow:none;cursor:default}
.ra-cont{position:absolute;left:12px;bottom:10px;z-index:6;max-width:calc(100% - min(300px,42vw) - 36px);min-height:44px;padding:0 18px;border-radius:24px;border:0;background:linear-gradient(135deg,#ffb04a,#ff7a2a);color:#2a1004;font-weight:900;font-size:14px;cursor:pointer;box-shadow:0 8px 22px -8px #ff7a2a}.ra-cont:disabled{background:#ffffff1f;color:#ffffffaa;box-shadow:none;font-size:11.5px;font-weight:700;cursor:default}
@media (max-height:420px){.ra-title h1{font-size:15px}.ra-title span{display:none}.ra-stage{top:62px;bottom:50px}.ra-card{padding:6px 10px}.ra-card p{font-size:10.5px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.ra-cont{min-height:38px}}
@media (prefers-reduced-motion:reduce){.ra-orb,.ra-stars{animation:none}}
`;
