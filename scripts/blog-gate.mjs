/* blog-gate.mjs — the PREVIEW GATE of the blog pages (owner 2026-11-21; it replaces the 3-second pop-up wall, marker tg-gate:v7).
   "Readers of an article may read only 30% of it; to read the other 70% they log in or sign up (Google or e-mail), and the page says that it is free and needs no credit card."

   How it works (pure functions, no DOM, no network — scripts/build-blog-pages.mjs calls them for every article page, and scripts/smoke-blog-gate.mjs tests them):
   - The article body is a list of blocks (<p>, <h2>, <h3>, <ul>, <ol>, one per line: body() in build-blog-pages.mjs). cutPoint() picks the block boundary whose share of the article text
     (characters, so Thai / Chinese / Japanese count like the others) is closest to FREE_SHARE; the preview never ends on a heading, never is a one-liner, and an article that is too short
     (or whose first block is most of it) is not gated at all.
   - gateTail() writes the page as: preview blocks, then a block between <!--tg-cut:v1--> and <!--/tg-cut-->: a <style>, a tiny script that adds the class tg-gated to <html> when this browser
     has NO Supabase session (sb-*-auth-token in localStorage) and is not a crawler, a fade, the unlock card (#tg-unlock), and <div class="tg-locked"> holding the other blocks, the related-articles list and the
     call-to-action. Everything stays in the HTML. CSS hides .tg-locked and shows the card only under html.tg-gated, so: a member, a crawler, and a browser without JavaScript see the whole article
     (nothing is cloaked; the JSON-LD says isAccessibleForFree false with cssSelector .tg-locked, Google's way of describing a gated part), and a guest sees the preview and the card. The class is set while
     the page is still being parsed, BEFORE the locked part, so there is no flash of the full text.
   - The reader script at the end of the page (gateHtml in build-blog-pages.mjs) lifts the class when a session appears (log-in in another tab, back / forward cache), counts the card as shown when half of it
     is on screen and as tapped on a click.
   - patchArticle() brings a page that was rendered earlier (the committed blog/ pages of th / en / zh while the database is not reachable) to the same state in place: it removes an earlier cut, finds the body
     between the date line and the related list / call-to-action, and cuts it again, so the committed pages follow the generator (idempotent).
   Honest limits: this is a client-side gate. The full text is in the page source, so a reader who views the source or turns JavaScript off gets it; the aim is to persuade, not to lock. The alternative (sending
   the other 70% only after a log-in) would hide it from search engines too. */

export const FREE_SHARE = 0.30;                 // the share of an article (by characters of text) a reader without a session can read: the one number to change
const MIN_GATED_CHARS = 600;                    // an article shorter than this is not worth gating
const MIN_PREVIEW_CHARS = 120;                  // a preview must hold at least this much text (one line is no preview)
const MAX_PREVIEW_SHARE = 0.6;                  // when the only possible cut shows more than this (a first block that is most of the article), the page is left whole instead of claiming "30%"
const MIN_LOCKED_SHARE = 0.2;                   // and something worth unlocking must stay behind the cut
export const CUT_MARK = "<!--tg-cut:v1-->", CUT_END = "<!--/tg-cut-->";
export const CUT_CLOSE = "</div>" + CUT_END;
// crawlers and audit tools are never gated and never counted (the same list the reader script uses)
export const BOT_SRC = "googlebot|bingbot|baiduspider|yandex|duckduckbot|applebot|slurp|crawler|spider|lighthouse|headlesschrome|prerender|facebookexternalhit|ahrefsbot|semrushbot|gptbot|claudebot|petalbot|bytespider";
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// characters of visible text in a piece of HTML (an entity counts as one character)
export const textLen = (html) => [...String(html).replace(/<[^>]*>/g, "").replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi, "x").replace(/\s+/g, " ").trim()].length;

/* The block boundary for the preview. `blocks` are the rendered body blocks. Returns { k, pct } (k blocks are shown, pct is their real share of the text, rounded) or null when the article is left whole. */
export function cutPoint(blocks, share = FREE_SHARE) {
  const lens = blocks.map(textLen), total = lens.reduce((a, b) => a + b, 0);
  if (blocks.length < 3 || total < MIN_GATED_CHARS) return null;
  const target = share * total;
  let best = null, cum = 0;
  for (let k = 1; k <= blocks.length - 1; k++) {
    cum += lens[k - 1];
    if (/^<h[1-6][\s>]/.test(blocks[k - 1])) continue;                       // never end the preview on a heading
    if (cum < MIN_PREVIEW_CHARS) continue;                                   // a preview of one line is no preview
    const d = Math.abs(cum - target);
    if (!best || d < best.d) best = { k, d, cum };
    if (cum > target) break;                                                 // later cuts only get farther from the target
  }
  if (!best) return null;
  if (best.cum > MAX_PREVIEW_SHARE * total || total - best.cum < MIN_LOCKED_SHARE * total) return null;
  return { k: best.k, pct: Math.min(99, Math.max(1, Math.round(100 * best.cum / total))) };
}

