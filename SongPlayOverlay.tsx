import { L, tr } from "./i18n";
import { PlayAlongStaff, GamePiano } from "./music-engine";
import { CountUp } from "./app-shell";
/* ── SongPlayOverlay ──
   The Play Along (falling-notes song mode) full-screen overlay
   (songOpen && songMeta), extracted verbatim from PianoApp's inline JSX as
   part of Phase 2 componentization — no logic changes. lc is derived from
   lang internally, same convention as the other overlay components. ── */
export function SongPlayOverlay({ songMeta, lang, songPhase, songResult, songHud, songGhost, songStaffNotes, songShake, songFever, songCanvasRef, songCountdown, songGo, songBonus, songAnnounce, songPops, songJudge, songBursts, songDataRef, songTempo, setSongTempo, songAutoLoop, setSongAutoLoop, backingOn, setBackingOn, songSrc, songNextLit, songInputRef, songAnalysisBusy, songAnalysis, stylePickOpen, setStylePickOpen, styleLoading, profile, exitSong, goToRecommendation, startSongPlay, previewSong, shareCard, shareLine, styleTransform, buildSongResultRecommendation, songLoopRecap, songSetlistPos, metroOn, setMetroOn, getAC }) {
  const lc = L[lang];
  return (
        <div className="songov">
          <div className="songhdr">
            <div className="songhtitle">
              {tr(songMeta, lang)}<small>{"★".repeat(songMeta.diff)}</small>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => { if (getAC) getAC(); setMetroOn && setMetroOn(o => !o); }} style={{ background: metroOn ? '#166534' : '#374151', border: metroOn ? '2px solid #22c55e' : '2px solid #6b7280', borderRadius: 8, padding: '5px 12px', color: metroOn ? '#bbf7d0' : '#d1d5db', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: metroOn ? '0 0 8px rgba(34,197,94,0.4)' : 'none' }} aria-label="Toggle metronome">
                🥁 {metroOn ? (lang === 'th' ? 'ON' : lang === 'zh' ? '开' : 'ON') : (lang === 'th' ? 'OFF' : lang === 'zh' ? '关' : 'OFF')}
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
                {songSetlistPos && <span className="setlistpos">🎤 {songSetlistPos.idx + 1}/{songSetlistPos.total}</span>}
              </div>
              <div className="songprog"><div style={{ width: songHud.progress + "%" }} /></div>
              <div className="songstaffwrap"><PlayAlongStaff notes={songStaffNotes} songMeta={songMeta} /></div>
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
              <GamePiano fullWidth litNote={songNextLit} onNote={(n) => songInputRef.current({ note: n, freq: null, source: "tap" })} />
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
                  <ol className="songanalysis-steps">
                    {songAnalysis.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </>) : null}
              </div>
              <div className="songready-btns">
                <button className="songbtn ghost" onClick={exitSong}>↩ {lc.songBackList}</button>
                <button className="songbtn ghost" onClick={() => shareCard({ title: tr(songMeta, lang), big: songResult.acc + "%", sub: "★".repeat(songResult.stars) + "☆".repeat(3 - songResult.stars), lines: [`${lc.songScore}: ${songResult.score}`, `${lc.songCombo} ${songResult.maxCombo}×`] })}>📤 {lc.shareBtn}</button>
                <button className="songbtn ghost" style={{ borderColor: "#06c755", color: "#06c755" }} onClick={() => shareLine(`🎹 ${tr(songMeta, lang)} — ${"★".repeat(songResult.stars)} ${songResult.acc}% 🎵 TiGA Piano AI tigaalpha.github.io`)}>🟢 LINE</button>
                <button className="songbtn go" onClick={startSongPlay}>↻ {lc.songRetry}</button>
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
        </div>
  );
}
