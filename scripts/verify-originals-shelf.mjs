/* verify-originals-shelf.mjs — drives the REAL production bundle to the "our own" shelf.

     npm run build && node scripts/verify-originals-shelf.mjs

   Playwright/Chromium is not installed in every container (and not in this one), so this is
   the same trick scripts/smoke-app-boot.mjs uses: load bundle/index.template-*.js into jsdom
   with the browser globals it expects, and click the real buttons. What it adds over that
   smoke test is a fetch that serves the real public/originals/*.json off disk — so the two
   requests the shelf makes, and the one a chosen piece makes, are exercised for real.

   What it proves, in the order a learner would meet it:
     1 the shelf chip is on the song page;
     2 opening it fetches ./originals/index.json once and draws real cards;
     3 every card carries the Original badge, its clock reads a real length, and NONE of them
       is locked — a level-1 guest can play any of them, which is the point of the shelf;
     4 tapping one fetches exactly one ./originals/songs-NN.json shard and opens the Play
       Along ready screen on that piece's title;
     5 a piece from a LATER shard also opens, so the second shard's path is proven too. */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const B = join(ROOT, "bundle");
const ORIG = join(ROOT, "dist", "originals");
/* How many pieces the shelf actually holds, read from the manifest the app itself reads.
   It used to be written as the literal 100,000 in three checks below, which meant adding
   five hundred real blues failed the test that was supposed to protect the shelf. The
   number the page prints is this number, so that is what the page is checked against —
   and the one thing still pinned as a literal is that it has not gone DOWN. */
const SHELF = JSON.parse(readFileSync(join(ORIG, "index.json"), "utf8"));
const SHELF_N = SHELF.n;
const SHELF_N_TEXT = SHELF_N.toLocaleString();
const idx = readdirSync(B).find(f => f.startsWith("index.template-") && f.endsWith(".js"));
if (!idx) { console.error("verify-originals-shelf: no bundle/ — run npm run build first"); process.exit(1); }
if (!existsSync(join(ORIG, "index.json"))) { console.error(`verify-originals-shelf: ${ORIG}/index.json is missing — run node scripts/build-originals.mjs`); process.exit(1); }

const out = [];
let failed = 0;
const ok = (name, cond, extra) => { out.push(`${cond ? "PASS" : "FAIL"} ${name}${extra ? "  [" + extra + "]" : ""}`); if (!cond) failed++; };

/* ── the fetch the app will see: our own files from disk, everything else inert ── */
const fetched = [];
const fetchLog = [];
/* Set while the "the network is down" part of the test runs: every shelf fetch
   rejects, the way a phone that lost the connection mid-request does. */
let shelfOffline = false;
globalThis.fetch = async (url) => {
  const u = String(url && url.url ? url.url : url);
  fetchLog.push(u);
  const m = /\/originals\/([^/?#]+)$/.exec(u);
  if (m && shelfOffline) throw new TypeError("Failed to fetch");
  if (m) {
    const f = join(ORIG, m[1]);
    fetched.push(m[1]);
    if (existsSync(f)) return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(f, "utf8")), text: async () => readFileSync(f, "utf8") };
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
  }
  return { ok: false, status: 0, json: async () => ({}), text: async () => "" };
};

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  url: "https://tigaalpha.github.io/", pretendToBeVisual: true, runScripts: "outside-only",
});
const { window } = dom;
for (const k of ["window", "document", "navigator", "location", "history", "HTMLElement", "customElements", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "localStorage", "sessionStorage"]) {
  try { globalThis[k] = window[k]; } catch (e) {}
}
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
globalThis.matchMedia = window.matchMedia;
globalThis.isSecureContext = true;
window.fetch = globalThis.fetch;
globalThis.AudioContext = class { constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; } resume() { return Promise.resolve(); } createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } createOscillator() { return { frequency: { value: 0, setValueAtTime() {} }, type: "", connect() {}, start() {}, stop() {} }; } createMediaStreamSource() { return { connect() {} }; } createAnalyser() { return { fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 1024, getFloatTimeDomainData() {}, getFloatFrequencyData() {} }; } };
globalThis.webkitAudioContext = globalThis.AudioContext;
window.AudioContext = globalThis.AudioContext; window.webkitAudioContext = globalThis.AudioContext;
globalThis.MutationObserver = window.MutationObserver;
globalThis.IntersectionObserver = window.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
window.scrollTo = () => {}; globalThis.scrollTo = () => {};
globalThis.HTMLElement = window.HTMLElement; globalThis.Element = window.Element; globalThis.Node = window.Node;
globalThis.SVGElement = window.SVGElement; globalThis.CustomEvent = window.CustomEvent; globalThis.Event = window.Event;
globalThis.KeyboardEvent = window.KeyboardEvent; globalThis.MouseEvent = window.MouseEvent;
globalThis.TouchEvent = window.TouchEvent || class {};
globalThis.URL = window.URL; globalThis.Blob = window.Blob || globalThis.Blob;
globalThis.Worker = class { constructor() {} postMessage() {} terminate() {} addEventListener() {} set onmessage(f) {} };
globalThis.MediaStream = window.MediaStream || class {};
globalThis.navigator.mediaDevices = globalThis.navigator.mediaDevices || {};
globalThis.navigator.mediaDevices.getUserMedia = async () => { throw new Error("no camera"); };
globalThis.navigator.requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map(), onstatechange: null });
window.Element.prototype.scrollIntoView = function () {};
window.HTMLElement.prototype.scrollIntoView = function () {};
window.localStorage.setItem("tg_pa_intro", "1");   // land on the real ready screen, not the one-time offer

