import { useState, useEffect } from "react";

export const CSS = `
/* ── Light/dark mode variables — light is the CSS baseline (:root) so a first-time visit
   paints light immediately with no flash-of-dark before React mounts and sets the attribute;
   html[data-theme="dark"] is the opt-in override for anyone who picks Dark in Settings.
   Light mode's neutrals (bg/card/text/borders) follow Anthropic's own brand palette —
   #faf9f5 warm cream, #141413 near-black text, #e8e6dc/#b0aea5 warm grays — with this
   app's own pink (#d97757, unchanged, not a variable) staying the one accent color. ── */
:root{
  --bg: #faf9f5;
  --card: #ffffff;
  --card2: #f5f4f0;
  --card3: #efeee6;
  --grad1: #eae8de;
  --text: #141413;
  --text2: #4a463f;
  --muted: #7d7a70;
  --bd1: #14141312;
  --bd2: #14141314;
  --bd3: #14141310;
  --bd4: #1414131f;
  --bd5: #14141322;
  --bd6: #1414130d;
}
html[data-theme="dark"]{
  --bg: #0d0d0c;
  --card: #171615;
  --card2: #1e1c1a;
  --card3: #262320;
  --grad1: #2e2b27;
  --text: #faf9f5;
  --text2: #c9c6bd;
  --muted: #928f86;
  --bd1: #ffffff12;
  --bd2: #ffffff14;
  --bd3: #ffffff10;
  --bd4: #ffffff1f;
  --bd5: #ffffff22;
  --bd6: #ffffff0d;
}
/* index.html has a static (pre-JS-paint) copy of the light --bg value on these same
   three selectors, purely so first paint isn't a flash of white before this stylesheet
   loads — this rule is what actually keeps the root background in sync with the toggle
   afterward (it wins the cascade: this <style> tag is injected, so it's later in the DOM
   than the one already in <head>, and both rules have equal specificity). */
html, body, #root{background:var(--bg)}

@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600&family=Share+Tech+Mono&display=swap');
.tg{font-family:'Rajdhani',sans-serif;background:var(--bg);color:var(--text2);height:100vh;display:flex;flex-direction:column;overflow:hidden;position:relative}
.tg>*{position:relative;z-index:1}
/* keyboard-only focus ring (WCAG 2.4.7) — visible outline without affecting mouse users */
.tg :focus-visible{outline:2px solid #d97757;outline-offset:2px;border-radius:6px}
.tg button:focus-visible,.tg textarea:focus-visible{outline:2px solid #d97757;outline-offset:2px}
.scan{position:fixed;inset:0;pointer-events:none;z-index:9999}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:var(--card);border-bottom:1px solid #d9775733;flex-shrink:0;position:relative;z-index:30}
.logo{display:flex;align-items:center;gap:10px}
/* hamburger + side drawer nav (minimal modern) */
.hamb{display:flex;flex-direction:column;justify-content:center;gap:4px;width:36px;height:36px;border:none;background:transparent;cursor:pointer;padding:7px;border-radius:10px;flex-shrink:0}
.hamb span{display:block;height:2.5px;width:100%;background:#d97757;border-radius:2px}
.hamb:active{background:var(--bd1)}
.drawer-scrim{position:fixed;inset:0;z-index:1450;background:rgba(4,4,12,.62);backdrop-filter:blur(3px);animation:fadein .2s}
.drawer{position:fixed;top:0;left:0;bottom:0;width:82%;max-width:300px;z-index:1460;background:var(--card);border-right:1px solid #d9775733;box-shadow:8px 0 44px -10px #000;transform:translateX(-105%);transition:transform .26s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;padding:18px 14px calc(18px + env(safe-area-inset-bottom,0px));overflow-y:auto}
.drawer.open{transform:translateX(0)}
.drawer-brand{display:flex;align-items:center;gap:10px;padding:4px 8px 16px;border-bottom:1px solid var(--bd1);margin-bottom:12px}
.drawer-brand .lbox{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:11px;background: #d97757;color:#fff;font-family:'Orbitron',sans-serif;font-weight:900;font-size:15px}
.draweritem{display:flex;align-items:center;gap:14px;width:100%;padding:14px;border:none;background:transparent;border-radius:14px;cursor:pointer;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:600;text-align:left;position:relative;margin-bottom:4px}
.draweritem:active{transform:scale(.98)}
.draweritem.on{background:var(--bd1)}
.draweritem.on .drawerlabel{color:#d97757}
.drawericon{font-size:22px;width:28px;text-align:center;color:var(--nav-c,#d97757);flex-shrink:0}
.drawerlabel{flex:1}
.drawerdot{width:8px;height:8px;border-radius:50%;background:var(--nav-c,#d97757);box-shadow:0 0 10px var(--nav-c,#d97757)}
.drawer-foot{margin-top:auto;border-top:1px solid var(--bd1);padding-top:10px}
.draweritem.sub{font-size:14px;color:var(--muted);padding:11px 14px;margin-bottom:0}
.draweritem.sub .drawericon{font-size:18px;color:var(--muted)}
.lbox{width:38px;height:38px;border:1.5px solid #d97757;border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:12px;color:#d97757;font-weight:900}
.lname{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:#d97757;text-shadow:0 0 8px #d97757;letter-spacing:2px}
.lsub{font-size:8px;color:var(--muted);letter-spacing:3px;font-family:'Share Tech Mono',monospace}
.hdr-r{display:flex;align-items:center;gap:8px}
.dot{width:8px;height:8px;border-radius:50%;background:#d97757;box-shadow:0 0 8px #d97757;animation:blink 1.5s infinite}
/* flag dropdown */
.flagwrap{position:relative}
.flagbtn{display:flex;align-items:center;gap:4px;background:none;border:1px solid #d9775744;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:16px;line-height:1;transition:all .2s}
.flagbtn:hover{border-color:#d97757;box-shadow:0 0 8px #d9775744;background:rgba(217,119,87,.08)}
.flagbtn .caret{font-size:8px;color:#d97757;font-family:'Share Tech Mono',monospace}
.flagmenu{position:absolute;top:calc(100% + 6px);right:0;background:#130a10;border:1px solid #d9775755;border-radius:6px;box-shadow:0 4px 20px rgba(217,119,87,.2);overflow:hidden;z-index:50;min-width:120px;animation:dropdown .18s ease-out}
.flagitem{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;font-size:15px;transition:all .15s;border:none;background:none;width:100%;color:var(--text2);font-family:'Rajdhani',sans-serif}
.flagitem .fn{font-size:12px;letter-spacing:.5px}
.flagitem:hover{background:rgba(217,119,87,.1)}
.flagitem.active{background:rgba(148,60,100,.18)}
.flagitem.active .fn{color:#d97757}
/* piano */
.pw{background:var(--card3);border-bottom:1px solid #d9775733;padding:10px 8px 4px;flex-shrink:0}
.plbl{font-family:'Orbitron',sans-serif;font-size:8px;color:var(--muted);letter-spacing:3px;text-align:center;margin-bottom:7px}
.kr{display:flex;justify-content:center;align-items:flex-start;gap:1px;overflow-x:auto;padding:0 4px 20px;scrollbar-width:none}
.kr::-webkit-scrollbar{display:none}
.pk{cursor:pointer;border-radius:0 0 4px 4px;transition:all .08s;flex-shrink:0;position:relative;user-select:none}
.pk.w{background:#fff;border:1px solid #d4cfc5;z-index:1;box-shadow:0 4px 8px rgba(0,0,0,.5)}
.pk.b{background:#060d1a;border:1px solid #001015;margin-left:-9px;margin-right:-9px;z-index:2;box-shadow:0 4px 12px rgba(0,0,0,.9)}
.pk.w.lit{background:#d97757;box-shadow:0 0 16px #d97757,0 0 40px #d9775766}
.pk.b.lit{background:#d97757;box-shadow:0 0 14px #d97757,0 0 30px #d9775766}
.pk.w:active{transform:translateY(2px)}
.pk.b:active{transform:translateY(1px)}
.pk.flash{animation:keypop .32s ease-out}
@keyframes keypop{0%{filter:brightness(1.9) saturate(1.3);box-shadow:0 0 18px 4px #d97757cc,0 0 36px 6px #d9775766}100%{filter:brightness(1)}}
.kn{position:absolute;bottom:3px;left:50%;transform:translateX(-50%);font-size:7px;color:var(--muted);font-family:'Share Tech Mono',monospace;pointer-events:none}
/* finger number badge under keys */
.finger{position:absolute;bottom:-19px;left:50%;transform:translateX(-50%);width:16px;height:16px;border-radius:50%;background:#ff5252;color:#fff;font-size:10px;font-weight:700;font-family:'Orbitron',sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px #ff525299;animation:fingerpop .2s ease-out;z-index:5}
.fingerrow{height:20px;display:flex;justify-content:center;align-items:center;margin-top:2px}
.fingerhint{font-family:'Share Tech Mono',monospace;font-size:8px;color:#ff525299;letter-spacing:1px}
/* piano label row + replay button */
.plblrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding:0 2px}
.plblrow .plbl{margin-bottom:0}
.replaybtn{display:flex;align-items:center;gap:5px;background: rgba(217,119,87,.16);border:1px solid #d9775755;border-radius:14px;padding:4px 12px;cursor:pointer;color:#d97757;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px;transition:all .2s}
.replaybtn:hover{border-color:#d97757;box-shadow:0 0 12px -3px #d97757;background: rgba(217,119,87,.26)}
.replaybtn:active{transform:scale(.93)}
.replayicon{font-size:13px;font-weight:700;display:inline-block}
.replaybtn:hover .replayicon{animation:spin .6s ease}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
/* broken-vs-block chord voicing toggle — shown whenever the loaded demo is a
   chord (triad/7th/tension/slash/block/pad-chord topics all share this) */
.chordstylerow{display:flex;gap:6px;margin:0 2px 8px;padding:3px;background:var(--card);border:1px solid var(--bd3);border-radius:12px}
.chordstylebtn{flex:1;background:none;border:none;border-radius:9px;padding:7px 6px;cursor:pointer;color:#a88b9b;font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:700;transition:all .2s}
.chordstylebtn.on{background: rgba(217,119,87,.22);color:#d97757;box-shadow:0 0 12px -4px #d97757}
/* hand selector */
/* persistent fingering chart */
.fchart{margin-top:10px;padding:9px 10px;background:var(--card2);border:1px solid var(--bd3);border-radius:11px}
.fchart-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.fchart-title{font-family:'Orbitron',sans-serif;font-size:9px;font-weight:700;color:var(--muted);letter-spacing:1.5px}
.fchart-key{font-family:'Share Tech Mono',monospace;font-size:9px;color:#d97757;letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%}
.fchart-row::-webkit-scrollbar{height:3px}
.fchart-row::-webkit-scrollbar-thumb{background:var(--grad1);border-radius:2px}
.fchart-finger{width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:900;color:#fff;box-shadow:0 0 8px -2px currentColor}
.fchart-note{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);line-height:1}
.handsel{display:flex;gap:10px;margin-top:14px;padding:0 2px}
.handbtn{flex:1;display:flex;align-items:center;justify-content:center;gap:9px;padding:11px 9px;background: rgba(255,255,255,.02);border:1px solid var(--bd1);border-radius:13px;cursor:pointer;color:var(--muted);font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;transition:all .25s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
.handbtn::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity .25s}
.handsvg{width:24px;height:24px;flex-shrink:0;transition:transform .25s,filter .25s;color:var(--muted)}
.handsvg.flip{transform:scaleX(-1)}
.handlbl{position:relative;z-index:1}
.handbtn:hover{color:var(--muted);border-color:#ffffff20}
.handbtn:hover .handsvg{transform:scale(1.12);color:var(--muted)}
.handbtn:hover .handsvg.flip{transform:scaleX(-1) scale(1.12)}
.handbtn.on{color:#d97757;border-color:#d9775777;background: rgba(217,119,87,.1);box-shadow:0 0 22px -8px #d97757,inset 0 0 18px -12px #d97757}
.handbtn.on::before{opacity:.12}
.handbtn.on .handsvg{color:#d97757;filter:drop-shadow(0 0 6px #d97757)}
.handbtn:active{transform:scale(.96)}
/* chat */
.cw{display:flex;flex-direction:column;flex:1;min-height:0}
.chdr{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--card3);border-bottom:1px solid #d9775733;flex-shrink:0}
.ailbl{font-family:'Orbitron',sans-serif;font-size:10px;color:#d97757;letter-spacing:1.5px;display:flex;align-items:center;gap:7px}
.ebtn{background:none;border:1px solid #d9775744;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:10px;color:#d97757;font-family:'Orbitron',sans-serif;letter-spacing:1px;transition:all .2s}
.ebtn:hover{border-color:#d97757;box-shadow:0 0 8px #d9775744;background:rgba(217,119,87,.08)}
.msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.msgs::-webkit-scrollbar{width:3px}
.msgs::-webkit-scrollbar-thumb{background:#d97757;border-radius:2px}
.msg{max-width:88%;animation:fadein .3s ease-out}
.msg.u{align-self:flex-end}
.msg.a{align-self:flex-start}
.bbl{padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.7}
.msg.u .bbl{background: rgba(217,119,87,.15);border:1px solid #d97757;border-radius:8px 2px 8px 8px;color:var(--text2)}
.msg.a .bbl{background:var(--card3);border:1px solid #d9775722;border-radius:2px 8px 8px 8px;color:var(--text2)}
.atag{font-family:'Orbitron',sans-serif;font-size:8px;color:#d97757;letter-spacing:1px;margin-bottom:5px}
.mact{display:flex;gap:6px;margin-top:7px;align-items:center;flex-wrap:wrap}
.spkbtn{display:flex;align-items:center;gap:8px;background: rgba(217,119,87,.09);border:1px solid #d9775755;border-radius:20px;padding:6px 14px 6px 12px;cursor:pointer;font-size:10px;font-family:'Orbitron',sans-serif;letter-spacing:.8px;transition:all .22s;color:#d97757}
.spkbtn:hover{border-color:#d97757;box-shadow:0 0 14px -4px #d97757;background: rgba(217,119,87,.15)}
.spkbtn:active{transform:scale(.95)}
.spkbtn.on{border-color:#ff5252;color:#d97757;box-shadow:0 0 16px -4px #ff5252;background: rgba(255,82,82,.18)}
.spkwave{display:flex;align-items:center;gap:2px;height:14px}
.spkwave span{width:2.5px;height:5px;border-radius:2px;background:currentColor;opacity:.55;transition:opacity .2s}
.spkbtn.on .spkwave span{opacity:1;animation:wave 1s ease-in-out infinite}
.spkbtn.on .spkwave span:nth-child(1){animation-delay:0s}
.spkbtn.on .spkwave span:nth-child(2){animation-delay:.15s}
.spkbtn.on .spkwave span:nth-child(3){animation-delay:.3s}
.spkbtn.on .spkwave span:nth-child(4){animation-delay:.45s}
@keyframes wave{0%,100%{height:4px}50%{height:13px}}
.spktxt{line-height:1}
@keyframes spkpulse{0%,100%{opacity:1}50%{opacity:.5}}
.playbtn{display:flex;align-items:center;gap:5px;background:none;border:1px solid #d9775766;border-radius:4px;padding:4px 11px;cursor:pointer;font-size:10px;font-family:'Orbitron',sans-serif;letter-spacing:.8px;transition:all .2s;color:#d97757}
.playbtn:hover{border-color:#d97757;box-shadow:0 0 8px #d9775744;background:rgba(217,119,87,.08)}
.nlbl{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted)}
.typing{display:flex;gap:5px;align-items:center;padding:10px 14px}
.tdd{width:7px;height:7px;border-radius:50%;background:#d97757;animation:bounce 1.2s infinite}
.tdd:nth-child(2){animation-delay:.2s}.tdd:nth-child(3){animation-delay:.4s}
.iw{padding:10px 12px;background:var(--card3);border-top:1px solid #d9775733;flex-shrink:0}
.ir{display:flex;gap:8px;align-items:flex-end}
.tin{flex:1;background:var(--card3);border:1px solid #d9775733;border-radius:6px;padding:10px 14px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:14px;resize:none;min-height:44px;max-height:110px;outline:none;transition:border-color .2s}
.tin:focus{border-color:#d97757;box-shadow:0 0 0 1px rgba(217,119,87,.15)}
.tin::placeholder{color:var(--muted)}
.snd{width:44px;height:44px;border:none;border-radius:6px;background: #d97757;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all .2s;flex-shrink:0;color:#fff}
.snd:hover{transform:scale(1.06);box-shadow:0 0 18px #d97757}
.snd:disabled{opacity:.35;cursor:not-allowed;transform:none}
.hint{font-size:9px;color:var(--muted);text-align:center;margin-top:5px;font-family:'Share Tech Mono',monospace}
.mov{display:none;position:fixed;inset:0;background:rgba(10,5,9,.97);z-index:1000;flex-direction:column}
.mov.open{display:flex}
.mhdr{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #d9775733;background:var(--card3);flex-shrink:0}
.mlbl{font-family:'Orbitron',sans-serif;font-size:10px;color:#d97757;letter-spacing:1.5px;display:flex;align-items:center;gap:7px}
.cbtn{background:none;border:1px solid #ff5252;border-radius:4px;padding:5px 14px;cursor:pointer;color:#ff5252;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;transition:all .2s}
.cbtn:hover{background:rgba(255,82,82,.1);box-shadow:0 0 10px #ff5252}
.mpw{padding:8px 8px 14px;background:var(--card3);border-bottom:1px solid #d9775733;flex-shrink:0}
.mmsgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.mmsgs::-webkit-scrollbar{width:3px}
.mmsgs::-webkit-scrollbar-thumb{background:#d97757;border-radius:2px}
.miw{padding:10px 12px;background:var(--card3);border-top:1px solid #d9775733;flex-shrink:0}
@keyframes pulse{0%,100%{box-shadow:0 0 10px #d97757,0 0 25px #d9775744}50%{box-shadow:0 0 20px #d97757,0 0 50px #d9775766}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
@keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes dropdown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@keyframes fingerpop{from{opacity:0;transform:translateX(-50%) scale(.4)}to{opacity:1;transform:translateX(-50%) scale(1)}}
@keyframes flicker{0%,94%,97%,100%{opacity:1}95%,98%{opacity:.5}}
.flicker{animation:flicker 6s infinite}
/* ── nav bar ── */
.navbar{display:flex;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));background:var(--card2);border-top:1px solid #d9775722;flex-shrink:0;position:relative}
.navbar::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background: #d9775766}
.navbtn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 8px;background:rgba(255,255,255,.02);border:1px solid var(--bd6);border-radius:12px;cursor:pointer;color:var(--muted);font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;transition:all .25s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
.navbtn .nicon{font-size:16px;line-height:1;transition:transform .25s}
.navbtn .nlabel{position:relative;z-index:1}
.navbtn::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity .25s}
.navbtn:hover{color:var(--muted);border-color:#ffffff1a}
.navbtn:hover .nicon{transform:scale(1.12)}
.navbtn.on{color:#d97757;border-color:var(--nav-c,#d97757);background:rgba(217,119,87,.06);box-shadow:0 0 18px -6px var(--nav-c,#d97757),inset 0 0 16px -10px var(--nav-c,#d97757)}
.navbtn.on::before{opacity:1}
.navbtn.on .nicon{transform:scale(1.1);filter:drop-shadow(0 0 5px var(--nav-c,#d97757))}
.navbtn:active{transform:scale(.95)}
/* ── vertical video lessons feed (TikTok-style, one video per screen) ── */
.vidfeed{flex:1;overflow-y:auto;scroll-snap-type:y mandatory;background:#000;scrollbar-width:none}
.vidfeed::-webkit-scrollbar{display:none}
.vidslide{height:100%;scroll-snap-align:start;scroll-snap-stop:always;position:relative;display:flex;align-items:center;justify-content:center;background:#000}
.vidplayer{width:100%;height:100%;object-fit:cover;background:#000;border:none}
@media (min-aspect-ratio:3/4){video.vidplayer{object-fit:contain}}
.vidplaceholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;opacity:.25}
.vidmute{position:absolute;right:12px;top:14px;z-index:6;background:rgba(18,8,14,.55);border:1px solid #ffffff2a;border-radius:50%;width:42px;height:42px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}
.vidpause{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:64px;color:#ffffffd6;pointer-events:none;text-shadow:0 2px 18px #000}
.vidbar{position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--bd5);z-index:7}
.vidbar span{display:block;height:100%;width:0;background: #d97757}
/* ── TikTok chrome: top fade, right action rail (like / ask / save), floating hearts ── */
.vidtopfade{position:absolute;top:0;left:0;right:0;height:64px;background:linear-gradient(rgba(0,0,0,.42),transparent);pointer-events:none;z-index:3}
/* the app header hides on the video feed — this translucent ☰ keeps navigation reachable */
.vidfab{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:10px;z-index:60;width:42px;height:42px;border-radius:50%;background:rgba(18,8,14,.55);border:1px solid #ffffff2a;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;cursor:pointer;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(4px)}
.vidfab span{display:block;width:17px;height:2px;background:#fff;border-radius:2px}
.vidfab:active{transform:scale(.92)}
.vidrail{position:absolute;right:6px;bottom:92px;display:flex;flex-direction:column;align-items:center;gap:15px;z-index:8}
.vidact{background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}
.vidact-ic{font-size:29px;filter:grayscale(1) brightness(1.9);text-shadow:0 1px 6px rgba(0,0,0,.55);transition:transform .12s;line-height:1}
.vidact:active .vidact-ic{transform:scale(.85)}
.vidact.on .vidact-ic,.vidact.fav .vidact-ic{filter:none;animation:heartpop .32s ease-out}
.vidact-n{font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:700;color:#fff;text-shadow:0 1px 4px #000;min-height:13px}
@keyframes heartpop{0%{transform:scale(.55)}55%{transform:scale(1.35)}100%{transform:scale(1)}}
.vidheart{position:absolute;font-size:74px;pointer-events:none;z-index:9;animation:heartfloat .82s ease-out forwards}
@keyframes heartfloat{0%{opacity:0;transform:scale(.4)}18%{opacity:1;transform:scale(1.15)}100%{opacity:0;transform:translateY(-110px) scale(1.35)}}
/* ── pathway page (hero + grid) ── */
.pathpage{flex:1;overflow-y:auto;padding:0 0 24px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.pathpage::-webkit-scrollbar{width:4px}
.pathpage::-webkit-scrollbar-thumb{background:#d97757;border-radius:2px}
.pathhero{position:relative;text-align:center;padding:22px 16px 20px;margin-bottom:8px;overflow:hidden;border-bottom:1px solid #d977571f}
.pathhero-glow{position:absolute;top:-60%;left:50%;transform:translateX(-50%);width:280px;height:280px;pointer-events:none}
.pathbadge{position:relative;display:inline-block;font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:3px;color:#d97757;border:1px solid #d9775744;border-radius:20px;padding:4px 15px;margin-bottom:12px;background:rgba(217,119,87,.05)}
.pathh1{position:relative;font-family:'Orbitron',sans-serif;font-size:19px;font-weight:900;color:var(--text);text-shadow:0 0 16px #d9775777;letter-spacing:1px;margin-bottom:13px}
.pathguide{position:relative;font-size:12px;color:var(--text2);line-height:1.65;background: rgba(217,119,87,.07);border:1px solid #d9775722;border-radius:10px;padding:11px 14px;font-family:'Rajdhani',sans-serif;max-width:430px;margin:0 auto}
.pgroup{padding:0 14px;margin-bottom:22px}
.pgrouphdr{display:flex;align-items:center;gap:11px;margin-bottom:13px}
.pgbar{width:4px;height:34px;border-radius:3px;flex-shrink:0;box-shadow:0 0 10px currentColor}
.pgicon{font-size:21px;line-height:1;flex-shrink:0}
.pginfo{flex:1;min-width:0}
.pglabel{font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:var(--text);letter-spacing:2px;line-height:1.2}
.pgdesc{font-size:11px;color:var(--muted);font-family:'Rajdhani',sans-serif;margin-top:2px}
.pgstep{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:1px;flex-shrink:0}
.pgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
/* ── v12 value pages (Today / Ear gym / Reading / Insights / Report) ── */
.v12hero{text-align:center;padding:16px 12px 12px}
.v12title{font-family:'Orbitron',sans-serif;font-size:20px;font-weight:900;color:var(--text);letter-spacing:1px}
.v12sub{font-size:12.5px;color:var(--muted);font-family:'Rajdhani',sans-serif;margin-top:5px;line-height:1.5}
.v12card{background:var(--card2);border:1px solid var(--bd1);border-radius:14px;padding:14px 13px;margin:0 0 10px}
.tdstep{display:flex;align-items:center;gap:12px;padding:13px 12px;border-radius:13px;background:var(--card2);border:1px solid var(--bd2);margin-bottom:9px}
.tdstep.done{border-color:#d9775766;background:var(--card3)}
.tdico{font-size:22px;flex-shrink:0}
.tdtag{font-size:9.5px;color:var(--muted);font-family:'Share Tech Mono',monospace;letter-spacing:.6px}
.tdlbl{font-size:14px;color:var(--text);font-family:'Rajdhani',sans-serif;font-weight:700;line-height:1.3}
.tdgo{flex-shrink:0;padding:9px 16px;border-radius:10px;border:1px solid #d9775766;background:rgba(217,119,87,.1);color:#d97757;font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;cursor:pointer}
.tdgo.done{border-color:#d97757;color:#d97757;background:rgba(217,119,87,.08);cursor:default}
.tdbar{height:10px;border-radius:6px;background:var(--card);overflow:hidden;border:1px solid var(--bd1)}
.tdfill{height:100%;background: #d97757;transition:width .4s}
.egopt{padding:12px 8px;border-radius:12px;border:1px solid var(--grad1);background:var(--card2);color:var(--text);font-family:'Rajdhani',sans-serif;font-size:13.5px;font-weight:700;cursor:pointer;text-align:center;line-height:1.25}
.egopt.ok{border-color:#d97757;color:#d97757;background:rgba(217,119,87,.1)}
.egopt.bad{border-color:#ff5252;color:#ff5252;background:rgba(255,82,82,.08)}
.insbarwrap{display:flex;align-items:flex-end;gap:4px;height:90px;padding:4px 2px 0}
.insbar{flex:1;background: #d97757;border-radius:4px 4px 0 0;min-height:2px}
.instile{flex:1;background:var(--card2);border:1px solid var(--bd1);border-radius:12px;padding:11px 6px;text-align:center;min-width:0}
.instile b{display:block;font-family:'Orbitron',sans-serif;font-size:16px;color:#d97757;margin-bottom:3px}
.instile span{font-size:9.5px;color:var(--muted);font-family:'Rajdhani',sans-serif;font-weight:600;line-height:1.2;display:block}
.certrow{display:flex;align-items:center;gap:11px;padding:12px;border-radius:13px;border:1px solid var(--bd2);background:var(--card2);margin-bottom:9px}
.certrow.earned{border-color:#d9775766;background:var(--card3)}
.pcard{position:relative;display:flex;flex-direction:column;text-align:left;background:var(--card2);border:1px solid var(--bd1);border-top:2px solid var(--ac);border-radius:13px;padding:13px;cursor:pointer;transition:transform .2s,box-shadow .2s,border-color .2s;overflow:hidden;font-family:'Rajdhani',sans-serif;color:var(--text2);min-height:152px;width:100%}
.pcardglow{position:absolute;top:-30px;right:-30px;width:90px;height:90px;border-radius:50%;pointer-events:none}
.pcard.done{border-color:#d9775755}
.pcarddone{position:absolute;top:9px;right:9px;width:22px;height:22px;border-radius:50%;background:#d97757;color:var(--card2);font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px -2px #d97757;z-index:3}
.pcard.current{box-shadow:0 0 0 1px var(--ac),0 0 22px -6px var(--ac);animation:currentpulse 1.8s ease-in-out infinite}
@keyframes currentpulse{0%,100%{box-shadow:0 0 0 1px var(--ac),0 0 18px -8px var(--ac)}50%{box-shadow:0 0 0 1px var(--ac),0 0 26px -2px var(--ac)}}
.pcardhere{position:absolute;top:9px;right:9px;font-family:'Orbitron',sans-serif;font-size:8px;font-weight:800;letter-spacing:.5px;color:var(--card2);background:var(--ac);border-radius:6px;padding:3px 6px;z-index:3;animation:flamepulse 1s ease-in-out infinite alternate}
.pcard:hover{border-color:var(--ac);transform:translateY(-3px);box-shadow:0 10px 26px -10px var(--ac)}
.pcard:hover .pcardglow{opacity:.22}
.pcard:active{transform:translateY(-1px) scale(.98)}
.pcardlevel{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:900;letter-spacing:1px;color:var(--ac);opacity:.95;margin-bottom:7px}
.pcardicon{font-size:30px;line-height:1;margin-bottom:9px}
.pcardtitle{font-family:'Orbitron',sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.2px;color:var(--text);margin-bottom:4px;line-height:1.3}
.pcardsub{font-size:10.5px;color:var(--muted);line-height:1.4;flex:1;margin-bottom:10px}
.pcardkeys{display:inline-block;align-self:flex-start;font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:700;color:#d97757;background:rgba(217,119,87,.12);border:1px solid #d9775744;border-radius:7px;padding:2px 7px;margin-bottom:8px}
.pcardgo{display:flex;align-items:center;justify-content:space-between;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px;color:var(--ac);border-top:1px solid var(--bd3);padding-top:9px}
.pcardarrow{font-size:14px;transition:transform .2s}
.pcard:hover .pcardarrow{transform:translateX(4px)}
.pathfoot{text-align:center;font-size:10px;color:var(--muted);font-family:'Share Tech Mono',monospace;letter-spacing:1px;margin:10px 14px 0;padding-top:14px;line-height:1.6;border-top:1px solid #d977571a}
/* ── inline key picker panel (spans full grid row) ── */
.pcard.active{border-color:var(--ac);box-shadow:0 0 24px -8px var(--ac);transform:translateY(-2px)}
.keypanel{background:var(--card2);border:1px solid var(--ac,#d97757);border-radius:14px;padding:14px 13px;margin-top:10px;position:relative;overflow:hidden;animation:keyexpand .3s cubic-bezier(.2,.9,.3,1)}
.keypanel::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background: var(--ac);opacity:.6}
@keyframes keyexpand{from{opacity:0;transform:translateY(-8px) scaleY(.9)}to{opacity:1;transform:translateY(0) scaleY(1)}}
.keypanel-head{display:flex;align-items:center;gap:9px;margin-bottom:13px;padding-bottom:10px;border-bottom:1px solid var(--bd3)}
.keypanel-icon{font-size:18px;line-height:1}
.keypanel-title{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:#fff;letter-spacing:.3px;flex:1;min-width:0}
.keypanel-tag{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--ac,#d97757);letter-spacing:1px;white-space:nowrap}
.keygrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.keybtn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:11px 5px;background:var(--card2);border:1px solid var(--grad1);border-radius:10px;cursor:pointer;transition:all .18s;position:relative;overflow:hidden}
.keybtn::after{content:'';position:absolute;inset:0;background:var(--ac,#d97757);opacity:0;transition:opacity .18s}
.keybtn.black{background:var(--card3);border-color:var(--bd4)}
.keybtn-name{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:900;color:var(--text2);line-height:1;position:relative;z-index:1}
.keybtn.black .keybtn-name{color:#d97757}
.keybtn-sub{font-size:8.5px;font-family:'Rajdhani',sans-serif;font-weight:600;color:var(--muted);line-height:1;position:relative;z-index:1}
.keybtn:hover{transform:translateY(-3px);border-color:var(--ac,#d97757);box-shadow:0 8px 18px -8px var(--ac,#d97757)}
.keybtn:hover::after{opacity:.1}
.keybtn:active{transform:translateY(-1px) scale(.95)}
.keypanel-foot{text-align:center;font-size:9.5px;color:var(--muted);font-family:'Share Tech Mono',monospace;letter-spacing:.5px;line-height:1.5}
/* ── admin page ── */
.adminpage{flex:1;display:flex;flex-direction:column;min-height:0;background:var(--bg)}
.adminbar{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;background:var(--card2);border-bottom:1px solid #ff525244;flex-shrink:0;box-shadow:0 2px 16px rgba(255,82,82,.12)}
.adminbar-l{display:flex;align-items:center;gap:11px}
.adminorb{width:34px;height:34px;border-radius:9px;background: #ff5252;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 14px #ff525266;animation:pulse 2.5s infinite}
.adminmeta{min-width:0}
.admintitle{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:900;color:#d97757;letter-spacing:2px;text-shadow:0 0 10px #ff525266}
.adminsub{font-size:10px;color:var(--muted);font-family:'Rajdhani',sans-serif;margin-top:1px}
.adminexit{background:none;border:1px solid #ff525255;border-radius:6px;padding:6px 13px;cursor:pointer;color:#d97757;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px;transition:all .2s}
.adminexit:hover{background:rgba(255,82,82,.14);box-shadow:0 0 10px #ff525255}
.adminbbl{border-color:#ff525233!important;background:var(--card3)!important}
.adminatag{color:#d97757!important}
.admintabs{display:flex;gap:8px;padding:10px 14px 4px;flex-shrink:0}
.admintab{flex:1;padding:9px 10px;border-radius:10px;background:var(--card3);border:1px solid #ff525233;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer}
.admintab.on{background: #ff5252;color:#fff;border-color:transparent}
.admstu{flex:1;min-height:0;overflow-y:auto;padding:10px 14px 28px}
.admstu-msg,.admstu-empty{color:var(--muted);text-align:center;padding:24px 8px;font-size:14px}
.admstu-err{color:#ff5252;background:rgba(255,82,82,.08);border:1px solid #ff525233;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:12.5px}
.admstu-top{display:flex;gap:8px;margin-bottom:8px}
.admstu-search{flex:1;background:var(--card3);border:1px solid #ff525233;border-radius:10px;padding:10px 12px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:14px}
.admstu-refresh{width:42px;border-radius:10px;background:var(--card3);border:1px solid #ff525233;color:#d97757;font-size:16px;cursor:pointer}
.admstu-count{color:var(--muted);font-size:12px;margin:2px 2px 8px;font-family:'Orbitron',sans-serif;letter-spacing:1px}
.admstu-list{display:flex;flex-direction:column;gap:8px}
.admstu-row{display:flex;align-items:center;gap:11px;text-align:left;background:var(--card3);border:1px solid var(--bd1);border-radius:13px;padding:11px 13px;cursor:pointer}
.admstu-row:hover{border-color:#ff525255}
.admstu-av{width:42px;height:42px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-weight:700;font-size:18px;color:#fff;background: #ff5252}
.admstu-av.sm{width:38px;height:38px;font-size:16px}
.admstu-row-body{flex:1;min-width:0}
.admstu-row-nm{color:var(--text2);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admstu-row-meta{color:var(--muted);font-size:12px;margin-top:2px}
.admstu-row-sub{color:#7c6675;font-size:11px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admstu-row-go{color:#d97757;font-size:20px;flex-shrink:0}
.admstu-badge{display:inline-block;background:#ff5252;color:#fff;font-size:9px;font-family:'Orbitron',sans-serif;padding:2px 6px;border-radius:6px;vertical-align:middle;margin-left:6px}
.admstu-back{background:none;border:none;color:#d97757;font-family:'Orbitron',sans-serif;font-size:12px;cursor:pointer;padding:4px 0;margin-bottom:8px}
.admstu-head{display:flex;align-items:center;gap:13px;margin-bottom:14px}
.admstu-nm{color:var(--text2);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:18px}
.admstu-em{color:var(--muted);font-size:12.5px}
.admstu-lv{color:var(--muted);font-size:11.5px;margin-top:2px}
.admstu-sec{color:#d97757;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;margin:16px 0 8px}
.admstu-bars{display:flex;align-items:flex-end;gap:5px;height:88px;padding:4px 2px;background:var(--card3);border-radius:12px}
.admstu-bar{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px}
.admstu-bar-fill{width:100%;border-radius:4px 4px 0 0;min-height:4px}
.admstu-bar-lbl{font-size:9px;color:var(--muted);font-family:'Share Tech Mono',monospace}
.admmg{background:var(--card3);border:1px solid #ff525233;border-radius:13px;padding:13px;margin-bottom:14px}
.admmg-h{font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:1px;color:#d97757;margin-bottom:6px}
.admmg-cur{color:var(--muted);font-size:12.5px;margin-bottom:9px}
.admmg-row{display:flex;align-items:center;gap:8px}
.admmg-sel{flex:1;background:var(--card3);border:1px solid var(--bd4);border-radius:9px;padding:9px 10px;color:var(--text2);font-size:14px}
.admmg-days{width:64px;background:var(--card3);border:1px solid var(--bd4);border-radius:9px;padding:9px;color:var(--text2);font-size:14px;text-align:center}
.admmg-d{color:var(--muted);font-size:13px}
.admmg-row2{display:flex;gap:8px;margin-top:8px}
.admmg-row2 .songbtn{flex:1;padding:10px}
.banscreen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;gap:12px}
.adminchips{display:flex;flex-wrap:wrap;gap:7px;padding:10px 14px 4px;flex-shrink:0}
.adminchip{background:rgba(255,82,82,.08);border:1px solid #ff525233;border-radius:16px;padding:7px 13px;cursor:pointer;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:600;transition:all .2s;text-align:left}
.adminchip:hover{border-color:#ff5252;background:rgba(255,82,82,.16);box-shadow:0 0 10px #ff525233;transform:translateY(-1px)}
.adminchip:active{transform:translateY(0) scale(.97)}
.adminmiw{background:#140a16;border-top:1px solid #ff525233}
.admintools{display:flex;gap:8px;padding:8px 14px 0;flex-shrink:0}
.webtoggle{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.03);border:1px solid var(--bd2);border-radius:18px;padding:7px 14px;cursor:pointer;color:#9a7a8b;font-family:'Orbitron',sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;transition:all .22s}
.webtoggle .webdot{width:7px;height:7px;border-radius:50%;background:#445;transition:all .22s}
.webtoggle:hover{border-color:var(--bd5);color:var(--muted)}
.webtoggle.on{color:#d97757;border-color:#d9775766;background:rgba(217,119,87,.08);box-shadow:0 0 12px -4px #d97757}
.webtoggle.on .webdot{background:#d97757;box-shadow:0 0 8px #d97757;animation:blink 1.2s infinite}
.attachbtn{width:44px;height:44px;border:1px solid #ff525244;border-radius:12px;background: rgba(255,82,82,.12);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;color:#d97757;flex-shrink:0;transition:all .22s;font-weight:300}
.attachbtn:hover{border-color:#ff5252;background:rgba(255,82,82,.14);box-shadow:0 0 10px -3px #ff5252}
.attachbtn:active{transform:scale(.93)}
.adminpreview{display:flex;align-items:center;gap:10px;margin:8px 14px 0;padding:8px 10px;background:rgba(255,82,82,.06);border:1px solid #ff525233;border-radius:10px;flex-shrink:0}
.adminpreview img{width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid #ff525255}
.adminpreviewname{flex:1;font-size:11px;color:var(--text);font-family:'Share Tech Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.adminpreviewx{width:26px;height:26px;border-radius:50%;border:1px solid #ff525255;background:none;color:#d97757;cursor:pointer;font-size:11px;flex-shrink:0;transition:all .2s}
.adminpreviewx:hover{background:rgba(255,82,82,.2)}
.adminimg{max-width:100%;border-radius:8px;margin-bottom:8px;border:1px solid #ffffff1a;display:block}
/* ── lock screen ── */
.lockwrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 20px;gap:16px}
.lockicon{font-size:46px;filter:drop-shadow(0 0 14px #ff525288);animation:pulse 2.5s infinite}
.locktitle{font-family:'Orbitron',sans-serif;font-size:14px;color:#ff5252;letter-spacing:2px;text-shadow:0 0 10px #ff525266}
.locksub{font-size:11px;color:var(--muted);font-family:'Share Tech Mono',monospace;text-align:center;line-height:1.6;max-width:280px}
.lockinput{background:var(--card3);border:1px solid #ff525255;border-radius:8px;padding:12px 16px;color:var(--text);font-family:'Share Tech Mono',monospace;font-size:15px;text-align:center;letter-spacing:3px;outline:none;width:200px;transition:all .2s}
.lockinput:focus{border-color:#ff5252;box-shadow:0 0 14px #ff525244}
.lockbtn{background: #ff5252;border:none;border-radius:8px;padding:11px 28px;cursor:pointer;color:#fff;font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:2px;transition:all .2s}
.lockbtn:active{transform:scale(.95)}
.lockerr{color:#ff5252;font-size:11px;font-family:'Share Tech Mono',monospace;min-height:14px;animation:shake .3s}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
/* ── membership / login ── */
.loginhero{display:flex;flex-direction:column;align-items:center;gap:8px;padding:26px 22px 2px;text-align:center;flex-shrink:0}
.loginpiano{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:6px 0}
.loginpiano-hint{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);letter-spacing:1px;text-align:center;min-height:14px}
.memberwrap{display:flex;flex-direction:column;align-items:center;gap:13px;padding:30px 22px;width:100%;max-width:340px;text-align:center}
.loginwrap{flex-shrink:0;margin:0 auto;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))}
.oauthbtn{display:flex;align-items:center;justify-content:center;gap:11px;width:100%;padding:13px 16px;border-radius:12px;border:none;cursor:pointer;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:600;transition:all .2s}
.oauthbtn:active{transform:scale(.97)}
.oauthbtn .oauthico{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-family:'Orbitron',sans-serif;font-weight:900;font-size:13px}
.oauthbtn.google{background:#fff;color:#222}.oauthbtn.google .oauthico{background:#fff;color:#4285F4;border:1px solid #ddd}
.oauthbtn.google:hover{box-shadow:0 0 16px -4px #ffffff99}
.oauthbtn.facebook{background:#1877F2;color:#fff}.oauthbtn.facebook .oauthico{background:#fff;color:#1877F2}
.oauthbtn.facebook:hover{box-shadow:0 0 16px -4px #1877F2}
.memberfoot{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:2px;margin-top:6px}
.memberinput{width:100%;background:var(--card3);border:1px solid #d9775744;border-radius:10px;padding:12px 14px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:14px;outline:none;transition:border-color .2s;box-sizing:border-box}
.memberinput:focus{border-color:#d97757;box-shadow:0 0 0 1px rgba(217,119,87,.15)}
.memberinput::placeholder{color:var(--muted)}
.memberlink{background:none;border:none;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:12px;cursor:pointer;text-decoration:underline;margin-top:2px}
.memberlink:hover{color:#d97757}
.logoutbtn{background:none;border:1px solid #ff525244;border-radius:6px;width:30px;height:28px;cursor:pointer;color:#d97757;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.logoutbtn:hover{background:rgba(255,82,82,.12);box-shadow:0 0 8px -2px #ff5252}
/* ── profile / gamification page ── */
.profpage{flex:1;overflow-y:auto;padding:0 0 24px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.profscroll{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.profscroll .profpage{flex:none;overflow:visible}
.profdash{padding-top:10px}
.profpage::-webkit-scrollbar{width:4px}
.profpage::-webkit-scrollbar-thumb{background:#d97757;border-radius:2px}
.profhero{position:relative;text-align:center;padding:26px 16px 22px;overflow:hidden;border-bottom:1px solid #d977571f}
.profhero-glow{position:absolute;top:-70%;left:50%;transform:translateX(-50%);width:300px;height:300px;pointer-events:none}
/* the ring and purchased frame both extend beyond the avatar's own edge, so they
   have to sit outside .profava's overflow:hidden (needed to clip the photo into
   a circle) — .profava-wrap is the unclipped positioning context for both. */
.profava-wrap{position:relative;width:92px;height:92px;margin:0 auto 13px}
.profava{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:31px;font-weight:900;color:#fff;background: #d97757;box-shadow:0 0 28px -4px var(--lv-c,#d97757);overflow:hidden}
.profava img{width:100%;height:100%;object-fit:cover}
.profava-ring{position:absolute;inset:-5px;border-radius:50%;border:2px solid var(--lv-c,#d97757);opacity:.55}
.profava-frame{position:absolute;inset:-10px;border-radius:50%;pointer-events:none}
body[data-frame="fr-bronze"] .profava-frame{border:3px solid #cd7f32;box-shadow:0 0 10px -2px #cd7f32}
body[data-frame="fr-silver"] .profava-frame{border:3px solid #d7d7de;box-shadow:0 0 14px -2px #d7d7de}
body[data-frame="fr-gold"] .profava-frame{border:3px solid #ffd23f;box-shadow:0 0 18px -2px #ffd23f,0 0 30px -8px #ffd23f}
body[data-frame="fr-diamond"] .profava-frame{border:3px solid #8ad4ff;box-shadow:0 0 20px -2px #8ad4ff,0 0 34px -6px #a855f7;animation:diamondshine 2.4s ease-in-out infinite}
@keyframes diamondshine{0%,100%{box-shadow:0 0 20px -2px #8ad4ff,0 0 34px -6px #a855f7}50%{box-shadow:0 0 26px -2px #a855f7,0 0 40px -6px #8ad4ff}}
.profname{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:700;color:var(--text);text-shadow:0 0 12px #d9775766;margin-bottom:8px}
.profrankbadge{display:inline-flex;align-items:center;gap:7px;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;color:var(--lv-c,#d97757);border:1px solid var(--lv-c,#d97757);border-radius:20px;padding:5px 14px;background:rgba(217,119,87,.06)}
.expwrap{max-width:430px;margin:18px auto 0;padding:0 6px}
.exprow{display:flex;justify-content:space-between;align-items:baseline;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);margin-bottom:6px}
.expnum{color:var(--lv-c,#d97757);font-weight:700;font-size:12px}
.expbar{height:14px;border-radius:8px;background:var(--card3);border:1px solid var(--bd2);overflow:hidden;position:relative}
.expfill{height:100%;border-radius:8px;background: #d97757;box-shadow:0 0 12px -2px #d97757;transition:width .9s cubic-bezier(.2,.9,.3,1)}
.expnext{text-align:center;font-family:'Share Tech Mono',monospace;font-size:9.5px;color:var(--muted);margin-top:8px;letter-spacing:.5px}
.profstats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:18px 14px 4px;max-width:460px;margin:0 auto}
.statcard{background:var(--card2);border:1px solid var(--bd1);border-radius:13px;padding:15px 6px;text-align:center}
.statval{font-family:'Orbitron',sans-serif;font-size:23px;font-weight:900;color:var(--text);line-height:1}
.statval .em{font-size:15px}
.statlbl{font-size:9.5px;color:var(--muted);font-family:'Share Tech Mono',monospace;letter-spacing:.5px;margin-top:7px}
.profsec{padding:16px 14px 0;max-width:480px;margin:0 auto}
.profsec-h{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:var(--text);letter-spacing:2px;margin-bottom:12px;display:flex;align-items:center;gap:9px}
.profsec-h::before{content:'';width:4px;height:18px;border-radius:3px;background:#d97757;box-shadow:0 0 10px #d97757}
.rankrow{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:11px;margin-bottom:7px;background:var(--card3);border:1px solid var(--bd6);transition:all .2s}
.rankrow.cur{border-color:var(--lv-c,#d97757);background:rgba(217,119,87,.07);box-shadow:0 0 18px -8px var(--lv-c,#d97757)}
.rankrow.done{opacity:.6}
.rankrow.locked{opacity:.42}
.rankicon{font-size:20px;width:30px;text-align:center;flex-shrink:0}
.rankmeta{flex:1;min-width:0}
.rankname{font-family:'Orbitron',sans-serif;font-size:11.5px;font-weight:700;color:var(--text2)}
.rankexp{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);margin-top:2px}
.ranktick{font-size:14px;flex-shrink:0;color:var(--lv-c,#d97757)}
.contactcard{background:var(--card2);border:1px solid var(--bd1);border-radius:13px;padding:4px 14px}
.contactrow{display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid #ffffff0a;font-size:13px}
.contactrow:last-child{border-bottom:none}
.contactico{font-size:15px;width:22px;text-align:center;flex-shrink:0}
.contactval{color:var(--text2);font-family:'Rajdhani',sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.contactval.empty{color:var(--muted)}
.profsignout{display:block;width:calc(100% - 28px);max-width:452px;margin:20px auto 0;padding:13px;border-radius:12px;border:1px solid #ff525244;background:rgba(255,82,82,.08);color:#d97757;font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:2px;cursor:pointer;transition:all .2s}
.profsignout:hover{background:rgba(255,82,82,.16);box-shadow:0 0 14px -4px #ff5252}
.profsignout:active{transform:scale(.98)}
/* exp toast */
.exptoast{position:fixed;top:64px;left:50%;z-index:1200;display:flex;align-items:center;gap:8px;background: #d97757;color:#04121a;font-family:'Orbitron',sans-serif;font-size:14px;font-weight:900;letter-spacing:1px;padding:9px 18px;border-radius:22px;box-shadow:0 8px 26px -6px #d97757,inset 0 0 0 1px var(--bd5);animation:exppop 2.2s ease-out forwards;pointer-events:none}
/* one-time "add to home screen" banner, shown after the first real win */
.installbanner{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:1300;display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid #d9775755;border-radius:16px;padding:11px 12px;box-shadow:0 10px 30px -8px #000,0 0 20px -8px #d9775766;animation:installin .3s ease-out}
@keyframes installin{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
.installbanner-ic{font-size:26px;flex-shrink:0}
.installbanner-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.installbanner-tx b{font-size:13px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-weight:700;line-height:1.25}
.installbanner-tx span{font-size:11px;color:var(--muted);line-height:1.2}
.installbanner-go{flex-shrink:0;background: #d97757;color:#fff;border:none;border-radius:11px;padding:9px 14px;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;cursor:pointer;white-space:nowrap}
.installbanner-x{flex-shrink:0;background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:4px 2px}
@keyframes exppop{0%{opacity:0;transform:translateX(-50%) translateY(-14px) scale(.7)}14%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.06)}26%{transform:translateX(-50%) translateY(0) scale(1)}78%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-10px) scale(.96)}}
/* level-up overlay */
.lvup{position:fixed;inset:0;z-index:1300;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,5,9,.82);backdrop-filter:blur(4px);animation:fadein .3s;pointer-events:none}
.lvup-burst{font-size:74px;animation:lvbounce .7s cubic-bezier(.2,1.4,.4,1);position:relative;z-index:2}
.lvup-rays{position:absolute;width:480px;height:480px;background:conic-gradient(from 0deg,var(--bd5) 0 8deg,transparent 8deg 30deg);border-radius:50%;animation:rayspin 6s linear infinite;pointer-events:none}
@keyframes rayspin{to{transform:rotate(360deg)}}
.lvup .confetti{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.lvup .confetti i{position:absolute;top:-12px;width:9px;height:14px;border-radius:2px;opacity:.95;animation:conffall 1.8s linear forwards}
@keyframes conffall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(105vh) rotate(540deg)}}
.lvup-title{font-family:'Orbitron',sans-serif;font-size:25px;font-weight:900;color:#fff;letter-spacing:3px;text-shadow:0 0 22px #d97757;margin-top:6px;animation:lvbounce .7s .08s both cubic-bezier(.2,1.4,.4,1)}
.lvup-rank{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:#d97757;letter-spacing:2px;margin-top:12px;border:1px solid #d9775766;border-radius:20px;padding:6px 18px;background:rgba(217,119,87,.08);animation:lvbounce .7s .16s both cubic-bezier(.2,1.4,.4,1)}
@keyframes lvbounce{0%{opacity:0;transform:scale(.3)}100%{opacity:1;transform:scale(1)}}
/* ── practice mode (listen + check) ── */
.practicebtn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:10px;padding:12px;border-radius:13px;border:1px solid #d9775766;background: rgba(217,119,87,.12);color:#d97757;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;cursor:pointer;transition:all .2s}
.practicebtn:hover{border-color:#d97757;box-shadow:0 0 16px -4px #d97757;transform:translateY(-1px)}
.practicebtn:active{transform:scale(.98)}
.practicebtn:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.practiceov{position:fixed;inset:0;z-index:1100;display:flex;flex-direction:column;background:var(--bg);animation:fadein .25s}
.practicehdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #d9775733;background:var(--card2);flex-shrink:0;position:relative;z-index:1}
.practicehtitle{font-family:'Orbitron',sans-serif;font-size:12px;color:#d97757;letter-spacing:1.5px;display:flex;flex-direction:column;gap:3px}
.practicehtitle small{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:.5px;text-transform:none}
.practicebody{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:13px;position:relative;z-index:1}
.practicesrc{text-align:center;font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:.5px;padding:8px;border-radius:9px;background:rgba(217,119,87,.06);border:1px solid #d9775722;color:var(--text2)}
.practicesrc.err{background:rgba(255,82,82,.08);border-color:#ff525233;color:#ff5252}
.practicenow{display:flex;align-items:center;justify-content:center;gap:30px;padding:4px 0}
.practicenow-box{text-align:center}
.practicenow-lbl{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:1px;margin-bottom:5px}
.practicenow-note{font-family:'Orbitron',sans-serif;font-size:36px;font-weight:900;line-height:1}
.practicenow-note.target{color:#d97757;text-shadow:0 0 18px #d9775777}
.practicenow-note.heard{color:var(--muted)}
.practicenow-note.heard.ok{color:#d97757;text-shadow:0 0 16px #d9775788}
.practicenow-note.heard.bad{color:#ff5252;text-shadow:0 0 16px #ff525288;animation:shake .3s}
.practicechips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.pchip{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;padding:6px 9px;border-radius:8px;border:1px solid var(--bd2);background:var(--card3);color:var(--muted);min-width:30px;text-align:center}
.pchip.done{background:rgba(217,119,87,.16);border-color:#d97757;color:#d97757}
.pchip.cur{border-color:#d97757;color:#d97757;box-shadow:0 0 12px -3px #d97757;animation:blink 1.2s infinite}
.practicebar{height:12px;border-radius:7px;background:var(--card3);border:1px solid var(--bd2);overflow:hidden}
.practicefill{height:100%;background: #d97757;box-shadow:0 0 10px -2px #d97757;transition:width .25s}
.practicestats{display:flex;justify-content:space-around;font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--text2)}
.practicestats b{font-family:'Orbitron',sans-serif;color:var(--text);font-size:15px}
.practicetip{text-align:center;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);line-height:1.6}
.practicefoot{display:flex;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #d9775733;background:var(--card2);flex-shrink:0;position:relative;z-index:1}
.practicefoot button{flex:1;padding:12px;border-radius:11px;font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:1.5px;cursor:pointer;transition:all .2s;border:1px solid}
.practicerestart{border-color:#d9775755!important;background:rgba(217,119,87,.08);color:#d97757}
.practiceexit{border-color:#ff525255!important;background:rgba(255,82,82,.08);color:#d97757}
/* ── daily quest + achievements ── */
.questcard{background: var(--card2);border:1px solid #d9775744;border-radius:13px;padding:14px}
.questcard.done{background: var(--card3);border-color:#d9775755}
.questrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;gap:8px}
.questname{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;color:var(--text2);display:flex;align-items:center;gap:7px}
.questrew{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#d97757;white-space:nowrap}
.questcard.done .questrew{color:#d97757}
.questbar{height:12px;border-radius:7px;background:var(--card3);border:1px solid var(--bd2);overflow:hidden}
.questfill{height:100%;border-radius:7px;background: #d97757;transition:width .5s}
.questcard.done .questfill{background: #d97757}
.questcount{text-align:right;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text2);margin-top:6px}
.badgegrid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.badge{display:flex;flex-direction:column;align-items:center;gap:5px;padding:11px 4px;border-radius:12px;background:var(--card2);border:1px solid var(--bd3);text-align:center}
.badge.got{border-color:#d9775755;background: rgba(217,119,87,.12);box-shadow:0 0 14px -7px #d97757}
.badge-ic{font-size:23px;line-height:1.1;filter:grayscale(1) opacity(.38)}
.badge.got .badge-ic{filter:none}
.badge-nm{font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:600;line-height:1.2;color:var(--muted)}
.badge.got .badge-nm{color:#d97757}
.lvup{pointer-events:all}
.lvup-share{margin-top:20px;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;background:rgba(217,119,87,.2);color:#d97757;border:1px solid rgba(217,119,87,.5);border-radius:20px;padding:9px 22px;cursor:pointer;animation:lvbounce .7s .28s both cubic-bezier(.2,1.4,.4,1)}
.lvup-share:hover{background:rgba(217,119,87,.35)}
/* badge unlock overlay (reuses .lvup container) */
.lvup-badge .lvup-burst{filter:drop-shadow(0 0 18px #d97757)}
.lvup-badge .lvup-title{color:#d97757;text-shadow:0 0 22px #d97757}
.lvup-badge .lvup-rank{color:#d97757;border-color:#d9775766;background:rgba(217,119,87,.1)}
/* ── play-along (falling notes) ── */
.songpage .pathbadge{color:#d97757;border-color:#d9775744}
.songgrid{display:flex;flex-direction:column;gap:11px;padding:4px 14px}
.songcard{display:flex;align-items:center;gap:13px;padding:14px;border-radius:15px;background:var(--card2);border:1px solid var(--bd1);border-left:3px solid var(--sc,#d97757);cursor:pointer;text-align:left;transition:all .2s;font-family:inherit}
.songcard:hover{border-color:var(--sc,#d97757);box-shadow:0 0 22px -10px var(--sc,#d97757);transform:translateY(-2px)}
.songcard:active{transform:scale(.99)}
.songcard-ic{font-size:26px;filter:drop-shadow(0 0 8px var(--sc,#d97757))}
.songcard-body{flex:1;min-width:0}
.songcard-nm{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text)}
.songcard-meta{display:flex;gap:11px;align-items:center;margin-top:3px;font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--muted)}
.songdiff{color:#d97757;letter-spacing:1px}
.songcard-pb{margin-left:auto;font-family:'Orbitron',sans-serif;font-size:9px;font-weight:700;color:#d97757;opacity:.85;letter-spacing:.5px;white-space:nowrap}
.songcard-go{font-size:15px;color:var(--sc,#d97757)}
.songov{position:fixed;inset:0;z-index:1100;display:flex;flex-direction:column;background:var(--bg);animation:fadein .25s}
.songhdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--bd3);flex-shrink:0}
.songhtitle{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:9px}
.songhtitle small{color:#d97757;font-size:12px;letter-spacing:1px}
.vmhdrbtns{display:flex;align-items:center;gap:8px}
.songhud{display:flex;justify-content:space-around;gap:8px;padding:9px 14px;font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--text2);flex-shrink:0}
.songhud b{font-family:'Orbitron',sans-serif;color:#fff;font-size:15px}
.songhud .hot b{color:#d97757;text-shadow:0 0 10px #ff5252}
.songprog{height:5px;background:var(--card3);flex-shrink:0}
.songprog>div{height:100%;background: #d97757;transition:width .15s}
.songstage{position:relative;flex:1;min-height:0;overflow:hidden}
.songcanvas{width:100%;height:100%;display:block}
.songcount{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:90px;font-weight:900;color:#fff;text-shadow:0 0 40px #d97757;animation:popcount .9s ease-out;pointer-events:none}
.songjudge{position:absolute;left:0;right:0;top:38%;text-align:center;font-family:'Orbitron',sans-serif;font-size:34px;font-weight:900;pointer-events:none;animation:judgepop .65s ease-out forwards;text-shadow:0 0 24px currentColor}
.songjudge.perfect{color:#d97757}
.songjudge.good{color:#d97757}
.songjudge.miss{color:#ff5252;font-size:26px}
@keyframes judgepop{0%{transform:scale(.5) translateY(10px);opacity:0}25%{transform:scale(1.15) translateY(0);opacity:1}70%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(.9) translateY(-22px);opacity:0}}
.songnewbest{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:800;color:#d97757;text-shadow:0 0 16px #d9775788;animation:popcount .6s ease-out}
/* game juice: shake, GO!, particle bursts, combo meter, full-combo banner */
.songstage.shake{animation:shake .38s cubic-bezier(.36,.07,.19,.97)}
@keyframes shake{10%{transform:translate(-2px,1px)}20%{transform:translate(3px,-2px)}30%{transform:translate(-4px,2px)}40%{transform:translate(4px,1px)}50%{transform:translate(-3px,-1px)}60%{transform:translate(3px,2px)}70%{transform:translate(-2px,-2px)}80%{transform:translate(2px,1px)}100%{transform:translate(0,0)}}
.songgo{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:64px;font-weight:900;color:#d97757;text-shadow:0 0 40px #d97757;pointer-events:none;animation:goflash .7s ease-out forwards}
@keyframes goflash{0%{transform:scale(.4);opacity:0}30%{transform:scale(1.1);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1.4);opacity:0}}
.burst{position:absolute;left:50%;top:42%;width:0;height:0;pointer-events:none;z-index:5}
.burst i{position:absolute;left:0;top:0;width:9px;height:9px;border-radius:50%;background:#d97757;box-shadow:0 0 8px currentColor;color:#d97757;transform:rotate(var(--a)) translateY(0);animation:burstfly .72s ease-out forwards}
.burst.combo i{width:11px;height:11px;background:#d97757;color:#d97757}
@keyframes burstfly{0%{opacity:1;transform:rotate(var(--a)) translateY(0) scale(1)}100%{opacity:0;transform:rotate(var(--a)) translateY(calc(var(--d) * -1)) scale(.3)}}
.combostat b{transition:color .2s}
.combostat .comboflame{display:inline-block;margin-left:2px;animation:flamepulse .6s ease-in-out infinite alternate}
.combostat.t1 b{color:#ffb8d0}.combostat.t2 b{color:#ff94e0}.combostat.t3 b{color:#ff76d8}.combostat.t4 b{color:#ff3d6e;text-shadow:0 0 12px #ff3d6e}
.combostat.t2 .comboflame{transform:scale(1.15)}.combostat.t3 .comboflame{transform:scale(1.35)}.combostat.t4 .comboflame{transform:scale(1.6)}
@keyframes flamepulse{from{filter:brightness(1)}to{filter:brightness(1.5)}}
.songfc{font-family:'Orbitron',sans-serif;font-size:18px;font-weight:900;letter-spacing:2px;color:#d97757;text-shadow:0 0 20px #d97757;animation:popcount .7s ease-out}
.songfc.ap{color:#d97757;text-shadow:0 0 22px #d9775766}
.ghoststat{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700}
.ghoststat.ahead{color:#d97757}
.ghoststat.behind{color:#ff5252}
@keyframes popcount{from{transform:scale(1.6);opacity:0}30%{opacity:1}to{transform:scale(1);opacity:.9}}
/* page transitions */
.pw,.pathpage,.profpage{animation:pagein .28s ease-out}
@keyframes pagein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
/* coins pill + daily chest + mascot */
.coinpill{display:flex;align-items:center;gap:3px;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#d97757;background:var(--grad1);border:1px solid #d977573d;border-radius:20px;padding:4px 9px}
.probadge{font-family:'Orbitron',sans-serif;font-size:10px;font-weight:800;color:var(--card2);background: #d97757;border-radius:20px;padding:4px 9px;letter-spacing:.5px;white-space:nowrap}
.probadge.fam{background: #d97757}
.probadge.max{background: #d97757;color:#fff}
.probadge.maxfam{background: #d97757;color:#fff}
.probadge.trial{background:transparent;color:#d97757;border:1.5px solid #d97757}
.trial-banner{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 16px;background:#d97757;color:#fff}
.trial-banner-txt{font-size:13px;font-weight:700;font-family:'Rajdhani',sans-serif;letter-spacing:.3px}
.trial-banner-btn{flex-shrink:0;background:rgba(255,255,255,.22);border:1.5px solid rgba(255,255,255,.5);color:#fff;border-radius:8px;padding:5px 13px;font-size:12px;font-weight:800;font-family:'Orbitron',sans-serif;cursor:pointer;white-space:nowrap}
.trial-expired{background:var(--card2);border-left:3px solid #d97757;padding:12px 16px;margin:8px 16px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.billtoggle{display:flex;gap:8px;background:var(--card);border-radius:24px;padding:4px;margin-bottom:14px}
.billtog{flex:1;padding:9px;border-radius:20px;background:transparent;border:none;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.billtog.on{background: #d97757;color:#fff}
.billsave{font-family:'Orbitron',sans-serif;font-size:9px;background:#d97757;color:var(--grad1);border-radius:8px;padding:2px 5px}
.pr-yrsave{color:#d97757;font-size:12px;font-weight:700;margin:-4px 0 8px}
.upbtn{font-family:'Orbitron',sans-serif;font-size:10px;font-weight:800;color:var(--card2);background: #d97757;border:none;border-radius:20px;padding:5px 10px;cursor:pointer;animation:flamepulse 1.4s ease-in-out infinite alternate}
.setcard.pricing{max-width:420px}
.pr-sub{font-family:'Rajdhani',sans-serif;font-size:14px;color:var(--muted);text-align:center;margin:0 0 14px}
.prtier{border:1px solid var(--bd2);border-radius:14px;padding:13px 14px;margin-bottom:11px;background:var(--card3)}
.prtier.hot{border-color:#d97757;box-shadow:0 0 22px -8px #d97757;background:var(--card3)}
.prtier.max{border-color:#d97757;box-shadow:0 0 22px -8px #d97757;background:var(--card3)}
.prtier.max .prtier-price{color:#d97757}
.prtier.maxfam{border-color:#d97757;box-shadow:0 0 26px -8px #d97757;background:var(--card3)}
.prtier.maxfam .prtier-price{color:#d97757}
.prtier.cur{outline:2px solid #d97757;outline-offset:1px}
.prtier.free{opacity:.85}
.prtier-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.prtier-nm{font-family:'Orbitron',sans-serif;font-size:15px;font-weight:800;color:var(--text)}
.prtier-price{font-family:'Orbitron',sans-serif;font-size:20px;font-weight:900;color:#d97757}
.prtier-price small{font-size:11px;color:var(--muted);font-weight:600}
.paysum{display:flex;align-items:center;justify-content:space-between;padding:6px 0 12px;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:16px;color:var(--text)}
.payqr{display:block;width:230px;max-width:74%;margin:4px auto 12px;border-radius:14px;background:#fff;padding:10px}
.payqr.ext{border-radius:10px}
.payinfo{background:var(--card);border:1px solid var(--bd2);border-radius:12px;padding:11px 13px;display:flex;flex-direction:column;gap:5px;font-size:13.5px;color:var(--text2);margin-bottom:10px}
.payinfo b{color:var(--text);font-family:'Share Tech Mono',monospace}
.payok{text-align:center;padding:10px 4px}
.payok-h{font-family:'Orbitron',sans-serif;font-size:17px;font-weight:800;color:#d97757;margin:6px 0 8px}
.paychans{display:flex;gap:7px;margin:8px 0}
.paychanbtn{flex:1;padding:9px 6px;border:1.5px solid var(--bd2);border-radius:10px;background:var(--surface-2);cursor:pointer;font-size:13px;font-weight:600;color:var(--text2);transition:all .15s;text-align:center}
.paychanbtn.on{border-color:var(--accent);background:rgba(217,119,87,.12);color:var(--accent)}
.paychan-ic{font-size:16px;vertical-align:middle;margin-right:3px}
.adminpay{flex:1;min-height:0;overflow-y:auto;padding:10px 14px 28px}
.adminpay-cfg{background:var(--card3);border:1px solid #ff525233;border-radius:13px;padding:12px;margin-bottom:14px}
.anrow{display:flex;align-items:center;gap:8px;padding:6px 0;font-family:'Rajdhani',sans-serif}
.anrow-rank{color:var(--muted);font-size:11px;font-family:'Orbitron',sans-serif;width:22px;flex-shrink:0}
.anrow-name{color:var(--text2);font-size:13px;flex-shrink:0;width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.anrow-barwrap{flex:1;height:8px;background:var(--card3);border-radius:4px;overflow:hidden}
.anrow-bar{display:block;height:100%;background: #d97757;border-radius:4px}
.anrow-hits{color:#d97757;font-family:'Orbitron',sans-serif;font-size:12px;width:34px;text-align:right;flex-shrink:0}
.adminpay-cfg input{width:100%;background:var(--card3);border:1px solid #ffffff18;border-radius:9px;padding:9px 11px;color:var(--text2);font-size:13.5px;margin-top:7px;box-sizing:border-box}
.adminpay-row{display:flex;align-items:center;gap:11px;background:var(--card3);border:1px solid var(--bd1);border-radius:13px;padding:11px 13px;margin-bottom:8px;text-align:left;width:100%;cursor:pointer}
.adminpay-row.pending{border-color:#d9775755}
.adminpay-row.approved{opacity:.6}
.adminpay-badge{font-size:9px;font-family:'Orbitron',sans-serif;padding:3px 7px;border-radius:6px}
.adminpay-badge.pending{background:#d97757;color:var(--grad1)}
.adminpay-badge.approved{background:#d97757;color:var(--grad1)}
.adminpay-badge.rejected{background:#d97757;color:var(--grad1)}
.payslip{width:100%;max-width:320px;display:block;margin:10px auto;border-radius:12px;border:1px solid #ffffff1c}
.aibox{background:var(--card);border:1px solid #d9775755;border-radius:11px;padding:10px 12px;font-size:13px;color:var(--text2);white-space:pre-wrap;margin:8px 0}
.prfeat{list-style:none;margin:0 0 11px;padding:0;display:flex;flex-direction:column;gap:5px}
.prfeat li{font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--text2)}
.prtier .songbtn{width:100%}
.pr-note{text-align:center;font-family:'Rajdhani',sans-serif;font-size:11px;color:var(--muted);margin:6px 0 12px}
.pr-school{width:100%;padding:11px;border-radius:12px;border:1px dashed #d9775744;background:transparent;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
/* parent dashboard */
.pd-head{font-family:'Rajdhani',sans-serif;font-size:15px;color:var(--text);text-align:center;margin-bottom:12px}
.pd-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:6px}
.pd-stat{background:var(--card);border:1px solid var(--bd3);border-radius:10px;padding:9px 4px;text-align:center}
.pd-num{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:800;color:#d97757}
.pd-lbl{font-family:'Rajdhani',sans-serif;font-size:9.5px;color:var(--muted);margin-top:2px}
.pd-sec{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:var(--text2);letter-spacing:.5px;margin:14px 0 7px}
.pd-tags{display:flex;flex-wrap:wrap;gap:6px}
.pd-tag{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:600;border-radius:8px;padding:4px 9px}
.pd-tag.focus{color:#d97757;background:rgba(217,119,87,.12);border:1px solid #d9775733}
.pd-tag.good{color:#d97757;background:rgba(217,119,87,.1);border:1px solid #d9775733}
.atdash-last{margin-top:10px;border:1px solid var(--bd1);border-radius:12px;padding:11px 12px;background:var(--card3)}
.atdash-last-w{font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;color:#d97757;margin-bottom:3px}
.atdash-last-t{font-family:'Rajdhani',sans-serif;font-size:12.5px;color:var(--muted);line-height:1.5}
.atdash-last-d{font-family:'Share Tech Mono',monospace;font-size:9.5px;color:var(--muted);margin-top:6px;letter-spacing:.5px}
.atdash-empty{font-family:'Rajdhani',sans-serif;font-size:12.5px;color:var(--muted);margin-top:8px}
/* exam prep */
.exgrade{border:1px solid var(--bd1);border-radius:13px;padding:12px 13px;margin-bottom:11px;background:var(--card3)}
.exgrade-top{display:flex;justify-content:space-between;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:var(--text);margin-bottom:7px}
.extasks{display:flex;flex-direction:column;gap:5px;margin-top:9px}
.extask{display:flex;align-items:center;gap:8px;text-align:left;background:var(--card);border:1px solid var(--bd3);border-radius:9px;padding:9px 11px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;cursor:pointer}
.extask span{color:var(--muted);font-weight:800}
.extask.ok{border-color:#d977574d;color:#d97757}
.extask.ok span{color:#d97757}
.chestbtn{background:none;border:none;font-size:20px;cursor:pointer;animation:chestwiggle 1.4s ease-in-out infinite;padding:2px 4px}
@keyframes chestwiggle{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-12deg) scale(1.1)}75%{transform:rotate(12deg) scale(1.1)}}
.chestov{position:fixed;inset:0;z-index:1400;background:rgba(9,4,8,.82);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadein .2s}
.chestcard{text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}
.chestbig{font-size:96px;filter:drop-shadow(0 0 30px #d97757)}
.chestbig.opening{animation:chestshake .5s ease-in-out infinite}
.chestbig.open{animation:chestpop .5s ease-out}
@keyframes chestshake{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes chestpop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
.chesttitle{font-family:'Orbitron',sans-serif;font-size:18px;font-weight:800;color:#fff}
.chestrewards{display:flex;gap:18px;font-family:'Orbitron',sans-serif;font-size:18px;font-weight:700;color:#d97757}
.chestrewards span:last-child{color:#d97757}
.cheststreak{font-family:'Rajdhani',sans-serif;font-size:14px;color:#d97757}
.chesttitle.jackpot{color:#d97757;font-size:24px;text-shadow:0 0 22px #d97757;animation:popcount .6s ease-out}
.songbonus{position:absolute;left:0;right:0;top:28%;text-align:center;font-family:'Orbitron',sans-serif;font-size:24px;font-weight:900;color:#d97757;text-shadow:0 0 18px #d97757;pointer-events:none;animation:judgepop .9s ease-out forwards;z-index:6}
/* fever mode + flying score popups + combo shouts (dopamine) */
.feverbg{position:absolute;inset:0;pointer-events:none;z-index:1;opacity:.5;background:linear-gradient(125deg,#ff5252,#ffd23f,#d97757,#6a9bcc,#788c5d,#ff5252);background-size:400% 400%;animation:feverflow 2.2s linear infinite;mix-blend-mode:screen}
@keyframes feverflow{0%{background-position:0% 50%}100%{background-position:400% 50%}}
.songstage.fever{box-shadow:inset 0 0 60px -10px #ff5252}
.feverbadge{position:absolute;top:8px;left:50%;transform:translateX(-50%);font-family:'Orbitron',sans-serif;font-size:14px;font-weight:900;color:#fff;text-shadow:0 0 14px #ff5252;z-index:6;animation:flamepulse .4s ease-in-out infinite alternate;pointer-events:none}
.songpop{position:absolute;top:62%;font-family:'Orbitron',sans-serif;font-size:18px;font-weight:800;color:var(--text2);text-shadow:0 2px 6px #000;pointer-events:none;animation:popfly .78s ease-out forwards;z-index:5}
.songpop.perfect{font-size:24px;color:#d97757;text-shadow:0 0 14px #d97757}
@keyframes popfly{0%{opacity:0;transform:translateY(8px) scale(.7)}25%{opacity:1;transform:translateY(0) scale(1.1)}100%{opacity:0;transform:translateY(-60px) scale(1)}}
.songannounce{position:absolute;left:0;right:0;top:20%;text-align:center;font-family:'Orbitron',sans-serif;font-size:30px;font-weight:900;letter-spacing:1px;pointer-events:none;z-index:6;color:#d97757;text-shadow:0 0 20px #d9775766;animation:announcepop 1.1s ease-out forwards}
@keyframes announcepop{0%{transform:scale(.4) rotate(-8deg);opacity:0}20%{transform:scale(1.2) rotate(3deg);opacity:1}40%{transform:scale(1) rotate(0)}80%{opacity:1}100%{transform:scale(1.1);opacity:0}}
/* daily hook hub (home) */
.dailyhub{display:flex;align-items:stretch;gap:10px;margin:10px 12px 4px;padding:11px 13px;border-radius:15px;background:var(--card3);border:1px solid var(--bd2)}
.dailyhub.atrisk{border-color:#d9775766;box-shadow:0 0 18px -8px #d97757}
.dh-streak{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:56px;position:relative}
.dh-flame{font-size:26px;line-height:1;animation:flamepulse .8s ease-in-out infinite alternate}
.dh-streaknum{font-family:'Orbitron',sans-serif;font-size:24px;font-weight:900;color:#d97757;line-height:1;margin-top:-4px}
.dh-streaklbl{font-family:'Rajdhani',sans-serif;font-size:9px;color:var(--muted);letter-spacing:.5px}
.dh-mid{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:5px}
.dh-goal-top{display:flex;justify-content:space-between;align-items:baseline;font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:600;color:var(--text2)}
.dailyhub.atrisk .dh-goal-top span{color:#d97757}
.dh-goal-top b{font-family:'Orbitron',sans-serif;font-size:11px;color:#d97757}
.dh-goalbar{height:8px;border-radius:5px;background:var(--card2);overflow:hidden}
.dh-goalbar div{height:100%;border-radius:5px;background: #d97757;transition:width .5s}
.dh-actions{display:flex;gap:8px;align-items:center;min-height:18px}
.dh-freeze{font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;color:#d97757}
.dh-buyfreeze{font-family:'Rajdhani',sans-serif;font-size:10.5px;font-weight:700;color:var(--muted);background:var(--card2);border:1px solid var(--bd2);border-radius:14px;padding:3px 9px;cursor:pointer}
.dh-buyfreeze:active{transform:scale(.95)}
.dh-chest{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:62px;border-radius:12px;border:none;cursor:pointer;background: #d97757;color:var(--card2);font-size:24px;padding:6px}
.dh-chest span{font-family:'Orbitron',sans-serif;font-size:8.5px;font-weight:800;letter-spacing:.3px}
.dh-chest:not(.done){animation:chestwiggle 1.4s ease-in-out infinite}
.dh-chest.done{background: #d97757}
.dh-chest:active{transform:scale(.95)}
.dailyrec{display:flex;align-items:center;gap:8px;margin:6px 12px 0;padding:9px 13px;width:calc(100% - 24px);border-radius:13px;border:1px solid #d9775733;background:var(--card3);cursor:pointer;text-align:left}
.dailyrec:active{transform:scale(.99)}
.dailyrec-lbl{font-family:'Orbitron',sans-serif;font-size:9px;font-weight:800;letter-spacing:.5px;color:#d97757;flex-shrink:0}
.dailyrec-ic{font-size:18px;flex-shrink:0}
.dailyrec-txt{flex:1;min-width:0;font-family:'Rajdhani',sans-serif;font-size:13.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dailyrec-go{color:#d97757;font-weight:800;flex-shrink:0}
/* quick "change key" back button on the Sensei page — returns to Pathway with
   the same topic's key picker already open, instead of a ☰-menu round trip */
.senseiback{display:flex;align-items:center;gap:6px;margin:8px 12px 0;padding:8px 13px;border-radius:20px;border:1px solid #d9775744;background:rgba(217,119,87,.08);color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;cursor:pointer;align-self:flex-start}
.senseiback:active{transform:scale(.97);background:rgba(217,119,87,.16)}
.senseiback span:first-child{font-size:15px}
.hwbar{display:flex;align-items:center;gap:9px;margin:6px 12px 0;padding:9px 13px;width:calc(100% - 24px);border-radius:13px;border:1px solid #d9775733;background:var(--card3)}
.hwbar-ic{font-size:17px;flex-shrink:0}
.hwbar-tx{flex:1;min-width:0;font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hwbar-tx b{color:#d97757;font-weight:800}
.hwbar-done{flex-shrink:0;width:28px;height:28px;border-radius:50%;border:1px solid #d9775766;background:var(--card3);color:#d97757;font-weight:800;cursor:pointer}
.hwbar-done:active{transform:scale(.9)}
.setcard.wlc{max-width:380px;padding:24px 22px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.wlc-mascot{font-size:62px;animation:mascotidle 2.4s ease-in-out infinite}
.wlc-title{font-family:'Orbitron',sans-serif;font-size:18px;font-weight:800;color:var(--text)}
.wlc-tips{display:flex;flex-direction:column;gap:11px;width:100%}
.wlc-tip{display:flex;align-items:center;gap:11px;text-align:left;background:var(--card);border:1px solid var(--bd1);border-radius:12px;padding:11px 13px}
.wlc-tip span{font-size:24px;flex-shrink:0}
.wlc-tip b{font-family:'Rajdhani',sans-serif;font-size:13.5px;font-weight:600;color:var(--text2)}
.mascot{position:fixed;right:12px;bottom:84px;z-index:900;cursor:pointer;animation:mascotidle 2.6s ease-in-out infinite;will-change:transform}
.mascot-face{font-size:38px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))}
.mascot.happy{animation:mascothop .5s ease-out}
.mascot.celebrate{animation:mascotcheer .6s ease-out infinite}
.mascot-spark{position:absolute;top:-6px;right:-6px;font-size:18px;animation:flamepulse .5s ease-in-out infinite alternate}
@keyframes mascotidle{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes mascothop{0%{transform:translateY(0)}40%{transform:translateY(-16px)}100%{transform:translateY(0)}}
@keyframes mascotcheer{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-12px) rotate(6deg)}}
/* cosmetics shop + key-skins + themes */
.shopsec{display:flex;align-items:center;gap:8px;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:var(--text2);letter-spacing:1px;margin:16px 0 8px}
.shopsec:first-child{margin-top:0}
.shopgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.shopitem{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 6px 10px;border-radius:12px;border:1px solid var(--bd2);background:var(--card);color:var(--text2);cursor:pointer}
.shopitem:active{transform:scale(.96)}
.shopitem.equipped{border-color:#d97757;box-shadow:0 0 0 1px #d97757,0 0 14px -4px #d97757}
/* rarity border tint — common stays neutral, higher tiers get a colored ring so
   pricier items visibly look more special even before reading the coin cost */
.shopitem.rare{border-color:#6a9bcc77}
.shopitem.epic{border-color:#a855f777;box-shadow:0 0 10px -4px #a855f7aa}
.shopitem.legendary{border-color:#ffd23f;box-shadow:0 0 14px -3px #ffd23faa}
.shopitem.legendary.equipped{border-color:#d97757;box-shadow:0 0 0 1px #d97757,0 0 16px -3px #d97757}
.shopitem-new{position:absolute;top:-6px;right:-6px;background:#d97757;color:#fff;font-family:'Orbitron',sans-serif;font-size:7.5px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:8px;box-shadow:0 2px 6px -2px #d97757;z-index:1}
.shopitem-swwrap{position:relative;width:36px;height:36px;flex-shrink:0}
.shopitem-sw{display:block;width:36px;height:36px;border-radius:50%;border:1.5px solid var(--bd4)}
.shopitem-ic{position:absolute;bottom:-3px;right:-3px;font-size:14px;line-height:1;background:var(--card);border-radius:50%;padding:1px}
.shopitem-nm{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:600}
.shopitem-rare{font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.5px;color:var(--muted);text-transform:uppercase}
.shopitem-tag{font-family:'Share Tech Mono',monospace;font-size:10px;color:#d97757}
.shopitem.equipped .shopitem-tag{color:#d97757}
body[data-skin="sunset"] .pk.w.lit{background:linear-gradient(180deg,#ff9e00,#ff5d3a 40%,#fff);box-shadow:0 0 16px #ff7a3d,0 0 40px #ff7a3d66}
body[data-skin="sunset"] .pk.b.lit{background:linear-gradient(180deg,#ff9e00,#a83200);box-shadow:0 0 14px #ff7a3d}
body[data-skin="neon"] .pk.w.lit{background:linear-gradient(180deg,#06ffa5,#00d488 40%,#fff);box-shadow:0 0 16px #06ffa5,0 0 40px #06ffa566}
body[data-skin="neon"] .pk.b.lit{background:linear-gradient(180deg,#06ffa5,#04694a);box-shadow:0 0 14px #06ffa5}
body[data-skin="candy"] .pk.w.lit{background:linear-gradient(180deg,#ff76d8,#ff94e0 40%,#fff);box-shadow:0 0 16px #ff76d8,0 0 40px #ff76d866}
body[data-skin="candy"] .pk.b.lit{background:linear-gradient(180deg,#ff76d8,#cc1b7a);box-shadow:0 0 14px #ff76d8}
body[data-skin="gold"] .pk.w.lit{background:linear-gradient(180deg,#ffd23f,#e0a800 40%,#fff6d8);box-shadow:0 0 16px #ffd23f,0 0 40px #ffd23f66}
body[data-skin="gold"] .pk.b.lit{background:linear-gradient(180deg,#ffd23f,#9a7400);box-shadow:0 0 14px #ffd23f}
body[data-skin="ocean"] .pk.w.lit{background:linear-gradient(180deg,#00d4ff,#0077b6 40%,#fff);box-shadow:0 0 16px #00d4ff,0 0 40px #00d4ff66}
body[data-skin="ocean"] .pk.b.lit{background:linear-gradient(180deg,#00d4ff,#023e5c);box-shadow:0 0 14px #00d4ff}
body[data-skin="ice"] .pk.w.lit{background:linear-gradient(180deg,#d0f4ff,#7dd3ec 40%,#fff);box-shadow:0 0 16px #a5f3fc,0 0 40px #a5f3fc66}
body[data-skin="ice"] .pk.b.lit{background:linear-gradient(180deg,#a5f3fc,#0891b2);box-shadow:0 0 14px #a5f3fc}
body[data-skin="fire"] .pk.w.lit{background:linear-gradient(180deg,#ff6b35,#c1121f 40%,#fff);box-shadow:0 0 16px #ff6b35,0 0 40px #ff6b3566}
body[data-skin="fire"] .pk.b.lit{background:linear-gradient(180deg,#ff6b35,#6b0f16);box-shadow:0 0 14px #ff6b35}
body[data-skin="galaxy"] .pk.w.lit{background:linear-gradient(180deg,#c084fc,#7c3aed 40%,#fff);box-shadow:0 0 16px #a855f7,0 0 40px #a855f766}
body[data-skin="galaxy"] .pk.b.lit{background:linear-gradient(180deg,#a855f7,#4c1d95);box-shadow:0 0 14px #a855f7}
/* Prism is the one legendary skin allowed to keep a moving multi-hue gradient —
   unlike the app's own default styling, a purchased cosmetic's whole value is
   looking different/special, so this is exempt from the one-flat-pink rule. */
body[data-skin="prism"] .pk.w.lit,body[data-skin="prism"] .pk.b.lit{background:linear-gradient(180deg,#ff5252,#ffd23f,#06ffa5,#00d4ff,#a855f7,#ff76d8);background-size:100% 400%;animation:prismshift 3s linear infinite;box-shadow:0 0 16px #d97757,0 0 40px #d9775766}
@keyframes prismshift{0%{background-position:50% 0%}100%{background-position:50% 400%}}
/* Shop-purchased cosmetic backgrounds only apply in dark mode — a light-mode choice
   must always win, so equipping Aurora/Ember/Forest can't force a dark screen back on. */
html[data-theme="dark"] body[data-theme="aurora"] .tg{background:radial-gradient(120% 90% at 30% 0%,#0b2a3a,#0a1326 60%,#070a16)}
html[data-theme="dark"] body[data-theme="ember"] .tg{background:radial-gradient(120% 90% at 70% 0%,var(--grad1),#180b10 55%,#0a0708)}
html[data-theme="dark"] body[data-theme="forest"] .tg{background:radial-gradient(120% 90% at 40% 0%,#0c2a1c,#0a1a16 60%,#070f0c)}
html[data-theme="dark"] body[data-theme="sakura"] .tg{background:radial-gradient(120% 90% at 50% 0%,#3a1a2e,#220f1c 55%,#120810)}
html[data-theme="dark"] body[data-theme="deepsea"] .tg{background:radial-gradient(120% 90% at 30% 0%,#052030,#031824 60%,#01080c)}
html[data-theme="dark"] body[data-theme="volcano"] .tg{background:radial-gradient(120% 90% at 60% 0%,#3a1005,#220a08 55%,#100403)}
html[data-theme="dark"] body[data-theme="starlight"] .tg{background:radial-gradient(120% 90% at 40% 0%,#1a0a3a,#12082a 55%,#08041a)}
.songready{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(5,9,16,.5);backdrop-filter:blur(2px);padding:20px;text-align:center}
.songready-info{font-family:'Rajdhani',sans-serif;font-size:15px;color:#ffcfe9}
.songtempo{display:flex;gap:8px}
.songtempobtn{padding:7px 15px;border-radius:10px;background:var(--card);border:1px solid #ffffff18;color:var(--muted);font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;cursor:pointer}
.songtempobtn.on{border-color:#d97757;color:#d97757;background:rgba(217,119,87,.08)}
.songready-btns{display:flex;gap:11px;flex-wrap:wrap;justify-content:center}
.songbtn{padding:12px 22px;border-radius:12px;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:1px solid}
.songbtn.go{background: #d97757;border-color:transparent;color:var(--card2);box-shadow:0 6px 22px -8px #d97757}
.songbtn.ghost{background:transparent;border-color:var(--bd5);color:var(--text2)}
.songbtn:active{transform:scale(.96)}
.songsrc{font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--muted)}
.songlanes{display:flex;gap:3px;padding:7px 4px;flex-shrink:0;background:#140812;border-top:1px solid #d9775722}
.songlane{flex:1;padding:13px 2px;border-radius:9px;border:1px solid hsla(var(--lh,332),70%,55%,.4);background:hsla(var(--lh,332),70%,50%,.1);color:hsla(var(--lh,332),85%,76%,1);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer}
.songlane:active{background:hsla(var(--lh,332),80%,55%,.35);transform:translateY(1px)}
/* responsive game keyboard — fills full width on any device */
.gpwrap{flex-shrink:0;background:#140812;border-top:1px solid #d9775722;padding:4px 0 calc(4px + env(safe-area-inset-bottom,0px))}
.gprow{position:relative;display:flex;gap:2px;width:100%;max-width:1200px;margin:0 auto;padding:0 4px;height:clamp(54px,11vh,140px)}
.gpw{flex:1;min-width:0;height:100%;background: #ffffff;border:1px solid #d4cfc5;border-top:none;border-radius:0 0 6px 6px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px;cursor:pointer;box-shadow:0 3px 5px rgba(0,0,0,.4);transition:filter .08s,transform .05s;-webkit-tap-highlight-color:transparent}
.gpw span{font-family:'Share Tech Mono',monospace;font-size:clamp(8px,1.7vw,14px);color:var(--muted);pointer-events:none}
.gpw:active{transform:translateY(2px)}
.gpw.lit{background:#d97757;box-shadow:0 0 16px #d97757,0 0 38px #d9775766}
.gpb{position:absolute;top:0;height:62%;background:#1a1a1a;border:1px solid #111;border-radius:0 0 5px 5px;z-index:2;cursor:pointer;box-shadow:0 4px 8px rgba(0,0,0,.8);-webkit-tap-highlight-color:transparent}
.gpb:active{transform:translateY(1px)}
.gpb.lit{background:#d97757;box-shadow:0 0 14px #d97757}
.gpw.flash{animation:keypop .32s ease-out}
.gpb.flash{animation:keypop .32s ease-out}
/* realistic, slidable keyboard (voice mode): taller keys, swipe to reach octaves */
.gpscroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:thin}
.gpscroll::-webkit-scrollbar{height:5px}
.gpscroll::-webkit-scrollbar-thumb{background:#d9775755;border-radius:3px}
.gpscroll .gprow{height:clamp(118px,23vh,188px);gap:2px}
.gpscroll .gpw span{font-size:10px}
/* song library: filters, favorites, continue */
.songfilters{display:flex;gap:7px;overflow-x:auto;padding:0 14px 10px;scrollbar-width:none}
.songfilters::-webkit-scrollbar{display:none}
.songfilter{flex:0 0 auto;padding:7px 14px;border-radius:20px;border:1px solid var(--bd2);background:var(--card);color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
.songfilter.on{background: #d97757;color:var(--card2);border-color:transparent}
.drillhint{padding:0 16px 10px;margin:0;color:var(--muted);font-size:12.5px;line-height:1.45}
.songcontinue{padding:0 14px 4px}
.songcontinue-lbl{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#d97757;letter-spacing:1px;margin-bottom:6px}
.songcard{position:relative}
.favbtn{position:absolute;top:7px;right:34px;font-size:18px;line-height:1;color:var(--muted);background:none;border:none;cursor:pointer;padding:4px;z-index:2}
.favbtn.on{color:#d97757;text-shadow:0 0 10px #d9775766}
.songempty{grid-column:1/-1;text-align:center;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:14px;padding:24px}
.aicreate{display:block;width:calc(100% - 28px);margin:0 14px 10px;padding:11px;border-radius:13px;border:1px solid #d9775755;background:var(--card3);color:var(--text);font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
.aicreate:active{transform:scale(.99)}
.aicreate-hint{font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--muted);margin:0 0 10px;line-height:1.4}
.aicreate-in{width:100%;box-sizing:border-box;padding:11px 13px;border-radius:11px;border:1px solid var(--bd4);background:var(--card2);color:var(--text);font-family:'Rajdhani',sans-serif;font-size:15px}
.aicreate-in:focus{outline:none;border-color:#d97757}
.aicreate-err{color:#ff5252;font-family:'Rajdhani',sans-serif;font-size:12px;margin-top:8px}
.favbtn.del{color:#ff5252;font-size:15px}
.songcard.locked{opacity:.55;filter:grayscale(.5)}
.songcard.locked .songcard-meta span:last-child{color:#d97757}
/* record & playback bar (main keyboard) */
.recbar{display:flex;align-items:center;justify-content:center;gap:9px;padding:2px 8px 10px}
.recbtn{padding:8px 18px;border-radius:20px;border:1px solid var(--bd4);background:var(--card);color:var(--text2);font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;cursor:pointer}
.recbtn.on{background: #ff5252;color:#fff;border-color:transparent;animation:metblink 1.1s steps(2) infinite}
.recbtn.ghost{background:transparent}
.recbtn.ai{background: #d97757;color:var(--card2);border-color:transparent}
.recbtn:disabled{opacity:.4;cursor:default}
.recbtn:active:not(:disabled){transform:scale(.96)}
.recdot{font-family:'Share Tech Mono',monospace;font-size:11px;color:#ff5252;font-weight:700}
.songsrcbar{text-align:center;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);padding:5px;flex-shrink:0}
.songresult{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;padding:24px;text-align:center}
.songstars{font-size:46px;color:#d97757;letter-spacing:6px;text-shadow:0 0 24px #d9775766;animation:popcount .6s ease-out}
.songresult-acc{font-family:'Orbitron',sans-serif;font-size:40px;font-weight:900;color:var(--text)}
.songresult-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;width:100%;max-width:300px}
.songresult-grid>div{background:var(--card);border:1px solid var(--bd1);border-radius:12px;padding:11px}
.songresult-grid span{display:block;font-family:'Rajdhani',sans-serif;font-size:11px;color:var(--muted)}
.songresult-grid b{font-family:'Orbitron',sans-serif;font-size:18px;color:#d97757}
.songanalysis{width:100%;max-width:300px;text-align:left;background:var(--card);border:1px solid var(--bd1);border-radius:12px;padding:12px 13px}
.songanalysis-load{font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--muted);text-align:center;animation:flamepulse .8s ease-in-out infinite alternate}
.songanalysis-hd{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;letter-spacing:.4px;color:#d97757;margin-bottom:6px}
.songanalysis-weak{font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px}
.songanalysis-steps{margin:0;padding-left:18px;font-family:'Rajdhani',sans-serif;font-size:12.5px;line-height:1.6;color:var(--text2)}
.songanalysis-steps li{margin-bottom:3px}
.studioback{position:absolute;left:12px;top:12px;background:rgba(255,255,255,.06);border:1px solid var(--bd4);color:var(--text2);border-radius:9px;padding:6px 12px;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;cursor:pointer;z-index:2}
/* sight-reading */
.sightov .practicebody{align-items:stretch}
.staffwrap{background:#ffffff;border:1px solid var(--bd2);border-radius:16px;padding:14px 8px;margin:6px 0;transition:box-shadow .2s,border-color .2s}
.staffwrap.ok{border-color:#d97757;box-shadow:0 0 24px -8px #d97757}
.staffwrap.bad{border-color:#ff5252;box-shadow:0 0 24px -8px #ff5252}
.staffsvg{display:block;max-height:175px}
.clefsel{display:flex;gap:8px;justify-content:center;margin:8px 0 2px}
.clefbtn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:11px;border:1px solid var(--bd2);background:rgba(255,255,255,.03);color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s}
.clefbtn .clefgly{font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1}
.clefbtn.on{color:#d97757;border-color:#d97757aa;background: rgba(217,119,87,.16);box-shadow:0 0 18px -8px #d97757}
.clefbtn:active{transform:scale(.96)}
.sighthint{text-align:center;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:600;color:var(--text2);min-height:22px;margin:4px 0 8px}
.sighthint.show{color:#d97757}
/* camera coach */
.camov .camstage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#04070d}
.camvideo,.camcanvas{position:absolute;max-width:100%;height:100%;width:auto;transform:scaleX(-1)}
.camcanvas{pointer-events:none}
.camoverlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:24px;background:rgba(4,8,14,.78);font-family:'Rajdhani',sans-serif;font-size:15px;color:#ffcfe9}
.camoverlay.err{color:#ff9ebd}
.camcoach{position:absolute;left:10px;right:10px;bottom:10px;max-height:55%;overflow-y:auto;background:rgba(8,14,26,.93);border:1px solid #d9775766;border-radius:14px;padding:13px 15px;backdrop-filter:blur(4px)}
.camcoach-load{font-family:'Rajdhani',sans-serif;font-size:14px;color:#d97757;text-align:center;animation:flamepulse .8s ease-in-out infinite alternate}
.camcoach-hd{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:#d97757;margin-bottom:6px}
.camcoach-tx{font-family:'Rajdhani',sans-serif;font-size:14px;line-height:1.5;color:var(--text);white-space:pre-wrap;margin-bottom:8px}
/* Auto Teaching real-time coaching card */
.atpopup{position:fixed;inset:0;z-index:1300;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,5,9,.72);backdrop-filter:blur(3px);animation:fadein .25s;padding:0 12px calc(14px + env(safe-area-inset-bottom,0px))}
.atpopup-card{width:100%;max-width:420px;background:var(--card);border:1px solid #d9775755;border-radius:18px;padding:16px 17px;box-shadow:0 -10px 34px -10px #000,0 0 26px -10px #d9775766;animation:installin .28s ease-out}
.atpopup-hd{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.atpopup-ic{font-size:20px}
.atpopup-tt{flex:1;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;letter-spacing:.4px;color:#d97757}
.atpopup-x{background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:2px 4px}
.atpopup-weak{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text);margin-bottom:10px}
.atpopup-steps{margin:0 0 14px;padding-left:20px;font-family:'Rajdhani',sans-serif;font-size:14px;line-height:1.6;color:var(--text2)}
.atpopup-steps li{margin-bottom:4px}
.atpopup-ok{width:100%;background: #d97757;color:#fff;border:none;border-radius:12px;padding:11px;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:.5px;cursor:pointer}
.camfoot-btns{display:flex;gap:8px;justify-content:center}
.cammsg{position:absolute;left:0;right:0;bottom:14px;text-align:center;font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:#fff;text-shadow:0 2px 10px #000;padding:0 16px}
.camfoot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--bd3);flex-shrink:0}
/* leaderboard */
.lbmine{margin-left:auto;font-family:'Share Tech Mono',monospace;font-size:11px;font-weight:400;color:#d97757}
.lblist{display:flex;flex-direction:column;gap:5px}
.lbpodium{display:flex;align-items:flex-end;justify-content:center;gap:8px;margin-bottom:12px}
.lbpod{flex:1;max-width:108px;display:flex;flex-direction:column;align-items:center;gap:3px;background:var(--card3);border:1px solid var(--bd1);border-radius:12px 12px 0 0;padding:10px 6px}
.lbpod.p1{padding-bottom:30px;border-color:#d9775766;box-shadow:0 0 18px -6px #d97757}
.lbpod.p2{padding-bottom:18px}
.lbpod.me{border-color:#d97757;background:var(--card3)}
.lbpod-medal{font-size:22px}
.lbpod-ava{width:34px;height:34px;border-radius:50%;background: #d97757;color:var(--card2);font-family:'Orbitron',sans-serif;font-weight:900;font-size:15px;display:flex;align-items:center;justify-content:center}
.lbpod.p1 .lbpod-ava{width:42px;height:42px;font-size:18px}
.lbpod-nm{font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;color:var(--text);max-width:96px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbpod-exp{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#d97757}
.lbtonext{text-align:center;font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:600;color:#d97757;margin-bottom:8px}
.wkrow{display:flex;align-items:center;gap:11px;padding:9px 4px}
.wkic{font-size:22px;flex-shrink:0}
.wkbody{flex:1;min-width:0}
.wktop{display:flex;justify-content:space-between;font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--text2);margin-bottom:4px}
.wktop b{color:#d97757;font-family:'Orbitron',sans-serif;font-size:11px}
.wkrow.done .wktop b{color:#d97757}
.wkbar{height:7px;border-radius:4px;background:var(--card);overflow:hidden}
.wkbar div{height:100%;border-radius:4px;background: #d97757;transition:width .4s}
.wkrow.done .wkbar div{background: #d97757}
.lbrow{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;background:var(--card);border:1px solid var(--bd6);animation:lbin .3s ease-out both}
@keyframes lbin{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
.lbrow.me{border-color:#d9775766;background:rgba(217,119,87,.08)}
.lbrank{min-width:26px;text-align:center;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:var(--muted)}
.lbrank.top{font-size:17px}
.lbname{flex:1;min-width:0;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbrow.me .lbname{color:#d97757}
.lbexp{font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:#d97757;white-space:nowrap}
.lbexp small{font-size:9px;color:var(--muted)}
.lbempty{text-align:center;font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--muted);padding:14px}
.songcard-badge{display:inline-block;margin-left:7px;font-family:'Orbitron',sans-serif;font-size:8px;font-weight:700;letter-spacing:1px;color:var(--card2);background:var(--sc,#d97757);border-radius:5px;padding:2px 5px;vertical-align:middle}
/* B5: Warmup banner */
.warmup-banner{display:flex;align-items:center;gap:12px;margin:10px 14px 0;padding:14px 16px;background:rgba(217,119,87,.1);border:1px solid rgba(217,119,87,.3);border-radius:14px;animation:fadein .3s}
.warmup-banner-ic{font-size:26px;flex-shrink:0}
.warmup-banner-body{flex:1;min-width:0}
.warmup-banner-title{font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:var(--text)}
.warmup-banner-sub{font-size:11px;color:var(--muted);margin-top:2px}
.warmup-banner-btn{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;background:#d97757;color:#fff;border:none;border-radius:10px;padding:7px 14px;cursor:pointer;flex-shrink:0}
.warmup-banner-skip{font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;flex-shrink:0;padding:4px}
/* E4: Event countdown */
.event-countdown{display:flex;align-items:center;gap:10px;margin:10px 14px 0;padding:12px 16px;background:rgba(217,119,87,.08);border:1px solid rgba(217,119,87,.25);border-radius:14px;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:12px}
.event-ic{font-size:18px;flex-shrink:0}
.event-name{flex:1;color:var(--text);font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.event-days{color:#d97757;font-weight:700;flex-shrink:0}
.event-hint{font-size:11px;color:var(--muted);flex-shrink:0}
.event-set-btn{display:block;width:calc(100% - 28px);margin:10px 14px 0;padding:10px;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;color:var(--muted);background:transparent;border:1px dashed var(--bd2);border-radius:12px;cursor:pointer;text-align:center}
.event-set-btn:hover{border-color:var(--bd4);color:var(--text)}
/* D4: Chord Mood Board */
.chord-mood-panel{background:var(--card3);border-radius:12px;padding:14px;border:1px solid var(--bd1)}
.chord-mood-desc{font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.5}
.chord-mood-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.chord-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;background:var(--card2);border:1px solid var(--bd1);border-radius:10px;cursor:pointer;transition:all .2s;font-family:inherit}
.chord-btn:hover{border-color:#d97757;background:rgba(217,119,87,.08)}
.chord-btn.playing{border-color:#d97757;background:rgba(217,119,87,.15);transform:scale(1.06)}
.chord-btn-name{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:var(--text)}
.chord-btn-play{font-size:10px;color:#d97757}
/* Studio Max section */
.studio-max-hdr{display:flex;align-items:center;gap:8px;padding:18px 14px 6px;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;color:var(--muted);border-top:1px solid var(--bd2);margin-top:8px}
.studio-max-badge{font-family:'Orbitron',sans-serif;font-size:9px;font-weight:900;letter-spacing:1px;color:#fff;background:#d97757;border-radius:6px;padding:2px 7px}
.studio-max-unlock{margin-left:auto;font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;color:#d97757;background:rgba(217,119,87,.12);border:1px solid rgba(217,119,87,.4);border-radius:12px;padding:2px 10px;cursor:pointer}
.studio-max-card.locked{opacity:.7}
.studio-max-card.locked .songcard-go{color:#d97757}
.studio-max-card.active{background:rgba(217,119,87,.07)}
.max-lock-ico{position:absolute;bottom:-4px;right:-4px;font-size:11px;line-height:1}
/* AI voice tutor */
.vmstage{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:12px 16px 6px;flex-shrink:0}
.vmorb{position:relative;width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:36px;background:var(--card2);border:2px solid var(--bd4);transition:border-color .3s;cursor:pointer;padding:0;color:inherit;-webkit-tap-highlight-color:transparent}
.vmorb.listening{border-color:#d97757;animation:vmpulse 1.5s ease-out infinite}
.vmorb.thinking{border-color:#d97757;animation:vmspin 1.1s linear infinite}
.vmorb.speaking{border-color:#ff5252;box-shadow:0 0 30px -4px #ff5252;animation:vmwave .7s ease-in-out infinite alternate}
@keyframes vmpulse{0%{box-shadow:0 0 0 0 #d9775755}100%{box-shadow:0 0 0 30px #d9775700}}
@keyframes vmspin{to{transform:rotate(360deg)}}
@keyframes vmwave{from{transform:scale(1)}to{transform:scale(1.05)}}
.vmstate{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;color:var(--text2)}
.vmcaption{min-height:22px;font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:600;color:var(--text);text-align:center;max-width:92%}
.vmnotes{display:flex;gap:5px;flex-wrap:wrap;justify-content:center}
.vmnote{font-family:'Share Tech Mono',monospace;font-size:12px;color:#d97757;background:rgba(217,119,87,.1);border:1px solid #d9775744;border-radius:7px;padding:3px 8px}
.vminstant{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:900;animation:vminst .65s ease-out forwards;pointer-events:none}
.vminstant.ok{color:#d97757;text-shadow:0 0 18px #d97757}
.vminstant.bad{color:#ff5252;text-shadow:0 0 18px #ff5252}
@keyframes vminst{0%{transform:scale(.5);opacity:0}25%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:0}}
.vmstaff{width:100%;max-width:360px;background:var(--card2);border:1px solid var(--bd2);border-radius:12px;padding:6px 6px 2px;margin:2px auto 0}
.vmstaff .staffsvg{max-height:120px}
.vmtextrow{display:flex;gap:6px;width:100%;max-width:420px;margin:0 auto}
.vmtextin{flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid var(--bd5);border-radius:12px;padding:9px 13px;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:14px;outline:none}
.vmtextin:focus{border-color:#d97757aa}
.vmtextsend{flex-shrink:0;width:42px;border-radius:12px;border:1px solid #d97757aa;background: #d97757;color:#fff;font-size:15px;cursor:pointer}
.vmtextsend:active{transform:scale(.95)}
.vmlog{flex:1;min-height:118px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:10px 16px;width:100%;max-width:540px;margin:0 auto;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3);box-sizing:border-box}
.vmbub{max-width:84%;padding:9px 13px;border-radius:14px;font-family:'Rajdhani',sans-serif;font-size:14px;line-height:1.4}
.vmbub.user{align-self:flex-end;background: #d97757;color:var(--card2);font-weight:600}
.vmbub.ai{align-self:flex-start;background:var(--card);border:1px solid var(--bd1);color:var(--text)}
.vmfoot{position:relative;display:flex;flex-direction:column;align-items:center;gap:9px;padding:11px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--bd3);flex-shrink:0}
/* ── ⋯ voice-settings popover (speed / voice tone / HQ / chord-ear live in here) ── */
.vmmorewrap{position:absolute;right:10px;bottom:calc(100% + 10px);z-index:40}
.vmmore{width:44px;height:44px;border-radius:50%;background:var(--card3);border:1px solid #ffffff26;color:var(--text2);font-size:22px;font-weight:900;line-height:1;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}
.vmmore:active{transform:scale(.93)}
.vmmenu{position:absolute;bottom:52px;right:0;background:#130a10;border:1px solid #d9775755;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px;min-width:250px;box-shadow:0 10px 34px rgba(0,0,0,.55);animation:dropdown .18s ease-out}
.vmmenu .vmspeed{justify-content:flex-start}
.vmmenu .vmvoicetgl{align-self:flex-start;margin-bottom:0}
.vmbig{padding:14px 42px;border-radius:40px;font-family:'Orbitron',sans-serif;font-size:15px;font-weight:700;cursor:pointer;border:none;color:var(--card2);background: #d97757;box-shadow:0 8px 26px -8px #d97757}
.vmbig.stop{background: #ff5252;box-shadow:0 8px 26px -8px #ff5252}
.vmbig:active{transform:scale(.96)}
.vmvoicetgl{align-self:center;font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;color:var(--text2);background:rgba(255,255,255,.05);border:1px solid var(--bd4);border-radius:14px;padding:4px 12px;cursor:pointer;margin-bottom:2px}
.vmvoicetgl:active{transform:scale(.95)}
.vmvoicetgl.on{color:#0a1020;background: #d97757;border-color:transparent}
.vmspeed{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:center}
.vmspeed-lbl{font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;color:var(--muted);margin-right:2px}
.vmspeed-b{font-family:'Share Tech Mono',monospace;font-size:11px;font-weight:700;color:var(--text2);background:rgba(255,255,255,.05);border:1px solid var(--bd4);border-radius:10px;padding:4px 9px;cursor:pointer;transition:all .15s}
.vmspeed-b.on{color:#d97757;border-color:#d97757aa;background: rgba(217,119,87,.22);box-shadow:0 0 14px -6px #d97757}
.vmspeed-b:active{transform:scale(.93)}
/* octave shift on the on-screen keyboard */
.octctl{display:flex;align-items:center;gap:6px;margin-left:auto;margin-right:8px}
.octbtn{width:26px;height:26px;border-radius:7px;border:1px solid #d9775733;background:var(--card);color:var(--text2);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.octbtn:disabled{opacity:.3;cursor:default}
.octbtn:active:not(:disabled){background:var(--grad1)}
.octlbl{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);min-width:54px;text-align:center}
/* metronome quick pill in the header */
.metropill{display:flex;align-items:center;gap:3px;background: #d97757;color:var(--card2);border:none;border-radius:20px;padding:5px 11px;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;cursor:pointer;animation:metblink 1s steps(2) infinite}
@keyframes metblink{50%{opacity:.55}}
/* settings overlay */
.setov{position:fixed;inset:0;z-index:1300;background:rgba(9,4,8,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;animation:fadein .2s}
.setcard{width:100%;max-width:420px;max-height:88vh;overflow-y:auto;background:var(--card3);border:1px solid #d9775726;border-radius:18px;box-shadow:0 24px 60px -20px #000}
.sethdr{display:flex;align-items:center;justify-content:space-between;padding:15px 16px;border-bottom:1px solid var(--bd3);font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:var(--text);position:sticky;top:0;background:var(--card3);z-index:1}
.setbody{padding:14px 16px 18px}
.setrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0}
.setrow.col{flex-direction:column;align-items:stretch;gap:8px}
.setrow.setbtns{justify-content:center;gap:8px}
.setrow label{font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;color:var(--text2)}
.setrow input[type=range]{flex:1;max-width:200px;accent-color:#d97757}
.setdiv{height:1px;background:#ffffff0f;margin:6px 0}
.settoggle{min-width:64px;padding:7px 14px;border-radius:20px;border:1px solid var(--bd4);background:var(--card);color:var(--muted);font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;cursor:pointer}
.settoggle.on{background: #d97757;color:var(--card2);border-color:transparent}
.setbtn{min-width:48px;padding:9px 14px;border-radius:10px;border:1px solid #d977572e;background:var(--card);color:var(--text2);font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;cursor:pointer}
.setbtn.wide{flex:1}
.setbtn:active{transform:scale(.96)}
.setlangs{display:flex;gap:7px}
.setlangbtn{flex:1;padding:9px 6px;border-radius:10px;border:1px solid var(--bd2);background:var(--card);color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;cursor:pointer}
.setlangbtn.on{background: #d97757;color:var(--card2);border-color:transparent}
.setsub{font-family:'Rajdhani',sans-serif;font-size:11.5px;color:var(--muted);line-height:1.4}
.setver{text-align:center;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);margin-top:14px;letter-spacing:1px}
/* progress dashboard (profile) */
.heatcard{background:var(--card2);border:1px solid var(--bd1);border-radius:14px;padding:13px 14px}
.heatgrid{display:grid;grid-template-rows:repeat(7,1fr);grid-auto-flow:column;grid-auto-columns:1fr;gap:3px}
.heatcell{width:100%;aspect-ratio:1;border-radius:2px;min-width:0}
.heatlegend{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:8px;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted)}
.heatlegend i{width:10px;height:10px;border-radius:2px;display:inline-block}
.trendwrap{margin-top:12px;border-top:1px solid var(--bd6);padding-top:10px}
.trendlbl{font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--muted);margin-bottom:4px}
.trendlbl b{color:#d97757;font-size:13px}
.trendsvg{width:100%;height:38px;display:block}
.trendempty{margin-top:10px;text-align:center;font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--muted);padding:6px}
/* interactive progress dashboard */
.dashranges{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.dashrange{flex:1;min-width:48px;font-family:'Share Tech Mono',monospace;font-size:11px;font-weight:700;color:var(--text2);background:rgba(255,255,255,.05);border:1px solid var(--bd4);border-radius:9px;padding:7px 4px;cursor:pointer;transition:all .15s}
.dashrange.on{color:#d97757;border-color:#d97757aa;background: rgba(217,119,87,.22);box-shadow:0 0 14px -6px #d97757}
.dashrange:active{transform:scale(.95)}
.dashcards{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-bottom:13px}
.dashcard{background:var(--card2);border:1px solid var(--bd1);border-radius:12px;padding:11px 13px;position:relative}
.dashcard-v{font-family:'Orbitron',sans-serif;font-size:21px;font-weight:900;color:var(--text);line-height:1}
.dashcard-l{font-family:'Rajdhani',sans-serif;font-size:11px;color:var(--muted);margin-top:3px}
.dashcard-d{position:absolute;top:10px;right:11px;font-family:'Share Tech Mono',monospace;font-size:10px;font-weight:700}
.dashcard-d.up{color:#d97757}
.dashcard-d.down{color:#ff5252}
.dashchart{background:var(--card2);border:1px solid var(--bd1);border-radius:12px;padding:11px 13px;margin-bottom:11px}
.dashchart-h{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;color:var(--text2);margin-bottom:9px;display:flex;justify-content:space-between;align-items:center}
.dashtip{font-family:'Share Tech Mono',monospace;font-size:10px;color:#d97757}
.dashbars{display:flex;align-items:flex-end;gap:2px;height:78px}
.dashbar{flex:1;min-width:0;height:100%;display:flex;align-items:flex-end;background:none;border:none;padding:0;cursor:pointer}
.dashbar>span{display:block;width:100%;min-height:2px;border-radius:3px 3px 0 0;background: #d97757;transition:height .25s}
.dashbar.sel>span,.dashbar:active>span{background: #d97757;box-shadow:0 0 10px -2px #d97757}
.dashline{width:100%;height:46px;display:block}
.dashcards.three{grid-template-columns:repeat(3,1fr)}
.dashdetail{background:var(--card2);border:1px solid #d9775733;border-radius:12px;padding:11px 13px;margin-bottom:11px}
.dashdetail-h{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:800;color:#d97757;margin-bottom:7px}
.dashdetail-stats{display:flex;flex-wrap:wrap;gap:12px;font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--muted)}
.dashdetail-stats b{color:var(--text);font-size:14px}
.dashdetail-games{margin-top:9px;display:flex;flex-direction:column;gap:5px;border-top:1px solid var(--bd3);padding-top:8px}
.dashgame-row{display:flex;justify-content:space-between;align-items:center;font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--text2)}
.dashgame-row .dashgame-acc{font-family:'Share Tech Mono',monospace;color:#d97757;font-weight:700}
.dashgame-x{display:flex;gap:2px;margin-top:5px}
.dashgame-x span{flex:1;text-align:center;font-family:'Share Tech Mono',monospace;font-size:7.5px;color:var(--muted);overflow:hidden;white-space:nowrap}
/* accessibility & mobile ergonomics */
button,.pk,.songlane,.octbtn,.navbtn,a{touch-action:manipulation}
.octbtn{min-width:30px;min-height:30px}
.navbtn{color:var(--muted)}            /* lift inactive nav contrast */
.songsrcbar{color:var(--muted);font-size:11px}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
}
@media(max-width:480px){.lname{font-size:11px;letter-spacing:1px}.bbl{font-size:12px;padding:8px 11px}.pk.w{width:22px!important;height:66px!important}.pk.b{width:14px!important;height:42px!important;margin-left:-7px!important;margin-right:-7px!important}}
/* F5: Certificate banner */
.cert-banner{display:flex;align-items:center;gap:14px;margin:14px 14px 0;padding:18px 16px;background:linear-gradient(135deg,rgba(217,119,87,.15),rgba(217,119,87,.05));border:2px solid rgba(217,119,87,.4);border-radius:16px;animation:fadein .4s}
.cert-ic{font-size:36px;flex-shrink:0}
.cert-body{flex:1;min-width:0}
.cert-title{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text)}
.cert-sub{font-size:11px;color:#d97757;margin-top:2px;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px}
.cert-dl-btn{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;background:#d97757;color:#fff;border:none;border-radius:10px;padding:9px 14px;cursor:pointer;flex-shrink:0;white-space:nowrap}
.cert-dl-btn:hover{background:#c86846}
/* Shared modal overlay + box (used by StudioPage quick/mood/event/chord modals) */
.modal-ov{position:fixed;inset:0;z-index:1350;background:rgba(9,4,8,.78);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;animation:fadein .2s}
.modal-box{width:100%;max-width:380px;max-height:88vh;overflow-y:auto;background:var(--card3);border:1px solid #d9775726;border-radius:18px;box-shadow:0 24px 60px -20px #000;padding:18px}
.modal-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:var(--text)}
.modal-x{font-size:15px;color:var(--muted);background:none;border:none;cursor:pointer;padding:2px 6px;line-height:1}
/* Filter chip (mood/time picker) */
.filter-chip{padding:7px 14px;border-radius:20px;border:1px solid var(--bd2);background:var(--card);color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s}
.filter-chip.on{background:#d97757;color:#fff;border-color:transparent}
/* B2: Note Weakness Heatmap */
.noteheat-card{padding:16px;background:var(--card2);border-radius:14px;border:1px solid var(--bd2)}
.noteheat-sub{font-size:12px;color:var(--muted);margin-bottom:14px}
.noteheat-keys{position:relative;height:78px;user-select:none}
.noteheat-white-row{display:flex;gap:3px;height:78px;align-items:stretch}
.noteheat-white{flex:1;border-radius:4px;border:1px solid var(--bd4);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:4px;cursor:default;min-width:0;transition:background .3s}
.noteheat-pc{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);font-weight:700}
.noteheat-n{font-family:'Orbitron',sans-serif;font-size:8px;color:#d97757;font-weight:700}
.noteheat-black-row{position:absolute;top:0;left:0;right:0;height:48px;pointer-events:none}
.noteheat-black{position:absolute;width:calc(100%/9);height:100%;border-radius:3px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;transform:translateX(-50%);transition:background .3s}
.noteheat-bpc{font-family:'Share Tech Mono',monospace;font-size:7px;color:#fff8;font-weight:700;line-height:1}
.noteheat-gap{display:inline-block}
/* B1: SRS list */
.srs-list{display:flex;flex-direction:column;gap:8px}
.srs-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--card2);border-radius:10px;border:1px solid var(--bd2)}
.srs-ic{font-size:16px}
.srs-label{flex:1;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;color:var(--text)}
.srs-count{font-family:'Orbitron',sans-serif;font-size:10px;color:var(--muted)}
/* A2: Goal Planner */
.goal-song-name{font-family:'Rajdhani',sans-serif;font-size:20px;font-weight:700;color:#d97757;margin-bottom:4px}
.goal-days-left{font-family:'Orbitron',sans-serif;font-size:13px;color:var(--muted);margin-bottom:16px}
.goal-plan-list{display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto}
.goal-plan-step{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--card2);border-radius:10px;border:1px solid var(--bd2)}
.goal-step-num{font-family:'Orbitron',sans-serif;font-size:9px;color:#d97757;font-weight:700;white-space:nowrap;padding-top:1px}
.goal-step-txt{font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--text);line-height:1.4}
/* F3: Thai Music Corner */
.thai-cards{display:flex;flex-direction:column;gap:12px}
.thai-card{padding:14px;background:var(--card2);border-radius:12px;border:1px solid var(--bd2)}
.thai-card-h{font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;color:#d97757;margin-bottom:8px}
.thai-card-b{font-size:13px;color:var(--text);line-height:1.55;margin-bottom:10px}
.thai-play-btn{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;background:rgba(217,119,87,.15);color:#d97757;border:1px solid rgba(217,119,87,.4);border-radius:16px;padding:6px 14px;cursor:pointer}
.thai-play-btn:hover{background:rgba(217,119,87,.25)}
`;

export function useInjectCSS() {
  const [ready, setReady] = useState(typeof document !== "undefined" && !!document.getElementById("tg-css"));
  useEffect(() => {
    if (document.getElementById("tg-css")) { setReady(true); return; }
    const s = document.createElement("style");
    s.id = "tg-css";
    s.textContent = CSS;
    document.head.appendChild(s);
    setReady(true);
  }, []);
  return ready;
}
