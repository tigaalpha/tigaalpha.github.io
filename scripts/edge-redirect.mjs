// Where an http, apex, language-alias, or trailing-slash URL should go.
// Returns an absolute https://www URL, or null when the request is already canonical.
export function redirectTarget(rawUrl, host, proto) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  const h = String(host || url.host || "").split(":")[0].toLowerCase();
  const insecure = proto === "http" || url.protocol === "http:";
  const apex = h === "tigaalpha.com";
  let path = url.pathname || "/";
  const htmlSlash = path.length > 1 && path.endsWith("/") && /\.html\/$/.test(path);
  const langHome = path.match(/^\/(th|en|zh)\/?$/);
  if (!insecure && !apex && !htmlSlash && !langHome) return null;
  if (langHome) {
    const dest = langHome[1] === "en" ? "/landing-en/" : langHome[1] === "zh" ? "/landing-zh/" : "/landing/";
    return "https://www.tigaalpha.com" + dest + url.search;
  }
  if (htmlSlash) path = path.slice(0, -1);
  return "https://www.tigaalpha.com" + path + url.search;
}
