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
/* Mobile viewport height: 100vh is the LARGE viewport (behind the browser's
   URL bar) on phones, so an app shell sized with it is taller than the visible
   screen — the bottom bar gets pushed off / pages feel "too long". 100dvh is
   the dynamic viewport height (shrinks/grows with the URL bar); the vh line
   stays first as the fallback for browsers without dvh (all modern ones have
   it: iOS 15.4+, Chrome 108+, Android WebView 108+). */
.tg{font-family:'Rajdhani',sans-serif;background:var(--bg);color:var(--text2);height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden;position:relative}
.tg>*{position:relative;z-index:1}

/* ── Mobile safe-area overrides (kept near the top of the file so the
   viewport-height + notch/home-indicator handling lives in one place).
   These are ADDITIVE declarations — none of the base rules below define
   padding-top/padding-bottom for these selectors, so nothing is duplicated.
   The .tg prefix raises specificity above the base rules defined later in
   the file (which would otherwise win by source order); every overlay/dialog
   below renders inside the .tg app root, so the prefix always matches. */
.tg .practicehdr,.tg .songhdr{padding-top:calc(12px + env(safe-area-inset-top,0px))}
.tg .modal-ov,.tg .setov{padding-top:calc(18px + env(safe-area-inset-top,0px));padding-bottom:calc(18px + env(safe-area-inset-bottom,0px))}
.tg .chestov{padding-top:calc(20px + env(safe-area-inset-top,0px));padding-bottom:calc(20px + env(safe-area-inset-bottom,0px))}
.tg .permprimer-overlay{padding-top:calc(24px + env(safe-area-inset-top,0px));padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))}
.tg .modal-box,.tg .setcard{max-height:calc(100dvh - 40px)}
/* keyboard-only focus ring (WCAG 2.4.7) — visible outline without affecting mouse users */
.tg :focus-visible{outline:2px solid #d97757;outline-offset:2px;border-radius:6px}
.tg button:focus-visible,.tg textarea:focus-visible{outline:2px solid #d97757;outline-offset:2px}
.scan{position:fixed;inset:0;pointer-events:none;z-index:9999}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top,0px));background:var(--card);border-bottom:1px solid #d9775733;flex-shrink:0;position:relative;z-index:30}
.logo{display:flex;align-items:center;gap:10px}
/* hamburger + side drawer nav (minimal modern) */
.hamb{display:flex;flex-direction:column;justify-content:center;gap:4px;width:36px;height:36px;border:none;background:transparent;cursor:pointer;padding:7px;border-radius:10px;flex-shrink:0}
.hamb span{display:block;height:2.5px;width:100%;background:#d97757;border-radius:2px}
.hamb:active{background:var(--bd1)}
.drawer-scrim{position:fixed;inset:0;z-index:1450;background:rgba(4,4,12,.62);backdrop-filter:blur(3px);animation:fadein .2s}
.drawer{position:fixed;top:0;left:0;bottom:0;width:82%;max-width:300px;z-index:1460;background:var(--card);border-right:1px solid #d9775733;box-shadow:8px 0 44px -10px #000;transform:translateX(-105%);transition:transform .26s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;padding:calc(18px + env(safe-area-inset-top,0px)) 14px calc(18px + env(safe-area-inset-bottom,0px));overflow-y:auto}
.drawer.open{transform:translateX(0)}
.drawer-brand{display:flex;align-items:center;gap:10px;padding:4px 8px 16px;border-bottom:1px solid var(--bd1);margin-bottom:12px}
.drawer-brand .lbox{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:11px;border:1.5px solid #d97757;color:#d97757;font-family:'Orbitron',sans-serif;font-weight:900;font-size:15px}
.draweritem{display:flex;align-items:center;gap:14px;width:100%;padding:14px;border:none;background:transparent;border-radius:14px;cursor:pointer;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:600;text-align:left;position:relative;margin-bottom:4px}
.draweritem:active{transform:scale(.98)}
.draweritem.on{background:var(--bd1)}
.draweritem.on .drawerlabel{color:#d97757}
.drawericon{font-size:22px;width:28px;text-align:center;color:var(--nav-c,#d97757);flex-shrink:0}
/* drawn glyphs (the android on the profile row) centre in the same 28px slot */
.drawericon svg{display:inline-block;vertical-align:-4px}
.drawerlabel{flex:1}
.drawerdot{width:8px;height:8px;border-radius:50%;background:var(--nav-c,#d97757);box-shadow:0 0 10px var(--nav-c,#d97757)}
.drawer-foot{margin-top:auto;border-top:1px solid var(--bd1);padding-top:10px}
.draweritem.sub{font-size:14px;color:var(--muted);padding:11px 14px;margin-bottom:0}
.draweritem.sub .drawericon{font-size:18px;color:var(--muted)}
.lbox{width:auto;min-width:38px;height:38px;padding:0 3px;white-space:nowrap;border:1.5px solid #d97757;border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:12px;color:#d97757;font-weight:900}
.lname{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:#d97757;text-shadow:0 0 8px #d97757;letter-spacing:2px}
.lsub{font-size:8px;color:var(--muted);letter-spacing:3px;font-family:'Share Tech Mono',monospace}
.hdr-r{display:flex;align-items:center;gap:8px}
.dot{width:8px;height:8px;border-radius:50%;background:#d97757;box-shadow:0 0 8px #d97757;animation:blink 1.5s infinite}
/* flag dropdown */
.flagwrap{position:relative}
.flagbtn{display:flex;align-items:center;gap:4px;background:none;border:1px solid #d9775744;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:16px;line-height:1;transition:all .2s}
.flagbtn:hover{border-color:#d97757;box-shadow:0 0 8px #d9775744;background:rgba(217,119,87,.08)}
.flagbtn .caret{font-size:8px;color:#d97757;font-family:'Share Tech Mono',monospace}
.flagmenu{position:absolute;top:calc(100% + 6px);right:0;background:var(--card);border:1px solid #d9775755;border-radius:6px;box-shadow:0 4px 20px rgba(217,119,87,.2);overflow:hidden;z-index:50;min-width:120px;animation:dropdown .18s ease-out}
.flagitem{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;font-size:15px;transition:all .15s;border:none;background:none;width:100%;color:var(--text2);font-family:'Rajdhani',sans-serif}
.flagitem .fn{font-size:12px;letter-spacing:.5px}
.flagitem:hover{background:rgba(217,119,87,.1)}
.flagitem.active{background:rgba(148,60,100,.18)}
.flagitem.active .fn{color:#d97757}
/* piano */
.pw{background:var(--card3);border-bottom:1px solid #d9775733;padding:10px 8px 4px;flex-shrink:0}
.plbl{font-family:'Orbitron',sans-serif;font-size:8px;color:var(--muted);letter-spacing:3px;text-align:center;margin-bottom:7px}
.kr{display:flex;position:relative;width:100%;max-width:1100px;margin:0 auto;gap:1px;padding:0 4px 20px}
.pk{cursor:pointer;border-radius:0 0 4px 4px;transition:all .08s;position:relative;user-select:none}
.pk.w{flex:1 1 0;min-width:0;height:78px;background:#fff;border:1px solid #d4cfc5;z-index:1;box-shadow:0 4px 8px rgba(0,0,0,.5)}
.pk.b{position:absolute;top:0;height:48px;background:#060d1a;border:1px solid #001015;z-index:2;box-shadow:0 4px 12px rgba(0,0,0,.9)}
.pk.w.lit{background:#d97757;box-shadow:0 0 16px #d97757,0 0 40px #d9775766}
.pk.b.lit{background:#d97757;box-shadow:0 0 14px #d97757,0 0 30px #d9775766}
.pk.w:active{transform:translateY(2px)}
.pk.b:active{transform:translateY(1px)}
.pk.flash{animation:keypop .32s ease-out}
.pk.w.pressed{transform:translateY(2px);filter:brightness(.94)}
.pk.b.pressed{transform:translateY(1px);filter:brightness(1.3)}
.kr-sm .pk.w{height:66px}
.kr-sm .pk.b{height:42px}
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
/* Knowledge Quest conversation starters — a compact, horizontally-scrolling
   row of tappable case-study picks, sitting between the message list and the
   input so it reads as "try one of these next" rather than a permanent
   fixture. Re-themed with the same purple identity as Boss Challenge/pboss:
   both are TIGA's "go deeper, optional" tracks, distinct from the orange
   core-lesson flow. */
.chatstarters{display:flex;gap:7px;align-items:center;overflow-x:auto;padding:8px 12px;background:var(--card3);border-top:1px solid #d9775722;scrollbar-width:none}
.chatstarters::-webkit-scrollbar{display:none}
.chatstarters-hint{font-family:'Share Tech Mono',monospace;font-size:9px;color:#a78bfa;letter-spacing:.5px;flex-shrink:0}
.starterchip{display:flex;align-items:center;gap:5px;flex-shrink:0;background:rgba(167,139,250,.1);border:1px solid #a78bfa44;border-radius:20px;padding:6px 12px 6px 8px;cursor:pointer;max-width:220px}
.starterchip-ic{font-size:14px;flex-shrink:0}
.starterchip-tx{font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:600;color:#c4b5fd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iw{padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));background:var(--card3);border-top:1px solid #d9775733;flex-shrink:0}
.ir{display:flex;gap:8px;align-items:flex-end}
.tin{flex:1;background:var(--card3);border:1px solid #d9775733;border-radius:6px;padding:10px 14px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:14px;resize:none;min-height:44px;max-height:110px;outline:none;transition:border-color .2s}
.tin:focus{border-color:#d97757;box-shadow:0 0 0 1px rgba(217,119,87,.15)}
.tin::placeholder{color:var(--muted)}
.snd{width:44px;height:44px;border:none;border-radius:6px;background: #d97757;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all .2s;flex-shrink:0;color:#fff}
.snd:hover{transform:scale(1.06);box-shadow:0 0 18px #d97757}
.snd:disabled{opacity:.35;cursor:not-allowed;transform:none}
.hint{font-size:9px;color:var(--muted);text-align:center;margin-top:5px;font-family:'Share Tech Mono',monospace}
/* A full-screen panel, not a scrim — it must follow the theme. It used to hardcode
   a near-black, which left the expanded chat dark while the app was in light mode. */
.mov{display:none;position:fixed;inset:0;background:var(--bg);z-index:1000;flex-direction:column}
.mov.open{display:flex}
.mhdr{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top,0px));border-bottom:1px solid #d9775733;background:var(--card3);flex-shrink:0}
.mhdr-l{display:flex;align-items:center;gap:10px;min-width:0}
.mlbl{font-family:'Orbitron',sans-serif;font-size:10px;color:#d97757;letter-spacing:1.5px;display:flex;align-items:center;gap:7px}
.cbtn{background:none;border:1px solid #ff5252;border-radius:4px;padding:5px 14px;cursor:pointer;color:#ff5252;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;transition:all .2s}
.cbtn:hover{background:rgba(255,82,82,.1);box-shadow:0 0 10px #ff5252}
.mpw{padding:8px 8px 14px;background:var(--card3);border-bottom:1px solid #d9775733;flex-shrink:0}
.mmsgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.mmsgs::-webkit-scrollbar{width:3px}
.mmsgs::-webkit-scrollbar-thumb{background:#d97757;border-radius:2px}
.miw{padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));background:var(--card3);border-top:1px solid #d9775733;flex-shrink:0}
@keyframes pulse{0%,100%{box-shadow:0 0 10px #d97757,0 0 25px #d9775744}50%{box-shadow:0 0 20px #d97757,0 0 50px #d9775766}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
@keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes dropdown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@keyframes pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.18)}100%{transform:scale(1);opacity:1}}
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
.vidwrap{flex:1;display:flex;flex-direction:column;min-height:0;background:#000}
.vidcatbar{display:flex;gap:8px;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));overflow-x:auto;scrollbar-width:none;background:#000;flex-shrink:0;-webkit-overflow-scrolling:touch}
.vidcatbar::-webkit-scrollbar{display:none}
.vidcat{flex:0 0 auto;padding:6px 14px;border-radius:20px;border:1.5px solid rgba(255,255,255,.25);background:transparent;color:rgba(255,255,255,.7);font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,color .15s}
.vidcat.on{background:#fff;border-color:#fff;color:#000}
/* The videos page hides the app header for a truly full-screen feed, so the
   slides would otherwise start under the notch / end under the home indicator
   on iOS (viewport-fit=cover) and Android edge-to-edge — the in-iframe player
   controls (mute/CC/settings) then sit under the status bar and can't be
   tapped. Each slide carries its own safe-area padding (border-box, so the
   slide still fills the viewport exactly and scroll-snap stays pixel-tight):
   the black slide background shows through the padding as the notch / home-
   indicator band, and the video plays only inside the safe area. */
.vidfeed{flex:1;overflow-y:auto;scroll-snap-type:y mandatory;background:#000;scrollbar-width:none}
.vidfeed::-webkit-scrollbar{display:none}
.vidslide{height:100%;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);scroll-snap-align:start;scroll-snap-stop:always;position:relative;display:flex;align-items:center;justify-content:center;background:#000}
.vidplayer{width:100%;height:100%;object-fit:cover;background:#000;border:none}
@media (min-aspect-ratio:3/4){video.vidplayer{object-fit:contain}}
.vidplaceholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;opacity:.25}
.vidopen{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;padding:32px;text-align:center;background:linear-gradient(135deg,#1a1a2e,#16213e)}
.vidopen-ic{font-size:64px}
.vidopen-t{font-size:17px;font-weight:700;color:#fff;max-width:300px}
.vidopen-h{font-size:13px;color:rgba(255,255,255,.55)}
.vidmute{position:absolute;right:12px;top:calc(14px + env(safe-area-inset-top,0px));z-index:6;background:rgba(18,8,14,.55);border:1px solid #ffffff2a;border-radius:50%;width:42px;height:42px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}
.vidpause{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:64px;color:#ffffffd6;pointer-events:none;text-shadow:0 2px 18px #000}
.vidbar{position:absolute;left:0;right:0;bottom:env(safe-area-inset-bottom,0px);height:3px;background:var(--bd5);z-index:7}
.vidbar span{display:block;height:100%;width:0;background: #d97757}
/* ── TikTok chrome: top fade, right action rail (like / ask / save), floating hearts ── */
/* the watch reward, shown as it accrues — a coin you cannot see coming is a
   coin nobody knows they are earning */
.vidcoin{position:absolute;left:50%;transform:translateX(-50%);bottom:96px;z-index:6;pointer-events:none;
  min-width:132px;padding:6px 14px;border-radius:999px;overflow:hidden;
  background:rgba(6,10,20,.78);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);
  border:1px solid #ffffff2e;box-shadow:0 8px 22px -10px #000}
.vidcoin i{position:absolute;inset:0;right:auto;display:block;background:linear-gradient(90deg,#d97757,#ffd24d);opacity:.42;transition:width 1s linear}
.vidcoin b{position:relative;display:block;text-align:center;font-family:'Share Tech Mono',monospace;font-size:11.5px;letter-spacing:.06em;color:#fff;text-shadow:0 1px 3px #000}
.vidcoin.done{font-family:'Share Tech Mono',monospace;font-size:11.5px;letter-spacing:.06em;color:#ffd24d;text-align:center;
  border-color:#ffd24d66;box-shadow:0 0 18px -4px #ffd24d55}
.vidtopfade{position:absolute;top:0;left:0;right:0;height:calc(64px + env(safe-area-inset-top,0px));background:linear-gradient(rgba(0,0,0,.42),transparent);pointer-events:none;z-index:3}
/* the app header hides on the video feed — this translucent ☰ keeps navigation reachable */
.vidfab{position:fixed;top:calc(64px + env(safe-area-inset-top,0px));left:10px;z-index:60;width:42px;height:42px;border-radius:50%;background:rgba(18,8,14,.55);border:1px solid #ffffff2a;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;cursor:pointer;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(4px)}
.vidfab span{display:block;width:17px;height:2px;background:#fff;border-radius:2px}
.vidfab:active{transform:scale(.92)}
.vidrail{position:absolute;right:8px;bottom:38%;display:flex;flex-direction:column;align-items:center;gap:15px;z-index:8}
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
.pathhero{position:relative;text-align:center;padding:10px 16px 8px;margin-bottom:4px;overflow:hidden;border-bottom:1px solid #d977571f}
.pathhero-glow{position:absolute;top:-60%;left:50%;transform:translateX(-50%);width:280px;height:280px;pointer-events:none}
.pathbadge{position:relative;display:inline-block;font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:3px;color:#d97757;border:1px solid #d9775744;border-radius:20px;padding:4px 15px;margin-bottom:12px;background:rgba(217,119,87,.05)}
.pathh1{position:relative;font-family:'Orbitron',sans-serif;font-size:19px;font-weight:900;color:var(--text);text-shadow:0 0 16px #d9775777;letter-spacing:1px;margin-bottom:13px}
.pathguide{position:relative;font-size:12px;color:var(--text2);line-height:1.65;background: rgba(217,119,87,.07);border:1px solid #d9775722;border-radius:10px;padding:11px 14px;font-family:'Rajdhani',sans-serif;max-width:430px;margin:0 auto}
.pgroup{padding:0 14px;margin-bottom:10px}
/* world-map re-skin: each topic group reads as an "island" zone, connected to
   the next by a short trail — same cards/grid/unlock logic underneath, purely
   presentational (see PathwayPage) */
.pgroup.pisland{position:relative;border-radius:18px;padding-top:8px;padding-bottom:10px;border:1px dashed var(--gc,#d97757)}
.pgroup.pisland::before{content:'';position:absolute;inset:0;background:var(--gc,#d97757);opacity:.06;border-radius:17px;pointer-events:none;z-index:0}
.pgroup.pisland>*{position:relative;z-index:1}
.ptrail{display:flex;flex-direction:column;align-items:center;height:16px}
.ptrail-line{width:3px;flex:1;border-radius:2px;opacity:.55}
.ptrail-node{width:26px;height:26px;border-radius:50%;background:var(--card2);border:2px solid var(--bd4);display:flex;align-items:center;justify-content:center;font-size:13px;margin-top:-3px;box-shadow:0 2px 8px -2px #000;flex-shrink:0}
.pgrouphdr{display:flex;align-items:center;gap:11px;margin-bottom:8px}
.pgbar{width:4px;height:34px;border-radius:3px;flex-shrink:0;box-shadow:0 0 10px currentColor}
.pgicon{font-size:21px;line-height:1;flex-shrink:0}
.pginfo{flex:1;min-width:0}
.pglabel{font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:var(--text);letter-spacing:2px;line-height:1.2}
.pgdesc{font-size:11px;color:var(--muted);font-family:'Rajdhani',sans-serif;margin-top:2px}
.pgstep{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:1px;flex-shrink:0}
.pgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
/* row-to-row trail inside a group — was previously only between the 4 group
   islands (.ptrail below), leaving every individual stage disconnected */
.pnode-connector{display:flex;align-items:center;justify-content:center;padding:2px 0;margin:-2px 0}
.pnode-connector-line{width:100%;max-width:120px;height:3px;border-radius:2px;background:var(--bd4);opacity:.5}
.pnode-connector-line.half{background:linear-gradient(90deg,var(--nc,#d97757),var(--bd4) 60%);opacity:.85}
.pnode-connector-line.done{background:var(--nc,#d97757);opacity:.9;box-shadow:0 0 8px -2px var(--nc,#d97757)}
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
.readbest{margin-left:8px;font-size:11px;font-weight:600;color:var(--muted);font-family:'Share Tech Mono',monospace}
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
.pcard{position:relative;display:flex;flex-direction:column;text-align:left;background:var(--card2);border:1px solid var(--bd1);border-top:2px solid var(--ac,#d97757);border-radius:13px;padding:13px;cursor:pointer;transition:transform .2s,box-shadow .2s,border-color .2s;overflow:hidden;font-family:'Rajdhani',sans-serif;color:var(--text2);min-height:130px;width:100%}
.pcardglow{position:absolute;top:-30px;right:-30px;width:90px;height:90px;border-radius:50%;pointer-events:none}
.pcard.done{border-color:#d9775755}
.pcard.tier-bronze{border-color:#cd7f3277}
.pcard.tier-silver{border-color:#c7d0daaa}
.pcard.tier-gold{border-color:#ffd23faa;box-shadow:0 0 18px -8px #ffd23f99}
.pcarddone{position:absolute;top:9px;right:9px;width:22px;height:22px;border-radius:50%;background:#d97757;color:var(--card2);font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px -2px #d97757;z-index:3}
.pcard.tier-bronze .pcarddone{background:#cd7f32;box-shadow:0 0 12px -2px #cd7f32}
.pcard.tier-silver .pcarddone{background:#a9b4c2;box-shadow:0 0 12px -2px #a9b4c2}
.pcard.tier-gold .pcarddone{background:#ffd23f;box-shadow:0 0 12px -2px #ffd23f}
.pcard.current{box-shadow:0 0 0 1px var(--ac,#d97757),0 0 22px -6px var(--ac,#d97757);animation:currentpulse 1.8s ease-in-out infinite}
@keyframes currentpulse{0%,100%{box-shadow:0 0 0 1px var(--ac,#d97757),0 0 18px -8px var(--ac,#d97757)}50%{box-shadow:0 0 0 1px var(--ac,#d97757),0 0 26px -2px var(--ac,#d97757)}}
.pcardhere{position:absolute;top:9px;right:9px;font-family:'Orbitron',sans-serif;font-size:8px;font-weight:800;letter-spacing:.5px;color:var(--card2);background:var(--ac,#d97757);border-radius:6px;padding:3px 6px;z-index:3;animation:flamepulse 1s ease-in-out infinite alternate}
.pcard:hover{border-color:var(--ac,#d97757);transform:translateY(-3px);box-shadow:0 10px 26px -10px var(--ac,#d97757)}
.pcard:hover .pcardglow{opacity:.22}
.pcard:active{transform:translateY(-1px) scale(.98)}
.pcardlevel{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:900;letter-spacing:1px;color:var(--ac,#d97757);opacity:.95;margin-bottom:7px}
.pcardicon{font-size:30px;line-height:1;margin-bottom:9px}
.pcardtitle{font-family:'Orbitron',sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.2px;color:var(--text);margin-bottom:4px;line-height:1.3}
.pcardsub{font-size:10.5px;color:var(--muted);line-height:1.4;flex:1;margin-bottom:10px}
.pcardkeys{display:inline-block;align-self:flex-start;font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:700;color:#d97757;background:rgba(217,119,87,.12);border:1px solid #d9775744;border-radius:7px;padding:2px 7px;margin-bottom:8px}
.pcardgo{display:flex;align-items:center;justify-content:space-between;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px;color:var(--ac,#d97757);border-top:1px solid var(--bd3);padding-top:9px}
.pcardarrow{font-size:14px;transition:transform .2s}
.pcard:hover .pcardarrow{transform:translateX(4px)}
.pathfoot{text-align:center;font-size:10px;color:var(--muted);font-family:'Share Tech Mono',monospace;letter-spacing:1px;margin:10px 14px 0;padding-top:14px;line-height:1.6;border-top:1px solid #d977571a}
/* ── inline key picker panel (spans full grid row) ── */
.pcard.active{border-color:var(--ac,#d97757);box-shadow:0 0 24px -8px var(--ac,#d97757);transform:translateY(-2px)}
.keypanel{background:var(--card2);border:1px solid var(--ac,#d97757);border-radius:14px;padding:14px 13px;margin-top:10px;position:relative;overflow:hidden;animation:keyexpand .3s cubic-bezier(.2,.9,.3,1)}
.keypanel::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background: var(--ac,#d97757);opacity:.6}
@keyframes keyexpand{from{opacity:0;transform:translateY(-8px) scaleY(.9)}to{opacity:1;transform:translateY(0) scaleY(1)}}
.keypanel-head{display:flex;align-items:center;gap:9px;margin-bottom:13px;padding-bottom:10px;border-bottom:1px solid var(--bd3)}
.keypanel-icon{font-size:18px;line-height:1}
.keypanel-title{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:var(--text);letter-spacing:.3px;flex:1;min-width:0}
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
.admintabs{display:flex;gap:8px;padding:10px 14px 4px;flex-shrink:0;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.admintabs::-webkit-scrollbar{display:none}
.admintab{flex:0 0 auto;padding:9px 12px;border-radius:10px;background:var(--card3);border:1px solid #ff525233;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap}
.admintab.on{background: #ff5252;color:#fff;border-color:transparent}
/* ── admin nav: single button → business-category dropdown ── */
.adminnav{position:relative;padding:10px 14px 6px;flex-shrink:0;background:var(--bg)}
.adminnav-btn{display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;border-radius:12px;background:var(--card3);border:1px solid #ff525233;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;-webkit-tap-highlight-color:transparent}
.adminnav-btn:hover{border-color:#ff525266}
.adminnav-btn:active{transform:scale(.99)}
.adminnav-burger{font-size:15px;color:#ff5252}
.adminnav-cur{flex:1;text-align:left;display:flex;align-items:center;gap:8px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adminnav-caret{font-size:9px;color:#ff5252;font-family:'Share Tech Mono',monospace}
.adminnav-scrim{position:fixed;inset:0;z-index:40;background:transparent}
.adminnav-pop{position:absolute;left:14px;right:14px;top:calc(100% + 6px);z-index:50;background:var(--card);border:1px solid #ff525233;border-radius:14px;box-shadow:0 18px 44px -12px rgba(0,0,0,.35);padding:10px;max-height:72dvh;overflow-y:auto;animation:dropdown .18s ease-out}
.adminnav-group{margin-bottom:10px}
.adminnav-group:last-child{margin-bottom:2px}
.adminnav-gh{font-family:'Orbitron',sans-serif;font-size:9px;font-weight:800;letter-spacing:1.2px;color:#d97757;padding:4px 8px 6px;border-bottom:1px solid var(--bd2);margin-bottom:6px}
.adminnav-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:6px}
.adminnav-item{display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:10px;background:var(--card3);border:1px solid transparent;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer;text-align:left;transition:all .15s}
.adminnav-item:hover{border-color:#ff525255}
.adminnav-item.on{background:rgba(255,82,82,.14);border-color:#ff525255;color:#d97757}
.adminnav-ic{font-size:15px;flex-shrink:0}
.adminnav-lb{flex:1}
.adminnav-dot{width:6px;height:6px;border-radius:50%;background:#ff5252;box-shadow:0 0 8px #ff5252}
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
.admsum{background:var(--card3);border:1px solid #d9775733;border-radius:13px;padding:11px 13px}
.admsum-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #ffffff0d;font-size:12.5px}
.admsum-row:last-of-type{border-bottom:none}
.admsum-ic{width:22px;text-align:center;flex-shrink:0;font-size:15px}
.admsum-name{flex:1;min-width:0;color:var(--text2);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admsum-m{color:#d97757;font-weight:700;white-space:nowrap;font-size:12px}
.admsum-def{flex-shrink:0;font-size:10px;opacity:.55;border:1px solid #ffffff22;border-radius:8px;padding:1px 6px}
.admmg-sel{flex:1;background:var(--card3);border:1px solid var(--bd4);border-radius:9px;padding:9px 10px;color:var(--text2);font-size:14px}
.admmg-days{width:64px;background:var(--card3);border:1px solid var(--bd4);border-radius:9px;padding:9px;color:var(--text2);font-size:14px;text-align:center}
.admmg-d{color:var(--muted);font-size:13px}
.admmg-row2{display:flex;gap:8px;margin-top:8px}
.admmg-row2 .songbtn{flex:1;padding:10px}
.schoolhdr{display:flex;align-items:center;gap:10px;margin-bottom:2px}
.schoolseat{font-size:12px;color:var(--muted);margin:4px 0 8px}
.schoolcode{background:var(--card3);border:1px solid #ff525233;border-radius:10px;padding:14px 12px;font-family:'Share Tech Mono',monospace;font-size:22px;letter-spacing:3px;text-align:center;color:#d97757}
.schoolrole-badge{display:inline-block;background:#d97757;color:#fff;font-size:9px;font-family:'Orbitron',sans-serif;padding:2px 6px;border-radius:6px;vertical-align:middle;margin-left:6px}
.banscreen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;gap:12px}
.adminchips{display:flex;flex-wrap:wrap;gap:7px;padding:10px 14px 4px;flex-shrink:0}
.adminchip{background:rgba(255,82,82,.08);border:1px solid #ff525233;border-radius:16px;padding:7px 13px;cursor:pointer;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:600;transition:all .2s;text-align:left}
.adminchip:hover{border-color:#ff5252;background:rgba(255,82,82,.16);box-shadow:0 0 10px #ff525233;transform:translateY(-1px)}
.adminchip:active{transform:translateY(0) scale(.97)}
.adminmiw{background:var(--card3);border-top:1px solid #ff525233}
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
.loginhero{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 22px 2px;text-align:center;flex-shrink:0}
.login-features{display:flex;gap:8px;padding:10px 14px 4px;overflow-x:auto;scrollbar-width:none;flex-shrink:0;width:100%;box-sizing:border-box}
.login-features::-webkit-scrollbar{display:none}
.login-feat{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:3px;background:var(--card2);border:1px solid var(--bd2);border-radius:12px;padding:9px 12px;min-width:76px}
.login-feat-ic{font-size:20px;line-height:1}
.login-feat-t{font-size:9.5px;font-weight:700;color:var(--text);text-align:center;line-height:1.3;font-family:'Rajdhani',sans-serif;letter-spacing:.3px}
.login-feat-s{font-size:8.5px;color:var(--muted);text-align:center;font-family:'Share Tech Mono',monospace}
.loginpiano{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:4px 0}
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
.exptoast{position:fixed;top:calc(64px + env(safe-area-inset-top,0px));left:50%;z-index:1200;display:flex;align-items:center;gap:8px;background: #d97757;color:#04121a;font-family:'Orbitron',sans-serif;font-size:14px;font-weight:900;letter-spacing:1px;padding:9px 18px;border-radius:22px;box-shadow:0 8px 26px -6px #d97757,inset 0 0 0 1px var(--bd5);animation:exppop 2.2s ease-out forwards;pointer-events:none}
/* one-time "add to home screen" banner, shown after the first real win */
.installbanner{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:1300;display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid #d9775755;border-radius:16px;padding:11px 12px;box-shadow:0 10px 30px -8px #000,0 0 20px -8px #d9775766;animation:installin .3s ease-out}
@keyframes installin{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
.installbanner-ic{font-size:26px;flex-shrink:0}
.installbanner-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.installbanner-tx b{font-size:13px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-weight:700;line-height:1.25}
.installbanner-tx span{font-size:11px;color:var(--muted);line-height:1.2}
.installbanner-go{flex-shrink:0;background: #d97757;color:#fff;border:none;border-radius:11px;padding:9px 14px;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;cursor:pointer;white-space:nowrap}
.installbanner-x{flex-shrink:0;background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:4px 2px}
/* persistent bottom-left "get the app" pill — stays reachable after the
   one-time banner above is dismissed. Bottom-right is the mascot, top-left
   is the nav hamburger, so bottom-left is the open corner. */
.apkpill{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:950;width:50px;height:50px;border-radius:50%;border:none;background:linear-gradient(135deg,#d97757,#a855f7);box-shadow:0 8px 24px -6px #d9775766,0 0 0 1px #ffffff22 inset;display:flex;align-items:center;justify-content:center;cursor:pointer;animation:apkpillpop .4s cubic-bezier(.34,1.56,.64,1),apkpillpulse 2.8s ease-in-out 1s infinite;-webkit-tap-highlight-color:transparent}
.apkpill-ic{font-size:22px;filter:drop-shadow(0 1px 2px #0006)}
@keyframes apkpillpop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes apkpillpulse{0%,100%{box-shadow:0 8px 24px -6px #d9775766,0 0 0 1px #ffffff22 inset}50%{box-shadow:0 8px 28px -4px #d97757aa,0 0 0 1px #ffffff22 inset,0 0 0 7px #d9775722}}
.apkpopov{position:fixed;inset:0;z-index:1300;background:rgba(9,4,8,.62);backdrop-filter:blur(3px);display:flex;align-items:flex-end;justify-content:flex-start;padding:12px;padding-bottom:calc(72px + env(safe-area-inset-bottom,0px));animation:fadein .2s}
.apkpop{position:relative;width:min(280px,calc(100vw - 24px));background:var(--card);border:1px solid #d9775755;border-radius:20px;padding:20px 18px 16px;box-shadow:0 20px 50px -12px #000,0 0 30px -10px #d9775755;display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;animation:installin .3s ease-out}
.apkpop-x{position:absolute;top:10px;right:12px;background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:4px}
.apkpop-icon{width:56px;height:56px;border-radius:16px;box-shadow:0 4px 14px -4px #000;margin-bottom:6px}
.apkpop-title{font-family:'Orbitron',sans-serif;font-size:15px;font-weight:800;color:var(--text)}
.apkpop-sub{font-size:12px;color:#d97757;font-weight:700;margin-bottom:8px}
.apkpop-feats{display:flex;flex-direction:column;gap:5px;align-items:flex-start;width:100%;margin-bottom:12px;padding:10px 12px;background:var(--card2);border-radius:12px}
.apkpop-feats span{font-size:12px;color:var(--text2)}
.apkpop-go{display:block;width:100%;background:linear-gradient(135deg,#d97757,#c96444);color:#fff;border:none;border-radius:12px;padding:12px;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:800;letter-spacing:.6px;cursor:pointer;box-shadow:0 6px 18px -6px #d97757aa}
.apkpop-note{font-size:10.5px;color:var(--muted);margin-top:9px;line-height:1.3}
.apkpop2{width:min(360px,calc(100vw - 24px))}
.apkpop-plats{display:flex;gap:8px;width:100%;align-items:stretch}
.apkpop-plat{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;background:var(--card2);border-radius:14px;padding:12px 8px}
.apkpop-plat-ic{font-size:24px}
.apkpop-plat-t{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;color:var(--text)}
.apkpop-plat-s{font-size:10px;color:#d97757;font-weight:700;margin-bottom:2px}
.apkpop-plat .apkpop-feats{background:transparent;padding:0;margin-bottom:8px;gap:3px;align-items:center}
.apkpop-plat .apkpop-feats span{font-size:10px;text-align:center}
.apkpop-plat .apkpop-go{font-size:10.5px;padding:9px 6px}
.apkpop-plat .apkpop-go:disabled{opacity:.5;cursor:default;box-shadow:none}
.apkpop-plat .apkpop-note{font-size:9px;margin-top:6px}
.iosinstall{position:relative;width:min(340px,calc(100vw - 24px));background:var(--card);border:1px solid var(--bd2);border-radius:20px;padding:22px 18px 18px;box-shadow:0 20px 50px -12px #000;text-align:center;animation:installin .3s ease-out}
.iosinstall-warn{background:#f59e0b1f;border:1px solid #f59e0b55;color:#f59e0b;font-size:11.5px;line-height:1.4;padding:8px 10px;border-radius:10px;margin:12px 0 4px;text-align:left}
.iosinstall-steps{display:flex;flex-direction:column;gap:12px;margin:16px 0;text-align:left}
.iosinstall-step{display:flex;gap:10px;align-items:flex-start}
.iosinstall-stepic{font-size:18px;flex-shrink:0;width:26px;text-align:center;line-height:1.3}
.iosinstall-step>div{display:flex;flex-direction:column;gap:2px}
.iosinstall-step b{font-family:'Rajdhani',sans-serif;font-size:13.5px;font-weight:700;color:var(--text)}
.iosinstall-step span{font-size:11.5px;color:var(--muted);line-height:1.35}
.iosinstall-benefits{background:var(--card2);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px;margin-bottom:16px;text-align:left}
.iosinstall-benefits b{font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:2px}
.iosinstall-benefits span{font-size:11.5px;color:var(--text2)}
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
.practicebtn.ready{animation:pulse 1.6s ease-in-out 3}
.practicebtn:hover{border-color:#d97757;box-shadow:0 0 16px -4px #d97757;transform:translateY(-1px)}
.practicebtn:active{transform:scale(.98)}
.practicebtn:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.practiceov{position:fixed;inset:0;z-index:1100;display:flex;flex-direction:column;background:var(--bg);animation:fadein .25s}
.practicehdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #d9775733;background:var(--card2);flex-shrink:0;position:relative;z-index:1}
.practicehtitle{font-family:'Orbitron',sans-serif;font-size:12px;color:#d97757;letter-spacing:1.5px;display:flex;flex-direction:column;gap:3px}
.practicehtitle small{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:.5px;text-transform:none}
.practicechordstyle{margin:10px 14px 0;flex-shrink:0}
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
.practicecombo{font-size:14px}
.practicetip{text-align:center;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);line-height:1.6}
.practicefoot{display:flex;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #d9775733;background:var(--card2);flex-shrink:0;position:relative;z-index:1}
/* in-overlay Practice Mode result screen — same dark/Orbitron language as the
   live drill above it, not the light profile-page card style */
.presultwrap{align-items:stretch;text-align:center}
.presulthead{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0 4px;animation:pop .35s ease}
.presulttitle{font-family:'Orbitron',sans-serif;font-size:22px;font-weight:900;color:#d97757;text-shadow:0 0 18px #d9775777}
.presultsub{font-family:'Share Tech Mono',monospace;font-size:12px;color:var(--muted)}
.presultbest{margin-top:4px;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:#ffd23f;text-shadow:0 0 12px #ffd23f99;animation:sightstreakpop .4s ease}
.presultstats{display:flex;gap:12px;justify-content:center}
.presultstat{flex:1;max-width:150px;background:var(--card2);border:1px solid var(--bd2);border-radius:12px;padding:12px 8px}
.presultstat-v{font-family:'Orbitron',sans-serif;font-size:24px;font-weight:900;color:#d97757}
.presultstat-l{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:1px;margin-top:2px}
.presultstat-d{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text2);margin-top:4px}
.presultbars{display:flex;flex-direction:column;gap:8px;text-align:left}
.presultbar-row{display:flex;align-items:center;gap:8px}
.presultbar-lbl{flex:0 0 auto;width:110px;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text2)}
.presultbar{flex:1;height:8px}
.presultbar-pct{flex:0 0 auto;width:36px;text-align:right;font-family:'Orbitron',sans-serif;font-size:11px;color:var(--text)}
.presultai{background:var(--card2);border:1px solid var(--bd2);border-radius:12px;padding:12px 14px;text-align:left}
.presultai-h{font-family:'Share Tech Mono',monospace;font-size:10px;color:#d97757;letter-spacing:1px;margin-bottom:6px}
.presultai-loading{color:var(--muted);animation:blink 1.2s infinite}
.presultai-tx{font-size:13px;line-height:1.6;color:var(--text);white-space:pre-wrap}
/* Pathway-stage-unlock celebration — bigger/louder than the plain "new
   personal best" line above, since crossing a whole stage is a bigger deal
   than one drill's record. Reuses the level-up card's bounce entrance. */
.punlock{display:flex;flex-direction:column;align-items:center;gap:2px;padding:16px 12px;margin-bottom:4px;border-radius:14px;background:linear-gradient(180deg,rgba(255,210,63,.16),rgba(217,119,87,.08));border:1px solid #ffd23f55;animation:lvbounce .5s cubic-bezier(.34,1.56,.64,1)}
.punlock-ic{font-size:44px;line-height:1;filter:drop-shadow(0 0 14px #ffd23f88);animation:chestwiggle 1.4s ease-in-out infinite}
.punlock-tt{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:900;color:#ffd23f;text-shadow:0 0 14px #ffd23f77;margin-top:4px}
.punlock-sub{font-family:'Share Tech Mono',monospace;font-size:12px;color:var(--text2)}
/* Boss Challenge clear — same shape as punlock, royal purple instead of gold so
   a combined-group capstone reads as a distinct, bigger moment at a glance */
.punlock.pboss{background:linear-gradient(180deg,rgba(167,139,250,.2),rgba(139,92,246,.08));border-color:#a78bfa66}
.punlock.pboss .punlock-ic{filter:drop-shadow(0 0 14px #a78bfa99)}
.punlock.pboss .punlock-tt{color:#c4b5fd;text-shadow:0 0 14px #a78bfa77}
/* Memory Streak tier-up — same shape again, ocean blue so it reads as its
   own distinct "you kept your review streak alive" moment, never confused
   with a stage unlock (gold) or a boss clear (purple) */
.punlock.pmemory{background:linear-gradient(180deg,rgba(0,212,255,.2),rgba(0,119,182,.08));border-color:#00d4ff66}
.punlock.pmemory .punlock-ic{filter:drop-shadow(0 0 14px #00d4ff99)}
.punlock.pmemory .punlock-tt{color:#7dd3ec;text-shadow:0 0 14px #00d4ff77}
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
.vmhdleft{display:flex;align-items:center;gap:10px;min-width:0}
.vmback{background:none;border:1px solid var(--bd3);border-radius:6px;width:32px;height:32px;flex-shrink:0;cursor:pointer;color:var(--text);font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;transition:all .2s;padding:0}
.vmback:hover{background:var(--bd2);border-color:var(--accent);box-shadow:0 0 8px rgba(217,119,87,.25)}
.songhud{display:flex;justify-content:space-around;gap:8px;padding:9px 14px;font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--text2);flex-shrink:0}
.songhud b{font-family:'Orbitron',sans-serif;color:var(--text);font-size:15px}
.songhud .hot b{color:#d97757;text-shadow:0 0 10px #ff5252}
.songprog{height:5px;background:var(--card3);flex-shrink:0}
.songprog>div{height:100%;background: #d97757;transition:width .15s}
.songstaffwrap{flex-shrink:0;padding:4px 0;background:#000}
.pastaff{width:100%;height:101px;display:block}
/* two-hand mode draws a real grand staff (treble + bass), so the strip needs
   room for both — .songstage is flex:1 and gives the height back automatically */
.songstaffwrap.grand .pastaff{height:150px}
.pastaff-cur{animation:pastaffpulse 1s ease-in-out infinite}
@keyframes pastaffpulse{0%,100%{opacity:1}50%{opacity:.5}}
/* Landscape rotation prompt — shown on mobile portrait during Play Along */
.orientation-prompt{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;font-family:'Orbitron',sans-serif;text-align:center;padding:24px;animation:fadein .3s}
.orientation-prompt .op-icon{font-size:56px;animation:rotate-hint 2s ease-in-out infinite}
.orientation-prompt .op-title{font-size:18px;font-weight:700;color:#d97757}
.orientation-prompt .op-sub{font-size:13px;color:rgba(255,255,255,.7);font-family:'Rajdhani',sans-serif;max-width:280px;line-height:1.5}
.orientation-prompt .op-skip{margin-top:8px;padding:8px 20px;border:1px solid rgba(255,255,255,.3);border-radius:8px;background:transparent;color:rgba(255,255,255,.6);font-size:12px;cursor:pointer;font-family:'Rajdhani',sans-serif}
.orientation-prompt .op-skip:hover{color:#fff;border-color:rgba(255,255,255,.6)}
@keyframes rotate-hint{0%,100%{transform:rotate(0deg)}25%{transform:rotate(90deg)}50%{transform:rotate(90deg)}75%{transform:rotate(0deg)}}
/* Landscape layout adjustments for Play Along — hide prompt, optimize space */
@media (orientation:landscape) and (max-height:500px){
  .songov .songhdr{padding:4px 12px}
  .songov .songhtitle{font-size:12px}
  .songov .songstaffwrap{padding:0}
  .songov .pastaff{height:64px}
  .songov .songhud{padding:4px 10px;font-size:11px}
  .songov .songhud b{font-size:13px}
  .songov .songprog{height:3px}
}
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
.songstage.shake{animation:stageshake .38s cubic-bezier(.36,.07,.19,.97)}
@keyframes stageshake{10%{transform:translate(-2px,1px)}20%{transform:translate(3px,-2px)}30%{transform:translate(-4px,2px)}40%{transform:translate(4px,1px)}50%{transform:translate(-3px,-1px)}60%{transform:translate(3px,2px)}70%{transform:translate(-2px,-2px)}80%{transform:translate(2px,1px)}100%{transform:translate(0,0)}}
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
/* Setlist / Concert mode — purple identity, same family as Boss Challenge and
   the Knowledge Quest starters: TiGA's "optional, go-further" mode color. */
.setlistpos{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#c4b5fd}
.setlistpos.ready{font-size:13px;background:rgba(167,139,250,.14);border:1px solid #a78bfa44;border-radius:20px;padding:5px 14px;margin-bottom:8px}
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
/* height is explicit rather than left to line-height, because an emoji's
   natural line-height varies a lot by platform (Android in particular renders
   🛍️/🪙 noticeably taller than desktop Chromium does) - .hdrgo next to it is a
   fixed 38px square, and only a fixed height here can guarantee they match on
   every device instead of just the one this was checked on. */
.shopbtn{display:flex;align-items:center;gap:4px;height:38px;box-sizing:border-box;background:none;border:1.5px solid #d9775755;border-radius:20px;padding:0 10px;cursor:pointer;font-size:12px;font-weight:700;color:#d97757;transition:all .2s;white-space:nowrap}
.shopbtn:hover{border-color:#d97757;background:rgba(217,119,87,.1);box-shadow:0 0 10px rgba(217,119,87,.2)}
.shopbtn-ic{font-size:14px}
.shopbtn-coins{font-family:"Orbitron",sans-serif;font-size:10px;letter-spacing:.3px}
.charcard{background:#ffffff;border:1.5px solid #00f0ff44;border-radius:14px;margin:12px 14px;padding:16px;box-shadow:0 0 12px rgba(0,240,255,.12),0 2px 8px rgba(0,0,0,.06)}
.charcard-hdr{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:#1a1a2e}
/* the two ways out of the character card, side by side */
.char-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
.char-actions .songbtn{font-size:11.5px;padding:8px 6px;display:inline-flex;align-items:center;justify-content:center;gap:5px}
.stgbtn svg{flex-shrink:0}
/* ── Item Storage ──
   Its own page, not a modal: this is where a collection is looked over, and a
   collection deserves room. Same grid language as the shop so the two read as
   two views of one catalogue — but here everything on screen is already yours,
   and tapping puts it on the character. */
.stgpage{max-width:560px;margin:0 auto;padding:10px 12px 90px}
.stghdr{display:flex;align-items:center;gap:9px;padding:6px 2px 12px;position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--bd1)}
.stgback{width:32px;height:32px;flex-shrink:0;border-radius:9px;border:1px solid var(--bd1);background:var(--card2);color:var(--text);font-size:16px;cursor:pointer}
.stgback:hover{border-color:#d97757}
.stgttl{display:inline-flex;align-items:center;gap:6px;margin-right:auto;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:#d97757}
.stgstats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0 4px}
.stgstat{display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 4px;border-radius:11px;background:var(--card2);border:1px solid var(--bd1)}
.stgstat b{font-family:'Orbitron',sans-serif;font-size:14px;color:var(--text);line-height:1.1}
.stgstat span{font-size:8.5px;color:var(--muted);text-align:center;line-height:1.15}
.stgstat.rar-rare b{color:#3aa8ff}.stgstat.rar-epic b{color:#aa00ff}.stgstat.rar-legendary b{color:#ffb300}
.stgsec{margin-top:16px}
.stgsec-h{display:flex;align-items:center;gap:7px;padding-bottom:7px}
.stgsec-ic{font-size:15px}
.stgsec-t{font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-right:auto}
.stgsec-n{font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums}
.stgempty{display:block;width:100%;padding:14px 10px;border-radius:12px;border:1px dashed var(--bd1);background:none;color:var(--muted);font-size:11px;cursor:pointer}
.stgempty:hover{border-color:#d97757;color:#d97757}
.stggrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.stgitem{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:11px 5px 9px;border-radius:12px;border:1px solid var(--bd1);background:var(--card2);cursor:pointer;transition:border-color .18s,transform .18s,box-shadow .18s}
.stgitem:hover{transform:translateY(-1px);border-color:#d97757}
.stgitem.on{border-color:#00c2d6;box-shadow:0 0 0 1px #00c2d64d,0 4px 14px -8px #00c2d6}
.stgitem-ic{font-size:30px;line-height:1}
.stgitem-head{display:block;width:100%;aspect-ratio:1/1.05}
.stgitem-head svg{display:block;width:100%;height:100%}
.stgitem-nm{font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:600;color:var(--text);text-align:center;line-height:1.15}
.stgitem-r{font-size:8px;font-weight:700;letter-spacing:.4px;color:var(--muted);text-transform:uppercase}
.stgitem.rare .stgitem-r{color:#3aa8ff}.stgitem.epic .stgitem-r{color:#aa00ff}.stgitem.legendary .stgitem-r{color:#ffb300}
.stgitem-on{position:absolute;top:4px;right:5px;padding:1px 5px;border-radius:20px;background:#00c2d6;color:#04121b;font-size:7.5px;font-weight:700;white-space:nowrap}
.stgshop{display:block;width:100%;margin-top:22px;padding:12px;border-radius:12px;border:1px solid var(--bd1);background:var(--card2);color:var(--text);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
.stgshop:hover{border-color:#d97757;color:#d97757}
@media (max-width:380px){.stggrid{grid-template-columns:repeat(2,1fr)}.stgstats{grid-template-columns:repeat(2,1fr)}}
/* ── chassis detail ──
   The product page for a thirty-thousand-coin purchase: it turns, it says what
   it is good at and what it is not, it lists what its skills actually do, and
   only then does it offer to take the money. */

/* ── skill track ── the per-class SP bars under the account EXP bar, and the
   door to the arena. Scoped light like the rest of the profile hero. */
/* ── the gem rack ── mythic gear is the one tier coins cannot reach, so it is
   marked everywhere it appears rather than blending into the coin shelves */
.gempill{background:#a86bff14!important;border-color:#a86bff55!important;color:#7b46c9!important}
.shop-tab.gem{border-color:#a86bff55;background:linear-gradient(160deg,#f7f2ff,#efe6ff)}
.shop-tab.gem.on{border-color:#a86bff;box-shadow:0 0 0 1px #a86bff55}
.shopitem-tag.gem{color:#7b46c9}
.shop-full .shopitem.mythic,.shopitem.mythic{border-color:#a86bff;background:linear-gradient(160deg,#faf7ff,#f1e9ff);box-shadow:0 0 0 1px #a86bff33,0 8px 22px -14px #a86bff}
.shop-full .shopitem.mythic .shopitem-rare,.shopitem.mythic .shopitem-rare{color:#7b46c9;font-weight:700}
.stgitem.mythic,.rar-mythic{color:#7b46c9}
.skilltrack{width:100%;max-width:520px;margin:14px auto 0;padding:12px 13px 13px;border-radius:16px;background:var(--card);border:1px solid var(--bd1);box-shadow:0 6px 22px -18px rgba(20,30,60,.5)}
.skt-hdr{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.skt-ic{display:block;width:22px;height:22px;flex:none}
.skt-ic svg{display:block;width:100%;height:100%}
.skt-ttl{display:flex;align-items:baseline;gap:7px;margin-right:auto;min-width:0}
.skt-ttl b{font-family:'Orbitron',sans-serif;font-size:10px;font-weight:800;letter-spacing:1px;color:var(--muted)}
.skt-ttl i{font-family:'Rajdhani',sans-serif;font-style:normal;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.skt-rank{font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:.5px;padding:2px 8px;border-radius:20px;white-space:nowrap;background:color-mix(in srgb,var(--cc) 12%,transparent);border:1px solid color-mix(in srgb,var(--cc) 38%,transparent);color:var(--cc)}
.skt-bar{height:9px;border-radius:20px;background:var(--card2);border:1px solid var(--bd1);overflow:hidden}
.skt-fill{height:100%;border-radius:20px;transition:width .5s cubic-bezier(.4,0,.2,1)}
.skt-sub{margin-top:5px;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);text-align:center}
.skt-all{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:5px;margin-top:10px}
.skt-chip{display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:9px;background:var(--card2);border:1px solid var(--bd1);min-width:0}
.skt-chip.on{background:color-mix(in srgb,var(--cc) 9%,transparent);border-color:color-mix(in srgb,var(--cc) 40%,transparent)}
.skt-chip-ic{display:block;width:15px;height:15px;flex:none}
.skt-chip-ic svg{display:block;width:100%;height:100%}
.skt-chip-nm{font-family:'Rajdhani',sans-serif;font-size:9.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.skt-chip-bar{display:none}
.skt-chip-r{font-family:'Share Tech Mono',monospace;font-size:9.5px;color:var(--cc);flex:none}
/* The one card on the profile asking the player to go DO something, so it
   gets the loudest treatment on the page: a wider, brighter gradient, a lit
   icon badge instead of a bare glyph, and a slow breathing glow rather than a
   static shadow - the eye should land here before it lands on a stat bar.
   Named .profpvp rather than .pvpbanner: that name was already taken by the
   in-fight "banner" element ArenaFight flashes text through (see .pvpbanner
   further down, position:absolute) - same class name, equal specificity, and
   the later rule in the cascade silently made THIS card absolutely
   positioned too, stacking it on top of the EXP row instead of below it. */
.profpvp{display:flex;align-items:center;gap:13px;width:100%;max-width:520px;margin:14px auto 0;padding:16px 17px;
  border:none;border-radius:18px;background:linear-gradient(135deg,#ff9a66,#e2502f);color:#fff;text-align:left;cursor:pointer;
  box-shadow:0 12px 30px -10px #d9775799,0 0 0 1px #ffffff26 inset;animation:profpvpGlow 2.6s ease-in-out infinite}
.profpvp:hover{filter:brightness(1.07)}
.profpvp:active{transform:scale(.98)}
.profpvp-ic{font-size:24px;line-height:1;flex:none;width:46px;height:46px;display:flex;align-items:center;justify-content:center;
  background:#ffffff2a;border-radius:50%;box-shadow:inset 0 0 0 1px #ffffff40}
.profpvp-b{display:flex;flex-direction:column;gap:2px;margin-right:auto;min-width:0}
.profpvp-b b{font-family:'Rajdhani',sans-serif;font-size:16.5px;font-weight:800;letter-spacing:.2px;text-shadow:0 1px 8px rgba(0,0,0,.18)}
.profpvp-b i{font-style:normal;font-size:11px;line-height:1.4;opacity:.95}
.profpvp-go{font-size:21px;font-weight:700;flex:none;opacity:.95}
@keyframes profpvpGlow{0%,100%{box-shadow:0 12px 30px -10px #d9775799,0 0 0 1px #ffffff26 inset}
  50%{box-shadow:0 14px 36px -6px #ff7a4fcc,0 0 0 1px #ffffff40 inset}}
@media (prefers-reduced-motion:reduce){.profpvp{animation:none}}

/* ── PvP arena ── */
.pvppage{flex:1;min-height:0;overflow-y:auto;background:var(--bg);padding-bottom:26px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.pvphdr{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:9px;padding:11px 13px;background:var(--card);border-bottom:1px solid var(--bd1)}
.pvphdr-t{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text);margin-right:auto}
.pvpscore{font-family:'Share Tech Mono',monospace;font-size:14px;color:#d97757}
.pvparena{font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:.06em;color:var(--muted);padding:2px 8px;border-radius:20px;background:var(--card2);border:1px solid var(--bd1);white-space:nowrap}
.pvppage.land .pvparena{background:rgba(255,255,255,.14);border-color:#ffffff2e;color:#dce6fb}
.pvpbody{max-width:520px;margin:0 auto;padding:13px 13px 0}
.pvpme{display:flex;gap:11px;padding:12px;border-radius:15px;background:var(--card);border:1px solid var(--bd1)}
.pvpme-stage{width:96px;flex:none;height:190px;border-radius:11px;background:linear-gradient(178deg,#fff,#eef1f7);border:1px solid var(--bd1);display:flex;align-items:center;justify-content:center;overflow:hidden}
.pvpme-stage svg{display:block;height:178px;width:auto}
.pvpme-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.pvpme-nm{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text)}
.pvpme-rank{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--cc)}
.pvpme-sk{display:flex;flex-direction:column;gap:6px}
.pvpme-gear{display:flex;flex-direction:column;gap:2px;margin-top:8px;padding-top:8px;border-top:1px dashed var(--bd1)}
.pvpme-gear span{font-size:9.5px;color:var(--muted);font-family:'Share Tech Mono',monospace}
/* the command list, printed the way an arcade cabinet prints it */
.pvpmoves{display:flex;flex-direction:column;gap:3px;margin-top:8px;padding-top:8px;border-top:1px dashed var(--bd1)}
.pvpmoves b{font-family:'Orbitron',sans-serif;font-size:9.5px;font-weight:800;letter-spacing:.05em;color:var(--text);margin-bottom:2px}
.pvpmoves span{display:flex;align-items:center;gap:5px;font-size:9.5px;color:var(--muted);font-family:'Share Tech Mono',monospace}
.pvpmoves em{font-style:normal;padding:1px 5px;border-radius:5px;background:color-mix(in srgb,#7fd7ff 16%,transparent);border:1px solid #7fd7ff44;color:#3d86c6;letter-spacing:1px}
.pvpmoves i{font-style:normal;margin-left:auto;color:var(--text2, var(--text));opacity:.85}
.pvpsk{display:flex;gap:7px;align-items:flex-start}
.pvpsk.lock{opacity:.5}
.pvpsk-ic{display:block;width:22px;height:22px;flex:none;margin-top:1px}
.pvpsk-ic svg{display:block;width:100%;height:100%}
.pvpsk-b{display:flex;flex-direction:column;min-width:0}
.pvpsk-b b{font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:700;color:var(--text)}
.pvpsk-b b i{font-style:normal;font-size:8px;padding:1px 5px;border-radius:20px;background:#14141310;color:var(--muted);margin-left:4px}
.pvpsk-b span{font-size:10px;line-height:1.35;color:var(--muted)}
/* a flex row so a section head can carry a counter and a toggle on the right
   without either of them needing to be positioned */
.pvpsec-h{display:flex;align-items:center;margin:16px 2px 8px;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;color:var(--text)}
/* Two columns rather than three: ten cards at three-across leaves an orphan
   card alone on its own row, and the longer labels ("Fairly Hard Mode") need
   the extra width three columns don't leave them. */
.pvptiers{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}
.pvploadouts{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.pvploadout{position:relative;display:flex;flex-direction:column;gap:2px;padding:10px 8px;border-radius:12px;border:1px dashed var(--bd1);background:var(--card);cursor:pointer;text-align:center}
.pvploadout:not(.empty){border-style:solid;border-color:color-mix(in srgb,var(--cc,#d97757) 45%,transparent)}
.pvploadout b{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;color:var(--text)}
.pvploadout i{font-style:normal;font-size:9px;color:var(--muted)}
.pvploadout.empty b{font-size:18px;color:var(--muted)}
.pvploadout-x{position:absolute;top:3px;right:5px;font-size:10px;color:var(--muted);padding:2px}
.pvpcolorways{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px}
.pvpcw{flex:none;width:84px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 6px;border-radius:12px;border:1px solid var(--bd1);background:var(--card);cursor:pointer}
.pvpcw.on{border-color:var(--g);box-shadow:0 0 0 1px var(--g)55}
.pvpcw.lock{opacity:.55}
.pvpcw-sw{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--a));box-shadow:0 0 10px -2px var(--g)}
.pvpcw b{font-family:'Rajdhani',sans-serif;font-size:10.5px;font-weight:700;color:var(--text);white-space:nowrap}
.pvpcw i{font-style:normal;font-size:8.5px;color:var(--muted);white-space:nowrap}
.pvptier{display:flex;flex-direction:column;gap:3px;padding:11px 7px;border-radius:13px;border:1px solid var(--bd1);background:var(--card);cursor:pointer;text-align:center}
.pvptier:active{transform:scale(.97)}
.pvptier b{font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--text)}
.pvptier i{font-style:normal;font-size:9.5px;color:var(--muted)}
.pvptier span{font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:-.2px;color:#d97757;white-space:nowrap}
/* A cool-to-hot ramp across all ten, so the ladder reads at a glance before
   anyone reads a single word of the label: green is safe, red is not. */
.pvptier.t-novice{border-color:#6fe0a055}
.pvptier.t-rookie{border-color:#3ddc8455}
.pvptier.t-cadet{border-color:#3ddcc055}
.pvptier.t-veteran{border-color:#3d86c655}
.pvptier.t-ranger{border-color:#7c7fe055}
.pvptier.t-ace{border-color:#d9775777;box-shadow:0 0 0 1px #d9775722}
.pvptier.t-elite{border-color:#e0935a77;box-shadow:0 0 0 1px #e0935a22}
.pvptier.t-warlord{border-color:#e2685f88;box-shadow:0 0 0 1px #e2685f2e}
.pvptier.t-overlord{border-color:#e0435a99;box-shadow:0 0 0 1px #e0435a3a}
.pvptier.t-legend{border-color:#ff2d55aa;box-shadow:0 0 10px -2px #ff2d5555,0 0 0 1px #ff2d5540}
.pvptier.t-gauntlet{border-color:#aa00ff88;box-shadow:0 0 0 1px #aa00ff2e;background:linear-gradient(160deg,var(--card),color-mix(in srgb,#aa00ff 8%,var(--card)))}
.pvptier.t-weeklyboss{border-color:#ffd23f99;box-shadow:0 0 10px -3px #ffd23f66,0 0 0 1px #ffd23f3a;background:linear-gradient(160deg,var(--card),color-mix(in srgb,#ffd23f 10%,var(--card)))}
.pvptier.t-rival{border-color:#ff4d6a88;box-shadow:0 0 0 1px #ff4d6a2e;background:linear-gradient(160deg,var(--card),color-mix(in srgb,#ff4d6a 8%,var(--card)))}
.pvptier.t-practice{border-color:#3ddc8488;box-shadow:0 0 0 1px #3ddc842e;background:linear-gradient(160deg,var(--card),color-mix(in srgb,#3ddc84 8%,var(--card)))}
/* rank + daily target strip, sitting right under the header */
.pvprank{display:flex;align-items:center;gap:9px;padding:8px 12px;margin-bottom:11px;border-radius:13px;background:var(--card);border:1px solid var(--bd1);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cc) 30%,transparent)}
.pvprank-ic{font-size:16px;line-height:1}
.pvprank-b{display:flex;flex-direction:column;gap:3px;min-width:76px}
.pvprank-b b{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;color:var(--cc)}
.pvprank-bar{width:76px;height:4px;border-radius:20px;background:var(--card2);overflow:hidden}
.pvprank-bar i{display:block;height:100%;background:var(--cc)}
.pvprank-daily{margin-left:auto;font-family:'Share Tech Mono',monospace;font-size:9.5px;color:var(--muted);white-space:nowrap}
.pvpshare{width:100%;margin-top:8px}
.pvpnote{font-size:10.5px;line-height:1.5;color:var(--muted);background:var(--card2);border:1px solid var(--bd1);border-radius:11px;padding:9px 11px;margin-bottom:9px}
.pvpempty{font-size:11.5px;color:var(--muted);text-align:center;padding:16px 10px;background:var(--card2);border:1px dashed var(--bd1);border-radius:12px}
.pvpfriends{display:flex;flex-direction:column;gap:6px}
.pvpfriend{display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:12px;border:1px solid var(--bd1);background:var(--card);cursor:pointer;text-align:left}
.pvpfriend:active{transform:scale(.99)}
.pvpfriend-av{display:block;width:34px;height:34px;flex:none;border-radius:9px;background:var(--card2);overflow:hidden}
.pvpfriend-av svg{display:block;width:100%;height:100%}
.pvpfriend-nm{flex:1;min-width:0;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pvpfriend-go{font-family:'Share Tech Mono',monospace;font-size:10px;color:#d97757;flex:none}

/* A night arena. This used to be a pale room, and every laser, fireball and
   ember drawn additively on top of near-white simply vanished — white plus
   anything is still white. Fight scenes are dark for the same reason film sets
   are: so the light in them has somewhere to show. */
.pvpstage{position:relative;max-width:520px;margin:10px auto 0;height:300px;border-radius:16px;overflow:hidden;border:1px solid #ffffff1a;background:radial-gradient(130% 90% at 50% 4%,#20304e 0%,#131b30 42%,#080b16 100%);box-shadow:inset 0 0 60px -10px #000;perspective:620px;perspective-origin:50% 34%}
/* ── the floor ──
   The stage drew a horizon and put two flat cut-outs in front of it, so the
   fighters read as stickers on a backdrop. A real tilted plane under them —
   with the grid receding on it — is what gives the shot a ground, and it is
   the thing the shadows can then land on. */
.pvpstage::after{content:"";position:absolute;left:-30%;right:-30%;bottom:-4%;height:62%;pointer-events:none;z-index:1;
  background:
    repeating-linear-gradient(90deg,rgba(140,190,255,.16) 0 1px,transparent 1px 46px),
    repeating-linear-gradient(0deg,rgba(140,190,255,.13) 0 1px,transparent 1px 40px),
    linear-gradient(180deg,rgba(120,170,255,.10),rgba(10,16,30,.55));
  transform:rotateX(66deg);transform-origin:50% 100%;
  -webkit-mask-image:linear-gradient(180deg,transparent,#000 24%,#000);mask-image:linear-gradient(180deg,transparent,#000 24%,#000)}
/* a vignette, so the eye goes to the middle where the fighting is */
.pvpstage::before{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;background:radial-gradient(80% 70% at 50% 52%,rgba(0,0,0,0) 40%,rgba(0,0,0,.45) 100%)}
.pvpstage.sh1{animation:pvpsh1 .32s ease-out}
.pvpstage.sh2{animation:pvpsh2 .38s ease-out}
.pvpstage.sh3{animation:pvpsh3 .5s ease-out}
@keyframes pvpsh1{0%,100%{transform:translate(0,0)}25%{transform:translate(-3px,2px)}60%{transform:translate(2px,-1px)}}
@keyframes pvpsh2{0%,100%{transform:translate(0,0)}20%{transform:translate(-7px,4px)}45%{transform:translate(6px,-3px)}75%{transform:translate(-3px,1px)}}
@keyframes pvpsh3{0%,100%{transform:translate(0,0)}12%{transform:translate(-12px,7px)}32%{transform:translate(11px,-6px)}55%{transform:translate(-8px,4px)}80%{transform:translate(5px,-2px)}}
/* over the fighters, not behind them: a bolt leaving a hand starts ON the
   robot, and a canvas underneath means the first third of every shot is
   hidden by the machine that fired it */
/* the backdrop sits UNDER the fighters; the effects stay over them */
.pvpbg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0}
.pvpfx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4}
.pvphps{position:absolute;left:0;right:0;top:0;z-index:6;display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:start;padding:9px 11px;background:linear-gradient(180deg,rgba(6,9,18,.82),rgba(6,9,18,0))}
.pvphpcol{display:flex;flex-direction:column;gap:3px;min-width:0}
.pvphp{height:9px;border-radius:20px;background:#00000059;border:1px solid #ffffff26;overflow:hidden;box-shadow:inset 0 1px 3px #0009}
.pvphp{position:relative}
.pvphp i{display:block;height:100%;background:linear-gradient(90deg,#3ddc84,#2fa87a);transition:width .35s cubic-bezier(.4,0,.2,1);position:relative;z-index:2}
.pvphp.op i{background:linear-gradient(90deg,#e0563f,#ff7a3c)}
/* the arcade "chip" bar: the damage you just took, still draining behind the
   real one, so a big hit reads as a big hit */
.pvphp u{position:absolute;inset:0 auto 0 0;display:block;height:100%;z-index:1;background:linear-gradient(90deg,#ffd23f,#ff9a3c);opacity:.75}
/* round wins, one pip per round taken */
.pvppips{display:inline-flex;gap:3px;vertical-align:middle;margin:0 5px}
.pvppips b{width:7px;height:7px;border-radius:50%;background:#ffffff2e;border:1px solid #ffffff4d;display:block}
.pvppips b.on{background:#ffd23f;border-color:#ffd23f;box-shadow:0 0 7px #ffd23f}
.pvphp-n{font-family:'Share Tech Mono',monospace;font-size:9.5px;color:#c3d2ea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px #000}
.pvphp-n.op{text-align:right}
/* the round clock, where a cabinet always puts it: dead centre, between the
   two bars, and it goes red when it is nearly out */
.pvpvs{display:flex;flex-direction:column;align-items:center;gap:1px;font-family:'Orbitron',sans-serif;color:#e6eefc;padding-top:1px;text-shadow:0 1px 4px #000}
.pvpvs b{font-size:20px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
.pvpvs b.low{color:#ff4d6a;text-shadow:0 0 12px #ff2d55,0 1px 4px #000;animation:pvpclockLow .5s ease-in-out infinite alternate}
.pvpvs i{font-style:normal;font-size:8.5px;letter-spacing:.08em;opacity:.75}
@keyframes pvpclockLow{from{transform:scale(1)}to{transform:scale(1.14)}}
/* the fighters stand ON the floor grid, so they are anchored to its baseline */
/* ── why the fighter is two elements ──
   Walking used to be driven by the CSS left property, which forces LAYOUT:
   every 60ms
   tick asked the browser to re-lay-out a subtree holding about a thousand SVG
   paths, twice, which is most of where the stutter on a cheap phone came from.
   The outer element now only translates — a compositor-only operation that
   never touches layout — and carries no transition, so a step is instant.
   Everything that squashes, lunges, recoils or poses lives on the inner
   element, which does have a transition and can animate freely without ever
   fighting the walk for the same property. */
.pvpfighter{position:absolute;bottom:var(--pvpfloor,6px);width:44%;height:210px;z-index:3;
  will-change:transform;contain:layout paint}
.pvpfighter-in{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;
  transition:transform .22s cubic-bezier(.34,1.4,.5,1)}
/* ONE drop-shadow, not two: each one rasterises the entire path subtree, and
   the second (a faint blue bloom) was costing a full extra pass for something
   almost nobody could see. */
.pvpfighter svg{display:block;height:206px;width:auto;filter:drop-shadow(0 12px 11px rgba(0,0,0,.62))}
/* the contact shadow, lying ON the floor plane rather than under the sprite:
   an ellipse squashed to the same rake as the grid is what stops a figure
   floating a centimetre above the stage */
.pvpfighter::before{content:"";position:absolute;bottom:-10px;left:50%;width:120px;height:26px;transform:translateX(-50%);border-radius:50%;
  background:radial-gradient(ellipse at 50% 50%,rgba(0,4,12,.62),rgba(0,4,12,0) 70%);pointer-events:none;z-index:-1}
.pvpfighter.op{filter:brightness(.94) saturate(.96)}
.pvpfighter.me{left:6%}
.pvpfighter.op{right:6%}
.pvpfighter.me.lunge .pvpfighter-in{transform:translateX(38%) scale(1.06)}
.pvpfighter.op.lunge .pvpfighter-in{transform:translateX(-38%) scale(1.06)}
.pvpfighter.me.knock .pvpfighter-in{transform:translateX(-9%) rotate(-4deg)}
.pvpfighter.op.knock .pvpfighter-in{transform:translateX(9%) rotate(4deg)}
.pvpflash{position:absolute;left:50%;top:14%;transform:translateX(-50%);font-family:'Orbitron',sans-serif;font-size:17px;font-weight:800;pointer-events:none;animation:pvpfl .9s ease-out forwards;white-space:nowrap;text-shadow:0 0 14px currentColor,0 2px 5px #000;z-index:7}
.pvpflash.dmg{color:#ff7a5f}
.pvpflash.heal{color:#5ce8a8}
.pvpflash.crit{color:#ffbe6a}
.pvpflash.block,.pvpflash.miss{color:#7ec4ff;font-size:12px}
.pvpflash.buff{color:#c9a6ff;font-size:11px}
@keyframes pvpfl{0%{opacity:0;transform:translate(-50%,10px)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-30px)}}
@media (prefers-reduced-motion:reduce){.pvpstage.sh1,.pvpstage.sh2,.pvpstage.sh3{animation:none}.pvpfighter-in{transition:none}.pvpfighter.me.lunge .pvpfighter-in,.pvpfighter.op.lunge .pvpfighter-in,.pvpfighter.me.knock .pvpfighter-in,.pvpfighter.op.knock .pvpfighter-in{transform:none}}
.pvpuntimed{max-width:520px;margin:12px auto 0;padding:0 15px;text-align:center;font-family:'Share Tech Mono',monospace;font-size:9.5px;letter-spacing:.3px;color:var(--muted)}
.pvpq{max-width:520px;margin:8px auto 0;padding:0 15px;font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;line-height:1.4;color:var(--text);text-align:center;text-wrap:balance}
/* ── the shot clock ──
   Four seconds, drawn as a bar that empties rather than a number that counts,
   because a bar is readable out of the corner of an eye that is still on the
   fight. It turns red on the last second and a half. */
/* The draining bar and its digits are gone with the shot clock. What is left
   is the line that says speed is still WORTH something, which was always the
   fun part — the countdown was only the threat. */
.pvpshot-l{max-width:520px;margin:12px auto 0;padding:0 15px;text-align:center;
  font-family:'Share Tech Mono',monospace;font-size:9.5px;letter-spacing:.3px;color:#d97757}

/* ── the standby beat ──────────────────────────────────────────────────────
   Deliberately IN THE WAY. It covers the arena so that a finger still
   hammering the attack pad lands here and nowhere else, and its own button
   fills up before it will take a press — you can watch it arm, so the wait
   reads as part of the game rather than as lag. */
.pvpstandby{position:fixed;inset:0;z-index:1480;display:flex;align-items:center;justify-content:center;
  padding:20px;background:rgba(4,8,16,.72);backdrop-filter:blur(3px);animation:pvpsbIn .18s ease}
@keyframes pvpsbIn{from{opacity:0}to{opacity:1}}
.pvpstandby-card{width:100%;max-width:330px;padding:22px 22px 18px;border-radius:20px;text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:7px;
  background:linear-gradient(180deg,#141c2e,#0c1220);border:1px solid #ffffff1f;
  box-shadow:0 26px 60px -22px #000,inset 0 1px 0 #ffffff14;animation:pvpsbPop .26s cubic-bezier(.34,1.5,.5,1)}
@keyframes pvpsbPop{from{transform:translateY(14px) scale(.96);opacity:0}to{transform:none;opacity:1}}
.pvpstandby-ic{font-size:34px;line-height:1;filter:drop-shadow(0 4px 10px #0009)}
.pvpstandby-card em{font-style:normal;font-family:'Share Tech Mono',monospace;font-size:9.5px;
  letter-spacing:2.2px;color:#7fe8ff;text-transform:uppercase}
.pvpstandby-card b{font-family:'Orbitron',sans-serif;font-size:21px;font-weight:800;color:#fff;letter-spacing:.5px;
  text-shadow:0 0 18px #7fe8ff55}
.pvpstandby-card p{margin:0;font-family:'Rajdhani',sans-serif;font-size:13.5px;line-height:1.45;color:#c3cede;text-wrap:balance}
.pvpstandby-n{font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:1.4px;color:#8d9bb0;
  padding:3px 11px;border-radius:20px;background:#ffffff0d;border:1px solid #ffffff14}
/* the button arms itself: a sweep fills left to right, and only then does it
   light up and start accepting presses */
.pvpstandby-go{position:relative;overflow:hidden;width:100%;margin-top:5px;padding:14px 18px;border-radius:14px;
  border:1px solid #ffffff1f;background:#1b2436;color:#7e8b9e;cursor:not-allowed;
  font-family:'Orbitron',sans-serif;font-size:14.5px;font-weight:800;letter-spacing:1px}
.pvpstandby-go::before{content:"";position:absolute;left:0;top:0;bottom:0;width:100%;z-index:0;
  background:linear-gradient(90deg,#1f6f8f,#2a8fb0);transform-origin:0 50%;transform:scaleX(0);
  animation:pvpsbArm var(--arm,900ms) linear forwards}
@keyframes pvpsbArm{to{transform:scaleX(1)}}
.pvpstandby-go > *{position:relative;z-index:1}
.pvpstandby-go.on{cursor:pointer;color:#04121a;border-color:#7fe8ff66;
  background:linear-gradient(180deg,#8ff0ff,#3ddc84);box-shadow:0 10px 26px -12px #3ddc84}
.pvpstandby-go.on::before{display:none}
.pvpstandby-go.on:active{transform:translateY(1px)}
.pvpstandby-card i{font-style:normal;font-size:10.5px;line-height:1.5;color:#8d9bb0;text-wrap:balance}
@media (prefers-reduced-motion:reduce){
  .pvpstandby,.pvpstandby-card{animation:none}
  .pvpstandby-go::before{animation:none;transform:scaleX(1);opacity:.35}
}
/* the super's answers arm too — the finger that pressed the ultimate is
   already moving, and this is the one question that decides a whole move */
.pvpultq-opts.arming button{opacity:.45;cursor:not-allowed}

/* ── the keyboard the answer is played on ──
   One octave, laid out the way a piano is: the black keys sit ON the white
   ones, offset into the gaps, because a keyboard that is really twelve equal
   buttons teaches the wrong shape. Sized for thumbs — the white keys are the
   full tap target and the black keys overlay their top two thirds. */
.pvpkeys{position:relative;display:flex;width:calc(100% - 26px);max-width:494px;margin:12px auto 0;height:104px;
  touch-action:manipulation;user-select:none}
.pvpkey{position:relative;flex:1;display:flex;align-items:flex-end;justify-content:center;padding-bottom:9px;
  border:1px solid var(--bd1);border-right-width:0;background:linear-gradient(180deg,#ffffff,#eef1f6);
  color:#1b2230;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;cursor:pointer;
  -webkit-tap-highlight-color:transparent}
.pvpkey:first-child{border-radius:5px 0 0 9px}
.pvpkey:last-of-type{border-radius:0 5px 9px 0;border-right-width:1px}
.pvpkey:active{background:linear-gradient(180deg,#e6ecf6,#d3dced)}
/* the black keys leave the flow and straddle the seam between their neighbours */
.pvpkey.blk{position:absolute;top:0;width:8.2%;height:64%;z-index:2;flex:0 0 auto;padding-bottom:6px;
  border:1px solid #05080f;border-radius:0 0 6px 6px;background:linear-gradient(180deg,#2a3346,#0d1220);
  color:#dbe4f2;font-size:8.5px;line-height:1.05;box-shadow:0 3px 6px -2px rgba(0,0,0,.6)}
.pvpkey.blk:active{background:linear-gradient(180deg,#1b2334,#05080f)}
.pvpkey.blk span{display:flex;flex-direction:column;align-items:center}
.pvpkey.blk em{font-style:normal}
/* five black keys, placed against the seven white ones behind them */
/* each one straddles the seam between the two white keys it sits between:
   a seventh of the width per white key, less half a black key */
.pvpkey.blk:nth-child(2){left:10.19%}
.pvpkey.blk:nth-child(4){left:24.47%}
.pvpkey.blk:nth-child(7){left:53.04%}
.pvpkey.blk:nth-child(9){left:67.33%}
.pvpkey.blk:nth-child(11){left:81.61%}
.pvpkey.culled{opacity:.32;cursor:default}
.pvpkey.right{background:linear-gradient(180deg,#3ddc84,#2bb46a);color:#05130b;
  box-shadow:0 0 0 2px #3ddc84,0 0 18px -4px #3ddc84}
.pvpkey.blk.right{background:linear-gradient(180deg,#3ddc84,#1e8a52);color:#05130b}
@media (max-width:380px){.pvpkeys{height:92px}.pvpkey{font-size:13px}}

/* ── the super's question ──
   Laid over the held frame, not in place of it: the whole idea is that the
   punch is already in the air while this is being answered. */
.pvpultq{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:18px;
  background:rgba(6,9,18,.72);backdrop-filter:blur(3px);animation:pvpultqin .16s ease}
@keyframes pvpultqin{from{opacity:0}to{opacity:1}}
.pvpultq-card{width:100%;max-width:400px;border-radius:18px;padding:15px 15px 14px;text-align:center;
  background:linear-gradient(180deg,#141d33,#0a0f1d);border:1.5px solid #ffd23f;
  box-shadow:0 0 40px -8px #ffd23f,0 20px 50px -20px #000}
.pvpultq-card>b{display:block;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:900;letter-spacing:.08em;color:#ffd23f}
.pvpultq-card p{margin:0 0 11px;font-family:'Rajdhani',sans-serif;font-size:15.5px;font-weight:700;line-height:1.35;color:#eaf1ff;text-wrap:balance}
.pvpultq-opts{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.pvpultq-opts button{padding:12px 6px;border-radius:11px;border:1px solid #ffd23f55;background:#ffd23f12;
  font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:#ffe9a8;cursor:pointer}
.pvpultq-opts button:active{background:#ffd23f2e;transform:scale(.97)}

/* ══════════ the upgrade rail on a shop card ══════════
   A second, quieter action on a card whose main job is still buy-or-equip:
   the level badge sits top-left where the "NEW" flag sits top-right, and the
   upgrade strip is pinned under the price so the two money decisions read as
   a pair rather than competing. */
.shopitem-lv{position:absolute;top:5px;left:5px;z-index:2;padding:1px 6px;border-radius:7px;
  font-family:'Orbitron',sans-serif;font-size:9.5px;font-weight:800;letter-spacing:.03em;
  background:#3ddc84;color:#05130b}
.shopitem-lv.max{background:linear-gradient(90deg,#ffd23f,#ff9a3c);color:#2a1500}
.shopitem-up{display:block;margin-top:4px;padding:3px 6px;border-radius:8px;cursor:pointer;
  font-family:'Share Tech Mono',monospace;font-size:9.5px;letter-spacing:.2px;
  background:#3ddc8418;border:1px solid #3ddc8455;color:#1c7a4a}
.shopitem-up:active{transform:scale(.96)}
.shopitem-up.poor{background:var(--card2);border-color:var(--bd1);color:var(--muted);cursor:default}
.shopitem-up.max{background:linear-gradient(90deg,#ffd23f22,#ff9a3c22);border-color:#ffd23f66;color:#9a6b00;cursor:default}
/* an upgraded piece is worth spotting in a grid of forty */
.shopitem.upgraded{box-shadow:0 0 0 1px #3ddc8455,0 2px 10px -6px #3ddc84}

/* ══════════ the gear you paid for, worn in the fight ══════════
   Overlays inside .pvpfighter-in, sized and placed against the 206px-tall
   chassis SVG rather than against the stage, so they stay put when the
   fighter walks. Each one is pointer-transparent and aria-hidden: they are
   decoration on top of a figure that is already announced. */
/* shrink-wraps the chassis so everything worn can be placed as a fraction of
   the BODY rather than of the much wider fighter box around it */
.pvpbody{position:relative;height:100%;display:flex;align-items:flex-end;justify-content:center}
.pvpbody > svg{display:block;height:206px;width:auto;position:relative;z-index:1}
.pvpgear{position:absolute;pointer-events:none;z-index:4;display:block;
  filter:drop-shadow(0 3px 5px rgba(0,0,0,.55))}
.pvpgear svg{display:block;width:100%;height:100%}
/* the weapon rides the leading hand, just outside the silhouette the way a
   held object sits, and swings when the body lunges */
.pvpgear.wpn{width:46px;height:46px;right:-22%;bottom:30%;transform:rotate(-18deg);
  transition:transform .16s ease;transform-origin:50% 70%}
.pvpfighter.op .pvpgear.wpn{right:auto;left:-22%;transform:rotate(18deg) scaleX(-1)}
.pvpfighter.me.lunge .pvpgear.wpn{transform:rotate(-56deg) translate(5px,-7px)}
.pvpfighter.op.lunge .pvpgear.wpn{transform:rotate(56deg) scaleX(-1) translate(5px,-7px)}
.pvpgear.hat{width:38px;height:38px;left:50%;top:-4%;margin-left:-19px;z-index:5}
/* measured: the wrapper runs ~14px wider than the chassis on each side (the
   chassis SVG's drop-shadow inflates its own box), so -14% put this a clear
   21px off the body. 10% lands it on the hip where a belt module belongs. */
.pvpgear.acc{width:24px;height:24px;left:10%;bottom:42%;opacity:.95}
.pvpfighter.op .pvpgear.acc{left:auto;right:10%}
@media (max-width:360px){
  .pvpgear.wpn{width:38px;height:38px}
  .pvpgear.hat{width:32px;height:32px;margin-left:-16px}
  .pvpgear.acc{width:20px;height:20px}
}

/* ── rarity has to be visible before the first punch ──
   The aura sits BEHIND the chassis and its tier is the best piece worn, so a
   player who saved up for one legendary sees it immediately. Common gets
   nothing at all on purpose: if every kit glows then no kit glows. */
.pvpaura{position:absolute;left:50%;bottom:0;width:150px;height:150px;margin-left:-75px;
  border-radius:50%;z-index:0;pointer-events:none}
.pvpaura.r-common{display:none}
.pvpaura.r-rare{background:radial-gradient(circle,rgba(92,225,255,.30),rgba(92,225,255,0) 68%)}
.pvpaura.r-epic{background:radial-gradient(circle,rgba(185,140,255,.38),rgba(185,140,255,0) 70%);
  animation:pvpaurapulse 2.4s ease-in-out infinite}
.pvpaura.r-legendary{background:radial-gradient(circle,rgba(255,210,63,.46),rgba(255,154,60,.14) 46%,rgba(255,210,63,0) 72%);
  animation:pvpaurapulse 1.7s ease-in-out infinite}
.pvpaura.r-mythic{background:radial-gradient(circle,rgba(255,45,85,.5),rgba(170,0,255,.24) 42%,rgba(0,240,255,.12) 60%,rgba(255,45,85,0) 74%);
  animation:pvpaurapulse 1.15s ease-in-out infinite}
@keyframes pvpaurapulse{0%,100%{opacity:.62;transform:scale(.96)}50%{opacity:1;transform:scale(1.06)}}
@media (prefers-reduced-motion:reduce){.pvpaura{animation:none!important}}

/* the weapon itself carries its rarity too, so the thing in the hand reads as
   expensive even when the aura is behind the body */
.pvpgear.wpn.r-epic{filter:drop-shadow(0 3px 5px rgba(0,0,0,.55)) drop-shadow(0 0 7px #b98cff)}
.pvpgear.wpn.r-legendary{filter:drop-shadow(0 3px 5px rgba(0,0,0,.55)) drop-shadow(0 0 9px #ffd23f)}
.pvpgear.wpn.r-mythic{filter:drop-shadow(0 3px 5px rgba(0,0,0,.55)) drop-shadow(0 0 11px #ff2d55) drop-shadow(0 0 18px #aa00ff)}
/* fully upgraded: a slow shimmer, so five levels of investment are visible */
.pvpgear.wpn.maxed::after{content:"";position:absolute;inset:-4px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.4),rgba(255,255,255,0) 62%);
  animation:pvpgearmax 1.4s ease-in-out infinite}
@keyframes pvpgearmax{0%,100%{opacity:.15}50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){.pvpgear.wpn.maxed::after{animation:none}}

/* ══════════ seasons, trials, objectives, the ghost ══════════ */

/* the season strip: which one, how long is left, and whether placements are
   still running — the three facts that make a ladder feel like it has stakes */
.pvpseason{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;max-width:520px;margin:6px auto 0;padding:7px 12px;
  border-radius:12px;border:1px solid var(--bd1);background:var(--card)}
.pvpseason b{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:800;letter-spacing:.04em;color:var(--text)}
.pvpseason i{font-style:normal;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted)}
.pvpseason em{flex:1 0 100%;font-style:normal;font-family:'Share Tech Mono',monospace;font-size:9.5px;line-height:1.4;color:var(--muted)}
.pvpseason em.pl{color:#d97757}
.pvpseason-bd{flex:1 0 100%;display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}
.pvpseason-bd u{text-decoration:none;padding:2px 6px;border-radius:6px;border:1px solid var(--cc);color:var(--cc);
  font-family:'Orbitron',sans-serif;font-size:9px;font-weight:800;letter-spacing:.04em}

/* the ghost's travel form */
.pvpghostbar{display:flex;flex-wrap:wrap;gap:6px;max-width:520px;margin:8px auto 0;padding:0 13px}
.pvpghostbar button{flex:1 1 45%;padding:8px 6px;border-radius:11px;border:1px solid var(--bd1);background:var(--card);
  font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);cursor:pointer}
.pvpghostbar button:disabled{opacity:.45;cursor:default}
.pvpghostbar em{flex:1 0 100%;font-style:normal;text-align:center;font-family:'Share Tech Mono',monospace;font-size:10px;color:#3ddc84}
.pvptier.t-ghost{border-color:#b98cff55}
.pvptier.t-ghost.off{opacity:.55}

/* the trials list: numbered, because the number is how a player refers to one */
.pvpsec-n{margin-left:6px;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);font-weight:400}
.pvpsec-t{margin-left:auto;padding:2px 9px;border-radius:8px;border:1px solid var(--bd1);background:var(--card);
  font-family:'Share Tech Mono',monospace;font-size:9.5px;color:var(--muted);cursor:pointer}
.pvptrials{max-width:520px;margin:8px auto 0;padding:0 13px;display:flex;flex-direction:column;gap:4px}
.pvptrial{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;
  border:1px solid var(--bd1);background:var(--card)}
.pvptrial b{font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
.pvptrial i{flex:1;font-style:normal;font-size:12.5px;line-height:1.35;color:var(--text)}
.pvptrial span{font-family:'Share Tech Mono',monospace;font-size:10px;color:#d97757;white-space:nowrap}
.pvptrial.on{border-color:#3ddc8455;background:#3ddc840f}
.pvptrial.on b,.pvptrial.on i{color:#1c7a4a}
.pvptrial.on span{color:#3ddc84;font-size:13px}

/* the match objectives, at the bell and on the scoreboard */
.pvpobjstrip{position:absolute;left:50%;transform:translateX(-50%);bottom:9px;z-index:8;width:max-content;max-width:92%;
  padding:6px 12px;border-radius:12px;background:rgba(4,8,18,.8);border:1px solid #ffffff26;
  backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);pointer-events:none;
  display:flex;flex-direction:column;gap:2px;animation:pvpbn .4s ease}
.pvpobjstrip b{font-family:'Orbitron',sans-serif;font-size:9px;font-weight:800;letter-spacing:.12em;color:#ffd23f}
.pvpobjstrip i{font-style:normal;font-family:'Share Tech Mono',monospace;font-size:10px;color:#cfe0ff}
.pvpobjstrip em{font-style:normal;color:#d9a06a}
.pvpobjres{max-width:520px;margin:10px auto 0;padding:10px 12px;border-radius:13px;border:1px solid var(--bd1);background:var(--card)}
.pvpobjres>b{display:block;margin-bottom:6px;font-family:'Orbitron',sans-serif;font-size:10.5px;font-weight:800;letter-spacing:.05em;color:var(--text)}
.pvpobjres.trial{border-color:#3ddc8455;background:#3ddc840f}
.pvpobj{display:flex;align-items:center;gap:8px;padding:3px 0}
.pvpobj span{width:15px;text-align:center;font-size:12px;color:var(--muted)}
.pvpobj i{flex:1;font-style:normal;font-size:12.5px;color:var(--muted)}
.pvpobj em{font-style:normal;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted)}
.pvpobj.on span,.pvpobj.on em{color:#3ddc84}
.pvpobj.on i{color:var(--text)}
.pvpvalorgain{max-width:520px;margin:8px auto 0;padding:7px 12px;border-radius:12px;text-align:center;
  background:linear-gradient(90deg,#d9775722,#ffd23f22);border:1px solid #d9775744;
  font-family:'Orbitron',sans-serif;font-size:12px;font-weight:800;color:#d97757}

/* ══════════ the training lab ══════════
   Practice mode only. Dense on purpose: it is a control panel, not a page,
   and every row of it is data the fight actually runs on. */
.pvplab{max-width:520px;margin:8px auto 0;padding:0 13px}
.pvplab-row{display:flex;flex-wrap:wrap;gap:5px}
.pvplab-b{padding:5px 9px;border-radius:9px;border:1px solid var(--bd1);background:var(--card);
  font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:.2px;color:var(--muted);cursor:pointer}
.pvplab-b.on{border-color:#3ddc84;background:#3ddc8418;color:#1c7a4a}
.pvplab-b.mv{margin-left:auto;border-color:#d9775766;color:#d97757}
.pvplab-b.mv.on{background:#d9775718;border-color:#d97757}
.pvplab-moves{margin-top:6px;border:1px solid var(--bd1);border-radius:11px;background:var(--card);overflow:hidden}
.pvplab-moves table{width:100%;border-collapse:collapse;font-family:'Share Tech Mono',monospace;font-size:10.5px;
  font-variant-numeric:tabular-nums}
.pvplab-moves th{padding:5px 7px;text-align:left;color:var(--muted);font-weight:400;
  border-bottom:1px solid var(--bd1);background:var(--card2);letter-spacing:.3px}
.pvplab-moves td{padding:4px 7px;border-bottom:1px solid var(--bd4);color:var(--text)}
.pvplab-moves tr:last-child td{border-bottom:0}
.pvplab-moves tr.sp td{color:#d97757}
.pvplab-moves i{display:block;padding:5px 7px 6px;font-style:normal;font-family:'Share Tech Mono',monospace;
  font-size:9.5px;line-height:1.4;color:var(--muted);border-top:1px solid var(--bd1)}
.pvppage.land .pvplab{position:absolute;left:12px;top:12px;z-index:12;width:min(60%,340px);margin:0;padding:0}
.pvppage.land .pvplab-b{background:rgba(255,255,255,.86);backdrop-filter:blur(3px)}
.pvppage.land .pvplab-moves{background:rgba(255,255,255,.92);backdrop-filter:blur(4px)}

/* the free special a fast answer bought, announced where the thumbs are */
.pvpfreesp{max-width:520px;margin:6px auto 0;padding:4px 10px;border-radius:20px;text-align:center;
  background:linear-gradient(90deg,#ffd23f,#3ddc84);color:#0b1220;
  font-family:'Orbitron',sans-serif;font-size:9.5px;font-weight:800;letter-spacing:.05em;
  animation:pvpfreesp .9s ease-in-out infinite alternate}
@keyframes pvpfreesp{from{opacity:.8}to{opacity:1}}
.pvpopts{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:520px;margin:12px auto 0;padding:0 13px}
.pvpopt{padding:14px 8px;border-radius:13px;border:1px solid var(--bd1);background:var(--card);font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:var(--text);cursor:pointer}
.pvpopt:active{transform:scale(.97)}
.pvpopt.culled{opacity:.25;text-decoration:line-through}
.pvpopt.right{border-color:#2fa87a;background:#2fa87a1a;color:#17805a}
/* ── the action phase ── */
.pvpwave{max-width:520px;margin:12px auto 0;height:7px;border-radius:20px;background:var(--card2);border:1px solid var(--bd1);overflow:hidden}
.pvpwave i{display:block;height:100%;background:linear-gradient(90deg,#ffd23f,#d97757);transition:width .1s linear}
.pvpwave-l{max-width:520px;margin:4px auto 0;text-align:center;font-family:'Share Tech Mono',monospace;font-size:9.5px;color:var(--muted)}
/* ── the pad ── left thumb walks, right thumb fights. Same buttons in both
   orientations; only where they sit changes. */
.pvppad{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;max-width:520px;margin:11px auto 0;padding:0 13px}
.pvppad-l{display:flex;gap:7px}
/* five buttons: ranged pair on top, the two melee together underneath where
   the thumb rests, and the rocket across the bottom */
.pvppad-r{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}
.pvppad-r .pvpact.rocket{grid-column:span 2;width:auto}
.pvpdir,.pvpact{display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid var(--bd1);background:var(--card);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;color:var(--text)}
.pvpdir{width:52px;height:52px;border-radius:14px;font-size:19px;line-height:1}
.pvpdir:active{transform:scale(.93);background:var(--card2)}
.pvpdir.grd{border-color:#3d86c655;color:#2b6ca8}
.pvpdir.grd.on{background:#3d86c61f;border-color:#3d86c6;box-shadow:0 0 0 2px #3d86c644}
.pvpact{width:62px;height:52px;border-radius:14px;gap:1px}
.pvpact:active{transform:scale(.93);filter:brightness(1.06)}
.pvpact b{font-size:17px;line-height:1}
.pvpact i{font-style:normal;font-family:'Rajdhani',sans-serif;font-size:8.5px;font-weight:700;letter-spacing:.4px;opacity:.9}
.pvpact.fire{border-color:#3d86c666;color:#2b6ca8}
.pvpact.punch{background:linear-gradient(135deg,#e2865f,#d05f43);border-color:transparent;color:#fff;box-shadow:0 6px 16px -10px #d97757}
.pvpact.rocket{border-color:#d9775777;color:#b4522f}
.pvpact.jump{border-color:#3ddc8477;color:#1f8a5b}
.pvpact.kick{background:linear-gradient(135deg,#c9a227,#a8791b);border-color:transparent;color:#fff;box-shadow:0 6px 16px -10px #c9a227}
/* Adventure's overdrive. It lives on the pad rather than appearing there
   when it charges: a button that materialises mid-fight shoves every other
   button out from under a thumb already reaching for one. */
.pvpact.ult{background:linear-gradient(135deg,#fff0c2,#ffd23f);border-color:transparent;color:#7a4a06;box-shadow:0 6px 18px -10px #ffd23f;animation:pvpOdPulse 1s ease-in-out infinite}
.pvpact.ult b{color:#7a4a06}
.pvpact.ult.cool{background:var(--card);border-color:var(--bd1);color:var(--muted);box-shadow:none;animation:none;opacity:.55}
.pvpact.ult.cool b{color:var(--muted)}
@keyframes pvpOdPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.14)}}
.pvpact:disabled,.pvpdir:disabled{cursor:default}
.pvpact.cool,.pvpdir.cool{opacity:.42;filter:saturate(.4)}

/* ── landscape: the arena takes the whole screen and the pad floats on it ── */
.pvppage.land{position:fixed;inset:0;z-index:60;min-height:0;padding:0;background:var(--bg);overflow:hidden}
/* in landscape the header and the quiz sit ON the stage, which is now a night
   arena — so both flip to light-on-dark. In portrait they sit on the page
   below it and keep the page's own colours. */
.pvppage.land .pvphdr{position:absolute;top:0;left:0;right:0;z-index:8;background:linear-gradient(180deg,rgba(6,9,18,.86),rgba(6,9,18,0));border:none;padding:7px 12px}
.pvppage.land .pvphdr-t,.pvppage.land .pvpscore{color:#e8eefc;text-shadow:0 1px 4px #000}
.pvppage.land .pvpback{background:rgba(255,255,255,.14);border-color:#ffffff2e;color:#eef3ff}
.pvppage.land .pvpq{color:#f2f6ff;text-shadow:0 2px 10px #000,0 0 22px #000}
.pvppage.land .pvpuntimed{color:#b8c8e4;text-shadow:0 1px 5px #000}
.pvppage.land .pvpsk{background:rgba(255,255,255,.9)}
.pvppage.land .pvpstage{position:absolute;inset:0;max-width:none;margin:0;height:100%;border-radius:0;border:none}
/* the floor line the fighters stand on. Full screen means the thumb pads own
   the bottom of the stage, so the figures step up off it rather than standing
   behind the buttons. */
.pvppage.land{--pvpfloor:88px}
/* landscape stands the fighters ON the floor plane and clear of the thumb
   pads: at 70% of a 412px-tall phone their legs ran behind the buttons */
.pvppage.land .pvpfighter{height:58%}
.pvppage.land .pvpfighter svg{height:100%}
.pvppage.land .pvpfighter::before{bottom:-7px;width:96px;height:22px}
.pvppage.land .pvphps{padding:30px 14px 0}
/* the wave clock reads under the health bars, not across the fighters */
.pvppage.land .pvpwave{position:absolute;left:50%;transform:translateX(-50%);top:56px;width:min(46%,300px);max-width:none;margin:0;z-index:8}
.pvppage.land .pvpwave-l{position:absolute;left:50%;transform:translateX(-50%);top:66px;margin:0;z-index:8}
.pvppage.land .pvppad{position:absolute;left:0;right:0;bottom:0;max-width:none;margin:0;padding:0 16px 14px;z-index:9;pointer-events:none}
.pvppage.land .pvppad-l,.pvppage.land .pvppad-r{pointer-events:auto}
.pvppage.land .pvpdir{width:58px;height:58px;background:rgba(255,255,255,.82);backdrop-filter:blur(3px)}
.pvppage.land .pvpact{width:66px;height:56px;background:rgba(255,255,255,.82);backdrop-filter:blur(3px)}
.pvppage.land .pvppad-r{grid-template-columns:repeat(3,1fr)}
.pvppage.land .pvppad-r .pvpact.rocket{grid-column:auto}
.pvppage.land .pvpact.punch{background:linear-gradient(135deg,#e2865fee,#d05f43ee)}
.pvppage.land .pvpact.kick{background:linear-gradient(135deg,#c9a227ee,#a8791bee)}
/* the quiz takes the middle of the screen when it interrupts */
/* ── the question has to WIN against the backdrop ──
   A text-shadow is enough over a flat plate and hopeless over a lit city: at
   full screen the question was sitting on top of ten thousand windows and
   simply disappeared into them. It gets a real panel — dark, blurred and
   bordered — so it reads at a glance no matter what is behind it. */
.pvppage.land .pvpuntimed{position:absolute;left:50%;transform:translateX(-50%);top:29%;z-index:10;margin:0;
  width:max-content;max-width:86%;padding:5px 15px;border-radius:999px;
  background:rgba(4,8,18,.74);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  border:1px solid #ffffff24;color:#cfe0ff;text-shadow:none}
.pvppage.land .pvpq{position:absolute;left:50%;transform:translateX(-50%);top:35.5%;z-index:10;margin:0;
  width:max-content;max-width:88%;padding:13px 24px;border-radius:18px;
  background:linear-gradient(180deg,rgba(7,11,24,.93),rgba(3,6,14,.96));
  backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);
  border:1px solid #ffffff2b;box-shadow:0 16px 40px -14px #000,0 0 0 1px rgba(0,0,0,.55);
  font-size:20px;color:#fff;text-shadow:0 2px 6px #000}
.pvppage.land .pvpopts{position:absolute;left:0;right:0;bottom:14px;z-index:11;margin:0;max-width:none;grid-template-columns:repeat(4,1fr);padding:0 14px}
.pvppage.land .pvpopt{padding:12px 6px;background:rgba(255,255,255,.94)}
/* the shot clock and the keyboard take the same over-the-stage treatment the
   question and the option row already had — a quiz element that stays in the
   portrait flow while everything around it goes absolute lands behind the
   fighters, which is exactly where it cannot be read */
.pvppage.land .pvpshot{position:absolute;left:50%;transform:translateX(-50%);top:24.5%;z-index:11;margin:0;width:min(46%,260px)}
.pvppage.land .pvpshot-l{position:absolute;left:50%;transform:translateX(-50%);top:20.5%;z-index:11;margin:0;
  width:max-content;max-width:86%;padding:3px 12px;border-radius:999px;
  background:rgba(4,8,18,.74);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid #ffffff24}
.pvppage.land .pvpkeys{position:absolute;left:14px;right:14px;bottom:12px;z-index:11;margin:0;width:auto;max-width:none;height:86px}
.pvppage.land .pvpfreesp{position:absolute;left:50%;transform:translateX(-50%);top:15.5%;z-index:11;margin:0;width:max-content;max-width:86%}
/* skills sit between the two thumbs, where nothing else is competing */
.pvppage.land .pvpskills{position:absolute;left:50%;transform:translateX(-50%);bottom:14px;z-index:9;width:min(42%,260px);max-width:none;margin:0;padding:0}
.pvppage.land .pvpskbtns{grid-template-columns:1fr 1fr;gap:6px;margin-top:5px}
.pvppage.land .pvpskbtn{padding:5px 4px;background:rgba(255,255,255,.8)}
.pvppage.land .pvpskbtn-ic{width:19px;height:19px}
.pvppage.land .pvpskbtn b{font-size:9.5px}
.pvppage.land .pvpskbtn i{display:none}
@media (orientation:landscape) and (max-height:520px){
  .pvppage.land .pvpfighter{height:52%}
  .pvppage.land .pvpq{font-size:16px;top:33%;padding:10px 18px}
  .pvppage.land .pvpuntimed{top:26%}
  .pvppage.land .pvpshot{top:22%}
  .pvppage.land .pvpshot-l{top:17.5%}
  .pvppage.land .pvpkeys{height:74px}
}
/* the fighter braces while guarding */
.pvpfighter.guard{filter:drop-shadow(0 0 10px #5ce1ff)}
/* combo counter: it pops on every increment because the key changes */
.pvpcombo{position:absolute;left:50%;top:32%;transform:translateX(-50%);z-index:5;display:flex;flex-direction:column;align-items:center;pointer-events:none;animation:pvpcb .32s cubic-bezier(.34,1.6,.5,1)}
.pvpcombo b{font-family:'Orbitron',sans-serif;font-size:30px;font-weight:800;color:#ffb489;line-height:1;
  text-shadow:0 0 18px #d97757,0 2px 6px #000,0 0 3px #000,2px 0 3px #000,-2px 0 3px #000,0 -2px 3px #000}
.pvpcombo i{font-family:'Orbitron',sans-serif;font-style:normal;font-size:9px;letter-spacing:2px;color:#ffd0b6;text-shadow:0 0 10px #d97757,0 1px 3px #000}
@keyframes pvpcb{0%{transform:translateX(-50%) scale(1.7);opacity:.4}100%{transform:translateX(-50%) scale(1);opacity:1}}
.pvpbanner{position:absolute;left:0;right:0;top:44%;z-index:6;text-align:center;font-family:'Orbitron',sans-serif;font-size:20px;font-weight:800;color:#ffd6a8;text-shadow:0 0 22px #d97757,0 0 6px #ff9a4c,0 2px 8px #000;pointer-events:none;animation:pvpbn .45s cubic-bezier(.34,1.5,.5,1)}
@keyframes pvpbn{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}
/* overdrive lights the whole arena */
.pvpstage.od{box-shadow:inset 0 0 0 2px #ffd23f,0 0 24px -6px #ffd23f}
.pvpstage.od::after{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;background:radial-gradient(120% 90% at 50% 50%,rgba(255,210,63,0) 40%,rgba(255,210,63,.28) 100%);animation:pvpod .5s ease-in-out infinite alternate}
@keyframes pvpod{from{opacity:.5}to{opacity:1}}
/* comeback: a slow red pulse at the frame edge says "still in this" without
   covering the fight the way a banner would if it never went away */
.pvpstage.comeback{box-shadow:inset 0 0 0 2px #ff4d6a,0 0 30px -8px #ff4d6a}
.pvpstage.comeback::before{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;background:radial-gradient(120% 90% at 50% 100%,rgba(255,45,85,.22),rgba(255,45,85,0) 62%);animation:pvpcomeback 1.1s ease-in-out infinite}
@keyframes pvpcomeback{0%,100%{opacity:.55}50%{opacity:1}}
/* sudden death: gold hazard striping, because the next hit ends everything */
.pvpstage.sudden{box-shadow:inset 0 0 0 2px #ffd23f,0 0 30px -6px #ff2d55}
.pvpsuddenbar{max-width:520px;margin:12px auto 0;padding:6px 10px;border-radius:20px;text-align:center;
  background:linear-gradient(90deg,#ff2d55,#ffd23f);color:#1a0d06;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:800;letter-spacing:.06em;
  animation:pvpsuddenpulse 1s ease-in-out infinite}
@keyframes pvpsuddenpulse{0%,100%{opacity:.86;transform:scale(1)}50%{opacity:1;transform:scale(1.02)}}
/* the opponent's super gauge, under its health bar — thin, and it burns when
   it is full, because that is the moment the player has to react to */
.pvpbotgauge{height:3px;margin-top:3px;border-radius:2px;background:#ffffff1f;overflow:hidden}
.pvpbotgauge i{display:block;height:100%;border-radius:2px;background:#ff7a3c;transition:width .2s linear}
.pvpbotgauge.full i{background:linear-gradient(90deg,#ff2d55,#ffd23f);animation:pvpbotgfull .45s ease-in-out infinite alternate}
@keyframes pvpbotgfull{from{opacity:.6}to{opacity:1}}

/* ══════════ round two: hitstop, the corner, the guard meter ══════════ */

/* HITSTOP. The frame the blow lands, the whole stage holds: a hard punch of
   brightness and a shove in the direction the hit was travelling, then it is
   gone. It is over in a tenth of a second and it is the single thing players
   feel most. The transition is deliberately absent — a hitstop that eases is
   not a hitstop. */
/* the weekly boss wears its rule on the lobby card, in the warning colour */
.pvpbossrule{display:block;margin:3px 0 1px;font-style:normal;font-family:'Share Tech Mono',monospace;
  font-size:9.5px;line-height:1.35;letter-spacing:.2px;color:#d97757}

.pvpstage.hitstop{filter:brightness(1.22) contrast(1.08)}
.pvpstage.hitstop.hs-r{transform:translateX(3px)}
.pvpstage.hitstop.hs-l{transform:translateX(-3px)}
@media (prefers-reduced-motion:reduce){
  .pvpstage.hitstop.hs-r,.pvpstage.hitstop.hs-l{transform:none}
}

/* THE CORNER. The wall the trapped fighter is pinned against lights up on
   their side only, so which of you is in trouble is readable at a glance.
   These are real elements, not pseudo-elements: .pvpstage::after is already
   the floor and ::before is already the vignette, and quietly replacing
   either of them would delete the stage to draw a wall on it. */
.pvpwall{position:absolute;top:0;bottom:0;width:34px;z-index:4;pointer-events:none;opacity:0;transition:opacity .18s ease}
.pvpwall.l{left:0;background:linear-gradient(90deg,rgba(255,45,85,.5),rgba(255,45,85,0))}
.pvpwall.r{right:0;background:linear-gradient(270deg,rgba(255,210,63,.5),rgba(255,210,63,0))}
.pvpstage.cornerme .pvpwall.l,.pvpstage.cornerop .pvpwall.r{opacity:1;animation:pvpcornerpulse .9s ease-in-out infinite}
@keyframes pvpcornerpulse{0%,100%{opacity:.55}50%{opacity:1}}

/* THE STAGGER. Three seconds with the guard gone. The stage runs a red bias
   the whole time so the player knows the window is still open without having
   to watch a number. */
.pvpstage.staggered{box-shadow:inset 0 0 0 2px #ff2d55aa,inset 0 0 60px -10px #000}
.pvpstagger{position:absolute;left:50%;top:-14px;transform:translateX(-50%);z-index:6;
  font-family:'Orbitron',sans-serif;font-size:15px;font-weight:900;color:#ff2d55;
  text-shadow:0 0 10px #ff2d55,0 2px 4px #000;animation:pvpstaggershake .32s linear infinite}
@keyframes pvpstaggershake{0%,100%{transform:translateX(-50%) rotate(-9deg)}50%{transform:translateX(-52%) rotate(9deg)}}

/* THE GUARD METER, worn by the button it belongs to. */
.pvpdir.grd{position:relative;overflow:hidden}
.pvpgmtr{position:absolute;left:6px;right:6px;bottom:5px;height:3px;border-radius:2px;background:#3d86c633;overflow:hidden}
.pvpgmtr i{display:block;height:100%;border-radius:2px;background:#3d86c6;transition:width .18s linear}
.pvpdir.grd.spent{border-color:#ff2d5566;color:#ff2d55;opacity:.72}
.pvpdir.grd.spent .pvpgmtr i{background:#ff2d55}

/* ══════════ the stage knows which round it is ══════════
   Round 1 is the room as designed. Round 2 drops the light and closes the
   walls in. The decider burns — if a match has come this far it should not
   look like the round that opened it. */
.pvpstage.r2{filter:saturate(1.12) brightness(.92);border-color:#ffffff2e}
.pvpstage.r3{filter:saturate(1.3) brightness(.88) hue-rotate(-8deg);border-color:#ff4d6a4d;
  box-shadow:inset 0 0 60px -10px #000,inset 0 -40px 60px -40px #ff2d5566}
/* the decider gets a crowd: a slow warm wash rising off the floor, which is
   the cheapest way to make a room sound louder without a sound */
.pvpstage.r3 .pvpwall{opacity:.4}

/* the finisher hold: the loser desaturates and drops back, the winner gets
   the light — a beat of stillness before the result screen instead of the
   fight just quietly ending */
.pvpstage.finisher .pvpfighter{transition:filter .5s ease,opacity .5s ease}
.pvpstage.finisher .pvpfighter-in{transition:transform .5s ease}
.pvpstage.finisher.win .pvpfighter.op{filter:grayscale(.7) brightness(.55)}
.pvpstage.finisher.win .pvpfighter.me{filter:drop-shadow(0 0 22px #ffd23f) brightness(1.12)}
.pvpstage.finisher.win .pvpfighter.me .pvpfighter-in{transform:scale(1.06)}
.pvpstage.finisher.lose .pvpfighter.me{filter:grayscale(.7) brightness(.55)}
.pvpstage.finisher.lose .pvpfighter.op{filter:drop-shadow(0 0 22px #ff4d6a) brightness(1.12)}
.pvpstage.finisher.lose .pvpfighter.op .pvpfighter-in{transform:scale(1.06)}
/* ── the announcer ──
   Every call the cabinet makes, in the one place the eye is already looking.
   Each kind gets its own colour so ROUND 2 and K.O. never read the same. */
.pvpann{position:absolute;left:0;right:0;top:34%;z-index:9;text-align:center;pointer-events:none;
  display:flex;flex-direction:column;align-items:center;gap:4px;animation:pvpannIn .4s cubic-bezier(.2,1.5,.4,1)}
.pvpann b{font-family:'Orbitron',sans-serif;font-size:38px;font-weight:900;letter-spacing:.04em;line-height:1;
  color:#fff;text-shadow:0 0 26px currentColor,0 3px 10px #000,0 0 4px #000}
.pvpann i{font-family:'Rajdhani',sans-serif;font-style:normal;font-size:12.5px;font-weight:700;color:#e9f1ff;text-shadow:0 2px 6px #000}
.pvpann.round b{color:#7fd7ff}
.pvpann.fight b{color:#ffd23f;font-size:46px;animation:pvpannPunch .45s cubic-bezier(.2,1.6,.4,1)}
.pvpann.ko b{color:#ff4d6a;font-size:48px}
.pvpann.perfect b{color:#ffd23f;font-size:44px}
.pvpann.win b{color:#3ddc84}
.pvpann.lose b{color:#8899aa}
@keyframes pvpannIn{0%{transform:scale(1.9);opacity:0}55%{opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes pvpannPunch{0%{transform:scale(2.6) rotate(-6deg);opacity:0}60%{opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
/* the bot's wind-up, and its guard — both have to be readable at a glance or
   blocking and punishing are guesswork */
.pvpfighter.tell{filter:drop-shadow(0 0 14px #ffd23f) brightness(1.12)}
.pvptell{position:absolute;top:-6px;left:50%;transform:translateX(-50%);z-index:6;
  font-family:'Orbitron',sans-serif;font-size:26px;font-weight:900;color:#ffd23f;
  text-shadow:0 0 14px #ff9a3c,0 2px 6px #000;animation:pvptellPulse .3s ease-in-out infinite alternate}
@keyframes pvptellPulse{from{transform:translateX(-50%) scale(.9)}to{transform:translateX(-50%) scale(1.15)}}
.pvpguardic{position:absolute;top:14%;left:50%;transform:translateX(-50%);z-index:6;font-size:19px;filter:drop-shadow(0 0 8px #5ce1ff)}
.pvpdizzy{position:absolute;top:-4px;left:50%;transform:translateX(-50%);z-index:6;font-size:15px;letter-spacing:2px;color:#ffd23f;
  text-shadow:0 0 12px #ffd23f;animation:pvpdizzySpin 1.1s linear infinite}
@keyframes pvpdizzySpin{from{transform:translateX(-50%) rotate(0)}to{transform:translateX(-50%) rotate(360deg)}}
/* training-mode input read-out */
.pvpinputs{display:flex;justify-content:center;gap:5px;max-width:520px;margin:7px auto 0}
.pvpinputs span{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;
  background:rgba(8,12,22,.72);border:1px solid #ffffff2e;color:#7fd7ff;font-size:11px;
  animation:pvpinIn .16s ease}
@keyframes pvpinIn{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
.pvpko{position:absolute;left:0;right:0;top:38%;z-index:7;text-align:center;pointer-events:none}
.pvpko b{display:inline-block;font-family:'Orbitron',sans-serif;font-size:44px;font-weight:900;letter-spacing:.04em;
  color:#fff;text-shadow:0 0 30px #ffd23f,0 0 10px #ff9a4c,0 3px 10px #000;animation:pvpkoZoom .6s cubic-bezier(.2,1.4,.4,1)}
@keyframes pvpkoZoom{0%{transform:scale(2.6);opacity:0}55%{opacity:1}100%{transform:scale(1);opacity:1}}
/* the one-time guard tutorial: dead centre, dismiss-anywhere, gone for good
   the moment it has been seen once */
.pvptut{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(4,8,16,.55);backdrop-filter:blur(2px);cursor:pointer;animation:pvptutIn .25s ease}
@keyframes pvptutIn{from{opacity:0}to{opacity:1}}
.pvptut-card{max-width:280px;padding:18px 20px;border-radius:16px;background:var(--card);border:1px solid var(--bd1);box-shadow:0 20px 50px -18px #000;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}
.pvptut-card .pvptut-ic{font-size:30px;line-height:1}
.pvptut-card b{font-family:'Rajdhani',sans-serif;font-size:14.5px;font-weight:700;color:var(--text)}
.pvptut-card i{font-style:normal;font-size:11px;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.pvpcombo,.pvpbanner{animation:none}.pvpstage.od::after{animation:none}.pvpstage.comeback::before{animation:none}.pvpsuddenbar{animation:none}.pvpko b{animation:none}.pvptut{animation:none}}
.pvpskills{max-width:520px;margin:14px auto 0;padding:0 13px}
.pvpgauge{height:7px;border-radius:20px;background:var(--card2);border:1px solid var(--bd1);overflow:hidden}
.pvpgauge i{display:block;height:100%;transition:width .3s}
.pvpskbtns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.pvpskbtn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 6px;border-radius:13px;border:1px solid var(--bd1);background:var(--card2);cursor:not-allowed;opacity:.6}
.pvpskbtn.on{cursor:pointer;opacity:1;background:var(--card);border-color:color-mix(in srgb,var(--cc) 50%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--cc) 22%,transparent)}
.pvpskbtn.ult.on{border-color:#ffd23f;box-shadow:0 0 0 1px #ffd23f55}
.pvpskbtn-ic{display:block;width:26px;height:26px}
.pvpskbtn-ic svg{display:block;width:100%;height:100%}
.pvpskbtn b{font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:700;color:var(--text);text-align:center;line-height:1.2}
.pvpskbtn i{font-style:normal;font-size:9px;line-height:1.3;color:var(--muted);text-align:center}
.pvpres{padding:16px 13px;border-radius:16px;background:var(--card);border:1px solid var(--bd1);text-align:center}
.pvpres.win{border-color:#ffd23f88;box-shadow:0 0 0 1px #ffd23f33}
.pvpres-stage{height:210px;display:flex;align-items:center;justify-content:center}
.pvpres-stage svg{display:block;height:206px;width:auto}
.pvpres-score{font-family:'Orbitron',sans-serif;font-size:30px;font-weight:800;color:#d97757}
.pvpres-line{font-family:'Rajdhani',sans-serif;font-style:italic;font-size:12.5px;color:var(--muted);margin-top:2px}
/* the round score, read the way a cabinet prints it */
.pvpres-rounds{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:6px}
.pvpres-rounds span{font-family:'Orbitron',sans-serif;font-size:22px;font-weight:900;color:var(--muted);min-width:20px}
.pvpres-rounds span.on{color:#ffd23f;text-shadow:0 0 14px #ffd23f66}
.pvpres-rounds em{font-style:normal;font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.12em;color:var(--muted)}
.pvpres-sub{font-size:11px;color:var(--muted);margin-top:4px}
.pvpres-flawless{margin-top:9px;display:inline-block;padding:4px 12px;border-radius:20px;font-family:'Orbitron',sans-serif;font-size:10.5px;font-weight:800;letter-spacing:.03em;
  color:#1a1206;background:linear-gradient(90deg,#ffd23f,#ff9a4c);box-shadow:0 4px 14px -4px #d9775788}
.pvpres-rew{display:flex;justify-content:center;gap:12px;margin-top:10px;font-family:'Share Tech Mono',monospace;font-size:12px;color:var(--text)}
.pvpres-rank{margin-top:9px;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;color:var(--cc)}
.pvpbig{width:100%;margin-top:11px;padding:13px 10px;border:none;border-radius:13px;background:linear-gradient(135deg,#e2865f,#d05f43);color:#fff;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer}
.pvpres-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}
.pvpghost{padding:12px 8px;border-radius:12px;border:1px solid var(--bd1);background:var(--card);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;color:var(--text);cursor:pointer}
@media (max-width:360px){.pvpstage{height:232px}.pvpfighter{height:168px}.pvpfighter svg{height:166px}.pvpq{font-size:14px}}
.battlecard-soon.as-btn{display:block;width:100%;text-align:left;cursor:pointer;border:1px solid color-mix(in srgb,#d97757 34%,transparent);background:#d9775712;color:#b4522f;border-radius:11px;padding:9px 11px;font-family:inherit;line-height:1.45}
.battlecard-soon.as-btn:hover{background:#d9775720}
.mdv{max-width:440px!important;width:calc(100% - 22px);max-height:93vh!important;display:flex;flex-direction:column;overflow:hidden;background:var(--card)!important;border-color:var(--bd1)!important;box-shadow:0 24px 60px -20px rgba(20,30,60,.45)!important}
.mdv-hdr{display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:1px solid var(--bd1);flex-shrink:0}
.mdv-ttl{display:flex;align-items:baseline;gap:7px;margin-right:auto;font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:700;color:var(--text)}
.mdv-ttl b{font-family:'Orbitron',sans-serif;font-size:9.5px;font-weight:700;color:#d97757}
.mdv-cls{display:inline-flex;align-items:center;gap:5px;padding:3px 9px 3px 4px;border-radius:20px;background:color-mix(in srgb,var(--cc) 12%,transparent);border:1px solid color-mix(in srgb,var(--cc) 42%,transparent);color:var(--cc);font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;white-space:nowrap}
.mdv-cls-ic{display:block;width:16px;height:16px;flex:none}
.mdv-cls-ic svg{display:block;width:100%;height:100%}
.mdv-body{flex:1;overflow-y:auto;padding:12px 14px 4px}
.mdv-stage{position:relative;height:clamp(290px,46vh,372px);border-radius:14px;background:linear-gradient(178deg,#ffffff 0%,#f6f8fc 52%,#e9edf4 100%);border:1px solid var(--bd1);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:inset 0 -26px 32px -28px rgba(20,30,60,.2)}
.mdv-stage>svg{display:block;height:calc(100% - 14px);width:auto;filter:drop-shadow(0 10px 12px rgba(20,30,60,.24))}
.mdv-drag{position:absolute;inset:0;z-index:2;touch-action:pan-y;cursor:grab;outline:none}
.mdv-drag:active{cursor:grabbing}
.mdv-turn{z-index:3}
.mdv-sub{margin:9px 2px 2px;font-size:12px;color:var(--muted)}
.mdv-sec{margin-top:14px;padding-top:12px;border-top:1px solid var(--bd1)}
.mdv-sec-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:700;color:var(--text)}
.mdv-sec-h b{font-family:'Orbitron',sans-serif;font-size:12px;color:#d97757}
.mdv-pros{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
.mdv-pro,.mdv-con{padding:2.5px 9px;border-radius:20px;font-family:'Rajdhani',sans-serif;font-size:10.5px;font-weight:700}
.mdv-pro{background:#1f9d6b18;border:1px solid #1f9d6b55;color:#17805a}
.mdv-con{background:#d0554518;border:1px solid #d0554555;color:#b4452f}
.mdv-fair{margin-top:8px;font-size:9.5px;line-height:1.45;color:var(--muted)}
.mdv-skill{display:flex;gap:9px;align-items:flex-start;padding:9px 0;border-top:1px dashed var(--bd1)}
.mdv-skill:first-of-type{border-top:none}
.mdv-skill-ic{display:block;width:32px;height:32px;flex:none;margin-top:1px}
.mdv-skill-ic svg{display:block;width:100%;height:100%}
.mdv-skill-b{display:flex;flex-direction:column;gap:2px;min-width:0}
.mdv-skill-n{font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.mdv-skill-n i{font-style:normal;padding:1px 6px;border-radius:20px;font-size:8.5px;letter-spacing:.4px;background:#14141310;color:var(--muted)}
.mdv-skill.t-active .mdv-skill-n i{background:#3d86c61f;color:#2b6ca8}
.mdv-skill.t-ultimate .mdv-skill-n i{background:#d9775722;color:#c0603f}
.mdv-skill-d{font-size:11px;line-height:1.45;color:var(--muted)}
.mdv-foot{padding:10px 14px 13px;border-top:1px solid var(--bd1);flex-shrink:0}
.mdv-buy{width:100%;padding:13px 10px;border:none;border-radius:12px;background:linear-gradient(135deg,#e2865f,#d05f43);color:#fff;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;letter-spacing:.3px;cursor:pointer;box-shadow:0 6px 20px -8px #d97757}
.mdv-buy:hover{filter:brightness(1.06)}
.mdv-buy.poor{background:var(--card2);color:var(--muted);border:1px solid var(--bd1);box-shadow:none;cursor:not-allowed}
.mdv-buy.on{background:#00a6bd1a;color:#00879b;border:1px solid #00a6bd66;box-shadow:none;cursor:default}
.battlecard-skills{margin-top:9px;padding-top:4px;border-top:1px solid var(--bd1)}
.mdlpick-spn{font-size:11px;color:var(--muted)}
.shopitem-cls{font-family:'Rajdhani',sans-serif;font-size:8.5px;font-weight:700;letter-spacing:.3px;padding:1px 7px;border-radius:20px;background:color-mix(in srgb,var(--cc) 14%,transparent);border:1px solid color-mix(in srgb,var(--cc) 40%,transparent);color:var(--cc)}
/* ── combat profile ──
   Four bars, semantic colours, tabular figures. The bars are a comparison tool
   before they are decoration: on the shop shelf they run compact and unlabelled
   so twenty chassis can be read down a column at a glance. */
.statbars{display:flex;flex-direction:column;gap:4px;width:100%}
.statrow{display:flex;align-items:center;gap:7px}
.statlbl{flex:none;width:56px;font-family:'Rajdhani',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.4px;color:var(--muted)}
.stattrack{flex:1;height:7px;border-radius:20px;background:#14141310;overflow:hidden}
.stattrack i{display:block;height:100%;border-radius:20px;transition:width .3s ease}
.statval{flex:none;width:18px;text-align:right;font-family:'Orbitron',sans-serif;font-size:9.5px;color:var(--text);font-variant-numeric:tabular-nums}
.statbars.compact{gap:2.5px;margin:3px 0 1px}
.statbars.compact .stattrack{height:4px}
.battlecard{margin-top:10px;padding:11px 12px 10px;border-radius:12px;background:var(--card2);border:1px solid var(--bd1)}
.battlecard-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;color:var(--text)}
.battlecard-t{font-family:'Orbitron',sans-serif;font-size:13px;color:#d97757}
.battlecard-sp{display:flex;align-items:center;gap:7px;margin-top:9px;padding-top:8px;border-top:1px solid var(--bd1);font-size:11px;color:var(--text)}
.battlecard-sp b{font-family:'Rajdhani',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.4px;color:var(--muted)}
.battlecard-soon{margin-top:7px;font-size:10px;line-height:1.45;color:var(--muted)}
.mdlpick-stats{margin-top:4px;padding:10px 2px 0;border-top:1px solid var(--bd1)}
.mdlpick-sp{display:flex;gap:7px;align-items:center;margin-top:9px;font-size:11px;color:var(--text)}
.mdlpick-sp b{font-family:'Rajdhani',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.4px;color:var(--muted)}
.mdlpick-fair{margin-top:6px;font-size:9.5px;line-height:1.4;color:var(--muted)}
.shopitem-sp{font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:700;color:#8a86e0;text-align:center;line-height:1.2}
.shop-full .shopitem-sp{color:#7b6fd0}
.shop-full .stattrack{background:#14141312}
/* ── the one-time chassis choice ──
   Light, like the shop it shares a catalogue with: a black grid of cards inside
   a warm off-white app reads as a different product, and the drawn heads have
   plenty of contrast of their own without a dark ground to sit on. */
.mdlpick-ov{align-items:center;justify-content:center}
.mdlpick{max-width:430px!important;width:calc(100% - 24px);max-height:92vh!important;display:flex;flex-direction:column;overflow:hidden;background:var(--card)!important;border-color:var(--bd1)!important;box-shadow:0 24px 60px -20px rgba(20,30,60,.45)!important}
.mdlpick-hdr{padding:14px 16px 10px;border-bottom:1px solid var(--bd1);flex-shrink:0}
.mdlpick-ttl{font-family:'Orbitron',sans-serif;font-size:15px;font-weight:700;color:#d97757}
.mdlpick-sub{margin-top:5px;font-size:11.5px;line-height:1.45;color:var(--muted)}
.mdlpick-body{flex:1;overflow-y:auto;padding:12px 14px}
.mdlpick-stage{height:250px;border-radius:14px;background:linear-gradient(178deg,#ffffff 0%,#f6f8fc 52%,#e9edf4 100%);border:1px solid var(--bd1);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:inset 0 -24px 30px -26px rgba(20,30,60,.18)}
.mdlpick-stage svg{display:block;height:238px;width:auto;filter:drop-shadow(0 8px 10px rgba(20,30,60,.22))}
.mdlpick-info{display:flex;align-items:baseline;gap:8px;padding:9px 2px 11px;flex-wrap:wrap}
.mdlpick-code{font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;color:#d97757}
.mdlpick-name{font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:700;color:var(--text)}
.mdlpick-cls{font-size:11px;color:var(--muted)}
.mdlpick-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
.mdlpick-grid .char-model-nm{font-size:8.5px}
.mdlpick-foot{padding:11px 14px 14px;border-top:1px solid var(--bd1);flex-shrink:0}
.mdlpick-go{width:100%;padding:12px 10px;border:none;border-radius:12px;background:linear-gradient(135deg,#e2865f,#d05f43);color:#fff;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;letter-spacing:.3px;cursor:pointer;box-shadow:0 6px 20px -8px #d97757}
.mdlpick-go:hover{filter:brightness(1.06)}
/* the tiles: light cards, same language as the shop shelf */
.mdlpick .char-model{background:var(--card2);border-color:var(--bd1)}
.mdlpick .char-model:hover{border-color:#d9775788}
.mdlpick .char-model.on{border-color:#d97757;box-shadow:0 0 0 1px #d9775755,0 4px 14px -6px #d97757;background:linear-gradient(170deg,#d9775714,var(--card2))}
.mdlpick .char-model-code{color:#a8a49a}
.mdlpick .char-model.on .char-model-code{color:#d97757}
.mdlpick .char-model-nm{color:var(--muted)}
.mdlpick .char-model.on .char-model-nm{color:var(--text)}
/* the spend/locked prompts inherit the same daylight */
.mdlask{max-width:340px!important;width:calc(100% - 40px);padding:20px 18px;text-align:center;background:var(--card)!important;border-color:var(--bd1)!important}
.mdlask-ttl{color:#d97757}
.mdlask-txt{color:var(--text)}
.mdlask-head{background:linear-gradient(178deg,#fff,#eef1f7);border-color:var(--bd1)}
.mdlask-no{border-color:var(--bd1);color:var(--muted)}
/* which chassis is running, stated on the character card */
.char-modelpill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:20px;font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;color:#00d3e6;background:#00f0ff14;border:1px solid #00f0ff44}
.char-modelpill b{font-family:'Orbitron',sans-serif;font-size:8.5px;color:#7f93b5}
/* a chassis in the shop sells itself with the head it actually is */
.mdlitem-head{display:block;width:100%;aspect-ratio:1/1.05;margin-bottom:2px}
.mdlitem-head svg{display:block;width:100%;height:100%}
.shopitem.mdlitem{padding:8px 5px 10px;display:grid;grid-template-rows:auto 17px 26px 18px auto 25px 16px;align-content:start;justify-items:center;gap:4px}
.shopitem.mdlitem>*{align-self:center;max-width:100%}
.mdlitem .shopitem-nm{line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mdlitem .shopitem-desc,.mdlitem .shopitem-sp{overflow:hidden}
.shopitem-desc{font-size:9px;line-height:1.25;color:#9fb1cc;text-align:center;padding:0 4px}
@media (max-width:380px){.mdlpick-stage{height:214px}.mdlpick-stage svg{height:204px}.mdlpick-grid{gap:3px}}
/* model bay: five chips, each showing the head it actually selects */
.char-models{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:8px 0 2px}
.char-model{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 2px 4px;background:linear-gradient(170deg,#101728,#070b14);border:1.5px solid #ffffff1f;border-radius:10px;cursor:pointer;transition:border-color .18s,box-shadow .18s,transform .18s;font-family:'Rajdhani',sans-serif;overflow:hidden}
.char-model:hover{border-color:#00ccddaa;transform:translateY(-1px)}
.char-model.on{border-color:#00f0ff;box-shadow:0 0 0 1px #00f0ff55,0 4px 14px -6px #00f0ff,inset 0 0 18px #00f0ff22}
.char-model-thumb{display:block;width:100%;aspect-ratio:1/1.12;pointer-events:none}
.char-model-thumb svg{display:block;width:100%;height:100%}
.char-model-code{font-family:'Orbitron',sans-serif;font-size:7px;font-weight:700;letter-spacing:.08em;color:#6d86ad}
.char-model.on .char-model-code{color:#00f0ff}
.char-model-nm{font-size:9px;font-weight:700;line-height:1.05;color:#9fb1cc;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.char-model.on .char-model-nm{color:#eaf4ff}
.char-layer{font-size:36px;line-height:1;position:relative;z-index:1}

/* ── 3D AAA Character Scene ── */
/* ── the viewport ──
   A daylight studio, not a night club. The app is a warm off-white and a black
   box punched into the middle of a light card reads as a hole in the page, so
   the chamber is lit the way a product shot is: a soft graduated backdrop, a
   pale floor with the grid drawn ON it, a real contact shadow under the feet
   and a bounce card behind. Everything the equipped gear used to tint still
   tints — the key colours just arrive as coloured light on white rather than
   as glow in the dark. */
.charstage{--floor:26px;position:relative;height:372px;margin:2px 0 10px;border-radius:16px;overflow:hidden;background:linear-gradient(178deg,#ffffff 0%,#f7f9fc 46%,#eef1f7 76%,#e4e9f2 100%);border:1px solid #14141314;box-shadow:inset 0 -34px 44px -34px rgba(20,30,60,.16),inset 0 1px 0 #fff,0 8px 26px -16px rgba(20,30,60,.4);isolation:isolate}
/* the two key lights, arriving as coloured bounce off a white cyclorama */
.cs-sky{position:absolute;inset:0;background:radial-gradient(ellipse 66% 62% at 16% 2%,color-mix(in srgb,var(--keyA) 20%,transparent) 0%,transparent 66%),radial-gradient(ellipse 66% 62% at 86% 4%,color-mix(in srgb,var(--keyB) 17%,transparent) 0%,transparent 66%),radial-gradient(ellipse 84% 46% at 50% 104%,color-mix(in srgb,var(--keyA) 13%,transparent) 0%,transparent 72%)}
/* the floor grid, drawn onto the pale floor rather than glowing out of the dark */
.cs-grid{position:absolute;left:-60%;right:-60%;top:calc(100% - var(--floor) - 20px);height:150px;transform:perspective(150px) rotateX(64deg);transform-origin:50% 0%;background-image:linear-gradient(color-mix(in srgb,var(--keyA) 44%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--keyA) 32%,transparent) 1px,transparent 1px);background-size:26px 22px;opacity:.34;-webkit-mask-image:linear-gradient(to bottom,transparent 0%,#000 40%,#000 100%);mask-image:linear-gradient(to bottom,transparent 0%,#000 40%,#000 100%);animation:csGrid 5.5s linear infinite}
@keyframes csGrid{to{background-position:0 22px,0 0}}
/* where the floor meets the backdrop: a soft seam, not a neon strip */
.cs-horizon{position:absolute;left:0;right:0;bottom:calc(var(--floor) + 18px);height:34px;background:linear-gradient(to bottom,transparent,color-mix(in srgb,var(--keyA) 12%,transparent) 60%,transparent);opacity:.9}
/* dust in the light */
.cs-motes{position:absolute;inset:0;pointer-events:none}
.cs-motes i{position:absolute;bottom:-8px;left:calc(6% + var(--i) * 6.6%);width:3px;height:3px;border-radius:50%;background:var(--keyA);box-shadow:0 0 6px 1px color-mix(in srgb,var(--keyA) 45%,transparent);opacity:0;animation:csMote calc(7s + var(--i) * 0.55s) linear infinite;animation-delay:calc(var(--i) * -0.9s)}
.cs-motes i:nth-child(even){background:var(--keyB);box-shadow:0 0 6px 1px color-mix(in srgb,var(--keyB) 45%,transparent);width:2px;height:2px}
@keyframes csMote{0%{transform:translateY(0) translateX(0);opacity:0}12%{opacity:.6}100%{transform:translateY(-286px) translateX(14px);opacity:0}}
/* the 3D scene proper — every layer parallaxes inside ONE preserve-3d space */
.cs-scene{position:absolute;inset:0;perspective:620px;perspective-origin:50% 42%;transform-style:preserve-3d}
/* counter-rotating holo rings around the figure */
.cs-rings{position:absolute;left:50%;bottom:calc(var(--floor) - 26px);width:186px;height:186px;transform:translateX(-50%);transform-style:preserve-3d;pointer-events:none}
.cs-ring{position:absolute;inset:0;border-radius:50%;border:1.5px solid transparent;background:conic-gradient(from 0deg,transparent 0deg,var(--keyA) 40deg,transparent 110deg,transparent 250deg,var(--keyB) 300deg,transparent 350deg) border-box;-webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);mask-composite:exclude;opacity:.6}
.cs-ring1{transform:rotateX(74deg);animation:csSpin 9s linear infinite}
.cs-ring2{inset:24px;transform:rotateX(74deg);animation:csSpin 6.5s linear infinite reverse;opacity:.4}
.cs-ring3{inset:-16px;transform:rotateX(80deg);animation:csSpin 14s linear infinite;opacity:.26}
@keyframes csSpin{to{transform:rotateX(74deg) rotate(360deg)}}
/* lit podium the figure stands on */
.cs-podium{position:absolute;left:50%;bottom:calc(var(--floor) - 28px);width:142px;height:142px;transform:translateX(-50%) rotateX(76deg);transform-style:preserve-3d;pointer-events:none}
.cs-podium-top{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--keyA) 22%,transparent) 0%,color-mix(in srgb,var(--keyB) 11%,transparent) 48%,transparent 72%);border:1.5px solid color-mix(in srgb,var(--keyA) 45%,transparent);box-shadow:0 0 22px 4px color-mix(in srgb,var(--keyA) 16%,transparent)}
.cs-podium-glow{position:absolute;inset:28px;border-radius:50%;border:1px solid color-mix(in srgb,var(--keyB) 38%,transparent);animation:csPulse 3.2s ease-in-out infinite}
@keyframes csPulse{0%,100%{opacity:.3;transform:scale(.94)}50%{opacity:.7;transform:scale(1.04)}}
/* the shadow the figure actually casts on the floor — the single thing that
   stops a light scene reading as a cut-out pasted on a gradient */
.cs-cast{position:absolute;left:50%;bottom:calc(var(--floor) - 6px);width:118px;height:26px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse at 50% 50%,rgba(22,32,58,.4) 0%,rgba(22,32,58,.16) 46%,transparent 72%);pointer-events:none;z-index:1}
/* Deliberately NOT preserve-3d. Each layer below carries a drop-shadow filter,
   and a filtered element that also has a translateZ inside a preserve-3d parent
   gets rasterised by Chromium as an opaque LAYER BOX — which painted a hard-edged
   panel across the chamber behind the character. Depth here comes from scale,
   stacking order and shadow weight instead; the real 3D is left to the podium and
   rings, which carry no filters and so composite cleanly. */
.cs-figure,.cs-reflect{position:absolute;left:50%;bottom:var(--floor);width:127px;height:330px}
.cs-figure{transform:translateX(-50%);animation:csFloat 4.2s ease-in-out infinite}
@keyframes csFloat{0%,100%{translate:0 0}50%{translate:0 -7px}}
.cs-aura{position:absolute;left:-16px;right:-16px;top:10px;height:318px;border-radius:50%;z-index:1;background:radial-gradient(circle,color-mix(in srgb,var(--keyA) 26%,transparent) 0%,color-mix(in srgb,var(--keyB) 12%,transparent) 44%,transparent 72%);filter:blur(13px);animation:csPulse 3.6s ease-in-out infinite}
/* each equipped layer gets rim light in ITS OWN colour, plus real depth offset */
/* Rim light WITHOUT a filter. A drop-shadow() on a layer holding a colour-emoji
   made Chromium rasterise that layer's whole box as an opaque grey panel across
   the chamber — verified by toggling the filter off and watching the panel go.
   A radial gradient behind the glyph gives the same neon bloom, costs less, and
   composites correctly everywhere. */
.cs-layer{position:absolute;left:50%;display:block;line-height:1;text-align:center;text-shadow:0 4px 8px rgba(20,30,60,.35)}
.cs-layer::before{content:"";position:absolute;left:50%;top:50%;width:165%;height:165%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,var(--rim) 0%,transparent 62%);opacity:.32;z-index:-1;pointer-events:none}
/* the drawn avatar fills the figure box; equipped emoji ride on top of it */
.cs-av{position:absolute;inset:0;display:block;z-index:5}
.cs-av svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 10px 12px rgba(20,30,60,.28))}
.ca-visor{animation:caVisor 3.4s ease-in-out infinite}
@keyframes caVisor{0%,100%{opacity:.86}50%{opacity:1}}
.ca-optic{animation:caVisor 2.2s ease-in-out infinite}
.ca-eye{animation:caBlink 6.5s ease-in-out infinite;transform-origin:center;transform-box:fill-box}
@keyframes caBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.12)}}
.ca-mouth{animation:caVisor 2.8s ease-in-out infinite}
/* the CyberLife temple LED: calm blue, then the yellow of an android working
   something out. the CSS color property drives it so ring and core follow together. */
.ca-led{color:#3aa8ff;animation:caLed 5.2s ease-in-out infinite}
@keyframes caLed{0%,58%,100%{color:#3aa8ff}68%,88%{color:#ffc83a}}
.ca-led circle:nth-child(3){transform-origin:center;transform-box:fill-box;animation:caSpin2 3.4s linear infinite}
@keyframes caSpin2{to{transform:rotate(360deg)}}
/* the endoskeleton's optics burn steadily rather than pulsing like a UI light */
.ca-vanguard .ca-optic,.ca-reaper .ca-optic{animation:caEmber 3.6s ease-in-out infinite}
@keyframes caEmber{0%,100%{opacity:.88}50%{opacity:1}}
/* PHANTOM's fissure: the alloy keeps closing itself */
.ca-morph{animation:caMorph 4.4s ease-in-out infinite}
@keyframes caMorph{0%,100%{opacity:.85;transform:translateX(0)}50%{opacity:.3;transform:translateX(1.5px)}}
.ca-core{transform-origin:60px 131px;animation:caCore 2.8s ease-in-out infinite}
@keyframes caCore{0%,100%{opacity:.8;transform:scale(.94) rotate(0deg)}50%{opacity:1;transform:scale(1.06) rotate(180deg)}}
/* equipped gear is drawn art now, so it is sized in px rather than by font */
.cs-layer svg{display:block;width:100%;height:100%;filter:drop-shadow(0 3px 5px rgba(20,30,60,.3))}
.cs-hat{top:-13px;width:38px;height:38px;transform:translateX(-50%);z-index:7;transform-origin:50% 92%}
.cs-wpn,.cs-acc{width:38px;height:38px;z-index:9}
/* Mirrored copy on the floor. transform-origin is the point that matters: the
   default centre origin flips the copy back UP over the figure, which reads as a
   glitch rather than a reflection. Pinning the origin to its own bottom edge
   mirrors it downward from the feet, where a floor reflection belongs. */
.cs-reflect{transform:translateX(-50%) scaleY(-1);transform-origin:50% 100%;opacity:.13;filter:blur(2.5px) saturate(.6);pointer-events:none;-webkit-mask-image:linear-gradient(to top,transparent 6%,#000 58%);mask-image:linear-gradient(to top,transparent 6%,#000 58%)}
.cs-reflect .cs-layer{filter:none}
/* sweep + vignette + corner brackets: the HUD frame around the viewport */
.cs-scan{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,transparent 0%,color-mix(in srgb,var(--keyA) 9%,transparent) 49%,transparent 53%);animation:csScan 4.5s linear infinite}
@keyframes csScan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}
.cs-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 82% 74% at 50% 44%,transparent 52%,rgba(20,30,60,.09) 100%)}
.cs-hud{position:absolute;left:26px;right:26px;top:10px;display:flex;justify-content:space-between;align-items:center;font-family:'Orbitron',sans-serif;font-size:9px;font-weight:700;letter-spacing:.12em;pointer-events:none}
.cs-hud-tag{color:color-mix(in srgb,var(--keyA) 72%,#0b1424)}
.cs-hud-pwr{color:#6b7790}
/* ── turntable ──
   The whole viewport is the drag handle, so the model is turned by grabbing it
   rather than by hunting for a control. touch-action:pan-y is what keeps a
   vertical swipe scrolling the page while a horizontal one spins the figure. */
.cs-drag{position:absolute;inset:0;z-index:8;touch-action:pan-y;cursor:grab;background:transparent;outline:none}
.cs-drag:active{cursor:grabbing}
.cs-drag:focus-visible{box-shadow:inset 0 0 0 2px var(--keyA)}
.cs-turn{position:absolute;left:50%;bottom:7px;z-index:9;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:3px 5px;border-radius:999px;background:rgba(255,255,255,.86);border:1px solid #14141317;box-shadow:0 2px 10px -4px rgba(20,30,60,.4);backdrop-filter:blur(4px)}
.cs-turn-b{display:inline-flex;align-items:center;gap:3px;min-width:24px;height:20px;justify-content:center;padding:0 6px;border:1px solid #1414131f;border-radius:999px;background:#fff;color:#5c6880;font-family:'Orbitron',sans-serif;font-size:9px;font-weight:700;letter-spacing:.06em;cursor:pointer;transition:color .16s,border-color .16s,background .16s}
.cs-turn-b:hover{color:#101828;border-color:var(--keyA)}
.cs-turn-b.wide{padding:0 8px}
.cs-turn-b.on{color:#04121b;background:var(--keyA);border-color:var(--keyA);box-shadow:0 0 10px -3px var(--keyA)}
.cs-turn-ic{font-size:10px;line-height:1}
.cs-turn-deg{min-width:30px;text-align:right;padding-right:3px;font-family:'Orbitron',sans-serif;font-size:9px;font-weight:700;color:#7a8497;font-variant-numeric:tabular-nums}
.cs-turn-hint{position:absolute;left:50%;bottom:33px;z-index:9;transform:translateX(-50%);padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.9);border:1px solid color-mix(in srgb,var(--keyA) 45%,transparent);color:#26324a;font-size:9.5px;font-weight:700;white-space:nowrap;pointer-events:none;box-shadow:0 2px 8px -4px rgba(20,30,60,.4);animation:csHint 2.6s ease-in-out infinite}
@keyframes csHint{0%,100%{opacity:.6}50%{opacity:1}}
.cs-bracket{position:absolute;width:15px;height:15px;pointer-events:none;opacity:.5}
.cs-bracket.tl{top:7px;left:7px;border-top:1.5px solid var(--keyA);border-left:1.5px solid var(--keyA)}
.cs-bracket.tr{top:7px;right:7px;border-top:1.5px solid var(--keyB);border-right:1.5px solid var(--keyB)}
.cs-bracket.bl{bottom:7px;left:7px;border-bottom:1.5px solid var(--keyB);border-left:1.5px solid var(--keyB)}
.cs-bracket.br{bottom:7px;right:7px;border-bottom:1.5px solid var(--keyA);border-right:1.5px solid var(--keyA)}
/* rarity raises the whole chamber's energy, it doesn't just recolour a chip */
.charstage.rar-rare{box-shadow:inset 0 -34px 44px -34px rgba(20,30,60,.16),inset 0 1px 0 #fff,0 8px 26px -16px var(--keyA),0 0 0 1px color-mix(in srgb,var(--keyA) 34%,transparent)}
.charstage.rar-epic .cs-aura{filter:blur(16px);animation-duration:2.6s}
.charstage.rar-epic{box-shadow:inset 0 -34px 44px -34px rgba(20,30,60,.18),inset 0 1px 0 #fff,0 10px 30px -16px var(--keyB),0 0 0 1.5px color-mix(in srgb,var(--keyB) 45%,transparent)}
.charstage.rar-legendary .cs-aura{filter:blur(19px);animation-duration:2s}
.charstage.rar-legendary .cs-ring1,.charstage.rar-legendary .cs-ring2{opacity:.85}
.charstage.rar-legendary{box-shadow:inset 0 -34px 44px -34px rgba(20,30,60,.2),inset 0 1px 0 #fff,0 12px 34px -14px #ffb300,0 0 0 1.5px #ffb30099}
@media (prefers-reduced-motion:reduce){.ca-visor,.ca-optic,.ca-core,.ca-eye,.ca-mouth,.ca-led,.ca-led circle,.ca-morph,.cs-grid,.cs-motes i,.cs-ring1,.cs-ring2,.cs-ring3,.cs-podium-glow,.cs-figure,.cs-aura,.cs-scan,.cs-turn-hint{animation:none}}
@media (max-width:380px){.charstage{height:344px;--floor:22px}.cs-figure,.cs-reflect{width:114px;height:296px}.cs-aura{height:286px}.cs-cast{width:104px}.cs-hat{width:34px;height:34px;top:-11px}.cs-wpn,.cs-acc{width:34px;height:34px}.char-models{gap:3px}.char-model-nm{font-size:8px}}
.char-slots{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
.char-slot{display:flex;align-items:center;gap:6px;background:#f5f5f5;border:1px solid #eee;border-radius:8px;padding:6px 10px;font-size:12px}
.char-slot-ic{font-size:18px}
.char-slot-nm{font-weight:700;color:#333;flex:1}
.char-slot-rare{font-size:9px;font-weight:700;color:#00ccdd;text-transform:uppercase;letter-spacing:.3px;font-family:'Orbitron',sans-serif}
.trial-banner{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 16px;background:#d97757;color:#fff}
.trial-banner-txt{font-size:13px;font-weight:700;font-family:'Rajdhani',sans-serif;letter-spacing:.3px}
.trial-banner-btn{flex-shrink:0;background:rgba(255,255,255,.22);border:1.5px solid rgba(255,255,255,.5);color:#fff;border-radius:8px;padding:5px 13px;font-size:12px;font-weight:800;font-family:'Orbitron',sans-serif;cursor:pointer;white-space:nowrap}
.trial-expired{background:var(--card2);border-left:3px solid #d97757;padding:12px 16px;margin:8px 16px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.billtoggle{display:flex;gap:8px;background:var(--card);border-radius:24px;padding:4px;margin-bottom:14px}
.billtog{flex:1;padding:9px;border-radius:20px;background:transparent;border:none;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.billtog.on{background: #d97757;color:#fff}
.billtog-b2b{font-size:10.5px;line-height:1.2;letter-spacing:.2px;white-space:normal}
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
.paychanbtn{flex:1;padding:9px 6px;border:1.5px solid var(--bd2);border-radius:10px;background:var(--card2);cursor:pointer;font-size:13px;font-weight:600;color:var(--text2);transition:all .15s;text-align:center}
.paychanbtn.on{border-color:#d97757;background:rgba(217,119,87,.12);color:#d97757}
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
/* struggle tags doubling as "ask TIGA about this" buttons (SRS review modal,
   Auto Teaching recap) — a plain element reset since .pd-tag also still
   renders as an inert <span> elsewhere (mastered/recent tags) */
button.pd-tag{cursor:pointer;font-family:inherit}
button.pd-tag.focus:hover{background:rgba(217,119,87,.22)}
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
.chestwheel{position:relative;width:150px;height:150px;margin:8px auto 4px}
.chestwheel-ring{position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(#2a2a3a 0deg 45deg,#1c1c28 45deg 90deg);border:3px solid #d97757;box-shadow:0 0 30px -4px #d9775799,inset 0 0 16px -4px #000;transition:transform 2.4s cubic-bezier(.15,.68,.14,1)}
.cw-seg{position:absolute;top:50%;left:50%;width:24px;height:24px;margin:-12px 0 0 -12px;display:flex;align-items:center;justify-content:center;font-size:19px}
.chestwheel-ptr{position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:20px;color:#ffd23f;filter:drop-shadow(0 0 6px #ffd23f);z-index:2}
.chestwheel-hub{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:var(--card);border:2px solid #d97757;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 0 14px -2px #000;z-index:1}
.songbonus{position:absolute;left:0;right:0;top:28%;text-align:center;font-family:'Orbitron',sans-serif;font-size:24px;font-weight:900;color:#d97757;text-shadow:0 0 18px #d97757;pointer-events:none;animation:judgepop .9s ease-out forwards;z-index:6}
/* Between-run recap toast (auto-loop / setlist chaining) — sits centered over
   the paused canvas for the ~1.8s gap before the next song starts. */
.looprecap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(5,4,20,.72);z-index:7;animation:fadein .25s}
.looprecap-stars{font-size:30px;color:#d97757;letter-spacing:4px;text-shadow:0 0 18px #d9775766}
.looprecap-row{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:#fff}
.looprecap-next{font-family:'Share Tech Mono',monospace;font-size:12px;color:#c4b5fd;margin-top:4px}
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
.eventbanner{position:fixed;top:0;left:0;right:0;z-index:850;display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 12px;padding-top:calc(6px + env(safe-area-inset-top,0px));background:linear-gradient(90deg,#d97757,#a855f7);font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:700;color:#fff;text-align:center;flex-wrap:wrap;box-shadow:0 2px 10px -2px #000}
.eventbanner-mult{font-family:'Orbitron',sans-serif;font-size:10px;background:rgba(255,255,255,.2);border-radius:10px;padding:2px 8px}
.eventbanner-spot{font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;color:#fff;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.4);border-radius:10px;padding:2px 10px;cursor:pointer}
.eventbanner-spot:hover{background:rgba(0,0,0,.3)}
.mascot{position:fixed;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:900;cursor:pointer;animation:mascotidle 2.6s ease-in-out infinite;will-change:transform}
.mascot-face{font-size:38px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))}
.mascot.happy{animation:mascothop .5s ease-out}
.mascot.celebrate{animation:mascotcheer .6s ease-out infinite}
.mascot.sad{animation:mascotsad .5s ease-in-out}
.mascot-spark{position:absolute;top:-6px;right:-6px;font-size:18px;animation:flamepulse .5s ease-in-out infinite alternate}
@keyframes mascotidle{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes mascothop{0%{transform:translateY(0)}40%{transform:translateY(-16px)}100%{transform:translateY(0)}}
@keyframes mascotcheer{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-12px) rotate(6deg)}}
@keyframes mascotsad{0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(4px) rotate(-4deg)}60%{transform:translateY(4px) rotate(4deg)}}
/* cosmetics shop + key-skins + themes */
.shopsec{display:flex;align-items:center;gap:8px;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:var(--text2);letter-spacing:1px;margin:16px 0 8px}
.shopsec:first-child{margin-top:0}
.shopgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.shopitem{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 6px 10px;border-radius:12px;border:1px solid #00f0ff22;background:linear-gradient(135deg,#0a0015,#1a0033);color:#c0c0e0;cursor:pointer}
.shopitem:active{transform:scale(.96)}
.shopitem.equipped{border-color:#00f0ff;box-shadow:0 0 0 1px #00f0ff,0 0 14px -4px #00f0ff}
/* rarity border tint — common stays neutral, higher tiers get a colored ring so
   pricier items visibly look more special even before reading the coin cost */
.shopitem.rare{border-color:#00f0ff44;box-shadow:0 0 8px -4px #00f0ff55}
.shopitem.epic{border-color:#aa00ff77;box-shadow:0 0 10px -4px #aa00ffaa,0 0 16px -6px #00f0ff44}
.shopitem.legendary{border-color:#ffd23f;box-shadow:0 0 14px -3px #ffd23faa,0 0 20px -6px #aa00ff}
.shopitem.legendary.equipped{border-color:#ffd23f;box-shadow:0 0 0 1px #ffd23f,0 0 16px -3px #ffd23f,0 0 24px -6px #aa00ff}
.shopitem-new{position:absolute;top:-6px;right:-6px;background:linear-gradient(135deg,#00f0ff,#aa00ff);color:#fff;font-family:'Orbitron',sans-serif;font-size:7.5px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:8px;box-shadow:0 2px 6px -2px #d97757;z-index:1}
/* a drawn item gets a square of its own rather than a text line box */
.shopitem-art{display:block;width:100%;max-width:56px;aspect-ratio:1;margin:0 auto 2px}
.shopitem-art svg{display:block;width:100%;height:100%;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))}
.stgitem-art{display:block;width:100%;max-width:52px;aspect-ratio:1;margin:0 auto}
.stgitem-art svg{display:block;width:100%;height:100%}
.char-slot-ic svg{display:block;width:26px;height:26px}
/* ── the shop, in daylight ──
   The catalogue was a black modal dropped into a warm off-white app, which made
   the one place people spend their coins feel like it belonged to a different
   product. Everything below is scoped to .shop-full so the other modals keep
   their own look; rarity survives the move as a tinted border and a tinted
   wash instead of a neon glow, which is what rarity looks like on white. */
.shop-full{background:var(--card)!important;border-color:var(--bd1)!important;box-shadow:0 24px 60px -20px rgba(20,30,60,.45)!important}
.shop-full .sethdr{background:var(--card);border-bottom-color:var(--bd1);color:#d97757;text-shadow:none}
.shop-full .shop-tabs{border-bottom-color:var(--bd1);background:linear-gradient(180deg,transparent,rgba(20,30,60,.03))}
.shop-full .shop-tab{background:var(--card2);border-color:var(--bd1);color:var(--muted)}
.shop-full .shop-tab.on{background:linear-gradient(135deg,#d9775714,#d9775722);border-color:#d97757;color:#c0603f;box-shadow:0 2px 10px -5px #d97757}
.shop-full .shop-tab-n{color:#a8a49a}
.shop-full .shop-tab.on .shop-tab-n{color:#d97757}
.shop-full .shop-allbtn{background:var(--card2);border-color:var(--bd1);color:var(--muted)}
.shop-full .shop-allbtn:hover{border-color:#d97757;color:#d97757}
.shop-full .shop-allbtn.on{background:linear-gradient(135deg,#d9775718,#d9775728);border-color:#d97757;color:#c0603f;box-shadow:0 2px 10px -5px #d97757}
.shop-full .shop-summary{color:var(--muted);border-bottom-color:var(--bd1)}
.shop-full .shopitem{background:var(--card2);border-color:var(--bd1);color:var(--text);box-shadow:0 1px 2px rgba(20,30,60,.05)}
.shop-full .shopitem:hover{border-color:#d9775788}
.shop-full .shopitem-nm{color:var(--text)}
.shop-full .shopitem-desc{color:var(--muted)}
.shop-full .shopitem-rare{color:#a8a49a}
.shop-full .shopitem.rare{border-color:#3aa8ff5c;background:linear-gradient(165deg,#3aa8ff0a,var(--card2))}
.shop-full .shopitem.rare .shopitem-rare{color:#2b86d0}
.shop-full .shopitem.epic{border-color:#9b4dff5c;background:linear-gradient(165deg,#9b4dff0d,var(--card2))}
.shop-full .shopitem.epic .shopitem-rare{color:#7b3fd0}
.shop-full .shopitem.legendary{border-color:#e0a01c8a;background:linear-gradient(165deg,#ffb3001a,var(--card2));box-shadow:0 2px 12px -6px #e0a01c}
.shop-full .shopitem.legendary .shopitem-rare{color:#b8790a}
.shop-full .shopitem.equipped{border-color:#00a6bd;box-shadow:0 0 0 1px #00a6bd66,0 3px 12px -6px #00a6bd}
.shop-full .shopitem.legendary.equipped{border-color:#e0a01c;box-shadow:0 0 0 1px #e0a01c88,0 3px 14px -6px #e0a01c}
.shop-full .shopitem-tag{color:var(--muted)}
.shop-full .shopitem.equipped .shopitem-tag{color:#00a6bd}
.shop-full .shopitem-art svg{filter:drop-shadow(0 2px 4px rgba(20,30,60,.22))}

/* ── Shop Top-Up button (header) ── */
.shop-topup-btn{display:flex;align-items:center;gap:4px;background:linear-gradient(135deg,#f59e0b,#ef4444);border:none;border-radius:20px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:800;font-family:'Rajdhani',sans-serif;color:#fff;letter-spacing:.3px;box-shadow:0 2px 8px rgba(245,158,11,.3);transition:all .2s;white-space:nowrap}
.shop-topup-btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(245,158,11,.4)}
.shop-topup-btn:active{transform:scale(.97)}
/* ── Sub-category chips ── */
.shop-subtabs{display:flex;flex-wrap:wrap;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd1);background:var(--card2)}
.shop-subtab{display:inline-flex;align-items:center;gap:3px;background:var(--card);border:1.5px solid var(--bd1);border-radius:16px;padding:4px 10px;cursor:pointer;font-size:11px;font-weight:600;font-family:'Rajdhani',sans-serif;color:var(--muted);transition:all .15s;white-space:nowrap}
.shop-subtab.on{background:linear-gradient(135deg,#d9775718,#d9775728);border-color:#d97757;color:#c0603f}
.shop-subtab.gem{border-color:#a86bff44;color:#7b46c9}
.shop-subtab.gem.on{border-color:#a86bff;background:linear-gradient(135deg,#a86bff18,#a86bff28);box-shadow:0 0 6px rgba(168,107,255,.2)}

.shop-full .shopitem-icon-lg{filter:none}
.shop-full .coinpill{color:#d97757}
.shopitem-icon-lg{font-size:40px;line-height:1;filter:drop-shadow(0 0 6px rgba(0,240,255,.3));margin-bottom:4px}
.shopitem-nm{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:600;color:#d0d0ff}
.shopitem-rare{font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.5px;color:var(--muted);text-transform:uppercase}
.shopitem-tag{font-family:'Share Tech Mono',monospace;font-size:10px;color:#d97757}
.shopitem.equipped .shopitem-tag{color:#d97757}
.shop-full{max-height:90vh!important;max-width:420px!important;display:flex;flex-direction:column}
/* wraps rather than scrolls: a category nobody can see is a category nobody buys from */
.shop-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:8px 10px;flex-shrink:0;border-bottom:1px solid #00f0ff22;background:linear-gradient(180deg,#0a001500,#0a001533)}
.shop-tabs::-webkit-scrollbar{display:none}
.shop-tab{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;background:#ffffff08;border:1.5px solid transparent;border-radius:10px;padding:6px 3px;cursor:pointer;transition:all .2s;min-width:0;color:#8888aa}
.shop-tab.on{background:linear-gradient(135deg,#00f0ff15,#aa00ff15);border-color:#00f0ff;color:#00f0ff;box-shadow:0 0 8px rgba(0,240,255,.2)}
.shop-tab:hover{background:rgba(0,240,255,.08);border-color:#00f0ff44}
.shop-tab-ic{font-size:18px}
.shop-tab-lbl{font-size:9px;font-weight:700;font-family:'Rajdhani',sans-serif;letter-spacing:.2px;line-height:1.1;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* how many items are in there — the weapon rack being the biggest is worth seeing */
.shop-tab-n{position:absolute;top:2px;right:3px;font-family:'Orbitron',sans-serif;font-size:7.5px;font-weight:700;color:#ffffff59}
.shop-tab.on .shop-tab-n{color:#00f0ff}
/* the everything view: a switch in the corner, not a category */
.shop-hdr{gap:7px}
.shop-hdr-t{margin-right:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shop-allbtn{display:inline-flex;align-items:center;gap:4px;flex-shrink:0;padding:4px 9px;border-radius:20px;border:1px solid #ffffff2e;background:#ffffff0d;color:#9fb1cc;font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s}
.shop-allbtn:hover{border-color:#00f0ff88;color:#dff6ff}
.shop-allbtn.on{background:linear-gradient(135deg,#00f0ff22,#aa00ff22);border-color:#00f0ff;color:#00f0ff;box-shadow:0 0 8px rgba(0,240,255,.25)}
@media (max-width:380px){.shop-allbtn-l{display:none}}
.shop-body{overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch}
.shop-summary{display:flex;justify-content:space-between;font-size:11px;color:#8888aa;padding:4px 0 8px;border-bottom:1px solid #00f0ff15;margin-bottom:10px}
.shop-grid-full{padding:0 10px 16px}
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
.songlanes{display:flex;gap:3px;padding:7px 4px;flex-shrink:0;background:var(--card3);border-top:1px solid #d9775722}
.songlane{flex:1;padding:13px 2px;border-radius:9px;border:1px solid hsla(var(--lh,332),70%,55%,.4);background:hsla(var(--lh,332),70%,50%,.1);color:hsla(var(--lh,332),85%,76%,1);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer}
.songlane:active{background:hsla(var(--lh,332),80%,55%,.35);transform:translateY(1px)}
/* responsive game keyboard — fills full width on any device */
.gpwrap{flex-shrink:0;background:var(--card3);border-top:1px solid #d9775722;padding:4px 0 calc(4px + env(safe-area-inset-bottom,0px))}
.gprow{position:relative;display:flex;gap:2px;width:100%;max-width:1200px;margin:0 auto;padding:0 4px;height:clamp(54px,11vh,140px)}
.gpw{position:relative;flex:1;min-width:0;height:100%;background: #ffffff;border:1px solid #d4cfc5;border-top:none;border-radius:0 0 6px 6px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px;cursor:pointer;box-shadow:0 3px 5px rgba(0,0,0,.4);transition:filter .08s,transform .05s;-webkit-tap-highlight-color:transparent}
.gpfinger{position:absolute;top:3px;left:50%;transform:translateX(-50%);width:15px;height:15px;border-radius:50%;background:#ff5252;color:#fff;font-size:9px;font-weight:700;font-family:'Orbitron',sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px #ff525299;z-index:6;pointer-events:none}
.gpw span{font-family:'Share Tech Mono',monospace;font-size:clamp(8px,1.7vw,14px);color:var(--muted);pointer-events:none}
.gpw:active{transform:translateY(2px)}
.gpw.lit{background:#d97757;box-shadow:0 0 16px #d97757,0 0 38px #d9775766}
.gpw.pressed{transform:translateY(2px);filter:brightness(.94)}
.gpb{position:absolute;top:0;height:62%;background:#1a1a1a;border:1px solid #111;border-radius:0 0 5px 5px;z-index:2;cursor:pointer;box-shadow:0 4px 8px rgba(0,0,0,.8);-webkit-tap-highlight-color:transparent}
.gpb:active{transform:translateY(1px)}
.gpb.lit{background:#d97757;box-shadow:0 0 14px #d97757}
.gpb.pressed{transform:translateY(1px);filter:brightness(1.3)}
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
.setlistbtn{display:flex;flex-direction:column;align-items:center;gap:2px;width:calc(100% - 28px);margin:0 14px 10px;padding:10px;border-radius:14px;border:1.5px solid #a78bfa55;background:linear-gradient(135deg,rgba(167,139,250,.16),rgba(139,92,246,.05));cursor:pointer}
.setlistbtn-tt{font-family:'Orbitron',sans-serif;font-size:13px;font-weight:800;color:#c4b5fd}
.setlistbtn-sub{font-family:'Rajdhani',sans-serif;font-size:11px;color:var(--muted)}
.genrefilters{display:flex;gap:6px;overflow-x:auto;padding:0 14px 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.genrefilters::-webkit-scrollbar{display:none}
.genrechip{flex:0 0 auto;padding:5px 13px;border-radius:18px;border:1.5px solid var(--bd2);background:transparent;color:var(--muted);font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,color .15s}
.genrechip.active{background:#6c47ff;border-color:#6c47ff;color:#fff}
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
.songsrcbar{text-align:center;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);padding:5px;padding-bottom:calc(5px + env(safe-area-inset-bottom,0px));flex-shrink:0}
.songresult{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;padding:24px;text-align:center}
.songstars{font-size:46px;color:#d97757;letter-spacing:6px;text-shadow:0 0 24px #d9775766;animation:popcount .6s ease-out}
/* Setlist finale banner — score/max-combo shown lower on this same result
   screen are already the whole concert's totals; this just names them and
   lists each song's own stars. */
.concertrecap{width:100%;padding:14px;border-radius:16px;background:linear-gradient(135deg,rgba(167,139,250,.18),rgba(139,92,246,.06));border:1.5px solid #a78bfa55}
.concertrecap-title{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:900;color:#c4b5fd;text-shadow:0 0 14px #a78bfa66}
.concertrecap-songs{display:flex;flex-direction:column;gap:5px;margin-top:9px;font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--text2)}
.concertrecap-song{display:flex;justify-content:space-between;gap:10px}
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
.staffwrap{background:var(--card);border:1px solid var(--bd2);border-radius:16px;padding:14px 8px;margin:6px 0;transition:box-shadow .2s,border-color .2s}
.staffwrap.ok{border-color:#d97757;box-shadow:0 0 24px -8px #d97757}
.staffwrap.bad{border-color:#ff5252;box-shadow:0 0 24px -8px #ff5252}
.staffwrap.phraseclean{border-color:#ffd23f;box-shadow:0 0 32px -6px #ffd23f}
.sightphrase{letter-spacing:2px;font-size:14px;color:#d97757}
.sightstreak{font-family:'Orbitron',sans-serif;color:#ffd23f;text-shadow:0 0 10px #ffd23f99;animation:sightstreakpop .3s ease}
@keyframes sightstreakpop{0%{transform:scale(1.3)}100%{transform:scale(1)}}
.staffsvg{display:block;max-height:175px}
.clefsel{display:flex;gap:8px;justify-content:center;margin:8px 0 2px}
.clefbtn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:11px;border:1px solid var(--bd2);background:rgba(255,255,255,.03);color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s}
.clefbtn .clefgly{font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1}
.clefbtn.on{color:#d97757;border-color:#d97757aa;background: rgba(217,119,87,.16);box-shadow:0 0 18px -8px #d97757}
.clefbtn:active{transform:scale(.96)}
.clefbest{font-family:'Share Tech Mono',monospace;font-size:10px;color:#ffd23f;margin-left:2px}
/* Belt ranking — header badge always visible during play; the promotion
   celebration reuses the existing gold .punlock treatment as-is (the belt's
   own icon already carries its color, from white through black). */
.sightbelt{display:flex;align-items:center;gap:5px;font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;color:var(--text2);background:var(--card3);border:1px solid var(--bd2);border-radius:20px;padding:5px 11px;flex-shrink:0}
.sightbelt span{font-size:15px}
.sightnewbest{font-family:'Orbitron',sans-serif;font-size:13px;font-weight:800;color:#ffd23f;text-shadow:0 0 12px #ffd23f77}
.beltprog{width:100%;padding:10px 14px;border-radius:12px;background:var(--card3);border:1px solid var(--bd2)}
.beltprog-row{display:flex;justify-content:space-between;font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:700;color:var(--text2)}
.beltprog-bar{margin-top:7px}
.beltprog-count{margin-top:5px;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);text-align:center}
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
.camspeaking{animation:flamepulse .6s ease-in-out infinite alternate}
.camrecap{text-align:center}
.camrecap-pct{font-family:'Orbitron',sans-serif;font-size:26px;font-weight:900;color:var(--text);margin:4px 0}
.camrecap-trend{font-family:'Rajdhani',sans-serif;font-size:13px;color:#d97757;margin-bottom:10px}
.camstreak-badge{display:inline-flex;align-items:center;gap:3px;margin-left:8px;font-family:'Share Tech Mono',monospace;font-size:11px;font-weight:700;color:#ffd23f;background:rgba(255,210,63,.12);border:1px solid rgba(255,210,63,.4);border-radius:20px;padding:2px 9px}
.camrecap-streak{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;color:#ffd23f;margin-bottom:6px}
.camrecap-streak.tierup{animation:flamepulse .7s ease-in-out infinite alternate}
.camrecap-tierup-tag{display:inline-block;margin-left:6px;font-size:10px;font-weight:900;color:#d97757}
.camrecap-reward{font-family:'Share Tech Mono',monospace;font-size:12px;color:#d97757;margin-bottom:10px}
/* Auto Teaching real-time coaching card */
.atpopup{position:fixed;inset:0;z-index:1300;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,5,9,.72);backdrop-filter:blur(3px);animation:fadein .25s;padding:0 12px calc(14px + env(safe-area-inset-bottom,0px))}
.atpopup-card{width:100%;max-width:420px;background:var(--card);border:1px solid #d9775755;border-radius:18px;padding:16px 17px;box-shadow:0 -10px 34px -10px #000,0 0 26px -10px #d9775766;animation:installin .28s ease-out}
.atpopup-hd{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.atpopup-ic{font-size:20px}
.atpopup-tt{flex:1;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;letter-spacing:.4px;color:#d97757}
.atpopup-x{background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:2px 4px}
.atpopup-weak{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text);margin-bottom:10px}
.atpopup-steps{margin:0 0 14px;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px;font-family:'Rajdhani',sans-serif;font-size:14px;color:var(--text2)}
.atpopup-steps li{margin:0}
.atpopup-step{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;background:rgba(217,119,87,.07);border:1px solid var(--bd5);border-radius:11px;padding:9px 12px;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:14px;line-height:1.45;cursor:pointer}
.atpopup-step:active{background:rgba(217,119,87,.16)}
.atpopup-step-go{color:#d97757;font-weight:900;font-size:15px;flex-shrink:0}
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
.leaguereset{font-size:10px;color:var(--muted);font-family:'Share Tech Mono',monospace;text-align:center;margin-top:10px;letter-spacing:.3px}
.gemrow{display:flex;align-items:center;justify-content:space-between;gap:10px}
.gemrow-bal{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:#a855f7}
.gemrow-x{background:rgba(168,85,247,.12);color:#a855f7;border:1px solid #a855f755;border-radius:9px;padding:8px 12px;font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.gemrow-x:disabled{opacity:.4;cursor:default}
.cqbar{height:10px;border-radius:6px;background:var(--card2);overflow:hidden;margin-bottom:6px}
.cqbar div{height:100%;border-radius:6px;background:linear-gradient(90deg,#788c5d,#d97757);transition:width .5s}
.cqstat{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:var(--text);text-align:center}
.wktrack{display:flex;gap:5px;margin-bottom:10px}
.wktrack-seg{flex:1;height:6px;border-radius:4px;background:var(--card);border:1px solid var(--bd2)}
.wktrack-seg.done{background:#d97757;border-color:#d97757;box-shadow:0 0 8px -1px #d97757aa}
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
.vmmenu{position:absolute;bottom:52px;right:0;background:var(--card);border:1px solid #d9775755;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px;min-width:250px;box-shadow:0 10px 34px rgba(0,0,0,.55);animation:dropdown .18s ease-out}
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
.setov{position:fixed;inset:0;z-index:1300;background:rgba(5,0,15,.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:18px;animation:fadein .2s}
.setcard{width:100%;max-width:420px;max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,#0a0015 0%,#120025 50%,#0a0015 100%);border:1px solid #00f0ff33;border-radius:18px;box-shadow:0 0 30px rgba(0,240,255,.1),0 0 60px rgba(170,0,255,.05),0 24px 60px -20px #000}
.sethdr{display:flex;align-items:center;justify-content:space-between;padding:15px 16px;border-bottom:1px solid #00f0ff33;font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:#00f0ff;position:sticky;top:0;background:#0a0015ee;z-index:1;text-shadow:0 0 6px rgba(0,240,255,.3)}
.setbody{padding:14px 16px 18px;color:#c0c0e0}
/* friends + duels modal */
.frtabs{display:flex;gap:4px;padding:10px 16px 0;border-bottom:1px solid var(--bd3)}
.frtabs button{flex:1;padding:8px 4px;background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:700;cursor:pointer}
.frtabs button.active{color:#d97757;border-bottom-color:#d97757}
.frmsg{font-size:11.5px;color:#d97757;font-family:'Rajdhani',sans-serif;font-weight:700;text-align:center;padding:6px 0 10px}
.fradd{display:flex;gap:8px;margin-bottom:14px}
.fradd input{flex:1;background:var(--card2);border:1px solid var(--bd2);border-radius:9px;padding:9px 11px;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:13px}
.fradd button{background:#d97757;color:#fff;border:none;border-radius:9px;padding:0 16px;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;cursor:pointer}
.fradd button:disabled{opacity:.5;cursor:default}
.frrow{display:flex;align-items:center;gap:8px;padding:10px 4px;border-bottom:1px solid var(--bd1)}
.frrow:last-child{border-bottom:none}
.frrow-nm{flex:1;min-width:0;font-family:'Rajdhani',sans-serif;font-size:13.5px;font-weight:700;color:var(--text2);display:flex;flex-direction:column;gap:2px}
.frrow-sub{font-size:10.5px;font-weight:600;color:var(--muted);font-family:'Share Tech Mono',monospace}
.frrow-go{background:rgba(217,119,87,.12);color:#d97757;border:1px solid #d9775755;border-radius:8px;padding:6px 10px;font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.frrow-x{background:none;border:1px solid var(--bd4);color:var(--muted);border-radius:8px;width:28px;height:28px;cursor:pointer;flex-shrink:0}
.frrow-pending{font-size:10.5px;color:var(--muted);font-family:'Share Tech Mono',monospace}
.frduel{background:var(--card2);border:1px solid var(--bd2);border-radius:12px;padding:11px 13px;margin-bottom:9px}
.frduel-top{display:flex;justify-content:space-between;align-items:center;font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:700;color:var(--text2);margin-bottom:8px}
.frduel-status{font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.5px;text-transform:uppercase;padding:2px 8px;border-radius:10px;background:var(--card3);color:var(--muted)}
.frduel-status.done{color:#d97757;background:rgba(217,119,87,.12)}
.frduel-subject{font-family:'Share Tech Mono',monospace;font-size:9.5px;color:var(--muted);margin-bottom:6px}
.frduel-score{display:flex;justify-content:space-between;font-family:'Orbitron',sans-serif;font-size:12px;color:var(--text);margin-bottom:8px}
.frduel-score .frduel-win{color:#d97757;font-weight:700}
.frsonglist{display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto}
.frsongpick{text-align:left;background:var(--card2);border:1px solid var(--bd2);border-radius:9px;padding:10px 12px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;cursor:pointer}
.frsongpick:hover{border-color:#d97757}
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
/* Activity heatmap — a real day-grid (GitHub-contribution style), unlike
   ProgressDashboard above it (bucketed bar totals per period, can't show
   which specific days were active) */
.heatmap-wrap{display:flex;gap:4px;overflow-x:auto;padding-bottom:2px}
.heatmap-dow{display:flex;flex-direction:column;gap:3px;flex-shrink:0;padding-top:1px}
.heatmap-dow span{height:11px;line-height:11px;font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--muted)}
.heatmap-grid{display:flex;gap:3px}
.heatmap-col{display:flex;flex-direction:column;gap:3px}
.heatmap-cell{width:11px;height:11px;border-radius:3px;border:none;padding:0;cursor:pointer;background:var(--card3)}
.heatmap-cell.empty{visibility:hidden;cursor:default}
.heatmap-cell.lv0{background:var(--card3)}
.heatmap-cell.lv1{background:#d9775733}
.heatmap-cell.lv2{background:#d9775766}
.heatmap-cell.lv3{background:#d97757a8}
.heatmap-cell.lv4{background:#d97757;box-shadow:0 0 6px -1px #d97757}
.heatmap-legend{display:flex;align-items:center;gap:4px;margin-top:8px;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted)}
.heatmap-legend .heatmap-cell{cursor:default}
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
@media(max-width:480px){.lname{font-size:11px;letter-spacing:1px}.bbl{font-size:12px;padding:8px 11px}}
/* F5: Certificate banner */
.cert-banner{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px;margin:14px 14px 0;padding:18px 16px;background:linear-gradient(135deg,rgba(217,119,87,.15),rgba(217,119,87,.05));border:2px solid rgba(217,119,87,.4);border-radius:16px;animation:fadein .4s}
.cert-ic{font-size:36px;flex-shrink:0}
.cert-body{flex:1;min-width:140px}
.cert-title{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text)}
.cert-sub{font-size:11px;color:#d97757;margin-top:2px;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px}
.cert-dl-btn{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;background:#d97757;color:#fff;border:none;border-radius:10px;padding:9px 14px;cursor:pointer;flex-shrink:0;white-space:nowrap}
.cert-share-btn{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;background:transparent;color:#d97757;border:1.5px solid #d9775766;border-radius:10px;padding:8px 13px;cursor:pointer;flex-shrink:0;white-space:nowrap}
.cert-dl-btn:hover{background:#c86846}
/* Group Boss Challenge banner — reuses .cert-banner's layout, re-themed purple
   (same family as .punlock.pboss) so it reads as a distinct "final exam" call
   to action rather than another certificate. .done dims it to a quiet trophy
   case once the group's boss has already been cleared once. */
.bossbanner{background:linear-gradient(135deg,rgba(167,139,250,.2),rgba(139,92,246,.06));border-color:#a78bfa66}
.bossbanner .cert-ic{filter:drop-shadow(0 0 10px #a78bfa77)}
.bossbanner .cert-sub{color:#c4b5fd}
.bossbanner .boss-fight-btn{background:#8b5cf6}
.bossbanner .boss-fight-btn:hover{background:#7c3aed}
.bossbanner.done{background:linear-gradient(135deg,rgba(167,139,250,.08),rgba(139,92,246,.03));border-color:#a78bfa33}
.bossbanner.done .boss-fight-btn{background:transparent;color:#a78bfa;border:1.5px solid #a78bfa55}
/* Challenging page — locked teaser row for a section not yet fully passed */
.cert-banner.locked{background:var(--card2);border-color:var(--bd1);opacity:.6}
.cert-banner.locked .cert-ic{filter:grayscale(1)}
.cert-banner.locked .cert-sub{color:var(--muted)}
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
/* strength-meter presentation — real per-stage mastery % instead of a raw
   ×N open count, and a direct deep-link into that exact stage's drill */
.srs-body{display:flex;flex-direction:column;gap:5px;flex:1;min-width:0}
.srs-body .wkbar{width:100%}
.srs-go{flex-shrink:0;font-family:'Share Tech Mono',monospace;font-size:10px;font-weight:700;color:#d97757;background:rgba(217,119,87,.12);border:1px solid #d9775755;border-radius:8px;padding:7px 11px;cursor:pointer;white-space:nowrap}
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

/* one-time native-app mic/camera disclosure */
.permprimer-overlay{position:fixed;inset:0;z-index:1500;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(4,4,12,.62);backdrop-filter:blur(3px);animation:fadein .2s}
.permprimer-card{max-width:340px;width:100%;background:var(--card);border:1px solid var(--bd2);border-radius:18px;padding:24px 20px;text-align:center;box-shadow:0 20px 60px -10px rgba(0,0,0,.4)}
.permprimer-ic{font-size:34px;margin-bottom:10px}
.permprimer-title{font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:700;color:var(--text);margin-bottom:8px}
.permprimer-body{font-size:13px;color:var(--muted);line-height:1.55;margin-bottom:18px}
.permprimer-btn{width:100%;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;background:#d97757;color:#fff;border:none;border-radius:12px;padding:12px;cursor:pointer}
.permprimer-row{display:flex;gap:10px}
.permprimer-row .permprimer-btn{width:auto;flex:1}
.permprimer-btn2{flex:1;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;background:transparent;color:var(--muted);border:1px solid var(--bd2);border-radius:12px;padding:12px;cursor:pointer}

.guestloginpill{display:flex;align-items:center;gap:4px;background: #d97757;color:var(--card2);border:none;border-radius:20px;padding:5px 11px;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;cursor:pointer}
.guestloginpill .oauthico{background:#fff;color:#4285F4;border-radius:50%;width:14px;height:14px;font-size:9px;display:inline-flex;align-items:center;justify-content:center;font-weight:800}
.guestloginpill-timer{opacity:.75;font-weight:600;font-variant-numeric:tabular-nums}

/* ══ digital pet ══
   Everything here reads its colours from the app's tokens so the page works
   in both themes; the one deliberate exception is the room, which is a lit
   scene and stays dark on purpose in either theme. */
.pa{display:block;width:100%;height:100%}
.pa-bob{animation:pabob 2.6s ease-in-out infinite;transform-origin:60px 120px}
.pa-sag{animation:pasag 4.4s ease-in-out infinite;transform-origin:60px 120px}
@keyframes pabob{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-3.5px) scale(.99,1.012)}}
@keyframes pasag{0%,100%{transform:translateY(1px) scale(1.006,.99)}50%{transform:translateY(2.5px) scale(1.012,.982)}}
@media (prefers-reduced-motion:reduce){.pa-bob,.pa-sag,.pr-fx,.pvppet{animation:none}}

/* the pod beside the avatar — absolutely placed so the avatar stays centred */
.petpod{position:absolute;top:24px;right:10px;z-index:2;width:82px;display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 4px 6px;border:1px solid var(--bd4);border-radius:16px;background:var(--card);color:var(--text);cursor:pointer;box-shadow:0 8px 20px -16px rgba(20,30,60,.8)}
.petpod:hover{border-color:var(--bd5)}
.petpod:active{transform:scale(.96)}
.petpod .pp-art{width:52px;height:56px;filter:drop-shadow(0 4px 9px color-mix(in srgb,var(--pc,#8ab) 45%,transparent))}
.petpod .pp-art.egg{display:flex;align-items:center;justify-content:center;font-size:30px;filter:none}
.petpod b{font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;line-height:1.15;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.petpod i{font-family:'Share Tech Mono',monospace;font-style:normal;font-size:9px;color:var(--muted)}
.petpod.empty b{font-size:9.5px;white-space:normal;color:var(--muted)}
/* one dot, because "something needs doing" is all this corner has room to say */
.petpod em{position:absolute;top:-4px;right:-4px;width:12px;height:12px;border-radius:50%;background:#d97757;border:2px solid var(--card);animation:pppulse 1.6s ease-in-out infinite}
@keyframes pppulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.22);opacity:.75}}
@media (prefers-reduced-motion:reduce){.petpod em{animation:none}}
@media (max-width:340px){.petpod{width:70px;top:20px;right:6px}.petpod .pp-art{width:44px;height:48px}}

/* .tg is a clipped flex column, so a page has to own its own scroll — a
   min-height page just overflows the clip with nowhere to go */
.petpage{flex:1;min-height:0;overflow-y:auto;background:var(--bg);color:var(--text);padding:0 0 90px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.petpage>*{max-width:560px;margin-left:auto;margin-right:auto}
/* the real centering now happens once, on the single wrapper — individual
   cards inside are free to set their own margin without re-fighting it on a
   wide screen or iPad */
.pet-inner{max-width:560px;margin:0 auto}
.pet-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;max-width:none !important;padding:11px 13px;background:var(--card);border-bottom:1px solid var(--bd1)}
.pet-top>b{flex:1;font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:700;text-align:center}
.pet-back{width:34px;height:34px;flex:none;border:1px solid var(--bd4);border-radius:11px;background:var(--card2);color:var(--text);font-size:16px;cursor:pointer}
.pet-coins{flex:none;font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--muted);min-width:34px;text-align:right}
.pet-intro{font-size:12.5px;line-height:1.6;color:var(--text2);margin:12px 13px}

.pet-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px;padding:0 13px}
.pet-card{display:flex;flex-direction:column;align-items:center;gap:1px;padding:8px 6px 7px;border:1px solid var(--bd4);border-radius:14px;background:var(--card);color:var(--text);cursor:pointer}
.pet-card:hover{border-color:var(--bd5)}
.pet-card.on{border-color:var(--tc,#8cf);box-shadow:0 0 0 1px var(--tc,#8cf) inset,0 10px 26px -18px var(--tc,#8cf)}
.pc-art{width:100%;aspect-ratio:1/1.1;filter:drop-shadow(0 5px 11px color-mix(in srgb,var(--pc,#8ab) 40%,transparent))}
.pet-card>b{font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:700;margin-top:2px}
.pc-type{font-size:9.5px;font-style:normal;color:var(--tc,#9fb)}
.pc-code{font-family:'Share Tech Mono',monospace;font-size:8.5px;font-style:normal;color:var(--muted);letter-spacing:.05em}

.pet-confirm{position:sticky;bottom:8px;margin:12px 13px 0;padding:11px;border:1px solid var(--bd4);border-radius:16px;background:var(--card);box-shadow:0 10px 30px -18px rgba(20,30,60,.6)}
.pcf-row{display:flex;gap:11px;align-items:flex-start}
.pcf-art{width:74px;flex:none;aspect-ratio:1/1.1}
.pcf-b{flex:1;min-width:0}
.pcf-b>b{font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700}
.pcf-b>p{margin:3px 0 6px;font-size:11.5px;line-height:1.5;color:var(--text2)}
.pcf-tags{display:flex;flex-wrap:wrap;gap:5px}
.pcf-tags span{font-size:10px;padding:2px 8px;border-radius:20px;background:var(--card2);border:1px solid var(--bd1);color:var(--text2)}
.pcf-tags span:first-child{color:var(--tc,inherit)}
.pcf-name{width:100%;margin-top:9px;padding:9px 11px;border:1px solid var(--bd4);border-radius:11px;background:var(--card2);color:var(--text);font-size:13px;font-family:inherit}
.pcf-go{width:100%;margin-top:8px;padding:11px;border:none;border-radius:12px;background:linear-gradient(135deg,#e2865f,#d05f43);color:#fff;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;cursor:pointer}

/* var(--card) rather than a hardcoded white: this stays a plain light stage
   in light theme (matching .pet-bond right below it) and a dark card in dark
   theme, instead of a fixed white box breaking the rest of a dark UI. */
.pet-room{position:relative;height:230px;margin:11px 13px;border:1px solid var(--bd4);border-radius:18px;overflow:hidden;background:var(--card)}
.pr-floor{position:absolute;left:0;right:0;bottom:0;height:38%;background:linear-gradient(180deg,color-mix(in srgb,var(--tc,#8cf) 7%,transparent),transparent);border-top:1px solid var(--bd4)}
.pr-pet{position:absolute;left:50%;bottom:10px;width:152px;height:172px;transform:translateX(-50%);cursor:pointer;filter:drop-shadow(0 10px 22px color-mix(in srgb,var(--pc,#8ab) 55%,transparent))}
.pr-pet:active{transform:translateX(-50%) scale(.97)}
.pr-pet.sad{filter:saturate(.55) drop-shadow(0 8px 20px #0006)}
.pr-mess{position:absolute;width:28px;height:28px;padding:0;border:none;border-radius:50%;background:#ffffff14;font-size:15px;line-height:1;cursor:pointer;transform:translate(-50%,-50%)}
.pr-mess:hover{background:#ffffff2b}
.pr-fx{position:absolute;bottom:56px;font-size:19px;pointer-events:none;animation:prfx 1.4s ease-out forwards}
@keyframes prfx{0%{opacity:0;transform:translateY(0) rotate(0)}18%{opacity:1}100%{opacity:0;transform:translateY(-88px) rotate(var(--rot,0deg))}}
.pr-hint{position:absolute;left:0;right:0;top:9px;text-align:center;font-size:10.5px;color:#e6ecf8;opacity:.72}

.pet-idcard{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:11px 13px 0}
.pet-idcard span{font-size:10.5px;padding:3px 9px;border-radius:20px;background:var(--card2);border:1px solid var(--bd1);color:var(--text2)}
.pi-code{font-family:'Share Tech Mono',monospace}
.pi-type{color:var(--tc,inherit) !important}
.pi-happy.low{background:color-mix(in srgb,#d97757 14%,var(--card2));color:#c25a3a !important}

.pet-bond{margin:11px 13px;padding:10px 12px;border:1px solid var(--bd4);border-radius:14px;background:var(--card)}
.pb-row{display:flex;justify-content:space-between;font-size:12.5px}
.pb-row b{font-family:'Rajdhani',sans-serif;font-weight:700}
.pb-row span{color:var(--muted);font-family:'Share Tech Mono',monospace;font-size:11px}
.pb-bar{height:8px;margin:7px 0 5px;border-radius:20px;background:var(--card2);border:1px solid var(--bd1);overflow:hidden}
.pb-bar i{display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,var(--pc,#8ab),var(--tc,#8cf));transition:width .5s cubic-bezier(.4,0,.2,1)}
.pb-sub{font-size:10.5px;color:var(--muted)}

.pet-stats{display:flex;flex-direction:column;gap:7px;padding:0 13px}
.ps-row{display:flex;align-items:center;gap:9px;font-size:12px}
.ps-nm{width:82px;flex:none;color:var(--text2)}
.ps-bar{flex:1;height:10px;border-radius:20px;background:var(--card2);border:1px solid var(--bd1);overflow:hidden}
.ps-bar i{display:block;height:100%;border-radius:20px;transition:width .4s ease}
.ps-n{width:26px;flex:none;text-align:right;color:var(--muted);font-family:'Share Tech Mono',monospace;font-size:11px}
.ps-row.low .ps-nm{color:#c25a3a;font-weight:600}

.pet-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:12px 13px}
.pet-act{display:flex;flex-direction:column;align-items:center;gap:4px;padding:11px 4px;border:1px solid color-mix(in srgb,var(--ac,#8cf) 40%,transparent);border-radius:14px;background:color-mix(in srgb,var(--ac,#8cf) 11%,var(--card));color:var(--text);cursor:pointer}
.pet-act:hover{background:color-mix(in srgb,var(--ac,#8cf) 20%,var(--card))}
.pet-act:active{transform:scale(.96)}
.pet-act span{font-size:20px;line-height:1}
.pet-act b{font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:700}
.pet-act u{font-family:'Share Tech Mono',monospace;font-size:9px;text-decoration:none;color:var(--muted)}
.pet-act.poor{opacity:.42}
.pet-why{margin:0 13px 12px;font-size:10.5px;line-height:1.5;color:var(--muted);text-align:center}

.pet-tray,.pet-shop{margin:0 13px 11px;padding:11px;border:1px solid var(--bd4);border-radius:15px;background:var(--card)}
.pt-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.pt-hdr b{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700}
.pt-hdr button{width:26px;height:26px;border:none;border-radius:8px;background:var(--card2);color:var(--text);cursor:pointer}
.pt-empty{margin:0;font-size:11.5px;color:var(--muted)}
.pt-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.pt-food{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:14px 5px 8px;border:1px solid var(--bd4);border-radius:13px;background:var(--card2);color:var(--text);cursor:pointer}
.pt-food:hover{border-color:var(--bd5)}
.pt-food:active{transform:scale(.97)}
.pt-food.fav{border-color:#d9a23f88;background:color-mix(in srgb,#ffd23f 9%,var(--card2))}
.pt-food.poor{opacity:.45}
.pt-ic{width:40px;height:40px}
.pt-food b{font-size:10.5px;text-align:center;line-height:1.25}
.pt-food i,.pt-food u{font-family:'Share Tech Mono',monospace;font-size:10px;font-style:normal;text-decoration:none;color:var(--muted)}
.pt-food em{position:absolute;top:4px;left:50%;transform:translateX(-50%);font-size:8px;font-style:normal;white-space:nowrap;padding:1px 6px;border-radius:20px;background:#e8b93c;color:#3a2a00;font-weight:700}

.pet-arena{display:flex;flex-direction:column;gap:4px;margin:0 13px;padding:11px 13px;border:1px solid var(--bd4);border-radius:14px;background:color-mix(in srgb,#d97757 8%,var(--card))}
.pet-arena b{font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:700}
.pet-arena span{font-size:11.5px;color:var(--text2);line-height:1.45}
.pet-arena.off{border-color:#d9775766}
.pet-arena.off span{color:#c25a3a}

/* the companion sits inside .pvpfighter, which sizes every svg it contains
   to a full 198px chassis — the pet needs its own size back */
.pvppet{position:absolute;left:0;bottom:2px;width:52px;height:58px;z-index:2;pointer-events:none;animation:pvppetin .5s ease}
.pvpfighter.op .pvppet{left:auto;right:0}
.pvppet svg{display:block;width:100%;height:100%;filter:drop-shadow(0 5px 7px rgba(20,30,60,.34))}
@keyframes pvppetin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

.pet-note{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:60;max-width:88vw;padding:9px 16px;border-radius:22px;background:var(--card);border:1px solid var(--bd5);color:var(--text);font-size:12.5px;box-shadow:0 12px 34px -16px rgba(20,30,60,.7);animation:petnote .25s ease}
@keyframes petnote{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}

/* header shortcuts that replaced the plan badge - 38px to match .shopbtn's
   own explicit height, so the two read as the same size next to each other.
   Matching the height alone was not enough: at 12px radius, a hairline neutral
   border and a small glyph, this still READ as the smaller of the two next to
   the shop pill. The radius, the border weight and the accent colour are now
   the shop pill's, so the pair reads as one family and the square stops
   looking like a leftover. */
.hdrgo{display:flex;align-items:center;justify-content:center;width:38px;height:38px;box-sizing:border-box;flex:0 0 auto;border:1.5px solid #d9775755;border-radius:20px;background:var(--card);color:#d97757;cursor:pointer;padding:0;transition:all .2s}
.hdrgo:hover{border-color:#d97757;background:rgba(217,119,87,.1);box-shadow:0 0 10px rgba(217,119,87,.2)}
.hdrgo:active{transform:scale(.94)}

/* ══════════ answer reveal ══════════
   Shown after every answer in both the arena and the RPG: a green tick tells
   a learner they were right, a keyboard and a staff tell them what the answer
   WAS — which is the only version of this that teaches anything. */
.nrv{background:linear-gradient(180deg,rgba(11,18,32,.97),rgba(7,11,22,.98));border:1px solid #26314a;border-radius:16px;padding:12px 12px 13px}
.nrv.ok{border-color:#2c6b45;box-shadow:0 0 0 1px #2c6b4544 inset}
.nrv.no{border-color:#7a3141;box-shadow:0 0 0 1px #7a314144 inset}
.nrv-head{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin-bottom:4px}
.nrv-verdict{font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:.1em}
.nrv.ok .nrv-verdict{color:#7fe0a0}
.nrv.no .nrv-verdict{color:#ff8a8a}
.nrv-ans{font-family:'Orbitron',sans-serif;font-size:19px;font-weight:900;color:#3fb9ff;text-shadow:0 0 16px #3fb9ff66}
.nrv-lab{font-family:'Share Tech Mono',monospace;font-size:10px;color:#8b9ec4;margin-left:auto}
.nrv-you{font-family:'Rajdhani',sans-serif;font-size:11.5px;color:#c99;margin-bottom:5px}
.nrv-you b{color:#ff8a8a}
.nrv-staffwrap{background:#0a101d;border:1px solid #1d2740;border-radius:11px;padding:4px 2px;margin-bottom:8px}
.nrv-keyswrap{filter:drop-shadow(0 6px 14px rgba(0,0,0,.55))}
.nrv-staff,.nrv-keys{display:block;width:100%;height:auto}
.nrv-next{margin-top:10px;width:100%;border:1px solid #3fb9ff;background:#3fb9ff;color:#06243a;border-radius:11px;padding:11px;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:14px;cursor:pointer}
.nrv-next:active{transform:scale(.98)}
/* the arena keeps the reveal on the page rhythm the question card had */
.pvppage .nrv{max-width:520px;margin:10px auto 0;width:calc(100% - 26px)}
/* landscape is short, so the staff and the keyboard sit side by side rather
   than stacked — both halves of the answer stay on screen at once */
@media (orientation:landscape){
  .nrv{display:grid;grid-template-columns:1fr 1fr;grid-template-areas:"hd hd" "yo yo" "st ky" "nx nx";column-gap:11px;padding:9px 11px 10px;max-width:640px;margin-left:auto;margin-right:auto}
  .nrv-head{grid-area:hd;margin-bottom:2px}
  .nrv-you{grid-area:yo;margin-bottom:3px}
  .nrv-staffwrap{grid-area:st;margin-bottom:0;align-self:center}
  .nrv-keyswrap{grid-area:ky;align-self:center}
  .nrv-next{grid-area:nx;margin-top:7px;padding:9px}
}
/* in the full-screen arena the reveal is an overlay: everything else on that
   page is positioned off the viewport edges, so a card left in normal flow
   would sit behind the stage */
.pvppage.land .nrv{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:12;width:min(94%,640px);max-width:none;margin:0;max-height:90%;overflow-y:auto;box-shadow:0 26px 64px -22px #000}

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
