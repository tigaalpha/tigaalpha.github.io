/* After a deploy the old hashed chunks are deleted from bundle/, so a tab (or
   a cached shell) still running the previous build 404s the moment it lazily
   imports a page. The fix is simply to load the new build: reload once, and
   remember that we did so a genuinely broken chunk can't loop forever. */
const KEY = "tiga-chunk-reload";

export function isChunkLoadError(err: any): boolean {
  const msg = String((err && (err.message || err)) || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed|Unable to preload CSS/i.test(msg);
}

export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage blocked: still worth one try */ }
  location.reload();
  return true;
}

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (e: any) => { if (reloadForNewBuild()) e.preventDefault(); });
  window.addEventListener("unhandledrejection", (e: any) => { if (isChunkLoadError(e.reason)) reloadForNewBuild(); });
}
