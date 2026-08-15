import { L } from "./i18n";
import { pushSupported } from "./shared-infra";
/* ── SfxMetronomeSettings ──
   The sound/haptics cluster from the settings panel (SFX volume/mute,
   ambient toggle, metronome toggle + BPM/tap-tempo advanced disclosure,
   push-notification toggle), extracted verbatim from PianoApp's inline JSX
   as part of the Phase 2.6 settings-panel split — no logic changes. The two
   source ranges are non-contiguous in the original (the Premium toggle and
   Parent Dashboard button sit between them and stay inline in PianoApp), so
   they're joined here as fragment siblings. pushSupported() imports directly
   from shared-infra.ts since it's a pure capability check. ── */
export function SfxMetronomeSettings({
  lang, sfxVol, setSfxVol, setSfxVolState, sfxMuted, setSfxMuted, setSfxMutedState,
  ambientOn, setAmbientOn, getAC, metroOn, setMetroOn, setAdvancedOpen, setSetAdvancedOpen,
  metroBpm, setMetroBpm, tapTempo, pushOn, togglePush,
}) {
  const lc = L[lang];
  return (
    <>
              <div className="setrow">
                <label>🔊 {lc.setVolume}</label>
                <input type="range" min="0" max="100" value={Math.round(sfxVol * 100)}
                  onChange={e => { const v = +e.target.value / 100; setSfxVol(v); setSfxVolState(v); }} />
              </div>
              <div className="setrow">
                <label>{lc.setMute}</label>
                <button className={`settoggle${sfxMuted ? " on" : ""}`} onClick={() => { const m = !sfxMuted; setSfxMuted(m); setSfxMutedState(m); }}>
                  {sfxMuted ? lc.setOn : lc.setOff}
                </button>
              </div>
              <div className="setrow">
                <label>🎶 {lc.setAmbient}</label>
                <button className={`settoggle${ambientOn ? " on" : ""}`} onClick={() => { getAC(); setAmbientOn(o => !o); }}>
                  {ambientOn ? lc.setOn : lc.setOff}
                </button>
              </div>
              <div className="setrow">
                <label>🥁 {lc.setMetro}</label>
                <button className={`settoggle${metroOn ? " on" : ""}`} onClick={() => { getAC(); setMetroOn(o => !o); }}>
                  {metroOn ? lc.setOn : lc.setOff}
                </button>
              </div>
              <button className="setbtn wide" style={{ width: "100%" }} onClick={() => setSetAdvancedOpen(o => !o)}>{setAdvancedOpen ? "▲" : "▼"} {lc.setAdvanced}</button>
              {setAdvancedOpen && (<>
                <div className="setrow">
                  <label>{lc.setBpm}: <b>{metroBpm}</b></label>
                  <input type="range" min="40" max="208" value={metroBpm} onChange={e => setMetroBpm(+e.target.value)} />
                </div>
                <div className="setrow setbtns">
                  <button className="setbtn" onClick={() => setMetroBpm(b => Math.max(40, b - 5))}>−5</button>
                  <button className="setbtn wide" onClick={tapTempo}>{lc.setTap}</button>
                  <button className="setbtn" onClick={() => setMetroBpm(b => Math.min(208, b + 5))}>+5</button>
                </div>
              </>)}
              {pushSupported() && (
                <div className="setrow">
                  <label>{lc.setPush}</label>
                  <button className={`settoggle${pushOn ? " on" : ""}`} onClick={togglePush}>
                    {pushOn ? lc.setOn : lc.setOff}
                  </button>
                </div>
              )}
    </>
  );
}
