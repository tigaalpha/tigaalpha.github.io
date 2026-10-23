/* Concept clips for the Video Lessons page (owner, 2026-10-23): the Thai video series on how to think about practising the piano, redone in English and
   Mandarin. Each clip is drawn live (animated slides), narrated by the device's own voice, with a generated music bed and a short sound at each cut.
   The Thai clips are YouTube videos; the first three here follow their titles (concentration, neural connections, which brain areas work); the last two are about HOW to practise
   (the owner's correction: concept clips mean practice concepts, not marketing) and use the app's own practice-planning and motivation knowledge (`teacher-craft-seed.js`). No third-party footage, music or voice. */
import { useEffect, useRef, useState } from "react";
import { speakNarration, stopSpeaking } from "./speech";
import { createAdvMusic, warmAudio } from "./adventure-music";

type Slide = { ic: string; h: string; b: string };
export type Clip = { id: string; title: string; sub: string; hue: number; slides: Slide[] };

export const CLIPS: Record<"en" | "zh", Clip[]> = {
  en: [
    { id: "focus", title: "Why piano players focus so well", sub: "Attention, trained", hue: 210, slides: [
      { ic: "🎹", h: "Why piano builds focus", b: "Playing the piano asks your brain to do many things at the same time. That is a workout for attention." },
      { ic: "👀", h: "Eyes, ears and hands together", b: "You read the notes, listen to the sound and move your fingers, all in one moment. Your brain has to stay on the task." },
      { ic: "🔁", h: "Small repeats, big habit", b: "Each time you slow down, fix a mistake and try again, you practise paying attention on purpose." },
      { ic: "🧠", h: "What research suggests", b: "Studies link music training with better attention and planning skills. The effect is real but modest, and it grows with regular practice." },
      { ic: "⏱️", h: "Try this today", b: "Ten to fifteen focused minutes beat one long distracted hour. Put the phone away, pick one small passage, and play it slowly." },
    ] },
    { id: "synapse", title: "How piano practice connects your neurons", sub: "Repetition rewires the brain", hue: 280, slides: [
      { ic: "⚡", h: "Neurons talk to each other", b: "Your brain is a network of cells called neurons. They pass tiny signals to each other across connections called synapses." },
      { ic: "🔁", h: "Practice strengthens the path", b: "When you repeat a movement, the same group of neurons fires together again and again. Connections that are used often get stronger." },
      { ic: "🧬", h: "The brain can change", b: "This ability is called neuroplasticity. The brain keeps adapting to what you practise, at every age." },
      { ic: "🌉", h: "Both sides of the brain", b: "Playing with two hands makes both halves of the brain work together. Musicians often show stronger links between the two sides." },
      { ic: "🌱", h: "What this means for you", b: "You do not need talent first. Slow, careful repetition is how the connections grow. Be patient, and come back tomorrow." },
    ] },
    { id: "regions", title: "Which brain areas work when you play", sub: "A whole-brain activity", hue: 160, slides: [
      { ic: "🎼", h: "Playing uses the whole brain", b: "One simple melody wakes up many parts of the brain at once. Let us meet the main players." },
      { ic: "✋", h: "Motor cortex", b: "It plans and controls the movement of your fingers, hands and arms." },
      { ic: "👂", h: "Auditory cortex", b: "It listens to the sound you make, so you can hear whether the note was right." },
      { ic: "👁️", h: "Visual areas", b: "They read the notes on the page and follow the keys, so your eyes can guide your hands." },
      { ic: "⏳", h: "Cerebellum and the planning brain", b: "The cerebellum helps with timing and smooth movement. The front of the brain plans ahead and keeps your attention on the music." },
      { ic: "🎹", h: "Together", b: "All these areas work as a team. The more you play, the better they cooperate." },
    ] },
    { id: "session", title: "A practice session that works", sub: "Review, fix, then play", hue: 20, slides: [
      { ic: "🗓️", h: "Short and daily beats long and rare", b: "Fifteen to twenty minutes every day beats two hours once a week, because your brain keeps what it meets again and again." },
      { ic: "🔁", h: "Start with a quick review", b: "Spend about three minutes on a piece or skill you already know. Meeting it again is what makes it stay." },
      { ic: "🐢", h: "Then fix the sticking points", b: "Spend about four minutes on the new part or the spot where you get stuck. Play it slowly, in small pieces, and only speed up when it is clean." },
      { ic: "🎶", h: "End with a song you love", b: "Finish by playing something you really enjoy. Ending on a success is what makes you want to come back tomorrow." },
      { ic: "⏱️", h: "Match the length to your age", b: "Young children focus for about ten to fifteen minutes. Older children manage twenty to thirty, and teenagers and adults thirty to forty-five. Several short rounds can beat one long one." },
    ] },
    { id: "motivation", title: "Keeping the motivation to practise", sub: "Choice, progress, company", hue: 330, slides: [
      { ic: "💪", h: "Motivation grows from three needs", b: "Research on motivation says we keep going when we feel free to choose, feel that we are getting better, and feel that we are not alone." },
      { ic: "🧭", h: "Choose your own path", b: "Pick which song to learn, and how fast to go. When the choice is yours, practising feels like your own project." },
      { ic: "📈", h: "See yourself improve", b: "Notice real progress: a passage that was hard last week and is smooth today. Real evidence beats empty praise." },
      { ic: "🤝", h: "Do not walk alone", b: "Share what you play with family, friends or your teacher. Playing for someone is also the best practice for nerves." },
      { ic: "🫶", h: "Nerves are normal", b: "A racing heart before you play is your body getting ready, not a sign that you are bad. Start on a small stage and build up." },
    ] },
  ],
  zh: [
    { id: "focus", title: "为什么弹钢琴的孩子更专注", sub: "把注意力练出来", hue: 210, slides: [
      { ic: "🎹", h: "钢琴如何培养专注力", b: "弹钢琴时，大脑要同时做很多件事，这对注意力来说就是一次锻炼。" },
      { ic: "👀", h: "眼、耳、手一起工作", b: "你要看谱、听声音，还要动手指，这些都发生在同一个瞬间。大脑必须一直守在任务上。" },
      { ic: "🔁", h: "小小的重复，大大的习惯", b: "每一次放慢速度、纠正错误、再试一遍，都是在练习有意识地集中注意力。" },
      { ic: "🧠", h: "研究怎么说", b: "研究发现，音乐训练与更好的注意力和规划能力有关。这种效果是真实的，但幅度不大，需要长期坚持才会增强。" },
      { ic: "⏱️", h: "今天就试试", b: "专注练十到十五分钟，胜过心不在焉地练一个小时。把手机放远一点，选一小段，慢慢弹。" },
    ] },
    { id: "synapse", title: "练琴如何让神经元连接起来", sub: "重复会重塑大脑", hue: 280, slides: [
      { ic: "⚡", h: "神经元互相交流", b: "大脑是由神经元组成的网络。神经元之间通过叫做突触的连接，传递微小的信号。" },
      { ic: "🔁", h: "练习让通路更强", b: "当你重复一个动作，同一组神经元会一次又一次地一起放电。经常使用的连接会变得更牢固。" },
      { ic: "🧬", h: "大脑是可以改变的", b: "这种能力叫做神经可塑性。无论多大年纪，大脑都会根据你练习的内容不断调整。" },
      { ic: "🌉", h: "左右脑一起合作", b: "双手弹琴会让左右两半大脑一起工作。音乐家的两侧大脑之间，往往有更紧密的联系。" },
      { ic: "🌱", h: "这对你意味着什么", b: "不需要先有天赋。缓慢而认真的重复，就是连接生长的方式。请耐心一点，明天再来练。" },
    ] },
    { id: "regions", title: "弹琴时哪些脑区在工作", sub: "整个大脑的运动", hue: 160, slides: [
      { ic: "🎼", h: "弹琴会用到整个大脑", b: "一段简单的旋律，就能同时唤醒大脑的许多区域。让我们认识其中的主要角色。" },
      { ic: "✋", h: "运动皮层", b: "它负责规划和控制手指、手和手臂的动作。" },
      { ic: "👂", h: "听觉皮层", b: "它倾听你弹出的声音，让你知道这个音对不对。" },
      { ic: "👁️", h: "视觉区域", b: "它们读取谱面上的音符、跟随琴键，让眼睛来引导双手。" },
      { ic: "⏳", h: "小脑和负责规划的大脑", b: "小脑帮助掌握节奏和让动作流畅。大脑前部负责提前规划，并让注意力留在音乐上。" },
      { ic: "🎹", h: "团队合作", b: "这些区域像一个团队一样配合。你弹得越多，它们配合得就越好。" },
    ] },
    { id: "session", title: "真正有效的一次练琴", sub: "先复习，再攻克，最后弹喜欢的曲子", hue: 20, slides: [
      { ic: "🗓️", h: "短而天天练，胜过长而偶尔练", b: "每天练十五到二十分钟，胜过一周只练一次两小时，因为大脑会记住反复遇到的东西。" },
      { ic: "🔁", h: "先快速复习", b: "花大约三分钟，弹一首已经会的曲子或练习一项已学的技巧。再次接触，才能让它留下来。" },
      { ic: "🐢", h: "再攻克卡住的地方", b: "花大约四分钟练新的部分，或者总是卡住的地方。放慢速度，分成小段，弹干净了再提速。" },
      { ic: "🎶", h: "最后弹一首喜欢的曲子", b: "以真正喜欢的曲子收尾。以成功结束，会让你明天还想再来。" },
      { ic: "⏱️", h: "练琴时长要配合年龄", b: "幼儿大约能专注十到十五分钟，大一点的孩子二十到三十分钟，青少年和成人三十到四十五分钟。分成几次短练，往往比一次长练更好。" },
    ] },
    { id: "motivation", title: "保持练琴的动力", sub: "选择、进步、陪伴", hue: 330, slides: [
      { ic: "💪", h: "动力来自三种需要", b: "动机研究表明：当我们感到可以自己选择、感到自己在进步、并且感到有人同行时，就更愿意坚持。" },
      { ic: "🧭", h: "自己选择路线", b: "自己挑选想学的曲子，决定进度的快慢。当选择权在你手里，练琴就像是你自己的小项目。" },
      { ic: "📈", h: "看见自己的进步", b: "留意真实的进步：上周很难的乐句，今天已经流畅。真实的证据，胜过空洞的夸奖。" },
      { ic: "🤝", h: "不要一个人走", b: "把你弹的曲子分享给家人、朋友或老师。弹给别人听，也是克服紧张的最好练习。" },
      { ic: "🫶", h: "紧张很正常", b: "上台前心跳加速，是身体在做准备，并不说明你弹得不好。先从小舞台开始，慢慢增加。" },
    ] },
  ],
};

