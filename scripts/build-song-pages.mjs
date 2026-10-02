// One static, crawlable page per song in th / en / zh, a song index per language, sitemap.xml and robots.txt
// (users report 2026-10-02, platform rec #9: "1,067 songs are 1,067 pages people can search for, but the app is one
// page"). The pages carry no JavaScript: Google reads text, and the button inside is an ordinary link into the app
// (/?song=<id>) — the deep link that opens that song's ready screen.
//
//   node scripts/build-song-pages.mjs            writes songs/, sitemap.xml, robots.txt
//   SITE_URL=https://example.com node scripts/build-song-pages.mjs     for the day the site moves to its own domain
//
// Run by `npm run build`. The output is committed with the other build artifacts on main.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = (process.env.SITE_URL || "https://tigaalpha.github.io").replace(/\/+$/, "");
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);
const r = await build({ entryPoints: [path.join(ROOT, "songs-data.ts")], bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent" });
const tmp = path.join(ROOT, "node_modules/.cache", "songs-pages.mjs");
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, r.outputFiles[0].text);
const { SONGS, SONG_GENRES, SONG_TIMESIG, SONG_ERAS, CLASSICAL_IDS } = await import(pathToFileURL(tmp).href + "?t=" + Date.now());

const LANGS = ["th", "en", "zh"];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GENRE = {
  kids: { th: "เพลงเด็ก", en: "Children's songs", zh: "儿歌" }, folk: { th: "เพลงพื้นบ้าน", en: "Folk songs", zh: "民谣" },
  gospel: { th: "กอสเปล", en: "Gospel", zh: "福音歌曲" }, jazz: { th: "แจ๊ส", en: "Jazz", zh: "爵士" },
  soul: { th: "โซล", en: "Soul", zh: "灵魂乐" }, neosoul: { th: "นีโอโซล", en: "Neo-soul", zh: "新灵魂乐" },
  carol: { th: "เพลงคริสต์มาส", en: "Carols", zh: "圣诞歌曲" }, cn: { th: "เพลงจีน", en: "Chinese songs", zh: "中文歌曲" },
  other: { th: "เพลงทั่วไป", en: "Songs", zh: "歌曲" },
};
for (const e of SONG_ERAS) GENRE[e.code] = { th: e.th, en: e.en, zh: e.zh };

const notesOf = (s) => (s.seq || []).filter(x => x[0] !== "R").map(x => x[0]);
const lengthSec = (s) => { const beats = (s.seq || []).reduce((a, x) => a + (Number(x[1]) || 0), 0); return s.bpm ? Math.round(beats * 60 / s.bpm) : 0; };
const MIDI = (n) => { const m = /^([A-G])(#|b)?(\d)$/.exec(n); if (!m) return 0; const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]; return (Number(m[3]) + 1) * 12 + base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); };
const composerOf = (s) => { const m = /\(([^)]+)\)\s*$/.exec(s.en || ""); return m ? m[1] : ""; };

const songs = SONGS.filter(s => s && !s.custom && !s.drill && s.id && s.seq && s.seq.length >= 6);

const TXT = {
  th: {
    brand: "TIGA ครูเปียโน AI", home: "หน้าแรก", all: "เพลงทั้งหมด", play: "▶ เล่นเพลงนี้เลย (ไม่ต้องสมัคร)",
    title: (n) => `${n} — เล่นตามบนเปียโนออนไลน์ | TIGA`,
    desc: (n, lv, sec, notes) => notes ? `เล่น ${n} บนเปียโนออนไลน์ ระดับ ${lv} ความยาวประมาณ ${sec} วินาที โน้ตเริ่มต้น ${notes} ไม่ต้องสมัครและไม่ต้องโหลดแอป ฝึกพร้อมครู AI ได้ที่ TIGA` : `เล่น ${n} บนเปียโนออนไลน์ ระดับ ${lv} ความยาวประมาณ ${sec} วินาที ไม่ต้องสมัครและไม่ต้องโหลดแอป ฝึกพร้อมครู AI ได้ที่ TIGA`,
    facts: "ข้อมูลเพลง", level: "ระดับ", len: "ความยาว", secs: "วินาที", tempo: "จังหวะ", meter: "ห้อง", range: "ช่วงเสียง", era: "ประเภท", composer: "ผู้ประพันธ์/ที่มา", first: "โน้ตเริ่มต้น",
    how: "เล่นตามอย่างไร", howText: "กดปุ่มด้านบน TIGA จะเปิดเพลงนี้ให้เล่นตามบนคีย์บอร์ดหน้าจอ แบบโน้ตตกลงมาให้กดตามจังหวะ หรือแบบโน้ตเพลงบนบรรทัดห้าเส้น ใช้เปียโนจริงผ่านไมค์ได้ด้วย ได้ดาวตามความแม่นยำ ไม่ต้องอ่านโน้ตก็เล่นได้",
    more: "เพลงในหมวดเดียวกัน", index: "เพลงทั้งหมดใน TIGA", indexLead: (n) => `${n} เพลงให้เล่นตามบนเปียโนออนไลน์ แบ่งตามหมวดและระดับ ทุกเพลงเริ่มเล่นได้ทันที ไม่ต้องสมัคร`,
  },
  en: {
    brand: "TIGA AI piano teacher", home: "Home", all: "All songs", play: "▶ Play this song now (no sign-up)",
    title: (n) => `${n} — play along on an online piano | TIGA`,
    desc: (n, lv, sec, notes) => notes ? `Play ${n} on an online piano — level ${lv}, about ${sec} seconds, opening notes ${notes}. No sign-up and nothing to install; practise with the AI teacher at TIGA.` : `Play ${n} on an online piano — level ${lv}, about ${sec} seconds. No sign-up and nothing to install; practise with the AI teacher at TIGA.`,
    facts: "About this song", level: "Level", len: "Length", secs: "seconds", tempo: "Tempo", meter: "Time signature", range: "Range", era: "Category", composer: "Composer / source", first: "Opening notes",
    how: "How to play along", howText: "Tap the button above and TIGA opens this song for you on an on-screen keyboard — falling notes you play in time, or the notes on a staff. A real piano works through the microphone too. You earn stars for accuracy, and you do not need to read music.",
    more: "More in this category", index: "All songs on TIGA", indexLead: (n) => `${n} songs to play along to on an online piano, by category and level. Every one starts at once, no sign-up.`,
  },
  zh: {
    brand: "TIGA AI 钢琴老师", home: "首页", all: "全部曲目", play: "▶ 马上弹这首歌（无需注册）",
    title: (n) => `${n} — 在线钢琴跟弹 | TIGA`,
    desc: (n, lv, sec, notes) => notes ? `在线钢琴弹奏 ${n}：难度 ${lv}，约 ${sec} 秒，起始音符 ${notes}。无需注册、无需下载，在 TIGA 与 AI 老师一起练习。` : `在线钢琴弹奏 ${n}：难度 ${lv}，约 ${sec} 秒。无需注册、无需下载，在 TIGA 与 AI 老师一起练习。`,
    facts: "曲目信息", level: "难度", len: "时长", secs: "秒", tempo: "速度", meter: "拍号", range: "音域", era: "类别", composer: "作者 / 来源", first: "起始音符",
    how: "怎么跟弹", howText: "点上面的按钮，TIGA 会在屏幕键盘上打开这首歌——掉落的音符跟着节奏弹，或看五线谱弹。也可以用真钢琴通过麦克风弹。按准确率得星，不会识谱也能弹。",
    more: "同类曲目", index: "TIGA 全部曲目", indexLead: (n) => `${n} 首可在线钢琴跟弹的曲目，按类别和难度分类。每一首都能马上开始，无需注册。`,
  },
};

const CSS = `:root{--bg:#faf9f5;--tx:#1f1e1c;--mut:#6b6860;--acc:#d97757;--ln:#e6e2d8;--card:#fff}@media(prefers-color-scheme:dark){:root{--bg:#141413;--tx:#f1efe8;--mut:#a9a597;--ln:#2e2d2a;--card:#1d1c1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Noto Sans SC",sans-serif}
main{max-width:720px;margin:0 auto;padding:18px 16px 56px}nav{font-size:14px;color:var(--mut);margin-bottom:14px}nav a{color:var(--mut)}
h1{font-size:26px;line-height:1.3;margin:6px 0 10px;text-wrap:balance}h2{font-size:18px;margin:26px 0 8px}
.cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px 18px;border-radius:14px;background:var(--acc);color:#fff;font-weight:700;font-size:17px;text-decoration:none;margin:14px 0}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:0;padding:14px 16px;border:1px solid var(--ln);border-radius:14px;background:var(--card)}dt{color:var(--mut)}dd{margin:0;font-variant-numeric:tabular-nums}
ul{padding-left:20px}li{margin:3px 0}a{color:var(--acc)}.sub{color:var(--mut);margin:0 0 6px}`;

const URLS = [];
/* A page's file and URL is the song's id with its accents folded away ("gymnopedié" → "gymnopedie"): a sitemap wants plain ASCII in a
   URL. The id itself goes to the app untouched (?song=<id>). Two ids that fold to the same name get a number, in the order of SONGS. */
const SLUGS = new Map(), TAKEN = new Set();
const slugOf = (id) => {
  if (SLUGS.has(id)) return SLUGS.get(id);
  const base = String(id).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_") || "song";
  let slug = base, n = 2;
  while (TAKEN.has(slug)) slug = base + "-" + n++;
  TAKEN.add(slug); SLUGS.set(id, slug);
  return slug;
};
for (const s of songs) slugOf(s.id);
const pageUrl = (lang, id) => `${SITE}/songs/${lang}/${slugOf(id)}.html`;
const idxUrl = (lang) => `${SITE}/songs/${lang}/`;

function head(lang, title, desc, canonical, alts, ld) {
  const alt = alts.map(([l, u]) => `<link rel="alternate" hreflang="${l}" href="${u}">`).join("\n");
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
${alt}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og-card.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<link rel="stylesheet" href="/songs/page.css">
</head>
`;
}

fs.rmSync(path.join(ROOT, "songs"), { recursive: true, force: true });
fs.mkdirSync(path.join(ROOT, "songs"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "songs", "page.css"), CSS + "\n");   // one shared stylesheet: the browser fetches it once for 3,000 pages
let pages = 0;
const byGenre = {};
for (const s of songs) { const g = SONG_GENRES[s.id] || "other"; (byGenre[g] = byGenre[g] || []).push(s); }

for (const lang of LANGS) {
  const T = TXT[lang];
  fs.mkdirSync(path.join(ROOT, "songs", lang), { recursive: true });
  for (const s of songs) {
    const name = s[lang] || s.en;
    const notes = notesOf(s);
    // a classical piece is shown in the key the app plays it in (an excerpt, often transposed to fit the keyboard) — its note
    // names are not the score's, so they are left off its page rather than printed as if they were
    const classical = CLASSICAL_IDS.has(s.id);
    const open = classical ? "" : notes.slice(0, 8).join(" ");
    const sec = lengthSec(s);
    const midi = notes.map(MIDI).filter(Boolean);
    const lo = notes[midi.indexOf(Math.min(...midi))], hi = notes[midi.indexOf(Math.max(...midi))];
    const g = SONG_GENRES[s.id] || "other";
    const gl = (GENRE[g] || GENRE.other)[lang];
    const comp = composerOf(s);
    const canon = pageUrl(lang, s.id);
    const alts = LANGS.map(l => [l, pageUrl(l, s.id)]).concat([["x-default", pageUrl("en", s.id)]]);
    const same = (byGenre[g] || []).filter(x => x.id !== s.id && Math.abs((x.diff || 1) - (s.diff || 1)) <= 1).slice(0, 8);
    const ld = {
      "@context": "https://schema.org", "@type": "WebPage", name: T.title(name), description: T.desc(name, s.diff, sec, open), inLanguage: lang, url: canon,
      breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: T.home, item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: T.all, item: idxUrl(lang) },
        { "@type": "ListItem", position: 3, name, item: canon } ] },
    };
    const html = head(lang, T.title(name), T.desc(name, s.diff, sec, open), canon, alts, ld) + `<body><main>
<nav><a href="${SITE}/">${esc(T.home)}</a> › <a href="${idxUrl(lang)}">${esc(T.all)}</a> › ${esc(gl)}</nav>
<h1>${esc(name)}</h1>
<p class="sub">${esc(T.brand)}</p>
<a class="cta" href="${SITE}/?song=${encodeURIComponent(s.id)}&amp;utm_source=songpage&amp;utm_medium=organic&amp;utm_campaign=${lang}">${esc(T.play)}</a>
<h2>${esc(T.facts)}</h2>
<dl>
<dt>${esc(T.level)}</dt><dd>${s.diff || 1}</dd>
<dt>${esc(T.len)}</dt><dd>${sec} ${esc(T.secs)}</dd>
<dt>${esc(T.tempo)}</dt><dd>${s.bpm || ""} BPM</dd>
<dt>${esc(T.meter)}</dt><dd>${esc(SONG_TIMESIG[s.id] || "4/4")}</dd>
${classical ? "" : `<dt>${esc(T.range)}</dt><dd>${esc(lo || "")} – ${esc(hi || "")}</dd>\n`}<dt>${esc(T.era)}</dt><dd>${esc(gl)}</dd>${comp ? `\n<dt>${esc(T.composer)}</dt><dd>${esc(comp)}</dd>` : ""}${classical ? "" : `\n<dt>${esc(T.first)}</dt><dd>${esc(open)}</dd>`}
</dl>
<h2>${esc(T.how)}</h2>
<p>${esc(T.howText)}</p>
${same.length ? `<h2>${esc(T.more)}</h2>\n<ul>\n${same.map(x => `<li><a href="${pageUrl(lang, x.id)}">${esc(x[lang] || x.en)}</a></li>`).join("\n")}\n</ul>` : ""}
</main></body></html>
`;
    fs.writeFileSync(path.join(ROOT, "songs", lang, slugOf(s.id) + ".html"), html);
    URLS.push([canon, alts]);
    pages++;
  }
  // the index of this language: every song under its category, so a crawler can reach every page in two hops
  const order = [...SONG_ERAS.map(e => e.code), "kids", "folk", "gospel", "jazz", "soul", "neosoul", "carol", "cn", "other"].filter(c => byGenre[c]);
  const canon = idxUrl(lang);
  const alts = LANGS.map(l => [l, idxUrl(l)]).concat([["x-default", idxUrl("en")]]);
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: T.index, inLanguage: lang, url: canon };
  const body = order.map(c => `<h2>${esc((GENRE[c] || GENRE.other)[lang])} (${byGenre[c].length})</h2>\n<ul>\n${byGenre[c].map(x => `<li><a href="${pageUrl(lang, x.id)}">${esc(x[lang] || x.en)}</a></li>`).join("\n")}\n</ul>`).join("\n");
  fs.writeFileSync(path.join(ROOT, "songs", lang, "index.html"), head(lang, `${T.index} | TIGA`, T.indexLead(songs.length), canon, alts, ld) + `<body><main>
<nav><a href="${SITE}/">${esc(T.home)}</a> › ${esc(T.all)}</nav>
<h1>${esc(T.index)}</h1>
<p class="sub">${esc(T.indexLead(songs.length))}</p>
${body}
</main></body></html>
`);
  URLS.push([canon, alts]);
}

// sitemap.xml — the three landing pages, the three indexes and every song page, each with its hreflang alternates
const landing = ["landing/", "landing-en/", "landing-zh/"].map(p => `${SITE}/${p}`);
const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
for (const u of [`${SITE}/`, ...landing, `${SITE}/privacy-policy.html`]) xml.push(`<url><loc>${u}</loc></url>`);
for (const [u, alts] of URLS) xml.push(`<url><loc>${u}</loc>${alts.map(([l, h]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${h}"/>`).join("")}</url>`);
xml.push("</urlset>");
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml.join("\n") + "\n");
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /updates/\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`build-song-pages: ${songs.length} songs x 3 languages = ${pages} pages + 3 indexes, sitemap.xml (${URLS.length + 5} urls), robots.txt  (${SITE})`);
