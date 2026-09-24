/* ── obsidian-styles.ts ──
   The look of the game's own rooms — the arena, the pet sanctuary, the shop,
   the character card and the item locker. The rest of the app keeps its
   cream-and-terracotta; everything here is scoped under .x3 (or one of those
   rooms' containers) and paints explicit colours, so it reads the same in
   light and dark mode.

   The materials: obsidian for the ground, smoked glass for every panel,
   titanium for type and hairlines. Cyan and electric violet are the only two
   hues, and they appear as thin lines, small numbers and rim light — never as
   a fill. Most of each screen is deliberately dark, so the few lit things
   read.

   Type: Prompt (thin, geometric, and it sets Thai properly) for the interface,
   IBM Plex Mono for data — small, spaced, tabular. */
/* ── type ──
   Prompt and IBM Plex Mono, self-hosted (SIL Open Font License — see
   type/OFL-*.txt), Thai and Latin subsets only, hashed into the bundle so the
   service worker keeps them. A browser downloads a face only when text on
   screen needs it, so none of this is paid for outside the game rooms. */
import f_plex_latin_300 from "./type/ibmplexmono-latin-300.woff2?url";
import f_plex_latin_400 from "./type/ibmplexmono-latin-400.woff2?url";
import f_prompt_thai_200 from "./type/prompt-thai-200.woff2?url";
import f_prompt_latin_200 from "./type/prompt-latin-200.woff2?url";
import f_prompt_thai_300 from "./type/prompt-thai-300.woff2?url";
import f_prompt_latin_300 from "./type/prompt-latin-300.woff2?url";
import f_prompt_thai_400 from "./type/prompt-thai-400.woff2?url";
import f_prompt_latin_400 from "./type/prompt-latin-400.woff2?url";
const face = (fam, w, url, range) =>
  `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(${url}) format("woff2");unicode-range:${range}}`;
const FONT_CSS = [
  face("IBM Plex Mono", 300, f_plex_latin_300, "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"),
  face("IBM Plex Mono", 400, f_plex_latin_400, "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"),
  face("Prompt", 200, f_prompt_thai_200, "U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC"),
  face("Prompt", 200, f_prompt_latin_200, "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"),
  face("Prompt", 300, f_prompt_thai_300, "U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC"),
  face("Prompt", 300, f_prompt_latin_300, "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"),
  face("Prompt", 400, f_prompt_thai_400, "U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC"),
  face("Prompt", 400, f_prompt_latin_400, "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"),
].join("\n");

