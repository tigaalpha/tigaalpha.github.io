import { L } from "./i18n";
/* ── CameraCoachOverlay ──
   The hand-posture camera coach full-screen overlay (camOpen), extracted
   verbatim from PianoApp's inline JSX as part of Phase 2 componentization —
   no logic changes. lc is derived from lang internally, same convention as
   the other overlay components. ── */
export function CameraCoachOverlay({ lang, exitCamera, camVideoRef, camCanvasRef, camStatus, camMsg, camCoach, retryCamera, setCamCoach, analyzeHands, premium, camRecap = null, camSpeaking = false, camStreakInfo = null, closeCameraAfterRecap, camGame = null, camPraise = "", camMission = null }) {
  const lc = L[lang];
  const rank = camGame ? (camGame.rankIdx >= 0 && camGame.rankIdx < 5 ? [{ min: 90, icon: "👑" }, { min: 75, icon: "🏆" }, { min: 60, icon: "⭐" }, { min: 40, icon: "🌱" }, { min: 0, icon: "🎯" }][camGame.rankIdx] : null) : null;
  const cti = camGame ? (camGame.combo >= 60 ? 3 : camGame.combo >= 30 ? 2 : camGame.combo >= 12 ? 1 : 0) : 0;
  const comboName = [lc.camCombo0, lc.camCombo1, lc.camCombo2, lc.camCombo3][cti];
  return (
        <div className="songov camov">
          <div className="songhdr">
            {/* back arrow (top-left, always works — same exitCamera as the
                header close; the recap-aware fix in use-camera-coach.ts makes
                it reliable even when a session recap is showing) */}
            <button className="cbtn" style={{ fontSize: 20, lineHeight: 1, padding: "2px 10px" }}
              aria-label={lc.back} title={lc.back}
              onClick={exitCamera}>←</button>
            <div className="songhtitle">
              ✋ {lc.camTitle}
              {camStreakInfo && camStreakInfo.count > 0 && (
                <span className="camstreak-badge" title={lc.camStreakLbl}>
                  {camStreakInfo.tier ? camStreakInfo.tier.icon : "🔥"} {camStreakInfo.count}
                </span>
              )}
            </div>
            <button className="cbtn" onClick={exitCamera}>{lc.close}</button>
          </div>
          <div className="camstage">
            <video ref={camVideoRef} className="camvideo" playsInline muted />
            <canvas ref={camCanvasRef} className="camcanvas" />
            {camStatus === "loading" && <div className="camoverlay">{lc.camLoading}</div>}
            {/* ═══ GAME HUD (top of stage) — score bar + rank, combo, stars ═══ */}
            {camGame && camStatus === "running" && !camRecap && (
              <div className="camgame-hud">
                <div className="camgame-score">
                  <span className="camgame-rank">{rank ? rank.icon : "🎯"}</span>
                  <div className="camgame-bar"><div className="camgame-fill" style={{ width: `${Math.round(camGame.score)}%` }} /></div>
                  <span className="camgame-num" style={{ fontFamily: "var(--f-num, monospace)" }}>{Math.round(camGame.score)}</span>
                </div>
                <div className="camgame-side">
                  {camGame.combo >= 3 && <span className={`camgame-combo c${cti}`}>🔥 {camGame.combo} <small>{comboName}</small></span>}
                  {camGame.stars > 0 && <span className="camgame-stars">⭐ {camGame.stars}</span>}
                </div>
              </div>
            )}
            {/* ═══ MISSION CARD (center stage, big & readable — owner: "ย้ายคำสั่งมาอยู่ตรงกลางจอ
                ตัวหนังสือใหญ่ขึ้น มองยาก" — mission text centered + enlarged, with a plain-words
                HOW-TO line so the goal is never ambiguous, and a progress bar + countdown that
                survive without reading the number) ═══ */}
            {camGame && camMission && camStatus === "running" && !camRecap && (
              <div className="cammission">
                <div className="cammission-top">
                  <span className="cammission-lbl">🎯 {lc.camMissionLbl}</span>
                  <span className="cammission-timer" style={{ fontFamily: "var(--f-num, monospace)" }}>{camMission.secLeft}s</span>
                </div>
                <div className="cammission-txt">{lang === "th" ? camMission.ch.th : lang === "zh" ? camMission.ch.zh : camMission.ch.en}</div>
                <div className="cammission-how">{lang === "th" ? camMission.how.th : lang === "zh" ? camMission.how.zh : camMission.how.en}</div>
                <div className="cammission-bar"><div className="cammission-fill" style={{ width: `${Math.round(camMission.prog * 100)}%` }} /></div>
              </div>
            )}
            {/* ═══ PRAISE TOAST — one-shot celebration, floats above everything ═══ */}
            {camPraise && !camRecap && <div className="campraise" key={camPraise}>{camPraise}</div>}
            {camStatus === "error" && (
              <div className="camoverlay err">
                <div>{lc.camError}</div>
                <button className="songbtn go" style={{ marginTop: 14 }} onClick={retryCamera}>↻ {lc.camRetry}</button>
              </div>
            )}
            {camStatus === "running" && camMsg && <div className="cammsg">{camMsg}</div>}
            {camCoach && (
              <div className="camcoach">
                {camCoach.loading ? <div className="camcoach-load">🎓 {lc.camCoachLoad}</div>
                  : <><div className="camcoach-hd">🎓 {lc.camCoachTitle}{camSpeaking && <span className="camspeaking"> 🔊</span>}</div><div className="camcoach-tx">{camCoach.text}</div><button className="cbtn" onClick={() => setCamCoach(null)}>{lc.close}</button></>}
              </div>
            )}
            {camRecap && (
              <div className="camcoach camrecap">
                <div className="camcoach-hd">📋 {lc.camRecapTitle}</div>
                <div className="camrecap-pct">{camRecap.pct}%</div>
                <div className="camrecap-trend">
                  {camRecap.trend === "up" ? lc.camRecapBetter
                    : camRecap.trend === "down" ? lc.camRecapWorse
                    : camRecap.trend === "first" ? lc.camRecapFirst
                    : lc.camRecapSame}
                </div>
                {camRecap.streak > 0 && (
                  <div className={`camrecap-streak${camRecap.tierUp ? " tierup" : ""}`}>
                    {camRecap.tier ? camRecap.tier.icon : "🔥"} {lc.camStreakLbl}: {camRecap.streak}
                    {camRecap.tierUp && <span className="camrecap-tierup-tag">{lc.camStreakTierUp}</span>}
                  </div>
                )}
                {(camRecap.xp || camRecap.coins) && (
                  <div className="camrecap-reward">+{camRecap.xp} EXP{camRecap.coins > 0 && <> · +{camRecap.coins} 🪙</>}</div>
                )}
                {/* game-session highlights — pure numbers this session actually produced */}
                {camRecap.stars > 0 && (
                  <div className="camrecap-game">
                    <span>⭐ {camRecap.stars}</span>
                    {camRecap.solved > 0 && <span>🎯 {lang === "th" ? `ภารกิจสำเร็จ ${camRecap.solved}` : lang === "zh" ? `完成任务 ${camRecap.solved}` : `missions ${camRecap.solved}`}</span>}
                    {camRecap.bestCombo >= 3 && <span>🔥 {lang === "th" ? "คอมโบสูงสุด" : lang === "zh" ? "最高连击" : "best combo"} {camRecap.bestCombo}</span>}
                  </div>
                )}
                <button className="cbtn" onClick={closeCameraAfterRecap}>{lc.camRecapClose}</button>
              </div>
            )}
          </div>
          <div className="camfoot">
            <div className="songsrcbar">{lc.camNote}</div>
            <div className="camfoot-btns">
              <button className="songbtn go" onClick={analyzeHands} disabled={camStatus !== "running" || (camCoach && camCoach.loading)}>🎓 {lc.camCoachBtn}{!premium && " 🔒"}</button>
              <button className="songbtn ghost" onClick={exitCamera}>✕ {lc.camStop}</button>
            </div>
          </div>
        </div>
  );
}
