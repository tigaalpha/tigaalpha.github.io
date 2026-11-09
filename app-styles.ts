import { useState, useEffect } from "react";

/* Starts as soon as this module is evaluated, so the chunk is in flight
   while the entry finishes parsing. The tag is the same #tg-css as before. */
const cssReady = import("./app-css").then(({ CSS }) => {
  if (typeof document === "undefined" || document.getElementById("tg-css")) return;
  const s = document.createElement("style");
  s.id = "tg-css";
  s.textContent = CSS;
  document.head.appendChild(s);
});

export function useInjectCSS() {
  const [ready, setReady] = useState(typeof document !== "undefined" && !!document.getElementById("tg-css"));
  useEffect(() => {
    let live = true;
    cssReady.then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  return ready;
}
