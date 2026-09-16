/* ── scripts/landing-locales.mjs ──
   Marketing landing page 1 ships as THREE URLs so each foreign-market campaign
   can be advertised, and measured, on its own link:

     /landing/      Thai      (canonical — built by vite into landing/)
     /landing-en/   English
     /landing-zh/   Chinese

   They are the same page. This takes the ONE built HTML and rewrites only the
   parts a search result, a shared link preview and a screen reader read — the
   <html lang>, the title, the description, the Open Graph card, and the line
   under the boot logo — none of which React ever gets to touch, because they
   are read before (and sometimes instead of) the page running at all.

   Everything else, including the bundle, is shared: the variants point back at
   ../landing/bundle/, so there is one copy of the code and the three pages
   cannot drift apart. The page picks its language up from the <html lang>
   written here.

   Generating rather than hand-maintaining two more HTML files is the whole
   point: an edit to the real template reaches all three on the next build. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = "dist-landing/index.template.html";

const LOCALES = {
  en: {
    dir: "landing-en",
    title: "Try a piano lesson with an AI teacher — TIGA",
    desc: "Ask an AI piano teacher and watch it play the answer on a real keyboard — scales, chords, triads, explained and played for you. No sign-up to try.",
    ogTitle: "Try a piano lesson with an AI teacher — TIGA",
    ogDesc: "Play the keys right now, ask the AI teacher, and watch it play the answer finger by finger. No sign-up, nothing to install.",
    boot: "Getting your piano ready",
  },
  zh: {
    dir: "landing-zh",
    title: "和 AI 钢琴老师试上一课 — TIGA",
    desc: "问 AI 钢琴老师，看它在真实键盘上弹给你看——音阶、和弦、三和弦，边讲边弹。无需注册即可试用。",
    ogTitle: "和 AI 钢琴老师试上一课 — TIGA",
    ogDesc: "琴键现在就能弹，问 AI 老师，看它一个音一个音弹给你看。不用注册，不用下载。",
    boot: "正在为你准备钢琴",
  },
};

const src = readFileSync(SRC, "utf8");

// Fail loudly rather than silently shipping a Thai page on an English URL:
// every one of these must match exactly once, or the template has moved.
function swapOnce(html, find, replace, what) {
  const n = html.split(find).length - 1;
  if (n !== 1) throw new Error(`landing-locales: expected exactly 1 "${what}", found ${n}`);
  return html.replace(find, replace);
}

for (const [lang, L] of Object.entries(LOCALES)) {
  let out = src;
  out = swapOnce(out, '<html lang="th">', `<html lang="${lang}">`, "html lang");
  out = swapOnce(out, "<title>ลองเรียนเปียโนกับครู AI — TIGA</title>", `<title>${L.title}</title>`, "title");
  out = swapOnce(out,
    'content="ถามครูเปียโน AI แล้วดูมันเล่นให้ดูบนคีย์บอร์ดจริง — สเกล คอร์ด ทรัยแอด อธิบายพร้อมเล่นให้ฟัง ลองได้ทันทีไม่ต้องสมัคร"',
    `content="${L.desc}"`, "description");
  out = swapOnce(out, 'property="og:title" content="ลองเรียนเปียโนกับครู AI — TIGA"',
    `property="og:title" content="${L.ogTitle}"`, "og:title");
  out = swapOnce(out,
    'property="og:description" content="กดคีย์เล่นได้เลย ถามครู AI แล้วดูมันเล่นให้ดูทีละนิ้ว ไม่ต้องสมัคร ไม่ต้องโหลดแอป"',
    `property="og:description" content="${L.ogDesc}"`, "og:description");
  out = swapOnce(out, '<div class="say">กำลังเตรียมเปียโนให้คุณ</div>',
    `<div class="say">${L.boot}</div>`, "boot line");

  // One bundle for all three. These sit one directory across from /landing/,
  // so the same relative depth with a different folder name.
  const nested = out.replaceAll('"./bundle/', '"../landing/bundle/');
  mkdirSync(L.dir, { recursive: true });
  writeFileSync(`${L.dir}/index.html`, nested);

  // ...and a plain root-level file each, mirroring landing.html, so no URL on
  // an ad ever depends on directory-index resolution.
  writeFileSync(`${L.dir}.html`, out.replaceAll('"./bundle/', '"./landing/bundle/'));

  console.log(`landing-locales: ${L.dir}/index.html + ${L.dir}.html  (lang=${lang})`);
}
