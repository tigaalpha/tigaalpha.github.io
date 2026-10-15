/* Adventure: the construction episodes (owner, 2026-10-13: "start solo mode with a spaceship-building game: robots build the ship together and we must answer music questions and
   learn music while we do; then separate episodes that build a Dyson sphere around a star, a gas-harvesting base at Jupiter and a mining base in the asteroid belt").
   One engine, four scenarios (`P.kind`: ship, dyson, gas, mine). A scenario is a list of parts. For each part the robot crew asks ONE music question; a right answer powers
   the build (the robots weld it up in a few seconds), a wrong answer teaches the answer first and then asks another question. At the end the player's "music notebook"
   lists what the crew learned. Questions come from what the learner has studied (`nextQuestion`, choice questions only) and from a small trilingual bank. DOM + SVG only. */
import { useEffect, useRef, useState } from "react";
import { createAdvSfx } from "./adventure-sfx";
import { createAdvMusic } from "./adventure-music";
import { GearButton, SettingsPopup } from "./adventure-settings";
import { nextQuestion } from "./quiz-quest";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
type L3 = [string, string, string];
type Part = { icon: string; name: L3; gain: L3; x: number; y: number };
type Scn = { icon: string; title: L3; out: L3; unit: string; per: number; parts: Part[]; sky: string[] };
// owner, 2026-10-15: the first episode a brand-new (often young) player ever sees used to ask 8-10 questions in a row —
// too long and too slow to feel like progress. Every scenario is now exactly 3 parts, a short, clear arc (body -> power
// -> payoff) instead of a long checklist, so the very first thing Adventure asks for is three easy wins, not a marathon.
export const SCENARIOS: Record<string, Scn> = {
  ship: { icon: "🚀", title: ["ยานอาณานิคม 'โพรมีเธียส'", "Colony starship 'Prometheus'", "殖民星舰“普罗米修斯”"], out: ["พลังของยาน", "Ship power", "星舰性能"], unit: "", per: 32, sky: ["#050816", "#1a1c40"], parts: [
    { icon: "🛠", name: ["โครงตัวยาน", "Hull frame", "舰体骨架"], gain: ["แข็งแรงขึ้น", "stronger hull", "舰体更坚固"], x: 110, y: 45 },
    { icon: "⚛", name: ["แกนปฏิกรณ์ฟิวชัน", "Fusion reactor core", "聚变反应堆核心"], gain: ["พลังงานเพียงพอ", "plenty of power", "电力充足"], x: 80, y: 45 },
    { icon: "🔥", name: ["เครื่องยนต์หลัก", "Main engines", "主引擎"], gain: ["เร็วขึ้น", "faster flight", "飞得更快"], x: 50, y: 45 },
  ] },
  dyson: { icon: "☀", title: ["ไดสันสเฟียร์ล้อมดาวฤกษ์", "Dyson sphere around a star", "环绕恒星的戴森球"], out: ["พลังงานที่เก็บได้", "Energy collected", "收集的能量"], unit: " PW", per: 15, sky: ["#1a0a02", "#5a2a08"], parts: Array.from({ length: 3 }, (_, i) => {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2; return { icon: i === 2 ? "📡" : "🟨", name: i === 2 ? ["สถานีส่งลำแสงกลับโลก", "Beam relay to Earth", "回传地球的光束中继站"] : ["แผงรวมแสงวงที่ " + (i + 1), "Collector ring " + (i + 1), "集光环 " + (i + 1)], gain: ["เก็บพลังงานดาวฤกษ์เพิ่ม", "more starlight collected", "收集更多星光"], x: Math.round(80 + Math.cos(a) * 52), y: Math.round(45 + Math.sin(a) * 34) } as Part; }) },
  gas: { icon: "🪐", title: ["ฐานเก็บก๊าซที่ดาวพฤหัส", "Gas-harvesting base at Jupiter", "木星气体采集基地"], out: ["ก๊าซที่เก็บได้", "Gas stored", "储存气体"], unit: " kt", per: 24, sky: ["#1a0f06", "#6a3a14"], parts: [
    { icon: "⚓", name: ["แท่นยึดลอยฟ้า", "Floating anchor platform", "悬浮锚定平台"], gain: ["ฐานมั่นคง", "a stable base", "基地稳固"], x: 110, y: 62 },
    { icon: "🌪", name: ["ปากดูดก๊าซ", "Gas intake scoop", "气体进气口"], gain: ["ดูดก๊าซเข้ามา", "gas flows in", "气体流入"], x: 80, y: 40 },
    { icon: "🚀", name: ["แท่นยิงถังก๊าซกลับโลก", "Launcher home", "返航发射台"], gain: ["ส่งก๊าซกลับโลก", "gas shipped home", "气体运回地球"], x: 50, y: 50 },
  ] },
  mine: { icon: "☄", title: ["ฐานขุดแร่ในแถบดาวเคราะห์น้อย", "Mining base in the asteroid belt", "小行星带采矿基地"], out: ["แร่ที่ผลิตได้", "Ore produced", "矿石产量"], unit: " kt", per: 19, sky: ["#07090f", "#2a2a34"], parts: [
    { icon: "📍", name: ["สมอยึดดาวเคราะห์น้อย", "Asteroid anchors", "小行星锚固"], gain: ["ไม่ลอยหลุดไป", "it will not drift away", "不会飘走"], x: 110, y: 45 },
    { icon: "⛏", name: ["แท่นเจาะแร่", "Mining rig", "采矿钻机"], gain: ["เจาะแร่ได้", "ore comes out", "开始出矿"], x: 80, y: 45 },
    { icon: "🚀", name: ["เครื่องยิงแร่กลับโลก", "Mass driver", "质量加速器"], gain: ["ส่งแร่กลับโลก", "ore sent home", "矿石运回地球"], x: 50, y: 46 },
  ] },
};

