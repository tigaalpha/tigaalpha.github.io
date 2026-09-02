/* ── pve-battle.tsx ──
   Monster Battle — the PvE version of the arena.

   Same question bank, same cyber city, same attack buttons, same HP bars —
   but instead of another player's chassis, you fight a roster of monsters
   with their own stats, names and temperaments. The difficulty scales with
   a floor system (like a dungeon) so the first monster is a tutorial and
   the last one is a real exam. Music knowledge is still the weapon:
   answer right and your robot strikes; answer wrong and the monster does.

   Reuses `makeQuestion`, `fighterFrom`, `MOVES`, `pickMove` from pvp-arena
   for the music quiz, combat stats and attack animations. ── */

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { CyberAvatar, CHAR_MODELS, combatOf, normalizeModel } from "./cyber-avatar";
import { MODEL_CLASS, classOf, classKeyOf, skillsOf } from "./model-skills";
import { ItemArt } from "./item-art";
import { fighterFrom, makeQuestion, MOVES, pickMove, addSkillSp, readSkillSp, skillRank } from "./pvp-arena";

/* ══════════════════════ monster roster ══════════════════════ */

const MONSTERS = [
  {
    id: "voltkirin",
    name: { th: "Voltkirin", en: "Voltkirin", zh: "雷霆麒麟" },
    emoji: "⚡",
    color: "#00e5ff",
    glow: "#00bcd4",
    hp: 120,
    dmg: 4.5,
    acc: 0.35,
    gap: 1800,
    desc: { th: "สัตว์สายฟ้าตัวเล็ก โจมตีเร็วแต่เบา", en: "Small lightning beast — fast but weak hits", zh: "小型雷兽 — 攻击快但伤害低" },
    coins: 50, xp: 15,
    tier: "common",
  },
  {
    id: "neonphantom",
    name: { th: "Neon Phantom", en: "Neon Phantom", zh: "霓虹幻影" },
    emoji: "👻",
    color: "#e040fb",
    glow: "#ce93d8",
    hp: 160,
    dmg: 6,
    acc: 0.45,
    gap: 1500,
    desc: { th: "ผีนีออน โจมตีเจาะเกราะ", en: "Neon ghost — pierces armor", zh: "霓虹幽灵 — 穿透护甲" },
    coins: 80, xp: 25,
    tier: "common",
  },
  {
    id: "flamewyrm",
    name: { th: "Flamewyrm", en: "Flamewyrm", zh: "烈焰龙" },
    emoji: "🐉",
    color: "#ff5722",
    glow: "#ff8a65",
    hp: 200,
    dmg: 8,
    acc: 0.52,
    gap: 1350,
    desc: { th: "มังกรเพลิง ดุดันและรุนแรง", en: "Fire dragon — fierce and devastating", zh: "火焰龙 — 凶猛且破坏力强" },
    coins: 120, xp: 40,
    tier: "rare",
  },
  {
    id: "glitchking",
    name: { th: "Glitch King", en: "Glitch King", zh: "故障之王" },
    emoji: "👑",
    color: "#ffd23f",
    glow: "#ffe082",
    hp: 250,
    dmg: 10,
    acc: 0.60,
    gap: 1200,
    desc: { th: "ราชาแห่งข้อผิดพลาด โจมตีหนักทุกหมัด", en: "King of errors — every hit is heavy", zh: "错误之王 — 每一击都很重" },
    coins: 180, xp: 60,
    tier: "rare",
  },
  {
    id: "voidserpent",
    name: { th: "Void Serpent", en: "Void Serpent", zh: "虚空之蛇" },
    emoji: "🐍",
    color: "#7c4dff",
    glow: "#b388ff",
    hp: 300,
    dmg: 12,
    acc: 0.68,
    gap: 1050,
    desc: { th: "งูจากความว่างเปล่า โจมตีเร็วและแรง", en: "Serpent from the void — fast and brutal", zh: "虚空之蛇 — 快速且凶猛" },
    coins: 250, xp: 80,
    tier: "epic",
  },
  {
    id: "omegacore",
    name: { th: "Omega Core", en: "Omega Core", zh: "终极核心" },
    emoji: "💀",
    color: "#ff1744",
    glow: "#ff5252",
    hp: 400,
    dmg: 15,
    acc: 0.75,
    gap: 900,
    desc: { th: "หัวใจแห่งจักรวาล แข็งแกร่งที่สุด", en: "Heart of the universe — the strongest", zh: "宇宙之心 — 最强的存在" },
    coins: 400, xp: 120,
    tier: "epic",
  },
];

