/* Concept clips for the Video Lessons page (owner, 2026-10-23): the Thai video series on how to think about practising the piano, redone in English and
   Mandarin. Each clip is drawn live (animated slides), narrated by the device's own voice, with a generated music bed and a short sound at each cut.
   The Thai clips are YouTube videos; the first three here follow their titles (concentration, neural connections, which brain areas work); the last two are about HOW to practise
   (the owner's correction: concept clips mean practice concepts, not marketing) and use the app's own practice-planning and motivation knowledge (`teacher-craft-seed.js`). No third-party footage, music or voice. */
import { useEffect, useRef, useState } from "react";
import { speakNarration, speakCloud, stopSpeaking, stopCloudTTS, ttsBudgetSpend, ttsBudgetRefund, ttsEstSeconds } from "./speech";
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

/* The picture behind a clip: a neon cyberpunk city at night (layered skyline, lit windows, signs, flying cars, rain) with a headphoned pianist at a synth,
   painted live on a canvas in the clip's hue. Only the clip being watched animates. */
function paintCity(cv: HTMLCanvasElement, hue: number, t: number) {
  const g = cv.getContext("2d"); if (!g) return; const W = cv.width, H = cv.height;
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, `hsl(${hue + 200} 60% 8%)`); sky.addColorStop(0.55, `hsl(${hue + 250} 55% 18%)`); sky.addColorStop(1, `hsl(${hue + 300} 60% 26%)`);
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let layer = 0; layer < 3; layer++) {
    const base = H * (0.62 + layer * 0.06), sh = 0.35 + layer * 0.3, par = Math.sin(t * 0.0002 + layer) * 4 * (layer + 1);
    g.fillStyle = `hsl(${hue + 230} 45% ${6 + layer * 4}%)`;
    let x = -20;
    while (x < W + 40) {
      const w = (28 + rnd() * 50) * (1 + layer * 0.35), h = (H * (0.18 + rnd() * 0.34)) * (1.1 - layer * 0.15);
      g.fillRect(x + par, base - h, w, h + H);
      for (let wy = base - h + 8; wy < base - 6; wy += 11 * (1 + layer * 0.3)) for (let wx = x + 5; wx < x + w - 6; wx += 9 * (1 + layer * 0.3)) {
        if (rnd() < 0.28) { g.fillStyle = rnd() < 0.5 ? `hsla(${hue + 170} 90% 65% / ${0.35 + sh * 0.3})` : `hsla(${hue + 320} 90% 65% / ${0.3 + sh * 0.3})`; g.fillRect(wx + par, wy, 3, 4); g.fillStyle = `hsl(${hue + 230} 45% ${6 + layer * 4}%)`; }
      }
      if (rnd() < 0.3) { const c = rnd() < 0.5 ? `hsl(${hue + 170} 100% 62%)` : `hsl(${hue + 320} 100% 66%)`; g.shadowColor = c; g.shadowBlur = 14; g.fillStyle = c; g.fillRect(x + par + w * 0.3, base - h * 0.9, 3, h * 0.45); g.shadowBlur = 0; g.fillStyle = `hsl(${hue + 230} 45% ${6 + layer * 4}%)`; }
      x += w + 2 + rnd() * 8;
    }
  }
  for (let k = 0; k < 4; k++) { const cx = ((t * 0.04 * (1 + k * 0.4) + k * 260) % (W + 120)) - 60, cy = H * (0.18 + k * 0.09); g.shadowColor = "#7df"; g.shadowBlur = 10; g.fillStyle = k % 2 ? "#ff6ad5" : "#7df"; g.fillRect(cx, cy, 22, 3); g.shadowBlur = 0; }
  const pg = g.createRadialGradient(W * 0.2, H * 0.78, 4, W * 0.2, H * 0.78, W * 0.5); pg.addColorStop(0, `hsla(${hue + 170} 100% 60% / .35)`); pg.addColorStop(1, "transparent"); g.fillStyle = pg; g.fillRect(0, 0, W, H);
  /* the pianist, left: head, headphones, shoulder, an arm to a glowing synth */
  g.fillStyle = `hsl(${hue + 260} 40% 4%)`; g.beginPath(); g.ellipse(W * 0.2, H * 0.62, W * 0.065, W * 0.075, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(W * 0.04, H * 0.9); g.quadraticCurveTo(W * 0.08, H * 0.68, W * 0.2, H * 0.7); g.quadraticCurveTo(W * 0.34, H * 0.68, W * 0.38, H * 0.9); g.fill();
  g.strokeStyle = `hsl(${hue + 170} 100% 62%)`; g.lineWidth = 5; g.shadowColor = g.strokeStyle as string; g.shadowBlur = 12; g.beginPath(); g.arc(W * 0.2, H * 0.62, W * 0.078, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  g.fillStyle = g.strokeStyle as string; g.fillRect(W * 0.2 - W * 0.082, H * 0.62 - 4, 8, 18); g.fillRect(W * 0.2 + W * 0.074, H * 0.62 - 4, 8, 18); g.shadowBlur = 0;
  g.fillStyle = `hsl(${hue + 260} 35% 8%)`; g.fillRect(W * 0.02, H * 0.86, W * 0.7, H * 0.045);
  for (let k = 0; k < 14; k++) { const lit = Math.sin(t * 0.004 + k) > 0.6; g.fillStyle = lit ? `hsl(${hue + 320} 100% 66%)` : "#eaf6ff"; g.fillRect(W * 0.03 + k * (W * 0.048), H * 0.86, W * 0.04, H * 0.03); }
  g.fillStyle = `hsla(${hue + 170} 100% 62% / .9)`; g.fillRect(W * 0.52, H * 0.76, W * 0.18, H * 0.07);
  g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 1; g.beginPath();
  for (let k = 0; k < 60; k++) { const rx = ((k * 53 + t * 0.35) % (W + 40)) - 20, ry = ((k * 97 + t * 0.9) % H); g.moveTo(rx, ry); g.lineTo(rx - 3, ry + 14); } g.stroke();
}


/* A neon hologram panel that shows what the slide is about (a drawn scene per slide: neurons firing, keys lighting up, a sound wave, a timer ring, a calendar filling, ...) */
type Kind = "neurons" | "keys" | "wave" | "timer" | "grid" | "bridge" | "ecg" | "orbit" | "staff" | "rings";
const SCENES: Record<string, Kind[]> = {
  focus: ["keys", "staff", "rings", "neurons", "timer"],
  synapse: ["neurons", "rings", "neurons", "bridge", "grid"],
  regions: ["orbit", "keys", "wave", "staff", "timer", "orbit"],
  session: ["grid", "rings", "timer", "keys", "orbit"],
  motivation: ["orbit", "staff", "grid", "orbit", "ecg"],
};
function paintHolo(cv: HTMLCanvasElement, kind: Kind, hue: number, t: number) {
  const g = cv.getContext("2d"); if (!g) return; const W = cv.width, H = cv.height, tt = t / 1000;
  const c1 = `hsl(${hue + 170} 100% 62%)`, c2 = `hsl(${hue + 320} 100% 68%)`, c3 = `hsl(${hue + 60} 100% 70%)`;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "rgba(4,6,20,.55)"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(255,255,255,.05)"; g.lineWidth = 1; for (let y = (tt * 20) % 6; y < H; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const glow = (c: string, b = 12) => { g.shadowColor = c; g.shadowBlur = b; };
  const node = (x: number, y: number, r: number, c: string) => { glow(c, 14); g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.shadowBlur = 0; };
  const pts: [number, number][] = []; let sd = 11; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  if (kind === "neurons" || kind === "bridge") {
    for (let i = 0; i < 16; i++) pts.push([W * (0.08 + 0.84 * rnd()), H * (0.12 + 0.76 * rnd())]);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d > W * 0.3) continue;
      const strong = 0.5 + 0.5 * Math.sin(tt * 0.8 + i), a = (kind === "bridge" ? 0.35 : 0.2 + 0.45 * strong); g.strokeStyle = `hsla(${hue + 170} 100% 65% / ${a})`; g.lineWidth = 0.8 + 2 * strong * (i % 3 === 0 ? 1 : 0.3); g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[j][0], pts[j][1]); g.stroke();
      const f = (tt * 0.6 + i * 0.37 + j * 0.11) % 1; if (f < 0.5) node(pts[i][0] + (pts[j][0] - pts[i][0]) * f * 2, pts[i][1] + (pts[j][1] - pts[i][1]) * f * 2, 2.2, c2);
    }
    pts.forEach(([x, y], i) => node(x, y, 3 + 2 * Math.abs(Math.sin(tt * 1.4 + i)), i % 2 ? c1 : c3));
  } else if (kind === "keys") {
    const n = 14, kw = W / n, lit = Math.floor(tt * 4) % n;
    for (let k = 0; k < n; k++) { const on = k === lit || k === (lit + 4) % n; g.fillStyle = on ? c1 : "rgba(235,245,255,.9)"; if (on) glow(c1, 16); g.fillRect(k * kw + 1, H * 0.42, kw - 2, H * 0.52); g.shadowBlur = 0; if (on) { g.fillStyle = c2; for (let m = 0; m < 4; m++) { const f = (tt * 0.9 + m * 0.25) % 1; g.globalAlpha = 1 - f; g.fillRect(k * kw + kw * 0.3, H * 0.4 - f * H * 0.38, 6, 6); g.globalAlpha = 1; } } }
    g.fillStyle = "#07091a"; for (let k = 0; k < n; k++) if ([0, 1, 3, 4, 5].includes(k % 7)) g.fillRect(k * kw + kw * 0.68, H * 0.42, kw * 0.6, H * 0.32);
  } else if (kind === "wave") {
    for (let i = 0; i < 46; i++) { const h = (0.15 + 0.7 * Math.abs(Math.sin(tt * 3 + i * 0.5) * Math.sin(tt * 1.3 + i * 0.17))) * H * 0.8; const c = i % 2 ? c1 : c2; glow(c, 8); g.fillStyle = c; g.fillRect(8 + i * ((W - 16) / 46), (H - h) / 2, 3, h); } g.shadowBlur = 0;
  } else if (kind === "timer") {
    const r = Math.min(W, H) * 0.36, cx = W / 2, cy = H / 2, p = (tt * 0.25) % 1;
    g.lineWidth = 8; g.strokeStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    glow(c1, 14); g.strokeStyle = c1; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * 7); g.stroke(); g.shadowBlur = 0;
    g.strokeStyle = c2; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(-Math.PI / 2 + p * 7) * r * 0.8, cy + Math.sin(-Math.PI / 2 + p * 7) * r * 0.8); g.stroke(); node(cx, cy, 5, c3);
  } else if (kind === "grid") {
    const cols = 7, rows = 4, cw = W / (cols + 1), ch = H / (rows + 1), lit = Math.floor(tt * 3) % (cols * rows + 4);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c, on = i < lit; const x = cw * (c + 0.6), y = ch * (r + 0.6); if (on) glow(c1, 10); g.fillStyle = on ? (i % 5 === 0 ? c2 : c1) : "rgba(255,255,255,.12)"; g.fillRect(x, y, cw * 0.78, ch * 0.72); g.shadowBlur = 0; }
  } else if (kind === "ecg") {
    glow(c1, 12); g.strokeStyle = c1; g.lineWidth = 3; g.beginPath();
    for (let x = 0; x < W; x += 3) { const u = ((x / W) * 3 - tt * 0.6) % 1, y = H / 2 + (u > 0.42 && u < 0.46 ? -H * 0.38 : u > 0.46 && u < 0.5 ? H * 0.28 : Math.sin(x * 0.12) * 2); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); g.shadowBlur = 0;
    node(W * 0.5, H * 0.5, 4 + 3 * Math.abs(Math.sin(tt * 5)), c2);
  } else if (kind === "orbit") {
    const cx = W / 2, cy = H / 2; node(cx, cy, 11, c3);
    for (let i = 0; i < 3; i++) { const rr = H * (0.2 + i * 0.13); g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, rr * 1.6, rr, 0, 0, 7); g.stroke(); const a = tt * (0.9 - i * 0.2) + i * 2.1; node(cx + Math.cos(a) * rr * 1.6, cy + Math.sin(a) * rr, 6, [c1, c2, c3][i]); }
  } else if (kind === "staff") {
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.5; for (let l = 0; l < 5; l++) { g.beginPath(); g.moveTo(8, H * (0.28 + l * 0.11)); g.lineTo(W - 8, H * (0.28 + l * 0.11)); g.stroke(); }
    const cur = (tt * 90) % (W - 40) + 20; for (let k = 0; k < 8; k++) { const x = 30 + k * ((W - 60) / 8), y = H * (0.28 + ((k * 3) % 5) * 0.055 + 0.02), hit = Math.abs(x - cur) < 18; if (hit) glow(c2, 14); g.fillStyle = hit ? c2 : "#e8f2ff"; g.beginPath(); g.ellipse(x, y, 6, 4.5, -0.3, 0, 7); g.fill(); g.shadowBlur = 0; }
    glow(c1, 14); g.fillStyle = c1; g.fillRect(cur - 1.5, H * 0.18, 3, H * 0.66); g.shadowBlur = 0;
  } else {
    for (let i = 0; i < 5; i++) { const f = (tt * 0.5 + i * 0.2) % 1; g.strokeStyle = `hsla(${hue + 170 + i * 30} 100% 65% / ${1 - f})`; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, H / 2, f * H * 0.55, 0, 7); g.stroke(); }
    node(W / 2, H / 2, 9, c3);
  }
  g.strokeStyle = c1; g.lineWidth = 1.5; glow(c1, 8); g.strokeRect(1, 1, W - 2, H - 2); g.shadowBlur = 0;
}
function Holo({ kind, hue, live }: { kind: Kind; hue: number; live: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined; cv.width = 360; cv.height = 190; paintHolo(cv, kind, hue, 1500);
    if (!live) return undefined;
    let raf = 0, last = 0; const loop = (now: number) => { if (now - last > 40) { last = now; paintHolo(cv, kind, hue, now); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [kind, hue, live]);
  return <canvas ref={ref} className="cc-holo" />;
}

function Backdrop({ hue, live }: { hue: number; live: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    const fit = () => { cv.width = Math.min(540, Math.max(1, cv.clientWidth)); cv.height = Math.floor(cv.width * (cv.clientHeight / Math.max(1, cv.clientWidth))); };
    fit(); paintCity(cv, hue, 0);
    if (!live) return undefined;
    let raf = 0, last = 0; const loop = (now: number) => { if (now - last > 50) { last = now; paintCity(cv, hue, now); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [hue, live]);
  return <canvas ref={ref} className="cc-bg" />;
}

/* one clip as a full-screen reel; while it is the one on screen it narrates its slides one after another, and when the LAST slide's voice ends it tells the feed to move on */
function Reel({ clip, active, lang, paused, onEnded }: { clip: Clip; active: boolean; lang: "en" | "zh"; paused: boolean; onEnded: () => void }) {
  const [i, setI] = useState(0), endRef = useRef(onEnded), n = clip.slides.length;
  endRef.current = onEnded;
  useEffect(() => { if (!active) setI(0); }, [active]);
  useEffect(() => {
    if (!active || paused) { stopSpeaking(); return undefined; }
    cutSound((window as any).__tgCineCtx || null);
    let dead = false;
    const go = () => { if (dead) return; if (i + 1 >= n) endRef.current(); else setI(i + 1); };
    const s = clip.slides[i], at = setTimeout(() => {
      /* the natural cloud voice first (a male Gemini voice, cached on the device after the first listen, within the day's allowance at half the chat's price per second),
         then the best voice the device has if the cloud is out of reach or the allowance is spent */
      const text = s.h + ". " + s.b, after = () => setTimeout(go, 300);
      const device = (rest?: string) => { try { speakNarration(rest || text, lang, after, () => { setTimeout(go, 6500); }); } catch { setTimeout(go, 6500); } };
      try {
        speakCloud(text, lang, null, after, (e: any) => { if (!dead) device(e && e.rest); }, 1,
          { src: "clip", spend: (c: string) => ttsBudgetSpend(ttsEstSeconds(c, lang) * 0.5), refund: (c: string) => ttsBudgetRefund(ttsEstSeconds(c, lang) * 0.5) });
      } catch { device(); }
    }, 300);
    return () => { dead = true; clearTimeout(at); stopSpeaking(); try { stopCloudTTS(); } catch { /* */ } };
  }, [active, paused, i]);
  const s = clip.slides[Math.min(i, n - 1)];
  return (
    <section className="cc-reel" style={{ ["--h" as any]: clip.hue }} data-clip={clip.id} data-active={active ? "1" : "0"}>
      <Backdrop hue={clip.hue} live={active && !paused} />
      <div className="cc-shade" />
      <div className="cc-bar">{clip.slides.map((_, k) => <i key={k} className={k < i ? "on" : k === i && active ? "cur" : ""} />)}</div>
      <Holo kind={(SCENES[clip.id] || [])[Math.min(i, n - 1)] || "rings"} hue={clip.hue} live={active && !paused} />
      <div className="cc-title"><span>{s.ic}</span><b>{clip.title}</b></div>
      <div className={"cc-face" + (active && !paused ? " on" : "")}>
        <img src="./img/presenter.jpg" alt="" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
        <span>TIGA Studio · @tiga.studio</span>
      </div>
      <div className="cc-cap" key={i}><h3>{s.h}</h3><p>{s.b}</p></div>
    </section>
  );
}

export function ConceptClipFeed({ clips, lang, start, onClose, inline }: { clips: Clip[]; lang: "en" | "zh"; start: number; onClose: () => void; inline?: boolean }) {
  const [act, setAct] = useState(start), [paused, setPaused] = useState(false);
  const feed = useRef<HTMLDivElement>(null), musicRef = useRef<any>(null), actRef = useRef(act);
  actRef.current = act;
  const goTo = (k: number) => { const el = feed.current; if (!el || k < 0 || k >= clips.length) return; el.scrollTo({ top: k * el.clientHeight, behavior: "smooth" }); };
  useEffect(() => {
    warmAudio();
    let m: any = null;
    try { m = createAdvMusic("clip", 0.9); if (m) { m.start(); m.setIntensity && m.setIntensity(1); } } catch { /* silent */ }
    musicRef.current = m;
    const el = feed.current; if (el) el.scrollTop = start * el.clientHeight;
    return () => { try { m && m.stop(); } catch { /* */ } stopSpeaking(); };
  }, []);
  useEffect(() => {
    const el = feed.current; if (!el) return undefined;
    const onScroll = () => { const k = Math.round(el.scrollTop / Math.max(1, el.clientHeight)); if (k !== actRef.current) setAct(k); };
    el.addEventListener("scroll", onScroll, { passive: true });
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowDown") goTo(actRef.current + 1); if (e.key === "ArrowUp") goTo(actRef.current - 1); if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("keydown", key); };
  }, []);
  return (
    <div className={"cc-wrap" + (inline ? " inline" : "")}>
      <div className="cc-feed" ref={feed}>
        {clips.map((c, k) => (
          <Reel key={c.id} clip={c} active={act === k} lang={lang} paused={paused}
            onEnded={() => { if (actRef.current === k) { if (k + 1 < clips.length) goTo(k + 1); } }} />
        ))}
      </div>
      {!inline && <button className="cc-x" onClick={onClose} aria-label="Close">✕</button>}
      <button className="cc-pause" onClick={() => setPaused(p => !p)}>{paused ? "▶" : "⏸"}</button>
      {act + 1 < clips.length && <div className="cc-hint">⌄</div>}
    </div>
  );
}

export const CLIP_CSS = `
.cc-wrap{position:fixed;inset:0;z-index:120;background:#05030d;color:#fff}
.cc-wrap.inline{position:absolute;z-index:15}.cc-wrap.inline .cc-bar{top:calc(66px + env(safe-area-inset-top,0px));right:62px}.cc-wrap.inline .cc-title{top:calc(86px + env(safe-area-inset-top,0px))}.cc-wrap.inline .cc-pause{top:calc(62px + env(safe-area-inset-top,0px))}.cc-hide{display:none!important}
.cc-feed{position:absolute;inset:0;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;overscroll-behavior:contain}.cc-feed::-webkit-scrollbar{display:none}
.cc-reel{position:relative;height:100%;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden}
.cc-bg{position:absolute;inset:0;width:100%;height:100%;display:block}
.cc-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 22%,transparent 50%,rgba(0,0,0,.78) 100%);pointer-events:none}
.cc-bar{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));left:14px;right:62px;display:flex;gap:5px}
.cc-bar i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.28)}.cc-bar i.on{background:#fff}.cc-bar i.cur{background:#fff;animation:ccblink 1.2s ease-in-out infinite}
@keyframes ccblink{50%{opacity:.45}}
.cc-title{position:absolute;top:calc(34px + env(safe-area-inset-top,0px));left:14px;right:62px;display:flex;gap:8px;align-items:center;font-size:15px;text-shadow:0 1px 8px rgba(0,0,0,.8)}.cc-title span{font-size:22px}.cc-title b{line-height:1.2}
.cc-x,.cc-pause{position:absolute;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.4);color:#fff;font-size:16px;cursor:pointer;z-index:3}
.cc-x{top:calc(8px + env(safe-area-inset-top,0px));right:12px}.cc-pause{top:calc(56px + env(safe-area-inset-top,0px));right:12px;font-size:13px}
.cc-holo{position:absolute;left:50%;transform:translateX(-50%);top:calc(116px + env(safe-area-inset-top,0px));width:min(88vw,380px);height:auto;aspect-ratio:360/190;border-radius:16px;box-shadow:0 0 30px hsla(var(--h),90%,60%,.35);backdrop-filter:blur(2px)}.cc-wrap.inline .cc-holo{top:calc(126px + env(safe-area-inset-top,0px))}
.cc-face{position:absolute;left:50%;bottom:calc(150px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(52vw,230px);display:flex;flex-direction:column;align-items:center;gap:6px}
.cc-face img{width:100%;aspect-ratio:540/640;object-fit:cover;border-radius:26px;border:2px solid rgba(255,255,255,.7);box-shadow:0 0 28px hsla(var(--h),90%,60%,.55),0 10px 40px rgba(0,0,0,.6);-webkit-mask-image:linear-gradient(180deg,#000 82%,transparent 100%);mask-image:linear-gradient(180deg,#000 82%,transparent 100%)}
.cc-face.on img{animation:ccsway 3.2s ease-in-out infinite}.cc-face span{position:absolute;bottom:-18px;font-size:11px;font-weight:700;opacity:.85;letter-spacing:.3px;text-shadow:0 1px 6px #000}
@keyframes ccsway{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.012)}}
.cc-cap{position:absolute;left:16px;right:16px;bottom:calc(26px + env(safe-area-inset-bottom,0px));text-align:center;animation:ccin .5s ease}
.cc-cap h3{font-size:19px;margin:0 0 6px;text-shadow:0 2px 10px rgba(0,0,0,.9);color:hsl(var(--h) 100% 78%)}.cc-cap p{font-size:16px;line-height:1.45;margin:0;font-weight:600;text-shadow:0 2px 10px rgba(0,0,0,.95)}
.cc-hint{position:absolute;left:50%;bottom:calc(4px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);font-size:20px;opacity:.7;animation:ccbob 1.4s ease-in-out infinite;pointer-events:none}
@keyframes ccbob{50%{transform:translate(-50%,5px)}}
@keyframes ccin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.cc-cap,.cc-face.on img,.cc-bar i.cur,.cc-hint{animation:none}}
.cc-list{position:absolute;inset:0;z-index:20;overflow-y:auto;padding:calc(70px + env(safe-area-inset-top,0px)) 16px 24px;display:flex;flex-direction:column;gap:12px;background:#000}
.cc-card{display:flex;gap:14px;align-items:center;text-align:left;border:0;border-radius:18px;padding:14px 16px;color:#fff;cursor:pointer;background:linear-gradient(135deg,hsl(var(--h) 60% 30%),hsl(calc(var(--h) + 40) 55% 14%))}
.cc-card b{display:block;font-size:17px;margin-bottom:3px}.cc-card span.s{font-size:13px;opacity:.8}.cc-card .e{font-size:40px}
`;
