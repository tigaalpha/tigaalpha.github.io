/* The Ark's farm decks (owner, 2026-10-12: grow food with advanced technology and raise gene-edited animals to feed the population that will cross the stars).
   Two maps share this one management game: `plants` (a hydroponic farm) and `herd` (gene-edited livestock). Six cells, three resources that drain while things grow
   (tap to refill), a crop or animal for each cell, outbreaks to treat, three technology upgrades bought with the food already made, and a target to reach before
   the time is up. The Ark you outfitted in the Ark Bay matters: farm decks raise crop yield, livestock decks raise animal yield, habitat raises the target. DOM only. */
import { useEffect, useRef, useState } from "react";
import { createAdvSfx } from "./adventure-sfx";
import { createAdvMusic } from "./adventure-music";
import { GearButton, SettingsPopup } from "./adventure-settings";
import { useFpv, FpvButton, FpvVisor } from "./fpv";
import { readArk } from "./adventure-ark";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
type L3 = [string, string, string];
type Kind = { icon: string; res: { k: string; icon: string; name: L3 }[]; types: { id: string; icon: string; name: L3; time: number; yield: number; use: number }[]; tech: { id: string; name: L3; cost: number; text: L3 }[]; facts: L3[]; sick: L3 };
const KINDS: Record<string, Kind> = {
  plants: {
    icon: "🌱",
    res: [{ k: "a", icon: "💧", name: ["น้ำ", "Water", "水"] }, { k: "b", icon: "💡", name: ["แสง LED", "LED light", "LED 光"] }, { k: "c", icon: "🧪", name: ["สารอาหาร", "Nutrients", "营养液"] }],
    types: [
      { id: "algae", icon: "🟢", name: ["สาหร่ายสไปรูลินา", "Spirulina algae", "螺旋藻"], time: 12, yield: 6, use: 0.7 },
      { id: "greens", icon: "🥬", name: ["ผักใบเขียว", "Leafy greens", "叶菜"], time: 16, yield: 9, use: 0.8 },
      { id: "potato", icon: "🥔", name: ["มันฝรั่ง", "Potato", "土豆"], time: 24, yield: 16, use: 1 },
      { id: "wheat", icon: "🌾", name: ["ข้าวสาลีพันธุ์เตี้ย", "Dwarf wheat", "矮秆小麦"], time: 30, yield: 22, use: 1.1 },
      { id: "rice", icon: "🍚", name: ["ข้าวประหยัดน้ำ", "Low-water rice", "节水稻"], time: 36, yield: 30, use: 1.2 },
    ],
    tech: [
      { id: "led", name: ["แสง LED สเปกตรัมพืช", "Plant-spectrum LEDs", "植物光谱 LED"], cost: 25, text: ["โตเร็วขึ้น 25%", "grow 25% faster", "生长快 25%"] },
      { id: "gene", name: ["พืชตัดแต่งยีนผลผลิตสูง", "High-yield gene-edited crops", "高产基因编辑作物"], cost: 40, text: ["ผลผลิต +30%", "yield +30%", "产量 +30%"] },
      { id: "aero", name: ["ระบบพ่นหมอกรากพืช", "Aeroponic root mist", "气雾栽培"], cost: 60, text: ["ใช้น้ำและสารอาหารน้อยลง 30%", "30% less water and nutrients", "省水省肥 30%"] },
    ],
    facts: [["ไฮโดรโปนิกส์ปลูกพืชในน้ำผสมสารอาหาร ไม่ต้องใช้ดิน และใช้น้ำน้อยกว่าการปลูกในดินมาก", "Hydroponics grows plants in nutrient water with no soil and uses far less water than field farming.", "水培用营养液代替土壤，用水比大田种植少得多。"], ["พืชไม่ต้องการแสงขาว ไฟ LED สีแดงและน้ำเงินช่วยประหยัดพลังงานได้", "Plants do not need white light: red and blue LEDs save power.", "植物不需要白光，红蓝 LED 更省电。"], ["สาหร่ายโตเร็วมากและมีโปรตีนสูง เหมาะกับยานที่มีที่จำกัด", "Algae grow very fast and are rich in protein, ideal where space is tight.", "藻类生长极快、蛋白质丰富，适合空间有限的飞船。"], ["ปลูกเป็นชั้นซ้อนกันแนวตั้ง เพื่อได้อาหารมากขึ้นในพื้นที่เท่าเดิม", "Stacking crops in vertical layers gives more food from the same floor space.", "垂直分层种植能在同样面积上收获更多。"]],
    sick: ["โรคพืชระบาด! แตะเพื่อรักษา", "Blight! Tap to treat", "病害！点击治疗"],
  },
  herd: {
    icon: "🐄",
    res: [{ k: "a", icon: "🌾", name: ["อาหารสัตว์", "Feed", "饲料"] }, { k: "b", icon: "💧", name: ["น้ำ", "Water", "水"] }, { k: "c", icon: "💉", name: ["วัคซีนและสุขภาพ", "Vaccine & care", "疫苗与护理"] }],
    types: [
      { id: "crickets", icon: "🦗", name: ["จิ้งหรีดโปรตีน", "Protein crickets", "蛋白蟋蟀"], time: 12, yield: 6, use: 0.7 },
      { id: "fish", icon: "🐟", name: ["ปลาโตเร็วตัดแต่งยีน", "Gene-edited fast fish", "基因编辑速生鱼"], time: 18, yield: 12, use: 0.9 },
      { id: "chicken", icon: "🐔", name: ["ไก่ต้านโรค", "Disease-resistant chickens", "抗病鸡"], time: 24, yield: 18, use: 1 },
      { id: "pig", icon: "🐖", name: ["หมูโตไวตัดแต่งยีน", "Fast-growth gene-edited pigs", "基因编辑速生猪"], time: 32, yield: 28, use: 1.2 },
      { id: "cow", icon: "🐄", name: ["วัวนมประหยัดอาหาร", "Feed-efficient dairy cows", "节粮奶牛"], time: 40, yield: 40, use: 1.3 },
    ],
    tech: [
      { id: "gene", name: ["ตัดแต่งยีนโตเร็ว", "Gene edit: fast growth", "基因编辑：快速生长"], cost: 25, text: ["โตเร็วขึ้น 25%", "grow 25% faster", "生长快 25%"] },
      { id: "resist", name: ["ตัดแต่งยีนต้านโรค", "Gene edit: disease resistance", "基因编辑：抗病"], cost: 40, text: ["โรคระบาดน้อยลงครึ่งหนึ่ง", "half as many outbreaks", "疫情减半"] },
      { id: "micro", name: ["จุลินทรีย์ในลำไส้ประหยัดอาหาร", "Feed-saving gut microbiome", "节粮肠道菌群"], cost: 60, text: ["ใช้อาหารและน้ำน้อยลง 30%", "30% less feed and water", "省料省水 30%"] },
    ],
    facts: [["การตัดแต่งพันธุกรรมช่วยให้สัตว์โตเร็วและต้านทานโรคได้ ใช้อาหารน้อยลงต่อกิโลกรัมเนื้อ", "Gene editing can make animals grow faster and resist disease, using less feed per kilogram of meat.", "基因编辑可让动物长得更快、更抗病，每公斤肉耗料更少。"], ["แมลงและปลาเปลี่ยนอาหารเป็นโปรตีนได้ดีกว่าวัว จึงเหมาะกับยานอวกาศ", "Insects and fish turn feed into protein better than cattle, which suits a spaceship.", "昆虫和鱼把饲料转化成蛋白质的效率高于牛，适合太空船。"], ["ฟาร์มในยานต้องมีวัคซีนและระบบแยกโรค เพราะโรคระบาดหนึ่งครั้งอาจทำให้อาหารขาดทั้งยาน", "A ship's farm needs vaccines and quarantine: one outbreak could starve the whole vessel.", "飞船农场需要疫苗和隔离，一次疫情就可能让全船断粮。"], ["สัตว์ต้องการแรงโน้มถ่วงพอสมควร วงแหวนของ Ark จึงต้องหมุนต่อเนื่อง", "Animals need decent gravity, so the Ark's ring has to keep turning.", "动物需要一定的重力，所以方舟的环必须持续旋转。"]],
    sick: ["โรคระบาด! แตะเพื่อฉีดวัคซีน", "Outbreak! Tap to vaccinate", "疫情！点击接种"],
  },
};
const DUR = 150, CELLS = 6;

