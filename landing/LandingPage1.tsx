import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { Piano, startPianoNote, releasePianoNote } from "../music-engine";
import { logUsage, GUEST_PROFILE_KEY } from "../shared-infra";
import { sb } from "../supabase-client";
import { inAppBrowser, openInRealBrowser, PDPA_VERSION, friendlyAuthError } from "../app-shell";
import { LESSONS } from "./landing-lessons";
import { C, LANGS, FLAGS, FLAG_NAMES, pickLang } from "./landing-copy";
import { askLandingAI } from "./landing-ai";
import "./landing.css";

/* ── marketing landing page 1 ──
   A page of its own, at /landing/, with its own bundle and its own stylesheet.
   Ads point here; the app at / is untouched, and so is the pathway page.

   Why it exists, in one line: 328 visitors reached the app, 105 got as far as
   the pathway screen, 2 of them touched the piano, and 0 signed up. People
   were being asked to join something they had not yet experienced.

   So the order is inverted here. The product happens FIRST — a key that
   sounds under your finger, then a real lesson with the keyboard playing
   along — and the account is asked for only once there is something to lose
   by walking away. Nothing above the sign-up card is gated, on purpose.

   Three things earn their keep on this page and nothing else does:
     1. the keyboard, playable within one tap of arriving;
     2. four questions that answer instantly AND play what they describe;
     3. one ask, placed after the value, not in front of it.  ── */

const APP_URL = "/";

/* How many real AI answers a stranger gets before being asked for an account.
   Three is enough to prove the thing works on THEIR question — which is the
   whole pitch — and the ask then arrives at the one moment it is welcome:
   mid-conversation, with more they want to say. The function enforces its own
   larger ceiling independently, so this number is the product decision, not
   the protection. */
const FREE_ASKS = 3;

/* ── and a time limit on the whole trial ──
   Three minutes is long enough to play the keyboard, read a lesson and ask a
   real question, and short enough that the page stays a taste rather than
   becoming the product. Whichever runs out first — the questions or the
   clock — is when the account is asked for. */
const FREE_MS = 3 * 60 * 1000;

/* Landing events are logged under their own kind so they can never be mixed
   into the app's own visitor and activity numbers. Everything here is a
   guest — user_id stays null, which is what the anon insert policy allows. */
function land(what, ms) { try { logUsage("land", what, ms); } catch (e) {} }

const wait = (ms) => new Promise(r => setTimeout(r, ms));
let viewLogged = false;

/* ── the language handoff into the app ──
   The app reads `lang` off the guest profile in localStorage, so writing the
   choice here means somebody who picks English arrives in an English app
   rather than being asked twice.

   Written, never read back: reading it was what let a preference set on one
   landing page override the URL of another, so the English and Chinese links
   opened in Thai. Which page you are on is decided by the page, above. */
function storeLang(lg) {
  try {
    const p = JSON.parse(localStorage.getItem(GUEST_PROFILE_KEY) || "{}") || {};
    localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify({ ...p, lang: lg }));
  } catch (e) {}
}

/* **bold** → <b>. Written for STREAMING text, so a half-typed marker at the
   very end is trimmed rather than rendered as a stray asterisk. */
function rich(text) {
  const clean = String(text || "").replace(/\*{1,2}$/, "");
  return clean.split("**").map((part, i) =>
    i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>
  );
}

/* Which of the three landing URLs this is. Each variant ships with its own
   <html lang>, so the page reads its campaign language straight out of the
   document rather than needing a separate mechanism. Read once, before the
   effect below starts writing to the same attribute. */
function presetLang() {
  try {
    const l = (document.documentElement.getAttribute("lang") || "").slice(0, 2).toLowerCase();
    if (LANGS.includes(l)) return l;
  } catch (e) {}
  return "th";
}
const PRESET = typeof document !== "undefined" ? presetLang() : "th";

