/* OriginalContentPage — a page of its own for the pieces TiGA wrote.

   It exists because the shelf chip buried a hundred thousand pieces inside a
   filter row: you picked "Original Content" and got a flat wall of cards with
   no way in but scrolling. This page is the way in — a short set of families,
   each of which is a real property of the music rather than a label invented
   for the shelf:

     · by level      the same Level 1/2/3 the rest of the library uses, measured
                     from the written bars by scripts/build-songs.mjs, not claimed
     · by style      the mode. major and lydian sound open, minor-family modes
                     sound dark, and the rest sit between — which is a genuinely
                     different thing to practise, not a re-sort of the same list
     · by tempo      what a piece is FOR: slow enough to read the hands, or fast
                     enough to test them

   Only rows already fetched are filtered, and one more page is fetched when the
   list runs past them. The header always counts the WHOLE shelf from the
   manifest, so the number never claims to be smaller than it is — a page that
   has loaded 500 of 100,000 says 100,000, not 500.
*/
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { loadOriginalManifest, loadOriginalPage, loadOriginalSong, ORIGINAL_SHELF } from "./originals-store";
import type { OriginalMeta } from "./originals-store";

/* ── the families ────────────────────────────────────────────────────────────
   Chosen so that every piece lands in exactly one family per axis and no
   family can be empty: the modes are grouped by how they sound, not listed one
   by one, so a learner picking "Moody" gets every dark piece in the library
   rather than having to know that aeolian and phrygian are the same wish. */
type Axis = "level" | "style" | "tempo";
type Family = { code: string; icon: string; match: (r: OriginalMeta) => boolean; th: string; en: string; zh: string; blurb: string };

const AXES: { code: Axis; th: string; en: string; zh: string }[] = [
  { code: "level", th: "ระดับ", en: "Level", zh: "难度" },
  { code: "style", th: "สไตล์", en: "Style", zh: "风格" },
  { code: "tempo", th: "จังหวะ", en: "Tempo", zh: "速度" },
];

const FAMILIES: Record<Axis, Family[]> = {
  level: [
    { code: "1", icon: "🌱", match: r => r.diff === 1, th: "เริ่มต้น", en: "Starting out", zh: "入门",
      blurb: "โน้ตไม่เยอะ · เล่นช้า ๆ ให้คล่อง" },
    { code: "2", icon: "🌿", match: r => r.diff === 2, th: "กำลังมา", en: "Getting there", zh: "进阶",
      blurb: "มีทางเล่นหลายเสียง" },
    { code: "3", icon: "🌳", match: r => r.diff === 3, th: "ขั้นสูง", en: "Stretch", zh: "挑战",
      blurb: "ความเร็วขึ้น · ช่วงกระโดด" },
  ],
  style: [
    { code: "bright", icon: "☀️", match: r => r.mode === "major" || r.mode === "lydian", th: "สดใส", en: "Bright", zh: "明亮",
      blurb: "โหมด major / lydian · ฟังสบาย" },
    { code: "moody", icon: "🌙", match: r => r.mode === "minor" || r.mode === "aeolian" || r.mode === "phrygian", th: "มืดหม่น", en: "Moody", zh: "幽暗",
      blurb: "โหมด minor / aeolian / phrygian · เศร้า ๆ" },
    { code: "modal", icon: "🎭", match: r => r.mode === "dorian" || r.mode === "mixolydian" || r.mode === "locrian", th: "โหมดพิเศษ", en: "Modal", zh: "调式",
      blurb: "dorian / mixolydian / locrian · สีพิเศษ" },
  ],
  tempo: [
    { code: "slow", icon: "🐢", match: r => r.bpm < 70, th: "ช้า", en: "Slow", zh: "慢速",
      blurb: "ต่ำกว่า 70 BPM · มีเวลาคิด" },
    { code: "steady", icon: "🚶", match: r => r.bpm >= 70 && r.bpm <= 104, th: "จังหวะกลาง", en: "Steady", zh: "中速",
      blurb: "70–104 BPM · จังหวะเดิน" },
    { code: "fast", icon: "🐇", match: r => r.bpm > 104, th: "เร็ว", en: "Fast", zh: "快速",
      blurb: "สูงกว่า 104 BPM · ทดสอบมือ" },
  ],
};