/* a short soft sound at each cut: a quick filtered noise sweep and one bell, on the shared audio context */
function cutSound(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime, n = ctx.createBufferSource(), len = Math.floor(ctx.sampleRate * 0.35), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    n.buffer = buf; const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(5000, t + 0.3); f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(f); f.connect(g); g.connect(ctx.destination); n.start(t);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sine"; o.frequency.value = 1318.5; og.gain.setValueAtTime(0.0001, t + 0.2); og.gain.exponentialRampToValueAtTime(0.1, t + 0.23); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(og); og.connect(ctx.destination); o.start(t + 0.2); o.stop(t + 1.2);
  } catch { /* no audio: the clip still plays silently */ }
}

export function ConceptClipPlayer({ clip, lang, onClose }: { clip: Clip; lang: "en" | "zh"; onClose: () => void }) {
  const [i, setI] = useState(0), [paused, setPaused] = useState(false), [done, setDone] = useState(false);
  const nextRef = useRef<() => void>(() => {}), musicRef = useRef<any>(null);
  const n = clip.slides.length;
  nextRef.current = () => { if (i + 1 >= n) setDone(true); else setI(i + 1); };
  useEffect(() => {
    warmAudio();
    let m: any = null;
    try { m = createAdvMusic("menu", 0.45); if (m) { m.start(); m.setIntensity && m.setIntensity(1); } } catch { /* silent */ }
    musicRef.current = m;
    return () => { try { m && m.stop(); } catch { /* */ } stopSpeaking(); };
  }, []);
  useEffect(() => {
    if (done) { stopSpeaking(); try { musicRef.current && musicRef.current.stop(); } catch { /* */ } return undefined; }
    if (paused) { stopSpeaking(); return undefined; }
    cutSound((window as any).__tgCineCtx || null);
    const s = clip.slides[i], at = setTimeout(() => {
      try { speakNarration(s.h + ". " + s.b, lang, () => { setTimeout(() => nextRef.current(), 450); }, () => { setTimeout(() => nextRef.current(), 5200); }); }
      catch { setTimeout(() => nextRef.current(), 5200); }
    }, 350);
    return () => { clearTimeout(at); stopSpeaking(); };
  }, [i, paused, done]);
  const s = clip.slides[Math.min(i, n - 1)];
  return (
    <div className="cc-wrap" style={{ ["--h" as any]: clip.hue }} data-clip={clip.id}>
      <div className="cc-bar">{clip.slides.map((_, k) => <i key={k} className={k < i || done ? "on" : k === i ? "cur" : ""} />)}</div>
      <button className="cc-x" onClick={onClose} aria-label="Close">✕</button>
      {!done ? (
        <div className="cc-slide" key={i}>
          <div className="cc-ic">{s.ic}</div>
          <h2>{s.h}</h2>
          <p>{s.b}</p>
        </div>
      ) : (
        <div className="cc-slide"><div className="cc-ic">🎹</div><h2>{lang === "zh" ? "看完了！" : "That's it!"}</h2>
          <p>{lang === "zh" ? "现在去琴上试试吧。" : "Now go and try it at the piano."}</p>
          <button className="cc-btn" onClick={() => { setDone(false); setI(0); }}>{lang === "zh" ? "再看一遍" : "Watch again"}</button></div>
      )}
      {!done && <button className="cc-pause" onClick={() => setPaused(p => !p)}>{paused ? "▶" : "⏸"}</button>}
    </div>
  );
}