export default function LandingPage1() {
  const [lang, setLang] = useState(() => pickLang(PRESET));
  const t = C[lang];

  /* keyboard */
  const [lit, setLit] = useState([]);
  const [fingers, setFingers] = useState({});
  const [nowPlaying, setNowPlaying] = useState(null);
  const [touched, setTouched] = useState(false);

  /* conversation — messages store WHICH lesson, never the rendered string, so
     switching language re-translates what is already on screen instead of
     leaving a half-Thai half-English transcript behind. `n` is how many
     characters of the answer have been revealed so far. */
  const [msgs, setMsgs] = useState([]);        // {who:"me",lessonId|raw} | {who:"tiga",lessonId,n}
  const [typing, setTyping] = useState(false);
  const [used, setUsed] = useState([]);
  const [askText, setAskText] = useState("");
  const [asking, setAsking] = useState(false);   // an AI answer is in flight
  const [asked, setAsked] = useState(0);         // how many they have spent

  /* conversion */
  const [signup, setSignup] = useState(null);  // null | { q }
  const [sticky, setSticky] = useState(false);

  /* escaping an in-app browser (Facebook / LINE / TikTok / Instagram) */
  const [inApp] = useState(() => inAppBrowser());
  const [copied, setCopied] = useState(false);
  const escapeBrowser = () => {
    land("openreal-top");
    /* Copy BEFORE trying to leave. openInRealBrowser() navigates by assigning
       location.href, so on Android the jump can win the race and the clipboard
       write never runs — leaving somebody whose intent: URL was refused with no
       link and no way out. Copying first costs nothing if the jump succeeds. */
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href).catch(() => {});
      }
    } catch (e) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 6000);
    /* Best effort only. Android takes an intent: URL naming Chrome; iOS has no
       equivalent that is allowed to work, so the copied link above is the real
       fallback there rather than a nicety. */
    openInRealBrowser();
  };

  const demoRef = useRef({ stop: false, voices: [] });
  const streamRef = useRef(null);
  const bottomRef = useRef(null);
  const signupRef = useRef(null);
  const firstKey = useRef(false);
  const t0 = useRef(Date.now());

  const lessonById = (id) => LESSONS.find(l => l.id === id);
  const msgText = (m) => {
    if (m.raw != null) return m.raw;            // what the visitor typed
    if (m.ai) return m.text || "";              // a live AI answer, streaming in
    const l = lessonById(m.lessonId);
    if (!l) return "";
    if (m.who === "me") return l.ask[lang];
    return l.answer[lang].slice(0, m.n);
  };
  const msgDone = (m) => {
    if (m.raw != null || m.who === "me") return true;
    if (m.ai) return !!m.done;
    return m.n >= (lessonById(m.lessonId)?.answer[lang].length || 0);
  };

  /* ── arrival, and how long they stayed ──
     The dwell number is the one thing a bounce cannot tell you any other way:
     an event fires when they leave, not while they are here. */
  useEffect(() => {
    // Module-level, not a ref: StrictMode mounts twice in dev and a ref is
    // recreated on the second mount, so only this survives to stop a double
    // "view" — the same guard the app's gate logging needed.
    if (!viewLogged) {
      viewLogged = true;
      land("view");
      land("page:" + PRESET);   // which of the three URLs the ad pointed at
    }
    const leave = () => {
      if (leave.done) return;
      leave.done = true;
      land("leave", Date.now() - t0.current);
    };
    const onHide = () => { if (document.visibilityState === "hidden") leave(); };
    // pagehide fires on mobile Safari's back/forward cache where unload does not
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  // Keep the document itself honest about what language it is in — screen
  // readers, translate prompts and Thai line-breaking all read this.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.htmlTitle;
  }, [lang, t.htmlTitle]);

  /* The bottom CTA is held back until the page has had a chance to be worth
     something — an answer read, or fifteen seconds of consideration. Asking
     on arrival is what the app already does, and it does not work. */
  useEffect(() => {
    const tm = setTimeout(() => setSticky(true), 15000);
    return () => clearTimeout(tm);
  }, []);

  /* The trial clock. It only RAISES a flag — the gate itself waits below for a
     moment that is not rude, because yanking the card up mid-answer would cut
     off the very thing that was about to convince them. */
  const [timeUp, setTimeUp] = useState(false);
  useEffect(() => {
    const tm = setTimeout(() => setTimeUp(true), FREE_MS);
    return () => clearTimeout(tm);
  }, []);

  useEffect(() => {
    if (!timeUp || asking || signup) return;
    land("timeup");
    setSignup({ q: "", quota: false, timeUp: true });
    requestAnimationFrame(() => signupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [timeUp, asking, signup]);

  useEffect(() => () => { demoRef.current.stop = true; clearInterval(streamRef.current); }, []);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }, []);

  function chooseLang(lg) {
    if (lg === lang) return;
    land("lang:" + lg);
    setLang(lg);
    storeLang(lg);
    // A half-streamed lesson would otherwise keep revealing at an index that
    // belongs to the old text — finish it instead, in the new language. An AI
    // answer was written in the language it was asked in and stays as it is.
    clearInterval(streamRef.current);
    setMsgs(m => m.map(x => (x.who === "tiga" && !x.ai ? { ...x, n: 1e9 } : x)));
  }

  /* ── the keyboard demo ──
     Runs beside the streaming answer, so the text and the sound arrive
     together. A second demo cancels the first rather than overlapping it. */
  const releaseAll = (run) => {
    for (const h of run.voices) { try { releasePianoNote(h, 0.2); } catch (e) {} }
    run.voices = [];
  };

  async function playDemo(steps, label) {
    demoRef.current.stop = true;
    releaseAll(demoRef.current);
    const run = { stop: false, voices: [] };
    demoRef.current = run;
    // "ลองกดดูสิ" has done its job the moment the keyboard is playing — leaving
    // it up would sit on top of the now-playing pill and read as a stuck badge.
    setTouched(true);
    setNowPlaying(label || null);
    for (const st of steps) {
      if (run.stop) break;
      releaseAll(run);
      if (st.n && st.n.length) {
        setLit(st.n);
        setFingers(st.f || {});
        if (st.say) setNowPlaying(st.say);
        for (const nt of st.n) {
          const h = startPianoNote(nt, 1);
          if (h) run.voices.push(h);
        }
      } else {
        setLit([]); setFingers({});
      }
      await wait(st.d);
    }
    releaseAll(run);
    if (!run.stop) { setLit([]); setFingers({}); setNowPlaying(null); }
  }

  /* ── asking one of the four ── */
  async function askLesson(lesson) {
    if (typing) return;
    land("q:" + lesson.id);
    setUsed(u => u.includes(lesson.id) ? u : [...u, lesson.id]);
    setMsgs(m => [...m, { who: "me", lessonId: lesson.id }]);
    setTyping(true);
    scrollDown();

    await wait(650);
    setTyping(false);
    const idx = { i: 0 };
    setMsgs(m => [...m, { who: "tiga", lessonId: lesson.id, n: 0 }]);
    scrollDown();

    playDemo(lesson.demo, lesson.demoLabel[lang]);

    /* Reveal over a fixed ~2.2s rather than at a fixed speed, so a longer
       answer is not a longer wait — the pacing should feel like the model
       thinking, never like the page being slow. */
    clearInterval(streamRef.current);
    const total = lesson.answer[lang].length;
    const per = Math.max(1, Math.ceil(total / 55));
    streamRef.current = setInterval(() => {
      idx.i += per;
      const done = idx.i >= total;
      setMsgs(m => {
        const copy = m.slice();
        for (let k = copy.length - 1; k >= 0; k--) {
          if (copy[k].who === "tiga") { copy[k] = { ...copy[k], n: idx.i }; break; }
        }
        return copy;
      });
      if (done) { clearInterval(streamRef.current); setSticky(true); }
    }, 40);
  }

  // Tapping a half-typed answer finishes it — nobody should have to wait for
  // an animation to read their own answer.
  function finishTyping() {
    clearInterval(streamRef.current);
    setMsgs(m => m.map(x => (x.who === "tiga" && !x.ai ? { ...x, n: 1e9 } : x)));
  }

  const onHeroNote = useCallback(() => {
    setTouched(true);
    if (firstKey.current) return;
    firstKey.current = true;
    land("piano");
  }, []);

  function openSignup(q, from) {
    land(from);
    setSignup({ q: q || "", quota: from === "quota" });
    requestAnimationFrame(() => signupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  /* ── the typed question goes to the real AI ──
     This is the page's actual promise. The four chips are canned lessons, and
     a stranger can tell: the moment that matters is the one where THEIR
     question — the thing they actually came wondering about — gets a real
     answer. So it does, for free, before any account is asked for.

     The sign-up card is what happens when the free run ends, or if the answer
     genuinely cannot be produced, so a failure still leads somewhere. */
  async function submitAsk(e) {
    e.preventDefault();
    const q = askText.trim();
    if (!q || asking) return;

    if (asked >= FREE_ASKS) { openSignup(q, "quota"); return; }

    land("ask");
    setAskText("");
    setAsking(true);
    setMsgs(m => [...m, { who: "me", raw: q }]);
    setTyping(true);
    scrollDown();

    // Only the last few turns, and only completed ones — enough for "and what
    // about the left hand?" to make sense, without shipping the transcript.
    const history = msgs
      .filter(m => msgDone(m))
      .slice(-4)
      .map(m => ({ role: m.who === "me" ? "user" : "assistant", content: msgText(m) }))
      .filter(m => m.content);

    let started = false;
    try {
      await askLandingAI({
        question: q,
        history,
        lang,
        onChunk: (full) => {
          if (!started) {
            started = true;
            setTyping(false);
            setMsgs(m => [...m, { who: "tiga", ai: true, text: "", done: false }]);
          }
          setMsgs(m => {
            const copy = m.slice();
            for (let k = copy.length - 1; k >= 0; k--) {
              if (copy[k].ai) { copy[k] = { ...copy[k], text: full }; break; }
            }
            return copy;
          });
        },
      });
      setAsked(n => n + 1);
      land("ai");
      setSticky(true);
    } catch (err) {
      setTyping(false);
      if (err && err.limit) {
        land("ai:limit");
        openSignup(q, "quota");
      } else {
        land("ai:fail");
        setMsgs(m => [...m, { who: "tiga", ai: true, text: t.askFailed, done: true }]);
      }
    } finally {
      setMsgs(m => m.map(x => (x.ai ? { ...x, done: true } : x)));
      setAsking(false);
      setTyping(false);
      scrollDown();
    }
  }

  const answered = msgs.some(m => m.who === "tiga");

  return (
    <div className="lp">
      <header className="lp-top">
        <span className="lp-mark">TIGA</span>
        <span className="lp-kicker">{t.kicker}</span>
        {/* The same three flags as the app's settings panel, so somebody who
            already knows the product recognises the control instantly. */}
        <nav className="lp-langs" aria-label={FLAG_NAMES[lang]}>
          {LANGS.map(lg => (
            <button key={lg}
              className={`lp-lang${lg === lang ? " on" : ""}`}
              onClick={() => chooseLang(lg)}
              aria-pressed={lg === lang}
              title={FLAG_NAMES[lg]}
              lang={lg}>
              <span aria-hidden="true">{FLAGS[lg]}</span>
              <span className="lp-sr">{FLAG_NAMES[lg]}</span>
            </button>
          ))}
        </nav>
        {/* ── the way out of an in-app browser ──
            Most of the paid traffic arrives inside Facebook's, LINE's or
            TikTok's built-in browser, where Google refuses to sign anybody in.
            The escape hatch existed already, but only on the sign-up card —
            which nobody reaches, because they leave long before that. It
            belongs here, in the first screenful, next to the flags.

            Shown to everyone rather than only to detected WebViews: detection
            is a guess (every app ships a new UA eventually), and in a real
            browser the button simply opens a normal new tab, which costs a
            visitor nothing. Detection is still used — it decides whether the
            button shouts, and whether the banner below explains why. */}
        <button type="button"
          className={`lp-openbtn${inApp ? " warn" : ""}`}
          onClick={escapeBrowser}
          title={t.openReal}>
          <span aria-hidden="true">⧉</span> {t.openTop}
        </button>
      </header>

      {inApp && <p className="lp-openwhy">⚠️ {t.openWhy}</p>}
      {copied && <p className="lp-opencopied" role="status">{t.openCopied}</p>}

      <h1 className="lp-h1">{t.h1a}<em>{t.h1b}</em></h1>
      <p className="lp-sub">{t.sub}</p>

      <div className="lp-stage">
        <div className={`lp-pianowrap${touched ? " played" : ""}`} data-hint={t.tapHint}>
          {nowPlaying && <div className="lp-nowplaying">{nowPlaying}</div>}
          <Piano small litSet={lit} fingerMap={fingers} onNote={onHeroNote} baseOct={4} />
        </div>
      </div>

      <div className="lp-chat">
        <div className="lp-row">
          <div className="lp-av">TIGA<br />AI</div>
          <div className="lp-bub">{t.greet}</div>
        </div>

        {msgs.map((m, i) => (
          <div className={`lp-row${m.who === "me" ? " me" : ""}`} key={i}>
            {m.who === "tiga" && <div className="lp-av">TIGA<br />AI</div>}
            <div className="lp-bub" onClick={msgDone(m) ? undefined : finishTyping}>
              {rich(msgText(m))}
              {!msgDone(m) && <i className="lp-caret" />}
            </div>
          </div>
        ))}

        {typing && (
          <div className="lp-row">
            <div className="lp-av">TIGA<br />AI</div>
            <div className="lp-bub lp-dots"><i /><i /><i /></div>
          </div>
        )}

        {!typing && !signup && (
          <>
            <div className="lp-chips">
              {LESSONS.map(l => (
                <button key={l.id}
                  className={`lp-chip${used.includes(l.id) ? " used" : ""}`}
                  onClick={() => askLesson(l)}>
                  {l.chip[lang]}
                </button>
              ))}
            </div>
            {!answered && <div className="lp-chiphint">{t.chipHint}</div>}
          </>
        )}

        {/* Present from the first second, not unlocked after a chip: the four
            chips are the warm-up, this is the product. */}
        {!signup && (
          <>
            <form className="lp-ask" onSubmit={submitAsk}>
              <input
                value={askText}
                onChange={e => setAskText(e.target.value)}
                placeholder={t.askPh}
                aria-label={t.askPh}
                disabled={asking}
                enterKeyHint="send" />
              <button className="lp-send" type="submit" disabled={asking || !askText.trim()}>
                {asking ? "…" : t.askBtn}
              </button>
            </form>
            <div className="lp-askfree">
              {asking ? t.askThinking : t.askFree.replace("{n}", String(Math.max(0, FREE_ASKS - asked)))}
            </div>
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {signup
        ? <div ref={signupRef}><SignupCard q={signup.q} quota={signup.quota} timeUp={signup.timeUp} t={t} /></div>
        : (
          <div className="lp-proof">
            <div><b>192</b><span>{t.proof1}</span></div>
            <div><b>AI</b><span>{t.proof2}</span></div>
            <div><b>{lang === "th" ? "ฟรี" : lang === "zh" ? "免费" : "Free"}</b><span>{t.proof3}</span></div>
          </div>
        )}

      <p className="lp-foot">
        {t.footTag}<br />
        <a href={APP_URL}>{t.enterApp}</a> · <a href="/privacy-policy.html">{t.privacy}</a>
      </p>

      {sticky && !signup && (
        <div className="lp-sticky">
          <button className="lp-btn primary" onClick={() => openSignup("", "cta")}>{t.sticky}</button>
        </div>
      )}
    </div>
  );
}

/* ── the ask ──
   Deliberately not the app's own gate screen. That one is a wall thrown up
   mid-session and reads like one; this is the end of a demo, so it names what
   they were just given and what the account adds. The auth calls themselves
   are the app's, unchanged — same PDPA consent record, same metadata, same
   friendly errors — because there must be exactly one way an account is made. */
function SignupCard({ q, quota, timeUp, t }) {
  const [inApp] = useState(() => inAppBrowser());
  const [mode, setMode] = useState(() => (inAppBrowser() ? "email" : "pick"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);       // never pre-ticked
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  async function google() {
    if (busy) return;
    land("try:google");
    setBusy(true); setErr("");
    try {
      // Back to the APP, not back to this page — the landing page has done its
      // job by the time the OAuth round trip returns.
      await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/" },
      });
    } catch (e) {
      setErr(friendlyAuthError(e && e.message));
      setBusy(false);
    }
  }

  async function signupEmail(e) {
    e.preventDefault();
    if (busy) return;
    setErr(""); setDone("");
    if (!name.trim()) { setErr(t.errName); return; }
    if (!email.trim() || !password) { setErr(t.errFields); return; }
    if (password.length < 6) { setErr(t.errShort); return; }
    if (!agree) { setErr(t.errAgree); return; }
    land("try:email");
    setBusy(true);
    try {
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { data: {
          full_name: name.trim(),
          pdpa_version: PDPA_VERSION,
          marketing_consent: !!marketing,
        } },
      });
      if (error) { setErr(friendlyAuthError(error.message)); return; }
      land("signup:email");
      if (data && data.session) { window.location.href = APP_URL; return; }
      setDone(t.done);
    } catch (e2) {
      setErr(friendlyAuthError(e2 && e2.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="lp-signup">
      <h2>{timeUp ? t.askTimeTitle : quota ? t.askQuotaTitle : q ? t.signupTitleQ : t.signupTitle}</h2>
      <p>{timeUp ? t.askTimeBody : t.signupBody}</p>

      {q && <div className="lp-q"><span>{t.qLabel}</span>{q}</div>}

      {err && <div className="lp-err">{err}</div>}
      {done && <div className="lp-ok">{done}</div>}

      {inApp && <div className="lp-inapp">{t.inApp}</div>}

      {mode === "pick" && (
        <>
          <button className="lp-btn google" onClick={google} disabled={busy}>
            <GoogleG /> {t.google}
          </button>
          <div className="lp-or">{t.or}</div>
          <button className="lp-btn ghost" onClick={() => setMode("email")}>{t.emailBtn}</button>
        </>
      )}

      {mode === "email" && (
        <form onSubmit={signupEmail}>
          <label className="lp-field">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={t.namePh} autoComplete="name" />
          </label>
          <label className="lp-field">
            <input value={email} onChange={e => setEmail(e.target.value)}
              type="email" placeholder={t.emailPh} autoComplete="email" />
          </label>
          <label className="lp-field">
            <input value={password} onChange={e => setPassword(e.target.value)}
              type="password" placeholder={t.passPh} autoComplete="new-password" />
          </label>
          <label className="lp-check">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>{t.agree} <a href="/privacy-policy.html" target="_blank" rel="noreferrer">{t.agreeLink}</a>{t.agreeTail}</span>
          </label>
          <label className="lp-check">
            <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
            <span>{t.marketing}</span>
          </label>
          <button className="lp-btn primary" type="submit" disabled={busy}>
            {busy ? t.submitBusy : t.submit}
          </button>
          {!inApp && <button className="lp-btn ghost" type="button" onClick={() => setMode("pick")}>{t.useGoogle}</button>}
          {inApp && <button className="lp-btn ghost" type="button" onClick={() => { land("openreal"); openInRealBrowser(); }}>{t.openReal}</button>}
        </form>
      )}

      <p className="lp-foot" style={{ marginTop: 14 }}>
        {t.have} <a href={APP_URL}>{t.haveLink}</a>
      </p>
    </section>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.8 2.6 13.6l7.8 6c1.9-5.7 7.2-10.1 13.6-10.1z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.2 7.1-17.6z" />
      <path fill="#FBBC05" d="M10.4 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.8-6C1 16.7 0 20.2 0 24s1 7.3 2.6 10.4l7.8-6z" />
      <path fill="#34A853" d="M24 47.5c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.7-4.4-13.6-10.1l-7.8 6C6.5 42.2 14.6 47.5 24 47.5z" />
    </svg>
  );
}
