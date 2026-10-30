/* Google Analytics 4 for www.tigaalpha.com only (owner 2026-10-31). Consent Mode: analytics storage stays DENIED until the visitor accepts the small banner; the choice is kept in localStorage (tg_ga). No name / e-mail is ever sent. */
(function () {
  var ID = "G-5JW3ZGS88V", h = location.hostname.toLowerCase();
  if (h !== "www.tigaalpha.com" && h !== "tigaalpha.com") return;
  var ch = ""; try { ch = localStorage.getItem("tg_ga") || ""; } catch (e) {}
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("consent", "default", { analytics_storage: ch === "1" ? "granted" : "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", wait_for_update: 500 });
  var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID; document.head.appendChild(s);
  gtag("js", new Date()); gtag("config", ID, { anonymize_ip: true, allow_google_signals: false });
  if (ch) return;
  var lang = (document.documentElement.lang || "en").toLowerCase(), L = lang.indexOf("th") === 0 ? 0 : lang.indexOf("zh") === 0 ? 2 : 1;
  var T = [["เราใช้ Google Analytics นับจำนวนผู้เข้าชมเพื่อปรับปรุงเว็บไซต์ (ไม่เก็บชื่อหรืออีเมล)", "ยอมรับ", "ไม่ยอมรับ"], ["We use Google Analytics to count visits and improve the site (no names or e-mails).", "Accept", "Decline"], ["我们使用 Google Analytics 统计访问量以改进网站（不收集姓名或邮箱）。", "接受", "拒绝"]][L];
  function show() {
    var d = document.createElement("div"); d.setAttribute("data-ga-banner", "1");
    d.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:520px;margin:0 auto;background:#fff;color:#2a211b;border:1px solid #eadfd4;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:12px 14px;font:14px/1.5 system-ui,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
    var p = document.createElement("span"); p.style.flex = "1 1 220px"; p.textContent = T[0]; d.appendChild(p);
    function btn(t, ok) { var b = document.createElement("button"); b.textContent = t; b.style.cssText = "border:" + (ok ? "none" : "1px solid #d9775788") + ";background:" + (ok ? "#d97757" : "#fff") + ";color:" + (ok ? "#fff" : "#c2552d") + ";border-radius:10px;padding:8px 14px;font:700 14px system-ui,sans-serif;cursor:pointer"; b.onclick = function () { try { localStorage.setItem("tg_ga", ok ? "1" : "0"); } catch (e) {} if (ok) gtag("consent", "update", { analytics_storage: "granted" }); d.remove(); }; return b; }
    d.appendChild(btn(T[1], true)); d.appendChild(btn(T[2], false)); document.body.appendChild(d);
  }
  if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
})();
