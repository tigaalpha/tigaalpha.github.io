// One-shot patcher #2 (Play Along plan #7+8): 
//   a) SongPlayOverlay — analysis card buttons: "retry this song" + a
//      strategy badge when the TIGA model chose a strategy.
//   b) SongListPage — Daily Song Quest day card (hero row + countdown strip).
import { readFileSync, writeFileSync } from "node:fs";

function patch(path, [marker, insert], label) {
  let s = readFileSync(path, "utf8");
  if (s.includes(label)) { console.log(label, "— already patched"); return; }
  const at = s.indexOf(marker);
  if (at < 0) { console.error(label, "— MARKER NOT FOUND"); process.exit(1); }
  s = s.slice(0, at) + insert + s.slice(at);
  writeFileSync(path, s);
  console.log(label, "— patched OK");
}

/* a) SongPlayOverlay: analysis card CTA + strategy badge */
patch("SongPlayOverlay.tsx", [
  "                  <ol className=\"songanalysis-steps\">",
  `                  {songAnalysis.strategy && (
                    <div className="songanalysis-strat" style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, letterSpacing: 0.3 }}>
                      ✦ {lang === "th" ? "กลยุทธ์ครู TiGA" : lang === "zh" ? "TiGA老师策略" : "Teacher TiGA's strategy"}: {songAnalysis.strategy}
                    </div>
                  )}
                  <ol className="songanalysis-steps">`,
], "analysis strategy badge");

patch("SongPlayOverlay.tsx", [
  "                  </ol>\n                </>) : null}",
  `                  </ol>
                  <button className="songbtn ghost" style={{ width: "100%", marginTop: 8, fontSize: 12 }}
                    onClick={() => { setSongPhase("ready"); }}>
                    {lang === "th" ? "🔁 ฝึกท่อนนี้อีกครั้งตามคำแนะนำ" : lang === "zh" ? "🔁 按建议再练一遍" : "🔁 Practice this song again with the tip"}
                  </button>
                </>) : null}`,
], "analysis retry button");

/* b) SongListPage: Daily Song Quest card (hero row, above the filters) */
patch("App.tsx", [
  `      {/* category selector — Songs · Scales · Chords · Intervals */}
      <div className="songfilters">
        {cats.map(c => (`,
  `      {/* Daily Song Quest (Play Along plan #8): one featured song per day,
          deterministic for every device. Playing it to the finish once today
          completes the quest — bonus paid in finishSong. */}
      <DailySongQuestCard lang={lang} onPlay={onPlay} />
      {/* category selector — Songs · Scales · Chords · Intervals */}
      <div className="songfilters">
        {cats.map(c => (`,
], "daily quest card mount");

// The component itself, placed just above SongListPage
{
  let s = readFileSync("App.tsx", "utf8");
  if (!s.includes("function DailySongQuestCard")) {
    const anchor = "const SongListPage = memo(function SongListPage({";
    const at = s.indexOf(anchor);
    if (at < 0) { console.error("SongListPage anchor NOT FOUND"); process.exit(1); }
    const comp = `/* ── Daily Song Quest day card (Play Along plan #8) — hero strip on the
   song list: today's featured song (same for every device, hash-of-date
   choice), today's progress (done + stars from tg_daily_song), and a
   countdown to the next quest. One tap starts the song. ── */
function DailySongQuestCard({ lang, onPlay }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [state, setState] = useState(() => readDailySongState(new Date().toISOString().slice(0, 10)));
  const song = useMemo(() => dailySongFor(), []);
  if (!song) return null;
  const hoursLeft = 23 - new Date().getHours();
  const done = !!state.done;
  const stars = state.stars || 0;
  return (
    <button className="setlistbtn" style={{ marginBottom: 10, textAlign: "left" }}
      onClick={() => { haptic(); onPlay(song); }}>
      <span className="setlistbtn-tt">📆 {T("ภารกิจเพลงประจำวัน", "Daily Song Quest", "每日歌曲任务")} — {tr(song, lang)}</span>
      <span className="setlistbtn-sub">
        {done
          ? T("✅ สำเร็จแล้ววันนี้ — เล่นซ้ำเพื่อเก็บดาวเพิ่มได้", "✅ Done today — replay to collect more stars", "✅ 今日已完成 — 可重玩拿更多星")
          : T("เล่นให้จบ 1 รอบรับ " + DAILY_SONG_REWARD.coins + " 🪙 + " + DAILY_SONG_REWARD.exp + " EXP", "Finish it once for " + DAILY_SONG_REWARD.coins + " 🪙 + " + DAILY_SONG_REWARD.exp + " EXP", "完成一次得 " + DAILY_SONG_REWARD.coins + " 🪙 + " + DAILY_SONG_REWARD.exp + " EXP")}
        {"  ·  "}{done ? "★".repeat(stars) + "☆".repeat(Math.max(0, 3 - stars)) + "  ·  " : ""}{T("เหลืออีก ~" + hoursLeft + " ชม.", "~" + hoursLeft + "h left", "剩约" + hoursLeft + "小时")}
      </span>
    </button>
  );
}

`;
    s = s.slice(0, at) + comp + s.slice(at);
    writeFileSync("App.tsx", s);
    console.log("DailySongQuestCard component — inserted OK");
  } else console.log("DailySongQuestCard component — already present");
}

/* c) threading into SongListPage's closure scope: it uses useState/useMemo/
   haptic/tr/readDailySongState/dailySongFor/DAILY_SONG_REWARD — verify App.tsx
   actually has each in module scope (tr/haptic/useState/useMemo are globals in
   App.tsx; the daily-song helpers need importing). */
{
  let s = readFileSync("App.tsx", "utf8");
  // import the helpers from use-play-along alongside an existing App import of it
  const impAnchor = 'from "./use-play-along"';
  if (!s.includes(impAnchor)) { console.error("App.tsx does not import use-play-along — add the import"); process.exit(1); }
  if (!s.includes("dailySongFor")) {
    const lineStart = s.lastIndexOf("import ", s.indexOf(impAnchor));
    const lineEnd = s.indexOf("\n", s.indexOf(impAnchor)) + 1;
    const newLine = 'import { dailySongFor, readDailySongState, DAILY_SONG_REWARD } from "./use-play-along";\n';
    s = s.slice(0, lineEnd) + newLine + s.slice(lineEnd);
    writeFileSync("App.tsx", s);
    console.log("App.tsx daily-song import — added");
  } else console.log("App.tsx daily-song import — already present");
}
console.log("patch2 complete");
