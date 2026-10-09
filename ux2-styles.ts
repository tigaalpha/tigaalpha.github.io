/* ── ux2-styles.ts ──
   The premium interface's layer (ux2.ts): everything is written under `.ux2`,
   so with the switch off none of it applies. It is loaded last, after the cream
   finish and the game rooms' obsidian, and only adds or overrides — it never
   restyles the app for people who are not in it.

   AX-1 the tab bar · AX-2 motion and touch · AX-3 one icon language ·
   AX-4 large titles and native controls. */
export const UX2_CSS = `
/* ══════════ AX-1 · the tab bar ══════════
   The last child of the full-height column: pages are flex:1, so they end above it. */
.ux2 .tabbar{flex-shrink:0;margin-top:auto;position:relative;z-index:25;display:flex;align-items:stretch;justify-content:space-around;
  padding:5px 8px calc(5px + env(safe-area-inset-bottom,0px));
  background:var(--card);border-top:1px solid var(--bd2);box-shadow:0 -12px 30px -24px rgba(20,20,19,.5)}
.ux2 .tab{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  padding:3px 0 1px;border:0;background:transparent;color:var(--muted);font-family:var(--f-app);cursor:pointer;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:color .2s}
.ux2 .tab-ic{display:flex;align-items:center;justify-content:center;width:56px;height:30px;border-radius:15px;
  transition:background .24s ease,transform .32s cubic-bezier(.3,1.6,.5,1)}
.ux2 .tab.on{color:var(--clay-ink)}
.ux2 .tab.on .tab-ic{background:var(--clay-t2)}
.ux2 .tab:active .tab-ic{transform:scale(.9)}
.ux2 .tab-lb{font-size:11px;line-height:1.2;font-weight:500;letter-spacing:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ux2 .tab:focus-visible{outline:none}
.ux2 .tab:focus-visible .tab-ic{box-shadow:0 0 0 2px var(--clay)}
/* the on-screen keyboard owns the bottom of the screen while a text field has focus */
.kbd .ux2 .tabbar{display:none}
/* what floats at the bottom of the screen steps up over the bar */
.ux2 .apkpill{bottom:calc(74px + env(safe-area-inset-bottom,0px))}
.ux2 .installbanner{bottom:calc(72px + env(safe-area-inset-bottom,0px))}
.ux2 .mascot{bottom:calc(96px + env(safe-area-inset-bottom,0px))}

/* ══════════ AX-3 · one icon language ══════════
   Lucide line icons (ux-icons.tsx) take the place of the emoji that name a place, a mode or a lesson. They draw in currentColor,
   so each one wears the colour of the slot it sits in. */
.ux2 .uxi{display:block;flex:none;pointer-events:none}
.ux2 .uxi.uxi-inl{display:inline-block;vertical-align:-4px}
.ux2 .songcard-ic{color:color-mix(in srgb,var(--sc,var(--clay)) 70%,var(--text))}
.ux2 .songcard-go{display:flex;align-items:center;color:var(--muted)}
.ux2 .drawericon{font-size:0}
.ux2 .drawericon svg.uxi{display:block}
.ux2 .pgicon{display:flex;align-items:center;color:var(--gc,var(--clay-ink))}
.ux2 .pcardicon{display:flex;align-items:center;height:28px;line-height:0;color:var(--ac,var(--clay-ink))}
.ux2 .pcardarrow{display:inline-flex;align-items:center}
.ux2 .ptrail-node{color:var(--gc,var(--clay-ink))}
@media (max-width:359px){.ux2 .tab-ic{width:46px}}
@media (min-width:700px){.ux2 .tabbar{justify-content:center;gap:14px}.ux2 .tab{flex:0 0 118px}}
@media (prefers-reduced-motion:reduce){.ux2 .tab,.ux2 .tab-ic{transition:none}}

/* ══════════ AX-2 · motion and touch ══════════
   Pages arrive (a short rise and fade), cards settle in a quick stagger, a press gives under the finger and springs back, and a
   sheet slides up. Only transform and opacity move. A touch screen has no hover, so the hover lift is switched off there — a
   card must not stay raised after a tap. */
@keyframes uxEnter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes uxSheet{from{opacity:0;transform:translateY(28px) scale(.985)}to{opacity:1;transform:none}}
.ux2 .pathpage,.ux2 .profscroll,.ux2 .pvppage,.ux2 .petpage{animation:uxEnter .34s cubic-bezier(.2,.8,.2,1) both}
.ux2 .pgrid>.pcard:nth-child(-n+8),.ux2 .songgrid>.songcard:nth-child(-n+8){animation:uxEnter .38s cubic-bezier(.2,.8,.2,1) both}
.ux2 .pgrid>.pcard:nth-child(2),.ux2 .songgrid>.songcard:nth-child(2){animation-delay:.04s}
.ux2 .pgrid>.pcard:nth-child(3),.ux2 .songgrid>.songcard:nth-child(3){animation-delay:.08s}
.ux2 .pgrid>.pcard:nth-child(4),.ux2 .songgrid>.songcard:nth-child(4){animation-delay:.12s}
.ux2 .pgrid>.pcard:nth-child(5),.ux2 .songgrid>.songcard:nth-child(5){animation-delay:.16s}
.ux2 .pgrid>.pcard:nth-child(6),.ux2 .songgrid>.songcard:nth-child(6){animation-delay:.2s}
.ux2 .pgrid>.pcard:nth-child(7),.ux2 .songgrid>.songcard:nth-child(7){animation-delay:.24s}
.ux2 .pgrid>.pcard:nth-child(8),.ux2 .songgrid>.songcard:nth-child(8){animation-delay:.28s}
/* the press: quick down, springy back */
.ux2 .pcard,.ux2 .songcard,.ux2 .studiocard,.ux2 .draweritem,.ux2 .songbtn,.ux2 .settoggle,.ux2 .setlangbtn{
  transition:transform .32s cubic-bezier(.3,1.5,.5,1),box-shadow .2s,background-color .2s,border-color .2s,color .2s;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.ux2 .pcard:active,.ux2 .songcard:active,.ux2 .studiocard:active,.ux2 .draweritem:active,.ux2 .songbtn:active,.ux2 .settoggle:active,.ux2 .setlangbtn:active{
  transform:scale(.97);transition-duration:.08s}
/* sheets rise instead of popping */
.ux2 .modal-box,.ux2 .setcard:not(.shop-full),.ux2 .keypanel{animation:uxSheet .32s cubic-bezier(.2,.9,.25,1) both}
@media (hover:none){
  .tg.ux2 .songcard:hover,.tg.ux2 .pcard:hover,.tg.ux2 .studiocard:hover,.tg.ux2 .draweritem:hover,.tg.ux2 .hamb:hover,
  .tg.ux2 .hdrgo:hover,.tg.ux2 .shopbtn:hover,.tg.ux2 .flagbtn:hover{transform:none;box-shadow:none}
}
@media (prefers-reduced-motion:reduce){
  .ux2 .pathpage,.ux2 .profscroll,.ux2 .pvppage,.ux2 .petpage,.ux2 .pgrid>.pcard,.ux2 .songgrid>.songcard,
  .ux2 .modal-box,.ux2 .setcard,.ux2 .keypanel{animation:none}
  .ux2 .pcard,.ux2 .songcard,.ux2 .studiocard,.ux2 .draweritem,.ux2 .songbtn,.ux2 .settoggle,.ux2 .setlangbtn{transition:none}
  .ux2 .pcard:active,.ux2 .songcard:active,.ux2 .studiocard:active,.ux2 .draweritem:active,.ux2 .songbtn:active{transform:none}
}

/* ══════════ AX-4 · large titles and native controls ══════════ */
.ux2 .pathhero{text-align:left;align-items:flex-start}
.ux2 .pathhero .pathh1{font-size:32px;font-weight:500;letter-spacing:0;line-height:1.15;text-align:left}
.ux2 .pathhero:has(.pathh1) .pathbadge{display:none}
.ux2 .uxtitle{padding:6px 4px 2px}
.ux2 .uxtitle h1{margin:0;font-size:32px;font-weight:500;line-height:1.15;letter-spacing:0;color:var(--text)}
.ux2 .uxtitle p{margin:6px 0 0;font-size:14px;line-height:1.45;color:var(--muted)}
/* language buttons read as one segmented control */
.ux2 .setlangs{gap:0;padding:3px;border-radius:12px;background:var(--clay-t1);border:1px solid var(--bd2)}
.ux2 .setlangbtn{border:0;background:transparent;border-radius:9px}
.ux2 .setlangbtn.on{background:var(--card);color:var(--clay-ink);box-shadow:0 1px 3px rgba(20,20,19,.18)}
`;
