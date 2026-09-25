/* ── cream-styles.ts ──
   The main app's finish. Same cream, same near-black, same terracotta, the
   same screens and every control where it was — set with more care:

   · One typeface. The interface was written for Rajdhani, Orbitron and
     Share Tech Mono, but their @import sat below other rules in the
     stylesheet, where a browser ignores it, so every device drew the app in
     whatever its system font happened to be. The base rules and the inline
     styles now name the app's own type instead: var(--f-app), Prompt for
     Thai and Latin, and var(--f-num), IBM Plex Mono for figures — self-hosted
     like the game rooms', each file declared once so it is fetched once.
     Prompt is carried at 400 and 500; the 700–900 the old rules ask for draw
     at 500 (never a faux bold), so hierarchy comes from size and colour, not
     from shouting.
   · Thai and Chinese are never letter-spaced. Spacing pulls Thai tone marks
     off their consonants and breaks words apart; it was written for Latin.
   · Terracotta that small text is set in is a shade deeper (4.7:1 on cream
     instead of 3:1), and quiet text is a step darker, so it can be read.
   · Surfaces are paper, not neon: a hairline and a soft warm shadow instead
     of glows, dashed outlines and pulsing rings.
   · On a wide screen the content keeps a reading width instead of stretching
     across the whole monitor.

   Loaded after the base stylesheet and before the game rooms' (obsidian)
   layer, which keeps its own look. Everything here goes through the theme's
   own variables, so dark mode and the purchasable backgrounds still apply. */
import f_prompt_thai_500 from "./type/prompt-thai-500.woff2?url";
import f_prompt_latin_500 from "./type/prompt-latin-500.woff2?url";
import f_plex_latin_500 from "./type/ibmplexmono-latin-500.woff2?url";

const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const THAI = "U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC";
const face = (fam, w, url, range) =>
  `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(${url}) format("woff2");unicode-range:${range}}`;
const FACES = [
  face("Prompt", 500, f_prompt_thai_500, THAI), face("Prompt", 500, f_prompt_latin_500, LATIN),
  face("IBM Plex Mono", 500, f_plex_latin_500, LATIN),
].join("\n");