// owner, 2026-10-15: these are the very first music questions a brand-new player (often a child) ever sees — eased down to
// plain, concrete facts a beginner can actually know or guess (names, loud/soft, families, counting), with the abstract
// theory (intervals, scale-degree math, key signatures, semitone counting) moved out to where a learner already studies it.
type Q = { q: L3; o: [L3, L3, L3]; why: L3 };   // the first option is always the right one; they are shuffled when asked
const BANK: Q[] = [
  { q: ["ไตรแอดหรือคอร์ดสามเสียงมีกี่โน้ต?", "How many notes does a triad have?", "三和弦有几个音？"], o: [["3", "3", "3"], ["4", "4", "4"], ["2", "2", "2"]], why: ["ไตรแอดมีสามโน้ต เช่น C-E-G", "A triad has three notes, such as C-E-G.", "三和弦有三个音，如 C-E-G。"] },
  { q: ["จังหวะ 4/4 หมายถึงอะไร?", "What does 4/4 time mean?", "4/4 拍表示什么？"], o: [["หนึ่งห้องมี 4 จังหวะ", "Four beats in a bar", "每小节 4 拍"], ["หนึ่งห้องมี 3 จังหวะ", "Three beats in a bar", "每小节 3 拍"], ["เล่นเร็วมาก", "Play very fast", "要弹得很快"]], why: ["ตัวเลขบนบอกว่าหนึ่งห้องมีกี่จังหวะ 4/4 คือ 4 จังหวะต่อห้อง", "The top number says how many beats are in each bar — 4/4 means four.", "上面的数字表示每小节有几拍——4/4 就是每小节 4 拍。"] },
  { q: ["ไวโอลินอยู่ในตระกูลเครื่องดนตรีอะไร?", "Which instrument family is the violin in?", "小提琴属于哪一类乐器？"], o: [["เครื่องสาย", "Strings", "弦乐器"], ["เครื่องเป่าลมไม้", "Woodwinds", "木管乐器"], ["เครื่องกระทบ", "Percussion", "打击乐器"]], why: ["ไวโอลิน วิโอลา เชลโล เป็นเครื่องสายที่สีด้วยคันชัก", "Violin, viola and cello are strings, played with a bow.", "小提琴、中提琴和大提琴都是弦乐器，用琴弓演奏。"] },
  { q: ["คำว่า 'ฟอร์เต้' (forte) แปลว่า?", "What does 'forte' mean?", "“forte”是什么意思？"], o: [["เล่นดัง", "Play loudly", "强，弹得响"], ["เล่นเบา", "Play softly", "弱，弹得轻"], ["เล่นช้าลง", "Slow down", "渐慢"]], why: ["ฟอร์เต้ (f) คือดัง เปียโน (p) คือเบา", "Forte (f) means loud; piano (p) means soft.", "forte (f) 是强，piano (p) 是弱。"] },
  { q: ["บรรทัดห้าเส้นมีกี่เส้น?", "How many lines does a staff have?", "五线谱有几条线？"], o: [["5", "5", "5"], ["4", "4", "4"], ["6", "6", "6"]], why: ["บรรทัดห้าเส้นมี 5 เส้น โน้ตเขียนบนเส้นหรือในช่อง", "A staff has 5 lines; notes sit on a line or in a space.", "五线谱有 5 条线，音符写在线上或间里。"] },
  { q: ["เปียโนมีกี่คีย์?", "How many keys does a piano have?", "钢琴有多少个琴键？"], o: [["88", "88", "88"], ["52", "52", "52"], ["100", "100", "100"]], why: ["เปียโนมาตรฐานมี 88 คีย์ ขาวและดำรวมกัน", "A standard piano has 88 keys, white and black together.", "标准钢琴共有 88 个琴键，黑白键加在一起。"] },
  { q: ["คีย์สีดำบนเปียโนเรียกอีกชื่อว่า?", "Piano keys come in which two colors?", "钢琴键有哪两种颜色？"], o: [["ขาวและดำ", "White and black", "白色和黑色"], ["แดงและน้ำเงิน", "Red and blue", "红色和蓝色"], ["เหลืองและเขียว", "Yellow and green", "黄色和绿色"]], why: ["เปียโนมีคีย์สีขาวและสีดำสลับกัน", "A piano has white and black keys side by side.", "钢琴的黑白键交替排列。"] },
  { q: ["เครื่องดนตรีที่เล่นโดยการเป่าคือ?", "Which of these is played by blowing air into it?", "下面哪种乐器要靠吹气演奏？"], o: [["ฟลุต", "Flute", "长笛"], ["กลอง", "Drum", "鼓"], ["กีตาร์", "Guitar", "吉他"]], why: ["ฟลุตเป็นเครื่องเป่าลม ส่วนกลองตีและกีตาร์ดีด", "A flute is a wind instrument; a drum is struck and a guitar is plucked.", "长笛靠吹气发声，鼓靠敲击，吉他靠弹拨。"] },
  { q: ["ใครแต่งเพลง 'Für Elise'?", "Who composed 'Für Elise'?", "《致爱丽丝》的作曲家是谁？"], o: [["เบโธเฟน", "Beethoven", "贝多芬"], ["โมสาร์ท", "Mozart", "莫扎特"], ["บาค", "Bach", "巴赫"]], why: ["Für Elise เป็นผลงานเปียโนเล็ก ๆ ของลุดวิก ฟาน เบโธเฟน", "Für Elise is a small piano piece by Ludwig van Beethoven.", "《致爱丽丝》是贝多芬写的钢琴小曲。"] },
  { q: ["เสียงที่สูงมาก ๆ เรียกว่าอะไร?", "A very high-pitched sound is called?", "音调很高的声音叫什么？"], o: [["เสียงสูง", "High pitch", "高音"], ["เสียงต่ำ", "Low pitch", "低音"], ["เสียงดัง", "Loud", "强音"]], why: ["เสียงสูงและเสียงต่ำคือระดับเสียง (pitch) ไม่ใช่ความดัง", "High and low describe pitch, not how loud a sound is.", "高和低是音高（pitch），和声音大小不是一回事。"] },
  { q: ["เมโทรนอมใช้ทำอะไร?", "What does a metronome help a musician do?", "节拍器能帮助演奏者做什么？"], o: [["รักษาจังหวะให้คงที่", "Keep a steady beat", "保持稳定的节拍"], ["ปรับเสียงให้เข้าคีย์", "Tune the instrument", "给乐器调音"], ["บันทึกเสียง", "Record the sound", "录制声音"]], why: ["เมโทรนอมตีจังหวะสม่ำเสมอให้ผู้เล่นตามได้ถูกต้อง", "A metronome ticks a steady beat for the player to follow.", "节拍器以稳定的速度打拍，帮助演奏者跟上节奏。"] },
];
const rngPick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const NAMES = ["Kiko", "Bolt", "Nova", "Zed"];
const careerNow = () => { try { return localStorage.getItem("tg_adv_career") || ""; } catch (e) { return ""; } };

