/* The Ark shipyard (owner, 2026-10-12, a bespoke mechanic for "Shipyard · build the Ark": the player places the modules, it is not a recoloured mining map).
   Eight modules go onto a spine of eight slots, bow to stern. Every rule is a real reason an engineer would give (a reactor next to the engines, a gravity ring
   at the middle so the ship spins about its centre, farms away from reactor heat…), shown live as a checklist with a tick or a cross, plus a centre-of-mass bar.
   When every module is down and every rule holds the Ark is launched. Fewer moves earn more stars. DOM only, no timer: it is a puzzle, not a race. */
import { useEffect, useRef, useState } from "react";
import { createAdvSfx } from "./adventure-sfx";
import { createAdvMusic } from "./adventure-music";
import { GearButton, SettingsPopup } from "./adventure-settings";
import { useFpv, FpvButton, FpvVisor } from "./fpv";
import { useDeck3D, can3dDeck } from "./adventure-deck-hook";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
type L3 = [string, string, string];
type Mod = { id: string; icon: string; mass: number; name: L3; why: L3 };
export const YARD_MODS: Mod[] = [
  { id: "bridge", icon: "🧭", mass: 1, name: ["สะพานเดินเรือ", "Bridge", "舰桥"], why: ["อยู่หัวเรือ เพื่อมองเห็นทางข้างหน้า", "It sits at the bow so the crew can see ahead.", "位于船头，方便看清前方。"] },
  { id: "shield", icon: "🛡", mass: 3, name: ["โล่ป้องกัน", "Shield", "护盾"], why: ["อยู่หลังสะพานทันที เพื่อกันฝุ่นและอุกกาบาตให้ทั้งลำ", "Right behind the bridge, it takes the dust and rocks for the whole hull.", "紧跟舰桥之后，为整艘船挡住尘埃与陨石。"] },
  { id: "farm", icon: "🌱", mass: 2, name: ["ฟาร์มพืช", "Hydroponic farm", "水培农场"], why: ["ต้องอยู่ติดฟาร์มสัตว์ เพราะใช้น้ำและปุ๋ยร่วมกัน", "It must touch the livestock deck: they share water and nutrients.", "必须紧邻牲畜舱，共用水和养分。"] },
  { id: "herd", icon: "🐄", mass: 2, name: ["ฟาร์มสัตว์", "Livestock deck", "牲畜舱"], why: ["ติดฟาร์มพืช และอยู่ห่างความร้อนของเครื่องปฏิกรณ์", "Next to the farm, and away from the reactor's heat.", "紧邻农场，并远离反应堆的热量。"] },
  { id: "ring", icon: "🌀", mass: 4, name: ["วงแหวนแรงโน้มถ่วง", "Gravity ring", "重力环"], why: ["อยู่กลางลำ เพื่อให้เรือหมุนรอบจุดศูนย์กลางอย่างสมดุล", "In the middle, so the ship spins about its own centre.", "位于中部，飞船才能围绕自身中心平稳旋转。"] },
  { id: "hab", icon: "🏠", mass: 3, name: ["ที่อยู่อาศัย", "Habitat", "居住舱"], why: ["ติดวงแหวน เพราะคนต้องอยู่ในแรงโน้มถ่วง", "Beside the ring: people have to live in gravity.", "紧邻重力环，因为人需要生活在重力之中。"] },
  { id: "reactor", icon: "☢", mass: 5, name: ["เครื่องปฏิกรณ์", "Reactor", "反应堆"], why: ["ติดเครื่องยนต์ เพื่อส่งพลังงานสั้นที่สุด", "Beside the engines, so the power lines are short.", "紧邻引擎，输电线路最短。"] },
  { id: "engine", icon: "🚀", mass: 4, name: ["เครื่องยนต์", "Engines", "引擎"], why: ["อยู่ท้ายเรือ ดันยานไปข้างหน้า", "At the stern, pushing the ship forward.", "位于船尾，推动飞船前进。"] },
];
type Rule = { k: string; text: L3; ok: (s: (string | null)[]) => boolean };
const pos = (s: (string | null)[], id: string) => s.indexOf(id);
export const YARD_RULES: Rule[] = [
  { k: "bridge", text: ["สะพานอยู่หัวเรือ", "The bridge is at the bow", "舰桥在船头"], ok: (s) => pos(s, "bridge") === 0 },
  { k: "engine", text: ["เครื่องยนต์อยู่ท้ายเรือ", "The engines are at the stern", "引擎在船尾"], ok: (s) => pos(s, "engine") === 7 },
  { k: "reactor", text: ["เครื่องปฏิกรณ์ติดเครื่องยนต์", "The reactor touches the engines", "反应堆紧邻引擎"], ok: (s) => pos(s, "reactor") === 6 },
  { k: "shield", text: ["โล่อยู่หลังสะพาน", "The shield is right behind the bridge", "护盾紧跟舰桥"], ok: (s) => pos(s, "shield") === 1 },
  { k: "ring", text: ["วงแหวนอยู่กลางลำ", "The gravity ring is in the middle", "重力环在中部"], ok: (s) => pos(s, "ring") === 3 || pos(s, "ring") === 4 },
  { k: "hab", text: ["ที่อยู่อาศัยติดวงแหวน", "The habitat is beside the ring", "居住舱紧邻重力环"], ok: (s) => { const a = pos(s, "hab"), b = pos(s, "ring"); return a >= 0 && b >= 0 && Math.abs(a - b) === 1; } },
  { k: "farms", text: ["ฟาร์มพืชติดฟาร์มสัตว์", "The farm touches the livestock deck", "农场紧邻牲畜舱"], ok: (s) => { const a = pos(s, "farm"), b = pos(s, "herd"); return a >= 0 && b >= 0 && Math.abs(a - b) === 1; } },
  { k: "heat", text: ["ฟาร์มอยู่ห่างความร้อนของเครื่องปฏิกรณ์", "Farms stay away from the reactor's heat", "农场远离反应堆的热量"], ok: (s) => { const r = pos(s, "reactor"); if (r < 0) return false; for (const id of ["farm", "herd"]) { const p = pos(s, id); if (p < 0 || Math.abs(p - r) <= 1) return false; } return true; } },
];
export const yardBalance = (s: (string | null)[]) => { let m = 0, w = 0; s.forEach((id, i) => { const mod = YARD_MODS.find(x => x.id === id); if (mod) { m += mod.mass * i; w += mod.mass; } }); return w ? m / w : 3.5; };
export const yardSolved = (s: (string | null)[]) => s.every(Boolean) && YARD_RULES.every(r => r.ok(s)) && yardBalance(s) >= 2.6 && yardBalance(s) <= 4.4;