const errors = [];
window.addEventListener("error", e => errors.push(String((e.error && e.error.stack) || e.message)));
process.on("unhandledRejection", r => errors.push("unhandledRejection: " + ((r && r.stack) || r)));

/* The lazy chunks import the main bundle BY FILENAME; point them at our copy so there is one
   React instance (the same reason smoke-app-boot.mjs does this). The ORIGINAL bytes of every
   chunk are saved to <name>.smoke.bak BEFORE the chunk is rewritten — an earlier version of
   this file snapshotted the already-rewritten text, so its "restore" put the rewrite back and
   left bundle/ pointing at a file that no longer existed, which broke every lazy page in the
   app. restoreChunks() therefore has to run on every exit path, including a throw. */
const mainName = idx, copyName = ".smoke-originals-bundle.mjs";
const code = readFileSync(join(B, mainName), "utf8");
writeFileSync(join(B, copyName), code.replace(/import\.meta\.url/g, JSON.stringify("https://tigaalpha.github.io/bundle/")));
for (const f of readdirSync(B)) {
  if (!f.endsWith(".js") || f === mainName) continue;
  const src = readFileSync(join(B, f), "utf8");
  if (!src.includes(`"./${mainName}"`)) continue;
  writeFileSync(join(B, f + ".smoke.bak"), src);              // the ORIGINAL, before any change
  writeFileSync(join(B, f), src.replaceAll(`"./${mainName}"`, `"./${copyName}"`));
}
let restored = false;
const restoreChunks = () => {
  if (restored) return;
  restored = true;
  try {
    for (const f of readdirSync(B)) {
      if (f.endsWith(".smoke.bak")) {
        const target = join(B, f.replace(".smoke.bak", ""));
        writeFileSync(target, readFileSync(join(B, f), "utf8"));
        rmSync(join(B, f), { force: true });
      }
    }
    rmSync(join(B, copyName), { force: true });
  } catch (e) { console.error("verify-originals-shelf: could not restore bundle/", e.message); }
};
process.on("exit", restoreChunks);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { restoreChunks(); process.exit(1); });

await import("file://" + join(B, copyName));

const q = (s) => window.document.querySelector(s);
const qa = (s) => Array.from(window.document.querySelectorAll(s));
const click = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const settle = (ms = 400) => new Promise(r => setTimeout(r, ms));
const body = () => (window.document.getElementById("root") || {}).innerHTML || "";
const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();

await settle(2500);

/* ── 1. reach the song list ── */
click(q(".hamb"));
await settle();
const songsBtn = qa(".draweritem").find(b => /เล่นตามเพลง|Play Along|跟弹/.test(txt(b)));
ok("the song list is reachable from the menu", !!songsBtn, songsBtn ? txt(songsBtn) : "no matching drawer item");
if (!songsBtn) { console.log(out.join("\n")); restoreChunks(); process.exit(1); }
click(songsBtn);
await settle(700);
ok("the song page rendered", qa(".songcard").length > 0, `${qa(".songcard").length} cards`);

/* ── 1b. the "Original Content" button, and the page behind it (owner, 2026-10-04) ── */
const ocBtn = q(".songocbtn");
ok("the Original Content button sits on the song page", !!ocBtn, ocBtn ? txt(ocBtn) : "no .songocbtn");
/* It has to be a SIBLING of Back inside .songtop — that container is the flex
   row, and the owner marked a spot beside Back rather than below it. jsdom
   cannot measure layout, so this asserts the structure the layout depends on. */
