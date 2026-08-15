/* ── SkinThemeSettings ──
   The color-mode (light/dark) toggle row from the settings panel, extracted
   verbatim from PianoApp's inline JSX as part of the Phase 2.6 settings-panel
   split — no logic changes. Uses raw lang ternaries (matches the source),
   not the shared lc table — this row never used it. ── */
export function SkinThemeSettings({ mode, setMode, setEquipLS, lang }) {
  return (
              <div className="setrow">
                <label>{mode === "light" ? "☀️" : "🌙"} {lang === "th" ? "โหมดสี" : lang === "zh" ? "配色模式" : "Color mode"}</label>
                <div className="setlangs" style={{ flex: "0 0 auto", width: "auto" }}>
                  <button className={`setlangbtn${mode === "dark" ? " on" : ""}`} onClick={() => { const m = "dark"; setMode(m); setEquipLS("mode", m); }}>🌙 {lang === "th" ? "มืด" : lang === "zh" ? "深色" : "Dark"}</button>
                  <button className={`setlangbtn${mode === "light" ? " on" : ""}`} onClick={() => { const m = "light"; setMode(m); setEquipLS("mode", m); }}>☀️ {lang === "th" ? "สว่าง" : lang === "zh" ? "浅色" : "Light"}</button>
                </div>
              </div>
  );
}
