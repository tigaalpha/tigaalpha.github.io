import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LandingPage1 from "./LandingPage1";
import { ErrorBoundary, logReadyMs } from "./landing-utils";

/* Entry point for marketing landing page 1 — a separate Vite input, so this
   page ships its own small bundle instead of the app's. Nothing here imports
   App.tsx, by design: the whole point is that an ad click pays for a piano
   and a chat panel, not for the entire product. */

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <LandingPage1 />
    </ErrorBoundary>
  </StrictMode>
);

logReadyMs();

requestAnimationFrame(() => requestAnimationFrame(() => {
  const boot = document.getElementById("boot");
  if (boot) {
    boot.classList.add("gone");
    setTimeout(() => boot.remove(), 320);
  }
}));
