/* Cookie choice + Google Analytics 4 for www.tigaalpha.com (Step 2.3, owner 2026-11-26). One file for the app, the landing page, the blog and every static page.
   - Consent Mode v2: analytics_storage and the three ad_* signals start DENIED until the visitor chooses (ANALYTICS_DEFAULT_GRANTED = false, the same constant as analytics.ts; flip both together).
   - The bottom bar is not a modal: it sits at the bottom edge, is at most ~25% of the screen high, and pushes the page up by its own height instead of covering it. "Settings" opens two switches
     (analytics / marketing). The choice is stored as tg_consent = {v, a, m, t} and, for older code, tg_ga ("1" | "0"); the "tg:consent" event tells analytics.ts to load the Meta / TikTok pixels (marketing only).
   - No name / e-mail is ever sent. Pixels are not in this file: analytics.ts loads them, only after marketing consent and only when VITE_META_PIXEL_ID / VITE_TIKTOK_PIXEL_ID are set. */
(function () {
  var ID = "G-5JW3ZGS88V", V = "2026-11-26", DEFAULT_A = false, h = location.hostname.toLowerCase();
  if (h !== "www.tigaalpha.com" && h !== "tigaalpha.com") return;
  var cj = null, ch = "";
  try { cj = JSON.parse(localStorage.getItem("tg_consent") || "null"); ch = localStorage.getItem("tg_ga") || ""; } catch (e) {}
  var chosen = !!(cj && typeof cj === "object" && cj.v === V);
  var A = cj && typeof cj === "object" ? cj.a === 1 : ch === "1" ? true : ch === "0" ? false : DEFAULT_A, M = cj && typeof cj === "object" ? cj.m === 1 : false;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  var inline = typeof window.gtag === "function";   // the app and the landing page carry the standard gtag snippet in their own <head>; static pages do not
  if (!inline) window.gtag = gtag;
  function sig(a, m) { return { analytics_storage: a ? "granted" : "denied", ad_storage: m ? "granted" : "denied", ad_user_data: m ? "granted" : "denied", ad_personalization: m ? "granted" : "denied" }; }
  if (!inline) {
    var d0 = sig(A, M); d0.wait_for_update = 500; gtag("consent", "default", d0);
    var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID; document.head.appendChild(s);
    gtag("js", new Date()); gtag("config", ID, { anonymize_ip: true, allow_google_signals: false });
  }
  if (chosen) return;

  var lang = (document.documentElement.lang || navigator.language || "en").toLowerCase().slice(0, 2);
  var TX = {
    th: ["เราใช้คุกกี้เพื่อวัดการใช้งานเว็บไซต์ และถ้าคุณอนุญาต เพื่อวัดผลโฆษณา (ไม่เก็บชื่อหรืออีเมล)", "ยอมรับทั้งหมด", "เฉพาะที่จำเป็น", "ตั้งค่า", "บันทึก", "วิเคราะห์การใช้งาน", "การตลาด (Meta, TikTok)", "นโยบายความเป็นส่วนตัว"],
    en: ["We use cookies to measure how the site is used and, if you allow it, how our ads perform (no names or e-mails).", "Accept all", "Necessary only", "Settings", "Save", "Analytics", "Marketing (Meta, TikTok)", "Privacy policy"],
    zh: ["我们使用 Cookie 统计网站使用情况，并在您允许时衡量广告效果（不收集姓名或邮箱）。", "全部接受", "仅必要", "设置", "保存", "使用分析", "营销 (Meta, TikTok)", "隐私政策"],
    ja: ["当サイトは利用状況の分析と、同意いただいた場合は広告効果の測定にクッキーを使用します（氏名・メールアドレスは収集しません）。", "すべて許可", "必須のみ", "設定", "保存", "利用状況の分析", "マーケティング (Meta, TikTok)", "プライバシーポリシー"],
    ko: ["사이트 이용 분석과, 동의하시는 경우 광고 성과 측정을 위해 쿠키를 사용합니다 (이름·이메일은 수집하지 않습니다).", "모두 허용", "필수만", "설정", "저장", "이용 분석", "마케팅 (Meta, TikTok)", "개인정보처리방침"],
    ru: ["Мы используем cookie для анализа посещаемости и, с вашего согласия, для оценки рекламы (имена и e-mail не собираются).", "Принять все", "Только необходимые", "Настроить", "Сохранить", "Аналитика", "Маркетинг (Meta, TikTok)", "Политика конфиденциальности"],
    hi: ["हम साइट के उपयोग का विश्लेषण करने और, आपकी अनुमति से, विज्ञापनों के परिणाम मापने के लिए कुकीज़ का उपयोग करते हैं (नाम या ईमेल एकत्र नहीं किए जाते)।", "सभी स्वीकार करें", "केवल आवश्यक", "सेटिंग्स", "सहेजें", "विश्लेषण", "मार्केटिंग (Meta, TikTok)", "गोपनीयता नीति"],
    es: ["Usamos cookies para medir el uso del sitio y, si lo permites, el rendimiento de los anuncios (sin nombres ni correos).", "Aceptar todo", "Solo las necesarias", "Ajustes", "Guardar", "Analítica", "Marketing (Meta, TikTok)", "Política de privacidad"],
    fr: ["Nous utilisons des cookies pour mesurer l’audience et, avec votre accord, l’efficacité des publicités (aucun nom ni e-mail).", "Tout accepter", "Nécessaires uniquement", "Réglages", "Enregistrer", "Mesure d’audience", "Marketing (Meta, TikTok)", "Politique de confidentialité"],
    ar: ["نستخدم ملفات تعريف الارتباط لقياس استخدام الموقع، وبموافقتك لقياس أداء الإعلانات (لا نجمع الأسماء أو البريد الإلكتروني).", "قبول الكل", "الضرورية فقط", "الإعدادات", "حفظ", "التحليلات", "التسويق (Meta, TikTok)", "سياسة الخصوصية"],
    de: ["Wir verwenden Cookies, um die Nutzung der Seite und – mit deiner Zustimmung – die Wirkung von Werbung zu messen (keine Namen oder E-Mails).", "Alle akzeptieren", "Nur notwendige", "Einstellungen", "Speichern", "Nutzungsanalyse", "Marketing (Meta, TikTok)", "Datenschutzerklärung"]
  };
  var T = TX[lang] || TX.en, rtl = lang === "ar";

  function save(a, m) {
    try { localStorage.setItem("tg_consent", JSON.stringify({ v: V, a: a ? 1 : 0, m: m ? 1 : 0, t: Date.now() })); localStorage.setItem("tg_ga", a ? "1" : "0"); } catch (e) {}
    gtag("consent", "update", sig(a, m));
    try { window.dispatchEvent(new Event("tg:consent")); } catch (e) {}
    var el = document.querySelector("[data-cookie-bar]"); if (el) el.remove();
    document.documentElement.style.removeProperty("--tg-cb-h"); if (document.body) document.body.style.paddingBottom = pad0;
  }
  var pad0 = "";
  function show() {
    pad0 = document.body.style.paddingBottom || "";
    var d = document.createElement("div"); d.setAttribute("data-cookie-bar", "1"); d.setAttribute("role", "region"); d.setAttribute("aria-label", "Cookies"); d.dir = rtl ? "rtl" : "ltr";
    d.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:1050;max-height:25vh;overflow:auto;background:#fffaf5;color:#2a211b;border-top:1px solid #eadfd4;box-shadow:0 -4px 18px rgba(0,0,0,.14);padding:8px 12px calc(8px + env(safe-area-inset-bottom));font:13px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;box-sizing:border-box";
    var row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:760px;margin:0 auto";
    var p = document.createElement("span"); p.style.cssText = "flex:1 1 240px;min-width:0"; p.textContent = T[0] + " ";
    var a = document.createElement("a"); a.href = "/privacy-policy.html"; a.target = "_blank"; a.rel = "noopener"; a.textContent = T[7]; a.style.cssText = "color:#b3471f;text-decoration:underline"; p.appendChild(a);
    row.appendChild(p);
    function btn(t, kind, fn) { var b = document.createElement("button"); b.type = "button"; b.textContent = t; b.setAttribute("data-cookie-" + kind, "1"); b.style.cssText = "min-height:36px;border-radius:9px;padding:6px 12px;font:700 13px system-ui,sans-serif;cursor:pointer;border:" + (kind === "all" ? "none" : "1px solid #d97757aa") + ";background:" + (kind === "all" ? "#d97757" : "#fff") + ";color:" + (kind === "all" ? "#fff" : "#9c3f1c"); b.onclick = fn; return b; }
    var acts = document.createElement("div"); acts.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
    var panel = document.createElement("div"); panel.style.cssText = "display:none;max-width:760px;margin:6px auto 0;gap:14px;flex-wrap:wrap;align-items:center";
    function sw(label, on, locked) { var l = document.createElement("label"); l.style.cssText = "display:flex;gap:6px;align-items:center"; var c = document.createElement("input"); c.type = "checkbox"; c.checked = on; c.disabled = !!locked; l.appendChild(c); l.appendChild(document.createTextNode(label)); l._c = c; return l; }
    var sa = sw(T[5], true, false), sm = sw(T[6], false, false); panel.appendChild(sa); panel.appendChild(sm);
    panel.appendChild(btn(T[4], "save", function () { save(sa._c.checked, sm._c.checked); }));
    acts.appendChild(btn(T[1], "all", function () { save(true, true); }));
    acts.appendChild(btn(T[2], "necessary", function () { save(false, false); }));
    acts.appendChild(btn(T[3], "settings", function () { panel.style.display = panel.style.display === "none" ? "flex" : "none"; }));
    row.appendChild(acts); d.appendChild(row); d.appendChild(panel);
    document.body.appendChild(d);
    var hh = Math.ceil(d.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--tg-cb-h", hh + "px");
    document.body.style.paddingBottom = "calc(" + (pad0 || "0px") + " + " + hh + "px)";   // push the page up; the bar never covers the Pathway or the keys
  }
  if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
})();