/* Words of the unlock card, in every language of the blog. {n} is the share the reader has seen, {m} what is left. Registers follow the app (de "du", es "tú", fr "vous", hi "aap",
   ar Modern Standard with masculine imperatives); the button words are the ones the app's log-in card uses. "TIGA AI" (and a figure and its unit, in fr / de / es) carry a no-break
   space (\xa0), so a 320 px phone never splits them over two lines. "Free" and "no credit card" are the owner's words (2026-11-21); the 7-day trial line is the one of 2026-11-16. */
export const UNLOCK_T = {
  th: { kicker: "คุณอ่านบทความนี้ไปแล้ว {n}%", title: "ล็อกอินฟรีเพื่ออ่านต่ออีก {m}%", free: "ใช้ฟรี", nocard: "ไม่ต้องใช้บัตรเครดิต", try: "แล้วทดลองเรียนเปียโนฟรี 7 วันกับแอป TIGA AI ได้ทันที", google: "ล็อกอินด้วย Google", signup: "สมัครสมาชิกฟรี", login: "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" },
  en: { kicker: "You've read {n}% of this article", title: "Log in free to read the other {m}%", free: "Free to use", nocard: "No credit card needed", try: "Then try piano lessons free for 7 days in the TIGA AI app.", google: "Continue with Google", signup: "Sign up free", login: "Already a member? Log in" },
  zh: { kicker: "你已阅读本文 {n}%", title: "免费登录，阅读剩余 {m}%", free: "免费使用", nocard: "无需信用卡", try: "还可以在 TIGA AI 应用中免费试学钢琴 7 天。", google: "使用 Google 继续", signup: "免费注册", login: "已有账号？登录" },
  ja: { kicker: "この記事を{n}%読みました", title: "無料ログインで、残りの{m}%を読む", free: "無料で使えます", nocard: "クレジットカードは不要", try: "TIGA AIアプリで、ピアノのレッスンを7日間無料で体験できます。", google: "Googleで続ける", signup: "無料で会員登録", login: "アカウントをお持ちの方はログイン" },
  ko: { kicker: "이 글을 {n}% 읽었어요", title: "무료로 로그인하고 나머지 {m}% 읽기", free: "무료로 이용", nocard: "신용카드 필요 없음", try: "TIGA AI 앱에서 피아노 레슨을 7일 동안 무료로 체험해 보세요.", google: "Google로 계속하기", signup: "무료로 가입하기", login: "이미 회원이신가요? 로그인" },
  ru: { kicker: "Вы прочитали {n}% статьи", title: "Войдите бесплатно, чтобы прочитать остальные {m}%", free: "Бесплатно", nocard: "Банковская карта не нужна", try: "А ещё 7 дней бесплатно пробуйте уроки фортепиано в приложении TIGA\xa0AI.", google: "Продолжить через Google", signup: "Зарегистрироваться бесплатно", login: "Уже есть аккаунт? Войти" },
  hi: { kicker: "आप इस लेख का {n}% पढ़ चुके हैं", title: "बाकी {m}% पढ़ने के लिए मुफ़्त में लॉग इन करें", free: "मुफ़्त में इस्तेमाल करें", nocard: "क्रेडिट कार्ड की ज़रूरत नहीं", try: "फिर TIGA\xa0AI ऐप में 7 दिन तक पियानो के पाठ मुफ़्त में आज़माएँ।", google: "Google से जारी रखें", signup: "मुफ़्त में साइन अप करें", login: "पहले से सदस्य हैं? लॉग इन करें" },
  es: { kicker: "Has leído el {n}\xa0% de este artículo", title: "Inicia sesión gratis para leer el {m}\xa0% restante", free: "Gratis", nocard: "Sin tarjeta de crédito", try: "Y prueba clases de piano gratis durante 7\xa0días en la app TIGA\xa0AI.", google: "Continuar con Google", signup: "Regístrate gratis", login: "¿Ya eres miembro? Inicia\xa0sesión" },
  fr: { kicker: "Vous avez lu {n}\xa0% de cet article", title: "Connectez-vous gratuitement pour lire les {m}\xa0% restants", free: "Gratuit", nocard: "Sans carte bancaire", try: "Puis essayez gratuitement les cours de piano pendant 7\xa0jours dans l'application TIGA\xa0AI.", google: "Continuer avec Google", signup: "S'inscrire gratuitement", login: "Déjà membre\xa0? Se connecter" },
  ar: { kicker: "لقد قرأت {n}% من هذا المقال", title: "سجّل الدخول مجانًا لقراءة بقية المقال ({m}%)", free: "مجاني", nocard: "دون بطاقة ائتمان", try: "ثم جرّب دروس البيانو مجانًا لمدة 7 أيام عبر تطبيق TIGA\xa0AI.", google: "المتابعة باستخدام Google", signup: "إنشاء حساب مجاني", login: "لديك حساب بالفعل؟ تسجيل الدخول" },
  de: { kicker: "Du hast {n}\xa0% dieses Artikels gelesen", title: "Melde dich kostenlos an, um die restlichen {m}\xa0% zu lesen", free: "Kostenlos nutzbar", nocard: "Keine Kreditkarte nötig", try: "Dann probiere die Klavierstunden 7\xa0Tage kostenlos in der App TIGA\xa0AI aus.", google: "Weiter mit Google", signup: "Kostenlos registrieren", login: "Schon Mitglied? Anmelden" },
};