export const CLIP_CSS = `
.cc-wrap{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;color:#fff;padding:24px;background:radial-gradient(circle at 30% 20%,hsl(var(--h) 70% 32%),hsl(calc(var(--h) + 40) 60% 10%) 70%)}
.cc-bar{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));left:16px;right:64px;display:flex;gap:5px}
.cc-bar i{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.25)}.cc-bar i.on{background:#fff}.cc-bar i.cur{background:linear-gradient(90deg,#fff 50%,rgba(255,255,255,.25) 50%);background-size:200% 100%;animation:ccfill 6s linear forwards}
@keyframes ccfill{from{background-position:100% 0}to{background-position:0 0}}
.cc-x,.cc-pause{position:absolute;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35);color:#fff;font-size:16px;cursor:pointer}
.cc-x{top:calc(8px + env(safe-area-inset-top,0px));right:12px}.cc-pause{bottom:calc(22px + env(safe-area-inset-bottom,0px));right:16px}
.cc-slide{max-width:560px;text-align:center;animation:ccin .6s cubic-bezier(.2,.8,.2,1)}
.cc-ic{font-size:96px;line-height:1;margin-bottom:18px;animation:ccpop .8s cubic-bezier(.2,1.4,.4,1)}
.cc-slide h2{font-size:28px;line-height:1.2;margin:0 0 14px;text-wrap:balance}.cc-slide p{font-size:19px;line-height:1.55;margin:0;opacity:.92}
.cc-btn{margin-top:22px;padding:12px 26px;border-radius:999px;border:0;background:#fff;color:#111;font-weight:700;font-size:16px;cursor:pointer}
@keyframes ccin{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}@keyframes ccpop{from{transform:scale(.4) rotate(-12deg);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.cc-slide,.cc-ic,.cc-bar i.cur{animation:none}}
.cc-list{position:absolute;inset:0;z-index:20;overflow-y:auto;padding:calc(70px + env(safe-area-inset-top,0px)) 16px 24px;display:flex;flex-direction:column;gap:12px;background:#000}
.cc-card{display:flex;gap:14px;align-items:center;text-align:left;border:0;border-radius:18px;padding:14px 16px;color:#fff;cursor:pointer;background:linear-gradient(135deg,hsl(var(--h) 60% 30%),hsl(calc(var(--h) + 40) 55% 14%))}
.cc-card b{display:block;font-size:17px;margin-bottom:3px}.cc-card span.s{font-size:13px;opacity:.8}.cc-card .e{font-size:40px}
`;