export default function AdventureFarm({ P, lang, onWin, onExit, onRetry }: any) {
  const kind: Kind = KINDS[P.kind === "herd" ? "herd" : "plants"], t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const ark = readArk(), lvl = P.kind === "herd" ? ark.l : ark.f, ymul = 1 + 0.08 * lvl, target = 600 + 60 * ark.h;   // calibrated with a simulation of these rules: a careful player makes ~850 in 150 s, a lazy one ~450
  const G = useRef<any>(null); if (!G.current) G.current = { t: 0, res: [80, 80, 80], cd: [0, 0, 0], cells: Array.from({ length: CELLS }, () => ({ ty: null as any, p: 0, sick: 0 })), made: 0, spent: 0, tech: [false, false, false], sickT: 8, ended: false, won: false, fact: 0 };
  const [, setTick] = useState(0), [pick, setPick] = useState<number | null>(null), [gear, setGear] = useState(false), pausedRef = useRef(false);
  const [fpv, flipFpv] = useFpv();   // first-person view: a helmet visor over the board
  const [high, setHigh] = useState(() => { try { return localStorage.getItem("tg_adv_gfx") === "high"; } catch (e) { return false; } });
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  const sfxRef = useRef<any>(null), musRef = useRef<any>(null);
  useEffect(() => {
    const sfx = createAdvSfx(); sfxRef.current = sfx; sfx.setOn(musicOn); const mus = createAdvMusic(P.id); musRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); mus.setIntensity && mus.setIntensity(2); }
    const S = G.current; let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; if (pausedRef.current || S.ended) return;
      S.t += dt; S.cd = S.cd.map((c: number) => Math.max(0, c - dt));
      const gm = S.tech[0] ? 1.25 : 1, um = (S.tech[2] ? 0.7 : 1), yt = S.tech[1] && kind.tech[1].id === "gene" && P.kind !== "herd" ? 1.3 : 1;
      let growing = 0; for (const c of S.cells) if (c.ty && c.p < 100 && !c.sick) growing += (c.ty.use);
      const drain = [1.1, 0.9, 0.7]; for (let i = 0; i < 3; i++) S.res[i] = Math.max(0, S.res[i] - drain[i] * growing * um * dt);
      const f = Math.min(1, S.res[0] / 25, S.res[1] / 25, S.res[2] / 25);
      for (const c of S.cells) if (c.ty && c.p < 100 && !c.sick) c.p = Math.min(100, c.p + 100 / c.ty.time * gm * f * dt);
      S.sickT -= dt; if (S.sickT <= 0) { S.sickT = (P.kind === "herd" && S.tech[1] ? 24 : 13) - Math.min(4, S.t / 40); const live = S.cells.filter((c: any) => c.ty && c.p < 100 && !c.sick); if (live.length) { const c = live[Math.floor(Math.random() * live.length)]; c.sick = 8; sfx.play("hurt"); } }
      for (const c of S.cells) if (c.sick > 0) { c.sick -= dt; if (c.sick <= 0) { c.sick = 0; c.ty = null; c.p = 0; sfx.play("boom"); } }
      S.fact = Math.floor(S.t / 18) % kind.facts.length; void yt;
      if (S.made >= target && !S.won) { S.won = true; S.ended = true; sfx.play("win"); const left = DUR - S.t, stars = left > 60 ? 3 : left > 30 ? 2 : 1; setTimeout(() => onWin({ farm: { made: Math.round(S.made), target, stars, kind: P.kind }, kills: 0, cry: 8 + 4 * stars, loot: {}, mode: "farm" }), 1800); }
      else if (S.t >= DUR && !S.ended) { S.ended = true; sfx.play("hurt"); }
      setTick(x => (x + 1) % 1e6);
    }, 100);
    (window as any).__advFarm = { state: () => ({ t: S.t, made: S.made, target, res: S.res.slice(), cells: S.cells.map((c: any) => ({ ty: c.ty && c.ty.id, p: c.p, sick: c.sick })), tech: S.tech.slice(), ended: S.ended, won: S.won }), grow: () => { for (const c of S.cells) if (c.ty) c.p = Math.max(c.p, 99.9); }, make: (n: number) => { S.made += n; }, sickNow: () => { const c = S.cells.find((q: any) => q.ty && q.p < 100); if (c) c.sick = 8; } };
    return () => { clearInterval(id); if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advFarm; } catch (e) {} };
  }, []);
  const S = G.current, stock = Math.floor(S.made - S.spent);
  const plant = (i: number, ty: any) => { const c = S.cells[i]; if (!c || c.ty) return; c.ty = ty; c.p = 0; c.sick = 0; sfxRef.current && sfxRef.current.play("pop"); setPick(null); };
  const tapCell = (i: number) => {
    const c = S.cells[i]; if (S.ended) return;
    if (!c.ty) { setPick(i); return; }
    if (c.sick > 0) { c.sick = 0; sfxRef.current && sfxRef.current.play("pickup"); return; }
    if (c.p >= 100) { const y = c.ty.yield * ymul * (S.tech[1] && P.kind !== "herd" ? 1.3 : 1); S.made += y; c.ty = null; c.p = 0; sfxRef.current && sfxRef.current.play("pickup"); setTick(x => x + 1); }
  };
  const refill = (i: number) => { if (S.ended || S.cd[i] > 0) return; S.res[i] = Math.min(100, S.res[i] + 38); S.cd[i] = 1.1; sfxRef.current && sfxRef.current.play("hit"); };
  const buy = (i: number) => { const tc = kind.tech[i]; if (S.tech[i] || stock < tc.cost || S.ended) return; S.spent += tc.cost; S.tech[i] = true; sfxRef.current && sfxRef.current.play("win"); };
  const openGear = () => { pausedRef.current = true; setGear(true); }, closeGear = () => { pausedRef.current = false; setGear(false); };
  const left = Math.max(0, Math.ceil(DUR - S.t)), pct = Math.min(100, S.made / target * 100);
  return (
    <div className="adv-farm" data-farm={P.kind === "herd" ? "herd" : "plants"}>
      <div className="adv-top">
        <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
        <div className="adv-hud">
          <div className="adv-lv">{kind.icon} {T3(lang, P.th, P.en, P.zh).split(" · ")[0]} · ⏱ {left}s · {t("ผลผลิตสะสม ", "Food made ", "已产出 ")}{Math.round(S.made)}/{target} · {t("คงเหลือ ", "stock ", "库存 ")}{stock}</div>
          <div className="adv-bar adv-hp"><i style={{ width: pct + "%" }} /><b>{t("ประชากรอิ่มท้อง ", "Population fed ", "人口温饱 ")}{Math.round(pct)}%</b></div>
        </div>
        <div className="fpv-tr"><FpvButton lang={lang} on={fpv} onClick={flipFpv} /><GearButton onClick={openGear} /></div>
      </div>
      {fpv && <FpvVisor />}
      <div className="af-grid">
        {S.cells.map((c: any, i: number) => (
          <button key={i} className={"af-cell" + (c.ty ? (c.sick > 0 ? " sick" : c.p >= 100 ? " ready" : " grow") : "")} data-cell={i} onClick={() => tapCell(i)}>
            {c.ty ? (<><span className="af-ic">{c.ty.icon}</span><small>{T3(lang, c.ty.name[0], c.ty.name[1], c.ty.name[2])}</small>
              <div className="af-bar"><i style={{ width: c.p + "%" }} /></div>
              <em>{c.sick > 0 ? "⚠ " + T3(lang, kind.sick[0], kind.sick[1], kind.sick[2]) : c.p >= 100 ? "✓ " + t("เก็บเกี่ยว", "Harvest", "收获") + " +" + Math.round(c.ty.yield * ymul * (S.tech[1] && P.kind !== "herd" ? 1.3 : 1)) : Math.round(c.p) + "%"}</em></>) : (<><span className="af-ic">＋</span><small>{P.kind === "herd" ? t("เลี้ยงสัตว์", "Raise animals", "饲养") : t("เพาะปลูก", "Plant a crop", "种植")}</small></>)}
          </button>))}
      </div>
      <div className="af-res">
        {kind.res.map((r, i) => (<button key={r.k} className={"af-r" + (S.res[i] < 25 ? " low" : "") + (S.cd[i] > 0 ? " cd" : "")} data-res={i} onClick={() => refill(i)}>
          <span>{r.icon} {T3(lang, r.name[0], r.name[1], r.name[2])}</span><div className="af-bar"><i style={{ width: S.res[i] + "%" }} /></div></button>))}
      </div>
      <div className="af-tech">
        {kind.tech.map((tc, i) => (<button key={tc.id} className={"af-t" + (S.tech[i] ? " on" : "")} data-tech={i} disabled={S.tech[i] || stock < tc.cost} onClick={() => buy(i)}>
          <b>{T3(lang, tc.name[0], tc.name[1], tc.name[2])}</b><small>{S.tech[i] ? "✓ " : "◆ " + tc.cost + " · "}{T3(lang, tc.text[0], tc.text[1], tc.text[2])}</small></button>))}
      </div>
      <div className="af-fact" key={S.fact}>💡 {T3(lang, kind.facts[S.fact][0], kind.facts[S.fact][1], kind.facts[S.fact][2])}</div>
      {pick !== null && (<div className="adv-quiz" data-pick="1" style={{ alignItems: "center" }} onPointerDown={(e) => e.stopPropagation()}><div className="pvpstandby-card" style={{ maxWidth: 420 }}>
        <b>{P.kind === "herd" ? t("เลือกสัตว์ที่จะเลี้ยง", "Choose an animal", "选择要饲养的动物") : t("เลือกพืชที่จะปลูก", "Choose a crop", "选择要种的作物")}</b>
        <div className="af-pick">{kind.types.map(ty => (<button key={ty.id} className="adv-btn" data-type={ty.id} onClick={() => plant(pick, ty)}>{ty.icon} {T3(lang, ty.name[0], ty.name[1], ty.name[2])}<small>{ty.time}s · +{Math.round(ty.yield * ymul)}</small></button>))}</div>
        <button className="adv-btn" onClick={() => setPick(null)}>{t("ยกเลิก", "Cancel", "取消")}</button></div></div>)}
      {S.ended && !S.won && (<div className="adv-clear" role="dialog" aria-label="farm over"><b>{t("หมดเวลา — อาหารยังไม่พอ", "Time is up — not enough food", "时间到——食物不足")}</b><span>{Math.round(S.made)}/{target}</span>
        <div className="adv-clear-btns"><button className="adv-btn go" onClick={() => onRetry && onRetry()}>↻ {t("ลองใหม่", "Retry", "重试")}</button><button className="adv-btn" onClick={() => onExit()}>{t("เมนูแผนที่", "Map menu", "地图菜单")}</button></div></div>)}
      {S.won && <div className="adv-clear" role="status"><b>🌾 {t("เลี้ยงประชากรได้ครบ!", "The population is fed!", "全体人口温饱！")}</b></div>}
      {gear && <SettingsPopup lang={lang} high={high} onGfx={() => { const n = !high; setHigh(n); try { localStorage.setItem("tg_adv_gfx", n ? "high" : "standard"); } catch (e) {} }} musicOn={musicOn} onMusic={() => setMusicOn(m => { const n = !m; try { localStorage.setItem("tg_adv_music", n ? "1" : "0"); } catch (e) {} if (musRef.current && musRef.current.setOn) musRef.current.setOn(n); if (sfxRef.current) sfxRef.current.setOn(n); return n; })} online={false} onResume={closeGear} onExit={() => { pausedRef.current = false; onExit(); }} />}
    </div>
  );
}