export const GMARK = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>`;

// The page's own colours (cream ground #faf6f1, brand orange #d97757) and fonts (inherited: the page already sets the face per language). Nothing here is visible without html.tg-gated.
const UNLOCK_CSS = `.tg-fade,.tg-unlock{display:none}
html.tg-gated .tg-locked{display:none}
html.tg-gated .tg-fade{display:block;position:relative;height:110px;margin:-110px 0 0;background:linear-gradient(rgba(250,246,241,0),#faf6f1 92%);pointer-events:none}
html.tg-gated .tg-unlock{display:block;position:relative;box-sizing:border-box;margin:0 0 34px;padding:22px 20px 14px;background:#fff;border:1px solid #eadfd4;border-radius:18px;box-shadow:0 12px 40px rgba(60,30,10,.12);text-align:center;color:#2a211b;font-size:16px;line-height:1.5}
.tg-u-bar{height:8px;max-width:260px;margin:0 auto 14px;border-radius:99px;background:#f1e6dc;overflow:hidden}.tg-u-bar i{display:block;height:100%;border-radius:99px;background:#d97757}
.tg-u-kick{margin:0 0 6px;color:#9a4424;font-size:14px;font-weight:700;line-height:1.4;text-wrap:balance}
.tg-u-title{margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:800;text-wrap:balance}
.tg-u-perks{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:0 0 16px;padding:0;list-style:none}.tg-u-perks li{position:relative;padding:6px 12px;padding-inline-start:30px;border-radius:99px;background:#fff3ec;color:#9a4424;font-size:14px;font-weight:700;line-height:1.3}
.tg-u-perks li::before{content:"✓";position:absolute;inset-inline-start:11px;top:50%;transform:translateY(-50%);font-weight:800}
.tg-u-try{margin:0 0 18px;color:#6f5f53;font-size:15px;line-height:1.55;text-wrap:balance}
.tg-unlock a.tg-u-btn{display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;width:100%;max-width:420px;min-height:50px;margin:0 auto 10px;padding:12px 14px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none}
.tg-unlock a.tg-u-google{background:#fff;color:#3c4043;border:1.5px solid #dadce0}.tg-unlock a.tg-u-signup{background:#d97757;color:#fff;border:1.5px solid #d97757}
.tg-unlock a.tg-u-login{display:block;margin:2px 0 4px;padding:8px;color:#b85a3a;font-size:15px;font-weight:700;text-decoration:none}
.tg-unlock a:focus-visible{outline:3px solid #d9775799;outline-offset:2px}
@media (max-width:380px){html.tg-gated .tg-unlock{padding:18px 14px 10px}.tg-u-title{font-size:19px}.tg-u-perks li{font-size:13px}.tg-u-try{font-size:14px}}`;
// Taller lines for the scripts that need them (Devanagari marks above and below the line, Arabic stacked vowel marks)
const UNLOCK_LANG_CSS = {
  hi: `.tg-u-title{line-height:1.5}.tg-u-kick,.tg-u-perks li{line-height:1.6}.tg-u-try{line-height:1.75}`,
  ar: `.tg-u-title{line-height:1.6}.tg-u-kick,.tg-u-perks li{line-height:1.7}.tg-u-try{line-height:1.85}`,
};
// The tiny script that decides, while the page is being parsed, whether this reader is gated: no crawler, no Supabase session in this browser
const EARLY_JS = `(function(){try{var d=document,ls=null,i,k;try{ls=window.localStorage}catch(e){}if(/${BOT_SRC}/i.test(navigator.userAgent||""))return;if(ls)for(i=0;i<ls.length;i++){k=ls.key(i);if(k&&/^sb-.*-auth-token$/.test(k)&&ls.getItem(k))return}d.documentElement.className+=" tg-gated"}catch(e){}})();`;

// `base` is the app link with the blog attribution (utm_source=blog&utm_medium=seo&utm_campaign=<slug>&lg=<lang>); the three buttons add go=google, wall=signup, wall=login to it
export function unlockHtml(lang, base, pct) {
  const T = UNLOCK_T[lang] || UNLOCK_T.en, L = (x) => esc(`${base}&${x}`);
  const fill = (s) => esc(String(s).replace("{n}", pct).replace("{m}", 100 - pct));
  return `<aside class="tg-unlock" id="tg-unlock" data-nosnippet role="region" aria-labelledby="tg-u-t"><div class="tg-u-bar" aria-hidden="true"><i style="width:${pct}%"></i></div><p class="tg-u-kick">${fill(T.kicker)}</p><p class="tg-u-title" id="tg-u-t">${fill(T.title)}</p><ul class="tg-u-perks"><li>${esc(T.free)}</li><li>${esc(T.nocard)}</li></ul><p class="tg-u-try">${esc(T.try)}</p><a class="tg-u-btn tg-u-google" data-gate="google" rel="nofollow" href="${L("go=google")}">${GMARK}${esc(T.google)}</a><a class="tg-u-btn tg-u-signup" data-gate="signup" rel="nofollow" href="${L("wall=signup")}">${esc(T.signup)}</a><a class="tg-u-login" data-gate="login" rel="nofollow" href="${L("wall=login")}">${esc(T.login)}</a></aside>`;
}
export function cutOpen(lang, base, pct) {
  return `${CUT_MARK}<style>${UNLOCK_CSS}${UNLOCK_LANG_CSS[lang] || ""}</style><script>${EARLY_JS}</script><div class="tg-fade" aria-hidden="true"></div>${unlockHtml(lang, base, pct)}<div class="tg-locked" id="tg-locked">`;
}

/* `tail` is everything of an article after the date line and the cover: the body blocks (one per line), then the related-articles list and the call-to-action when there are any.
   Returns { html, gated, pct, why }; an article that is not gated comes back unchanged. */
export function gateTail(tail, { lang, base }) {
  const m = /<nav class="rel"|<p><a class="cta"/.exec(tail);
  const bodyHtml = m ? tail.slice(0, m.index) : tail, rest = m ? tail.slice(m.index) : "";
  const blocks = bodyHtml.split("\n").filter((b) => b.trim());
  const cp = cutPoint(blocks);
  if (!cp) return { html: tail, gated: false, why: blocks.length < 3 ? "fewer than three blocks" : "too short or no usable cut" };
  return { html: blocks.slice(0, cp.k).join("\n") + "\n" + cutOpen(lang, base, cp.pct) + blocks.slice(cp.k).join("\n") + rest + CUT_CLOSE, gated: true, pct: cp.pct };
}
// the inverse: what an article looks like without any cut (used before a page is cut again)
export const ungateInner = (inner) => String(inner).replace(/<!--tg-cut:v\d+-->[\s\S]*?<div class="tg-locked"[^>]*>/, "").replace(/<\/div><!--\/tg-cut-->/, "");

/* A page rendered earlier, brought to the current state in place: { html, state: "gated" | "free" | "skipped", pct, why }. "free" = the article is too short to cut (the page is left whole). */
export function patchArticle(html, { lang, base }) {
  const a = html.indexOf("<article>"), z = html.lastIndexOf("</article>");
  if (a < 0 || z < a) return { html, state: "skipped", why: "no <article>" };
  const inner = ungateInner(html.slice(a + 9, z)), t = inner.indexOf("</time></p>");
  if (t < 0) return { html, state: "skipped", why: "no date line" };
  let s = t + "</time></p>".length;
  if (inner.startsWith("<img", s)) { const e = inner.indexOf(">", s); if (e < 0) return { html, state: "skipped", why: "unclosed cover image" }; s = e + 1; }
  const g = gateTail(inner.slice(s), { lang, base });
  return { html: html.slice(0, a + 9) + inner.slice(0, s) + g.html + html.slice(z), state: g.gated ? "gated" : "free", pct: g.pct, why: g.why };
}
