import { L, FLAGS, FLAG_NAMES } from "./i18n";
/* ── LanguageSettings ──
   The language-picker row from the settings panel, extracted verbatim from
   PianoApp's inline JSX as part of the Phase 2.6 settings-panel split — no
   logic changes. FLAGS/FLAG_NAMES import directly from i18n.ts (pure data). ── */
export function LanguageSettings({ lang, setLang }) {
  const lc = L[lang];
  return (
              <div className="setrow col">
                <label>🌐 {lc.setLang}</label>
                <div className="setlangs">
                  {["th", "en", "zh"].map(lg => (
                    <button key={lg} className={`setlangbtn${lang === lg ? " on" : ""}`} onClick={() => setLang(lg)}>{FLAGS[lg]} {FLAG_NAMES[lg]}</button>
                  ))}
                </div>
              </div>
  );
}