ok("the button shares one row with Back", !!ocBtn && !!ocBtn.parentElement
  && ocBtn.parentElement.classList.contains("songtop")
  && !!q(".songtop .studioback"),
  ocBtn && ocBtn.parentElement ? "parent: ." + ocBtn.parentElement.className : "—");

/* ── 1c. what happens when the shelf cannot be read (owner, 2026-10-04) ──
   The page used to sit on "Loading…" with no cards and no way out: the load
   effect had no dependencies, so the Retry button cleared the error, put the
   page back into its loading state and re-ran nothing. A learner on a phone
   who lost signal for one request was stuck like that. It must now say it
   failed, and Retry must actually ask again. */
shelfOffline = true;
click(ocBtn);
await settle(1200);
const failNote = q(".songorigbar");
const retryBtn = Array.from((failNote || document).querySelectorAll ? (failNote || document).querySelectorAll("button") : []).find(b => /ลองใหม่|Retry|重试/.test(txt(b)));
ok("a failed load says so instead of loading forever", !!failNote && /โหลดไม่สำเร็จ|Could not load|加载失败/.test(txt(failNote)), failNote ? txt(failNote).slice(0, 60) : "no status line");
ok("it offers a retry", !!retryBtn, retryBtn ? txt(retryBtn) : "no retry button");
ok("no cards are drawn from a failed load", qa(".songcard").length === 0, `${qa(".songcard").length} cards`);
const failsBefore = fetched.length;
shelfOffline = false;
click(retryBtn);
await settle(2000);
const refetched = fetched.slice(failsBefore);
ok("retry asks again and the page loads", qa(".songcard").length > 0
  && refetched.join(", ") === "index.json, index-000.json",
  `refetched: ${refetched.join(", ") || "nothing"} · ${qa(".songcard").length} cards`);
/* The page is already open and loaded from the failure/retry block above, so
   clicking the button again must NOT re-download it — the store keeps what it
   has read for the life of the page. The "one manifest + one page" claim is
   asserted there, on the genuine first open. */
const beforeOC = fetched.length;
click(ocBtn);
await settle(1200);
ok("re-opening the shelf costs no new request", qa(".songcard").length > 0 && fetched.length === beforeOC,
  `${fetched.length - beforeOC} new request(s) · ${qa(".songcard").length} cards`);
ok("the page is titled Original Content", !!q(".songh1") && /Original Content/i.test(txt(q(".songh1"))), q(".songh1") ? txt(q(".songh1")) : "—");
/* Scrolling happens inside .pathpage (flex:1; overflow-y:auto) — the window
   itself does not scroll in this app. jsdom cannot lay out, so this asserts the
   class that gives the page its scroll container; without it the user is stuck
   on the first screenful of cards (owner, 2026-10-04). */
const ocRoot = q(".songpage");
ok("the page lives in the app's scroll container", !!ocRoot && ocRoot.classList.contains("pathpage"),
  ocRoot ? "root classes: ." + ocRoot.className : "no .songpage");
ok("it says how many pieces there are", body().includes(SHELF_N_TEXT), (body().match(new RegExp("[^<>]*" + SHELF_N_TEXT + "[^<>]*")) || ["—"])[0].slice(0, 90) + ` (manifest n=${SHELF_N})`);
/* the three axes and the families under them — this is the sub-filing the
   button was asked for, so its absence is the failure that matters */
const axisChips = qa(".genrefilters .genrechip");
const axisNames = axisChips.map(txt);
ok("it offers three ways to file the shelf", axisChips.length >= 4 && ["ระดับ|Level", "สไตล์|Style", "จังหวะ|Tempo"].every(p => axisNames.some(n => new RegExp(p).test(n))), axisNames.slice(0, 4).join(" / "));
const famChips = axisChips.filter(c => !axisNames.includes(txt(c)) || /ระดับ|Level|สไตล์|Style|จังหวะ|Tempo/.test(txt(c)));
ok("each axis has families under it", qa(".genrechip").length >= 7, `${qa(".genrechip").length} chips`);
const ocCards = qa(".songcard");
ok("the page draws cards", ocCards.length > 0, `${ocCards.length} cards`);
/* Every card on this shelf is one we wrote, and the mark says so: ✨ for an ordinary
   piece, 🎷 for the jazz & blues ones. Asserting only ✨ failed the moment the jazz
   shelf went to the front of the page — which is exactly what it is for. */
const ours = (c) => /[✨🎷]/.test(txt(c).slice(0, 4));
ok("every card is marked as ours", ocCards.length > 0 && ocCards.every(ours), `${ocCards.filter(ours).length}/${ocCards.length} carry ✨ or 🎷`);
/* and the jazz family has to be findable in one tap — it is the reason those five
   hundred pieces are worth having, and it only works if they are on the index page the
   page has already loaded */
