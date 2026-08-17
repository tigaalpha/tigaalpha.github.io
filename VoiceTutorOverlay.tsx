import { L, FLAGS, FLAG_NAMES } from "./i18n";
import { GamePiano, StaffNotes, playUi, getAC } from "./music-engine";
import { VM_VOICES } from "./speech";
/* ── VoiceTutorOverlay ──
   The AI Voice Tutor full-screen overlay (vmOpen), extracted verbatim from
   PianoApp's inline JSX as part of Phase 2 componentization — no logic
   changes. Android-app-only feature (isAndroidNative gate lives at the
   trigger site in PianoApp, not here); structurally unreachable in any web/
   headless context per the modularization plan, so this extraction is
   build-verified and statically prop-audited but not driveable by a
   headless browser test — matches how the plan itself scoped this step.
   lc is derived from lang internally, same convention as the other
   overlay components. ── */
export function VoiceTutorOverlay({ lang, setLang, vmLangOpen, setVmLangOpen, exitVoice, vmState, vmErr, vmOrbTap, vmInstant, vmCaption, vmStaff, vmNotes, vmMsgs, vmEndRef, vmLit, vmOnNote, vmMenuOpen, setVmMenuOpen, vmSpeed, setVmSpeed, vmSpeedRef, vmVoice, setVmVoice, vmFast, setVmFast, vmFastRef, vmCloudDeadRef, vmPoly, vmTogglePoly, vmInput, setVmInput, vmEarResetRef, vmActiveRef, vmProcess, vmToggle }) {
  const lc = L[lang];
  return (
        <div className="songov vmov">
          <div className="songhdr">
            <div className="songhtitle">🎙️ {lc.vmTitle} <small style={{ color: "#d97757" }}>AI</small></div>
            <div className="vmhdrbtns">
              <div className="flagwrap" onClick={e => e.stopPropagation()}>
                <button className="flagbtn" onClick={() => setVmLangOpen(o => !o)}
                  aria-label="Language" aria-expanded={vmLangOpen} title={lc.vmLangHint}>
                  <span>{FLAGS[lang]}</span>
                  <span className="caret">{vmLangOpen ? "▲" : "▼"}</span>
                </button>
                {vmLangOpen && (
                  <div className="flagmenu">
                    {["th", "en", "zh"].map(lg => (
                      <button key={lg} className={`flagitem${lang === lg ? " active" : ""}`}
                        onClick={() => { setLang(lg); setVmLangOpen(false); playUi("click"); }}>
                        <span>{FLAGS[lg]}</span>
                        <span className="fn">{FLAG_NAMES[lg]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="cbtn" onClick={exitVoice}>{lc.close}</button>
            </div>
          </div>
          {vmState === "error" ? (
            <div className="camoverlay err" style={{ position: "static", flex: 1 }}>{vmErr || lc.vmNoSTT}</div>
          ) : (
            <>
              <div className="vmstage">
                <button className={`vmorb ${vmState}`} onClick={vmOrbTap}
                  title={(vmState === "speaking" || vmState === "thinking") ? lc.vmTapStop : vmState === "listening" ? lc.vmReListen : ""}>
                  {vmState === "speaking" ? "🔊" : vmState === "thinking" ? "💭" : vmState === "listening" ? "🎤" : "🎙️"}
                  {vmInstant && <span className={`vminstant ${vmInstant.ok ? "ok" : "bad"}`} key={vmInstant.id}>{vmInstant.ok ? "✓" : "✗"}</span>}
                </button>
                <div className="vmstate">
                  {(vmState === "speaking" || vmState === "thinking") ? lc.vmTapStop
                    : vmState === "listening" ? lc.vmListening : lc.vmReady}
                </div>
                <div className="vmcaption">{vmCaption}</div>
                {vmStaff && vmStaff.length > 0 && <div className="vmstaff"><StaffNotes notes={vmStaff} /></div>}
                {vmNotes.length > 0 && <div className="vmnotes">{vmNotes.map((n, i) => <span key={i} className="vmnote">{n}</span>)}</div>}
              </div>
              <div className="vmlog">
                {vmMsgs.map((m, i) => <div key={i} className={`vmbub ${m.role === "user" ? "user" : "ai"}`}>{m.text}</div>)}
                <div ref={vmEndRef} />
              </div>
              <GamePiano litSet={vmLit} scroll onNote={(n) => vmOnNote({ note: n, freq: null, source: "tap" })} />
              <div className="vmfoot">
                {/* ⋯ all secondary controls live here now — one tidy button, bottom-right */}
                <div className="vmmorewrap" onClick={e => e.stopPropagation()}>
                  {vmMenuOpen && (
                    <div className="vmmenu">
                      <div className="vmspeed">
                        <span className="vmspeed-lbl">{lc.vmSpeedLbl}</span>
                        {[1, 1.25, 1.5, 1.75, 2].map(s => (
                          <button key={s} className={`vmspeed-b${vmSpeed === s ? " on" : ""}`}
                            onClick={() => { setVmSpeed(s); vmSpeedRef.current = s; playUi("click"); }}>{s}x</button>
                        ))}
                      </div>
                      <div className="vmspeed">
                        <span className="vmspeed-lbl">{lc.vmVoiceLbl}</span>
                        {VM_VOICES.map(v => (
                          <button key={v.k} className={`vmspeed-b${vmVoice === v.k ? " on" : ""}`}
                            onClick={() => { setVmVoice(v.k); try { localStorage.setItem("tg_vmvoice", v.k); } catch (e) {} playUi("click"); }}>{v[lang] || v.en}</button>
                        ))}
                      </div>
                      <button className="vmvoicetgl" onClick={() => { const v = !vmFast; setVmFast(v); vmFastRef.current = v; if (!v) vmCloudDeadRef.current = false; }}>
                        {vmFast ? `⚡ ${lc.vmFastVoice}` : `🎙️ ${lc.vmHqVoice}`}
                      </button>
                      <button className={`vmvoicetgl${vmPoly ? " on" : ""}`} title={lc.vmPolyHint} onClick={vmTogglePoly}>
                        {vmPoly ? lc.vmPolyOn : lc.vmPolyOff}
                      </button>
                    </div>
                  )}
                  <button className="vmmore" aria-label={lc.vmSettings} title={lc.vmSettings} aria-expanded={vmMenuOpen}
                    onClick={() => { playUi("click"); setVmMenuOpen(o => !o); }}>⋯</button>
                </div>
                <form className="vmtextrow" onSubmit={(e) => {
                  e.preventDefault();
                  const t = vmInput.trim(); if (!t) return;
                  setVmInput("");
                  vmEarResetRef.current(); // typed message supersedes whatever the ear half-heard (ear stays hot)
                  if (!vmActiveRef.current) { vmActiveRef.current = true; getAC(); }
                  vmProcess(t);
                }}>
                  <input className="vmtextin" value={vmInput} onChange={(e) => setVmInput(e.target.value)} placeholder={lc.vmTypePh} aria-label={lc.vmTypePh} />
                  <button className="vmtextsend" type="submit" aria-label="send">➤</button>
                </form>
                <div className="songsrcbar">{lc.vmHint}</div>
                <button className={`vmbig${vmState !== "idle" && vmState !== "error" ? " stop" : ""}`} onClick={vmToggle}>
                  {vmState !== "idle" && vmState !== "error" ? `■ ${lc.vmStop}` : `● ${lc.vmStart}`}
                </button>
              </div>
            </>
          )}
        </div>
  );
}
