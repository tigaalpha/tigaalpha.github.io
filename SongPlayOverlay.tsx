import { useState, useEffect } from "react";
import { L, tr } from "./i18n";
import { PlayAlongStaff, GamePiano } from "./music-engine";
import { CountUp } from "./app-shell";
/* ── SongPlayOverlay ──
   The Play Along (falling-notes song mode) full-screen overlay
   (songOpen && songMeta), extracted verbatim from PianoApp's inline JSX as
   part of Phase 2 componentization — no logic changes. lc is derived from
   lang internally, same convention as the other overlay components. ── */
/* ── Online PvP room panel (Play Along plan #10) — the ready-screen UI for
   realtime duel rooms: host a 6-char room / join by code / accept the
   challenger / synchronized start. State + handlers live in use-play-along
   (see pvp-online.ts for the transport). ── */
function OnlinePvpPanel({ pvpOnline, openPvpOnline, closePvpOnline, hostPvpOnline, joinPvpOnline, acceptPvpOnline, startPvpTogether, rematchPvpOnline, songMeta, lang, codeInput, setCodeInput }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
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
    <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid var(--bd1,#444)", background: "rgba(139,92,246,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>⚔ {T("ดวลออนไลน์", "Online Duel", "在线对决")}</b>
        <button className="cbtn" onClick={closePvpOnline}>×</button>
      </div>
      {p.err && <div style={{ color: "#ff5252", fontSize: 13, marginTop: 6 }}>{p.err === "opponent-left" ? T("ฝ่ายตรงข้ามออกจากห้อง", "Opponent left", "对方已离开") : p.err === "declined" ? T("ถูกปฏิเสธ", "Declined", "被拒绝") : p.err}</div>}
      {p.phase === "idle" && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="songbtn go" style={{ flex: 1 }} onClick={hostPvpOnline}>{T("สร้างห้อง", "Host room", "创建房间")}</button>
          <div style={{ flex: 1, display: "flex", gap: 4 }}>
            <input value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 6))} placeholder={T("รหัสห้อง", "ROOM CODE", "房间码")}
              style={{ flex: 1, minWidth: 0, padding: "8px", borderRadius: 10, border: "1px solid var(--bd1,#444)", background: "var(--card,#222)", color: "#fff", textAlign: "center", fontWeight: 800, letterSpacing: 2 }} />
            <button className="songbtn go" onClick={() => joinPvpOnline(codeInput)}>{T("เข้า", "Join", "加入")}</button>
          </div>
        </div>
      )}
      {p.phase === "hosting" && <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted,#aaa)" }}>{T("กำลังสร้างห้อง...", "Creating room...", "正在创建...")}</div>}
      {p.phase === "joining" && <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted,#aaa)" }}>{T("กำลังเข้าห้อง...", "Joining...", "正在加入...")}</div>}
      {p.phase === "waiting" && p.role === "host" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: "var(--muted,#aaa)" }}>{T("รหัสห้อง — ส่งให้เพื่อน", "Room code — share it", "房间码 — 发给好友")}</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 6, textAlign: "center", margin: "6px 0" }}>{p.code}</div>
          <button className="songbtn ghost" style={{ width: "100%" }} onClick={copyLink}>🔗 {T("คัดลอกลิงก์เชิญ", "Copy invite link", "复制邀请链接")}</button>
          {p.guestName ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 6 }}>🤝 {p.guestName} {T("ต้องการดวลด้วย — เพลง:", "wants to duel — song:", "请求对决 — 曲目：")} <b>{tr(songMeta, lang)}</b></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="songbtn go" style={{ flex: 1 }} onClick={() => acceptPvpOnline(true)}>✓ {T("รับ", "Accept", "接受")}</button>
                <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => acceptPvpOnline(false)}>✕ {T("ปฏิเสธ", "Decline", "拒绝")}</button>
              </div>
            </div>
          ) : <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted,#aaa)" }}>{T("รอผู้ท้าชิง...", "Waiting for a challenger...", "等待挑战者...")}</div>}
        </div>
      )}
      {p.phase === "waiting" && p.role === "guest" && (
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted,#aaa)" }}>
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
      {p.phase === "waiting-result" && <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted,#aaa)", textAlign: "center" }}>{T("ส่งผลแล้ว — รอฝ่ายตรงข้ามจบ", "Result sent — waiting for opponent", "已发送 — 等待对方")}</div>}
    </div>
  );
}

export function SongPlayOverlay({ pvpOnline, openPvpOnline, closePvpOnline, hostPvpOnline, joinPvpOnline, acceptPvpOnline, startPvpTogether, rematchPvpOnline, codeInput, setCodeInput, songMeta, lang, songPhase, songResult, songHud, songGhost, songStaffNotes, songShake, songFever, songCanvasRef, songCountdown, songGo, songBonus, songAnnounce, songPops, songJudge, songBursts, songDataRef, songTempo, setSongTempo, songAutoLoop, setSongAutoLoop, backingOn, setBackingOn, songSrc, songNextLit, songNextLit2, songFingerMap, songInputRef, songAnalysisBusy, songAnalysis, stylePickOpen, setStylePickOpen, styleLoading, profile, exitSong, goToRecommendation, startSongPlay, previewSong, shareCard, shareLine, styleTransform, buildSongResultRecommendation, songLoopRecap, songSetlistPos, metroOn, setMetroOn, getAC, metroBpm, playAlongHand, changePlayAlongHand, setSongPhase }) {
  const lc = L[lang];
  // Landscape orientation prompt for Play Along — detect portrait on mobile
  // The rotate hint is a one-time lesson, not a recurring nag: once it has
  // been seen it never appears again on this device, however many songs are
  // played afterwards. It taught what it needed to teach.
  const ORIENT_SEEN_KEY = "tg_orient_hint_seen";
  const [orientSkipped, setOrientSkipped] = useState(() => {
    try { return localStorage.getItem(ORIENT_SEEN_KEY) === "1"; } catch (e) { return false; }
  });
  function dismissOrientHint() {
    setOrientSkipped(true);
    try { localStorage.setItem(ORIENT_SEEN_KEY, "1"); } catch (e) {}
  }
  // seeing it at all counts as having been taught — mark it the moment it shows
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
  const showOrientPrompt = isPortrait && !orientSkipped && songPhase === "playing" && typeof window !== "undefined" && window.innerWidth < 600;
  return (
        <div className="songov">
          <div className="songhdr">
            <div className="songhtitle">
              {tr(songMeta, lang)}<small>{"★".repeat(songMeta.diff)}</small>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => { if (getAC) getAC(); setMetroOn && setMetroOn(o => !o); }} style={{ background: metroOn ? '#166534' : '#7c2d12', border: metroOn ? '2px solid #22c55e' : '2px solid #f97316', borderRadius: 8, padding: '5px 12px', color: metroOn ? '#bbf7d0' : '#fed7aa', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: metroOn ? '0 0 8px rgba(34,197,94,0.4)' : '0 0 6px rgba(249,115,22,0.3)' }} aria-label="Toggle metronome">
                🥁 {metroOn ? (lang === 'th' ? 'ON' : lang === 'zh' ? '开' : 'ON') : (lang === 'th' ? 'OFF' : lang === 'zh' ? '关' : 'OFF')}{metroOn && metroBpm ? ` ${metroBpm}` : ''}
              </button>
              <button className="cbtn" onClick={exitSong}>{lc.close}</button>
            </div>
          </div>

          {/* "What's next" nudge right after finishing a song — reacts to how this
              specific attempt went (see buildSongResultRecommendation): under 3 stars
              offers this same song again since it's not fluent yet; 3 stars defers to
              the normal engine, which moves on to something new. */}
          {songPhase === "done" && songResult && (() => {
            const rec = buildSongResultRecommendation(lang, songMeta, songResult);
            return (
              <div className="trial-banner">
                <span className="trial-banner-txt" style={{ fontSize: 15 }}>🤖 {rec.reason}</span>
                <button className="trial-banner-btn" onClick={() => { exitSong(); goToRecommendation(rec); }}>{lang === "th" ? "ไป →" : lang === "zh" ? "去 →" : "Go →"}</button>
              </div>
            );
          })()}

          {songPhase === "playing" && (
            <>
              <div className="songhud">
                <span>{lc.songScore} <b>{songHud.score}</b></span>
                <span className={`combostat${songHud.combo >= 30 ? " t4" : songHud.combo >= 20 ? " t3" : songHud.combo >= 10 ? " t2" : songHud.combo >= 5 ? " t1" : ""}`}>
                  {lc.songCombo} <b>{songHud.combo}×</b>{songHud.combo >= 5 && <span className="comboflame">🔥</span>}
                </span>
                <span>{lc.practiceAcc} <b>{songHud.acc}%</b></span>
                {songGhost && <span className={`ghoststat ${songGhost.diff >= 0 ? "ahead" : "behind"}`}>👻 {songGhost.diff >= 0 ? "▲" : "▼"}{Math.abs(songGhost.diff)}</span>}
                {pvpOnline && pvpOnline.phase === "racing" && pvpOnline.opp && <span className="pvplive">⚔ {pvpOnline.opp.score}</span>}
                {songSetlistPos && <span className="setlistpos">🎤 {songSetlistPos.idx + 1}/{songSetlistPos.total}</span>}
              </div>
              <div className="songprog"><div style={{ width: songHud.progress + "%" }} /></div>
              <div className={`songstaffwrap${playAlongHand === "both" ? " grand" : ""}`}>
                <PlayAlongStaff notes={songStaffNotes.list} startBeat={songStaffNotes.startBeat} spanBeats={songStaffNotes.spanBeats}
                  songMeta={songMeta} handMode={playAlongHand} />
              </div>
            </>
          )}

          {songPhase !== "done" && (
            <div className={`songstage${songShake ? " shake" : ""}${songFever ? " fever" : ""}`}>
              {songFever && <div className="feverbg" />}
              <canvas ref={songCanvasRef} className="songcanvas" />
              {songCountdown != null && <div className="songcount" key={songCountdown}>{songCountdown}</div>}
              {songGo && <div className="songgo">GO!</div>}
              {songFever && <div className="feverbadge">🔥 FEVER ×2</div>}
              {songBonus && <div className="songbonus" key={songBonus.id}>{lc.dhBonus} {songBonus.text}</div>}
              {songAnnounce && <div className="songannounce" key={songAnnounce.id}>{songAnnounce.text}</div>}
              {songPops.map(p => (
                <div key={p.id} className={`songpop${p.perfect ? " perfect" : ""}`} style={{ left: p.x + "%" }}>{p.text}</div>
              ))}
              {songJudge && <div className={`songjudge ${songJudge.kind}`} key={songJudge.id}>{songJudge.kind === "perfect" ? lc.judgePerfect : songJudge.kind === "good" ? lc.judgeGood : lc.judgeMiss}</div>}
              {songBursts.map(b => (
                <div key={b.id} className={`burst ${b.kind}`}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <i key={i} style={{ "--a": (i * 36) + "deg", "--d": (28 + (i % 3) * 14) + "px" }} />
                  ))}
                </div>
              ))}
              {/* Between-run recap — auto-loop and Setlist mode both skip the full
                  result screen and restart within ~2s, so without this the run's
                  own outcome (score/stars/combo/EXP) went completely unseen. */}
              {songLoopRecap && (
                <div className="looprecap">
                  <div className="looprecap-stars">{"★".repeat(songLoopRecap.stars)}{"☆".repeat(3 - songLoopRecap.stars)}</div>
                  <div className="looprecap-row"><b>{songLoopRecap.acc}%</b> · 🔥{songLoopRecap.maxCombo} · +{songLoopRecap.exp} EXP</div>
                  {songLoopRecap.nextSong && <div className="looprecap-next">{lc.songNextUp} {songLoopRecap.nextSong}</div>}
                </div>
              )}
              {songPhase === "ready" && (
                <div className="songready">
                  {songSetlistPos && <div className="setlistpos ready">🎤 {lc.setlistSong} {songSetlistPos.idx + 1}/{songSetlistPos.total}</div>}
                  <div className="songready-info">{tr(songMeta, lang)} · {songDataRef.current ? songDataRef.current.total : 0} {lc.songNotes} · {songMeta.bpm} BPM</div>
                  <div className="songtempo">
                    {[0.5, 0.75, 1, 1.25].map(tp => (
                      <button key={tp} className={`songtempobtn${songTempo === tp ? " on" : ""}`} onClick={() => setSongTempo(tp)} title={tp === 0.5 ? lc.songSlowHint : undefined}>
                        {tp === 1 ? "1×" : tp + "×"}{tp === 0.5 ? " 🐢" : ""}
                      </button>
                    ))}
                  </div>
                  <div className="songtempo" style={{ marginTop: 6 }}>
                    <button className={`songtempobtn${songAutoLoop ? " on" : ""}`} onClick={() => setSongAutoLoop(v => !v)}>
                      {songAutoLoop ? lc.songLoop : lc.songNoLoop}
                    </button>
                    {/* HIDDEN (not deleted) per feature audit — backingOn state/loop logic untouched. */}
                    {false && <button className={`songtempobtn${backingOn ? " on" : ""}`} onClick={() => setBackingOn(v => !v)} title={lang === "th" ? "เปิด/ปิดเสียงคอร์ดประกอบ" : lang === "zh" ? "开关和弦伴奏" : "Toggle backing chords"}>
                      🎸 {lang === "th" ? "คอร์ดประกอบ" : lang === "zh" ? "和弦伴奏" : "Backing"}
                    </button>}
                  </div>
                  {/* Hand mode selector — prominent, before Start button */}
                  <div style={{ marginTop: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, color: "var(--muted, #aaa)", marginBottom: 6, textAlign: "center" }}>
                      {lang === "th" ? "🎹 เลือกมือที่จะฝึก" : lang === "zh" ? "🎹 选择练习的手" : "🎹 Choose hand to practice"}
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {["right", "left", "both"].map(h => (
                        <button key={h}
                          style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: playAlongHand === h ? "2px solid var(--accent, #d97757)" : "1px solid var(--bd1, #444)", background: playAlongHand === h ? "var(--accent, #d97757)" : "var(--card, #222)", color: playAlongHand === h ? "#fff" : "var(--text, #ddd)", fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "center" }}
                          onClick={() => changePlayAlongHand(h)}>
                          {h === "right" ? (lang === "th" ? "🖐️ มือขวา" : lang === "zh" ? "🖐️ 右手" : "🖐️ Right")
                           : h === "left" ? (lang === "th" ? "🤚 มือซ้าย" : lang === "zh" ? "🤚 左手" : "🤚 Left")
                           : (lang === "th" ? "🤲 สองมือ" : lang === "zh" ? "🤲 双手" : "🤲 Both")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <OnlinePvpPanel pvpOnline={pvpOnline} openPvpOnline={openPvpOnline} closePvpOnline={closePvpOnline} hostPvpOnline={hostPvpOnline} joinPvpOnline={joinPvpOnline} acceptPvpOnline={acceptPvpOnline} startPvpTogether={startPvpTogether} rematchPvpOnline={rematchPvpOnline} songMeta={songMeta} lang={lang} codeInput={codeInput} setCodeInput={setCodeInput} />
                  <div className="songready-btns">
                    <button className="songbtn ghost" onClick={previewSong}>▶ {lc.songPreview}</button>
                    <button className="songbtn go" onClick={startSongPlay}>▶ {lc.songStart}</button>
                  </div>
                  <div className="songsrc">{lc.songInputHint}</div>
                </div>
              )}
            </div>
          )}

          {songPhase === "playing" && (
            <>
              <GamePiano fullWidth litSet={[songNextLit, songNextLit2].filter(Boolean)} fingerMap={songFingerMap}
                baseOct={playAlongHand === "left" ? 2 : playAlongHand === "both" ? 3 : 4}
                octs={playAlongHand === "both" ? 4 : 2}
                onNote={(n) => songInputRef.current({ note: n, freq: null, source: "tap" })} />
              <div className="songsrcbar">
                {!songSrc ? "…" : songSrc.type === "midi" ? lc.practiceMidi : songSrc.type === "mic" ? lc.practiceMic : lc.practiceMicErr}
              </div>
            </>
          )}

          {songPhase === "done" && songResult && (
            <div className="songresult">
              {/* Setlist finale — score/maxCombo below are already the whole
                  concert's combined totals (never reset between songs, see
                  startSongPlay's continueSetlist param), this just names what
                  they are and lists each song's own stars. */}
              {songResult.setlist && (
                <div className="concertrecap">
                  <div className="concertrecap-title">🎤 {lc.concertComplete}</div>
                  <div className="concertrecap-songs">
                    {songResult.setlist.map((s, i) => (
                      <span key={i} className="concertrecap-song">{tr(s.song, lang)} {"★".repeat(s.stars)}{"☆".repeat(3 - s.stars)}</span>
                    ))}
                  </div>
                </div>
              )}
              {songResult.allPerfect ? <div className="songfc ap">✦ {lc.songAllPerfect} ✦</div>
                : songResult.fullCombo ? <div className="songfc">★ {lc.songFullCombo} ★</div> : null}
              {songResult.newBest && <div className="songnewbest">🏆 {lc.songNewBest}</div>}
              <div className="songstars">{"★".repeat(songResult.stars)}{"☆".repeat(3 - songResult.stars)}</div>
              <div className="songresult-acc"><CountUp value={songResult.acc} dur={700} />%</div>
              <div className="songresult-grid">
                <div><span>{lc.songScore}</span><b><CountUp value={songResult.score} /></b></div>
                <div><span>{lc.songBest}</span><b>{songResult.best}</b></div>
                <div><span>{lc.songMaxCombo}</span><b>{songResult.maxCombo}×</b></div>
                <div><span>✓</span><b>{songResult.hits}/{songResult.total}</b></div>
                <div><span>EXP</span><b>+{songResult.exp}</b></div>
                <div><span>🪙</span><b>+{songResult.coins}</b></div>
              </div>
              <div className="songanalysis">
                {songAnalysisBusy ? (
                  <div className="songanalysis-load">🎯 {lang === "th" ? "กำลังวิเคราะห์การเล่น..." : lang === "zh" ? "正在分析演奏..." : "Analyzing your run..."}</div>
                ) : songAnalysis ? (<>
                  <div className="songanalysis-hd">🎯 {lang === "th" ? "จุดที่ควรแก้" : lang === "zh" ? "需要改进的地方" : "What to fix"}</div>
                  <div className="songanalysis-weak">{songAnalysis.weakness}</div>
                  {songAnalysis.strategy && (
                    <div className="songanalysis-strat" style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, letterSpacing: 0.3 }}>
                      ✦ {lang === "th" ? "กลยุทธ์ครู TiGA" : lang === "zh" ? "TiGA老师策略" : "Teacher TiGA's strategy"}: {songAnalysis.strategy}
                    </div>
                  )}
                  <ol className="songanalysis-steps">
                    {songAnalysis.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                  <button className="songbtn ghost" style={{ width: "100%", marginTop: 8, fontSize: 12 }}
                    onClick={() => { setSongPhase("ready"); }}>
                    {lang === "th" ? "🔁 ฝึกท่อนนี้อีกครั้งตามคำแนะนำ" : lang === "zh" ? "🔁 按建议再练一遍" : "🔁 Practice this song again with the tip"}
                  </button>
                </>) : null}
              </div>
              <div className="songready-btns">
                <button className="songbtn ghost" onClick={exitSong}>↩ {lc.songBackList}</button>
                <button className="songbtn ghost" onClick={() => shareCard({ title: tr(songMeta, lang), big: songResult.acc + "%", sub: "★".repeat(songResult.stars) + "☆".repeat(3 - songResult.stars), lines: [`${lc.songScore}: ${songResult.score}`, `${lc.songCombo} ${songResult.maxCombo}×`] })}>📤 {lc.shareBtn}</button>
                <button className="songbtn ghost" style={{ borderColor: "#06c755", color: "#06c755" }} onClick={() => shareLine(`🎹 ${tr(songMeta, lang)} — ${"★".repeat(songResult.stars)} ${songResult.acc}% 🎵 TiGA Piano AI tigaalpha.github.io`)}>🟢 LINE</button>
                <button className="songbtn go" onClick={() => setSongPhase("ready")}>↻ {lc.songRetry}</button>
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
                🏆 {lang === "th" ? "ท้าเพื่อน!" : lang === "zh" ? "挑战朋友!" : "Challenge a Friend!"}
              </button>
              {pvpOnline && (pvpOnline.phase === "done" || pvpOnline.phase === "waiting-result") && (() => {
                const mine = pvpOnline.myResult, theirs = pvpOnline.oppResult;
                const winner = mine && theirs ? (mine.score > theirs.score ? "me" : theirs.score > mine.score ? "them" : "tie") : null;
                const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
                return (
                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--bd1,#444)", background: "rgba(139,92,246,0.08)" }}>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>
                      ⚔ {T("ดวลเพลงออนไลน์", "Online Duel", "在线对决")}
                      {winner === "me" && <span style={{ color: "#4ade80" }}> — {T("คุณชนะ!", "You win!", "你赢了！")}</span>}
                      {winner === "them" && <span style={{ color: "#ff5252" }}> — {T("แพ้แล้ว ลองใหม่!", "Defeated — rematch!", "惜败 — 再来！")}</span>}
                      {winner === "tie" && <span> — {T("เสมอ!", "Tie!", "平局！")}</span>}
                      {!winner && <span> — {T("รอผลฝ่ายตรงข้าม...", "Waiting for opponent...", "等待对方...")}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted,#aaa)" }}>
                      {T("ฉัน", "Me", "我")}: {mine ? mine.score : "–"} · {T("ฝ่ายตรงข้าม", "Opponent", "对手")}: {theirs ? theirs.score : (pvpOnline.opp ? pvpOnline.opp.score : "–")}
                    </div>
                  </div>
                );
              })()}

              {/* D2: Style Transformer — shown after getting ≥1 star */}
              {songResult.stars >= 1 && (
                <div style={{ marginTop: 10 }}>
                  {!stylePickOpen && !styleLoading && (
                    <button className="songbtn ghost" style={{ width: "100%" }} onClick={() => setStylePickOpen(true)}>
                      🎭 {lang === "th" ? "ลองในสไตล์อื่น" : lang === "zh" ? "试试其他风格" : "Try in another style"}
                    </button>
                  )}
                  {styleLoading && <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>⏳ {lang === "th" ? "กำลังสร้างสไตล์ใหม่..." : lang === "zh" ? "正在生成新风格..." : "Generating new style..."}</div>}
                  {stylePickOpen && (
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center" }}>
                      {[["jazz","🎷 Jazz"],["pop","🎤 Pop"],["classical","🎻 Classical"]].map(([s,l]) => (
                        <button key={s} className="filter-chip" style={{ flex: 1 }} onClick={() => styleTransform(s)}>{l}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* A one-time tip, not an instruction: both orientations work fully —
              landscape just gives a wider keyboard — so it says so plainly and
              never appears again once it has been read. */}
          {showOrientPrompt && (
            <div className="orientation-prompt">
              <div className="op-icon">📱↻</div>
              <div className="op-title">
                {lang === "th" ? "เล่นได้ทั้งแนวตั้งและแนวนอน" : lang === "zh" ? "竖屏、横屏都能弹" : "Play in portrait or landscape"}
              </div>
              <div className="op-sub">
                {lang === "th"
                  ? "ถนัดแบบไหนใช้แบบนั้นได้เลย ทำได้ทั้งคู่ — ถ้าหมุนเป็นแนวนอน เปียโนจะกว้างขึ้นและโน้ตชัดขึ้น (บอกครั้งเดียว ไม่กวนอีก)"
                  : lang === "zh"
                  ? "两种都可以，看你习惯 — 横屏时钢琴更宽、音符更清晰。（只提示这一次）"
                  : "Whichever you prefer — both work fully. Turning sideways just gives you a wider piano and clearer notes. (Shown once only.)"}
              </div>
              <button className="op-skip" onClick={dismissOrientHint}>
                {lang === "th" ? "รับทราบ เริ่มเล่นเลย" : lang === "zh" ? "知道了，开始弹" : "Got it — let's play"}
              </button>
            </div>
          )}
        </div>
  );
}
