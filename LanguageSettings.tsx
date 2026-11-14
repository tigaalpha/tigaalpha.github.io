import { L, FLAGS, FLAG_NAMES } from "./i18n";
import { ALL_LANGS } from "./lang-extra";
/* ── LanguageSettings ──
   The language-picker row from the settings panel, extracted verbatim from
   PianoApp's inline JSX as part of the Phase 2.6 settings-panel split — no
   logic changes. FLAGS/FLAG_NAMES import directly from i18n.ts (pure data).
   Ten languages (2026-11-13): flag + native name from LANG_META, laid out by .setlangs-all (a two-column grid that scrolls inside its own max-height, app-css.ts),
   the same pattern as the header flag menu and the Voice Tutor's: a picker must never run off a 320 px screen. ── */
export function LanguageSettings({ lang, setLang }) {
  const lc = L[lang];
  return (
              <div className="setrow col">
                <label>🌐 {lc.setLang}</label>
                <div className="setlangs setlangs-all">
                  {ALL_LANGS.map(lg => (
                    <button key={lg} className={`setlangbtn${lang === lg ? " on" : ""}`} onClick={() => setLang(lg)}>{FLAGS[lg]} {FLAG_NAMES[lg]}</button>
                  ))}
                </div>
              </div>
  );
}