const WAVES_PER_FIGHT = 10;

function mtr3(o, lang) { return o && (o[lang] || o.en) || ""; }

/* ══════════════════════ damage calc ══════════════════════ */

function calcPlayerDmg(player, wave) {
  const base = player.dmg * (1 + wave * 0.08);
  return Math.max(1, Math.round(base + Math.random() * 3));
}

function calcMonsterDmg(monster, wave) {
  const base = monster.dmg * (1 + wave * 0.05);
  return Math.max(1, Math.round(base + Math.random() * 4));
}

/* ══════════════════════ Monster art (emoji-based) ══════════════════════ */

function MonsterArt({ monster, size = 120 }) {
  return (
    <div style={{
      width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.6, filter: `drop-shadow(0 0 12px ${monster.glow})`,
      animation: "monsterFloat 2s ease-in-out infinite",
    }}>
      {monster.emoji}
    </div>
  );
}

/* ══════════════════════ the battle component ══════════════════════ */

export const MonsterBattlePage = memo(function MonsterBattlePage({
  lang, charModel = "vanguard", gear = [], onBack, onReward, playUi,
}) {
  const T = (th, en, zh) => (lang === "th" ? lang === "zh" ? zh : en : lang === "zh" ? zh : en);
  const tr3 = (o, l) => (o && (o[l] || o.en)) || "";

  const me = normalizeModel(charModel);
  const myCls = classKeyOf(me);
  const sp = readSkillSp();
  const myRank = skillRank(sp[myCls] || 0).rank;
  const clsInfo = MODEL_CLASS[myCls] || MODEL_CLASS.striker;
  const player = fighterFrom(charModel, gear, myRank);
  const myMax = player.maxHp;

  /* ── phases: lobby → fight → result ── */
  const [phase, setPhase] = useState("lobby");
  const [monsterIdx, setMonsterIdx] = useState(0);
  const monster = MONSTERS[monsterIdx];

  /* ── fight state ── */
  const [myHp, setMyHp] = useState(myMax);
  const [mHp, setMhp] = useState(monster.hp);
  const [wave, setWave] = useState(1);
  const [qPhase, setQPhase] = useState(false);
  const [q, setQ] = useState(null);
  const [locked, setLocked] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [banner, setBanner] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [overdrive, setOverdrive] = useState(false);
  const [shake, setShake] = useState(0);
  const [mePose, setMePose] = useState("ready");
  const [mPose, setMpose] = useState("ready");
  const [lunge, setLunge] = useState(null);
  const [msgFloat, setMsgFloat] = useState([]);
  const [left, setLeft] = useState(0);
  const [floor, setFloor] = useState(1);

  const doneRef = useRef(false);
  const hpRef = useRef({ me: myMax, m: monster.hp });
  const myX = 0.28;
  const mX = 0.68;

  const msgId = useRef(0);
  function floatMsg(side, text, kind) {
    const id = ++msgId.current;
    setMsgFloat(prev => [...prev, { id, side, text, kind }]);
    setTimeout(() => setMsgFloat(prev => prev.filter(m => m.id !== id)), 1200);
  }

  function hitMonster(dmg, kind) {
    const nh = Math.max(0, hpRef.current.m - dmg);
    hpRef.current.m = nh; setMhp(nh);
    setMpose("hit"); setLunge("me");
    floatMsg("m", "-" + dmg, kind || "dmg");
    if (kind === "ult") { setShake(2); setTimeout(() => setShake(0), 300); }
    setTimeout(() => { setMpose("ready"); setLunge(null); }, 350);
    if (nh <= 0) setTimeout(finishFight, 500);
  }

  function hitMe(dmg) {
    if (doneRef.current) return;
    const nh = Math.max(0, hpRef.current.me - dmg);
    hpRef.current.me = nh; setMyHp(nh);
    setMePose("hit"); setLunge("op");
    floatMsg("me", "-" + dmg, "dmg");
    setShake(1); setTimeout(() => setShake(0), 250);
    setTimeout(() => { setMePose("ready"); setLunge(null); }, 350);
    if (nh <= 0) setTimeout(finishFight, 500);
  }

  function finishFight() {
    if (doneRef.current) return;
    doneRef.current = true;
    const won = hpRef.current.m <= 0;
    const rounds = wave;
    setPhase("result");
    const coins = won ? monster.coins : Math.round(monster.coins * 0.2);
    const xp = won ? monster.xp : Math.round(monster.xp * 0.2);
    if (onReward) onReward(xp, coins, { win: won, score, rounds });
    if (playUi) playUi(won ? "reward" : "click");
  }

  /* ── start fight ── */
  function startFight(idx) {
    setMonsterIdx(idx);
    const m = MONSTERS[idx];
    doneRef.current = false;
    hpRef.current = { me: myMax, m: m.hp };
    setMyHp(myMax); setMhp(m.hp);
    setWave(1); setScore(0); setCombo(0);
    setQPhase(false); setQ(null); setLocked(false); setReveal(null);
    setBanner(null); setOverdrive(false); setShake(0);
    setMePose("ready"); setMpose("ready"); setLunge(null);
    setMsgFloat([]); setLeft(WAVES_PER_FIGHT * 2500);
    setFloor(1);
    setPhase("fight");
    if (playUi) playUi("click");
  }

  /* ── monster attack timer ── */
  useEffect(() => {
    if (phase !== "fight" || qPhase || doneRef.current) return;
    const m = MONSTERS[monsterIdx];
    let alive = true, t = null;
    const step = () => {
      if (!alive || doneRef.current) return;
      if (Math.random() < m.acc) {
        const dmg = calcMonsterDmg(m, floor);
        hitMe(dmg);
        setMpose("attack"); setTimeout(() => setMpose("ready"), 300);
      }
      t = setTimeout(step, m.gap + Math.random() * 400 - 200);
    };
    t = setTimeout(step, m.gap);
    return () => { alive = false; if (t) clearTimeout(t); };
  }, [phase, qPhase, monsterIdx, floor]);

  /* ── wave countdown ── */
  useEffect(() => {
    if (phase !== "fight" || qPhase || doneRef.current) return;
    const total = WAVES_PER_FIGHT * 2500;
    const t0 = Date.now();
    const id = setInterval(() => {
      if (doneRef.current) return;
      const el = Date.now() - t0;
      setLeft(Math.max(0, total - el));
      if (el >= total) {
        clearInterval(id);
        setQPhase(true);
        setQ(makeQuestion(lang));
        setLocked(false); setReveal(null);
        setBanner("⚡ " + (lang === "th" ? "ช่วงคำถาม" : lang === "zh" ? "知识时刻" : "KNOWLEDGE BREAK"));
        setTimeout(() => setBanner(null), 1500);
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, qPhase, floor, lang]);

  /* ── answer ── */
  function answer(choice) {
    if (locked || doneRef.current || !q) return;
    setLocked(true);
    const right = choice === q.ans;
    if (right) {
      const dmg = calcPlayerDmg(player, floor);
      const comboBonus = Math.min(combo * 0.12, 0.6);
      const totalDmg = Math.round(dmg * (1 + comboBonus));
      setCombo(c => c + 1);
      setScore(s => s + 250 + combo * 50);
      setBanner("OVERDRIVE!");
      setOverdrive(true);
      if (playUi) playUi("click");
      [0, 260, 520].forEach((d, i) =>
        setTimeout(() => hitMonster(Math.round(totalDmg * (i === 2 ? 1.5 : 0.7)), i === 2 ? "ult" : "crit"), d)
      );
      setTimeout(() => { setOverdrive(false); setBanner(null); setReveal({ q, chosen: choice }); }, 1500);
    } else {
      setCombo(0);
      setBanner(lang === "th" ? "ตอบผิด! โดนสวน" : lang === "zh" ? "答错! 被反击" : "WRONG!");
      if (playUi) playUi("click");
      setTimeout(() => {
        const mDmg = Math.round(myMax * 0.15);
        hitMe(mDmg);
        setMpose("attack"); setTimeout(() => setMpose("ready"), 400);
      }, 400);
      setTimeout(() => { setBanner(null); setReveal({ q, chosen: choice }); }, 2000);
    }
  }

  function nextWave() {
    if (doneRef.current) return;
    if (hpRef.current.me <= 0 || hpRef.current.m <= 0) { finishFight(); return; }
    if (wave >= WAVES_PER_FIGHT) {
      // Boss wave: instant finish based on remaining HP
      finishFight(); return;
    }
    setWave(w => w + 1);
    setQPhase(false); setQ(null); setLocked(false); setReveal(null);
    setLeft(WAVES_PER_FIGHT * 2500);
  }

  function advanceFloor() {
    if (monsterIdx < MONSTERS.length - 1) {
      setFloor(f => f + 1);
      startFight(monsterIdx + 1);
    } else {
      setPhase("lobby");
    }
  }

  /* ══════════════════════ LOBBY ══════════════════════ */
  if (phase === "lobby") {
    return (
      <div className="pvppage">
        <div className="pvphdr">
          <button className="stgback" onClick={onBack} aria-label="back">←</button>
          <span className="pvphdr-t">
            {lang === "th" ? "⚔ ดันเจี้ยนมอนสเตอร์" : lang === "zh" ? "⚔ 怪物地下城" : "⚔ Monster Dungeon"}
          </span>
          <span className="mdv-cls" style={{ "--cc": clsInfo.c }}>
            <span className="mdv-cls-ic"><ItemArt art={clsInfo.art} sw={[clsInfo.c, "#22283a"]} /></span>
            {tr3(clsInfo, lang)}
          </span>
        </div>

        <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {MONSTERS.map((m, i) => (
            <button key={m.id} onClick={() => startFight(i)}
              style={{
                background: "rgba(255,255,255,0.04)", border: `1px solid ${m.color}33`,
                borderRadius: 14, padding: "16px 10px", textAlign: "center", cursor: "pointer",
                transition: "all .2s", position: "relative", overflow: "hidden",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.boxShadow = `0 0 20px ${m.color}22`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${m.color}33`; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ fontSize: 48, marginBottom: 6, filter: `drop-shadow(0 0 8px ${m.glow})` }}>{m.emoji}</div>
              <div style={{ color: m.color, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{tr3(m.name, lang)}</div>
              <div style={{ fontSize: 11, color: "var(--muted, #888)", marginBottom: 8 }}>{tr3(m.desc, lang)}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, fontSize: 11, color: "#aaa" }}>
                <span>❤️ {m.hp}</span>
                <span>⚔ {m.dmg}</span>
                <span style={{ color: m.tier === "epic" ? "#e040fb" : m.tier === "rare" ? "#ffd23f" : "#aaa" }}>
                  {m.tier.toUpperCase()}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ══════════════════════ RESULT ══════════════════════ */
  if (phase === "result") {
    const won = hpRef.current.m <= 0;
    return (
      <div className="pvppage" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{won ? "🏆" : "💀"}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: won ? "#4ade80" : "#ff5252", marginBottom: 8 }}>
          {won ? (lang === "th" ? "ชนะ!" : lang === "zh" ? "胜利!" : "VICTORY!")
               : (lang === "th" ? "พ่ายแพ้" : lang === "zh" ? "失败" : "DEFEATED")}
        </div>
        <div style={{ color: "#ccc", fontSize: 14, marginBottom: 20 }}>
          {tr3(monster.name, lang)} · {lang === "th" ? `ชั้น ${floor}` : lang === "zh" ? `第 ${floor} 层` : `Floor ${floor}`}
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ffd23f" }}>{score.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "#888" }}>{lang === "th" ? "คะแนน" : lang === "zh" ? "分数" : "Score"}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80" }}>+{won ? monster.xp : Math.round(monster.xp * 0.2)}</div>
            <div style={{ fontSize: 11, color: "#888" }}>EXP</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ffd23f" }}>+{won ? monster.coins : Math.round(monster.coins * 0.2)}</div>
            <div style={{ fontSize: 11, color: "#888" }}>🪙</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onBack} style={{
            padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent", color: "#fff", cursor: "pointer", fontSize: 14,
          }}>
            {lang === "th" ? "← กลับ" : lang === "zh" ? "← 返回" : "← Back"}
          </button>
          {won && monsterIdx < MONSTERS.length - 1 && (
            <button onClick={advanceFloor} style={{
              padding: "10px 24px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #d97757, #c25e3f)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600,
            }}>
              {lang === "th" ? "มอนสเตอร์ถัดไป →" : lang === "zh" ? "下一个怪物 →" : "Next Monster →"}
            </button>
          )}
          <button onClick={() => startFight(monsterIdx)} style={{
            padding: "10px 24px", borderRadius: 10, border: "none",
            background: "#7c4dff", color: "#fff", cursor: "pointer", fontSize: 14,
          }}>
            {lang === "th" ? "🔄 ลองอีกครั้ง" : lang === "zh" ? "🔄 再次挑战" : "🔄 Retry"}
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════ FIGHT ══════════════════════ */
  const monsterMax = MONSTERS[monsterIdx].hp;

  return (
    <div className={`pvppage fight${shake ? " sh" + shake : ""}${overdrive ? " od" : ""}`}>
      {/* ── header ── */}
      <div className="pvphdr">
        <button className="stgback" onClick={() => { doneRef.current = true; setPhase("lobby"); }} aria-label="back">←</button>
        <span className="pvphdr-t">
          {lang === "th" ? `ชั้น ${floor}` : lang === "zh" ? `第 ${floor} 层` : `Floor ${floor}`}
          {" · "}
          {lang === "th" ? `รอบ ${Math.min(wave, WAVES_PER_FIGHT)}/${WAVES_PER_FIGHT}` : lang === "zh" ? `回合 ${Math.min(wave, WAVES_PER_FIGHT)}/${WAVES_PER_FIGHT}` : `Wave ${Math.min(wave, WAVES_PER_FIGHT)}/${WAVES_PER_FIGHT}`}
        </span>
        <span className="pvpscore">{score.toLocaleString()}</span>
      </div>

      {/* ── stage ── */}
      <div className={`pvpstage${shake ? " sh" + shake : ""}${overdrive ? " od" : ""}`}>
        {/* ── HP bars ── */}
        <div className="pvphps">
          <div className="pvphpcol">
            <div className="pvphp"><i style={{ width: `${Math.max(0, (myHp / myMax) * 100)}%` }} /></div>
            <div className="pvphp-n">{tr3(CHAR_MODELS.find(m => m.id === me) || {}, lang)} · {Math.max(0, Math.round(myHp))}</div>
          </div>
          <div className="pvpvs">VS</div>
          <div className="pvphpcol">
            <div className="pvphp op" style={{ "--hp-c": monster.color }}><i style={{ width: `${Math.max(0, (mHp / monsterMax) * 100)}%`, background: `linear-gradient(90deg, ${monster.color}, ${monster.glow})` }} /></div>
            <div className="pvphp-n op">{Math.max(0, Math.round(mHp))} · {tr3(monster.name, lang)}</div>
          </div>
        </div>

        {/* ── player robot ── */}
        <div className={`pvpfighter me${lunge === "me" ? " lunge" : ""}${mePose === "hit" ? " knock" : ""}`}
          style={{ left: `calc(${(myX * 100).toFixed(1)}% - 22%)`, bottom: "var(--pvpfloor, 6px)" }}>
          <CyberAvatar model={me} yaw={lunge === "me" ? 42 : mePose === "hit" ? 14 : 26} pose={mePose}
            glow="#00b8d4" accent="#7c4dff" armorA="#1b2436" armorB="#41608a" />
          {msgFloat.filter(m => m.side === "me").map(m => (
            <span key={m.id} className={`pvpflash ${m.kind}`} style={{ position: "absolute", top: -20 }}>{m.text}</span>
          ))}
        </div>

        {/* ── monster ── */}
        <div className={`pvpfighter op${lunge === "op" ? " lunge" : ""}${mPose === "hit" ? " knock" : ""}`}
          style={{ left: `calc(${(mX * 100).toFixed(1)}% - 22%)`, right: "auto", bottom: "var(--pvpfloor, 6px)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <MonsterArt monster={monster} size={100} />
            <div style={{ fontSize: 12, color: monster.color, fontWeight: 700, marginTop: 4 }}>{tr3(monster.name, lang)}</div>
          </div>
          {msgFloat.filter(m => m.side === "m").map(m => (
            <span key={m.id} className={`pvpflash ${m.kind}`} style={{ position: "absolute", top: -20 }}>{m.text}</span>
          ))}
        </div>

        {/* ── combo counter ── */}
        {combo > 2 && <div className="pvpcombo" key={combo}><b>{combo}</b><i>{lang === "th" ? "คอมโบ" : lang === "zh" ? "连击" : "COMBO"}</i></div>}
        {banner && <div className="pvpbanner">{banner}</div>}
      </div>

      {/* ── wave timer ── */}
      {!qPhase && (
        <>
          <div className="pvpwave"><i style={{ width: `${Math.max(0, (left / (WAVES_PER_FIGHT * 2500)) * 100)}%` }} /></div>
          <div className="pvpwave-l">
            {lang === "th" ? `คำถามจะมาใน ${Math.ceil(left / 1000)}s`
              : lang === "zh" ? `问题将在 ${Math.ceil(left / 1000)}s`
              : `Question in ${Math.ceil(left / 1000)}s`}
          </div>
        </>
      )}

      {/* ── action pad ── */}
      {!qPhase && (
        <div className="pvppad">
          <div className="pvppad-l">
            <button className="pvpdir" style={{ opacity: 0.3, cursor: "default" }}>◀</button>
            <button className="pvpdir grd" style={{ opacity: 0.3, cursor: "default" }}>🛡</button>
            <button className="pvpdir" style={{ opacity: 0.3, cursor: "default" }}>▶</button>
          </div>
          <div className="pvppad-r">
            <button className="pvpact punch" onPointerDown={() => {
              const d = calcPlayerDmg(player, floor);
              hitMonster(d); setMePose("attack"); setTimeout(() => setMePose("ready"), 300);
              if (playUi) playUi("click");
            }}>
              <b>👊</b><i>{lang === "th" ? "ต่อย" : lang === "zh" ? "拳击" : "PUNCH"}</i>
            </button>
            <button className="pvpact kick" onPointerDown={() => {
              const d = Math.round(calcPlayerDmg(player, floor) * 1.3);
              hitMonster(d); setMePose("kick"); setTimeout(() => setMePose("ready"), 350);
              if (playUi) playUi("click");
            }}>
              <b>🦵</b><i>{lang === "th" ? "เตะ" : lang === "zh" ? "踢击" : "KICK"}</i>
            </button>
          </div>
        </div>
      )}

      {/* ── quiz overlay ── */}
      {qPhase && q && (reveal ? (
        <div style={{ padding: "16px 20px", background: "rgba(0,0,0,0.85)", borderRadius: 16, margin: "0 12px" }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: reveal.chosen === q.ans ? "#4ade80" : "#ff5252", marginBottom: 6 }}>
              {reveal.chosen === q.ans ? "✅ " + (lang === "th" ? "ตอบถูก!" : lang === "zh" ? "答对了!" : "Correct!")
                                       : "❌ " + (lang === "th" ? "ตอบผิด" : lang === "zh" ? "答错了" : "Wrong!")}
            </div>
            <div style={{ fontSize: 13, color: "#ccc" }}>
              {lang === "th" ? "คำตอบที่ถูก: " : lang === "zh" ? "正确答案: " : "Answer: "}{q.ans}
            </div>
          </div>
          <button onClick={nextWave} style={{
            width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #d97757, #c25e3f)", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
          }}>
            {lang === "th" ? "สู้ต่อ →" : lang === "zh" ? "继续战斗 →" : "Back to the fight →"}
          </button>
        </div>
      ) : (
        <>
          <div className="pvpuntimed">
            {lang === "th" ? "ตอบถูก = โอเวอร์ไดรฟ์ · ไม่จับเวลา"
              : lang === "zh" ? "答对触发超载 · 不计时"
              : "Answer right for OVERDRIVE · no time limit"}
          </div>
          <div className="pvpq">{q.q}</div>
          <div className="pvpopts">
            {q.opts.map(o => (
              <button key={o} className={`pvpopt${locked && o === q.ans ? " right" : ""}${locked && o !== q.ans ? " wrong" : ""}`}
                disabled={locked} onClick={() => answer(o)}>{o}</button>
            ))}
          </div>
        </>
      ))}

      {/* ── bottom: disengage ── */}
      {!qPhase && (
        <div style={{ textAlign: "center", padding: "6px 0 2px", opacity: 0.5, fontSize: 12, color: "#aaa", cursor: "pointer" }}
          onClick={() => { doneRef.current = true; setPhase("lobby"); }}>
          {lang === "th" ? "ถอยหนี" : lang === "zh" ? "撤退" : "Disengage"}
        </div>
      )}
    </div>
  );
});
