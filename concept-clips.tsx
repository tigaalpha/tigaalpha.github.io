/* Concept clips for the Video Lessons page (owner, 2026-10-23): the Thai video series on how to think about practising the piano, redone in English and
   Mandarin. Each clip is drawn live (animated slides), narrated by the device's own voice, with a generated music bed and a short sound at each cut.
   The Thai clips are YouTube videos; the first three here follow their titles (concentration, neural connections, which brain areas work); the last two are about HOW to practise
   (the owner's correction: concept clips mean practice concepts, not marketing) and use the app's own practice-planning and motivation knowledge (`teacher-craft-seed.js`). No third-party footage, music or voice. */
import { useEffect, useRef, useState } from "react";
import { speakNarration, stopSpeaking, stopCloudTTS } from "./speech";
import { createAdvMusic, warmAudio } from "./adventure-music";
import { finishLook } from "./cg-finish";
import { gfxHigh } from "./adv-gfx";
import { MORE_EN, MORE_ZH, MORE_SCENES } from "./concept-clips-more";

type Slide = { ic: string; h: string; b: string };
export type Clip = { id: string; title: string; sub: string; hue: number; slides: Slide[] };

export const CLIPS: Record<"en" | "zh", Clip[]> = {
  en: [
    { id: "focus", title: "Why piano players focus so well", sub: "Attention, trained", hue: 210, slides: [
      { ic: "🎹", h: "Piano trains focus", b: "Playing the piano makes your brain do many things at once. That is a workout for attention." },
      { ic: "👀", h: "Eyes, ears, hands", b: "You read, listen and move your fingers in the same moment, so your brain must stay on task." },
      { ic: "🔁", h: "Small repeats", b: "Slow down, fix a mistake, try again. Each repeat practises paying attention on purpose." },
      { ic: "⏱️", h: "Try this today", b: "Ten focused minutes beat one distracted hour. Phone away, one short passage, play it slowly." },
    ] },
    { id: "synapse", title: "How practice connects your neurons", sub: "Repetition rewires the brain", hue: 280, slides: [
      { ic: "⚡", h: "Neurons talk", b: "Your brain is a network of neurons passing tiny signals across connections called synapses." },
      { ic: "🔁", h: "Practice strengthens", b: "When you repeat a movement, the same neurons fire together again and again, and those connections get stronger." },
      { ic: "🌉", h: "Both sides work together", b: "Playing with two hands makes both halves of your brain cooperate." },
      { ic: "🌱", h: "Be patient", b: "You do not need talent first. Slow, careful repetition is how the connections grow." },
    ] },
    { id: "regions", title: "Which brain areas work when you play", sub: "A whole-brain activity", hue: 160, slides: [
      { ic: "🎼", h: "The whole brain plays", b: "One simple melody wakes up many parts of your brain at once." },
      { ic: "✋", h: "Motor cortex", b: "It plans and controls your fingers, hands and arms." },
      { ic: "👂", h: "Auditory cortex", b: "It listens to what you play, so you can hear if the note was right." },
      { ic: "👁️", h: "Visual areas", b: "They read the notes on the page and follow the keys." },
      { ic: "⏳", h: "Timing and planning", b: "The cerebellum keeps time and smooths movement, while the front of the brain plans ahead." },
    ] },
    { id: "session", title: "A practice session that works", sub: "Review, fix, then play", hue: 20, slides: [
      { ic: "🗓️", h: "Short and daily", b: "Fifteen minutes every day beats two hours once a week, because the brain keeps what it meets again and again." },
      { ic: "🔁", h: "Three minutes of review", b: "Start with something you already know. Meeting it again is what makes it stay." },
      { ic: "🐢", h: "Four minutes to fix", b: "Take the spot where you get stuck. Play it slowly, in small pieces, and speed up only when it is clean." },
      { ic: "🎶", h: "End with a song you love", b: "Finish with something you enjoy. Ending on a success makes you want to come back tomorrow." },
    ] },
    { id: "motivation", title: "Keeping the motivation to practise", sub: "Choice, progress, company", hue: 330, slides: [
      { ic: "💪", h: "Three needs", b: "We keep going when we can choose, feel ourselves improving, and feel we are not alone." },
      { ic: "🧭", h: "Choose your path", b: "Pick the song and the speed. When the choice is yours, practice is your own project." },
      { ic: "📈", h: "See your progress", b: "Notice a passage that was hard last week and is smooth today. Real evidence beats empty praise." },
      { ic: "🤝", h: "Play for someone", b: "Share what you play with family or friends. It is also the best practice for nerves." },
    ] },
  ],
  zh: [
    { id: "focus", title: "为什么弹钢琴的孩子更专注", sub: "把注意力练出来", hue: 210, slides: [
      { ic: "🎹", h: "钢琴练专注", b: "弹钢琴时大脑要同时做很多件事，这是对注意力的一次锻炼。" },
      { ic: "👀", h: "眼、耳、手", b: "看谱、听声音、动手指同时发生，大脑必须一直守在任务上。" },
      { ic: "🔁", h: "小小的重复", b: "放慢、纠错、再试一遍，每次重复都在练习有意识地集中注意力。" },
      { ic: "⏱️", h: "今天就试试", b: "专注十分钟，胜过分心一小时。放下手机，选一小段，慢慢弹。" },
    ] },
    { id: "synapse", title: "练琴如何连接神经元", sub: "重复会重塑大脑", hue: 280, slides: [
      { ic: "⚡", h: "神经元交流", b: "大脑是神经元组成的网络，通过叫做突触的连接传递微小的信号。" },
      { ic: "🔁", h: "练习让连接更强", b: "重复一个动作时，同一组神经元一次次一起放电，这些连接就会变得更牢固。" },
      { ic: "🌉", h: "左右脑一起合作", b: "双手弹琴会让左右两半大脑一起工作。" },
      { ic: "🌱", h: "请耐心", b: "不需要先有天赋。缓慢而认真的重复，就是连接生长的方式。" },
    ] },
    { id: "regions", title: "弹琴时哪些脑区在工作", sub: "整个大脑的运动", hue: 160, slides: [
      { ic: "🎼", h: "整个大脑在弹琴", b: "一段简单的旋律，就能同时唤醒大脑的许多区域。" },
      { ic: "✋", h: "运动皮层", b: "它负责规划和控制手指、手和手臂。" },
      { ic: "👂", h: "听觉皮层", b: "它倾听你弹出的声音，让你知道这个音对不对。" },
      { ic: "👁️", h: "视觉区域", b: "它们读取谱面上的音符，并跟随琴键。" },
      { ic: "⏳", h: "节奏与规划", b: "小脑负责节奏和动作的流畅，大脑前部负责提前规划。" },
    ] },
    { id: "session", title: "真正有效的一次练琴", sub: "先复习，再攻克，最后弹喜欢的曲子", hue: 20, slides: [
      { ic: "🗓️", h: "短而天天练", b: "每天练十五分钟，胜过一周只练一次两小时，因为大脑会记住反复遇到的东西。" },
      { ic: "🔁", h: "先复习三分钟", b: "从已经会的内容开始，再次接触才能让它留下来。" },
      { ic: "🐢", h: "再用四分钟攻克", b: "选一个卡住的地方，放慢速度分成小段，弹干净了再提速。" },
      { ic: "🎶", h: "以喜欢的曲子收尾", b: "最后弹一首喜欢的曲子，以成功结束，明天你还会想再来。" },
    ] },
    { id: "motivation", title: "保持练琴的动力", sub: "选择、进步、陪伴", hue: 330, slides: [
      { ic: "💪", h: "三种需要", b: "当我们能自己选择、感到自己在进步、并且不孤单时，就更愿意坚持。" },
      { ic: "🧭", h: "自己选路线", b: "自己挑曲子、定速度，选择权在你手里，练琴就是你自己的小项目。" },
      { ic: "📈", h: "看见进步", b: "留意上周很难、今天已经流畅的乐句，真实的证据胜过空洞的夸奖。" },
      { ic: "🤝", h: "弹给别人听", b: "把你弹的曲子分享给家人朋友，这也是克服紧张的最好练习。" },
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

/* Film look (owner, 2026-10-23: "beautiful, like the Adventure films, my face on top as before"): the same finishing steps the Adventure films use, in small form:
   a moon and twinkling stars behind the skyline (skyArt), then, over the finished frame, slow bokeh discs, a low haze, the shared warm key light / light shafts / bloom
   (`finishLook`), a lens flare with an anamorphic streak, a teal-and-orange grade, a vignette and fine grain. All blends and a few gradients, nothing per pixel. */
function skyArt(g: CanvasRenderingContext2D, W: number, H: number, hue: number, t: number) {
  const tt = t / 1000; let sd = 11; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 70; k++) { const x = r() * W, y = r() * H * 0.5, tw = 0.45 + 0.55 * Math.abs(Math.sin(tt * (0.6 + r()) + k)); g.fillStyle = `rgba(255,255,255,${0.12 + 0.5 * tw * r()})`; g.fillRect(x, y, 1.4, 1.4); }
  const mx = W * 0.78, my = H * 0.17, mr = W * 0.07;
  const halo = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4); halo.addColorStop(0, `hsla(${hue + 190} 90% 80% / .35)`); halo.addColorStop(1, "transparent"); g.fillStyle = halo; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
  const mg = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr); mg.addColorStop(0, "#fffbe8"); mg.addColorStop(1, `hsl(${hue + 200} 40% 70%)`); g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
  g.fillStyle = "rgba(120,130,160,.22)"; g.beginPath(); g.arc(mx - mr * 0.25, my + mr * 0.1, mr * 0.22, 0, 7); g.fill(); g.beginPath(); g.arc(mx + mr * 0.3, my - mr * 0.25, mr * 0.15, 0, 7); g.fill();
}
function cineLook(g: CanvasRenderingContext2D, W: number, H: number, hue: number, t: number) {
  try {
    const tt = t / 1000;
    g.save(); g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 9; k++) { const bx = ((k * 97 + tt * (6 + k * 2)) % (W + 80)) - 40, by = H * (0.2 + ((k * 53) % 60) / 100) + Math.sin(tt * 0.5 + k) * 8, br = 10 + (k % 4) * 9, bg = g.createRadialGradient(bx, by, 0, bx, by, br); const c = k % 2 ? `${hue % 360},100%,70%` : `${(hue + 160) % 360},100%,68%`; bg.addColorStop(0, `hsla(${c},.16)`); bg.addColorStop(1, `hsla(${c},0)`); g.fillStyle = bg; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill(); }
    g.restore();
    const hz = g.createLinearGradient(0, H * 0.55, 0, H * 0.88); hz.addColorStop(0, "rgba(120,140,200,0)"); hz.addColorStop(0.6, `hsla(${hue + 210},60%,60%,.12)`); hz.addColorStop(1, "rgba(120,140,200,0)"); g.fillStyle = hz; g.fillRect(0, H * 0.55, W, H * 0.33);
    finishLook(g, W, H, tt, "255,200,150", 0.55);
    g.save(); g.globalCompositeOperation = "lighter";
    const sx = W * (0.78 + 0.02 * Math.sin(tt * 0.3)), sy = H * 0.17, fg = g.createRadialGradient(sx, sy, 0, sx, sy, H * 0.2); fg.addColorStop(0, "rgba(255,255,255,.28)"); fg.addColorStop(0.3, "rgba(255,210,160,.12)"); fg.addColorStop(1, "rgba(255,210,160,0)"); g.fillStyle = fg; g.fillRect(sx - H * 0.2, sy - H * 0.2, H * 0.4, H * 0.4);
    g.fillStyle = "rgba(160,210,255,.10)"; g.fillRect(0, sy - 1, W, 2);
    const vx = W / 2 - sx, vy = H / 2 - sy; for (const [f, rr, c] of [[0.5, 0.045, "120,200,255"], [1.0, 0.07, "255,170,110"], [1.5, 0.035, "160,255,200"]] as any) { const gx = sx + vx * f, gy = sy + vy * f, gr = g.createRadialGradient(gx, gy, 0, gx, gy, H * rr); gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(0.7, `rgba(${c},.07)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath(); g.arc(gx, gy, H * rr, 0, 7); g.fill(); }
    g.restore();
    g.save(); g.globalCompositeOperation = "soft-light"; g.globalAlpha = 0.4; const gd = g.createLinearGradient(0, 0, 0, H); gd.addColorStop(0, "#2b6f86"); gd.addColorStop(0.55, "#808080"); gd.addColorStop(1, "#d98a4a"); g.fillStyle = gd; g.fillRect(0, 0, W, H); g.restore();
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.5)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,.05)"; let sd = Math.floor(tt * 24) + 5; for (let k = 0; k < 110; k++) { sd = (sd * 16807) % 2147483647; g.fillRect((sd % 1000) / 1000 * W, ((sd >> 5) % 1000) / 1000 * H, 1, 1); }
  } catch (e) {}
}

/* Piano scenes for the backdrop (owner, 2026-10-23: "people playing piano, cyberpunk film, many shots and scenes in every video"). Six drawn scenes, one per shot in turn:
   0 the headphoned pianist at a synth over the city, 1 a grand piano on a neon rooftop, 2 a macro of two hands on the keys, 3 a stage with spotlights and an audience,
   4 an upright piano in a rainy neon alley, 5 a close profile of a pianist in headphones. Code-drawn silhouettes with neon rim light, nothing downloaded. */
function fgPiano(g: CanvasRenderingContext2D, W: number, H: number, hue: number, t: number, sc: number) {
  const dk = `hsl(${hue + 260} 40% 4%)`, cy = `hsl(${hue + 170} 100% 62%)`, pk = `hsl(${hue + 320} 100% 66%)`, tt = t / 1000;
  const glow = (c: string, b: number) => { g.shadowColor = c; g.shadowBlur = b; };
  const noGlow = () => { g.shadowBlur = 0; };
  const grand = (cx: number, by: number, s: number, who: boolean) => {
    g.save(); g.translate(cx, by); g.scale(s, s);
    g.fillStyle = dk; glow(cy, 14); g.strokeStyle = cy; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-170, -40); g.lineTo(-170, -70); g.quadraticCurveTo(-60, -80, 60, -150); g.lineTo(150, -150); g.quadraticCurveTo(190, -110, 190, -60); g.lineTo(190, -40); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = `hsl(${hue + 260} 35% 9%)`; g.fillRect(-170, -42, 360, 14); g.fillRect(-150, -28, 10, 70); g.fillRect(160, -28, 10, 70);
    noGlow();
    for (let k = 0; k < 16; k++) { const on = Math.sin(tt * 3 + k * 1.7) > 0.7; g.fillStyle = on ? pk : "#eaf6ff"; g.fillRect(-168 + k * 10.5, -42, 9, 12); }
    if (who) {
      g.fillStyle = dk; g.fillRect(-250, -26, 60, 12); g.fillRect(-240, -14, 8, 54);
      g.beginPath(); g.ellipse(-218, -118, 20, 22, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(-250, -30); g.quadraticCurveTo(-246, -100, -218, -96); g.quadraticCurveTo(-190, -96, -186, -50); g.lineTo(-186, -30); g.fill();
      g.strokeStyle = pk; glow(pk, 10); g.lineWidth = 4; g.beginPath(); g.arc(-218, -118, 23, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); noGlow();
      const lift = Math.sin(tt * 5) * 6; g.strokeStyle = dk; g.lineWidth = 11; g.lineCap = "round";
      g.beginPath(); g.moveTo(-200, -80); g.lineTo(-165, -62 + lift); g.lineTo(-130, -46 - lift * 0.6); g.stroke();
    }
    g.restore();
  };
  const sky = (c0: string) => { const gr = g.createLinearGradient(0, H * 0.4, 0, H); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, c0); g.fillStyle = gr; g.fillRect(0, H * 0.4, W, H * 0.6); };
  if (sc === 1) {
    sky(`hsla(${hue + 260},60%,6%,.85)`);
    g.fillStyle = `hsl(${hue + 255} 40% 5%)`; g.fillRect(0, H * 0.9, W, H * 0.1);
    grand(W * 0.5, H * 0.9, W / 560 * 1.15, true);
    g.fillStyle = `hsla(${hue + 170},100%,60%,.18)`; g.fillRect(W * 0.08, H * 0.9 + 2, W * 0.84, 3);
  } else if (sc === 2) {
    g.fillStyle = "rgba(2,3,10,.82)"; g.fillRect(0, 0, W, H);
    const kw = W / 9, ky = H * 0.58;
    for (let k = 0; k < 9; k++) { const on = Math.floor(tt * 3.2 + k * 0.7) % 5 === 0; g.fillStyle = on ? pk : "#f1f6ff"; if (on) { glow(pk, 22); } g.fillRect(k * kw + 1, ky + (on ? 5 : 0), kw - 2, H - ky); noGlow(); if (on) { const bm = g.createLinearGradient(0, ky, 0, ky - H * 0.35); bm.addColorStop(0, "rgba(255,110,210,.45)"); bm.addColorStop(1, "rgba(255,110,210,0)"); g.fillStyle = bm; g.fillRect(k * kw + 4, ky - H * 0.35, kw - 8, H * 0.35); } }
    g.fillStyle = "#06070f"; for (const k of [0, 1, 3, 4, 5, 7]) g.fillRect((k + 1) * kw - kw * 0.28, ky, kw * 0.56, H * 0.2);
    for (let h = 0; h < 2; h++) {
      const hx = W * (0.22 + h * 0.42) + Math.sin(tt * 1.3 + h) * W * 0.04, hy = H * 0.5;
      g.fillStyle = dk; g.strokeStyle = cy; glow(cy, 12); g.lineWidth = 2;
      g.beginPath(); g.ellipse(hx + W * 0.07, hy + H * 0.03, W * 0.1, H * 0.05, 0, 0, 7); g.fill(); g.stroke();
      for (let f = 0; f < 5; f++) { const dn = Math.max(0, Math.sin(tt * 8 + f * 1.3 + h * 2)) * H * 0.04; const fx = hx + f * W * 0.038; g.beginPath(); g.moveTo(fx, hy + H * 0.03); g.lineTo(fx + 2, hy + H * 0.1 + dn); g.lineWidth = W * 0.026; g.lineCap = "round"; g.strokeStyle = dk; g.stroke(); g.lineWidth = 1.5; g.strokeStyle = cy; g.beginPath(); g.arc(fx + 2, hy + H * 0.1 + dn, W * 0.012, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
      noGlow();
    }
  } else if (sc === 3) {
    g.fillStyle = "rgba(2,3,10,.55)"; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 3; k++) { const x0 = W * (0.2 + k * 0.3), sw = Math.sin(tt * 0.9 + k * 2) * W * 0.08, gr = g.createLinearGradient(0, 0, 0, H * 0.85); gr.addColorStop(0, k % 2 ? "rgba(255,120,220,.5)" : "rgba(120,220,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - 6, 0); g.lineTo(x0 + 6, 0); g.lineTo(W * 0.5 + sw + W * 0.2, H * 0.85); g.lineTo(W * 0.5 + sw - W * 0.2, H * 0.85); g.fill(); }
    g.fillStyle = `hsl(${hue + 255} 40% 5%)`; g.fillRect(0, H * 0.8, W, H * 0.2);
    grand(W * 0.5, H * 0.8, W / 560 * 0.95, true);
    g.fillStyle = "#04050c"; for (let r = 0; r < 2; r++) for (let k = 0; k < 9; k++) { const x = (k + 0.5 + r * 0.5) * W / 9, y = H * (0.93 + r * 0.05); g.beginPath(); g.ellipse(x, y, W * 0.035, W * 0.04, 0, 0, 7); g.fill(); g.fillRect(x - W * 0.045, y + W * 0.02, W * 0.09, H * 0.1); if (Math.sin(tt * 2 + k * 2.1 + r) > 0.8) { g.fillRect(x + W * 0.03, y - W * 0.07, 5, W * 0.07); } }
  } else if (sc === 4) {
    g.fillStyle = "rgba(2,3,10,.6)"; g.fillRect(0, 0, W, H);
    g.fillStyle = `hsl(${hue + 245} 40% 7%)`; g.fillRect(0, 0, W * 0.16, H); g.fillRect(W * 0.84, 0, W * 0.16, H);
    glow(pk, 16); g.fillStyle = pk; g.fillRect(W * 0.1, H * 0.12, 5, H * 0.3 * (0.8 + 0.2 * Math.sin(tt * 9))); glow(cy, 16); g.fillStyle = cy; g.fillRect(W * 0.88, H * 0.2, 5, H * 0.25); noGlow();
    g.fillStyle = `hsl(${hue + 255} 35% 6%)`; g.fillRect(0, H * 0.86, W, H * 0.14);
    const ux = W * 0.36, uy = H * 0.86; g.fillStyle = dk; glow(cy, 10); g.strokeStyle = cy; g.lineWidth = 2; g.fillRect(ux, uy - H * 0.2, W * 0.34, H * 0.2); g.strokeRect(ux, uy - H * 0.2, W * 0.34, H * 0.2); noGlow();
    for (let k = 0; k < 12; k++) { g.fillStyle = Math.sin(tt * 4 + k) > 0.8 ? pk : "#eef6ff"; g.fillRect(ux + 4 + k * (W * 0.34 - 8) / 12, uy - H * 0.095, (W * 0.34 - 8) / 12 - 1, H * 0.04); }
    const px = W * 0.26; g.fillStyle = dk; g.beginPath(); g.ellipse(px, uy - H * 0.2, W * 0.035, W * 0.04, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(px - W * 0.07, uy); g.quadraticCurveTo(px - W * 0.05, uy - H * 0.17, px, uy - H * 0.15); g.quadraticCurveTo(px + W * 0.04, uy - H * 0.15, px + W * 0.05, uy); g.fill();
    g.strokeStyle = dk; g.lineWidth = 9; g.lineCap = "round"; g.beginPath(); g.moveTo(px + W * 0.03, uy - H * 0.12); g.lineTo(ux + W * 0.04, uy - H * 0.09 + Math.sin(tt * 6) * 4); g.stroke();
    const rf = g.createLinearGradient(0, uy, 0, H); rf.addColorStop(0, "rgba(255,110,210,.25)"); rf.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rf; g.fillRect(ux, uy, W * 0.34, H - uy);
  } else if (sc === 5) {
    g.fillStyle = "rgba(2,3,10,.78)"; g.fillRect(0, 0, W, H);
    glow(pk, 26); g.strokeStyle = pk; g.lineWidth = 9; g.beginPath(); g.arc(W * 0.58, H * 0.4, W * 0.3 + Math.sin(tt * 2) * 3, 0, 7); g.stroke(); glow(cy, 20); g.strokeStyle = cy; g.lineWidth = 3; g.beginPath(); g.arc(W * 0.58, H * 0.4, W * 0.36, 0, 7); g.stroke(); noGlow();
    const hx = W * 0.42, hy = H * 0.4; g.fillStyle = dk;
    g.beginPath(); g.ellipse(hx, hy, W * 0.2, H * 0.17, 0.1, 0, 7); g.fill();
    g.beginPath(); g.moveTo(hx + W * 0.19, hy - 4); g.lineTo(hx + W * 0.24, hy + H * 0.04); g.lineTo(hx + W * 0.19, hy + H * 0.06); g.fill();
    g.beginPath(); g.moveTo(hx - W * 0.2, H); g.quadraticCurveTo(hx - W * 0.12, hy + H * 0.2, hx - W * 0.02, hy + H * 0.15); g.quadraticCurveTo(hx + W * 0.1, hy + H * 0.2, hx + W * 0.18, H); g.fill();
    glow(cy, 14); g.strokeStyle = cy; g.lineWidth = 3; g.beginPath(); g.ellipse(hx, hy, W * 0.2, H * 0.17, 0.1, -0.9, 0.8); g.stroke();
    g.strokeStyle = pk; g.lineWidth = 9; g.beginPath(); g.arc(hx, hy - H * 0.02, W * 0.205, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillStyle = pk; g.beginPath(); g.ellipse(hx + W * 0.04, hy + H * 0.02, W * 0.05, H * 0.07, 0, 0, 7); g.fill(); noGlow();
    for (let k = 0; k < 9; k++) { g.fillStyle = Math.sin(tt * 3 + k * 1.3) > 0.7 ? pk : "#eaf6ff"; g.fillRect(k * W / 9 + 1, H * 0.93, W / 9 - 2, H * 0.07); }
  }
}
/* Sharpness (owner, 2026-10-23: "same grade as the Adventure films"): the films render at device pixel ratio up to 2 in High; the clip canvases were drawn small and stretched. They now draw in logical units under a scale `k` (High 2, Lite 1.3). */
const kOf = (cv: HTMLCanvasElement) => Number((cv as any)._k) || 1;
function paintCity(cv: HTMLCanvasElement, hue: number, t: number, sc = 0) {
  const g = cv.getContext("2d"); if (!g) return; const k = kOf(cv), W = cv.width / k, H = cv.height / k; g.setTransform(k, 0, 0, k, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, `hsl(${hue + 200} 60% 8%)`); sky.addColorStop(0.55, `hsl(${hue + 250} 55% 18%)`); sky.addColorStop(1, `hsl(${hue + 300} 60% 26%)`);
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  skyArt(g, W, H, hue, t);
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
  if (sc > 0) { try { fgPiano(g, W, H, hue, t, sc); } catch (e) { g.shadowBlur = 0; } } else {
  /* the pianist, left: head, headphones, shoulder, an arm to a glowing synth */
  g.fillStyle = `hsl(${hue + 260} 40% 4%)`; g.beginPath(); g.ellipse(W * 0.2, H * 0.62, W * 0.065, W * 0.075, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(W * 0.04, H * 0.9); g.quadraticCurveTo(W * 0.08, H * 0.68, W * 0.2, H * 0.7); g.quadraticCurveTo(W * 0.34, H * 0.68, W * 0.38, H * 0.9); g.fill();
  g.strokeStyle = `hsl(${hue + 170} 100% 62%)`; g.lineWidth = 5; g.shadowColor = g.strokeStyle as string; g.shadowBlur = 12; g.beginPath(); g.arc(W * 0.2, H * 0.62, W * 0.078, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  g.fillStyle = g.strokeStyle as string; g.fillRect(W * 0.2 - W * 0.082, H * 0.62 - 4, 8, 18); g.fillRect(W * 0.2 + W * 0.074, H * 0.62 - 4, 8, 18); g.shadowBlur = 0;
  g.fillStyle = `hsl(${hue + 260} 35% 8%)`; g.fillRect(W * 0.02, H * 0.86, W * 0.7, H * 0.045);
  for (let k = 0; k < 14; k++) { const lit = Math.sin(t * 0.004 + k) > 0.6; g.fillStyle = lit ? `hsl(${hue + 320} 100% 66%)` : "#eaf6ff"; g.fillRect(W * 0.03 + k * (W * 0.048), H * 0.86, W * 0.04, H * 0.03); }
  g.fillStyle = `hsla(${hue + 170} 100% 62% / .9)`; g.fillRect(W * 0.52, H * 0.76, W * 0.18, H * 0.07);
  }
  g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 1; g.beginPath();
  for (let k = 0; k < 60; k++) { const rx = ((k * 53 + t * 0.35) % (W + 40)) - 20, ry = ((k * 97 + t * 0.9) % H); g.moveTo(rx, ry); g.lineTo(rx - 3, ry + 14); } g.stroke();
  cityFx(cv, g, hue, t);
  cineLook(g, W, H, hue, t);
}


/* A neon hologram panel that shows what the slide is about (a drawn scene per slide: neurons firing, keys lighting up, a sound wave, a timer ring, a calendar filling, ...) */
type Kind = "neurons" | "keys" | "wave" | "timer" | "grid" | "bridge" | "ecg" | "orbit" | "staff" | "rings";
/* shot lengths in seconds, mixed on purpose: quick cuts (1-3 s) between held shots (5 s and 10 s) so the eye gets rest and does not tire; a slide change always cuts too */
const SHOT_LEN = [10, 2, 5, 1.5, 10, 3, 5, 1.2, 8, 2.5, 5, 10, 1.8, 5, 3];
CLIPS.en.push(...MORE_EN); CLIPS.zh.push(...MORE_ZH);   // 20 clips per language
const ALL_KINDS: Kind[] = ["neurons", "keys", "wave", "timer", "grid", "bridge", "ecg", "orbit", "staff", "rings"];
const SCENES: Record<string, Kind[]> = {   // one kind per slide, in the slide order of CLIPS (keep the two in step when slides are added or removed)
  focus: ["keys", "staff", "rings", "timer"],
  synapse: ["neurons", "rings", "bridge", "grid"],
  regions: ["orbit", "keys", "wave", "staff", "timer"],
  session: ["grid", "rings", "timer", "keys"],
  motivation: ["orbit", "staff", "grid", "ecg"],
};
Object.assign(SCENES, MORE_SCENES);
function paintHolo(cv: HTMLCanvasElement, kind: Kind, hue: number, t: number) {
  const g = cv.getContext("2d"); if (!g) return; const k = kOf(cv), W = cv.width / k, H = cv.height / k, tt = t / 1000; g.setTransform(k, 0, 0, k, 0, 0);
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
    const cv = ref.current; if (!cv) return undefined; const hk = gfxHigh() ? 2 : 1.3; (cv as any)._k = hk; cv.width = Math.round(360 * hk); cv.height = Math.round(190 * hk); paintHolo(cv, kind, hue, 1500);
    if (!live) return undefined;
    let raf = 0, last = 0; const loop = (now: number) => { if (now - last > 40) { last = now; paintHolo(cv, kind, hue, now); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [kind, hue, live]);
  return <canvas ref={ref} className="cc-holo" />;
}


/* the second pass of the city: a wet street with a perspective neon grid and reflections, searchlight cones, and a soft bloom of everything bright */
function cityFx(cv: HTMLCanvasElement, g: CanvasRenderingContext2D, hue: number, t: number) {
  const k = kOf(cv), W = cv.width / k, H = cv.height / k, hz = H * 0.84, tt = t / 1000;
  const sl = (x: number, a: number, c: string) => { const gr = g.createLinearGradient(x, H * 0.7, x + Math.sin(a) * W * 0.5, 0); gr.addColorStop(0, c); gr.addColorStop(1, "transparent"); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 6, H * 0.7); g.lineTo(x + 6, H * 0.7); g.lineTo(x + Math.sin(a) * W * 0.5 + 60, 0); g.lineTo(x + Math.sin(a) * W * 0.5 - 60, 0); g.fill(); };
  g.save(); g.globalCompositeOperation = "lighter"; sl(W * 0.25, tt * 0.5, `hsla(${hue + 170} 100% 60% / .16)`); sl(W * 0.78, -tt * 0.4 + 1, `hsla(${hue + 320} 100% 62% / .14)`); g.restore();
  const st = g.createLinearGradient(0, hz, 0, H); st.addColorStop(0, `hsl(${hue + 260} 50% 9%)`); st.addColorStop(1, `hsl(${hue + 280} 60% 3%)`); g.fillStyle = st; g.fillRect(0, hz, W, H - hz);
  g.strokeStyle = `hsla(${hue + 170} 100% 62% / .55)`; g.lineWidth = 1; g.shadowColor = `hsl(${hue + 170} 100% 62%)`; g.shadowBlur = 6; g.beginPath();
  for (let k = -10; k <= 10; k++) { g.moveTo(W / 2 + k * 8, hz); g.lineTo(W / 2 + k * W * 0.34, H); }
  for (let k = 0; k < 7; k++) { const f = ((k + tt * 0.8) % 7) / 7, y = hz + (H - hz) * f * f; g.moveTo(0, y); g.lineTo(W, y); } g.stroke(); g.shadowBlur = 0;
  g.save(); g.globalAlpha = 0.18; g.scale(1, -1); g.drawImage(cv, 0, 0, W, hz, 0, -(hz + (H - hz)), W, hz * 0.55); g.restore();
  /* bloom: a blurred, brightened copy of the whole frame added back */
  const sm = document.createElement("canvas"); sm.width = Math.max(1, (W * k) >> 3); sm.height = Math.max(1, (H * k) >> 3); const sg = sm.getContext("2d");
  if (sg) { sg.drawImage(cv, 0, 0, sm.width, sm.height); g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.55; g.drawImage(sm, 0, 0, W, H); g.restore(); }
}

function Backdrop({ hue, live, sc = 0 }: { hue: number; live: boolean; sc?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    const fit = () => { const k = gfxHigh() ? 2 : 1.3, w = Math.min(540, Math.max(1, cv.clientWidth)); (cv as any)._k = k; cv.width = Math.round(w * k); cv.height = Math.round(w * (cv.clientHeight / Math.max(1, cv.clientWidth)) * k); };
    fit(); paintCity(cv, hue, 0, sc);
    if (!live) return undefined;
    let raf = 0, last = 0; const loop = (now: number) => { if (now - last > 50) { last = now; paintCity(cv, hue, now, sc); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [hue, live, sc]);
  return <canvas ref={ref} className="cc-bg" />;
}

/* one clip as a full-screen reel; while it is the one on screen it narrates its slides one after another, and when the LAST slide's voice ends it tells the feed to move on */
function wordsOf(t: string, lang: string): string[] { if (lang !== "zh") return t.split(/\s+/).filter(Boolean); const out: string[] = []; let cur = ""; for (const ch of t) { cur += ch; if (cur.length >= 3 || /[，。、；！？]/.test(ch)) { out.push(cur); cur = ""; } } if (cur) out.push(cur); return out; }
function Reel({ clip, active, lang, paused, onEnded }: { clip: Clip; active: boolean; lang: "en" | "zh"; paused: boolean; onEnded: () => void }) {
  const [i, setI] = useState(0), [shot, setShot] = useState(0), [wi, setWi] = useState(-1), endRef = useRef(onEnded), n = clip.slides.length;
  endRef.current = onEnded;
  useEffect(() => { if (!active) setI(0); }, [active]);
  useEffect(() => {
    if (!active || paused) { stopSpeaking(); return undefined; }
    cutSound((window as any).__tgCineCtx || null);
    let dead = false, iv: any = 0; setWi(-1);
    const go = () => { if (dead) return; if (i + 1 >= n) endRef.current(); else setI(i + 1); };
    const s = clip.slides[i], at = setTimeout(() => {
      /* the device's own voice, chosen strictly: a male, natural / neural / enhanced voice if the phone has one (owner, 2026-10-23: device voices are fine, pick the most natural male one) */
      const text = s.b, words = wordsOf(text, lang), cps = lang === "zh" ? 5.6 : 15.5, per = (text.length / cps / Math.max(1, words.length)) * 1000;
      let w = 0; setWi(0); iv = setInterval(() => { w++; setWi(w); if (w >= words.length) { clearInterval(iv); } }, Math.max(110, per));
      try { speakNarration(text, lang, () => { clearInterval(iv); go(); }, () => { setTimeout(go, 6500); }, 0.95, 0, true); } catch { setTimeout(go, 6500); }
    }, 80);
    return () => { dead = true; clearTimeout(at); clearInterval(iv); stopSpeaking(); try { stopCloudTTS(); } catch { /* */ } };
  }, [active, paused, i]);
  const clipSeed = clip.id.length;
  /* shots run on their own clock across the whole clip (a 10 s hold can span two voice lines); every slide is cut into shots (about 1.6 s each, never over 5 s): a new hologram scene, a new camera move, a flash and a whoosh, so the picture keeps changing while one voice line runs */
  useEffect(() => {
    if (!active) setShot(0);
    if (!active || paused) return undefined;
    let dead = false, tm: any = 0, k = 0;
    const tick = () => { tm = setTimeout(() => { if (dead) return; k++; setShot((x) => x + 1); cutSound((window as any).__tgCineCtx || null); tick(); }, SHOT_LEN[(k + clipSeed) % SHOT_LEN.length] * 1000); };
    tick();
    return () => { dead = true; clearTimeout(tm); };
  }, [active, paused]);
  const s = clip.slides[Math.min(i, n - 1)];
  const kinds = SCENES[clip.id] || [], base = kinds[Math.min(i, n - 1)] || "rings", pool: Kind[] = [base, kinds[(i + 1) % Math.max(1, kinds.length)] || "wave", ALL_KINDS[(i * 3 + 2) % ALL_KINDS.length], ALL_KINDS[(i * 5 + 4) % ALL_KINDS.length]];
  const hk = pool[shot % pool.length], cam = shot % 5;
  return (
    <section className="cc-reel" style={{ ["--h" as any]: clip.hue }} data-cam={cam} data-clip={clip.id} data-active={active ? "1" : "0"}>
      <Backdrop hue={clip.hue + (shot % 4) * 38} live={active && !paused} sc={(shot + clip.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 6} />
      <div className="cc-shade" />
      <Holo key={"h" + i + "-" + shot} kind={hk} hue={clip.hue + shot * 24} live={active && !paused} />
      <div className="cc-title"><span>{s.ic}</span><b>{s.h}</b></div>
      <div className="cc-flash" key={"f" + i + "-" + shot} />
      <div className={"cc-face" + (active && !paused ? " on" : "")} key={"p" + i + "-" + shot}>
        <img src="./img/presenter.jpg" alt="" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
        <span>TIGA Studio · @tiga.studio</span>
      </div>
      <div className="cc-sticker" key={"s" + i + "-" + shot}>{s.ic}</div>
      <div className="cc-cap" key={i}><p>{wordsOf(s.b, lang).map((w, k) => <span key={k} className={"cc-w" + (k < wi ? " said" : k === wi ? " hot" : "")}>{w}</span>)}</p></div>
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
.cc-wrap.inline{position:absolute;z-index:15}.cc-wrap.inline .cc-bar{top:calc(14px + env(safe-area-inset-top,0px));right:62px}.cc-wrap.inline .cc-title{top:calc(34px + env(safe-area-inset-top,0px))}.cc-wrap.inline .cc-face{top:calc(78px + env(safe-area-inset-top,0px))}.cc-wrap.inline .cc-holo{top:calc(322px + env(safe-area-inset-top,0px))}.cc-wrap.inline .cc-sticker{top:calc(110px + env(safe-area-inset-top,0px))}.cc-wrap.inline .cc-pause{top:calc(58px + env(safe-area-inset-top,0px))}.cc-wrap.inline .cc-pause{top:calc(62px + env(safe-area-inset-top,0px))}.cc-hide{display:none!important}
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
.cc-holo{position:absolute;left:50%;transform:translateX(-50%);top:calc(372px + env(safe-area-inset-top,0px));width:min(88vw,380px);height:auto;aspect-ratio:360/190;border-radius:16px;box-shadow:0 0 30px hsla(var(--h),90%,60%,.35);backdrop-filter:blur(2px)}
.cc-face{position:absolute;left:50%;top:calc(120px + env(safe-area-inset-top,0px));transform:translateX(-50%);width:min(46vw,190px);display:flex;flex-direction:column;align-items:center;gap:6px}
.cc-face img{width:100%;aspect-ratio:540/640;object-fit:cover;border-radius:26px;border:2px solid rgba(255,255,255,.7);box-shadow:0 0 28px hsla(var(--h),90%,60%,.55),0 10px 40px rgba(0,0,0,.6);-webkit-mask-image:linear-gradient(180deg,#000 82%,transparent 100%);mask-image:linear-gradient(180deg,#000 82%,transparent 100%)}
.cc-face.on img{animation:ccsway 2.4s ease-in-out infinite}.cc-face span{position:absolute;bottom:-16px;font-size:11px;font-weight:700;opacity:.85;letter-spacing:.3px;text-shadow:0 1px 6px #000}
@keyframes ccsway{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.012)}}
.cc-cap{position:absolute;left:16px;right:16px;bottom:calc(26px + env(safe-area-inset-bottom,0px));text-align:center;animation:ccin .5s ease}
.cc-cap p{font-size:20px;font-weight:800;line-height:1.45;margin:0;font-weight:600;text-shadow:0 2px 10px rgba(0,0,0,.95)}
.cc-flash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.85),hsla(var(--h),100%,70%,.35) 40%,transparent 70%);opacity:0;animation:ccflash .38s ease-out}@keyframes ccflash{0%{opacity:.9}100%{opacity:0}}
.cc-face{animation:ccpunch .45s cubic-bezier(.2,1.5,.4,1)}@keyframes ccpunch{0%{transform:translateX(-50%) scale(1.14) rotate(-1.5deg)}100%{transform:translateX(-50%) scale(1) rotate(0)}}
.cc-sticker{position:absolute;right:10%;top:calc(150px + env(safe-area-inset-top,0px));font-size:44px;filter:drop-shadow(0 0 12px hsl(var(--h) 100% 65%));animation:ccsticker .7s cubic-bezier(.2,1.6,.4,1)}@keyframes ccsticker{0%{transform:scale(0) rotate(-40deg);opacity:0}100%{transform:scale(1) rotate(8deg);opacity:1}}
.cc-w{display:inline-block;margin:0 .14em;opacity:.35;transition:opacity .12s,transform .12s,color .12s}.cc-w.said{opacity:1}.cc-w.hot{opacity:1;color:hsl(calc(var(--h) + 60) 100% 70%);transform:scale(1.18);text-shadow:0 0 14px hsl(var(--h) 100% 60%),0 2px 10px #000}
.cc-hint{position:absolute;left:50%;bottom:calc(4px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);font-size:20px;opacity:.7;animation:ccbob 1.4s ease-in-out infinite;pointer-events:none}
@keyframes ccbob{50%{transform:translate(-50%,5px)}}
@keyframes ccin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.cc-reel[data-cam] .cc-bg{animation-duration:1.7s;animation-timing-function:ease-out;animation-fill-mode:both}
.cc-reel[data-cam="0"] .cc-bg{animation-name:cccam0}.cc-reel[data-cam="1"] .cc-bg{animation-name:cccam1}.cc-reel[data-cam="2"] .cc-bg{animation-name:cccam2}.cc-reel[data-cam="3"] .cc-bg{animation-name:cccam3}.cc-reel[data-cam="4"] .cc-bg{animation-name:cccam4}
@keyframes cccam0{from{transform:scale(1.0)}to{transform:scale(1.45)}}@keyframes cccam1{from{transform:scale(1.25) translateX(-3%)}to{transform:scale(1.08) translateX(3%)}}@keyframes cccam2{from{transform:scale(1.1) rotate(-1.6deg)}to{transform:scale(1.2) rotate(1.4deg)}}@keyframes cccam3{from{transform:scale(1.55) translateY(6%)}to{transform:scale(1.05) translateY(-4%)}}@keyframes cccam4{from{transform:scale(1.05) rotate(1.8deg)}to{transform:scale(1.28) rotate(-1deg)}}
.cc-holo{animation:ccholoin .5s cubic-bezier(.2,1.4,.4,1)}@keyframes ccholoin{0%{opacity:0;transform:translateX(-50%) scale(.8)}100%{opacity:1;transform:translateX(-50%) scale(1)}}
@media (prefers-reduced-motion:reduce){.cc-bg,.cc-holo,.cc-cap,.cc-face.on img,.cc-bar i.cur,.cc-hint{animation:none}}
.cc-list{position:absolute;inset:0;z-index:20;overflow-y:auto;padding:calc(70px + env(safe-area-inset-top,0px)) 16px 24px;display:flex;flex-direction:column;gap:12px;background:#000}
.cc-card{display:flex;gap:14px;align-items:center;text-align:left;border:0;border-radius:18px;padding:14px 16px;color:#fff;cursor:pointer;background:linear-gradient(135deg,hsl(var(--h) 60% 30%),hsl(calc(var(--h) + 40) 55% 14%))}
.cc-card b{display:block;font-size:17px;margin-bottom:3px}.cc-card span.s{font-size:13px;opacity:.8}.cc-card .e{font-size:40px}
`;
