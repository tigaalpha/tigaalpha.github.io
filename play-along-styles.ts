/* ── play-along-styles.ts ──
   One world for the whole Play Along screen. The falling-notes stage has
   always been a neon city at night, but everything around it — the header,
   the HUD, the keyboard, the ready and result screens — wore the app's light
   cream theme, so the screen read as two apps glued together. This dresses
   all of it in the stage's own colours:

     magenta #FF3CD2 · cyan #3CE6FF · electric violet #8C46FF
     on deep navy #070318, text in warm white #F4F1FF.

   Every rule is scoped to .songov.playal (and repeated under .tg where the cream
   theme has a rule of its own), so nothing outside Play Along changes. It is
   appended after the theme sheets, so it wins on equal footing. ── */
export const PA_CSS = `
.songov.playal,.tg .songov.playal{background:#070318;color:#f4f1ff;--pl-mag:#ff3cd2;--pl-cyan:#3ce6ff;--pl-vio:#8c46ff;--pl-ink:#f4f1ff;--pl-dim:#b9b0e6;--pl-faint:#8f86c0;--pl-panel:rgba(20,11,51,.78);--pl-line:rgba(140,70,255,.3)}
.songov.playal .pl-num{font-variant-numeric:tabular-nums}
/* header */
.songov.playal .songhdr,.tg .songov.playal .songhdr{background:rgba(7,3,24,.94);border-bottom:1px solid var(--pl-line);color:var(--pl-ink)}
.songov.playal .songhtitle{color:var(--pl-ink);font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.songov.playal .cbtn,.tg .songov.playal .cbtn{color:#dcd3ff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14)}
.pl-hdr-btns{display:flex;gap:8px;align-items:center;flex-shrink:0}
.pl-metro,.pl-pausebtn{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:var(--pl-dim);font-family:var(--f-app);font-size:13px;font-weight:600;cursor:pointer}
.pl-metro.on{border-color:var(--pl-cyan);color:var(--pl-cyan);background:rgba(60,230,255,.08)}
.pl-pausebtn{color:var(--pl-ink);font-size:15px;padding:0 13px}
.pl-metro:focus-visible,.pl-pausebtn:focus-visible,.pl-link:focus-visible,.pl-toggle:focus-visible,.pl-drillbtn:focus-visible{outline:2px solid var(--pl-cyan);outline-offset:2px}
/* HUD + progress + reading strip */
.songov.playal .songhud{color:var(--pl-dim);background:#0b0620;align-items:center}
.songov.playal .songhud b{color:#fff;font-variant-numeric:tabular-nums}
.songov.playal .songhud small{color:var(--pl-faint)}
.songov.playal .combostat.t1 b{color:#c9f6ff}.songov.playal .combostat.t2 b{color:#8cf0ff}.songov.playal .combostat.t3 b{color:#5ce8ff}.songov.playal .combostat.t4 b{color:#3ce6ff;text-shadow:0 0 12px rgba(60,230,255,.8)}
.songov.playal .ghoststat.ahead{color:#5cf2c8}.songov.playal .ghoststat.behind{color:#ff6b8a}
.songov.playal .songprog{background:#150b33}
.songov.playal .songprog>div{background:linear-gradient(90deg,var(--pl-vio),var(--pl-mag))}
.songov.playal .songstaffwrap{background:#05020f;border-bottom:1px solid rgba(140,70,255,.18)}
/* the note being played is marked by a still glow: a pulse inside the
   sliding music layer would repaint that whole layer every frame */
.songov.playal .pastaff-cur{animation:none;opacity:.85}
.pl-drillstop{min-height:30px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,107,138,.5);background:rgba(255,107,138,.1);color:#ff9fb3;cursor:pointer}
/* the stage and its callouts */
.songov.playal .songjudge.perfect{color:var(--pl-cyan);text-shadow:0 0 16px rgba(60,230,255,.7)}
.songov.playal .songjudge.great{color:#a5f4ff;text-shadow:0 0 12px rgba(60,230,255,.4)}
.songov.playal .songjudge.good{color:#cdbdff}
.songov.playal .songjudge.miss,.songov.playal .songjudge.wrong{color:#ff6b8a;font-size:24px}
.songov.playal .pl-el{display:block;font-size:13px;font-weight:600;letter-spacing:.6px;opacity:.85;margin-top:2px;text-shadow:none}
.songov.playal .songpop{color:#e8e2ff}
.songov.playal .songpop.perfect{color:var(--pl-cyan);text-shadow:0 0 12px rgba(60,230,255,.6)}
.songov.playal .burst i{background:var(--pl-mag);color:var(--pl-mag)}
.songov.playal .burst.combo i{background:var(--pl-cyan);color:var(--pl-cyan)}
.songov.playal .songcount,.songov.playal .songgo{color:#fff;text-shadow:0 0 28px var(--pl-mag)}
.songov.playal .songannounce{color:#fff;text-shadow:0 0 18px var(--pl-vio)}
.songov.playal .songbonus{color:var(--pl-cyan);text-shadow:0 0 14px rgba(60,230,255,.5)}
/* fever: a still glow, not a gradient scrolling across the whole screen
   (that one repainted every frame) */
.songov.playal .feverbg{animation:none;opacity:1;background:radial-gradient(ellipse at 50% 100%,rgba(255,60,210,.22),rgba(140,70,255,.08) 55%,transparent 75%)}
.songov.playal .songstage.fever{box-shadow:inset 0 0 70px -12px rgba(255,60,210,.7)}
.songov.playal .feverbadge{text-shadow:0 0 14px var(--pl-mag);animation:none}
/* boss bar: the hit lands on the boss, not in the middle of the notes */
.songov.playal .bosshud.fx-hit .bosshud-face{animation:pl-bosshit .28s ease-out}
.songov.playal .bosshud.fx-attack{animation:pl-bossatk .34s ease-out}
.songov.playal .bosshud.fx-attack.b{animation-name:pl-bossatk2}
.songov.playal .bosshud-fill{width:100%;transition:transform .18s ease}
.songov.playal .bosshud.fx-defeat .bosshud-face{animation:pl-bosshit .5s ease-out}
.bosshud-spark{position:absolute;left:10px;top:50%;width:26px;height:26px;margin-top:-13px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(255,255,255,.9),rgba(255,60,210,.6) 40%,transparent 70%);animation:pl-spark .3s ease-out forwards}
.bosshud-down{margin-left:6px;font-size:11px;font-weight:800;color:#ffd86b;white-space:nowrap}
.songov.playal .bossfx{display:none}
.pl-intro-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:8;max-width:92%;background:rgba(60,230,255,.14);border:1px solid rgba(60,230,255,.5);color:#dffaff;padding:8px 14px;border-radius:12px;font-family:var(--f-app);font-size:13px;pointer-events:none;text-align:center;animation:pl-bob 1.6s ease-in-out infinite}
/* ready screen */
.songov.playal .songready,.tg .songov.playal .songready{background:rgba(7,3,24,.74);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);gap:12px;padding:16px;overflow-y:auto;justify-content:center}
.pl-title{font-family:var(--f-app);font-size:22px;font-weight:700;color:#fff;text-align:center;text-wrap:balance;max-width:92vw}
.pl-meta{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;font-family:var(--f-app);font-size:13px;color:var(--pl-dim)}
.pl-stars{color:#ffd86b;letter-spacing:2px}
.pl-goal{font-family:var(--f-app);font-size:14.5px;font-weight:600;color:var(--pl-cyan);text-align:center}
.pl-daily{font-family:var(--f-app);font-size:13px;color:#ffd86b;text-align:center}
.pl-kindnote{font-family:var(--f-app);font-size:12px;color:#9ef0c9;text-align:center}
.pl-start{min-width:min(78vw,260px);font-size:17px !important;padding:14px 26px !important}
.songov.playal .songbtn.go,.tg .songov.playal .songbtn.go{background:linear-gradient(90deg,var(--pl-vio),var(--pl-mag));color:#fff;border:0;box-shadow:0 8px 26px -10px var(--pl-mag)}
.songov.playal .songbtn.ghost,.tg .songov.playal .songbtn.ghost{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);color:#e8e2ff;box-shadow:none}
.pl-link{background:none;border:0;color:var(--pl-dim);font-family:var(--f-app);font-size:13px;padding:8px 10px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(185,176,230,.4)}
.pl-ready-row{display:flex;gap:4px;justify-content:center;flex-wrap:wrap}
.pl-settings{width:min(92vw,440px);background:var(--pl-panel);border:1px solid var(--pl-line);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;text-align:left}
.pl-set-lbl{font-family:var(--f-app);font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:var(--pl-faint)}
.pl-set-row{display:flex;gap:8px;flex-wrap:wrap}
.pl-set-hint{font-family:var(--f-app);font-size:11.5px;color:var(--pl-faint);line-height:1.45}
.pl-toggle{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:var(--pl-dim);font-family:var(--f-app);font-size:13px;cursor:pointer}
.pl-toggle.on{border-color:var(--pl-cyan);color:var(--pl-cyan);background:rgba(60,230,255,.08)}
.songov.playal .songtempobtn,.tg .songov.playal .songtempobtn,.songov.playal .songhandbtn,.tg .songov.playal .songhandbtn{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);color:#cfc6ff;box-shadow:none}
.songov.playal .songtempobtn.on,.tg .songov.playal .songtempobtn.on,.songov.playal .songhandbtn.on,.tg .songov.playal .songhandbtn.on{border-color:var(--pl-cyan);color:var(--pl-cyan);background:rgba(60,230,255,.08);box-shadow:none}
.songov.playal .songsrc,.tg .songov.playal .songsrc,.songov.playal .songsrcbar,.tg .songov.playal .songsrcbar{color:var(--pl-faint);background:#070318}
.songov.playal .setlistpos{color:#d9c8ff}
.pl-introcard{display:flex;flex-direction:column;align-items:center;gap:12px;max-width:360px;text-align:center}
.pl-sub{font-family:var(--f-app);color:#cfc6ff;font-size:14px;line-height:1.5}
.pl-pvp{width:100%;margin-top:4px;padding:12px;border-radius:12px;border:1px solid var(--pl-line);background:rgba(140,70,255,.08);color:var(--pl-ink)}
.pl-code{flex:1;min-width:0;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#0e0826;color:#fff;text-align:center;font-weight:800;letter-spacing:2px}
.pl-roomcode{font-size:28px;font-weight:900;letter-spacing:6px;text-align:center;margin:6px 0;color:#fff}
.pl-muted{margin-top:8px;font-family:var(--f-app);font-size:13px;color:var(--pl-faint)}
/* pause */
.pl-pause{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(7,3,24,.8);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.pl-pause.count{background:rgba(7,3,24,.45)}
.pl-pause-card{display:flex;flex-direction:column;gap:10px;min-width:230px}
.pl-pause-t{font-family:var(--f-app);font-size:20px;font-weight:700;color:#fff;text-align:center;margin-bottom:4px}
.pl-pause-n{font-family:var(--f-app);font-size:84px;font-weight:800;color:#fff;text-shadow:0 0 30px var(--pl-mag);animation:popcount .6s ease-out}
/* keyboard */
.songov.playal .gpwrap{background:#070318;border-top:1px solid var(--pl-line)}
.songov.playal .gpw{background:linear-gradient(180deg,#1b1244,#0e0826);border-color:rgba(140,70,255,.35)}
.songov.playal .gpw span{color:var(--pl-faint)}
.songov.playal .gpw.lit{background:linear-gradient(180deg,#7ff1ff,#27b6db);box-shadow:0 0 18px rgba(60,230,255,.65),0 0 36px rgba(60,230,255,.25)}
.songov.playal .gpw.lit span{color:#04202a}
.songov.playal .gpw.pressed{filter:brightness(1.35)}
.songov.playal .gpb{background:#05020f;border-color:#2a1d5c;box-shadow:0 4px 8px rgba(0,0,0,.8)}
.songov.playal .gpb.lit{background:linear-gradient(180deg,#ff7ae6,#ff3cd2);box-shadow:0 0 16px rgba(255,60,210,.75)}
.songov.playal .gpfinger{background:var(--pl-vio)}
/* result screen */
.songov.playal .songresult,.tg .songov.playal .songresult{background:#070318;color:var(--pl-ink);padding:14px 16px calc(20px + env(safe-area-inset-bottom,0px));gap:12px;align-items:stretch;text-align:center}
.songov.playal .songresult>:first-child{margin-top:0}
.songov.playal .songresult>:last-child{margin-bottom:0}
.songov.playal .songresult>*{width:100%;max-width:460px;box-sizing:border-box;align-self:center}
.pl-res-top{display:flex;flex-direction:column;align-items:center;gap:4px}
.songov.playal .pl-bigstars{font-size:46px;letter-spacing:6px;text-shadow:none;animation:none;color:inherit;line-height:1.1}
.pl-bigstars span{display:inline-block;color:#2b2257}
.pl-bigstars span.on{color:#ffd86b;text-shadow:0 0 18px rgba(255,216,107,.7);animation:pl-star .5s cubic-bezier(.2,1.4,.4,1) both}
.pl-res-nums{display:flex;gap:14px;align-items:baseline;justify-content:center;font-family:var(--f-app)}
.pl-res-acc{font-size:34px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums}
.pl-res-score{font-size:14px;color:var(--pl-dim)}
.pl-res-score b{color:#fff;font-variant-numeric:tabular-nums}
.pl-res-tags{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;min-height:4px}
.pl-tag{font-family:var(--f-app);font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid rgba(60,230,255,.45);color:var(--pl-cyan)}
.pl-tag.gold{border-color:rgba(255,216,107,.55);color:#ffd86b}
.pl-res-actions{display:flex;gap:10px}
.pl-res-actions .songbtn{flex:1;font-size:16px !important;padding:14px 10px !important;min-height:52px}
.pl-coach{background:var(--pl-panel);border:1px solid var(--pl-line);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;text-align:left}
.pl-coach-goal{font-family:var(--f-app);color:var(--pl-cyan);font-weight:600;font-size:14.5px}
.pl-tip{font-family:var(--f-app);font-size:13.5px;color:#e8e2ff;line-height:1.5}
.pl-tip-badge{font-size:10px;letter-spacing:.8px;padding:2px 6px;border-radius:6px;background:rgba(140,70,255,.32);color:#e0d4ff;margin-right:2px}
.pl-drillbtn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;border-radius:12px;border:1px solid rgba(255,216,107,.5);background:rgba(255,216,107,.08);color:#ffd86b;font-family:var(--f-app);font-size:14px;font-weight:600;cursor:pointer}
.pl-more-btn{align-self:center}
.pl-more{display:flex;flex-direction:column;gap:10px}
.songov.playal .songresult-grid{max-width:none;grid-template-columns:repeat(3,1fr)}
.songov.playal .songresult-grid>div{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}
.songov.playal .songresult-grid span{color:var(--pl-faint)}
.songov.playal .songresult-grid b{color:#fff;font-variant-numeric:tabular-nums;font-size:16px}
.pl-grades{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;font-family:var(--f-app);font-size:12px}
.pl-grades span{padding:3px 9px;border-radius:8px;background:rgba(255,255,255,.06)}
.pl-grades .g-p{color:var(--pl-cyan)}.pl-grades .g-g{color:#a5f4ff}.pl-grades .g-o{color:#cdbdff}.pl-grades .g-m{color:#ff6b8a}
.songov.playal .drillcard{background:var(--pl-panel);border-color:var(--pl-line)}
.songov.playal .songanalysis{text-align:left}
.songov.playal .concertrecap-songs{color:var(--pl-dim)}
.pl-line{border-color:#06c755 !important;color:#06c755 !important}
.pl-back{align-self:center}
.songov.playal .kshelf-card{background:#120a2e;color:var(--pl-ink)}
/* the song list (app theme): earned stars in gold, level chip, search, lock notice */
.songcard-got{color:var(--muted);letter-spacing:1px}
.songcard-got.on{color:#e0a800}
html[data-theme="dark"] .songcard-got.on{color:#ffd86b}
.songcard-lv{padding:1px 7px;border-radius:999px;border:1px solid var(--bd2);font-size:11px}
.songsearch{width:100%;box-sizing:border-box;margin:4px 0 8px;padding:10px 14px;border-radius:12px;border:1px solid var(--bd2);background:var(--card);color:var(--text);font-family:var(--f-app);font-size:14px}
.songsearch:focus-visible{outline:2px solid #8c46ff;outline-offset:1px}
.songlockmsg{margin:6px 0 10px;padding:10px 12px;border-radius:12px;background:var(--card2);border:1px solid var(--bd2);color:var(--text2);font-family:var(--f-app);font-size:13px;line-height:1.45}
@keyframes pl-star{0%{transform:scale(0) rotate(-30deg);opacity:0}70%{transform:scale(1.25) rotate(6deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes pl-bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-5px)}}
@keyframes pl-bosshit{0%{transform:scale(1)}40%{transform:scale(1.35) rotate(-8deg)}100%{transform:scale(1)}}
@keyframes pl-bossatk{0%,100%{transform:translateX(-50%)}25%{transform:translateX(calc(-50% - 5px))}75%{transform:translateX(calc(-50% + 5px))}}
@keyframes pl-bossatk2{0%,100%{transform:translateX(-50%)}25%{transform:translateX(calc(-50% - 5px))}75%{transform:translateX(calc(-50% + 5px))}}
@keyframes pl-spark{0%{transform:scale(.4);opacity:1}100%{transform:scale(1.6);opacity:0}}
@media (prefers-reduced-motion: reduce){
  .songov.playal .songstage.shake,.songov.playal .bosshud.fx-attack,.songov.playal .bosshud .bosshud-face,.pl-intro-hint,.pl-bigstars span.on{animation:none !important}
}
`;
