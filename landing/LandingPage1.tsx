import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { Piano, startPianoNote, releasePianoNote } from "../music-engine";
import { logLand } from "./land-log";
import { GUEST_PROFILE_KEY, setSkipOnboard, stampLandingOrigin } from "../local-identity";
import { inAppBrowser, openInRealBrowser, PDPA_VERSION, friendlyAuthError } from "./landing-utils";
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
const FREE_ASKS = 2;

/* ── and a time limit on the whole trial ──
   Three minutes is long enough to play the keyboard, read a lesson and ask a
   real question, and short enough that the page stays a taste rather than
   becoming the product. Whichever runs out first — the questions or the
   clock — is when the account is asked for. */
const FREE_MS = 3 * 60 * 1000;

/* Landing events are logged under their own kind so they can never be mixed
   into the app's own visitor and activity numbers. Everything here is a
   guest — user_id stays null, which is what the anon insert policy allows. */
function land(what, ms) { try { logLand("land", what, ms); } catch (e) {} }

/* The Supabase client is only needed the moment somebody decides to sign up —
   never to play, never to read an answer. Loading it then (dynamic import)
   keeps it out of the bytes an ad click pays for. First caller awaits it, so
   two rapid taps share one load. */
let sbPromise = null;
function getSb() {
  if (!sbPromise) sbPromise = import("../supabase-client").then(m => m.sb);
  return sbPromise;
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));
let viewLogged = false;

/* ── Google OAuth, one function, two doors ──
   Both the sign-up card and the Model B gate offer Google, so the OAuth
   handoff lives here at module level where both can call it — two doors,
   one code path, exactly one way an account is made. */