const PAGE_ROWS = 500;
const SLICE0 = 60, SLICE = 120;

export default function OriginalContentPage({ lang, onBack, onPlay, level = 1, exp = 0, premium = false }) {
  const T = (th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const [manifest, setManifest] = useState<{ n: number; indexPer: number } | null>(null);
  const [rows, setRows] = useState<OriginalMeta[] | null>(null);
  const [pages, setPages] = useState(0);
  const [err, setErr] = useState(false);
  const [axis, setAxis] = useState<Axis>("style");
  const [family, setFamily] = useState("all");
  const [shown, setShown] = useState(SLICE0);
  const [busy, setBusy] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    loadOriginalManifest().then(m => {
      if (!live) return;
      if (!m || !m.n) { setErr(true); return; }
      setManifest({ n: m.n, indexPer: m.indexPer || PAGE_ROWS });
      return loadOriginalPage(0).then(r => {
        if (!live) return;
        if (!r.length) { setErr(true); return; }
        setRows(r); setPages(1);
      });
    }).catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, []);

  /* one more page when the list has run past what is in memory */
  useEffect(() => {
    if (!manifest || !rows || rows.length >= manifest.n || shown < rows.length) return;
    const per = manifest.indexPer || PAGE_ROWS;
    const next = Math.floor(rows.length / per);
    if (next <= pages - 1) return;
    let live = true;
    loadOriginalPage(next).then(r => {
      if (!live || !r.length) return;
      setRows(prev => (prev ? prev.concat(r) : r));
      setPages(p => Math.max(p, next + 1));
    }).catch(() => {});
    return () => { live = false; };
  }, [manifest, rows, pages, shown]);

  const fams = FAMILIES[axis];
  const list = useMemo(() => {
    if (!rows) return [];
    const base = rows.map(r => ({ ...r, og: true }));
    return family === "all" ? base : base.filter(fams.find(f => f.code === family)!.match);
  }, [rows, family, axis]);

  useEffect(() => { setShown(SLICE0); }, [axis, family]);
  useEffect(() => {
    if (shown >= list.length) return;
    if (typeof IntersectionObserver === "undefined") { setShown(list.length); return; }
    const el = moreRef.current; if (!el) return;
    const io = new IntersectionObserver((ents) => {
      if (ents.some(e => e.isIntersecting)) setShown(n => Math.min(list.length, n + SLICE));
    }, { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, list.length]);

  const play = useCallback((s: any) => {
    if (busy) return;
    setBusy(s.id);
    try { localStorage.setItem("tg_last_song", s.id); } catch (e) {}
    loadOriginalSong(s).then(full => { setBusy(null); if (full) onPlay(full); }).catch(() => setBusy(null));
  }, [busy, onPlay]);

  const fmtLen = (sec: number) => Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  const total = manifest ? manifest.n : 0;
  const openFam = family === "all" ? null : fams.find(f => f.code === family) || null;

  /* The same card markup the library uses, so these pieces do not look like a
     different app from the two hundred songs beside them: same icon slot, same
     star row, same level pill, same hue variable. The only differences are the
     ones that are true of this shelf — the ✨ for an original, and the clock
     read from the index rather than from notes that have not been fetched. */
  const Card = (s: any) => {
    const hue = ((s.hn || "C4").charCodeAt(0) * 7 + s.hn.length * 13) % 360;
    const loading = busy === s.id;
    return (
      <button key={s.id} className="songcard" style={{ "--sc": `hsl(${hue},70%,56%)` } as any} onClick={() => play(s)}>
        <div className="songcard-ic">{loading ? "⏳" : "✨"}</div>
        <div className="songcard-body">
          <div className="songcard-nm">{s[lang] || s.en}</div>
          <div className="songcard-meta">
            <span className="songcard-got">{"★".repeat(4 - s.diff)}{"☆".repeat(s.diff - 1)}</span>
            <span className="songcard-lv">{T("ระดับ", "Lv", "难度")} {s.diff}</span>
            {openFam && s.axis === "tempo" && <span className="songcard-og">{s.bpm} BPM</span>}
            {!openFam && <span className="dim">{fmtLen(s.len)}</span>}
          </div>
        </div>
        <div className="songcard-go">{loading ? "…" : "▶"}</div>
      </button>
    );
  };

  return (
    <div className="songpage">
      <div className="songtop">
        <button className="studioback" onClick={onBack}>‹ {T("ย้อนกลับ", "Back", "返回")}</button>
        <h1 className="songh1">✨ {T("Original Content", "Original Content", "Original Content 原创内容")}</h1>
      </div>

      <div className="songorigbar" role="status">
        {err
          ? <>{T("โหลดไม่สำเร็จ", "Could not load", "加载失败")} ·{" "}
            <button className="songbtn ghost" style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={() => { setErr(false); setRows(null); }}>{T("ลองใหม่", "Retry", "重试")}</button></>
          : !manifest
            ? T("กำลังโหลด…", "Loading…", "加载中…")
            : T(`${total.toLocaleString()} เพลง · แต่งเองทั้งหมดที่นี่ ไม่ใช่ของคนอื่น · เล่นได้ทุกคน`,
                `${total.toLocaleString()} pieces · every one written here, not someone else's · open to everyone`,
                `${total.toLocaleString()} 首 · 全部由我们原创 · 人人可弹`)}
      </div>

      {/* the three ways to file a hundred thousand pieces */}
      <div className="genrefilters">
        {AXES.map(a => (
          <button key={a.code} className={"genrechip" + (axis === a.code ? " active" : "")}
            onClick={() => { setAxis(a.code); setFamily("all"); }}>{T(a.th, a.en, a.zh)}</button>
        ))}
      </div>
      <div className="genrefilters">
        <button className={"genrechip" + (family === "all" ? " active" : "")} onClick={() => setFamily("all")}>
          {T("✨ ทั้งหมด", "✨ All", "✨ 全部")}
        </button>
        {fams.map(f => (
          <button key={f.code} className={"genrechip" + (family === f.code ? " active" : "")}
            onClick={() => setFamily(f.code)}>{f.icon} {T(f.th, f.en, f.zh)}</button>
        ))}
      </div>

      {/* No per-family total is printed here on purpose. A family count would
          have to come from reading all two hundred index pages (15 MB) before
          the page could say anything, and a number guessed from one page would
          be a lie. The honest line counts what is genuinely in memory, then
          says how much of the shelf that is. */}
      {openFam && rows && <div className="erainfo" role="note">
        <b>{openFam.icon} {T(openFam.th, openFam.en, openFam.zh)}</b> · {openFam.blurb} ·{" "}
        {lang === "th"
          ? `หมวดนี้ในหน้านี้ ${list.length.toLocaleString()} เพลง (จากที่โหลดมา ${rows.length.toLocaleString()} จากทั้งหมด ${total.toLocaleString()})`
          : lang === "zh"
            ? `本页此分类 ${list.length.toLocaleString()} 首（已加载 ${rows.length.toLocaleString()} / 共 ${total.toLocaleString()}）`
            : `${list.length.toLocaleString()} here (from ${rows.length.toLocaleString()} of ${total.toLocaleString()} loaded)`}
      </div>}

      <div className="songgrid">
        {list.slice(0, shown).map((s: any) => Card({ ...s, axis }))}
        {!list.length && rows && <div className="songempty">{T("ไม่มีเพลงในหมวดนี้", "Nothing in this family", "此分类暂无曲目")}</div>}
      </div>
      {shown < list.length && <div ref={moreRef} className="songmore" aria-hidden="true" />}
    </div>
  );
}

export { ORIGINAL_SHELF };