export default function AdventureYard({ P, lang, onWin, onExit }: any) {
  const t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const G = useRef<any>(null); if (!G.current) G.current = { slots: Array(8).fill(null) as (string | null)[], moves: 0, won: false };
  const [, setTick] = useState(0), [hold, setHold] = useState<string | null>(null), [gear, setGear] = useState(false), pausedRef = useRef(false), [why, setWhy] = useState<string | null>(null);
  const [fpv, flipFpv] = useFpv();   // first-person view: a helmet visor over the board
  const d3 = useDeck3D("yard"), high = d3.high, setHigh = (_: boolean) => {};
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  const sfxRef = useRef<any>(null), musRef = useRef<any>(null), S = G.current;
  useEffect(() => {
    const sfx = createAdvSfx(); sfxRef.current = sfx; sfx.setOn(musicOn); const mus = createAdvMusic(P.id); musRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); mus.setIntensity && mus.setIntensity(1); }
    (window as any).__advYard = { state: () => ({ slots: S.slots.slice(), moves: S.moves, won: S.won, balance: yardBalance(S.slots) }), place: (id: string, slot: number) => place(id, slot), solve: () => { ["bridge", "shield", "farm", "herd", "ring", "hab", "reactor", "engine"].forEach((id, i) => place(id, i)); } };
    return () => { if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advYard; } catch (e) {} };
  }, []);
  const rerender = () => setTick(x => x + 1);
  function place(id: string, slot: number) {
    if (S.won || slot < 0 || slot > 7) return; const from = S.slots.indexOf(id); const there = S.slots[slot];
    if (from >= 0) S.slots[from] = there; S.slots[slot] = id; S.moves++;   // dropping on an occupied slot swaps the two
    if (sfxRef.current) sfxRef.current.play("punch");
    if (yardSolved(S.slots) && !S.won) { S.won = true; if (sfxRef.current) sfxRef.current.play("win"); const stars = S.moves <= 11 ? 3 : S.moves <= 18 ? 2 : 1; setTimeout(() => onWin({ yard: { moves: S.moves, stars }, kills: 0, cry: 8 + 4 * stars, loot: {}, mode: "yard" }), 1800); }
    setHold(null); rerender();
  }
  const tray = YARD_MODS.filter(m => !S.slots.includes(m.id)), bal = yardBalance(S.slots), balOk = bal >= 2.6 && bal <= 4.4, placed = S.slots.filter(Boolean).length;
  const openGear = () => { pausedRef.current = true; setGear(true); }, closeGear = () => { pausedRef.current = false; setGear(false); };
  const modOf = (id: string | null) => YARD_MODS.find(m => m.id === id) || null;
  return (
    <div className={"adv-farm adv-yard" + (d3.is3d ? " a3" : "")} data-yard="1">
      <div ref={d3.host} className="adv-3d" aria-hidden="true" />
      {d3.msg && <div className="adv-3dmsg" role="status">{d3.msg}</div>}
      <div className="adv-top">
        <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
        <div className="adv-hud"><div className="adv-lv">🛠 {T3(lang, P.th, P.en, P.zh).split(" · ")[0]} · {t("วางแล้ว ", "Placed ", "已放置 ")}{placed}/8 · {t("ครั้งที่ย้าย ", "Moves ", "移动 ")}{S.moves}</div></div>
        <div className="fpv-tr"><FpvButton lang={lang} on={fpv} onClick={flipFpv} /><GearButton onClick={openGear} /></div>
      </div>
      {fpv && <FpvVisor />}
      <div className="ay-dir"><span>{t("◀ หัวเรือ", "◀ BOW", "◀ 船头")}</span><span>{t("ท้ายเรือ ▶", "STERN ▶", "船尾 ▶")}</span></div>
      <div className="ay-spine">
        {S.slots.map((id: string | null, i: number) => { const m = modOf(id); return (
          <button key={i} data-slot={i} className={"ay-slot" + (m ? " full" : "") + (hold ? " drop" : "")} onClick={() => { if (hold) place(hold, i); else if (m) { setHold(m.id); setWhy(m.id); } }}>
            {m ? (<><span className="af-ic">{m.icon}</span><small>{T3(lang, m.name[0], m.name[1], m.name[2])}</small><em>{m.mass}t</em></>) : <small style={{ opacity: 0.5 }}>{i + 1}</small>}
          </button>); })}
      </div>
      <div className="ay-bal" data-bal={balOk ? "ok" : "off"}><span>{t("จุดศูนย์กลางมวล", "Centre of mass", "质心")}</span><div className="af-bar"><i style={{ width: Math.max(0, Math.min(100, bal / 7 * 100)) + "%", background: balOk ? "#7dffa8" : "#ff9a6b" }} /></div><b>{placed ? bal.toFixed(1) : "–"}</b></div>
      <div className="ay-tray">
        {tray.map(m => (<button key={m.id} data-mod={m.id} className={"ay-mod" + (hold === m.id ? " on" : "")} onClick={() => { setHold(h => (h === m.id ? null : m.id)); setWhy(m.id); }}><span className="af-ic">{m.icon}</span><small>{T3(lang, m.name[0], m.name[1], m.name[2])}</small><em>{m.mass}t</em></button>))}
        {!tray.length && <small style={{ opacity: 0.7 }}>{t("วางครบแล้ว — แตะโมดูลเพื่อสลับตำแหน่ง", "All placed. Tap a module to move it.", "已全部放置——点按模块可调整位置。")}</small>}
      </div>
      <div className="af-fact" data-why="1">💡 {why ? (() => { const m = modOf(why)!; return T3(lang, m.name[0], m.name[1], m.name[2]) + " — " + T3(lang, m.why[0], m.why[1], m.why[2]); })() : t("เลือกโมดูล แล้วแตะช่องบนแกนเรือเพื่อวาง แต่ละกฎด้านล่างมีเหตุผลจริงทางวิศวกรรม", "Pick a module, then tap a slot on the spine. Each rule below is a real engineering reason.", "先选模块，再点按船脊上的槽位。下面每条规则都有真实的工程理由。")}</div>
      <ul className="ay-rules">{YARD_RULES.map(r => { const ok = r.ok(S.slots); return <li key={r.k} data-rule={r.k} data-ok={ok ? "1" : "0"} className={ok ? "ok" : ""}>{ok ? "✓" : "○"} {T3(lang, r.text[0], r.text[1], r.text[2])}</li>; })}<li data-rule="balance" data-ok={balOk && placed === 8 ? "1" : "0"} className={balOk && placed === 8 ? "ok" : ""}>{balOk && placed === 8 ? "✓" : "○"} {t("จุดศูนย์กลางมวลอยู่กลางลำ", "The centre of mass is near the middle", "质心靠近中部")}</li></ul>
      {S.won && <div className="adv-clear" role="status"><b>🚀 {t("อาร์คผ่านการตรวจ — ปล่อยยาน!", "The Ark passes inspection — launch!", "方舟通过检验——发射！")}</b></div>}
      {gear && <SettingsPopup lang={lang} level={d3.gfx} onLevel={d3.setLevel} can3d={can3dDeck()} high={high} onGfx={() => d3.setLevel(high ? "standard" : "high")} musicOn={musicOn} onMusic={() => setMusicOn(m => { const n = !m; try { localStorage.setItem("tg_adv_music", n ? "1" : "0"); } catch (e) {} if (musRef.current && musRef.current.setOn) musRef.current.setOn(n); if (sfxRef.current) sfxRef.current.setOn(n); return n; })} online={false} onResume={closeGear} onExit={() => { pausedRef.current = false; onExit(); }} />}
    </div>
  );
}