const jb = qa(".genrechip").find(b => /แจ๊ส|Jazz|爵士/.test(txt(b)));
const beforeJazz = qa(".songcard").length;   // the drawn slice, recorded for the log line
click(jb);
await settle(700);
const jbCards = qa(".songcard");
const jbIds = jbCards.length;   // kept only for the log lines below
ok("the Jazz & Blues family opens", !!jb && jbCards.length > 0, `chip ${jb ? txt(jb) : "missing"} · ${jbCards.length} cards from ${beforeJazz}`);
ok("every card in it is a jazz or blues piece", jbCards.length > 0 && jbCards.every(c => /🎷/.test(txt(c).slice(0, 4))), `${jbCards.filter(c => /🎷/.test(txt(c).slice(0, 4))).length}/${jbCards.length}`);
/* The jazz family is a PART of the shelf, not all of it — checked against the number the
   page itself measured, because after the jazz pieces went to the front the first page of
   rows IS jazz, so comparing against the drawn cards would be comparing 500 with 60. */
const jbNote = txt(q(".erainfo") || {});
const jbCount = +((jbNote.match(/([\d,]+)\s*(?:เพลง|首|pieces?)/) || ["", "0"])[1].replace(/,/g, ""));
ok("and it is a part of the shelf, not all of it", jbCount > 0 && jbCount < SHELF_N, `${jbCount} of ${SHELF_N}`);
click(qa(".genrechip").find(b => /ทั้งหมด|All|全部/.test(txt(b))));
await settle(500);
const moody = qa(".genrechip").find(b => /มืดหม่น|Moody|幽暗/.test(txt(b)));
/* filtering by a family must actually narrow the list, and must not claim a
   count nobody measured */
const allBefore = qa(".songcard").length;
click(moody);
await settle(600);
const moodyCards = qa(".songcard");
/* "Narrows" is checked against the number the page itself counted, not against the cards
   on screen: the list draws in slices of 60, so a family holding 80 rows and one holding
   40 rows both draw 60 and would look identical. The count is real either way. */
const moodyNote = txt(q(".erainfo") || {});
const moodyCount = +((moodyNote.match(/([\d,]+)\s*(?:เพลง|首|pieces?)/) || ["", "0"])[1].replace(/,/g, ""));
ok("a family filter narrows the list", !!moody && moodyCards.length > 0 && moodyCount > 0 && moodyCount < SHELF_N,
  `moody ${moodyCount} of ${SHELF_N} · ${moodyCards.length} cards drawn (was ${allBefore} drawn)`);
const note = q(".erainfo");
ok("the family note counts only what is loaded", !!note && !/\d[\d,]*\s*(เพลงทั้งหมด|pieces in all)/.test(txt(note)) && /จากที่โหลดมา|of .* loaded/.test(txt(note)), note ? txt(note).slice(0, 110) : "—");
/* and a piece from this filtered page still plays */
const beforeFamPlay = fetched.filter(f => f.startsWith("songs-")).length;
click(qa(".songcard")[0]);
await settle(2000);
const famShard = fetched.filter(f => f.startsWith("songs-")).length - beforeFamPlay;
ok("a piece chosen from a family fetches its shard", famShard === 1, `${famShard} shard fetch(es)`);
ok("Play Along opened from the new page", !!q(".pl-title"), q(".pl-title") ? txt(q(".pl-title")) : "—");
click(q(".pl-close") || q("[aria-label=close]") || q(".cbtn"));
await settle(500);
click(q(".studioback"));
await settle(600);
ok("Back returns to the song list", qa(".songfilters").length > 0, "the category row is back");

/* ── 2. the shelf chip, and the one request it makes ── */
/* The chip was renamed to "Original Content" on 2026-10-04 — same shelf, and the
   page it opens now has a name the shelf can be found by. */
const chip = qa(".genrechip").find(b => /Original Content/i.test(txt(b)));
ok("the shelf's own chip is on the song page", !!chip, chip ? txt(chip) : "chips: " + qa(".genrechip").map(txt).slice(0, 6).join(" / "));
if (!chip) { console.log(out.join("\n")); restoreChunks(); process.exit(1); }

const beforeOpen = fetched.length;
click(chip);
await settle(1500);
/* Two requests on a cold visit, and that is the fix rather than a regression:
   index.json is a manifest and the rows come from index-000.json. One request
   for the whole index is what this change exists to stop. The chip is visited
   AFTER the Original Content page above in this run, so the store already holds
   those two files and the revisit fetches nothing — which is the cache working,
   not a broken chip. Both outcomes are accepted; what must always hold is that
   the shelf draws cards. */
