/* ── art-flag.ts ──
   The robot and pet redesign (ART_V2) ships switched off while the owner
   reviews it. It is on when:
     - a build defines __ART_V2__ (the preview renders and before/after
       sheets do; the app build does not), or
     - this device once opened the app with ?art=2 — remembered in
       localStorage, so the owner can live with the new art on a real phone
       before anyone else sees it. ?art=1 turns it back off.
   Read once, at load: a drawing never changes style halfway through. */
export const ART_V2 = (typeof __ART_V2__ !== "undefined" && !!__ART_V2__) || (() => {
  try {
    const q = new URLSearchParams(location.search).get("art");
    if (q === "2") localStorage.setItem("tg_art", "2");
    else if (q === "1") localStorage.removeItem("tg_art");
    return localStorage.getItem("tg_art") === "2";
  } catch (e) { return false; }
})();
