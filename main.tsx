import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./app-shell";

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
  if (!boot) return;
  boot.classList.add("gone");
  setTimeout(() => boot.remove(), 320);
}));