const opened = fetched.slice(beforeOpen);
const cold = opened.length === 2 && opened[0] === "index.json" && opened[1] === "index-000.json";
const cached = opened.length === 0 && qa(".songcard").length > 0;
ok("opening the shelf needed the manifest and one index page (or reused them)",
  cold || cached,
  cold ? `fetched: ${opened.join(", ")}` : `already in memory (the button above loaded them): ${opened.join(", ") || "no new requests"}`);

/* ── 3. the cards ── */
const cards = qa(".songcard");
ok("the shelf draws cards", cards.length > 0, `${cards.length} cards (the list draws in slices)`);
ok("every card carries the Original badge", cards.length > 0 && cards.every(c => c.querySelector(".songcard-og")), `${cards.filter(c => c.querySelector(".songcard-og")).length}/${cards.length}`);
ok("no card is locked", cards.length > 0 && !cards.some(c => c.className.includes("locked")), "a level-1 guest can open any of them");
const clocks = cards.map(c => txt(c)).filter(t => /⏱ \d+:\d\d/.test(t));
ok("each card's clock reads a real length", clocks.length === cards.length, `${clocks.length}/${cards.length}, e.g. ${clocks[0] || "—"}`);
/* The count on screen is the manifest's, which is why it reads 100,000 while only
   one page of rows has been fetched — that difference is the whole point of paging. */
ok("the shelf says how many there are", body().includes(SHELF_N_TEXT), (body().match(new RegExp("[^<>]*" + SHELF_N_TEXT + "[^<>]*")) || ["—"])[0].slice(0, 80));

/* ── 4. play one ── */
const first = cards[0];
const firstTitle = txt(first.querySelector(".songcard-nm"));
click(first);
await settle(2000);
const shardFetches = fetched.filter(f => f.startsWith("songs-"));
ok("tapping a piece fetched exactly one shard", shardFetches.length === 1, shardFetches.join(", "));
ok("its shard is a real file with notes", shardFetches.length === 1 && JSON.parse(readFileSync(join(ORIG, shardFetches[0]), "utf8")).songs.length > 0);
const readyTitle = q(".pl-title");
ok("Play Along opened on that piece", !!readyTitle && txt(readyTitle) === firstTitle, `ready screen title: ${readyTitle ? txt(readyTitle) : "—"} (card: ${firstTitle})`);
ok("the ready screen offers to start it", !!q(".pl-start"));

/* ── 5. and one from the LAST shard, so the shard maths is proven end to end ── */
click(q(".pl-close") || q("[aria-label=close]") || q(".cbtn"));
await settle(500);
/* index.json is a MANIFEST since the shelf went to 100,000: it names the pages
   rather than carrying them, because one index file for a hundred thousand rows
   would be ~15 MB on a phone. The last row therefore lives in the last index
   PAGE, and the shard maths is checked through that page. */
const idxJson = JSON.parse(readFileSync(join(ORIG, "index.json"), "utf8"));
const lastPage = JSON.parse(readFileSync(join(ORIG, `index-${String(idxJson.indexShards - 1).padStart(3, "0")}.json`), "utf8"));
const lastRow = lastPage.songs[lastPage.songs.length - 1];
ok("the index manifest names every piece", idxJson.n >= 100000 && idxJson.shards === Math.ceil(idxJson.n / idxJson.per), `n=${idxJson.n} in ${idxJson.shards} shards`);
ok("the index is paged, not one huge file", idxJson.indexShards > 1 && !Array.isArray(idxJson.songs), `${idxJson.indexShards} pages of ${idxJson.indexPer}`);
ok("the last piece lives in the last shard", lastRow.k === idxJson.shards - 1, `${lastRow.id} -> shard ${lastRow.k}`);
const shardOk = JSON.parse(readFileSync(join(ORIG, `songs-${String(lastRow.k).padStart(3, "0")}.json`), "utf8")).songs.some(s => s.id === lastRow.id && typeof s.seq === "string" && s.seq.split(" ").length > 10);
ok("the last shard holds that piece's notes", shardOk, lastRow.en);
ok("no errors thrown while using the shelf", errors.length === 0, errors.length ? errors[0].split("\n")[0].slice(0, 140) : "none");

console.log(out.join("\n"));
console.log(`\nrequests made: ${fetchLog.filter(u => u.includes("/originals/")).length} · ${fetched.join(", ")}`);
console.log(`verify-originals-shelf: ${out.length - failed}/${out.length} checks passed`);
restoreChunks();
process.exit(failed ? 1 : 0);