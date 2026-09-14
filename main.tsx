import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./app-shell";
import { logUsage } from "./shared-infra";

/* Was this tab ever in the background before the app finished painting?
   It matters because the boot measurement below sits inside requestAnimationFrame,
   and rAF does not fire in a background tab at all — so a tab opened behind
   another one measures "time until somebody finally looked at it" and files it
   as load time. That is not a theory: the live table holds boot samples of 14,
   18, 72 and 225 minutes, each one timestamped within seconds of a matching
   multi-hour page row from the same parked tab.
   Read at module scope, which runs long before first paint, and kept up to date
   after that. */
let everHidden = false;
try {
  everHidden = document.visibilityState === "hidden";
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") everHidden = true;
  });
} catch (e) {}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

/* Take down the boot screen from index.template.html once React has actually
   painted. requestAnimationFrame twice puts this after the first real frame,
   so the fade starts from the app being on screen rather than from render()
   merely having been called — otherwise the splash can dissolve onto a frame
   the browser has not drawn yet, which reads as a flash of white. */
requestAnimationFrame(() => requestAnimationFrame(() => {
  const boot = document.getElementById("boot");
  if (boot) {
    boot.classList.add("gone");
    setTimeout(() => boot.remove(), 320);
  }

  /* ── How long that actually took ──
     This frame is the first moment a visitor can use anything, and until now
     nothing measured the distance back to their tap. It mattered: the dwell
     clock in App.tsx starts HERE, so every second someone spent watching the
     boot screen was invisible, and a visitor who waited eight seconds and gave
     up recorded the same "left almost immediately" as one who never waited at
     all. Measured on a throttled Instagram webview this gap was 1.9s on good
     4G and 8.4s on a congested one — the single biggest thing we could not see.

     performance.now() is milliseconds since navigation start, so it covers the
     whole journey: DNS, the bundle download, parse, and React's first paint.
     effectiveType says which connection class it happened on, which is what
     turns one average into an answer about who is actually affected. */
  const ms = Math.round(performance.now());
  const later = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
  later(() => {
    // Not every sample is a load time. This code runs inside requestAnimationFrame,
    // which is suspended entirely while the tab is in the background, so a tab
    // opened behind another one — or a phone locked mid-load — reports the wait
    // for a human, not the wait for the network. Such a sample is dropped rather
    // than recorded: a wrong load time is worse than a missing one, because the
    // whole point of this number is deciding whether the app is too slow.
    // 60s is the same ceiling admin RPCs use (public.is_real_boot_ms), chosen
    // from the gap in the real data: genuine boots top out at 36.5s, the next
    // sample up is 241.6s.
    if (everHidden || !(ms >= 0) || ms >= 60000) return;
    let net = "?";
    try { net = (navigator.connection && navigator.connection.effectiveType) || "?"; } catch (e) {}
    // kind "boot" — the admin RPCs keep it out of every dwell total on purpose,
    // because this is load time, not time spent.
    logUsage("boot", net, ms);
  });
}));