type Ask = { q: string; opts: { label: string; ok: boolean }[]; why: string; tier: number };
function makeAsk(lang: string, used: Set<string>): Ask {
  // half the time ask what this learner has studied (choice questions only), otherwise from the bank.
  // owner, 2026-10-15: this is the very first thing a brand-new player answers, so it is pinned to the easiest
  // level regardless of this player's own ladder — a returning player's harder level belongs in the beacons later, not here.
  if (Math.random() < 0.5) { try { const r = nextQuestion(lang as any, { level: 1 }); if (r && r.q && r.q.kind === "choice" && r.q.opts && r.q.opts.length >= 2 && !used.has(r.q.id + r.q.q)) { used.add(r.q.id + r.q.q); return { q: r.q.q, opts: r.q.opts.map(o => ({ label: o.label, ok: o.ok })), why: r.q.teach.why, tier: r.q.tier }; } } catch (e) {} }
  const pool = BANK.filter((_, i) => !used.has("b" + i)); const list = pool.length ? pool : BANK; const q = rngPick(list); used.add("b" + BANK.indexOf(q));
  const li = lang === "th" ? 0 : lang === "zh" ? 2 : 1;
  return { q: q.q[li], opts: shuffle(q.o.map((o, i) => ({ label: o[li], ok: i === 0 }))), why: q.why[li], tier: 1 };
}