async function startGoogleAuth() {
  setSkipOnboard();
  /* Owner request (2026-09-21): the admin console must see WHICH landing page
     (th/en/zh) each account came from. The account is born inside this OAuth
     handoff — the only door — so stamp the page's own language here, right
     before redirecting. The app consumes the stamp once at first login and
     clears it (local-identity.ts), so re-logins never overwrite the answer.
     Deliberately NOT stamped on page load: a drive-by visitor would leave a
     stamp that mislabels a later, different-language signup on this device.
     This is module-level (both doors call it), so the language comes from
     <html lang> — which this page keeps honest from the URL, its own single
     source of truth — not from any component's state. */
  const pgLang = (typeof document !== "undefined" && document.documentElement && document.documentElement.lang) || "";
  stampLandingOrigin(pgLang);
  const sb = await getSb();
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + "/" },
  });
}

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
  /* Model B gate: "play first, then ask." It drops the moment the teaser
     riff finishes — proof delivered, now the ask. The skip link underneath
     is one tap and permanent for the session; the gate never re-fires after
     it, because a gate that will not go away teaches people to leave. */
  const [gate, setGate] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);
  const gateSkipped = useRef(false);
  /* The inline nudge after the first real AI answer. The dashboard killed the
     old plan of asking after three answers: nobody was still there by the
     third — the median visit died around one. One answer received is the
     first moment the visitor has proof the thing works, so that is when the
     account gets its one quiet, dismissible mention. */
  const [nudged, setNudged] = useState(false);

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

  /* The full-screen version of the same escape, shown inside webviews above
     the sign-up card. The small header button was easy to miss; this one owns
     the whole viewport at the exact moment the visitor is trying to commit. */
  const [escapeFull, setEscapeFull] = useState(false);

  const demoRef = useRef({ stop: false, voices: [] });
  const streamRef = useRef(null);
  const bottomRef = useRef(null);
  const signupRef = useRef(null);
  const firstKey = useRef(false);
  const t0 = useRef(Date.now());
  /* Whether the hero piano has actually scrolled into view. "Played" (8%)
     was measurable but "saw it and didn't play" vs "never scrolled to it"
     was not — and that distinction decides what to fix next. */
  const heroSeen = useRef(false);
  const heroRef = useRef(null);

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

  /* hero:seen — logged once, the first time the piano actually enters the
     viewport. Pairs with "piano" (tapped) so the funnel can finally split
     "never saw it" from "saw it and walked past". */
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (heroSeen.current) return;
      for (const en of entries) {
        if (en.isIntersecting) {
          heroSeen.current = true;
          land("hero:seen");
          io.disconnect();
          break;
        }
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* The trial clock. It only RAISES a flag — the gate itself waits below for a
     moment that is not rude, because yanking the card up mid-answer would cut
     off the very thing that was about to convince them.

     And it no longer punishes the people who are doing exactly what the page
     asked: the dashboard showed the clock firing mid-conversation at 3:00
     sharp for someone actively tapping keys. Time still runs out, but genuine
     activity in the last 90s earns one 2-minute extension (twice, max) —
     enough to finish the thought, not enough to make the trial unlimited. */
  const [timeUp, setTimeUp] = useState(false);
  const lastActive = useRef(Date.now());
  const extensions = useRef(0);
  useEffect(() => {
    const bump = () => { lastActive.current = Date.now(); };
    window.addEventListener("pointerdown", bump, { passive: true });
    window.addEventListener("keydown", bump);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, []);
  useEffect(() => {
    const tm = setTimeout(() => {
      if (extensions.current < 2 && Date.now() - lastActive.current < 90000) {
        extensions.current += 1;
        land("timeup:extended");
        setTimeUp(false);
        setTimeout(() => setTimeUp(true), 2 * 60 * 1000);
      } else {
        setTimeUp(true);
      }
    }, FREE_MS);
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
    /* The chips share the free quota with typed questions. The counter says
       "2 free questions", not "2 free AI calls plus unlimited lessons" — a
       visitor who spends all of it here and then finds the typed box refuse
       them had been promised something else, and the promise is the product.
       Used chips stay tappable to replay, but a NEW chip past the quota goes
       to the sign-up card like anything else. */
    if (!used.includes(lesson.id) && asked >= FREE_ASKS) { openSignup("", "quota"); return; }
    if (!used.includes(lesson.id)) { setAsked(n => n + 1); land("q:spend"); }
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
    /* Inside a webview, the ask and the escape are THE SAME PROBLEM: Google
       will not load there, and email-only converts a fraction of the people
       Google would have. So the moment of asking is also the moment the
       way-out gets its full-screen, one-tap pitch — with the link already
       copied, so "paste it in Chrome" is two taps, not a tutorial. A real
       browser skips straight to the card; it has no such problem. */
    if (inAppBrowser()) { land("gate:inapp"); setEscapeFull(true); }
    setSignup({ q: q || "", quota: from === "quota" });
    requestAnimationFrame(() => signupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  /* ── tap-anywhere teaser ──
     The single highest-leverage number on this page is "played a key": 8%.
     Visitors from TikTok and Instagram arrive wanting to DO something, and a
     first tap anywhere is the cheapest possible yes. So the very first tap
     anywhere on the page plays a two-second riff immediately — the "wow"
     lands inside the first three seconds instead of after a scroll — and
     only the first one; after that taps go back to being taps.

     And the riff's last note is when the gate comes down. That is the whole
     "play first, then ask" model: the visitor has heard the piano answer
     them, the proof just happened, and the ask arrives at the peak instead
     of fifteen seconds into reading. The skip link on the gate keeps every
     promise honest — browsing on without an account stays possible, it just
     is no longer the road the page points down. */
  const teased = useRef(false);
  const playTeaser = useCallback(() => {
    if (teased.current) return;
    teased.current = true;
    /* ลองกดดูสิ 5 ตัวแรกของโน้ตไทยทุกคนชินหู — เร็ว พอให้เป็นคำถามว่า "เดี๋ยว
       นะ เล่นได้จริงเหรอ" แต่หยุดก่อนจบ ให้คนต้องกดเองต่อ */
    playDemo([
      { n: ["E5"], d: 170 }, { n: ["D5"], d: 170 }, { n: ["C5"], d: 170 },
      { n: ["D5"], d: 170 }, { n: ["E5"], d: 170 }, { n: ["E5"], d: 170 },
      { n: ["E5"], d: 340 },
    ], null);
  }, []);

  /* The gate rides 15 seconds BEHIND the first tap, not on it. The riff's
     job is the wow; the gate's job is the ask — and an ask that interrupts
     the riff reads as a trap. Fifteen seconds lets the visitor land, tap a
     key or two of their own, and reach the natural pause where an account
     question fits. The skip link stays, and gate && !signup keeps the gate
     from ever covering an open sign-up card. */
  useEffect(() => {
    const onFirst = () => {
      playTeaser();
      setTimeout(() => {
        if (gateSkipped.current || !teased.current) return;
        land("gate:shown");
        setGate(true);
      }, 15000);
    };
    window.addEventListener("pointerdown", onFirst, { passive: true, once: true });
    return () => window.removeEventListener("pointerdown", onFirst);
  }, [playTeaser]);

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
      /* First answer received = the moment of proof. The nudge fires once,
         only after a real answer, never over a typing indicator. */
      if (!nudged) { setNudged(true); land("nudge:shown"); }
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

      {/* ── the webview escape, full-screen ──
          Raised over everything the moment the visitor lands on the sign-up
          card inside a webview — because that is when the browser problem
          actually blocks them. One tap opens Chrome/Safari with the link
          already on the clipboard; the dismiss underneath keeps email sign-up
          available for anyone who prefers to stay. */}
      {signup && inApp && (
        <div className="lp-escfull" role="dialog" aria-modal="true" aria-label={t.openReal}>
          <div className="lp-escbox">
            <div className="lp-escmark">TIGA</div>
            <h2>{t.escTitle}</h2>
            <p>{t.escBody}</p>
            <button className="lp-btn primary" onClick={escapeBrowser}>⧉ {t.openReal}</button>
            <button className="lp-nudgedis" onClick={() => setEscapeFull(false)}>{t.escStay}</button>
          </div>
        </div>
      )}

      <h1 className="lp-h1">{t.h1a}<em>{t.h1b}</em></h1>

      {/* ── the piano comes FIRST ──
          The old order was headline → paragraph → piano, which on a phone
          meant the keyboard — the entire product — started a full screen
          down, and 92% of visitors left before reaching it. The piano is the
          pitch; it now leads and the paragraph explains right under it. */}
      <div className="lp-stage" ref={heroRef}>
        <div className={`lp-pianowrap${touched ? " played" : ""}`} data-hint={t.tapHint}>
          {nowPlaying && <div className="lp-nowplaying">{nowPlaying}</div>}
          <Piano small litSet={lit} fingerMap={fingers} onNote={onHeroNote} baseOct={4} />
        </div>
      </div>
      <p className="lp-sub">{t.sub}</p>

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

        {/* The one quiet inline ask, fired right after the first real answer
            lands — proof first, then the offer. Dismissible in one tap, never
            shown twice, and it stays out of the way of the chips below. */}
        {nudged && !signup && (
          <div className="lp-row">
            <div className="lp-av">TIGA<br />AI</div>
            <div className="lp-bub lp-nudge">
              <span>{t.nudgeLine}</span>
              <button className="lp-btn primary" onClick={() => openSignup("", "nudge")}>{t.nudgeBtn}</button>
              <button className="lp-nudgedis" onClick={() => setNudged(false)}>{t.nudgeDismiss}</button>
            </div>
          </div>
        )}

        {!typing && !signup && (
          <>
            <div className="lp-chips">
              {LESSONS.map(l => (
                <button key={l.id}
                  className={`lp-chip${used.includes(l.id) ? " used" : ""}`}
                  onClick={() => askLesson(l)}>
                  {l.chip[lang]}{used.includes(l.id) ? " ↻" : ""}
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

      {sticky && !signup && !gate && (
        <div className="lp-sticky">
          <button className="lp-btn primary" onClick={() => openSignup("", "cta")}>{t.sticky}</button>
        </div>
      )}

      {/* ── the Model B gate ──
          Not a wall over nothing: by the time this is on screen the visitor
          has already heard the piano play for them. The card below is the
          same SignupCard everywhere else on the page — one way to make an
          account, unchanged — and the skip link keeps the no-account path
          open so "play first" never turns into "forced". */}
      {gate && !signup && (
        <div className="lp-gate" role="dialog" aria-modal="true" aria-label={t.gateTitle}>
          <div className="lp-gatebox">
            <div className="lp-gatemark">TIGA</div>
            <h2>{t.gateTitle}</h2>
            <p className="lp-gatesub">{t.gateSub}</p>
            {/* The two doors the owner asked for, in tap order: Google for
                anyone with a Google account (the choice 95% of members
                make), new-member sign-up for everyone else. Both lead to
                the same auth calls; the card hand-off keeps a single code
                path for the email side. A Google failure falls back to the
                sign-up card, where friendly errors already render. */}
            <button className="lp-btn google" disabled={gateBusy}
              onClick={async () => {
                land("gate:google");
                setGateBusy(true);
                try { await startGoogleAuth(); }
                catch (e) {
                  setGate(false);
                  setSignup({ q: "", quota: false });
                  requestAnimationFrame(() => signupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
                }
              }}>
              <GoogleG /> {t.gateGoogle}
            </button>
            <div className="lp-or">{t.or}</div>
            <button className="lp-btn primary" onClick={() => { land("gate:cta"); setSignup({ q: "", quota: false }); requestAnimationFrame(() => signupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })); }}>
              {t.gateBtn}
            </button>
            <button className="lp-gateskip" onClick={() => { gateSkipped.current = true; land("gate:skip"); setGate(false); }}>{t.gateSkip}</button>
          </div>
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
      await startGoogleAuth();
    } catch (e) {
      setErr(friendlyAuthError(e && e.message));
      setBusy(false);
    }
  }

  /* LINE Login — kept but not offered on the card: the provider was never
     turned on in the Supabase dashboard, so every tap died in an error and
     the button was removed rather than broken. Needs a LINE Channel with its
     callback URL whitelisted in Supabase before the button comes back; it
     then surfaces the provider's own error via friendlyAuthError rather
     than pretending to work. */
  async function lineLogin() {
    if (busy) return;
    land("try:line");
    setBusy(true); setErr("");
    setSkipOnboard();
    try {
      const sb = await getSb();
      await sb.auth.signInWithOAuth({
        provider: "line",
        options: { redirectTo: window.location.origin + "/" },
      });
    } catch (e) {
      setErr(friendlyAuthError(e && e.message));
      setBusy(false);
    }
  }

  /* ── email, one field ──
     The old form asked for name + email + password + a PDPA tick before it
     would move, and the dashboard showed what that costs: of the 51 people
     who reached the card, 3 tapped sign-up. Every field is a leak. So the
     email form is now ONE field — signInWithOtp sends a magic link, and the
     account (name, PDPA consent, marketing choice) is finished inside the
     app's own profile screen, which already exists and already handles all
     of it. The full form stays available one tap away for people who prefer
     a password. */
  async function signupOtp(e) {
    e.preventDefault();
    if (busy) return;
    setErr(""); setDone("");
    if (!email.trim()) { setErr(t.errFields); return; }
    land("try:email-otp");
    setBusy(true);
    setSkipOnboard();
    try {
      const sb = await getSb();
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // Straight into the app once the link is tapped — the landing page
          // has done its job the moment the email leaves this screen.
          emailRedirectTo: window.location.origin + "/",
          data: { pdpa_version: PDPA_VERSION, marketing_consent: !!marketing, via: "landing-otp" },
        },
      });
      if (error) { setErr(friendlyAuthError(error.message)); return; }
      land("signup:email-otp");
      setDone(t.otpDone);
    } catch (e2) {
      setErr(friendlyAuthError(e2 && e2.message));
    } finally {
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
    setSkipOnboard();
    try {
      const sb = await getSb();
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
          {/* The offer, before the form. The trial already exists and is already
              paid for — the old card asked for an account without ever saying
              what the account was FOR, which is one reason 21 people saw this
              card and 1 tapped it. */}
          <div className="lp-trialline">{t.trialLine}</div>
          {/* Google only, for now. LINE was offered here while its provider
              was still unconfigured in Supabase, so the button's promise was
              an error screen — worse than no button. The lineLogin code is
              kept below, ready to re-add the moment the owner turns the
              provider on. */}
          <button className="lp-btn google" onClick={google} disabled={busy}>
            <GoogleG /> {inApp ? t.googleInApp : t.google}
          </button>
          <div className="lp-or">{t.or}</div>
          {/* The one-field email path is the DEFAULT — it is the lowest-
              friction way in, and inside webviews it is the only one that
              works without leaving. The full password form stays one tap
              away, in the ghost link under it. */}
          <form onSubmit={signupOtp} className="lp-otp">
            <label className="lp-field">
              <input value={email} onChange={e => setEmail(e.target.value)}
                type="email" placeholder={t.emailPh} autoComplete="email"
                inputMode="email" enterKeyHint="go" />
            </label>
            <button className="lp-btn primary" type="submit" disabled={busy}>
              {busy ? t.submitBusy : t.otpBtn}
            </button>
          </form>
          <button className="lp-btn ghost" onClick={() => setMode("email")}>{t.emailFullBtn}</button>
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

function LineMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#fff" d="M24 10.3c0-5.2-5.4-9.4-12-9.4S0 5.1 0 10.3c0 4.7 4.1 8.6 9.7 9.3.4.1.9.2 1 .5.1.3.1.8 0 1.1l-.2 1c0 .3-.2 1.1 1 .6 1.2-.5 6.3-3.7 8.6-6.3h-.1c1.6-1.7 3-3.7 3-6.2zM8.1 13.6H5.6a.65.65 0 0 1-.65-.65V8.2a.65.65 0 0 1 1.3 0v4.1h1.85a.65.65 0 0 1 0 1.3zm2.75-.65a.65.65 0 0 1-1.3 0V8.2a.65.65 0 0 1 1.3 0v4.75zm6.05 0a.65.65 0 0 1-1.17.39l-2.28-3.1v2.71a.65.65 0 0 1-1.3 0V8.2a.65.65 0 0 1 1.17-.39l2.28 3.1V8.2a.65.65 0 0 1 1.3 0v4.75z" />
    </svg>
  );
}
