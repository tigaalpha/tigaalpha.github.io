import { useState, useEffect, useMemo, useRef, memo } from "react";
import { L, tr } from "./i18n";
import { PlayAlongStaff, GamePiano, laneHue } from "./music-engine";
import { CountUp } from "./app-shell";
import { useGameField } from "./play-along-store";
import { songStars, songBestAcc, songLengthSec, readDailyState, DAILY_SONG_REWARD } from "./play-along-progress";
import { nextStarGoal } from "./play-along-judge";
/* ── SongPlayOverlay ──
   The Play Along (falling-notes song mode) full-screen overlay.

   Everything that changes while a song runs — score, combo, the lit key,
   the reading staff, every Perfect/Miss flash — is read from the game store
   (play-along-store.ts) by the small pieces below, each subscribed to its
   own fields. This component itself only re-renders when the phase or the
   result changes, and PianoApp never re-renders for a hit at all.

   Every screen has one job and one big button: the ready screen starts the
   song, the result screen plays it again. Everything else is folded away
   until it is wanted, and every button leads somewhere inside Play Along. ── */
const T3 = (lang) => (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
const fmtTime = (sec) => { const s2 = Math.max(0, Math.floor(Number(sec) || 0)); return Math.floor(s2 / 60) + ":" + String(s2 % 60).padStart(2, "0"); };
const starRow = (n) => "★".repeat(Math.max(0, n)) + "☆".repeat(Math.max(0, 3 - n));

/* ── Online PvP room panel (Play Along plan #10) — the ready-screen UI for
   realtime duel rooms: host a 6-char room / join by code / accept the
   challenger / synchronized start. State + handlers live in use-play-along
   (see pvp-online.ts for the transport). ── */
function OnlinePvpPanel({ pvpOnline, openPvpOnline, closePvpOnline, hostPvpOnline, joinPvpOnline, acceptPvpOnline, startPvpTogether, rematchPvpOnline, songMeta, lang, codeInput, setCodeInput }) {
  const T = T3(lang);
  const p = pvpOnline;
  const copyLink = () => {
    try { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?pvp=${p.code}`); } catch (e) {}
  };
  if (!p) return (
    <button className="songbtn ghost" style={{ width: "100%", marginTop: 8 }} onClick={openPvpOnline}>
      ⚔ {T("ดวลออนไลน์กับเพื่อน", "Online duel with a friend", "与好友在线对决")}
    </button>
  );
  return (
    <div className="pl-pvp">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>⚔ {T("ดวลออนไลน์", "Online Duel", "在线对决")}</b>
        <button className="cbtn" onClick={closePvpOnline}>×</button>
      </div>
      {p.err && <div style={{ color: "#ff6b8a", fontSize: 13, marginTop: 6 }}>{p.err === "opponent-left" ? T("ฝ่ายตรงข้ามออกจากห้อง", "Opponent left", "对方已离开") : p.err === "declined" ? T("ถูกปฏิเสธ", "Declined", "被拒绝") : p.err}</div>}
      {p.phase === "idle" && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="songbtn go" style={{ flex: 1 }} onClick={hostPvpOnline}>{T("สร้างห้อง", "Host room", "创建房间")}</button>
          <div style={{ flex: 1, display: "flex", gap: 4 }}>
            <input className="pl-code" value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 6))} placeholder={T("รหัสห้อง", "ROOM CODE", "房间码")} />
            <button className="songbtn go" onClick={() => joinPvpOnline(codeInput)}>{T("เข้า", "Join", "加入")}</button>
          </div>
        </div>
      )}
      {p.phase === "hosting" && <div className="pl-muted">{T("กำลังสร้างห้อง...", "Creating room...", "正在创建...")}</div>}
      {p.phase === "joining" && <div className="pl-muted">{T("กำลังเข้าห้อง...", "Joining...", "正在加入...")}</div>}
      {p.phase === "waiting" && p.role === "host" && (
        <div style={{ marginTop: 8 }}>
          <div className="pl-muted">{T("รหัสห้อง — ส่งให้เพื่อน", "Room code — share it", "房间码 — 发给好友")}</div>
          <div className="pl-roomcode">{p.code}</div>
          <button className="songbtn ghost" style={{ width: "100%" }} onClick={copyLink}>🔗 {T("คัดลอกลิงก์เชิญ", "Copy invite link", "复制邀请链接")}</button>
          {p.guestName ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 6 }}>🤝 {p.guestName} {T("ต้องการดวลด้วย — เพลง:", "wants to duel — song:", "请求对决 — 曲目：")} <b>{tr(songMeta, lang)}</b></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="songbtn go" style={{ flex: 1 }} onClick={() => acceptPvpOnline(true)}>✓ {T("รับ", "Accept", "接受")}</button>
                <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => acceptPvpOnline(false)}>✕ {T("ปฏิเสธ", "Decline", "拒绝")}</button>
              </div>
            </div>
          ) : <div className="pl-muted">{T("รอผู้ท้าชิง...", "Waiting for a challenger...", "等待挑战者...")}</div>}
          {p.accepted && <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} onClick={startPvpTogether}>⚔ {T("เริ่มดวล", "Start the duel", "开始对决")}</button>}
        </div>
      )}
      {p.phase === "waiting" && p.role === "guest" && (
        <div className="pl-muted">
          {p.accepted ? T("รับแล้ว — รอหัวห้องเริ่ม...", "Accepted — waiting for host to start...", "已接受 — 等待房主开始...") : T("ส่งคำขอแล้ว รอตอบรับ...", "Request sent, waiting...", "请求已发送...")}
        </div>
      )}
      {p.phase === "racing" && (() => {
        const waitMs = Math.max(0, (p.startAt || 0) - Date.now());
        return (
          <div style={{ marginTop: 8, textAlign: "center" }}>
            {waitMs > 300 ? <b style={{ fontSize: 20 }}>⚔ {T("เริ่มใน", "Starting in", "即将开始")} {Math.ceil(waitMs / 1000)}s</b> : <b style={{ fontSize: 16 }}>⚔ {T("สู้ ๆ!", "Go!", "加油！")}</b>}
          </div>
        );
      })()}
      {p.phase === "waiting-result" && <div className="pl-muted" style={{ textAlign: "center" }}>{T("ส่งผลแล้ว — รอฝ่ายตรงข้ามจบ", "Result sent — waiting for opponent", "已发送 — 等待对方")}</div>}
    </div>
  );
}

/* ── the playing screen, piece by piece ── */
const PaHud = memo(function PaHud({ store, lang, pvpOnline, onStopDrill, practice = false }) {
  const hud = useGameField(store, "songHud");
  const ghost = useGameField(store, "songGhost");
  const setlist = useGameField(store, "songSetlistPos");
  const drill = useGameField(store, "drillHud");
  const lc = L[lang];
  const T = T3(lang);
  if (practice) return (
    <>
      <div className="songhud pl-practicehud">
        <span>🐢 {T("โหมดฝึก — เพลงรอจนกดถูก", "Practice — the song waits for you", "练习——歌曲等你弹对")}</span>
      </div>
      <div className="songprog"><div style={{ width: hud.progress + "%" }} /></div>
    </>
  );
  if (drill) return (
    <>
      <div className="songhud pl-drillhud">
        <span>🎯 {T("ท่อน", "Part", "片段")} <b>{drill.idx + 1}</b></span>
        <span>{T("เท็มโป", "Tempo", "速度")} <b className="pl-num">{Math.round(drill.rung * 100)}%</b></span>
        <span>{T("รอบ", "Pass", "第")} <b className="pl-num">{drill.pass}</b></span>
        <span>{lc.practiceAcc} <b className="pl-num">{hud.acc}%</b><small> / {drill.need}%</small></span>
        <button className="pl-drillstop" onClick={onStopDrill} aria-label={T("หยุดซ้อม", "Stop practising", "停止练习")}>⏹</button>
      </div>
      <div className="songprog"><div style={{ width: hud.progress + "%" }} /></div>
    </>
  );
  return (
    <>
      <div className="songhud">
        <span>{lc.songScore} <b className="pl-num">{hud.score}</b></span>
        <span className={`combostat${hud.combo >= 30 ? " t4" : hud.combo >= 20 ? " t3" : hud.combo >= 10 ? " t2" : hud.combo >= 5 ? " t1" : ""}`}>
          {lc.songCombo} <b className="pl-num">{hud.combo}×</b>
        </span>
        <span>{lc.practiceAcc} <b className="pl-num">{hud.acc}%</b></span>
        {ghost && <span className={`ghoststat ${ghost.diff >= 0 ? "ahead" : "behind"}`}>👻 {ghost.diff >= 0 ? "▲" : "▼"}{Math.abs(ghost.diff)}</span>}
        {pvpOnline && pvpOnline.phase === "racing" && pvpOnline.opp && <span className="pvplive">⚔ {pvpOnline.opp.score}</span>}
        {setlist && <span className="setlistpos">🎤 {setlist.idx + 1}/{setlist.total}</span>}
      </div>
      <div className="songprog"><div style={{ width: hud.progress + "%" }} /></div>
    </>
  );
});
const PaStaff = memo(function PaStaff({ store, songMeta, handMode, sheet = false }) {
  const win = useGameField(store, "songStaffNotes");
  return (
    <div className={`songstaffwrap${handMode === "both" ? " grand" : ""}`}>
      <PlayAlongStaff notes={win.list} startBeat={win.startBeat} spanBeats={win.spanBeats} margin={win.margin || 0} liveClock={store.staffClock || null} songMeta={songMeta} handMode={handMode} trim={sheet ? 16 : 0} />
    </div>
  );
});
const PaBoss = memo(function PaBoss({ store, bossMax, lang }) {
  const hp = useGameField(store, "bossHp");
  const fx = useGameField(store, "bossFx");
  const verdict = useGameField(store, "bossVerdict");   // plan 2.4: the engine's verdict shown the moment the boss falls
  const T = T3(lang);
  const maxHp = bossMax > 0 ? bossMax : Math.max(1, hp || 1);
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const face = hp <= 0 ? "😵" : fx && fx.kind === "attack" ? "😡" : "👾";
  /* The bar stays mounted: it used to be re-keyed on every hit to restart
     its animations, which rebuilt the whole bar each note. Now only the face
     and the spark are keyed, each with a prefix of its own (one shared key
     made React keep every old face and pile them up across the bar), the
     shake alternates between two copies of its keyframes (so back-to-back
     attacks each restart it), and the fill slides with a transform, which
     never needs a layout. */
  return (
    <>
    <div className={"bosshud" + (fx ? " fx-" + fx.kind + (fx.id % 2 ? " b" : "") : "")} aria-label={T("เลือดบอส", "Boss HP", "首领血量")}>
      <span className="bosshud-face" key={fx ? "f" + fx.id : "idle"}>{face}</span>
      <div className="bosshud-track"><div className={"bosshud-fill" + (pct < 30 ? " low" : "")} style={{ transform: `translateX(${pct - 100}%)` }} /></div>
      <span className="bosshud-pct pl-num">{Math.round(pct)}%</span>
      {fx && fx.kind === "hit" && <span className="bosshud-spark" key={"s" + fx.id} />}
      {hp <= 0 && <span className="bosshud-down">{T("ชนะบอส!", "Boss down!", "击败首领！")}</span>}
      </div>
      {/* plan 2.4: the engine's verdict when the boss falls — real run numbers, 3 languages; hides honestly when no engine answered */}
      {hp <= 0 && verdict && <div className="tigatipbar song" key={verdict.id}>
        <span className="tigatipbadge">🧠 TIGA</span>
        <span>{verdict.text[lang === "th" ? "th" : lang === "zh" ? "zh" : "en"] || verdict.text.en}</span>
      </div>}
    </>
  );
});
const PaBanners = memo(function PaBanners({ store, lang }) {
  const countdown = useGameField(store, "songCountdown");
  const go = useGameField(store, "songGo");
  const fever = useGameField(store, "songFever");
  const bonus = useGameField(store, "songBonus");
  const announce = useGameField(store, "songAnnounce");
  const kDrop = useGameField(store, "kDrop");
  const recap = useGameField(store, "songLoopRecap");
  const lc = L[lang];
  return (
    <>
      {countdown != null && <div className="songcount" key={countdown}>{countdown}</div>}
      {go && <div className="songgo">GO!</div>}
      {fever && <div className="feverbadge">FEVER ×2</div>}
      {bonus && <div className="songbonus" key={bonus.id}>{lc.dhBonus} {bonus.text}</div>}
      {announce && <div className="songannounce" key={announce.id}>{announce.text}</div>}
      {kDrop && <div className="kdrop" key={kDrop.id}>
        <span className="kdrop-badge">💡</span>
        <span className="kdrop-text">{kDrop.text}</span>
      </div>}
      {/* Between-run recap — auto-loop and Setlist mode both skip the full
          result screen and restart within ~2s. */}
      {recap && (
        <div className="looprecap">
          <div className="looprecap-stars">{starRow(recap.stars)}</div>
          <div className="looprecap-row"><b>{recap.acc}%</b> · 🔥{recap.maxCombo} · +{recap.exp} EXP</div>
          {recap.nextSong && <div className="looprecap-next">{lc.songNextUp} {recap.nextSong}</div>}
        </div>
      )}
    </>
  );
});
/* The stage frame: shakes and glows with the store's shake/fever flags. */
const PaStageFrame = memo(function PaStageFrame({ store, children }) {
  const shake = useGameField(store, "songShake");
  const fever = useGameField(store, "songFever");
  return <div className={`songstage${shake ? " shake" : ""}${fever ? " fever" : ""}`}>{fever && <div className="feverbg" />}{children}</div>;
});
const PaPiano = memo(function PaPiano({ store, handMode, onNote }) {
  const lit1 = useGameField(store, "songNextLit");
  const lit2 = useGameField(store, "songNextLit2");
  const fm = useGameField(store, "songFingerMap");
  const litSet = useMemo(() => [lit1, lit2].filter(Boolean), [lit1, lit2]);
  // each lit key glows in its lane's colour, the colour of the gem falling to it
  const litColors = useMemo(() => { const m = {}; for (const n of litSet) m[n] = `hsl(${Math.round(laneHue(n))},100%,62%)`; return m; }, [litSet]);
  return (
    <GamePiano fullWidth litSet={litSet} fingerMap={fm} litColors={litColors}
      baseOct={handMode === "left" ? 2 : handMode === "both" ? 3 : 4}
      octs={handMode === "both" ? 4 : 2}
      onNote={onNote} />
  );
});
const PaSrc = memo(function PaSrc({ store, lang, intro }) {
  const src = useGameField(store, "songSrc");
  const heard = useGameField(store, "songHeardMic");
  const lc = L[lang];
  const T = T3(lang);
  return (
    <div className="songsrcbar">
      {!src ? "…" : src.type === "midi" ? lc.practiceMidi : src.type === "mic" ? (intro && heard ? T("🎤 ได้ยินเสียงเปียโนแล้ว ✓", "🎤 Heard your piano ✓", "🎤 听到你的琴声了 ✓") : lc.practiceMic) : lc.practiceMicErr}
    </div>
  );
});
/* What plays with the song: the backing track (the band) or a metronome —
   two buttons, both always in view. It sits in the header, top right (owner,
   2026-09-30), and in the pause card. In the header the words are small under
   the icons so it stays a compact pair on a phone; elsewhere they are written
   out. */
const AccompMode = memo(function AccompMode({ lang, mode, setMode, bandOn = true, variant = "hdr" }) {
  const T = T3(lang);
  if (!setMode) return null;
  const opts = [
    { id: "track", icon: "🎼", short: T("เพลงประกอบ", "Backing", "伴奏"), full: T("เพลงประกอบ (Backing Track)", "Backing track", "伴奏音轨") },
    { id: "metro", icon: "⏱", short: T("เมโทรนอม", "Metronome", "节拍器"), full: T("เมโทรนอม", "Metronome", "节拍器") },
  ];
  return (
    <div className={`pl-mode pl-mode--${variant}`} role="group" aria-label={T("เสียงที่เล่นประกอบเพลง", "What plays with the song", "伴奏方式")}>
      {opts.map(o => (
        <button key={o.id} className={`${mode === o.id ? "on" : ""}${o.id === "track" && mode === "track" && !bandOn ? " quiet" : ""}`} aria-pressed={mode === o.id} aria-label={o.full} title={o.full} onClick={() => setMode(o.id)}>
          <span className="pl-mode-i">{o.icon}</span>
          <span className="pl-mode-t">{variant === "hdr" ? o.short : o.full}</span>
        </button>
      ))}
    </div>
  );
});
/* How the song is shown (owner, 2026-09-30): gems falling to the keys, or the sheet alone — no falling notes, the staff big and
   sitting on the keys, no key lit to point the way — for a player who reads and plays without them. Beside the accompaniment
   pair in the header, top right, and in the pause card; same compact look, icons over small words in the header. */
const ViewMode = memo(function ViewMode({ lang, mode, setMode, variant = "hdr" }) {
  const T = T3(lang);
  if (!setMode) return null;
  const opts = [
    { id: "fall", icon: "🌠", short: T("โน้ตตก", "Falling", "下落"), full: T("โน้ตตก (มีโน้ตตกลงมา)", "Falling notes", "下落音符") },
    { id: "sheet", icon: "📖", short: T("โน้ตเพลง", "Sheet", "乐谱"), full: T("โน้ตเพลง (ไม่มีโน้ตตก)", "Sheet music, no falling notes", "乐谱模式（没有下落音符）") },
  ];
  return (
    <div className={`pl-view pl-view--${variant}`} role="group" aria-label={T("รูปแบบการเล่น", "How the song is shown", "显示方式")}>
      {opts.map(o => (
        <button key={o.id} className={mode === o.id ? "on" : ""} aria-pressed={mode === o.id} aria-label={o.full} title={o.full} onClick={() => setMode(o.id)}>
          <span className="pl-mode-i">{o.icon}</span>
          <span className="pl-mode-t">{variant === "hdr" ? o.short : o.full}</span>
        </button>
      ))}
    </div>
  );
});
const PaPause = memo(function PaPause({ store, lang, onResume, onRestart, onExit, sfxMuted, onToggleSfx, band = 2, setBand = null, accomp = "track", setAccomp = null, view = "fall", setView = null, fxOn = true, setFx = null, gfx = "auto", setGfx = null }) {
  const p = useGameField(store, "songPause");
  const T = T3(lang);
  if (!p) return null;
  if (p.n > 0) return <div className="pl-pause count"><div className="pl-pause-n" key={p.n}>{p.n}</div></div>;
  return (
    <div className="pl-pause" role="dialog" aria-label={T("หยุดชั่วคราว", "Paused", "已暂停")}>
      <div className="pl-pause-card">
        <div className="pl-pause-t">{T("หยุดชั่วคราว", "Paused", "已暂停")}</div>
        <button className="songbtn go" onClick={onResume}>▶ {T("เล่นต่อ", "Resume", "继续")}</button>
        <div className="pl-pause-row">
          <button className="songbtn ghost" onClick={onRestart}>↻ {T("เริ่มใหม่", "Restart", "重新开始")}</button>
          <button className="songbtn ghost" onClick={onExit}>✕ {T("ออก", "Quit", "退出")}</button>
        </div>
        {setAccomp && <AccompMode lang={lang} mode={accomp} setMode={setAccomp} bandOn={band > 0} variant="pause" />}
        {setView && <ViewMode lang={lang} mode={view} setMode={setView} variant="pause" />}
        {setBand && accomp === "track" && (
          <div className="pl-seg" role="group" aria-label={T("ความดังเพลงประกอบ", "Backing track volume", "伴奏音量")}>
            <span className="pl-seg-lbl">🔉 {T("ความดัง", "Volume", "音量")}</span>
            {[0, 1, 2].map(v => (
              <button key={v} className={band === v ? "on" : ""} aria-pressed={band === v} onClick={() => setBand(v)}>
                {v === 0 ? T("ปิด", "Off", "关") : v === 1 ? T("เบา", "Soft", "轻") : T("ปกติ", "Normal", "正常")}
              </button>
            ))}
          </div>
        )}
        {setGfx && (
          <div className="pl-seg" role="group" aria-label={T("ความสวยของภาพ", "Graphics", "画面")}>
            <span className="pl-seg-lbl">✦ {T("ภาพ", "Graphics", "画面")}</span>
            {["auto", "high", "mid", "low"].map(v => (
              <button key={v} className={gfx === v ? "on" : ""} aria-pressed={gfx === v} onClick={() => setGfx(v)}>
                {v === "auto" ? T("อัตโนมัติ", "Auto", "自动") : v === "high" ? T("สูง", "High", "高") : v === "mid" ? T("กลาง", "Medium", "中") : T("เบา", "Low", "低")}
              </button>
            ))}
          </div>
        )}
        {setFx && (
          <button className={`pl-toggle${fxOn ? " on" : ""}`} onClick={() => setFx(v => !v)}>
            ✨ {T("เสียงเอฟเฟกต์", "Effect sounds", "音效")} · {fxOn ? T("เปิด", "on", "开") : T("ปิด", "off", "关")}
          </button>
        )}
        {onToggleSfx && (
          <button className={`pl-toggle${!sfxMuted ? " on" : ""}`} onClick={onToggleSfx}>
            {!sfxMuted ? "🔊" : "🔇"} {T("เสียงทั้งหมด", "All sound", "所有声音")} · {!sfxMuted ? T("เปิด", "on", "开") : T("ปิด", "off", "关")}
          </button>
        )}
      </div>
    </div>
  );
});
/* The song's cover, drawn from its own melody: every note a point at its
   time (left→right) and pitch (low→high), joined into one line in the lanes'
   colours. It sits on the ready screen, which wears the app's own theme, so it
   is drawn on the theme's card colours — a light card in light mode, a
   near-black one in dark mode — not on the neon night sky. Drawn once per
   song, size and mode, then kept as a picture. */
const COVER_CACHE = new Map();
function drawCover(song, w, h, dpr) {
  const dark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  const key = song.id + "|" + w + "|" + h + "|" + dpr + "|" + (dark ? "d" : "l");
  if (COVER_CACHE.has(key)) return COVER_CACHE.get(key);
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ground = c.createLinearGradient(0, 0, 0, h);
  if (dark) { ground.addColorStop(0, "#211f1c"); ground.addColorStop(1, "#141312"); }
  else { ground.addColorStop(0, "#ffffff"); ground.addColorStop(1, "#f1efe7"); }
  c.fillStyle = ground; c.fillRect(0, 0, w, h);
  // faint staff-like guide lines
  c.strokeStyle = dark ? "rgba(255,255,255,0.07)" : "rgba(20,20,19,0.08)"; c.lineWidth = 1;
  for (let k = 1; k <= 4; k++) { const y = Math.round(h * (0.2 + 0.15 * k)) + 0.5; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  const seq = (song.seq || []);
  const pts = [];
  let beat = 0;
  for (const [note, dur] of seq) { if (note !== "R") pts.push({ note, beat, dur }); beat += dur; }
  const midi = (n) => { const m = /^([A-G]#?)(\d)$/.exec(n); if (!m) return 60; return (+m[2] + 1) * 12 + ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(m[1]); };
  if (pts.length) {
    const lo = Math.min(...pts.map(p => midi(p.note))), hi = Math.max(...pts.map(p => midi(p.note)));
    const span = Math.max(4, hi - lo), total = Math.max(1, beat);
    const xy = pts.map(p => ({ x: 14 + (p.beat + p.dur / 2) / total * (w - 28), y: h * 0.8 - (midi(p.note) - lo) / span * h * 0.6, hue: laneHue(p.note), d: p.dur }));
    // light: solid saturated strokes on the light card; dark: the same light-on-dark glow as the game
    c.globalCompositeOperation = dark ? "lighter" : "source-over";
    c.lineJoin = "round"; c.lineCap = "round";
    const widths = dark ? [[7, 0.12], [3, 0.35], [1.4, 0.9]] : [[6, 0.1], [2.6, 0.28], [1.6, 0.95]];
    for (const [lw, a] of widths) {
      c.lineWidth = lw;
      for (let i = 1; i < xy.length; i++) {
        c.strokeStyle = dark ? `hsla(${xy[i].hue},100%,66%,${a})` : `hsla(${xy[i].hue},78%,44%,${a})`;
        c.beginPath(); c.moveTo(xy[i - 1].x, xy[i - 1].y); c.lineTo(xy[i].x, xy[i].y); c.stroke();
      }
    }
    for (const p of xy) {
      const r = 2 + Math.min(3.5, p.d * 1.4);
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      if (dark) { g.addColorStop(0, `hsla(${p.hue},100%,80%,0.95)`); g.addColorStop(0.35, `hsla(${p.hue},100%,62%,0.4)`); g.addColorStop(1, "rgba(0,0,0,0)"); }
      else { g.addColorStop(0, `hsla(${p.hue},80%,50%,0.34)`); g.addColorStop(1, `hsla(${p.hue},80%,50%,0)`); }
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * 3, 0, 7); c.fill();
      if (!dark) { c.fillStyle = `hsl(${p.hue},78%,44%)`; c.beginPath(); c.arc(p.x, p.y, r * 0.7, 0, 7); c.fill(); }
    }
    c.globalCompositeOperation = "source-over";
  }
  const url = cv.toDataURL("image/png");
  if (COVER_CACHE.size > 40) COVER_CACHE.clear();
  COVER_CACHE.set(key, url);
  return url;
}
const PaCover = memo(function PaCover({ song }) {
  const ref = useRef(null);
  const [src, setSrc] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !song) return;
    const w = Math.max(200, Math.min(420, Math.round(el.clientWidth || 320))), h = Math.round(w * 0.26);
    // after the ready screen has painted — the cover is never in the way of the first frame
    const id = requestAnimationFrame(() => { try { setSrc(drawCover(song, w, h, Math.min(2, window.devicePixelRatio || 1))); } catch (e) {} });
    return () => cancelAnimationFrame(id);
  }, [song && song.id]);
  return <div className="pl-cover" ref={ref} aria-hidden="true">{src && <img src={src} alt="" />}</div>;
});
/* The four medals of a song as a row: the earned ones lit, the new ones
   popping in one after another. */
function MedalRow({ tier = 0, gained = [], lang }) {
  const T = T3(lang);
  return (
    <div className="pl-medalrow" role="img" aria-label={T(`เหรียญตรา: ${MEDAL_NAME.th[tier] || "ยังไม่มี"}`, `Medal: ${MEDAL_NAME.en[tier] || "none yet"}`, `奖牌：${MEDAL_NAME.zh[tier] || "暂无"}`)}>
      {[1, 2, 3, 4].map(t => (
        <span key={t} className={"pl-medalslot" + (t <= tier ? " on" : "") + (gained.includes(t) ? " new" : "")} style={gained.includes(t) ? { animationDelay: (0.9 + gained.indexOf(t) * 0.35) + "s" } : undefined}>
          <i className={"pl-medal m" + t} />
          <small>{(MEDAL_NAME[lang] || MEDAL_NAME.en)[t]}</small>
        </span>
      ))}
    </div>
  );
}
export const MEDAL_NAME = {
  th: ["", "ทองแดง", "เงิน", "ทอง", "มงกุฎ"],
  en: ["", "Bronze", "Silver", "Gold", "Crown"],
  zh: ["", "铜", "银", "金", "皇冠"],
};
const PaSetlistBadge = memo(function PaSetlistBadge({ store, lang }) {
  const setlist = useGameField(store, "songSetlistPos");
  const lc = L[lang];
  if (!setlist) return null;
  return <div className="setlistpos ready">🎤 {lc.setlistSong} {setlist.idx + 1}/{setlist.total}</div>;
});

export function SongPlayOverlay({ gameStore, pvpOnline, openPvpOnline, closePvpOnline, hostPvpOnline, joinPvpOnline, acceptPvpOnline, startPvpTogether, rematchPvpOnline, codeInput, setCodeInput, songMeta, lang, songPhase, songResult, songCanvasRef, songDataRef, songTempo, setSongTempo, songAutoLoop, setSongAutoLoop, songInputRef, songAnalysisBusy, songAnalysis, requestSongAnalysis, stylePickOpen, setStylePickOpen, styleLoading, profile, exitSong, startSongPlay, previewSong, shareCard, shareLine, styleTransform, songTigaTip = null, playAlongHand, changePlayAlongHand, drillPlan, drillActive, drillCleared = [], startDrill, endDrill, bossOn, bossMax, kShelfOpen, setKShelfOpen, kShelf, openKnowledgeShelf, pauseSong, resumeSong, restartSong, playAgain, playNext, nextSongFor, songKind, setSongKind, songAccomp = "track", setSongAccomp, songView = "fall", setSongView, songBand = 2, setSongBand, songFx = true, setSongFx, songPractice = false, songGfx = "auto", setSongGfx, songIntro, startIntro, skipIntro, sfxMuted, onToggleSfx }) {
  const lc = L[lang];
  const T = T3(lang);
  const store = gameStore;
  const [moreOpen, setMoreOpen] = useState(false);
  const kShelfCount = Array.isArray(kShelf) ? kShelf.length : 0;
  // Landscape orientation hint — a one-time lesson, never a recurring nag.
  const ORIENT_SEEN_KEY = "tg_orient_hint_seen";
  const [orientSkipped, setOrientSkipped] = useState(() => {
    try { return localStorage.getItem(ORIENT_SEEN_KEY) === "1"; } catch (e) { return false; }
  });
  function dismissOrientHint() {
    setOrientSkipped(true);
    try { localStorage.setItem(ORIENT_SEEN_KEY, "1"); } catch (e) {}
  }
  useEffect(() => {
    if (orientSkipped || songPhase !== "playing") return;
    try { localStorage.setItem(ORIENT_SEEN_KEY, "1"); } catch (e) {}
  }, [orientSkipped, songPhase]);
  const [isPortrait, setIsPortrait] = useState(() => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(orientation: portrait)").matches && window.innerHeight > window.innerWidth);
  useEffect(() => {
    if (orientSkipped) return;
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e) => setIsPortrait(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [orientSkipped]);
  useEffect(() => { if (songPhase === "done") setMoreOpen(false); }, [songPhase, songResult]);
  const showOrientPrompt = isPortrait && !orientSkipped && songPhase === "playing" && !songMeta.intro && typeof window !== "undefined" && window.innerWidth < 600;
  const racing = !!(pvpOnline && pvpOnline.phase === "racing");
  const intro = !!songMeta.intro;

  // what this player has earned on this song (current scoring rules)
  const sid = songMeta.id;
  const earned = songMeta.custom ? 0 : songStars(sid);
  const bestAcc = songMeta.custom ? 0 : songBestAcc(sid);
  const lenSec = songLengthSec(songMeta);
  const daily = readDailyState();
  const isDaily = daily.id === sid;
  const goal = nextStarGoal(bestAcc);
  const goalText = bestAcc <= 0
    ? T("เป้ารอบนี้: แม่น 50% ได้ 1 ดาว", "Goal: 50% accuracy for your first star", "目标：准确率 50% 得第一颗星")
    : goal ? T(`เป้ารอบนี้: แม่นอีก ${goal.more}% ได้ ${goal.stars} ดาว`, `Goal: ${goal.more}% more accuracy for ${goal.stars} star${goal.stars > 1 ? "s" : ""}`, `目标：准确率再提高 ${goal.more}% 得 ${goal.stars} 星`)
    : T("ได้ 3 ดาวแล้ว — ลองไม่พลาดเลยสักโน้ต", "3 stars already — try it without a single miss", "已得 3 星 — 试试一个都不错");

  // the sheet view (the first-song intro teaches the falling gems, so it is always shown falling)
  const sheetView = songView === "sheet" && !intro;
  const worstSeg = Array.isArray(drillPlan) && drillPlan.length ? drillPlan.slice().sort((a, b) => b.misses - a.misses || a.start - b.start)[0] : null;
  const nextSong = songPhase === "done" && nextSongFor ? nextSongFor(songMeta) : null;

  return (
    // The neon world (.playal) is the game itself. While a song waits to start
    // the screen wears the app's own theme instead — white in light mode, dark
    // in dark mode (owner, 2026-09-30) — and the neon starts with the song.
    <div className={"songov " + (songPhase === "ready" ? "pl-themed" : "playal") + (sheetView ? " pl-sheet" : "")}>
      <div className="songhdr">
        <div className="songhtitle">{tr(songMeta, lang)}</div>
        <div className="pl-hdr-btns">
          <ViewMode lang={lang} mode={songView} setMode={setSongView} variant="hdr" />
          <AccompMode lang={lang} mode={songAccomp} setMode={setSongAccomp} bandOn={songBand > 0} variant="hdr" />
          {songPhase === "playing" && !racing && pauseSong && (
            <button className="pl-pausebtn" onClick={pauseSong} aria-label={T("หยุดชั่วคราว", "Pause", "暂停")}>⏸</button>
          )}
          <button className="cbtn" onClick={exitSong} aria-label={lc.close}>{songPhase === "playing" ? "✕" : lc.close}</button>
        </div>
      </div>

      {songPhase === "playing" && (
        <>
          <PaHud store={store} lang={lang} pvpOnline={pvpOnline} onStopDrill={endDrill} practice={songPractice} />
          <PaStaff store={store} songMeta={songMeta} handMode={playAlongHand} sheet={sheetView} />
        </>
      )}

      {songPhase !== "done" && (
        <PaStageFrame store={store}>
          <canvas ref={songCanvasRef} className="songcanvas" />
          <PaBanners store={store} lang={lang} />
          {bossOn && songPhase === "playing" && <PaBoss store={store} bossMax={bossMax} lang={lang} />}
          {songPhase === "playing" && intro && (
            <div className="pl-intro-hint">{T("กดคีย์ที่เรืองแสง ตอนเพชรถึงเส้น ↓", "Press the glowing key when the gem reaches the line ↓", "宝石到线时按发光的键 ↓")}</div>
          )}
          {songPhase === "ready" && (
            <div className="songready pl-ready">
              {songIntro && !songIntro.playing ? (
                <>
                  <PaSetlistBadge store={store} lang={lang} />
                  <div className="pl-introcard">
                    <div className="pl-title">{T("ครั้งแรกใน Play Along?", "First time in Play Along?", "第一次玩 Play Along？")}</div>
                    <div className="pl-sub">{T("ลองก่อน 8 โน้ต แล้วค่อยเล่นเพลงจริง: กดคีย์ที่เรืองแสงตอนเพชรตกถึงเส้น", "Try 8 notes first: press the glowing key as the gem reaches the line", "先试 8 个音：宝石落到线时按发光的键")}</div>
                    <button className="songbtn go pl-start" onClick={startIntro}>▶ {T("ลอง 8 โน้ต", "Try 8 notes", "试 8 个音")}</button>
                    <button className="pl-link" onClick={skipIntro}>{T("ข้าม ไปเพลงเลย", "Skip — go to the song", "跳过，直接开始")}</button>
                  </div>
                </>
              ) : (
                <>
                  {/* This run's settings: always open, the first thing on the
                      screen. Behind a "Settings" link most players never learned
                      that speed, hands and kind mode can be changed (owner,
                      2026-09-30). */}
                  <div className="pl-settings" role="group" aria-label={T("ตั้งค่ารอบนี้", "Settings for this run", "本轮设置")}>
                    <div className="pl-set-line">
                      <span className="pl-set-lbl">{T("ความเร็ว", "Speed", "速度")}</span>
                      <div className="songtempo">
                        {[0.5, 0.75, 1, 1.25].map(tp => (
                          <button key={tp} className={`songtempobtn${songTempo === tp ? " on" : ""}`} onClick={() => setSongTempo(tp)} title={tp === 0.5 ? lc.songSlowHint : undefined}>
                            {tp === 1 ? "1×" : tp + "×"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pl-set-line">
                      <span className="pl-set-lbl">{T("มือที่ฝึก", "Hands", "练习的手")}</span>
                      <div className="songhands">
                        {["right", "left", "both"].map(h => (
                          <button key={h} className={`songhandbtn${playAlongHand === h ? " on" : ""}`} onClick={() => changePlayAlongHand(h)}>
                            {h === "right" ? T("มือขวา", "Right", "右手") : h === "left" ? T("มือซ้าย", "Left", "左手") : T("สองมือ", "Both", "双手")}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pl-set-row">
                      <button className={`pl-toggle${songKind ? " on" : ""}`} onClick={() => setSongKind && setSongKind(!songKind)} aria-pressed={!!songKind}>
                        🌱 {T("โหมดใจดี", "Kind mode", "宽松模式")} · {songKind ? T("เปิด", "on", "开") : T("ปิด", "off", "关")}
                      </button>
                      <button className={`pl-toggle${songAutoLoop ? " on" : ""}`} onClick={() => setSongAutoLoop(v => !v)} aria-pressed={!!songAutoLoop}>
                        🔁 {T("เล่นวน", "Loop", "循环")} · {songAutoLoop ? T("เปิด", "on", "开") : T("ปิด", "off", "关")}
                      </button>
                    </div>
                    <div className="pl-set-hint">{T("โหมดใจดี: ช่วงรับโน้ตกว้างขึ้น และกดผิดคีย์เดียวแค่คอมโบหลุด ไม่เสียความแม่น", "Kind mode: a wider window, and one wrong key only breaks the combo", "宽松模式：判定更宽，按错一个键只断连击")}</div>
                    <OnlinePvpPanel pvpOnline={pvpOnline} openPvpOnline={openPvpOnline} closePvpOnline={closePvpOnline} hostPvpOnline={hostPvpOnline} joinPvpOnline={joinPvpOnline} acceptPvpOnline={acceptPvpOnline} startPvpTogether={startPvpTogether} rematchPvpOnline={rematchPvpOnline} songMeta={songMeta} lang={lang} codeInput={codeInput} setCodeInput={setCodeInput} />
                  </div>
                  <PaSetlistBadge store={store} lang={lang} />
                  <PaCover song={songMeta} />
                  <div className="pl-title">{tr(songMeta, lang)}</div>
                  <div className="pl-meta">
                    {!songMeta.custom && <span className="pl-stars" aria-label={T(`ได้ ${earned} ดาว`, `${earned} stars earned`, `已得 ${earned} 星`)}>{starRow(earned)}</span>}
                    {!songMeta.custom && <span>{T("ระดับ", "Level", "难度")} {songMeta.diff}</span>}
                    {lenSec > 0 && <span>⏱ {fmtTime(lenSec)}</span>}
                    {bestAcc > 0 && <span>{T("ดีที่สุด", "Best", "最佳")} {bestAcc}%</span>}
                  </div>
                  {!songMeta.custom && <div className="pl-goal">{goalText}</div>}
                  {isDaily && !daily.done && <div className="pl-daily">📆 {T(`เพลงประจำวัน · ได้ 1 ดาวขึ้นไปรับ ${DAILY_SONG_REWARD.coins} 🪙 + ${DAILY_SONG_REWARD.exp} EXP`, `Today's song · 1 star or more pays ${DAILY_SONG_REWARD.coins} 🪙 + ${DAILY_SONG_REWARD.exp} EXP`, `今日歌曲 · 得 1 星以上奖励 ${DAILY_SONG_REWARD.coins} 🪙 + ${DAILY_SONG_REWARD.exp} EXP`)}</div>}
                  {songKind && <div className="pl-kindnote">{T("โหมดใจดีเปิดอยู่ — ช่วงรับโน้ตกว้างขึ้น", "Kind mode is on — a wider timing window", "宽松模式已开启 — 判定更宽")}</div>}
                  {sheetView && <div className="pl-kindnote">📖 {T("โหมดโน้ตเพลง — ไม่มีโน้ตตก และไม่มีคีย์เรืองแสงบอกทาง อ่านโน้ตแล้วกดให้ตรงจังหวะ", "Sheet mode — no falling notes and no lit key: read the staff and play on the beat", "乐谱模式 — 没有下落音符，也没有亮键提示：看谱，踩准节拍")}</div>}
                  <div className="songsrc">{lc.songInputHint}</div>
                  {/* Start stays pinned to the bottom edge: the settings above it are
                      tall, and on a short phone the button must never scroll away. */}
                  <div className="pl-startbar">
                    <button className="songbtn go pl-start" onClick={() => startSongPlay()}>▶ {lc.songStart}</button>
                    <div className="pl-startrow">
                      {!racing && (
                        <button className="pl-link pl-practice-btn" onClick={() => startSongPlay(false, { practice: true })}>
                          🐢 {T("ฝึกก่อน (เพลงรอเรา)", "Practise first (song waits)", "先练习（歌曲等你）")}
                        </button>
                      )}
                      <button className="pl-link" onClick={previewSong}>♪ {lc.songPreview}</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </PaStageFrame>
      )}

      {songPhase === "playing" && (
        <>
          <PaPiano store={store} handMode={playAlongHand} onNote={(n) => songInputRef.current({ note: n, freq: null, source: "tap" })} />
          <PaSrc store={store} lang={lang} intro={intro} />
        </>
      )}

      {songPhase === "playing" && (
        <PaPause store={store} lang={lang} onResume={resumeSong} onRestart={restartSong} onExit={exitSong} sfxMuted={sfxMuted} onToggleSfx={onToggleSfx} band={songBand} setBand={setSongBand} accomp={songAccomp} setAccomp={setSongAccomp} view={songView} setView={setSongView} fxOn={songFx} setFx={setSongFx} gfx={songGfx} setGfx={setSongGfx} />
      )}
      {songPhase === "done" && songResult && songResult.practice && (
        <div className="songresult pl-result pl-practice-result">
          <div className="pl-res-top">
            <div className="pl-practice-done">🐢 {T("ฝึกจบทั้งเพลงแล้ว!", "You practised the whole song!", "整首歌练完了！")}</div>
            <div className="pl-res-pay"><span>+{songResult.exp} EXP</span></div>
            <div className="pl-practice-sub">{T("พร้อมลองรอบจริงไหม? รอบจริงโน้ตไม่รอ ได้ดาวและเหรียญตรา", "Ready for the real round? It won't wait — and it earns stars and medals", "准备好正式弹一遍了吗？正式一遍不会等你，能拿星星和奖牌")}</div>
          </div>
          <div className="pl-res-actions">
            <button className="songbtn go pl-again" onClick={() => startSongPlay()}>▶ {T("เล่นรอบจริง", "Play it for real", "正式弹一遍")}</button>
            <button className="songbtn ghost pl-next" onClick={() => startSongPlay(false, { practice: true })}>🐢 {T("ฝึกอีกรอบ", "Practise again", "再练一遍")}</button>
          </div>
          <button className="pl-link" onClick={exitSong}>↩ {T("เพลงอื่น", "Other songs", "其他歌曲")}</button>
        </div>
      )}
      {songPhase === "done" && songResult && !songResult.practice && (
        <div className="songresult pl-result">
          {/* Setlist finale — the whole concert's combined totals, each song's own stars. */}
          {songResult.setlist && (
            <div className="concertrecap">
              <div className="concertrecap-title">🎤 {lc.concertComplete}</div>
              <div className="concertrecap-songs">
                {Array.isArray(songResult.setlist) && songResult.setlist.map((s, i) => (
                  <span key={i} className="concertrecap-song">{tr(s.song, lang)} {starRow(s.stars)}</span>
                ))}
              </div>
            </div>
          )}
          <div className="pl-res-top">
            <div className="songstars pl-bigstars" aria-label={T(`${songResult.stars} ดาว`, `${songResult.stars} stars`, `${songResult.stars} 星`)}>
              {[0, 1, 2].map(i => <span key={i} className={i < songResult.stars ? "on" : ""} style={{ animationDelay: (0.15 + i * 0.28) + "s" }}>★</span>)}
            </div>
            <div className="pl-res-nums">
              <span className="pl-res-acc"><CountUp value={songResult.acc} dur={700} />%</span>
              <span className="pl-res-score">{lc.songScore} <b><CountUp value={songResult.score} /></b></span>
            </div>
            <div className="pl-res-tags">
              {songResult.allPerfect ? <span className="pl-tag gold">{lc.songAllPerfect}</span> : songResult.fullCombo ? <span className="pl-tag">{lc.songFullCombo}</span> : null}
              {songResult.newStars && <span className="pl-tag gold">{T("ดาวใหม่!", "New star!", "新星！")}</span>}
              {songResult.newBest && <span className="pl-tag">{lc.songNewBest}</span>}
              {songResult.bossWon && <span className="pl-tag">👾 {T("ชนะบอส", "Boss down", "击败首领")}</span>}
              {songResult.dailyPaid && <span className="pl-tag gold">📆 +{DAILY_SONG_REWARD.coins} 🪙</span>}
              {songResult.medalNew && songResult.medalNew.length > 0 && (
                <span className="pl-tag gold pl-medal-new">
                  <i className={"pl-medal m" + songResult.medal} aria-hidden="true" />
                  {T(`เหรียญ${MEDAL_NAME.th[songResult.medal]}ใหม่!`, `New ${MEDAL_NAME.en[songResult.medal]} medal!`, `新${MEDAL_NAME.zh[songResult.medal]}牌！`)} +{songResult.medalCoins} 🪙 +{songResult.medalExp} EXP
                </span>
              )}
            </div>
            {!songMeta.custom && <MedalRow tier={songResult.medal || 0} gained={songResult.medalNew || []} lang={lang} />}
            <div className="pl-res-pay">
              {songResult.coins > 0
                ? <span>+{songResult.coins} 🪙 · +{songResult.exp} EXP</span>
                : <span>+{songResult.exp} EXP</span>}
              {songResult.coinCapped && <span className="pl-res-cap">{T("เพลงนี้ได้เหรียญครบ 3 รอบของวันนี้แล้ว — EXP และเหรียญตรายังได้", "This song has paid coins 3 times today — EXP and medals still count", "这首歌今天已给过 3 次金币——经验和奖牌照常")}</span>}
            </div>
          </div>
          <div className="pl-res-actions">
            <button className="songbtn go pl-again" onClick={playAgain}>↻ {lc.songRetry}</button>
            {nextSong && <button className="songbtn ghost pl-next" onClick={playNext}>{T("เพลงถัดไป", "Next song", "下一首")} ▶</button>}
          </div>
          <div className="pl-coach">
            <div className="pl-coach-goal">
              {songResult.goal
                ? T(`แม่นอีก ${songResult.goal.more}% ได้ ${songResult.goal.stars} ดาว`, `${songResult.goal.more}% more accuracy for ${songResult.goal.stars} star${songResult.goal.stars > 1 ? "s" : ""}`, `准确率再提高 ${songResult.goal.more}% 得 ${songResult.goal.stars} 星`)
                : T("ได้ 3 ดาวเต็มแล้ว!", "All 3 stars!", "满 3 星！")}
            </div>
            {songTigaTip && songTigaTip.tip && (
              <div className="pl-tip"><span className="pl-tip-badge">TIGA</span> {songTigaTip.tip[lang === "th" ? "th" : lang === "zh" ? "zh" : "en"] || songTigaTip.tip.en}</div>
            )}
            {/* plan v3.4 6.3 — KB-grounded next-song advice (one step up + a real weak-spot tip) */}
            {songTigaTip && songTigaTip.nextSong && songTigaTip.nextSong.tip && (
              <div className="pl-tip"><span className="pl-tip-badge">TIGA</span> {songTigaTip.nextSong.tip[lang === "th" ? "th" : lang === "zh" ? "zh" : "en"] || songTigaTip.nextSong.tip.en}</div>
            )}
            {worstSeg && !drillCleared.includes(worstSeg.idx) && (
              <button className="pl-drillbtn" onClick={() => startDrill(worstSeg)}>
                🎯 {T("ซ้อมท่อนที่พลาด", "Practise the part you missed", "练习错的片段")} <span className="pl-num">{fmtTime(worstSeg.start)}–{fmtTime(worstSeg.end)}</span>
              </button>
            )}
          </div>
          <button className="pl-link pl-more-btn" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen}>
            {T("รายละเอียด แชร์ และท้าเพื่อน", "Details, share and challenge", "详情、分享与挑战")} {moreOpen ? "▴" : "▾"}
          </button>
          {moreOpen && (
            <div className="pl-more">
              <div className="songresult-grid">
                <div><span>{lc.songBest}</span><b>{songResult.best}</b></div>
                <div><span>{lc.songMaxCombo}</span><b>{songResult.maxCombo}×</b></div>
                <div><span>✓</span><b>{songResult.hits}/{songResult.total}</b></div>
                <div><span>EXP</span><b>+{songResult.exp}</b></div>
                <div><span>🪙</span><b>+{songResult.coins}</b></div>
                {songResult.grades && <div><span>{T("ผิดคีย์", "Wrong keys", "按错")}</span><b>{songResult.grades.wrong + songResult.grades.mash}</b></div>}
              </div>
              {songResult.grades && (
                <div className="pl-grades">
                  <span className="g-p">Perfect {songResult.grades.perfect}</span>
                  <span className="g-g">Great {songResult.grades.great}</span>
                  <span className="g-o">Good {songResult.grades.good}</span>
                  <span className="g-m">Miss {songResult.grades.miss}</span>
                </div>
              )}
              {Array.isArray(drillPlan) && drillPlan.length > 1 && (
                <div className="drillcard">
                  <div className="drillcard-title">🎯 {T("ท่อนที่พลาดทั้งหมด", "All the parts you missed", "所有错的片段")}</div>
                  <div className="drillcard-segs">
                    {drillPlan.map((seg, i) => (
                      <button key={seg.idx} className="drillseg" onClick={() => startDrill(seg)}>
                        <span className="drillseg-num">{drillCleared.includes(seg.idx) ? "✓" : "#" + (i + 1)}</span>
                        <span className="drillseg-bar" style={{ opacity: 0.35 + Math.min(0.65, seg.misses * 0.18) }} />
                        <span className="drillseg-info">{fmtTime(seg.start)}–{fmtTime(seg.end)} · ✗{seg.misses}{seg.notes.length ? " · " + seg.notes.slice(0, 3).join(" ") : ""}</span>
                      </button>
                    ))}
                  </div>
                  <div className="drillcard-hint">{T("วนเฉพาะท่อนนั้น แม่น 90% แล้วเท็มโปขึ้นเอง 75% → 85% → 100%", "Loops just that part — 90% moves the tempo up, 75% → 85% → 100%", "只循环这一段 — 准确率 90% 自动提速 75% → 85% → 100%")}</div>
                </div>
              )}
              <div className="songanalysis">
                {songAnalysisBusy ? (
                  <div className="songanalysis-load">🎯 {T("กำลังวิเคราะห์การเล่น...", "Analyzing your run...", "正在分析演奏...")}</div>
                ) : songAnalysis ? (<>
                  <div className="songanalysis-hd">🎯 {T("จุดที่ควรแก้", "What to fix", "需要改进的地方")}</div>
                  <div className="songanalysis-weak">{songAnalysis.weakness}</div>
                  <ol className="songanalysis-steps">
                    {Array.isArray(songAnalysis.steps) && songAnalysis.steps.map((s, i) => <li key={i}>{String(s)}</li>)}
                  </ol>
                </>) : (
                  <button className="songbtn ghost" style={{ width: "100%" }} onClick={requestSongAnalysis}>🎯 {T("วิเคราะห์การเล่นรอบนี้", "Analyse this run", "分析这一轮")}</button>
                )}
              </div>
              {(kShelfCount > 0 || kShelfOpen) && (
                <button className="songbtn ghost" style={{ width: "100%", marginTop: 8, fontSize: 12 }} onClick={openKnowledgeShelf}>
                  💡 {T("ความรู้ที่เก็บได้", "Knowledge collected", "收集到的知识")}{kShelfCount > 0 ? " · " + kShelfCount : ""}
                </button>
              )}
              <div className="songready-btns" style={{ marginTop: 10 }}>
                <button className="songbtn ghost" onClick={() => shareCard({ title: tr(songMeta, lang), big: songResult.acc + "%", sub: starRow(songResult.stars), lines: [`${lc.songScore}: ${songResult.score}`, `${lc.songCombo} ${songResult.maxCombo}×`] })}>📤 {lc.shareBtn}</button>
                <button className="songbtn ghost pl-line" onClick={() => shareLine(`🎹 ${tr(songMeta, lang)} — ${"★".repeat(songResult.stars)} ${songResult.acc}% 🎵 TiGA Piano AI tigaalpha.github.io`)}>LINE</button>
              </div>
              {/* C1: Friend Challenge — share a challenge link */}
              <button className="songbtn ghost" style={{ width: "100%", marginTop: 6, fontSize: 12 }}
                onClick={() => {
                  const name = encodeURIComponent((profile && (profile.full_name || profile.email)) || "Friend");
                  const link = `${window.location.origin}${window.location.pathname}?challenge=${songMeta.id}:${songResult.acc}:${name}`;
                  const txt = lang === "th"
                    ? `🏆 ฉันทำได้ ${songResult.acc}% ใน "${tr(songMeta, lang)}" บน TiGA Piano AI — แกสู้ได้ไหม? ${link}`
                    : lang === "zh"
                    ? `🏆 我在TiGA Piano AI弹 "${tr(songMeta, lang)}" 得了 ${songResult.acc}%，你能超过我吗？${link}`
                    : `🏆 I scored ${songResult.acc}% on "${tr(songMeta, lang)}" in TiGA Piano AI — can you beat me? ${link}`;
                  try { navigator.clipboard.writeText(txt); } catch (_) {}
                  shareLine(txt);
                }}>
                🏆 {T("ท้าเพื่อน!", "Challenge a Friend!", "挑战朋友!")}
              </button>
              {/* D2: Style Transformer — shown after getting ≥1 star */}
              {songResult.stars >= 1 && (
                <div style={{ marginTop: 10 }}>
                  {!stylePickOpen && !styleLoading && (
                    <button className="songbtn ghost" style={{ width: "100%" }} onClick={() => setStylePickOpen(true)}>
                      🎭 {T("ลองในสไตล์อื่น", "Try in another style", "试试其他风格")}
                    </button>
                  )}
                  {styleLoading && <div className="pl-muted" style={{ textAlign: "center", padding: "8px 0" }}>⏳ {T("กำลังสร้างสไตล์ใหม่...", "Generating new style...", "正在生成新风格...")}</div>}
                  {stylePickOpen && (
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center" }}>
                      {[["jazz", "🎷 Jazz"], ["pop", "🎤 Pop"], ["classical", "🎻 Classical"]].map(([s, l]) => (
                        <button key={s} className="filter-chip" style={{ flex: 1 }} onClick={() => styleTransform(s)}>{l}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {pvpOnline && (pvpOnline.phase === "done" || pvpOnline.phase === "waiting-result") && (() => {
            const mine = pvpOnline.myResult, theirs = pvpOnline.oppResult;
            const winner = mine && theirs ? (mine.score > theirs.score ? "me" : theirs.score > mine.score ? "them" : "tie") : null;
            return (
              <div className="pl-pvp" style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>
                  ⚔ {T("ดวลเพลงออนไลน์", "Online Duel", "在线对决")}
                  {winner === "me" && <span style={{ color: "#5cf2c8" }}> — {T("คุณชนะ!", "You win!", "你赢了！")}</span>}
                  {winner === "them" && <span style={{ color: "#ff6b8a" }}> — {T("แพ้แล้ว ลองใหม่!", "Defeated — rematch!", "惜败 — 再来！")}</span>}
                  {winner === "tie" && <span> — {T("เสมอ!", "Tie!", "平局！")}</span>}
                  {!winner && <span> — {T("รอผลฝ่ายตรงข้าม...", "Waiting for opponent...", "等待对方...")}</span>}
                </div>
                <div className="pl-muted">
                  {T("ฉัน", "Me", "我")}: {mine ? mine.score : "–"} · {T("ฝ่ายตรงข้าม", "Opponent", "对手")}: {theirs ? theirs.score : (pvpOnline.opp ? pvpOnline.opp.score : "–")}
                </div>
              </div>
            );
          })()}
          <button className="pl-link pl-back" onClick={exitSong}>↩ {lc.songBackList}</button>
        </div>
      )}

      {kShelfOpen && (
        <div className="kshelf-modal" onClick={() => setKShelfOpen(false)}>
          <div className="kshelf-card" onClick={e => e.stopPropagation()}>
            <div className="kshelf-hd">
              <span>💡 {T("ความรู้ที่เก็บได้", "Knowledge collected", "收集到的知识")}</span>
              <button className="cbtn" onClick={() => setKShelfOpen(false)}>✕</button>
            </div>
            <div className="kshelf-list">
              {Array.isArray(kShelf) && kShelf.length ? kShelf.map((k, i) => (
                <div key={i} className="kshelf-item">
                  <span className="kshelf-key">{k.pc}</span>
                  <span className="kshelf-txt">{lang === "th" ? (k.th || k.text) : lang === "zh" ? (k.zh || k.text) : (k.en || k.text)}</span>
                </div>
              )) : <div className="kshelf-empty">{T("เล่นให้แม่นเพื่อเก็บการ์ดความรู้!", "Nail perfect hits to collect fact cards!", "弹得准就能收集知识卡片！")}</div>}
            </div>
          </div>
        </div>
      )}

      {showOrientPrompt && (
        <div className="orientation-prompt">
          <div className="op-icon">📱↻</div>
          <div className="op-title">{T("เล่นได้ทั้งแนวตั้งและแนวนอน", "Play in portrait or landscape", "竖屏、横屏都能弹")}</div>
          <div className="op-sub">
            {T("ถนัดแบบไหนใช้แบบนั้นได้เลย ทำได้ทั้งคู่ — ถ้าหมุนเป็นแนวนอน เปียโนจะกว้างขึ้นและโน้ตชัดขึ้น (บอกครั้งเดียว ไม่กวนอีก)",
              "Whichever you prefer — both work fully. Turning sideways just gives you a wider piano and clearer notes. (Shown once only.)",
              "两种都可以，看你习惯 — 横屏时钢琴更宽、音符更清晰。（只提示这一次）")}
          </div>
          <button className="op-skip" onClick={dismissOrientHint}>{T("รับทราบ เริ่มเล่นเลย", "Got it — let's play", "知道了，开始弹")}</button>
        </div>
      )}
    </div>
  );
}