export const OBSIDIAN_CSS = FONT_CSS + `
.x3,.setcard.shop-full,.charcard,.stgpage,.petpage.x3,.ob3{
  --ob0:#030407;--ob1:#05070b;--ob2:#0a0d13;
  --gl:rgba(13,17,25,.62);--gl2:rgba(20,25,35,.66);--gl3:rgba(9,12,18,.78);
  --glhi:rgba(255,255,255,.055);--hair:rgba(200,215,240,.1);--hair2:rgba(200,215,240,.18);--hair3:rgba(200,215,240,.3);
  --ti1:#eef2f8;--ti2:#aeb8c8;--ti3:#6f7a8c;
  --cy:#39d8ff;--cy2:#8fe6ff;--cys:rgba(57,216,255,.13);
  --vi:#7d5bff;--vi2:#a992ff;--vis:rgba(125,91,255,.15);
  --ice:#dfe8ff;--warn:#ff7d8c;
  --f-ui:"Prompt","Noto Sans Thai","Sukhumvit Set","Leelawadee UI",system-ui,-apple-system,"Segoe UI",sans-serif;
  --f-data:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,"Prompt","Noto Sans Thai",monospace;
  /* tracking: generous in Latin, none at all in Thai — spacing Thai letters
     apart pulls the vowels and tone marks off the consonants they sit on */
  --tk1:.06em;--tk2:.14em;--tk3:.22em;
  /* the rarity scale, inside the palette: titanium, cyan, violet, champagne, ice */
  --r-common:#8e98a9;--r-rare:#39d8ff;--r-epic:#8f6dff;--r-legendary:#d8c79f;--r-mythic:#eef2ff;
}
html[lang="th"] .x3,html[lang="th"] .setcard.shop-full,html[lang="th"] .charcard,html[lang="th"] .stgpage,html[lang="th"] .ob3{--tk1:0;--tk2:0;--tk3:0}
/* the app's own theme tokens, re-pointed at glass so every existing rule in
   these rooms that says var(--card) or var(--text) lands on the new material */
.x3,.petpage.x3,.ob3{
  --bg:#05070b;--card:var(--gl);--card2:var(--gl2);--card3:var(--gl3);--grad1:var(--hair2);
  --text:var(--ti1);--text2:var(--ti2);--muted:var(--ti3);
  --bd1:var(--hair);--bd2:var(--hair);--bd3:rgba(200,215,240,.07);--bd4:var(--hair2);--bd5:var(--hair3);--bd6:rgba(200,215,240,.05);
  color-scheme:dark;
}

/* ══════════ the 3D layer ══════════ */
.sp3{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;background:#030407;contain:strict}
/* the still room, shown instantly and kept for any device that does not get
   the real one: a key light pooled on the floor, a horizon filament, a floor
   grid receding under it, and the two accent washes, faint */
.sp3-bg{position:absolute;inset:0;background:
  radial-gradient(46% 30% at 50% 74%,rgba(223,232,255,.075),transparent 72%),
  radial-gradient(70% 46% at 12% 30%,rgba(57,216,255,.045),transparent 70%),
  radial-gradient(70% 46% at 90% 36%,rgba(125,91,255,.06),transparent 70%),
  linear-gradient(180deg,#05060a 0%,#080a11 46%,#040507 47%,#030406 100%)}
.sp3-bg::before{content:"";position:absolute;left:0;right:0;top:46.5%;height:1px;
  background:linear-gradient(90deg,transparent 4%,rgba(57,216,255,.32) 30%,rgba(223,232,255,.5) 50%,rgba(125,91,255,.32) 70%,transparent 96%)}
.sp3-bg::after{content:"";position:absolute;left:-30%;right:-30%;bottom:0;height:54%;
  background:repeating-linear-gradient(90deg,rgba(170,195,255,.06) 0 1px,transparent 1px 58px),repeating-linear-gradient(0deg,rgba(170,195,255,.05) 0 1px,transparent 1px 44px);
  transform:perspective(380px) rotateX(62deg);transform-origin:50% 100%;
  -webkit-mask-image:linear-gradient(transparent,#000 45%);mask-image:linear-gradient(transparent,#000 45%)}
.sp3-cvw{position:absolute;inset:0;opacity:0;transition:opacity 1.1s cubic-bezier(.2,.7,.2,1)}
.sp3.ready .sp3-cvw{opacity:1}
.sp3-cv{width:100%!important;height:100%!important;display:block}
.sp3-cv canvas{display:block}
@media (prefers-reduced-motion:reduce){.sp3-cvw,.pvphero-fig::before,.pr3 .pr-pet::before,.shopstage-fig::before{transition:none}}

/* ══════════ shared pieces ══════════ */
.x3 .stgback,.x3 .pvpfs{width:34px;height:34px;border-radius:50%;background:var(--gl2);border:1px solid var(--hair2);color:var(--ti1);
  box-shadow:inset 0 1px 0 var(--glhi);font-family:var(--f-ui);font-weight:300}
.x3 .stgback:hover,.x3 .pvpfs:hover{border-color:var(--hair3)}
.x3 .pvpfs.on{border-color:var(--cy);color:var(--cy2);background:var(--cys)}
/* the robot's own summoning sigil gives way to the room's real plinth */
.x3 .ca-base{display:none}
/* until the room is up, and on any device that never gets it, the subject
   still stands on something: the plinth drawn flat — an obsidian disc, its
   titanium lip, one faint inner ring and a contact shadow — handing over to
   the real one as that fades in */
.pvphero-fig::before,.pr3 .pr-pet::before,.shopstage-fig::before{content:"";position:absolute;z-index:-1;left:50%;bottom:var(--pf);
  width:var(--pw);aspect-ratio:4.2/1;transform:translate(-50%,50%);border-radius:50%;pointer-events:none;
  background:radial-gradient(closest-side,rgba(0,0,0,.7),rgba(0,0,0,.3) 44%,transparent 45%),
    radial-gradient(closest-side,transparent 70%,rgba(57,216,255,.2) 71.5%,transparent 73.5%),
    radial-gradient(closest-side,#0e121b,#080a10 96%,transparent 100%);
  box-shadow:inset 0 1px 0 rgba(223,232,255,.24),0 4px 0 -1px #06080d,0 5px 0 -1px rgba(223,232,255,.1),0 20px 30px -10px rgba(0,0,0,.9);
  transition:opacity .9s cubic-bezier(.2,.7,.2,1)}
.sp3.ready~.pvphero-fig::before,.sp3.ready~.pr-pet::before,.sp3.ready~.shopstage-fig::before{opacity:0}
.pvphero-fig{--pw:172%;--pf:1.8%}
.shop-bot .shopstage-fig{--pw:190%;--pf:1.8%}
.pr3 .pr-pet,.shop-pet .shopstage-fig{--pw:98%;--pf:7.05%}

/* ══════════ PvP: every screen ══════════ */
.pvppage.x3{background:#05070b;color:var(--ti1);font-family:var(--f-ui);scrollbar-color:var(--hair2) transparent}
.x3 .pvphdr{background:linear-gradient(180deg,rgba(4,6,10,.9),rgba(4,6,10,.6));border-bottom:1px solid var(--hair);
  -webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2)}
.x3 .pvphdr-t{font-family:var(--f-ui);font-weight:300;font-size:15px;letter-spacing:var(--tk1);color:var(--ti1)}
.x3 .pvpscore{font-family:var(--f-data);font-weight:300;color:var(--cy2);letter-spacing:var(--tk1)}
.x3 .pvparena{font-family:var(--f-data);font-weight:300;letter-spacing:var(--tk2);text-transform:uppercase;font-size:9.5px;
  background:var(--gl);border:1px solid var(--hair2);color:var(--ti2)}
.x3 .mdv-cls{background:var(--gl);border:1px solid var(--hair2);color:var(--ti1);font-family:var(--f-ui);font-weight:400;box-shadow:inset 0 1px 0 var(--glhi)}
.x3 .mdv-cls-ic svg{filter:drop-shadow(0 0 4px rgba(57,216,255,.35))}

/* ── the lobby ── */
/* the hero is a window onto the room: the 3D stage fills it, and its lower
   edge dissolves into the page so the glass panels below sit on the same
   darkness the room is made of */
.pvphero{position:relative;height:clamp(320px,56vh,470px);display:flex;align-items:flex-end;justify-content:center;pointer-events:none;overflow:hidden}
.pvphero>.sp3,.pr3>.sp3{position:absolute;inset:0;z-index:0}
.pvphero::after,.pr3::after{content:"";position:absolute;left:0;right:0;bottom:0;height:16%;z-index:1;pointer-events:none;background:linear-gradient(rgba(5,7,11,0),#05070b)}
.pvphero::before,.pr3::before{content:"";position:absolute;left:0;right:0;top:0;height:10%;z-index:1;pointer-events:none;background:linear-gradient(#05070b,rgba(5,7,11,0))}
.pvphero-fig{position:relative;z-index:2;height:82%;margin-bottom:9%;display:flex;align-items:flex-end;justify-content:center}
.pvphero-fig svg.ca{display:block;height:100%;width:auto;filter:drop-shadow(0 22px 20px rgba(0,0,0,.6));
  -webkit-box-reflect:below -6px linear-gradient(transparent 76%,rgba(255,255,255,.13))}
.pvphero-hud{position:absolute;z-index:3;left:18px;top:22px;display:flex;flex-direction:column;gap:3px;max-width:52%;text-align:left}
/* on a phone the read-out takes the left column and the robot stands right
   of centre, the way a product shot leaves room for its caption */
@media (max-width:560px){.pvphero{justify-content:flex-end;padding-right:9%}.pvphero-hud{max-width:46%}.hx-n{font-size:26px}}
.hx-k{font-family:var(--f-data);font-size:9.5px;font-weight:400;letter-spacing:var(--tk3);text-transform:uppercase;color:var(--cy2);opacity:.85}
.hx-n{font-family:var(--f-ui);font-weight:200;font-size:30px;line-height:1.05;letter-spacing:.01em;color:var(--ti1);text-wrap:balance}
.hx-l{display:block;width:44px;height:1px;margin:7px 0 6px;background:linear-gradient(90deg,var(--cy),transparent)}
.hx-m{display:flex;align-items:baseline;gap:10px;font-family:var(--f-data)}
.hx-m i{font-style:normal;font-size:9px;letter-spacing:var(--tk3);color:var(--ti3);min-width:74px}
.hx-m b{font-weight:400;font-size:11.5px;letter-spacing:var(--tk1);color:var(--ti1);font-variant-numeric:tabular-nums}
.pvplobby3 .pvpbody{position:relative;padding-top:4px}
/* the hero already says who this is */
.pvplobby3 .pvpme-nm,.pvplobby3 .pvpme-rank{display:none}
/* the glass panels */
.x3 .pvprank,.x3 .pvpseason,.x3 .pvpme,.x3 .pvpnote,.x3 .pvpempty,.x3 .pvpghostbar{
  background:linear-gradient(180deg,rgba(18,23,33,.66),rgba(10,13,20,.7));border:1px solid var(--hair);
  box-shadow:inset 0 1px 0 var(--glhi),0 18px 40px -26px rgba(0,0,0,.9);
  -webkit-backdrop-filter:blur(14px) saturate(1.15);backdrop-filter:blur(14px) saturate(1.15)}
.x3 .pvprank{border-radius:14px;box-shadow:inset 0 1px 0 var(--glhi)}
.x3 .pvprank-ic{width:18px;height:18px;border-radius:50%;border:1px solid var(--cc,var(--cy));box-shadow:inset 0 0 0 3px rgba(5,7,11,.9),inset 0 0 0 5px var(--cc,var(--cy));opacity:.9;font-size:0}
.x3 .pvprank-b b{font-family:var(--f-ui);font-weight:400;letter-spacing:var(--tk1);color:var(--ti1)}
.x3 .pvprank-bar{background:rgba(200,215,240,.1);height:2px}
.x3 .pvprank-bar i{background:linear-gradient(90deg,var(--cy),var(--vi2))}
.x3 .pvprank-daily{font-family:var(--f-data);font-weight:300;letter-spacing:var(--tk1);color:var(--ti2)}
.x3 .pvpseason{border-radius:14px}
.x3 .pvpseason b{font-family:var(--f-ui);font-weight:400;color:var(--ti1)}
.x3 .pvpseason i,.x3 .pvpseason em{font-family:var(--f-data);font-weight:300;color:var(--ti2)}
.x3 .pvpseason em.pl{color:var(--cy2)}
.x3 .pvpme{border-radius:16px}
.x3 .pvpme-nm{font-family:var(--f-ui);font-weight:300;font-size:18px;letter-spacing:.02em}
.x3 .pvpme-rank{font-family:var(--f-data);letter-spacing:var(--tk2);color:var(--cy2)}
.x3 .pvpsk-b b{font-family:var(--f-ui);font-weight:400;color:var(--ti1)}
.x3 .pvpsk-b b i{background:rgba(200,215,240,.08);color:var(--ti2);font-family:var(--f-data);letter-spacing:var(--tk1)}
.x3 .pvpsk-b span{color:var(--ti2)}
.x3 .pvpsk-ic svg{filter:drop-shadow(0 0 4px rgba(57,216,255,.3))}
.x3 .pvpme-gear,.x3 .pvpmoves{border-top:1px solid var(--hair)}
.x3 .pvpme-gear span,.x3 .pvpmoves span{font-family:var(--f-data);font-weight:300;color:var(--ti2)}
.x3 .pvpmoves b{font-family:var(--f-data);font-weight:400;letter-spacing:var(--tk2);text-transform:uppercase;font-size:9px;color:var(--ti2)}
.x3 .pvpmoves em{background:transparent;border:1px solid rgba(57,216,255,.35);color:var(--cy2);border-radius:4px}
.x3 .pvpmoves i{color:var(--ti1)}
.x3 .pvpsec-h{margin:22px 2px 10px;font-family:var(--f-data);font-weight:400;font-size:10px;letter-spacing:var(--tk3);text-transform:uppercase;color:var(--ti2);gap:10px}
.x3 .pvpsec-h::before{content:"";width:14px;height:1px;background:var(--cy);flex:none}
.x3 .pvpsec-h::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--hair2),transparent);order:3}
.x3 .pvpsec-n{order:2;font-family:var(--f-data);color:var(--ti1);letter-spacing:var(--tk1)}
.x3 .pvpsec-t{order:4;background:transparent;border:1px solid var(--hair2);color:var(--ti2);border-radius:999px;font-family:var(--f-data);font-size:9px;letter-spacing:var(--tk2);padding:3px 10px}
/* cards you can press: glass tiles with a single hairline of colour */
.x3 .pvptier,.x3 .pvploadout,.x3 .pvpcw,.x3 .pvpfriend{
  background:linear-gradient(180deg,rgba(18,23,33,.62),rgba(9,12,19,.7));border:1px solid var(--hair);
  box-shadow:inset 0 1px 0 var(--glhi);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  transition:border-color .25s ease,transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease}
.x3 .pvptier{position:relative;overflow:hidden;border-radius:14px;padding:13px 10px 12px;align-items:flex-start;text-align:left}
.x3 .pvptier::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:1px;background:var(--tc,var(--hair3));opacity:.9}
.x3 .pvptier:hover{border-color:var(--hair3);transform:translateY(-1px)}
.x3 .pvptier:active{transform:scale(.985)}
.x3 .pvptier b{font-family:var(--f-ui);font-weight:400;font-size:13.5px;letter-spacing:.02em;color:var(--ti1)}
.x3 .pvptier i{font-family:var(--f-ui);font-weight:300;font-size:10.5px;color:var(--ti2)}
.x3 .pvptier span{font-family:var(--f-data);font-weight:300;font-size:9px;letter-spacing:var(--tk1);color:var(--ti3)}
.x3 .pvptier em.pvpbossrule{font-style:normal;font-family:var(--f-ui);font-weight:300;font-size:10px;color:var(--warn)}
/* the ladder: one quiet ramp from titanium through cyan to violet */
.x3 .pvptier.t-novice{--tc:#6f7a8c}.x3 .pvptier.t-rookie{--tc:#8e98a9}.x3 .pvptier.t-cadet{--tc:#8fb8d8}
.x3 .pvptier.t-veteran{--tc:#5fc8f0}.x3 .pvptier.t-ranger{--tc:#39d8ff}.x3 .pvptier.t-ace{--tc:#5ea8ff}
.x3 .pvptier.t-elite{--tc:#7b8cff}.x3 .pvptier.t-warlord{--tc:#8f6dff}.x3 .pvptier.t-overlord{--tc:#a992ff}
.x3 .pvptier.t-legend{--tc:#dfe8ff;box-shadow:inset 0 1px 0 var(--glhi),0 0 0 1px rgba(223,232,255,.12)}
.x3 .pvptier.t-gauntlet,.x3 .pvptier.t-weeklyboss,.x3 .pvptier.t-rival,.x3 .pvptier.t-practice,.x3 .pvptier.t-ghost{background:linear-gradient(180deg,rgba(18,23,33,.62),rgba(9,12,19,.7));border-color:var(--hair)}
.x3 .pvptier.t-gauntlet{--tc:#a992ff}.x3 .pvptier.t-weeklyboss{--tc:#d8c79f}.x3 .pvptier.t-rival{--tc:#8f6dff}
.x3 .pvptier.t-practice{--tc:#39d8ff}.x3 .pvptier.t-ghost{--tc:#aeb8c8}
.x3 .pvptier.off{opacity:.5}
.x3 .pvploadout{border-radius:12px;border-style:solid}
.x3 .pvploadout.empty{border-style:dashed;border-color:var(--hair2);background:rgba(10,13,20,.45)}
.x3 .pvploadout b{font-family:var(--f-ui);font-weight:400}
.x3 .pvploadout.empty b{font-weight:200;font-size:20px;color:var(--ti2)}
.x3 .pvploadout i{font-family:var(--f-ui);font-weight:300;color:var(--ti3)}
.x3 .pvpcw{border-radius:12px}
.x3 .pvpcw.on{border-color:var(--g);box-shadow:inset 0 1px 0 var(--glhi),0 0 0 1px color-mix(in srgb,var(--g) 40%,transparent)}
.x3 .pvpcw-sw{box-shadow:0 0 0 1px rgba(255,255,255,.14),0 0 12px -3px var(--g)}
.x3 .pvpcw b{font-family:var(--f-ui);font-weight:400}
.x3 .pvpcw i{font-family:var(--f-data);font-weight:300;color:var(--ti3)}
.x3 .pvpghostbar{border-radius:12px;padding:8px}
.x3 .pvpghostbar button{background:transparent;border:1px solid var(--hair2);color:var(--ti1);font-family:var(--f-ui);font-weight:300;border-radius:999px}
.x3 .pvpghostbar em{color:var(--cy2)}
.x3 .pvptrial{background:rgba(10,13,20,.5);border:1px solid var(--hair);color:var(--ti2)}
.x3 .pvptrial b{font-family:var(--f-data);font-weight:300;color:var(--ti3)}
.x3 .pvptrial.on{border-color:rgba(57,216,255,.35)}
.x3 .pvptrial.on b,.x3 .pvptrial.on span{color:var(--cy2)}
.x3 .pvpfriend-nm{font-family:var(--f-ui);font-weight:400}
.x3 .pvpfriend-go{font-family:var(--f-data);color:var(--cy2);letter-spacing:var(--tk1)}
.x3 .pvpfriend-av{background:rgba(200,215,240,.06)}
.x3 .pvpnote,.x3 .pvpempty{color:var(--ti2);font-family:var(--f-ui);font-weight:300}

/* ── the fight ── */
.pvpstage.x3s{background:#030407;border:1px solid var(--hair);box-shadow:0 30px 60px -30px #000}
.pvpstage.x3s>.sp3{z-index:0}
/* the CSS floor and the old rim wash are both replaced by the room's own
   light; what stays is a thin cyan-and-violet rim, screened, from each side */
.pvpstage.x3s::after{content:"";position:absolute;inset:0;transform:none;-webkit-mask-image:none;mask-image:none;pointer-events:none;z-index:6;
  mix-blend-mode:screen;background:linear-gradient(100deg,rgba(57,216,255,.1) 0%,rgba(57,216,255,0) 24%,rgba(125,91,255,0) 76%,rgba(125,91,255,.12) 100%)}
.pvpstage.x3s::before{background:radial-gradient(84% 76% at 50% 54%,rgba(0,0,0,0) 46%,rgba(0,0,4,.5) 100%)}
.pvpstage.g3 .pvpfighter::before{opacity:.35}
/* the fighters step up off the bottom edge so the polished floor has room to
   show them reflected — the one thing a mirror floor must do */
.pvpstage.x3s{--pvpfloor:26px}
.pvppage.x3.land .pvpstage.x3s{--pvpfloor:88px}
@media (max-width:360px){.pvpstage.x3s{--pvpfloor:16px}}
.pvpstage.x3s .pvpfighter svg.ca,.pvpstage.x3s .pvppet3-in svg{-webkit-box-reflect:below 1px linear-gradient(transparent 74%,rgba(255,255,255,.16))}
.x3 .pvpfighter svg.ca{filter:drop-shadow(0 10px 10px rgba(0,0,0,.55))}
.x3 .pvphps{background:linear-gradient(180deg,rgba(3,4,7,.78),rgba(3,4,7,0))}
.x3 .pvphp{height:5px;border-radius:0;background:rgba(200,215,240,.08);border:none;box-shadow:none;
  clip-path:polygon(0 0,100% 0,calc(100% - 4px) 100%,0 100%)}
.x3 .pvphp.op{clip-path:polygon(0 0,100% 0,100% 100%,4px 100%)}
.x3 .pvphp i{background:linear-gradient(90deg,#1b9fd6,#39d8ff 70%,#bff2ff)}
.x3 .pvphp.op i{background:linear-gradient(90deg,#c5b3ff,#8f6dff 30%,#5b3fd6)}
.x3 .pvphp u{background:rgba(223,232,255,.55);opacity:1}
.x3 .pvphp-n{font-family:var(--f-data);font-weight:300;font-size:9.5px;letter-spacing:var(--tk1);color:var(--ti2);text-shadow:none}
.x3 .pvppips b{width:10px;height:2px;border-radius:0;background:rgba(200,215,240,.18);border:none}
.x3 .pvppips b.on{background:var(--ice);box-shadow:0 0 6px rgba(223,232,255,.7)}
.x3 .pvpvs{font-family:var(--f-data);color:var(--ti1);text-shadow:none}
.x3 .pvpvs b{font-weight:300;font-size:22px;letter-spacing:.02em}
.x3 .pvpvs b.low{color:var(--warn);text-shadow:0 0 10px rgba(255,125,140,.5)}
.x3 .pvpvs i{font-size:8.5px;letter-spacing:var(--tk3);color:var(--ti3)}
.x3 .pvpwall.l{background:linear-gradient(90deg,rgba(57,216,255,.26),rgba(57,216,255,0))}
.x3 .pvpwall.r{background:linear-gradient(270deg,rgba(125,91,255,.3),rgba(125,91,255,0))}
.x3 .pvpflash{font-family:var(--f-data);font-weight:400;letter-spacing:var(--tk1);text-shadow:0 0 12px currentColor,0 2px 4px #000}
.x3 .pvpflash.dmg{color:#eef2ff}.x3 .pvpflash.crit{color:#8fe6ff;font-size:19px}
.x3 .pvpflash.heal{color:#5fe0ff}.x3 .pvpflash.block,.x3 .pvpflash.miss{color:#aeb8c8}.x3 .pvpflash.buff{color:#a992ff}
.x3 .pvpcombo b{font-family:var(--f-ui);font-weight:200;color:var(--ti1);text-shadow:0 0 18px rgba(57,216,255,.55)}
.x3 .pvpcombo i{font-family:var(--f-data);letter-spacing:var(--tk3);color:var(--cy2)}
.x3 .pvpann b{font-family:var(--f-ui);font-weight:200;letter-spacing:var(--tk2);color:#fff;text-shadow:0 0 24px rgba(57,216,255,.45),0 2px 10px #000}
.x3 .pvpann i{font-family:var(--f-data);font-weight:300;letter-spacing:var(--tk3);color:var(--ti2)}
.x3 .pvpko b{font-family:var(--f-ui);font-weight:200;letter-spacing:var(--tk3)}
.x3 .pvpbanner{font-family:var(--f-data);font-weight:400;letter-spacing:var(--tk2);background:rgba(5,7,11,.72);border:1px solid var(--hair2);color:var(--ti1);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
/* the controls: smoked glass keys, one hairline of colour per action */
.x3 .pvpdir,.x3 .pvpact,.x3 .pvpskbtn,.x3 .pvpopt{background:linear-gradient(180deg,rgba(22,27,38,.78),rgba(10,13,20,.84));
  border:1px solid var(--hair2);color:var(--ti1);box-shadow:inset 0 1px 0 var(--glhi),0 10px 24px -14px #000;font-family:var(--f-ui)}
.x3 .pvpact.punch{border-color:rgba(57,216,255,.55)}
.x3 .pvpact.kick{border-color:rgba(125,91,255,.6)}
.x3 .pvpact.fire,.x3 .pvpact.rocket{border-color:rgba(223,232,255,.34)}
.x3 .pvpdir:active,.x3 .pvpact:active{background:linear-gradient(180deg,rgba(57,216,255,.18),rgba(10,13,20,.9))}
.pvppage.x3.land .pvpdir,.pvppage.x3.land .pvpact,.pvppage.x3.land .pvpskbtn,.pvppage.x3.land .pvpopt{background:linear-gradient(180deg,rgba(22,27,38,.62),rgba(10,13,20,.7))}
.pvppage.x3.land .pvpact.punch,.pvppage.x3.land .pvpact.kick{background:linear-gradient(180deg,rgba(22,27,38,.62),rgba(10,13,20,.7))}
.x3 .pvpq{font-family:var(--f-ui);font-weight:300;color:#fff}
.pvppage.x3.land .pvpq{background:linear-gradient(180deg,rgba(10,13,20,.9),rgba(4,6,10,.94));border:1px solid var(--hair2)}
.x3 .pvpuntimed,.x3 .pvpshot-l{font-family:var(--f-data);font-weight:300;letter-spacing:var(--tk1)}

/* the fight's states, re-lit in the room's two colours: a tell is violet, a
   charge is cyan, and only a real danger (the clock, sudden death, a stagger)
   keeps the one warm warning colour */
.x3 .pvpfighter.tell{filter:drop-shadow(0 0 12px rgba(169,146,255,.85)) brightness(1.08)}
.x3 .pvptell{font-family:var(--f-data);font-weight:400;color:#eef2ff;text-shadow:0 0 14px #8f6dff,0 2px 6px #000}
.x3 .pvpdizzy{color:#dfe8ff;text-shadow:0 0 12px rgba(143,230,255,.8)}
.x3 .pvpguardic{filter:grayscale(1) brightness(1.5)}
.x3 .pvpwave{background:rgba(200,215,240,.08);border:none;height:3px}
.x3 .pvpwave i{background:linear-gradient(90deg,#39d8ff,#8f6dff)}
.x3 .pvpwave-l{font-family:var(--f-data);font-weight:300;letter-spacing:var(--tk1);color:var(--ti2)}
.x3 .pvpbotgauge{background:rgba(200,215,240,.08)}
.x3 .pvpbotgauge i{background:#8f6dff}
.x3 .pvpbotgauge.full i{background:linear-gradient(90deg,#8f6dff,#eef2ff)}
.x3 .pvpstage.od{box-shadow:inset 0 0 0 1px rgba(143,230,255,.55),0 0 26px -8px rgba(57,216,255,.55)}
.x3 .pvpstage.comeback{box-shadow:inset 0 0 0 1px rgba(169,146,255,.6),0 0 30px -10px rgba(125,91,255,.6)}
.x3 .pvpstage.sudden{box-shadow:inset 0 0 0 1px rgba(255,125,140,.55),0 0 30px -10px rgba(255,125,140,.45)}
.x3 .pvpstage.staggered{box-shadow:inset 0 0 0 1px rgba(255,125,140,.5),inset 0 0 60px -10px #000}
.x3 .pvpstagger{font-family:var(--f-data);color:var(--warn);text-shadow:0 0 10px rgba(255,125,140,.6),0 2px 4px #000}
/* the decider used to be burnt in with a colour filter over the whole stage,
   which also forces a live 3D canvas through a filter pass every frame */
.x3 .pvpstage.r3{filter:none;border-color:rgba(125,91,255,.3);box-shadow:inset 0 0 60px -10px #000,inset 0 -40px 60px -40px rgba(125,91,255,.4)}
.x3 .pvpstage.finisher.win .pvpfighter.me{filter:drop-shadow(0 0 20px rgba(57,216,255,.8)) brightness(1.1)}
.x3 .pvpstage.finisher.lose .pvpfighter.op{filter:drop-shadow(0 0 20px rgba(125,91,255,.85)) brightness(1.1)}
.x3 .pvpann.fight b{color:#eef2ff;text-shadow:0 0 26px rgba(57,216,255,.7),0 2px 10px #000}
.x3 .pvpann.ko b{color:#eef2ff;text-shadow:0 0 26px rgba(125,91,255,.8),0 2px 10px #000}
.x3 .pvpann.perfect b,.x3 .pvpann.win b{color:#bff2ff;text-shadow:0 0 26px rgba(57,216,255,.8),0 2px 10px #000}
.x3 .pvpann.lose b{color:var(--ti2)}
.x3 .pvpko b{text-shadow:0 0 30px rgba(57,216,255,.6),0 3px 10px #000}
.x3 .pvpcombo b{text-shadow:0 0 18px rgba(57,216,255,.55),0 2px 6px #000}
.x3 .pvpcombo i{text-shadow:0 1px 3px #000}
.x3 .pvpact.ult{background:linear-gradient(180deg,rgba(40,48,64,.8),rgba(12,15,22,.86));border:1px solid rgba(223,232,255,.55);color:#fff;box-shadow:0 0 18px -6px rgba(223,232,255,.6)}
.x3 .pvpskbtn.ult.on{border-color:rgba(223,232,255,.6);box-shadow:0 0 0 1px rgba(223,232,255,.2)}
.x3 .pvpskbtn b{font-family:var(--f-ui);font-weight:400}
.x3 .pvpskbtn i{font-family:var(--f-data);font-weight:300;color:var(--ti3)}
/* the pad's icons are emoji; drained to titanium they read as engraved
   glyphs instead of stickers, and the key's hairline carries the colour */
.x3 .pvpact>b,.x3 .pvpdir.grd>span:first-child{filter:grayscale(1) brightness(1.6) contrast(.9);font-weight:400}
.x3 .pvpact>i{font-family:var(--f-data);font-style:normal;font-weight:400;letter-spacing:var(--tk1);color:var(--ti2)}
.x3 .pvpgmtr{background:rgba(200,215,240,.1)}
.x3 .pvpgmtr i{background:var(--cy)}
.x3 .pvpdir.grd.on{border-color:rgba(57,216,255,.7);box-shadow:inset 0 0 14px -4px rgba(57,216,255,.6)}
.x3 .pvpdir.grd.spent{border-color:rgba(255,125,140,.45);color:var(--warn)}
.x3 .pvpdir.grd.spent .pvpgmtr i{background:var(--warn)}
.x3 .pvpultq-card{background:linear-gradient(180deg,rgba(14,18,27,.94),rgba(6,8,13,.96));border:1px solid rgba(169,146,255,.55);box-shadow:0 0 40px -12px rgba(125,91,255,.6),0 20px 50px -20px #000}
.x3 .pvpultq-card>b{font-family:var(--f-data);font-weight:400;letter-spacing:var(--tk2);color:#c9bcff}
.x3 .pvpultq-opts button{border:1px solid rgba(169,146,255,.4);background:rgba(125,91,255,.08);color:var(--ti1);font-family:var(--f-ui)}
.x3 .pvpobjstrip{background:rgba(5,7,11,.8);border:1px solid var(--hair2)}
.x3 .pvpobjstrip b{font-family:var(--f-data);font-weight:400;letter-spacing:var(--tk2);color:var(--cy2)}
.x3 .pvpobj.on span,.x3 .pvpobj.on em,.x3 .pvptrial.on span,.x3 .pvpghostbar em{color:var(--cy2)}
.x3 .pvptrial.on{border-color:rgba(57,216,255,.35);background:rgba(57,216,255,.05)}
.x3 .pvpkey{background:linear-gradient(180deg,rgba(28,34,46,.85),rgba(12,15,22,.9));border:1px solid var(--hair2);color:var(--ti1)}
.x3 .pvpkey.right,.x3 .pvpkey.blk.right{background:linear-gradient(180deg,rgba(57,216,255,.5),rgba(20,90,120,.6));color:#fff;box-shadow:0 0 0 1px rgba(143,230,255,.8),0 0 18px -4px rgba(57,216,255,.8)}
.x3 .pvpopt{font-family:var(--f-ui);font-weight:400}
.x3 .pvpbig{background:linear-gradient(180deg,rgba(28,34,46,.8),rgba(12,15,22,.86));border:1px solid rgba(57,216,255,.5);color:var(--ti1);font-family:var(--f-ui);font-weight:400;letter-spacing:var(--tk1)}
.x3 .pvpres.win{border-color:rgba(57,216,255,.4);box-shadow:inset 0 1px 0 var(--glhi),0 0 0 1px rgba(57,216,255,.15)}
.x3 .pvpres-rounds span.on{color:var(--cy2);text-shadow:0 0 12px rgba(57,216,255,.5)}

/* ══════════ the pet sanctuary ══════════ */
.petpage.x3{background:#05070b;color:var(--ti1);font-family:var(--f-ui)}
.petpage.pet3{scrollbar-color:var(--hair2) transparent}
.petpage.hatch.x3{background:radial-gradient(70% 40% at 14% 12%,rgba(57,216,255,.05),transparent 70%),radial-gradient(70% 40% at 88% 18%,rgba(125,91,255,.06),transparent 70%),linear-gradient(180deg,#06080d,#040507 60%)}
.sp3-fixed{display:none}
.x3 .pet-top{background:linear-gradient(180deg,rgba(4,6,10,.9),rgba(4,6,10,.55));border-bottom:1px solid var(--hair);
  -webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2)}
.x3 .pet-top>b{font-family:var(--f-ui);font-weight:300;font-size:15px;letter-spacing:var(--tk1)}
.x3 .pet-back{width:34px;height:34px;border-radius:50%;background:var(--gl2);border:1px solid var(--hair2);color:var(--ti1);font-weight:300}
.x3 .pet-coins{font-family:var(--f-data);font-weight:300;color:var(--ti2)}
/* the room: a window onto the sanctuary, not a card */
.pet-room.pr3{height:clamp(330px,54vh,480px);margin:0;border:none;border-radius:0;background:#030407;overflow:hidden}
.pr3 .pr-floor{display:none}
.pr3 .pr-pet{z-index:2;left:50%;bottom:13%;height:64%;width:auto;aspect-ratio:144/156;transform:translateX(-50%);
  filter:drop-shadow(0 18px 18px rgba(0,0,0,.55));touch-action:pan-y;cursor:grab;outline:none;-webkit-tap-highlight-color:transparent;user-select:none}
.pr3 .pr-pet.turning{cursor:grabbing}
.pr3 .pr-pet:active{transform:translateX(-50%)}
.pr3 .pr-pet:focus-visible{outline:1px solid var(--cy);outline-offset:8px;border-radius:14px}
.pr3 .pr-pet.sad{filter:saturate(.55) drop-shadow(0 16px 18px rgba(0,0,0,.6))}
.pr3 .pr-pet>svg{display:block;width:100%;height:100%;-webkit-box-reflect:below -4px linear-gradient(transparent 89%,rgba(255,255,255,.12))}
/* the plinth is real now: the drawing's own floor shadow steps aside */
.pr3 .pr-pet .pa-floor{display:none}
.pr3 .pr-name{position:absolute;left:18px;top:16px;z-index:3;max-width:60%;font-family:var(--f-ui);font-weight:200;font-size:30px;line-height:1.05;color:var(--ti1);text-wrap:balance}
.pr3 .pr-hud{position:absolute;left:18px;top:56px;z-index:3;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:0;margin:0}
.pr3 .pr-hud::before{content:"";display:block;width:40px;height:1px;margin:2px 0 5px;background:linear-gradient(90deg,var(--cy),transparent)}
.pr3 .pr-hud span{background:none;border:none;padding:0;border-radius:0;font-family:var(--f-data);font-weight:400;font-size:10px;letter-spacing:var(--tk2);color:var(--ti2)}
.pr3 .pr-hud .pi-type{color:var(--cy2)!important}
.pr3 .pr-hud .pi-happy{color:var(--ti1)}
.pr3 .pr-hud .pi-happy.low{background:none;color:var(--warn)!important}
.pr3 .pr-deg{position:absolute;right:18px;bottom:12px;z-index:3;font-family:var(--f-data);font-weight:300;font-size:10px;letter-spacing:var(--tk2);color:var(--ti3);font-variant-numeric:tabular-nums}
.pr3 .pr-deg::before{content:"";display:inline-block;width:26px;height:1px;margin-right:8px;vertical-align:middle;background:var(--hair3)}
/* what you bought for it, projected into the room as a hologram */
.pr3 .pet-scene{z-index:1;height:52%;bottom:9%;opacity:.62;mix-blend-mode:screen;filter:saturate(.35) brightness(1.3) drop-shadow(0 0 6px rgba(57,216,255,.45))}
.pr3 .pr-mess{background:rgba(13,17,25,.6);border:1px solid var(--hair2);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:4}
.pr3 .pr-hint{top:auto;bottom:4px;background:rgba(5,7,11,.72);border:1px solid var(--hair2);color:var(--ti2);font-family:var(--f-ui);font-weight:300}
.pr3 .pr-fx{z-index:4}
/* the panels below the room */
.pet3 .pet-bond,.pet3 .pet-tray,.pet3 .pet-shop,.pet3 .pet-arena,.pet3 .pet-exped,.pet3 .pet-shopfur,.pet3 .pet-practice,.pet3 .pet-fork,
.x3 .pet-confirm{background:linear-gradient(180deg,rgba(18,23,33,.66),rgba(10,13,20,.72));border:1px solid var(--hair);color:var(--ti1);
  box-shadow:inset 0 1px 0 var(--glhi),0 18px 40px -26px rgba(0,0,0,.9);-webkit-backdrop-filter:blur(14px) saturate(1.15);backdrop-filter:blur(14px) saturate(1.15)}
.pet3 .pet-shopfur,.pet3 .pet-exped,.pet3 .pet-practice,.pet3 .pet-fork{margin:10px 13px}
.pet3 .pet-bond{border-radius:16px}
.pet3 .pb-row b,.pet3 .pt-hdr b,.pet3 .pet-arena b,.pet3 .pet-shopfur>b,.pet3 .pet-exped>b,.pet3 .pet-fork>b{font-family:var(--f-ui);font-weight:400;letter-spacing:var(--tk1);color:var(--ti1)}
.pet3 .pb-row span,.pet3 .pb-sub{font-family:var(--f-data);font-weight:300;color:var(--ti2)}
.pet3 .pb-bar,.pet3 .ps-bar{height:3px;border:none;background:rgba(200,215,240,.1)}
.pet3 .pb-bar i{background:linear-gradient(90deg,#39d8ff,#a992ff)}
.pet3 .ps-bar i{background:linear-gradient(90deg,#1b9fd6,#39d8ff 60%,#a992ff)!important}
.pet3 .ps-row.low .ps-bar i{background:var(--warn)!important}
.pet3 .pet-stats{padding:4px 18px 2px;gap:9px}
.pet3 .ps-nm{font-family:var(--f-ui);font-weight:300;color:var(--ti2)}
.pet3 .ps-row.low .ps-nm{color:var(--warn);font-weight:400}
.pet3 .ps-n{font-family:var(--f-data);font-weight:300;color:var(--ti1)}
.pet3 .pet-acts{padding:4px 13px 14px}
.pet3 .pet-act{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(22,27,38,.7),rgba(10,13,20,.78));border:1px solid var(--hair2);border-radius:14px;
  box-shadow:inset 0 1px 0 var(--glhi);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.pet3 .pet-act::before{content:"";position:absolute;left:22%;right:22%;top:0;height:1px;background:color-mix(in srgb,var(--ac,#39d8ff) 55%,#aeb8c8)}
.pet3 .pet-act:hover{background:linear-gradient(180deg,rgba(30,36,50,.74),rgba(12,15,23,.8))}
.pet3 .pet-act span{filter:saturate(.35) brightness(1.1)}
.pet3 .pet-act b{font-family:var(--f-ui);font-weight:400}
.pet3 .pet-act u{font-family:var(--f-data);color:var(--ti3)}
.pet3 .pet-why{color:var(--ti3);font-family:var(--f-ui);font-weight:300}
.pet3 .pt-food{background:rgba(16,20,28,.6);border:1px solid var(--hair)}
.pet3 .pt-food.fav{border-color:rgba(216,199,159,.45);background:rgba(216,199,159,.06)}
.pet3 .pt-food em{background:rgba(216,199,159,.9);color:#1d1810}
.pet3 .pt-food b{font-family:var(--f-ui);font-weight:400}
.pet3 .pt-food i,.pet3 .pt-food u{font-family:var(--f-data)}
.pet3 .pt-hdr button{background:var(--gl2);border:1px solid var(--hair2);color:var(--ti1)}
.pet3 .pet-arena{background:linear-gradient(180deg,rgba(18,23,33,.66),rgba(10,13,20,.72))}
.pet3 .pet-arena span{color:var(--ti2);font-weight:300}
.pet3 .pet-arena.off{border-color:rgba(255,125,140,.35)}
.pet3 .pet-arena.off span{color:var(--warn)}
.pet3 .pet-stable{padding:4px 13px 2px}
.pet3 .pet-stall{background:linear-gradient(180deg,rgba(18,23,33,.62),rgba(9,12,19,.7));border:1px solid var(--hair)}
.pet3 .pet-stall b{font-family:var(--f-ui);font-weight:400}
.pet3 .pet-stall i{font-family:var(--f-data)}
.pet3 .pet-stall.on{border-color:rgba(57,216,255,.5);box-shadow:inset 0 0 0 1px rgba(57,216,255,.2)}
.pet3 .pet-stall.on i{color:var(--cy2)}
.pet3 .pet-fur{background:rgba(13,17,25,.6);border:1px solid var(--hair);color:var(--ti1)}
.pet3 .pet-fur b{font-family:var(--f-ui);font-weight:400}
.pet3 .pet-fur i{font-family:var(--f-data);color:var(--ti3)}
.pet3 .pet-fur.own{background:rgba(57,216,255,.06);border-color:rgba(57,216,255,.3)}
.pet3 .pet-exped>i{font-family:var(--f-data);color:var(--cy2)}
.pet3 .pet-exped.done{border-color:rgba(57,216,255,.35)}
.pet3 .pet-exped button{background:rgba(13,17,25,.7);border:1px solid var(--hair2);color:var(--ti1);font-family:var(--f-ui);font-weight:400}
.pet3 .pet-exped-row button b{font-weight:400}
.pet3 .pet-exped-row button i{font-family:var(--f-data);color:var(--ti3)}
.pet3 .pet-practice{color:var(--ti2);font-family:var(--f-ui);font-weight:300}
.pet3 .pet-practice.good{border-color:rgba(57,216,255,.3);color:var(--cy2)}
.pet3 .pet-fork>b{color:var(--ti1)}
.pet3 .pet-fork-opt{background:rgba(13,17,25,.7);border:1px solid rgba(125,91,255,.35);color:var(--ti1)}
.pet3 .pet-fork-opt i{font-family:var(--f-data);color:var(--ti2)}
.x3 .pet-note{background:rgba(9,12,18,.9);border:1px solid var(--hair2);color:var(--ti1);font-family:var(--f-ui);font-weight:300;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.x3 .pet-evo{background:rgba(3,4,7,.86)}
.x3 .pet-evo-in b{font-family:var(--f-ui);font-weight:200;letter-spacing:var(--tk1)}
.x3 .pet-evo-in i{font-family:var(--f-data);color:var(--cy2)}
.x3 .pet-evo-in button{background:transparent;border:1px solid var(--hair3);color:var(--ti1);font-family:var(--f-ui)}
.x3 .pet-evo-art svg{filter:drop-shadow(0 0 26px rgba(57,216,255,.45))}
/* the hatchery */
.x3 .pet-intro{color:var(--ti2);font-weight:300}
.x3 .pet-look{background:var(--gl);border:1px solid var(--hair2);color:var(--ti2);font-family:var(--f-ui);font-weight:400}
.x3 .pet-look.on{border-color:rgba(57,216,255,.55);color:var(--ti1);background:rgba(57,216,255,.08)}
.x3 .pet-look em{font-family:var(--f-data)}
.x3 .pet-card{background:linear-gradient(180deg,rgba(18,23,33,.62),rgba(9,12,19,.7));border:1px solid var(--hair);color:var(--ti1)}
.x3 .pet-card:hover{border-color:var(--hair3)}
.x3 .pet-card.on{border-color:rgba(57,216,255,.6);box-shadow:inset 0 0 0 1px rgba(57,216,255,.25),0 10px 26px -18px rgba(57,216,255,.6)}
.x3 .pet-card>b{font-family:var(--f-ui);font-weight:400}
.x3 .pc-code{font-family:var(--f-data)}
.x3 .pcf-go{background:transparent;border:1px solid rgba(57,216,255,.6);color:var(--ti1);font-family:var(--f-ui);font-weight:400;letter-spacing:var(--tk1)}
.x3 .pcf-name{background:rgba(9,12,18,.8);border:1px solid var(--hair2);color:var(--ti1)}
.x3 .pcf-tags span{background:rgba(200,215,240,.06);border:1px solid var(--hair);color:var(--ti2)}

/* ══════════ the shop · the inspection stage · the character card · the locker ══════════ */
.setov.setov-shop,.setov.setov-ob{background:rgba(2,3,6,.82);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.setcard.shop-full{background:
  radial-gradient(90% 40% at 12% -6%,rgba(57,216,255,.06),transparent 70%),
  radial-gradient(90% 40% at 96% 0%,rgba(125,91,255,.07),transparent 70%),
  linear-gradient(180deg,#07090d,#040507 70%)!important;
  border:1px solid var(--hair2)!important;color:var(--ti1);font-family:var(--f-ui);
  box-shadow:0 40px 90px -30px #000,0 0 0 1px rgba(0,0,0,.6)!important}
.setcard.shop-full .sethdr{background:rgba(4,6,10,.82);border-bottom:1px solid var(--hair);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ti1)}
.setcard.shop-full .shop-hdr-t{font-family:var(--f-ui);font-weight:300;letter-spacing:var(--tk1);color:var(--ti1);text-shadow:none}
.setcard.shop-full .coinpill,.stgpage .coinpill{background:rgba(216,199,159,.06);border:1px solid rgba(216,199,159,.28);color:#e9dcbd;box-shadow:none;font-family:var(--f-data);font-weight:400}
.setcard.shop-full .coinpill.gempill{background:rgba(169,146,255,.07);border-color:rgba(169,146,255,.35);color:#d3c8ff}
.setcard.shop-full .cbtn{background:transparent;border:1px solid var(--hair2);color:var(--ti2);font-family:var(--f-ui);letter-spacing:var(--tk1)}
.setcard.shop-full .cbtn:hover{border-color:var(--hair3);color:var(--ti1)}
.setcard.shop-full .shop-topup-btn{background:transparent;border:1px solid rgba(57,216,255,.55);color:var(--ti1);box-shadow:none;font-family:var(--f-ui);font-weight:400}
.setcard.shop-full .shopintro{background:rgba(13,17,25,.6);border:1px solid var(--hair2);color:var(--ti2);font-weight:300}
.setcard.shop-full .shop-tabs{background:transparent;border-bottom:1px solid var(--hair)}
.setcard.shop-full .shop-tab{background:rgba(13,17,25,.55);border:1px solid var(--hair);color:var(--ti2);font-family:var(--f-ui);font-weight:400;-webkit-backdrop-filter:none;backdrop-filter:none}
.setcard.shop-full .shop-tab-ic,.setcard.shop-full .shop-subtab>span:first-child{filter:grayscale(1) brightness(1.45)}
.setcard.shop-full .shop-tab:hover{border-color:var(--hair3)}
.setcard.shop-full .shop-tab.on{background:rgba(57,216,255,.07);border-color:rgba(57,216,255,.5);color:var(--ti1);box-shadow:inset 0 -1px 0 var(--cy)}
.setcard.shop-full .shop-tab.gem.on{background:rgba(125,91,255,.08);border-color:rgba(169,146,255,.5);box-shadow:inset 0 -1px 0 var(--vi2)}
.setcard.shop-full .shop-tab-n,.setcard.shop-full .shop-tab.on .shop-tab-n{font-family:var(--f-data);color:var(--ti3);background:transparent}
.setcard.shop-full .shopitem-cls{background:transparent!important;border:1px solid var(--hair2)!important;color:var(--ti2)!important;box-shadow:none!important}
.setcard.shop-full .shop-subtabs{background:transparent;border-bottom:1px solid var(--hair)}
.setcard.shop-full .shop-subtab,.setcard.shop-full .shop-allbtn{background:transparent;border:1px solid var(--hair);color:var(--ti2);font-family:var(--f-ui)}
.setcard.shop-full .shop-subtab.on{border-color:var(--hair3);color:var(--ti1);background:rgba(200,215,240,.06);box-shadow:none}
.setcard.shop-full .shop-body,.setcard.shop-full .setbody{background:transparent}
.setcard.shop-full .shop-summary{font-family:var(--f-data);font-weight:300;color:var(--ti3);border-bottom-color:var(--hair)}
/* the cards: smoked glass, one hairline in the piece's rarity, the piece
   standing on a small lit plinth. On a pointer device the card tips toward
   the cursor and a soft glare crosses the glass with it. */
.setcard.shop-full .shopitem,.stgpage .stgitem{--rc:var(--r-common);position:relative;overflow:hidden;isolation:isolate;
  background:linear-gradient(180deg,rgba(18,23,33,.72),rgba(8,10,16,.88));border:1px solid var(--hair);color:var(--ti1);border-radius:14px;
  box-shadow:inset 0 1px 0 var(--glhi),0 16px 30px -22px #000;
  transform:perspective(700px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));
  transition:transform .4s cubic-bezier(.2,.8,.2,1),border-color .25s ease,box-shadow .25s ease}
.setcard.shop-full .shopitem::before,.stgpage .stgitem::before{content:"";position:absolute;left:16%;right:16%;top:0;height:1px;z-index:1;
  background:linear-gradient(90deg,transparent,var(--rc),transparent);opacity:.95}
.setcard.shop-full .shopitem::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .35s ease;
  background:radial-gradient(180px 130px at var(--gx,50%) var(--gy,0%),rgba(223,232,255,.11),transparent 70%)}
.setcard.shop-full .shopitem.tilt::after{opacity:1}
.setcard.shop-full .shopitem.tilt{transition:transform .12s linear,border-color .25s ease}
.setcard.shop-full .shopitem>*{position:relative;z-index:1}
.setcard.shop-full .shopitem.rare,.stgpage .stgitem.rare{--rc:var(--r-rare)}
.setcard.shop-full .shopitem.epic,.stgpage .stgitem.epic{--rc:var(--r-epic)}
.setcard.shop-full .shopitem.legendary,.stgpage .stgitem.legendary{--rc:var(--r-legendary)}
.setcard.shop-full .shopitem.mythic,.stgpage .stgitem.mythic{--rc:var(--r-mythic);background:linear-gradient(180deg,rgba(24,27,42,.8),rgba(9,10,18,.9))}
.setcard.shop-full .shopitem.mythic::before,.stgpage .stgitem.mythic::before{background:linear-gradient(90deg,transparent,var(--cy),var(--vi2),transparent)}
.setcard.shop-full .shopitem:hover,.stgpage .stgitem:hover{border-color:var(--hair3)}
.setcard.shop-full .shopitem:active{transform:perspective(700px) scale(.985)}
.setcard.shop-full .shopitem.equipped,.stgpage .stgitem.on{border-color:rgba(57,216,255,.5);box-shadow:inset 0 1px 0 var(--glhi),0 0 0 1px rgba(57,216,255,.16)}
.setcard.shop-full .shopitem-nm,.stgpage .stgitem-nm{font-family:var(--f-ui);font-weight:400;color:var(--ti1)}
.setcard.shop-full .shopitem-desc{color:var(--ti3);font-weight:300}
.setcard.shop-full .shopitem-rare,.stgpage .stgitem-r{font-family:var(--f-data);font-weight:400;font-size:8.5px;letter-spacing:var(--tk2);text-transform:uppercase;color:var(--rc)!important;text-shadow:none}
.setcard.shop-full .shopitem-art,.stgpage .stgitem-art,.setcard.shop-full .petitem-art,.setcard.shop-full .mdlitem-head{position:relative;isolation:isolate}
.setcard.shop-full .shopitem-art::after,.stgpage .stgitem-art::after,.setcard.shop-full .petitem-art::after{content:"";position:absolute;left:14%;right:14%;bottom:-3px;height:9px;border-radius:50%;z-index:-1;
  background:radial-gradient(ellipse at 50% 50%,rgba(223,232,255,.16),rgba(223,232,255,0) 70%)}
.setcard.shop-full .shopitem-art svg,.stgpage .stgitem-art svg{filter:drop-shadow(0 6px 6px rgba(0,0,0,.6))}
.setcard.shop-full .petitem-art svg{filter:drop-shadow(0 8px 8px rgba(0,0,0,.55))}
.setcard.shop-full .shopitem-tag{margin-top:2px;padding:2px 9px;border-radius:999px;font-family:var(--f-data);font-weight:400;font-size:10px;color:#e9dcbd;background:transparent;border:1px solid rgba(216,199,159,.28)}
.setcard.shop-full .shopitem-tag.gem{color:#d3c8ff;border-color:rgba(169,146,255,.35)}
.setcard.shop-full .shopitem.equipped .shopitem-tag{color:var(--cy2);border-color:rgba(57,216,255,.45)}
.setcard.shop-full .shopitem-up{background:transparent;border:1px solid rgba(57,216,255,.4);color:var(--cy2);font-family:var(--f-data)}
.setcard.shop-full .shopitem-up.poor{background:transparent;border-color:var(--hair);color:var(--ti3)}
.setcard.shop-full .shopitem-up.max{background:transparent;border-color:rgba(216,199,159,.4);color:#e9dcbd}
.setcard.shop-full .shopitem-new{background:rgba(5,7,11,.8);border:1px solid rgba(57,216,255,.7);color:var(--cy2);box-shadow:none;font-family:var(--f-data)}
.setcard.shop-full .shopitem-lv{background:rgba(200,215,240,.1);color:var(--ti1);font-family:var(--f-data)}
.setcard.shop-full .shopitem-lv.max{background:rgba(216,199,159,.16);color:#e9dcbd}
.setcard.shop-full .shopitem.upgraded{box-shadow:inset 0 1px 0 var(--glhi),0 16px 30px -22px #000}
.setcard.shop-full .shopitem-sp,.setcard.shop-full .petitem-bonus,.setcard.shop-full .shopitem-cls{color:var(--ti2);font-weight:300}
.setcard.shop-full .petitem-type{color:var(--cy2)}
.setcard.shop-full .petitem.equipped{border-color:rgba(57,216,255,.5);box-shadow:inset 0 1px 0 var(--glhi),0 0 0 1px rgba(57,216,255,.16)}
.setcard.shop-full .stattrack,.charcard .stattrack{background:rgba(200,215,240,.08)}
.charcard .statval,.setcard.shop-full .statval,.stgpage .statval{color:var(--ti1);text-shadow:none;font-family:var(--f-data)}
/* the four combat stats as four steps of the room's own ramp, cyan to violet */
:is(.setcard.shop-full,.charcard,.ob3,.x3) .stattrack{height:3px;border-radius:0;background:rgba(200,215,240,.08)}
:is(.setcard.shop-full,.charcard,.ob3,.x3) .statrow:nth-child(1) .stattrack i{background:#39d8ff!important}
:is(.setcard.shop-full,.charcard,.ob3,.x3) .statrow:nth-child(2) .stattrack i{background:#8fc4ff!important}
:is(.setcard.shop-full,.charcard,.ob3,.x3) .statrow:nth-child(3) .stattrack i{background:#8f8cff!important}
:is(.setcard.shop-full,.charcard,.ob3,.x3) .statrow:nth-child(4) .stattrack i{background:#b39cff!important}
:is(.setcard.shop-full,.charcard,.ob3,.x3) .statrow:nth-child(n+5) .stattrack i{background:#dfe8ff!important}
.charcard .statlbl,.setcard.shop-full .statlbl{color:var(--ti3)}
@media (hover:none){.setcard.shop-full .shopitem{transform:none}}
@media (prefers-reduced-motion:reduce){.setcard.shop-full .shopitem,.stgpage .stgitem{transition:none;transform:none!important}}

/* the detail sheets: chassis, pet, gear */
.setcard.mdv.ob3{background:linear-gradient(180deg,#07090d,#040507)!important;border:1px solid var(--hair2)!important;color:var(--ti1);font-family:var(--f-ui);
  box-shadow:0 40px 90px -30px #000!important}
.ob3 .mdv-hdr{border-bottom:1px solid var(--hair)}
.ob3 .mdv-ttl{font-family:var(--f-ui);font-weight:300;font-size:17px;color:var(--ti1);letter-spacing:.01em}
.ob3 .mdv-ttl b{font-family:var(--f-data);font-weight:400;font-size:9.5px;letter-spacing:var(--tk2);color:var(--cy2)}
.ob3 .mdv-ttl b.gdv-r{color:var(--rc,var(--ti2))}
.gdv-r.r-common{--rc:var(--r-common)}.gdv-r.r-rare{--rc:var(--r-rare)}.gdv-r.r-epic{--rc:var(--r-epic)}.gdv-r.r-legendary{--rc:var(--r-legendary)}.gdv-r.r-mythic{--rc:var(--r-mythic)}
.gdv-ic{display:block;width:30px;height:30px;flex:none}
.gdv-ic svg{display:block;width:100%;height:100%;filter:drop-shadow(0 3px 4px rgba(0,0,0,.6))}
.ob3 .mdv-cls{background:rgba(13,17,25,.6);border:1px solid var(--hair2);color:var(--ti1);font-family:var(--f-ui);font-weight:400}
.ob3 .mdv-sub{color:var(--ti2);font-weight:300}
.ob3 .mdv-sec{border-top:1px solid var(--hair)}
.ob3 .mdv-sec-h{font-family:var(--f-data);font-weight:400;font-size:10px;letter-spacing:var(--tk2);text-transform:uppercase;color:var(--ti2)}
.ob3 .mdv-sec-h b{font-family:var(--f-data);font-size:15px;font-weight:300;letter-spacing:0;color:var(--ti1)}
.ob3 .mdv-pro{background:transparent;border:1px solid rgba(57,216,255,.4);color:var(--cy2);font-family:var(--f-ui);font-weight:400}
.ob3 .mdv-con{background:transparent;border:1px solid rgba(169,146,255,.35);color:#c9bcff;font-family:var(--f-ui);font-weight:400}
.ob3 .mdv-fair{color:var(--ti3);font-weight:300}
.ob3 .mdv-skill{border-top:1px solid var(--hair)}
.ob3 .mdv-skill-n{font-family:var(--f-ui);font-weight:400;color:var(--ti1)}
.ob3 .mdv-skill-n i{background:rgba(200,215,240,.08);color:var(--ti2);font-family:var(--f-data)}
.ob3 .mdv-skill.t-active .mdv-skill-n i{background:rgba(57,216,255,.1);color:var(--cy2)}
.ob3 .mdv-skill.t-ultimate .mdv-skill-n i{background:rgba(125,91,255,.14);color:#c9bcff}
.ob3 .mdv-skill-d{color:var(--ti2);font-weight:300}
.ob3 .mdv-foot{border-top:1px solid var(--hair)}
.ob3 .mdv-buy{background:linear-gradient(180deg,rgba(28,34,46,.85),rgba(12,15,22,.9));border:1px solid rgba(57,216,255,.55);color:var(--ti1);font-family:var(--f-ui);font-weight:400;letter-spacing:var(--tk1);box-shadow:inset 0 1px 0 var(--glhi)}
.ob3 .mdv-buy:hover{border-color:var(--cy);filter:none}
.ob3 .mdv-buy.poor{background:transparent;border:1px solid var(--hair);color:var(--ti3);box-shadow:none}
.ob3 .mdv-buy.on{background:rgba(57,216,255,.06);border:1px solid rgba(57,216,255,.35);color:var(--cy2);box-shadow:none}
.ob3 .cs-turn{background:rgba(5,7,11,.72);border:1px solid var(--hair2);box-shadow:none}
.ob3 .cs-turn-b{background:rgba(13,17,25,.8);border:1px solid var(--hair2);color:var(--ti1)}
.ob3 .cs-turn-deg{font-family:var(--f-data);color:var(--ti2)}
.pdv-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--hair)}
.pdv-row i{font-style:normal;font-family:var(--f-data);font-size:10px;letter-spacing:var(--tk2);color:var(--ti3)}
.pdv-row b{font-family:var(--f-ui);font-weight:400;font-size:13px;color:var(--ti1);text-align:right}
.gdv-delta{display:flex;align-items:center;gap:12px;font-family:var(--f-data);font-size:11px;color:var(--ti2)}
.gdv-delta b{font-weight:400;color:var(--ti1);font-size:14px}
.gdv-delta b.up{color:var(--cy2)}
.gdv-delta b.down{color:#c9bcff}
.gdv-delta i{flex:1;height:1px;background:linear-gradient(90deg,var(--hair3),transparent)}
/* the stage itself */
.shopstage,.mdv-stage.shopstage{position:relative;height:clamp(300px,46vh,420px);border-radius:14px;overflow:hidden;background:#030407;border:1px solid var(--hair);display:block}
.shopstage>.sp3{position:absolute;inset:0;z-index:0;border-radius:inherit}
.shopstage::after{content:"";position:absolute;left:0;right:0;bottom:0;height:14%;z-index:1;pointer-events:none;background:linear-gradient(rgba(3,4,7,0),#030407)}
.shopstage-fig{position:absolute;z-index:2;left:50%;bottom:14%;transform:translateX(-50%);touch-action:pan-y;cursor:grab;outline:none;user-select:none;-webkit-tap-highlight-color:transparent}
.shopstage-fig.turning{cursor:grabbing}
.shopstage-fig:focus-visible{outline:1px solid var(--cy);outline-offset:8px;border-radius:14px}
.shop-pet .shopstage-fig{height:60%;aspect-ratio:144/156}
.shop-bot .shopstage-fig{height:76%;aspect-ratio:160/416}
/* direct child only: the robot carries its gear as nested SVGs, and a rule
   that reaches them blows a crown up to the size of the whole figure */
.shopstage-fig>svg{display:block;width:100%;height:100%;filter:drop-shadow(0 16px 16px rgba(0,0,0,.55));-webkit-box-reflect:below -4px linear-gradient(transparent 88%,rgba(255,255,255,.12))}
.shopstage-fig .pa-floor,.shopstage-fig .ca-base{display:none}
.mdv-stage.shopstage>svg{display:none}
.shopstage-deg{position:absolute;right:14px;bottom:10px;z-index:3;font-family:var(--f-data);font-size:10px;letter-spacing:var(--tk2);color:var(--ti3);font-variant-numeric:tabular-nums}
.shopstage-hint{position:absolute;left:14px;bottom:10px;z-index:3;font-family:var(--f-ui);font-weight:300;font-size:10.5px;color:var(--ti3)}

/* ── the character card (profile) and the item locker: the same materials, drawn in CSS ── */
.charcard{background:radial-gradient(110% 50% at 0% 0%,rgba(57,216,255,.06),transparent 60%),radial-gradient(100% 50% at 100% 0%,rgba(125,91,255,.07),transparent 60%),linear-gradient(180deg,#07090d,#040507)!important;
  border:1px solid var(--hair2);color:var(--ti1);box-shadow:0 20px 44px -26px #000}
.charcard .charcard-hdr{color:var(--ti1);text-shadow:none;font-family:var(--f-ui);font-weight:300;letter-spacing:var(--tk1)}
.charcard .char-modelpill{background:rgba(13,17,25,.6);border:1px solid var(--hair2);color:var(--ti1)}
.charcard .char-modelpill b{color:var(--cy2)}
.charcard .charstage{background:radial-gradient(60% 34% at 50% 88%,rgba(223,232,255,.08),transparent 72%),radial-gradient(70% 50% at 50% 10%,color-mix(in srgb,var(--keyA) 10%,transparent),transparent 70%),linear-gradient(180deg,#06080c,#030407);
  border:1px solid var(--hair);box-shadow:inset 0 0 40px -12px #000}
.charcard .cs-grid{opacity:.35}
.charcard .cs-av svg.ca{filter:drop-shadow(0 12px 14px rgba(0,0,0,.6))}
.charcard .cs-hud-tag{color:var(--cy2);text-shadow:none;font-family:var(--f-data)}
.charcard .cs-hud-pwr{color:var(--ti2);font-family:var(--f-data)}
.charcard .cs-turn{background:rgba(5,7,11,.72);border:1px solid var(--hair2);box-shadow:none}
.charcard .cs-turn-b{background:rgba(13,17,25,.8);border-color:var(--hair2);color:var(--ti1)}
.charcard .cs-turn-deg{color:var(--ti2);font-family:var(--f-data)}
.charcard .cs-turn-hint{background:rgba(5,7,11,.88);color:var(--ti1);border-color:var(--hair2)}
.charcard .charstage.rar-rare,.charcard .charstage.rar-epic,.charcard .charstage.rar-legendary{box-shadow:inset 0 0 40px -12px #000,0 0 0 1px color-mix(in srgb,var(--keyA) 30%,transparent)}
.charcard .battlecard{background:rgba(13,17,25,.6);border:1px solid var(--hair)}
.charcard .battlecard-h{color:var(--ti1);font-family:var(--f-ui);font-weight:400}
.charcard .battlecard-t{color:var(--ti1);text-shadow:none;font-family:var(--f-data)}
.charcard .statrow,.charcard .statrow span{color:var(--ti2)}
.charcard .battlecard-sp{border-top-color:var(--hair);color:var(--ti1)}
.charcard .battlecard-sp b{color:var(--ti3)}
.charcard .battlecard-skills,.charcard .mdv-skill{border-top-color:var(--hair)}
.charcard .mdv-skill-n{color:var(--ti1)}
.charcard .mdv-skill-n i{background:rgba(200,215,240,.08);color:var(--ti2)}
.charcard .mdv-skill.t-active .mdv-skill-n i{background:rgba(57,216,255,.1);color:var(--cy2)}
.charcard .mdv-skill.t-ultimate .mdv-skill-n i{background:rgba(125,91,255,.14);color:#c9bcff}
.charcard .mdv-skill-d{color:var(--ti2)}
.charcard .battlecard-soon.as-btn{background:transparent;border:1px solid rgba(57,216,255,.45);color:var(--ti1)}
.charcard .char-slot{background:rgba(13,17,25,.6);border:1px solid var(--hair)}
.charcard .char-slot-nm{color:var(--ti1)}
.charcard .char-slot-rare{color:var(--cy2);text-shadow:none;font-family:var(--f-data)}
.charcard .char-actions .songbtn.ghost{background:transparent;border:1px solid var(--hair3);color:var(--ti1)}
.stgpage{margin-top:8px;border-radius:18px;color:var(--ti1);background:radial-gradient(110% 40% at 0% 0%,rgba(57,216,255,.05),transparent 60%),linear-gradient(180deg,#07090d,#040507);border:1px solid var(--hair2)}
.stgpage .stghdr{background:rgba(4,6,10,.88);border-bottom-color:var(--hair);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-radius:18px 18px 0 0}
.stgpage .stgttl{color:var(--ti1);text-shadow:none;font-family:var(--f-ui);font-weight:300}
.stgpage .stgback{background:rgba(13,17,25,.7);border-color:var(--hair2);color:var(--ti1)}
.stgpage .stgstat{background:rgba(13,17,25,.6);border-color:var(--hair)}
.stgpage .stgstat b{color:var(--ti1);font-family:var(--f-data);font-weight:400}
.stgpage .stgstat span,.stgpage .stgsec-n{color:var(--ti3)}
.stgpage .stgsec-t{color:var(--ti1)}
.stgpage .stgempty{border-color:var(--hair2);color:var(--ti3)}
.stgpage .stgempty:hover{border-color:rgba(57,216,255,.5);color:var(--ti1)}
.stgpage .stgitem-on{background:var(--cy);box-shadow:0 0 8px -2px var(--cy)}
.stgpage .stgshop{background:transparent;border-color:rgba(57,216,255,.45);color:var(--ti1)}

/* ── results ── */
.x3 .pvpres{background:linear-gradient(180deg,rgba(18,23,33,.66),rgba(10,13,20,.72));border:1px solid var(--hair);box-shadow:inset 0 1px 0 var(--glhi)}
.x3 .pvpres-score{font-family:var(--f-ui);font-weight:200;letter-spacing:.02em;color:var(--ti1)}
.x3 .pvpres-sub,.x3 .pvpres-line{font-family:var(--f-ui);font-weight:300;color:var(--ti2)}
.x3 .pvpres-rew span{font-family:var(--f-data);font-weight:300}
.x3 .pvpghost{background:transparent;border:1px solid var(--hair3);color:var(--ti1);font-family:var(--f-ui);font-weight:400;border-radius:999px}
.x3 .pvpres-stage{background:radial-gradient(60% 40% at 50% 92%,rgba(223,232,255,.08),transparent 70%)}
`;