export const CREAM_CSS = FACES + `
/* ══════════ foundation ══════════ */
:root{--muted:#6e6a60;
  --f-app:"Prompt","Noto Sans Thai","Sukhumvit Set","Thonburi","Leelawadee UI",system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif;
  --f-num:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,"Prompt","Noto Sans Thai",monospace}
.tg{
  --clay:#d97757;--clay-d:#c4623f;--clay-ink:#a8502f;
  /* buttons: a shade richer than the brand terracotta so a white label on them can be read */
  --clay-btn:linear-gradient(180deg,#c9653f,#b4532f);
  --clay-t1:rgba(217,119,87,.08);--clay-t2:rgba(217,119,87,.14);--clay-ln:rgba(217,119,87,.34);
  --sh1:0 1px 1px rgba(40,30,20,.04),0 1px 3px rgba(40,30,20,.05);
  --sh2:0 1px 2px rgba(40,30,20,.05),0 10px 28px -16px rgba(60,40,20,.28);
  --sh3:0 2px 4px rgba(40,30,20,.05),0 22px 44px -22px rgba(60,40,20,.38);
  --lit:inset 0 1px 0 rgba(255,255,255,.75);
  font-family:var(--f-app);font-synthesis-weight:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  font-feature-settings:"kern" 1;
}
html[data-theme="dark"] .tg{
  --clay-ink:#e8957a;
  --clay-t1:rgba(217,119,87,.1);--clay-t2:rgba(217,119,87,.18);--clay-ln:rgba(217,119,87,.42);
  --sh1:0 1px 2px rgba(0,0,0,.45);
  --sh2:0 1px 2px rgba(0,0,0,.4),0 12px 30px -16px rgba(0,0,0,.75);
  --sh3:0 2px 6px rgba(0,0,0,.45),0 24px 48px -22px rgba(0,0,0,.85);
  --lit:inset 0 1px 0 rgba(255,255,255,.05);
}
.tg input,.tg textarea,.tg select{font-family:var(--f-app)}
/* Thai and Chinese are set solid; letter-spacing is for Latin */
html:is([lang="th"],[lang^="zh"]) .tg *{letter-spacing:normal!important}
.tg ::selection{background:rgba(217,119,87,.24)}
.tg ::-webkit-scrollbar-thumb{background:var(--bd5);border-radius:3px}
.tg *{scrollbar-color:var(--bd5) transparent}
/* the neon flicker on the wordmark, and the pulsing rings, are the old skin */
.tg .flicker{animation:none}

/* ══════════ the header ══════════ */
.tg .hdr{background:var(--bg);border-bottom:1px solid var(--bd2);padding:8px 14px;padding-top:calc(8px + env(safe-area-inset-top,0px));gap:10px}
.tg .logo{gap:8px}
.tg .hamb{width:38px;height:38px;padding:0 10px;gap:4px;border-radius:12px}
.tg .hamb span{height:1.75px;background:var(--text);border-radius:2px}
.tg .hamb span:nth-child(2){width:72%}
.tg .hamb:hover{background:var(--card2)}
.tg .hamb:active{background:var(--bd1)}
.tg .hdr .lbox{height:30px;min-width:0;padding:0 9px;border:1.5px solid var(--clay);border-radius:8px;color:var(--clay);
  font-family:var(--f-app);font-weight:500;font-size:12.5px;letter-spacing:.16em!important;text-indent:.16em}
.tg .hdr-r{gap:8px}
.tg .guestloginpill{height:36px;box-sizing:border-box;gap:7px;padding:0 15px 0 6px;border-radius:999px;
  background:var(--clay-btn);color:#fff;font-family:var(--f-app);font-size:13px;font-weight:500;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 1px 2px rgba(120,50,20,.2),0 6px 14px -8px rgba(185,83,47,.75);transition:transform .15s,box-shadow .15s}
.tg .guestloginpill:active{transform:translateY(1px)}
.tg .guestloginpill .oauthico{width:24px;height:24px;font-size:12.5px;font-weight:500;font-family:var(--f-app);box-shadow:0 1px 2px rgba(0,0,0,.15)}
.tg .guestloginpill-timer{font-family:var(--f-num);font-size:11.5px;opacity:.85}
.tg .hdrgo,.tg .shopbtn,.tg .flagbtn,.tg .metropill{height:36px;box-sizing:border-box;border:1px solid var(--bd4);background:var(--card);box-shadow:var(--sh1);transition:border-color .15s,background .15s,transform .15s}
.tg .hdrgo{width:36px;border-radius:50%;color:var(--clay)}
.tg .hdrgo:hover,.tg .shopbtn:hover,.tg .flagbtn:hover{border-color:var(--clay-ln);background:var(--card);box-shadow:var(--sh1)}
.tg .shopbtn{border-radius:999px;padding:0 12px;color:var(--text);font-family:var(--f-app);font-weight:500}
.tg .shopbtn-coins{font-family:var(--f-num);font-size:12px;font-weight:500;font-variant-numeric:tabular-nums}
.tg .flagbtn{border-radius:999px;padding:0 10px 0 11px;gap:6px}
.tg .flagbtn .caret{font-size:7px;color:var(--muted);font-family:var(--f-app)}
.tg .flagmenu{top:calc(100% + 8px);border:1px solid var(--bd2);border-radius:14px;box-shadow:var(--sh3);padding:6px;min-width:150px;background:var(--card)}
.tg .flagitem{border-radius:10px;padding:9px 11px;gap:10px;font-family:var(--f-app)}
.tg .flagitem .fn{font-size:13.5px;letter-spacing:0;color:var(--text2)}
.tg .flagitem:hover{background:var(--card2)}
.tg .flagitem.active{background:var(--clay-t1)}
.tg .flagitem.active .fn{color:var(--clay-ink);font-weight:500}

/* ══════════ the trial banner ══════════
   It still says what it said and the button still does what it did; it
   just stops shouting on every screen. The last five days keep the loud one. */
.tg .trial-banner{padding:8px 14px 8px 16px;background:linear-gradient(90deg,#f6e4da,#f8ebe3 70%,#f6e4da);color:#8c4127;border-bottom:1px solid rgba(217,119,87,.22)}
.tg .trial-banner-txt{font-family:var(--f-app);font-size:13px;font-weight:500}
.tg .trial-banner-btn{border:0;border-radius:999px;padding:0 14px;height:30px;background:var(--clay-btn);color:#fff;
  font-family:var(--f-app);font-size:12.5px;font-weight:500;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 4px 12px -6px rgba(185,83,47,.8)}
.tg .trial-banner.urgent{background:linear-gradient(90deg,#b45309,#d97757);color:#fff;border-bottom:0}
.tg .trial-banner.urgent .trial-banner-btn{background:#fff;color:#a8502f;box-shadow:0 4px 12px -6px rgba(0,0,0,.35)}
html[data-theme="dark"] .tg .trial-banner:not(.urgent){background:linear-gradient(90deg,#2a1a13,#24170f 70%,#2a1a13);color:#f0b49d;border-bottom-color:rgba(217,119,87,.28)}

/* ══════════ the menu ══════════ */
.tg .drawer-scrim{background:rgba(20,20,19,.36);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
.tg .drawer{background:var(--bg);border-right:1px solid var(--bd2);box-shadow:24px 0 60px -30px rgba(20,20,19,.5);padding-left:12px;padding-right:12px}
.tg .drawer-brand{gap:12px;padding:6px 6px 16px;margin-bottom:10px;border-bottom:1px solid var(--bd2)}
.tg .drawer-brand .lbox{width:40px;height:40px;border-radius:12px;font-family:var(--f-app);font-weight:500;font-size:14px;letter-spacing:.08em!important;background:var(--card);box-shadow:var(--sh1)}
.tg .drawer-brand .lname{font-family:var(--f-app);font-weight:500;font-size:15px;color:var(--text);text-shadow:none;letter-spacing:.06em!important}
.tg .drawer-brand .lsub{font-family:var(--f-num);font-size:10.5px;letter-spacing:.04em!important;color:var(--muted)}
.tg .draweritem{gap:12px;padding:9px 10px;border-radius:14px;margin-bottom:2px;font-family:var(--f-app);font-size:15px;font-weight:500;color:var(--text2);transition:background .15s}
.tg .draweritem:hover{background:var(--card2)}
.tg .draweritem.on{background:var(--card);box-shadow:var(--sh1),inset 0 0 0 1px var(--bd2)}
.tg .draweritem.on .drawerlabel{color:var(--text)}
.tg .drawericon{width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;
  background:var(--card2);box-shadow:inset 0 0 0 1px var(--bd2)}
.tg .draweritem.on .drawericon{background:var(--clay-t1);box-shadow:inset 0 0 0 1px var(--clay-ln)}
.tg .drawerdot{width:6px;height:6px;box-shadow:none}
.tg .drawer-foot{border-top:1px solid var(--bd2);padding-top:8px}
.tg .draweritem.sub{font-size:14px;font-weight:400;color:var(--muted);padding:7px 10px}
.tg .draweritem.sub .drawericon{width:30px;height:30px;font-size:15px;background:transparent;box-shadow:none;color:var(--muted)}

/* ══════════ the learning path ══════════ */
.tg .pathpage{padding:14px 0 36px}
/* the group's colour moves from a glowing bar into the well its icon sits in */


/* ══════════ buttons ══════════
   One primary: a terracotta pill lit from above. One secondary: paper with a
   hairline. A button that cannot be pressed yet still reads — it says why. */
.tg .songbtn.go,.tg .warmup-banner-btn,.tg .cert-dl-btn,.tg .permprimer-btn,.tg .snd,.tg .billtog.on,.tg .dh-chest,
.tg .practicebtn:not(:disabled){
  background:var(--clay-btn);color:#fff;border:0;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 1px 2px rgba(120,50,20,.2),0 6px 14px -8px rgba(185,83,47,.75)}
.tg .songbtn{min-height:44px;border-radius:14px;font-family:var(--f-app);font-size:14px;font-weight:500;letter-spacing:0}
.tg .songbtn.go:hover,.tg .warmup-banner-btn:hover,.tg .cert-dl-btn:hover,.tg .permprimer-btn:hover{filter:brightness(1.04)}
.tg .songbtn.ghost,.tg .cert-share-btn,.tg .permprimer-btn2{background:var(--card);border:1px solid var(--bd4);color:var(--text2);box-shadow:var(--sh1)}
.tg .songbtn:active,.tg .warmup-banner-btn:active,.tg .cert-dl-btn:active,.tg .permprimer-btn:active{transform:translateY(1px)}

/* ══════════ how a page opens ══════════ */
.tg .pathhero{padding:18px 16px 8px;margin-bottom:6px;border-bottom:0}
.tg .pathhero-glow,.tg .profhero-glow{display:none}
.tg .pathbadge{font-family:var(--f-num);font-size:10.5px;font-weight:500;letter-spacing:.16em;color:var(--clay-ink);background:var(--clay-t1);border:0;padding:5px 12px;margin-bottom:12px}
.tg .songpage .pathbadge{color:var(--clay-ink);border:0}
.tg .pathh1{font-family:var(--f-app);font-size:24px;font-weight:500;letter-spacing:0;line-height:1.3;text-shadow:none;margin-bottom:8px}
.tg .pathguide{font-family:var(--f-app);font-size:13.5px;line-height:1.6;color:var(--muted);background:none;border:0;padding:0 10px;max-width:34em}
.tg .v12hero{padding:18px 16px 14px}
.tg .v12title{font-family:var(--f-app);font-size:22px;font-weight:500;letter-spacing:0;line-height:1.35;color:var(--text)}
.tg .v12sub{font-family:var(--f-app);font-size:13.5px;line-height:1.6;color:var(--muted);margin:6px auto 0;max-width:34em}
.tg .pageback,.tg .studioback,.tg .admstu-back,.tg .senseiback{display:inline-flex;align-items:center;gap:6px;height:34px;box-sizing:border-box;
  padding:0 14px 0 11px;border-radius:999px;border:1px solid var(--bd4);background:var(--card);color:var(--text2);box-shadow:var(--sh1);
  font-family:var(--f-app);font-size:13px;font-weight:500;letter-spacing:0;cursor:pointer;transition:border-color .15s,transform .15s}
.tg .pageback{margin:12px 2px 0 14px}
.tg .pageback.inline{margin:0;flex-shrink:0}
.tg .pageback:hover,.tg .studioback:hover,.tg .admstu-back:hover,.tg .senseiback:hover{border-color:var(--bd5)}
.tg .pageback:active,.tg .studioback:active,.tg .admstu-back:active,.tg .senseiback:active{transform:scale(.97);background:var(--card)}

/* ══════════ cards and rows ══════════ */
.tg .v12card{background:var(--card);border:1px solid var(--bd2);border-radius:18px;padding:16px;box-shadow:var(--sh1)}
.tg .songgrid{gap:10px;padding:4px 14px}
.tg .songcard{gap:14px;padding:12px 14px;border-radius:18px;background:var(--card);border:1px solid var(--bd2);border-left:1px solid var(--bd2);box-shadow:var(--sh1);
  transition:transform .2s cubic-bezier(.2,.7,.2,1),box-shadow .2s,border-color .2s}
.tg .songcard:hover{border-color:var(--bd4);box-shadow:var(--sh3);transform:translateY(-1px)}
.tg .songcard:active{transform:scale(.99)}
.tg .songcard-ic{width:46px;height:46px;flex:none;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:23px;filter:none;
  background:var(--card2);background:color-mix(in srgb,var(--sc,#d97757) 10%,var(--card))}
.tg .songcard-nm{font-family:var(--f-app);font-size:15.5px;font-weight:500;letter-spacing:0;line-height:1.35}
.tg .songcard-meta{font-family:var(--f-app);font-size:12.5px;line-height:1.45;margin-top:2px;gap:8px}
.tg .songcard-go{font-size:11px;color:var(--muted)}
.tg .songcard-pb{font-family:var(--f-num);font-size:11px;font-weight:500;letter-spacing:0;color:var(--clay-ink)}
.tg .songcard-badge{font-family:var(--f-app);font-size:10.5px;font-weight:500;letter-spacing:0;border-radius:999px;padding:2px 8px}
.tg .songcard.locked{opacity:.62;filter:saturate(.5)}
.tg .tdstep{gap:14px;padding:12px 14px;margin-bottom:10px;border-radius:18px;background:var(--card);border:1px solid var(--bd2);box-shadow:var(--sh1)}
.tg .tdstep.done{background:var(--card);border-color:var(--clay-ln)}
.tg .tdico{width:44px;height:44px;flex:none;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:21px;background:var(--card2)}
.tg .tdtag{font-family:var(--f-app);font-size:12px;letter-spacing:0;line-height:1.4;color:var(--muted)}
.tg .tdlbl{font-family:var(--f-app);font-size:15px;font-weight:500;line-height:1.4}
.tg .tdgo{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;box-sizing:border-box;padding:0 14px;border-radius:999px;border:0;
  background:var(--clay-t1);color:var(--clay-ink);box-shadow:inset 0 0 0 1px var(--clay-ln);font-family:var(--f-app);font-size:12.5px;font-weight:500;letter-spacing:0}
.tg .tdgo.done{background:var(--clay-t1);color:var(--clay-ink);border:0}
.tg .tdbar{height:6px;border-radius:999px;background:var(--card2);border:0;box-shadow:inset 0 0 0 1px var(--bd1)}
.tg .tdfill{border-radius:999px;background:linear-gradient(90deg,#e08a6c,#d97757)}
.tg .instile{background:var(--card);border:1px solid var(--bd2);border-radius:14px;padding:12px 6px;box-shadow:var(--sh1)}
.tg .instile b{font-family:var(--f-num);font-size:18px;font-weight:500;color:var(--text)}
.tg .instile span{font-family:var(--f-app);font-size:11px;font-weight:400;line-height:1.3;color:var(--muted)}
.tg .insbar{border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,#e08a6c,#d97757)}
.tg .dashcard{background:var(--card);border:1px solid var(--bd2);border-radius:16px;padding:12px 14px;box-shadow:var(--sh1)}
.tg .dashcard-v{font-family:var(--f-num);font-size:22px;font-weight:500}
.tg .dashcard-l{font-family:var(--f-app);font-size:12px}
.tg .dashcard-d{font-family:var(--f-num);font-size:11px;font-weight:500}
.tg .certrow{padding:12px 14px;border-radius:16px;border:1px solid var(--bd2);background:var(--card);box-shadow:var(--sh1)}
.tg .certrow.earned{border-color:var(--clay-ln);background:var(--card)}
.tg .profsec-h{font-family:var(--f-app);font-size:16px;font-weight:500;letter-spacing:0;gap:10px}
.tg .profsec-h::before{display:none}
.tg .cert-banner{margin:12px 14px 0;padding:16px;gap:10px 14px;border-radius:20px;border:1px solid var(--clay-ln);
  background:linear-gradient(135deg,#fbeee7,#fdf7f3);box-shadow:var(--sh1);animation:none}
.tg .cert-banner.locked{background:var(--card);border-color:var(--bd2);opacity:1}
.tg .cert-ic{width:52px;height:52px;flex:none;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;background:var(--card)}
.tg .cert-banner.locked .cert-ic{background:var(--card2);filter:grayscale(1);opacity:.7}
.tg .cert-title{font-family:var(--f-app);font-size:16px;font-weight:500;line-height:1.35}
.tg .cert-sub{font-family:var(--f-app);font-size:12.5px;letter-spacing:0;line-height:1.45;margin-top:3px;color:var(--clay-ink)}
.tg .cert-banner.locked .cert-sub{color:var(--muted)}
.tg .cert-dl-btn,.tg .cert-share-btn{font-family:var(--f-app);font-weight:500;border-radius:999px;padding:9px 16px}
html[data-theme="dark"] .tg .cert-banner:not(.locked){background:linear-gradient(135deg,#2a1a13,#211510)}

/* ══════════ the studio ══════════ */
.tg .warmup-banner{flex-wrap:wrap;gap:12px 14px;margin:12px 14px 0;padding:16px;border-radius:20px;border:1px solid rgba(217,119,87,.22);
  background:linear-gradient(135deg,#fbeee7,#fdf6f1 60%,#fbf1ea);box-shadow:var(--sh1)}
html[data-theme="dark"] .tg .warmup-banner{background:linear-gradient(135deg,#2a1a13,#211510);border-color:rgba(217,119,87,.3)}
.tg .warmup-banner-ic{width:48px;height:48px;flex:none;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:24px;background:var(--card);box-shadow:var(--sh1)}
/* the words get the room; the buttons drop under them when the line is short */
.tg .warmup-banner-body{flex:1 1 200px}
.tg .warmup-banner-btn{margin-left:auto}
.tg .warmup-banner-title{font-family:var(--f-app);font-size:16px;font-weight:500;line-height:1.35}
.tg .warmup-banner-sub{font-size:12.5px;line-height:1.45;margin-top:2px}
.tg .warmup-banner-btn{font-family:var(--f-app);font-size:13px;font-weight:500;border-radius:999px;padding:9px 16px}
.tg .warmup-banner-skip{font-family:var(--f-app);font-size:12.5px;color:var(--muted);padding:6px}
.tg .event-set-btn{width:calc(100% - 28px);min-height:46px;margin:10px 14px 0;padding:0 14px;border:1px solid var(--bd2);border-radius:16px;background:var(--card);
  color:var(--text2);box-shadow:var(--sh1);font-family:var(--f-app);font-size:13.5px;font-weight:500}
.tg .event-set-btn:hover{border-color:var(--bd4);color:var(--text)}
.tg .studio-max-hdr{padding:22px 16px 8px;margin-top:14px;border-top:1px solid var(--bd2);font-family:var(--f-app);font-size:13.5px;font-weight:500;color:var(--text2)}
/* Max, the top plan, in ink and champagne rather than one more terracotta chip */
.tg .studio-max-badge{font-family:var(--f-app);font-size:10.5px;font-weight:500;letter-spacing:.04em;border-radius:999px;padding:3px 9px;background:linear-gradient(180deg,#2e2924,#141413);color:#efd9ad}
.tg .studio-max-unlock{font-family:var(--f-app);font-size:12.5px;font-weight:500;border:0;border-radius:999px;padding:5px 12px;background:var(--clay-t1);color:var(--clay-ink);box-shadow:inset 0 0 0 1px var(--clay-ln)}
.tg .studio-max-card.active{background:var(--clay-t1)}

/* ══════════ the teacher: piano, then the conversation ══════════ */
.tg .senseiback{margin:10px 12px 0}
.tg .dailyrec{gap:10px;margin:10px 12px 0;padding:10px 14px;border-radius:16px;border:1px solid var(--bd2);background:var(--card);box-shadow:var(--sh1)}
.tg .dailyrec-lbl{font-family:var(--f-app);font-size:11px;font-weight:500;letter-spacing:0;color:var(--clay-ink);background:var(--clay-t1);padding:3px 9px;border-radius:999px}
.tg .dailyrec-txt{font-family:var(--f-app);font-size:14px;font-weight:500}
.tg .dailyrec-go{color:var(--muted);font-weight:400}
.tg .pw{background:var(--card2);border-bottom:1px solid var(--bd2);padding:12px 10px 6px}
.tg .plbl{font-family:var(--f-app);font-size:12px;font-weight:500;letter-spacing:0;color:var(--text2)}
.tg .octbtn{width:30px;height:30px;border-radius:10px;border:1px solid var(--bd4);background:var(--card);box-shadow:var(--sh1)}
.tg .octlbl{font-family:var(--f-num);font-size:11px;color:var(--text2)}
.tg .replaybtn{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--clay-ln);background:var(--clay-t1);color:var(--clay-ink);font-family:var(--f-app);font-size:12px;font-weight:500;letter-spacing:0}
.tg .replaybtn:hover{box-shadow:none;background:var(--clay-t2);border-color:var(--clay-ln)}
/* the keys: ivory and ebony under a soft light, not white slabs in a blackout */
/* :where keeps this below .pk.w.lit and the skin lit colours */
:where(.tg) .pk.w{border-color:#d9d3c7;border-radius:0 0 7px 7px;background:linear-gradient(180deg,#fff 70%,#f6f3ec);box-shadow:0 2px 3px rgba(40,30,20,.16),inset 0 -3px 0 #ece7dc}
:where(.tg) .pk.b{border-radius:0 0 5px 5px;border-color:#0f0e0c;background:linear-gradient(180deg,#2c2925,#141312 88%,#24211d);box-shadow:0 3px 6px rgba(20,15,10,.45),inset 0 -2px 0 rgba(255,255,255,.06)}
.tg .kn{font-family:var(--f-num);font-size:8px;color:#a39e93}
.tg .recbtn{min-height:34px;padding:0 16px;border-radius:999px;border:1px solid var(--bd4);background:var(--card);box-shadow:var(--sh1);font-family:var(--f-app);font-size:12.5px;font-weight:500}
.tg .handbtn{border-radius:16px;border:1px solid var(--bd2);background:var(--card);color:var(--text2);box-shadow:var(--sh1);font-family:var(--f-app);font-size:13px;font-weight:500;letter-spacing:0}
.tg .handbtn:hover{color:var(--text2);border-color:var(--bd4)}
.tg .handbtn.on{color:var(--clay-ink);border-color:var(--clay-ln);background:var(--clay-t1);box-shadow:none}
.tg .handbtn.on .handsvg{color:var(--clay);filter:none}
.tg .practicebtn{min-height:46px;border-radius:16px;font-family:var(--f-app);font-size:14px;font-weight:500;letter-spacing:0}
.tg .practicebtn:disabled{opacity:1;background:var(--card2);color:var(--muted);border:0;box-shadow:inset 0 0 0 1px var(--bd2)}
.tg .chdr,.tg .mhdr{background:var(--bg);border-bottom:1px solid var(--bd2)}
.tg .ailbl,.tg .mlbl{font-family:var(--f-app);font-size:12.5px;font-weight:500;letter-spacing:.02em;color:var(--text2)}
.tg .ailbl .dot,.tg .mlbl .dot{width:7px;height:7px;background:#3fa877;box-shadow:0 0 0 3px rgba(63,168,119,.16);animation:none}
.tg .ebtn,.tg .cbtn{min-height:30px;box-sizing:border-box;padding:0 12px;border-radius:999px;border:1px solid var(--bd4);background:var(--card);color:var(--text2);
  font-family:var(--f-app);font-size:12px;font-weight:500;letter-spacing:0;box-shadow:none}
.tg .ebtn:hover,.tg .cbtn:hover{border-color:var(--bd5);background:var(--card);box-shadow:none}
.tg .vmback{width:34px;height:34px;border-radius:50%;border:1px solid var(--bd4);background:var(--card)}
.tg .mpw{background:var(--card2);border-bottom:1px solid var(--bd2)}
.tg .msgs,.tg .mmsgs{padding:14px;gap:12px}
.tg .bbl{font-size:14.5px;line-height:1.7;padding:11px 15px}
.tg .msg.a .bbl{background:var(--card);border:1px solid var(--bd2);border-radius:6px 18px 18px 18px;color:var(--text);box-shadow:var(--sh1)}
.tg .msg.u .bbl{background:#f6e5da;border:0;border-radius:18px 6px 18px 18px;color:var(--text)}
html[data-theme="dark"] .tg .msg.u .bbl{background:rgba(217,119,87,.2);color:#f6e5da}
.tg .atag{font-family:var(--f-app);font-size:11px;font-weight:500;letter-spacing:.02em;color:var(--clay-ink);margin-bottom:4px}
.tg .chatstarters{gap:8px;padding:10px 12px;background:var(--bg);border-top:1px solid var(--bd2)}
.tg .chatstarters-hint{font-family:var(--f-app);font-size:12px;letter-spacing:0;color:var(--muted)}
.tg .starterchip{padding:7px 13px 7px 9px;border-radius:999px;background:var(--card);border:1px solid var(--bd2);box-shadow:var(--sh1)}
.tg .starterchip-tx{font-family:var(--f-app);font-size:12.5px;font-weight:400;color:var(--text2)}
.tg .iw,.tg .miw{background:var(--bg);border-top:1px solid var(--bd2)}
/* 16px: under that, iOS zooms the whole page when the field is tapped */
.tg .tin{background:var(--card);border:1px solid var(--bd4);border-radius:18px;padding:11px 15px;font-size:16px;color:var(--text)}
.tg .tin:focus{border-color:var(--clay);box-shadow:0 0 0 3px var(--clay-t2)}
.tg .snd{width:46px;height:46px;border-radius:50%;font-size:16px}
.tg .snd:hover{transform:none;filter:brightness(1.04)}
.tg .snd:disabled{opacity:1;background:var(--card2);color:var(--muted);box-shadow:inset 0 0 0 1px var(--bd2)}
.tg .hint{font-family:var(--f-num);font-size:10px;letter-spacing:.04em;color:var(--muted)}

/* ══════════ the profile ══════════ */
.tg .dailyhub{gap:12px;margin:12px 12px 6px;padding:14px;border-radius:20px;border:1px solid var(--bd2);background:var(--card);box-shadow:var(--sh1)}
.tg .dailyhub.atrisk{border-color:var(--clay-ln);box-shadow:var(--sh1),0 0 0 3px var(--clay-t1)}
.tg .dh-flame{animation:none}
.tg .dh-streaknum{font-family:var(--f-num);font-size:24px;font-weight:500;color:var(--clay-ink);margin-top:0}
.tg .dh-streaklbl{font-family:var(--f-app);font-size:11px;letter-spacing:0}
.tg .dh-goal-top{font-family:var(--f-app);font-size:13px;font-weight:500}
.tg .dh-goal-top b{font-family:var(--f-num);font-size:12px;font-weight:500;color:var(--clay-ink)}
.tg .dh-goalbar{height:6px;border-radius:999px;background:var(--card2);box-shadow:inset 0 0 0 1px var(--bd1)}
.tg .dh-goalbar div{border-radius:999px;background:linear-gradient(90deg,#e08a6c,#d97757)}
.tg .dh-buyfreeze{font-family:var(--f-app);font-size:11.5px;font-weight:500;border-radius:999px;padding:4px 10px;background:var(--card2);border:1px solid var(--bd2)}
.tg .dh-freeze{font-family:var(--f-app);font-size:11.5px;font-weight:500;color:var(--clay-ink)}
.tg .dh-chest{min-width:66px;border-radius:16px}
.tg .dh-chest span{font-family:var(--f-app);font-size:10.5px;font-weight:500;letter-spacing:0}
.tg .tigatipbar{border-radius:16px;background:var(--card);border:1px solid var(--bd2);box-shadow:var(--sh1);color:var(--text2)}
.tg .tigatipbadge,.tg .tigahub-chip{background:#141413;color:#faf9f5;border:0;font-family:var(--f-app);font-weight:500;letter-spacing:.02em}
html[data-theme="dark"] .tg .tigatipbadge,html[data-theme="dark"] .tg .tigahub-chip{background:#faf9f5;color:#141413}
.tg .profhero{padding:24px 16px 18px;border-bottom:0}
.tg .profava{font-family:var(--f-app);font-weight:500;font-size:30px}
.tg .profname{font-family:var(--f-app);font-size:20px;font-weight:500;text-shadow:none}
.tg .profrankbadge{font-family:var(--f-app);font-size:12.5px;font-weight:500;letter-spacing:0;background:var(--card);box-shadow:var(--sh1)}
.tg .exprow,.tg .expnext{font-family:var(--f-num);font-size:11px;letter-spacing:0}
.tg .expbar{height:8px;border-radius:999px;background:var(--card2);border:0;box-shadow:inset 0 0 0 1px var(--bd1)}
.tg .expfill{border-radius:999px;box-shadow:none;background:linear-gradient(90deg,#e08a6c,#d97757)}
.tg .profpvp{animation:none;box-shadow:0 14px 30px -16px rgba(185,83,47,.8),inset 0 1px 0 rgba(255,255,255,.28)}
.tg .profpvp-b b{font-family:var(--f-app);font-weight:500;letter-spacing:0;text-shadow:none}
.tg .skilltrack{border-radius:20px;border:1px solid var(--bd2);box-shadow:var(--sh1)}
.tg .skt-ttl b{font-family:var(--f-app);font-size:12px;font-weight:500;letter-spacing:0}
.tg .skt-ttl i{font-family:var(--f-app);font-weight:500}
.tg .skt-rank,.tg .skt-sub,.tg .skt-chip-r{font-family:var(--f-num);letter-spacing:0}
.tg .skt-chip-nm{font-family:var(--f-app);font-size:11px;font-weight:500}
.tg .petpod{border-radius:18px;border-color:var(--bd2);box-shadow:var(--sh2)}
.tg .petpod b{font-family:var(--f-app);font-weight:500}

/* ══════════ sheets ══════════
   Settings, plans, welcome and every other sheet in the cream app stood on
   the old violet-and-cyan panel while the rows inside had already moved to
   cream: dark labels on a near-black card. The panel follows its rows now.
   The game rooms' own sheets keep the obsidian they were designed in. */
.tg .setov:not(.setov-ob):not(.setov-shop){background:rgba(20,20,19,.42);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.tg .setcard:not(.ob3):not(.shop-full){background:var(--card);border:1px solid var(--bd2);border-radius:24px;
  box-shadow:0 30px 80px -30px rgba(20,20,19,.5),0 2px 6px rgba(20,20,19,.06)}
.tg .setcard:not(.ob3):not(.shop-full) .sethdr{padding:14px 16px;background:var(--card);border-bottom:1px solid var(--bd2);color:var(--text);
  font-family:var(--f-app);font-size:16px;font-weight:500;letter-spacing:0;text-shadow:none}
.tg .setcard:not(.ob3):not(.shop-full) .setbody{color:var(--text2)}
.tg .setdiv{background:var(--bd2)}
/* the sign-in panel re-asserted its dark colours under .setcard "where the
   surface is always dark" — in light mode it is paper now, so it gets its
   light set back */
html:not([data-theme="dark"]) .tg .setcard:not(.ob3):not(.shop-full) .au{
  --auT:#141413;--auM:#5f5c54;--auS:#ffffff;--auB:#14141326;--auCk:#ffffff;--auAcc:#a8441f;
  --auErrT:#96122f;--auErrBg:#c9184a14;--auErrBd:#c9184a4d;
  --auOkT:#0a6b42;--auOkBg:#0a6b4214;--auOkBd:#0a6b4247;
  --auWarnT:#7a4a08;--auWarnH:#8a4f00;--auWarnBg:#ffb2362e;--auWarnBd:#b57a1a66}
.tg .au-title{font-family:var(--f-app);font-weight:500}
.tg .au-segb,.tg .au-g,.tg .au-in,.tg .au-cta,.tg .au-link,.tg .au-escb{font-family:var(--f-app)}
.tg .au-segb{font-weight:500}
.tg .au-segb.on,.tg .au-cta{background:var(--clay-btn);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 6px 14px -8px rgba(185,83,47,.75)}
.tg .au-cta{font-weight:500}
.tg .au-in{font-size:16px}

.tg .billtoggle{background:var(--card2);box-shadow:inset 0 0 0 1px var(--bd2)}
.tg .billtog{font-family:var(--f-app);font-weight:500}
.tg .billsave{font-family:var(--f-num);font-weight:500}
.tg .prtier{border-radius:18px;border:1px solid var(--bd2);background:var(--card);box-shadow:var(--sh1)}
.tg .prtier.hot,.tg .prtier.max,.tg .prtier.maxfam{border-color:var(--clay);box-shadow:0 0 0 1px var(--clay),var(--sh2);background:var(--card)}
.tg .prtier-nm{font-family:var(--f-app);font-size:16px;font-weight:500}
.tg .prtier-price{font-family:var(--f-app);font-size:22px;font-weight:500;color:var(--clay-ink)}
.tg .prtier.max .prtier-price,.tg .prtier.maxfam .prtier-price{color:var(--clay-ink)}
.tg .prtier-price small{font-size:11.5px;font-weight:400}
.tg .prfeat li{font-family:var(--f-app);font-size:13.5px;line-height:1.55}
.tg .pr-sub,.tg .pr-note{font-family:var(--f-app)}
.tg .pr-school{border:1px solid var(--bd4);border-radius:14px;background:var(--card);font-family:var(--f-app);font-weight:500;box-shadow:var(--sh1)}
.tg .permprimer-overlay{background:rgba(20,20,19,.42);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.tg .permprimer-card{border-radius:24px;box-shadow:0 30px 80px -30px rgba(20,20,19,.5)}
.tg .permprimer-title{font-family:var(--f-app);font-size:18px;font-weight:500}
.tg .permprimer-body{font-size:13.5px;line-height:1.6}
.tg .permprimer-btn,.tg .permprimer-btn2{font-family:var(--f-app);font-weight:500;border-radius:14px}

/* ══════════ playing along: the moment before the first note ══════════
   The set-up used to sit under a navy scrim that turned the cream stage
   grey. It is frosted paper now: the lane shows through, the choices read. */
.tg .songhdr{border-bottom:1px solid var(--bd2);background:var(--bg)}
.tg .songhtitle{font-family:var(--f-app);font-size:16px;font-weight:500}
.tg .songhtitle small{color:var(--clay);letter-spacing:0}
.tg .songready{gap:14px;background:rgba(250,249,245,.8);-webkit-backdrop-filter:blur(12px) saturate(1.1);backdrop-filter:blur(12px) saturate(1.1)}
html[data-theme="dark"] .tg .songready{background:rgba(13,13,12,.78)}
.tg .songready-info{font-family:var(--f-app);font-size:16px;font-weight:500;color:var(--text)}
.tg .songtempo{gap:8px;flex-wrap:wrap;justify-content:center}
.tg .songtempobtn{min-height:36px;box-sizing:border-box;padding:0 15px;border-radius:999px;border:1px solid var(--bd4);background:var(--card);color:var(--text2);
  font-family:var(--f-num);font-size:12.5px;font-weight:500;box-shadow:var(--sh1)}
.tg .songtempobtn.on{border-color:var(--clay);color:var(--clay-ink);background:var(--clay-t1);box-shadow:inset 0 0 0 1px var(--clay)}
.tg .songhandlbl{font-family:var(--f-app);font-size:13px;color:var(--muted);margin-bottom:8px;text-align:center}
.tg .songhands{display:flex;gap:8px;justify-content:center;width:100%;max-width:380px;margin:0 auto}
.tg .songhandbtn{flex:1;min-height:46px;padding:8px 10px;border-radius:14px;border:1px solid var(--bd4);background:var(--card);color:var(--text2);
  font-family:var(--f-app);font-size:14px;font-weight:500;white-space:nowrap;cursor:pointer;box-shadow:var(--sh1);transition:border-color .15s,background .15s}
.tg .songhandbtn.on{border-color:var(--clay);background:var(--clay-t1);color:var(--clay-ink);box-shadow:inset 0 0 0 1px var(--clay)}
.tg .songready-btns{gap:10px}
.tg .songready-btns .songbtn{min-width:132px;border-radius:999px}
.tg .songsrc,.tg .songsrcbar{font-family:var(--f-app);font-size:12px;color:var(--muted)}

/* ══════════ the teacher's own pop-ups ══════════ */
.tg .atpopup{background:rgba(20,20,19,.42);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.tg .atpopup-card{border:1px solid var(--bd2);border-radius:24px;padding:18px 18px 16px;box-shadow:0 30px 80px -30px rgba(20,20,19,.5),0 2px 6px rgba(20,20,19,.06)}
.tg .atpopup-tt{font-family:var(--f-app);font-size:13.5px;font-weight:500;letter-spacing:0;color:var(--clay-ink)}
.tg .atpopup-x{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px}
.tg .atpopup-x:hover{background:var(--card2)}
.tg .atpopup-weak{font-family:var(--f-app);font-size:16px;font-weight:500;line-height:1.6}
.tg .atpopup-steps{font-family:var(--f-app);gap:8px}
.tg .atpopup-step{border-radius:14px;border:1px solid var(--bd2);background:var(--card);box-shadow:var(--sh1);font-family:var(--f-app);padding:11px 14px}
.tg .atpopup-step:active{background:var(--card2)}
.tg .atpopup-step-go{color:var(--clay-ink);font-weight:500}
.tg .atpopup-ok{min-height:48px;border-radius:14px;background:var(--clay-btn);font-family:var(--f-app);font-size:14.5px;font-weight:500;letter-spacing:0;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 6px 14px -8px rgba(185,83,47,.75)}

/* ══════════ the challenge violet ══════════
   Violet marks the challenge features (the ear-gym ladder, "test yourself").
   It stays — at a depth that small text can be read in, on either theme. */
.tg{--vio:#7447e0;--vio-ink:#6a43d6;--vio-t:rgba(124,78,228,.08);--vio-ln:rgba(124,78,228,.3)}
html[data-theme="dark"] .tg{--vio-ink:#b9a4ff;--vio-t:rgba(167,139,250,.12);--vio-ln:rgba(167,139,250,.36)}
.tg .tdgo.vio,.tg .songbtn.go.vio{background:linear-gradient(180deg,#8a5cf0,#7447e0);color:#fff;border:0;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 1px 2px rgba(60,30,120,.2),0 6px 14px -8px rgba(100,60,200,.75)}

/* ══════════ small things ══════════ */
/* white on the brand terracotta is 3:1 — the small badges and "on" states
   that carry white text stand on the richer shade */
.tg .settoggle.on,.tg .setlangbtn.on{background:var(--clay-btn);color:#fff;border-color:transparent}
.tg .settoggle,.tg .setlangbtn,.tg .setbtn{font-family:var(--f-app);font-weight:500}
.tg .billsave{background:var(--clay-t1);color:var(--clay-ink);font-size:10.5px}
.tg .billtog.on .billsave{background:rgba(255,255,255,.22);color:#fff}
.tg .skt-chip-r,.tg .skt-rank,.tg .skt-ttl i{color:var(--cc);color:color-mix(in srgb,var(--cc) 62%,#000)}
html[data-theme="dark"] .tg .skt-chip-r,html[data-theme="dark"] .tg .skt-rank,html[data-theme="dark"] .tg .skt-ttl i{color:color-mix(in srgb,var(--cc) 70%,#fff)}
.tg .profrankbadge{color:color-mix(in srgb,var(--lv-c,#d97757) 72%,#000)}
html[data-theme="dark"] .tg .profrankbadge{color:color-mix(in srgb,var(--lv-c,#d97757) 72%,#fff)}
.tg .expnum{color:var(--clay-ink)}
.tg .admstu-row-sub{color:var(--muted)}

.tg .replaybtn{white-space:nowrap}

/* owner's call: square-cornered cards, the square logo, the orange menu icon */
.tg .hdr .lbox,.tg .drawer-brand .lbox{border-radius:5px}
/* the header wordmark in a true square box */
.tg .hdr .lbox{width:44px;height:44px;min-width:44px;padding:0;box-sizing:border-box;font-size:11.5px;letter-spacing:0!important;text-indent:0}
.tg .hamb span{height:2.5px;background:#d97757}
.tg .hamb span:nth-child(2){width:100%}

/* the learning path: small, tight cards, as the previous version had them */
.tg .pcard{padding:10px 11px 9px}
.tg .pcardlevel{font-size:11px;margin-bottom:4px}
.tg .pcardicon{font-size:24px;margin-bottom:5px}
.tg .pcardtitle{font-size:13px;margin-bottom:2px;line-height:1.3}
.tg .pcardsub{font-size:11px;line-height:1.4;margin-bottom:7px}
.tg .pcardgo{padding-top:6px;font-size:10.5px}
.tg .pgrouphdr{margin-bottom:6px}

/* ══════════ a reading width on wide screens ══════════ */
@media (min-width:900px){
  /* two columns stay two (a tapped card opens its panel under its own row of
     two), so the column narrows to keep the cards in proportion */
  .tg .pathpage,.tg .profscroll{padding-left:max(0px,calc((100% - 780px)/2));padding-right:max(0px,calc((100% - 780px)/2))}
  /* the conversation keeps the same measure; the piano above it stays wide */
  .tg .msgs,.tg .chatstarters,.tg .iw,.tg .chdr{padding-left:max(14px,calc((100% - 780px)/2));padding-right:max(14px,calc((100% - 780px)/2))}
  .tg .dailyrec{max-width:756px;margin-left:auto;margin-right:auto}
  .tg .pw .plblrow{max-width:1100px;margin-left:auto;margin-right:auto}
  .tg .pw .handsel,.tg .pw .practicebtn{max-width:760px;margin-left:auto;margin-right:auto}
}
@media (prefers-reduced-motion:reduce){.tg .pcard{transition:none}}

/* PvP knowledge-break card in light mode: the app's cream card, clay button */
html:not([data-theme="dark"]) .pvpstandby{background:rgba(40,30,20,.35)}
html:not([data-theme="dark"]) .pvpstandby-card{background:#fffdf9;border-color:#ecdcd0;box-shadow:0 26px 60px -22px rgba(60,40,20,.45)}
html:not([data-theme="dark"]) .pvpstandby-ic{filter:none}
html:not([data-theme="dark"]) .pvpstandby-card em{color:#a8502f}
html:not([data-theme="dark"]) .pvpstandby-card b{color:#2b2622;text-shadow:none}
html:not([data-theme="dark"]) .pvpstandby-card p{color:#5c554d}
html:not([data-theme="dark"]) .pvpstandby-n{color:#7a7168;background:#f4efe7;border-color:#e6ddd1}
html:not([data-theme="dark"]) .pvpstandby-go{background:#efe9e1;color:#9a9087;border-color:#e2d8cc}
html:not([data-theme="dark"]) .pvpstandby-go::before{background:linear-gradient(90deg,#f0c2ae,#e8a488)}
html:not([data-theme="dark"]) .pvpstandby-go.on{color:#fff;border-color:#c4623f;background:linear-gradient(180deg,#e08563,#c4623f);box-shadow:0 10px 26px -12px #c4623f}
html:not([data-theme="dark"]) .pvpstandby-card i{color:#8a8178}

/* fight controls in light mode: solid colour tiles, full-colour icons */
html:not([data-theme="dark"]) .pvpact>b,html:not([data-theme="dark"]) .pvpdir>span:first-child,html:not([data-theme="dark"]) .pvpskbtn>b,html:not([data-theme="dark"]) .pvpopt>b{filter:drop-shadow(0 1px 1px rgba(0,0,0,.18))!important}
html:not([data-theme="dark"]) .pvpact>i,html:not([data-theme="dark"]) .pvpact i{color:#fff!important;opacity:1;font-weight:600}
html:not([data-theme="dark"]) .pvpact.fire{background:linear-gradient(160deg,#f08a5d,#d9603b)!important;border-color:transparent!important;color:#fff!important;box-shadow:0 8px 18px -10px #d9603b,inset 0 1px 0 rgba(255,255,255,.35)!important}
html:not([data-theme="dark"]) .pvpact.jump{background:linear-gradient(160deg,#3cc68a,#1f9a66)!important;border-color:transparent!important;color:#fff!important;box-shadow:0 8px 18px -10px #1f9a66,inset 0 1px 0 rgba(255,255,255,.35)!important}
html:not([data-theme="dark"]) .pvpact.punch{background:linear-gradient(160deg,#e2865f,#c4623f)!important;border-color:transparent!important;color:#fff!important;box-shadow:0 8px 18px -10px #c4623f,inset 0 1px 0 rgba(255,255,255,.35)!important}
html:not([data-theme="dark"]) .pvpact.kick{background:linear-gradient(160deg,#e0b43a,#c08a17)!important;border-color:transparent!important;color:#fff!important;box-shadow:0 8px 18px -10px #c08a17,inset 0 1px 0 rgba(255,255,255,.35)!important}
html:not([data-theme="dark"]) .pvpact.rocket{background:linear-gradient(160deg,#5a9be0,#3673c2)!important;border-color:transparent!important;color:#fff!important;box-shadow:0 8px 18px -10px #3673c2,inset 0 1px 0 rgba(255,255,255,.35)!important}
html:not([data-theme="dark"]) .pvpact.petcmd{background:linear-gradient(160deg,#b77be0,#8a4fc2)!important;border-color:transparent!important;color:#fff!important;box-shadow:0 8px 18px -10px #8a4fc2,inset 0 1px 0 rgba(255,255,255,.35)!important}
html:not([data-theme="dark"]) .pvpskbtn,html:not([data-theme="dark"]) .pvpopt{background:linear-gradient(160deg,#8b7ae6,#6a55c9)!important;border-color:transparent!important;box-shadow:0 8px 18px -10px #6a55c9!important}
html:not([data-theme="dark"]) .pvpskbtn *,html:not([data-theme="dark"]) .pvpopt *{color:#fff!important}
html:not([data-theme="dark"]) .pvpdir{background:linear-gradient(160deg,#fff7f1,#f6e3d7)!important;border-color:#e9b99f!important;box-shadow:0 6px 14px -10px rgba(160,80,40,.55)!important}
html:not([data-theme="dark"]) .pvpdir *{color:#a8502f!important}

/* the floating get-the-app button sits on the fight pads: hide it mid-fight */
body:has(.pvppage.fight) .apkpill{display:none!important}

/* lite fight (touch / low-end): keep the look, drop the per-frame repaint */
.pvppage.fight.lite .pvpfighter svg *,.pvppage.fight.lite .pvpwall{animation:none!important}
.pvppage.fight.lite .pvpfighter,.pvppage.fight.lite .pvpfighter *{filter:none!important;-webkit-box-reflect:none!important}
.pvppage.fight.lite .pvpfighter{will-change:transform}
.pvppage.fight.lite *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}

/* PvP quiz keyboard in light mode: a real white/black keyboard, blue answer light */
html:not([data-theme="dark"]) .x3 .pvpkey{background:linear-gradient(180deg,#fff 78%,#f1eee8)!important;border:1px solid #cfc9bf!important;color:#6b6259!important;box-shadow:inset 0 -3px 0 #e6e1d8,0 2px 3px rgba(40,30,20,.14)!important;backdrop-filter:none!important}
html:not([data-theme="dark"]) .x3 .pvpkey.blk{background:linear-gradient(180deg,#2c2925,#121110 88%,#24211d)!important;border-color:#0c0b0a!important;color:#e9e4dc!important;box-shadow:0 3px 6px rgba(20,15,10,.45)!important}
html:not([data-theme="dark"]) .x3 .pvpkey:active{background:linear-gradient(180deg,#eef4ff,#dde8fb)!important}
html:not([data-theme="dark"]) .x3 .pvpkey.blk:active{background:linear-gradient(180deg,#3a3630,#1a1917)!important}
html:not([data-theme="dark"]) .x3 .pvpkey.right,html:not([data-theme="dark"]) .x3 .pvpkey.blk.right{background:linear-gradient(180deg,#5cc8ff,#1f8fe0)!important;border-color:#1a7cc4!important;color:#fff!important;box-shadow:0 0 0 2px rgba(92,200,255,.55),0 0 20px rgba(31,143,224,.55)!important}

/* the fight room in light mode stands in a painted dusk arena instead of on
   blank white; one static image, painted once, so it costs nothing per frame */
html:not([data-theme="dark"]) .pvppage.fight .pvpstage{background:#f3c9a8 url("./img/arena-dusk.svg") center bottom / cover no-repeat!important}
html:not([data-theme="dark"]) .pvppage.fight .pvpstage>.sp3{background:transparent!important}
html:not([data-theme="dark"]) .pvppage.fight .pvpstage>.sp3 *{background:transparent!important}

/* portrait fight: skills stacked above the arrows */
.pvppad-lcol{display:flex;flex-direction:column;gap:9px;min-width:0;flex:1;max-width:210px}
.pvppad-lcol .pvpskills{margin:0;padding:0;max-width:none}
.pvppad-lcol .pvpskbtns{grid-template-columns:1fr;gap:7px}
.pvppad-lcol .pvpskbtn{flex-direction:row;justify-content:center;gap:8px;padding:9px 8px}
.pvppad-lcol .pvpskbtn-ic{width:22px;height:22px}
.pvppad-lcol .pvpskbtn i{display:none}
.pvppage.land .pvppad-lcol{display:contents}

/* portrait skills: two square tiles side by side, each its own colour */
.pvppad-lcol .pvpskbtns{grid-template-columns:repeat(2,76px)!important;gap:9px}
.pvppad-lcol .pvpskbtn{width:76px;height:76px;aspect-ratio:1;flex-direction:column!important;gap:4px!important;padding:6px!important;border-radius:16px}
.pvppad-lcol .pvpskbtn b{font-size:10.5px;line-height:1.15}
html:not([data-theme="dark"]) .pvppad-lcol .pvpskbtn{background:linear-gradient(160deg,#ff7eb3,#e0457f)!important;box-shadow:0 8px 18px -10px #e0457f!important}
html:not([data-theme="dark"]) .pvppad-lcol .pvpskbtn.ult{background:linear-gradient(160deg,#8b7ae6,#5b45c2)!important;box-shadow:0 8px 18px -10px #5b45c2!important}

/* landscape full screen: the answer keyboard rides up to the fighters' waist
   line instead of sitting on the bottom edge */
:fullscreen .pvppage.fight.land .pvpkeys{top:57%;bottom:auto}
.pvppage.fight.land:fullscreen .pvpkeys{top:57%;bottom:auto}
:-webkit-full-screen .pvppage.fight.land .pvpkeys{top:57%;bottom:auto}

/* fighters/pet are eased by a frame loop in pvp-arena; keep them on their own layers */
.pvppage.fight .pvpfighter,.pvppage.fight .pvppet3{will-change:transform}

/* header PVP shortcut: styled as .hdrgo (white round, clay line icon) */
.tg .hdr .hdr-pvp{margin-left:8px}

/* portrait: lift the skills + arrows column 5% of the screen */
.pvppage.fight:not(.land) .pvppad-lcol{transform:translateY(-5vh)}

/* ── fight motion that reads as weight, not keyframes ──
   Lunges and knock-backs tween with a slight overshoot (a body that carries
   momentum and settles), and each fighter breathes and shifts its weight in
   idle. All of it is transform on wrapper layers, so it runs on the
   compositor and never repaints the robot's SVG. */
.pvppage.fight .pvpfighter-in{transition:transform .26s cubic-bezier(.22,1.25,.36,1)}
.pvppage.fight .pvpfighter.knock .pvpfighter-in{transition-duration:.16s}
.pvppage.fight .pvpfbody{transform-origin:50% 100%;animation:pvpBreath 2.6s ease-in-out infinite;will-change:transform}
.pvppage.fight .pvpfighter.op .pvpfbody{animation-duration:2.9s;animation-delay:-1.1s}
.pvppage.fight .pvpfighter.lunge .pvpfbody,.pvppage.fight .pvpfighter.knock .pvpfbody{animation-play-state:paused}
@keyframes pvpBreath{0%,100%{transform:translateY(0) rotate(0) scaleY(1)}
  30%{transform:translateY(-1.2%) rotate(-.6deg) scaleY(1.012)}
  60%{transform:translateY(-.4%) rotate(.5deg) scaleY(1.004)}}
@media (prefers-reduced-motion:reduce){.pvppage.fight .pvpfbody{animation:none}.pvppage.fight .pvpfighter-in{transition:none}}
.pvpbody.pvpbody-top{padding-bottom:0}
.pvpbody.pvpbody-top .pvpsec-h:first-child{margin-top:4px}

/* the pathway's upgrade call-to-action: the loudest thing in the header, still in the clay family */
.tg .pgupgrade{flex-shrink:0;margin-left:auto;margin-right:8px;display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border:0;border-radius:999px;cursor:pointer;
  font-family:var(--f-app);font-weight:600;font-size:13px;color:#fff;white-space:nowrap;
  background:linear-gradient(135deg,#f0a15c,#d9603b 55%,#b8452a);box-shadow:0 8px 18px -8px #c4623f,inset 0 1px 0 rgba(255,255,255,.35);
  animation:pgUpPulse 2.6s ease-in-out infinite}
.tg .pgupgrade:active{transform:scale(.95)}
@keyframes pgUpPulse{0%,100%{box-shadow:0 8px 18px -8px #c4623f,0 0 0 0 rgba(217,96,59,.45)}50%{box-shadow:0 8px 18px -8px #c4623f,0 0 0 7px rgba(217,96,59,0)}}
@media (prefers-reduced-motion:reduce){.tg .pgupgrade{animation:none}}
@media (max-width:380px){.tg .pgupgrade{padding:8px 11px;font-size:12px}}
`;
