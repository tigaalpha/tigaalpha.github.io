import { L } from "./i18n";
/* ── CameraCoachOverlay ──
   The hand-posture camera coach full-screen overlay (camOpen), extracted
   verbatim from PianoApp's inline JSX as part of Phase 2 componentization —
   no logic changes. lc is derived from lang internally, same convention as
   the other overlay components. ── */
export function CameraCoachOverlay({ lang, exitCamera, camVideoRef, camCanvasRef, camStatus, camMsg, camCoach, retryCamera, setCamCoach, analyzeHands, premium, camRecap = null, camSpeaking = false, closeCameraAfterRecap }) {
  const lc = L[lang];
  return (
        <div className="songov camov">
          <div className="songhdr">
            <div className="songhtitle">✋ {lc.camTitle}</div>
            <button className="cbtn" onClick={exitCamera}>{lc.close}</button>
          </div>
          <div className="camstage">
            <video ref={camVideoRef} className="camvideo" playsInline muted />
            <canvas ref={camCanvasRef} className="camcanvas" />
            {camStatus === "loading" && <div className="camoverlay">{lc.camLoading}</div>}
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
                  {camRecap.trend === "up" ? lc.camRecapBetter : camRecap.trend === "first" ? lc.camRecapFirst : lc.camRecapSame}
                </div>
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
