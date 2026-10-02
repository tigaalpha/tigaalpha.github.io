import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LandingPage1 from "./LandingPage1";
import { ErrorBoundary, logReadyMs } from "./landing-utils";
import { adoptHandoff } from "../local-identity";
import { logLand } from "./land-log";

/* Entry point for marketing landing page 1 — a separate Vite input, so this
   page ships its own small bundle instead of the app's. Nothing here imports
   App.tsx, by design: the whole point is that an ad click pays for a piano
   and a chat panel, not for the entire product. */

/* Somebody who tapped "open in your browser" inside Facebook/Instagram arrives
   here carrying their anon id (local-identity.handoffUrl). It has to be adopted
   BEFORE the page renders: the first read of the anon id fixes it for good, and
   the page logs its "view" the moment it mounts. */
const arrival = adoptHandoff();
if (arrival) {
  try { logLand("land", "escape:arrived" + (arrival.adopted ? "" : "-known") + ":" + (arrival.ua || "?")); } catch (e) {}
}

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