export default function AdventureBuild({ P, lang, onWin, onExit, onRetry }: any) {
  const sc: Scn = SCENARIOS[P.kind] || SCENARIOS.ship, t = (a: string, b: string, c: string) => T3(lang, a, b, c), N = sc.parts.length;
  const G = useRef<any>(null);
  if (!G.current) G.current = { built: 0, phase: "ask" as "ask" | "teach" | "build", ask: null as any, picked: -1, bp: 0, miss: 0, right: 0, used: new Set<string>(), notes: [] as string[], t: 0, ended: false, won: false, bot: 0 };
  const S = G.current; if (!S.ask) S.ask = makeAsk(lang, S.used);
  const [, setTick] = useState(0), [gear, setGear] = useState(false), pausedRef = useRef(false);
  const [high, setHigh] = useState(() => { try { return localStorage.getItem("tg_adv_gfx") === "high"; } catch (e) { return false; } });
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  const sfxRef = useRef<any>(null), musRef = useRef<any>(null);
  const career = careerNow(), speed = career === "ship" ? 0.6 : career === "eng" ? 0.8 : 1, BUILD_S = 3.4 * speed;
  useEffect(() => {
    const sfx = createAdvSfx(); sfxRef.current = sfx; sfx.setOn(musicOn); const mus = createAdvMusic(P.id); musRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); mus.setIntensity && mus.setIntensity(1); }
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; if (pausedRef.current || S.ended) return;
      S.t += dt;
      if (S.phase === "build") { S.bp += dt / BUILD_S * 100; if (S.bp >= 100) { S.bp = 0; S.built++; S.bot = (S.bot + 1) % NAMES.length; sfx.play("win");
          if (S.built >= N) { S.won = true; S.ended = true; const stars = S.miss <= 1 ? 3 : S.miss <= 4 ? 2 : 1; setTimeout(() => { try { const b = JSON.parse(localStorage.getItem("tg_adv_built") || "[]"); if (!b.includes(P.kind)) { b.push(P.kind); localStorage.setItem("tg_adv_built", JSON.stringify(b)); } } catch (e) {} onWin({ build: { kind: P.kind, parts: N, miss: S.miss, right: S.right, stars, notes: S.notes.length }, kills: 0, cry: 8 + 4 * stars, loot: {}, mode: "build" }); }, 2600); }
          else { S.phase = "ask"; S.ask = makeAsk(lang, S.used); S.picked = -1; } } }
      setTick(x => (x + 1) % 1e6);
    }, 100);
    (window as any).__advBuild = { state: () => ({ built: S.built, N, phase: S.phase, miss: S.miss, right: S.right, notes: S.notes.length, won: S.won, ended: S.ended, kind: P.kind }), answerRight: () => { const i = S.ask.opts.findIndex((o: any) => o.ok); pick(i); }, answerWrong: () => { const i = S.ask.opts.findIndex((o: any) => !o.ok); pick(i); }, tick: (sec: number) => { for (let i = 0; i < Math.round(sec / 0.1); i++) { if (S.phase === "build") { S.bp += 0.1 / BUILD_S * 100; if (S.bp >= 100) { S.bp = 0; S.built++; if (S.built >= N) { S.won = true; S.ended = true; return; } S.phase = "ask"; S.ask = makeAsk(lang, S.used); S.picked = -1; } } } } };
    return () => { clearInterval(id); if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advBuild; } catch (e) {} };
  }, []);
  const play = (n: string) => sfxRef.current && sfxRef.current.play(n);
  const pick = (i: number) => {
    if (S.phase !== "ask" || S.ended) return; const o = S.ask.opts[i]; if (!o) return; S.picked = i; S.notes.push(S.ask.why);
    if (o.ok) { S.right++; S.phase = "build"; S.bp = 0; play("pickup"); } else { S.miss++; S.phase = "teach"; play("hurt"); }
    setTick(x => x + 1);
  };
  const again = () => { S.phase = "ask"; S.ask = makeAsk(lang, S.used); S.picked = -1; setTick(x => x + 1); };
  const openGear = () => { pausedRef.current = true; setGear(true); }, closeGear = () => { pausedRef.current = false; setGear(false); };
  const cur = Math.min(S.built, N - 1), part = sc.parts[cur], out = Math.round(S.built * sc.per * 10) / 10, pct = Math.round((S.built + (S.phase === "build" ? S.bp / 100 : 0)) / N * 100);
  const stars = S.miss <= 1 ? 3 : S.miss <= 4 ? 2 : 1;
  return (
    <div className="adv-farm adv-build" data-build={P.kind}>
      <div className="adv-top">
        <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
        <div className="adv-hud">
          <div className="adv-lv">{sc.icon} {T3(lang, sc.title[0], sc.title[1], sc.title[2])} · {t("ชิ้นส่วน ", "Parts ", "部件 ")}{S.built}/{N} · ✓ {S.right} · ✗ {S.miss}</div>
          <div className="adv-bar adv-hp"><i style={{ width: pct + "%" }} /><b>{T3(lang, sc.out[0], sc.out[1], sc.out[2])}: {out}{sc.unit} · {pct}%</b></div>
        </div>
        <GearButton onClick={openGear} />
      </div>
      <svg className="ab-view" viewBox="0 0 160 90" role="img" aria-label="build">
        <defs><linearGradient id="abg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sc.sky[0]} /><stop offset="1" stopColor={sc.sky[1]} /></linearGradient></defs>
        <rect width="160" height="90" fill="url(#abg)" rx="6" />
        {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={(i * 37) % 160} cy={(i * 53) % 90} r={0.45} fill="#fff" opacity=".55" />)}
        {P.kind === "dyson" && <><circle cx="80" cy="45" r="10" fill="#ffd25a" /><circle cx="80" cy="45" r="14" fill="#ffd25a" opacity=".25" /><ellipse cx="80" cy="45" rx="52" ry="34" fill="none" stroke="#ffd25a" strokeOpacity=".25" strokeDasharray="2 3" /></>}
        {P.kind === "gas" && <><circle cx="80" cy="96" r="70" fill="#c98a4a" /><path d="M10 78 Q80 66 150 78 M14 86 Q80 74 146 86" stroke="#f0c890" strokeWidth="2" fill="none" opacity=".6" /></>}
        {P.kind === "mine" && <><path d="M44 52 Q50 24 80 20 Q116 22 124 50 Q120 74 82 76 Q48 76 44 52Z" fill="#4a4a56" stroke="#8a8a9a" /><circle cx="68" cy="40" r="5" fill="#35353f" /><circle cx="96" cy="58" r="7" fill="#35353f" /></>}
        {P.kind === "ship" && <><path d="M20 45 L44 30 L120 34 L140 45 L120 56 L44 60Z" fill="#20243a" stroke="#6a78b8" strokeDasharray="2 2" /></>}
        {sc.parts.map((p, i) => { const done = i < S.built, now = i === S.built && S.phase === "build"; return (
          <g key={i} data-part={i} className={done ? "ab-done" : now ? "ab-now" : "ab-todo"} transform={`translate(${p.x} ${p.y})`}>
            <circle r="8" fill={done ? "rgba(90,255,190,.28)" : "rgba(255,255,255,.05)"} stroke={done ? "#5affbe" : now ? "#ffe07a" : "rgba(255,255,255,.3)"} strokeWidth={done || now ? 1.4 : 0.8} strokeDasharray={done ? "" : "2 2"} />
            <text textAnchor="middle" y="3.6" fontSize="9" opacity={done ? 1 : now ? 0.9 : 0.35}>{p.icon}</text>
          </g>); })}
        {S.phase === "build" && <g transform={`translate(${part.x + 11} ${part.y - 9})`} className="ab-bot"><text fontSize="9">🤖</text><text fontSize="6" y="-1" x="2">✨</text></g>}
      </svg>
      <div className="ab-crew">{NAMES.map((n, i) => (<span key={n} className={"ab-r" + (S.phase === "build" && i === S.bot ? " on" : "")}>🤖 {n}</span>))}<span className="ab-say">{S.phase === "build" ? t(NAMES[S.bot] + " กำลังประกอบ: ", NAMES[S.bot] + " is building: ", NAMES[S.bot] + " 正在组装：") + T3(lang, part.name[0], part.name[1], part.name[2]) : t("ลูกเรือหุ่นยนต์รอคำตอบของคุณ เพื่อเริ่มประกอบ: ", "The robot crew needs your answer before they can build: ", "机器人团队等你回答后才能开工：") + T3(lang, part.name[0], part.name[1], part.name[2])}</span></div>
      {S.phase === "build" && <div className="af-bar ab-prog"><i style={{ width: S.bp + "%" }} /></div>}
      {(S.phase === "ask" || S.phase === "teach") && !S.won && (
        <div className="ab-q" data-ask="1">
          <div className="ab-qh">🎵 {t("คำถามดนตรี", "MUSIC QUESTION", "音乐问题")} · {t("ชิ้นส่วนที่ ", "part ", "第 ")}{S.built + 1}{lang === "zh" ? " 个部件" : ""}</div>
          <div className="ab-qq">{S.ask.q}</div>
          <div className="ab-opts">{S.ask.opts.map((o: any, i: number) => (<button key={i} data-opt={i} className={"adv-qopt" + (S.phase === "teach" ? (o.ok ? " ok" : S.picked === i ? " no" : "") : "")} disabled={S.phase === "teach"} onClick={() => pick(i)}>{o.label}</button>))}</div>
          {S.phase === "teach" && <div className="adv-qres bad" data-teach="1"><b>{t("ยังไม่ใช่ — มาเรียนรู้กัน", "Not quite — let us learn it", "不对——我们来学一学")}</b><br />{S.ask.why}<br /><button className="adv-qgo" data-again="1" onClick={again}>{t("ลองคำถามใหม่", "Try another question", "再来一题")}</button></div>}
        </div>)}
      {S.phase === "build" && S.notes.length > 0 && <div className="af-fact">💡 {S.notes[S.notes.length - 1]}</div>}
      {S.ended && S.won && (<div className="adv-clear" role="status"><b>{sc.icon} {t("ก่อสร้างเสร็จสมบูรณ์!", "Construction complete!", "建造完成！")}</b>
        <span>{T3(lang, sc.out[0], sc.out[1], sc.out[2])}: {out}{sc.unit} · {"★".repeat(stars)}</span>
        <small>{t("สมุดบันทึกดนตรี: เรียนรู้แล้ว ", "Music notebook: learned ", "音乐笔记：已学 ")}{S.notes.length}{t(" ข้อ", " facts", " 条")}</small></div>)}
      {gear && <SettingsPopup lang={lang} high={high} onGfx={() => { const n = !high; setHigh(n); try { localStorage.setItem("tg_adv_gfx", n ? "high" : "standard"); } catch (e) {} }} musicOn={musicOn} onMusic={() => setMusicOn(m => { const n = !m; try { localStorage.setItem("tg_adv_music", n ? "1" : "0"); } catch (e) {} if (musRef.current && musRef.current.setOn) musRef.current.setOn(n); if (sfxRef.current) sfxRef.current.setOn(n); return n; })} online={false} onResume={closeGear} onExit={() => { pausedRef.current = false; onExit(); }} />}
    </div>
  );
}
