import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./app-shell";
import { logUsage } from "./shared-infra";

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
    let net = "?";
    try { net = (navigator.connection && navigator.connection.effectiveType) || "?"; } catch (e) {}
    // kind "boot" — the admin RPCs keep it out of every dwell total on purpose,
    // because this is load time, not time spent.
    logUsage("boot", net, ms);
  });
}));
