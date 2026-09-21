// One-shot patcher: UI for Play Along plan items 1/3/4/8 inside SongPlayOverlay.tsx.
// #1 Mistake Loop — heat-map drill card on the result screen.
// #3 Boss Battle — HP bar + fx flashes on the stage.
// #4 Knowledge Drops — mid-game fact toast + a "shelf" modal on the result screen.
// CSS lives in app-styles.ts (patched by patch-plan1348-css.mjs).
import { readFileSync, writeFileSync } from "node:fs";

function must(cond, msg) { if (!cond) { console.error("FAIL: " + msg); process.exit(1); } }

const B = "SongPlayOverlay.tsx";
let t = readFileSync(B, "utf8");
const orig = t;

/* ── 0) helpers FIRST (fmtTime / kShelfCount) so later checks are honest ── */
const lcAnchor = `  const lc = L[lang];`;
must(t.includes(lcAnchor), "lc anchor missing");
if (!t.includes(`const kShelfCount`)) {
  t = t.replace(lcAnchor, lcAnchor + `
  // #1: mm:ss for drill segment labels; #4: how many facts the player collected.
  const kShelfCount = Array.isArray(kShelf) ? kShelf.length : 0;
  const fmtTime = (sec) => { const s2 = Math.max(0, Math.floor(Number(sec) || 0)); return Math.floor(s2 / 60) + ":" + String(s2 % 60).padStart(2, "0"); };`);
}

/* ── 1) Boss HP bar + fx flash + knowledge toast on the stage ── */
const stageAnchor = `              {songAnnounce && <div className="songannounce" key={songAnnounce.id}>{songAnnounce.text}</div>}`;
must(t.includes(stageAnchor), "stage anchor missing");
if (!t.includes("bosshud-track")) {
  t = t.replace(stageAnchor, stageAnchor + `
              {/* #3 Boss Battle — HP bar (throttled reactive sync from the game loop) */}
              {bossOn && songPhase === "playing" && (() => {
                const maxHp = (typeof bossMax === "number" && bossMax > 0) ? bossMax : Math.max(1, bossHp || 1);
                return (
                  <div className="bosshud">
                    <span className="bosshud-face">{bossHp <= 0 ? "😵" : (bossFx && bossFx.kind === "attack") ? "😡" : "👾"}</span>
                    <div className="bosshud-track"><div className={"bosshud-fill" + (bossHp / maxHp < 0.3 ? " low" : "")} style={{ width: Math.max(0, (bossHp / maxHp) * 100) + "%" }} /></div>
                    <span className="bosshud-pct">{Math.max(0, Math.round((bossHp / maxHp) * 100))}%</span>
                  </div>
                );
              })()}
              {bossOn && bossFx && <div className={"bossfx " + bossFx.kind} key={bossFx.id}>
                {bossFx.kind === "hit" ? "💥" : bossFx.kind === "attack" ? "⚔️!" : "🎉"}
              </div>}
              {/* #4 Knowledge Drop — one-line fact about the note just landed */}
              {kDrop && <div className="kdrop" key={kDrop.id}>
                <span className="kdrop-badge">💡</span>
                <span className="kdrop-text">{kDrop.text}</span>
              </div>}`);
}

/* ── 2) Result screen: Mistake Loop drill card + knowledge shelf button ── */
const resAnchor = `              <div className="songready-btns">
                <button className="songbtn ghost" onClick={exitSong}>↩ {lc.songBackList}</button>`;
must(t.includes(resAnchor), "result anchor missing");
if (!t.includes("drillcard-title")) {
  t = t.replace(resAnchor, `              {/* #1 Mistake Loop — drill just the worst segments on a rising tempo ladder */}
              {drillPlan && drillPlan.length > 0 && (
                <div className="drillcard">
                  <div className="drillcard-title">🎯 {lang === "th" ? "ซ้อมเฉพาะท่อนที่พลาด" : lang === "zh" ? "只练错误片段" : "Drill the tricky parts"}</div>
                  {drillActive && (
                    <button className="songbtn ghost" style={{ width: "100%", marginBottom: 8, borderColor: "#f59e0b", color: "#f59e0b" }} onClick={endDrill}>
                      ⏹ {lang === "th" ? "หยุดดริล — กลับไปหน้าเริ่ม" : lang === "zh" ? "停止练习" : "Stop drill — back to start"}
                    </button>
                  )}
                  <div className="drillcard-segs">
                    {drillPlan.map((seg, i) => (
                      <button key={seg.idx} className="drillseg" onClick={() => { setSongPhase("ready"); startDrill(seg); }}
                        style={{ "--w": Math.min(100, 25 + seg.misses * 18) + "%" }}>
                        <span className="drillseg-num">#{i + 1}</span>
                        <span className="drillseg-bar" style={{ opacity: 0.35 + Math.min(0.65, seg.misses * 0.18) }} />
                        <span className="drillseg-info">{fmtTime(seg.start)}–{fmtTime(seg.end)} · ✗{seg.misses}{seg.notes.length ? " · " + seg.notes.slice(0, 3).join(" ") : ""}</span>
                      </button>
                    ))}
                  </div>
                  <div className="drillcard-hint">
                    {lang === "th"
                      ? "กดท่อนที่พลาดเพื่อวนซ้อมเฉพาะท่อนนั้น เท็มโปไล่ขึ้นเองเมื่อเล่นผ่าน (75% → 85% → 100%)"
                      : lang === "zh"
                      ? "点击错误片段循环练习，通过后速度自动提升（75% → 85% → 100%）"
                      : "Tap a segment to loop just that part — tempo climbs on each pass (75% → 85% → 100%)"}
                  </div>
                </div>
              )}
              {/* #4 Knowledge shelf — facts collected from perfect hits */}
              {(kShelfCount > 0 || kShelfOpen) && (
                <button className="songbtn ghost" style={{ width: "100%", marginTop: 8, fontSize: 12 }} onClick={openKnowledgeShelf}>
                  💡 {lang === "th" ? "ความรู้ที่เก็บได้" : lang === "zh" ? "收集到的知识" : "Knowledge collected"}{kShelfCount > 0 ? " · " + kShelfCount : ""}
                </button>
              )}
              <div className="songready-btns">
                <button className="songbtn ghost" onClick={exitSong}>↩ {lc.songBackList}</button>`);
}

/* ── 3) Knowledge shelf modal (sibling of the orientation prompt) ── */
const shelfAnchor = `          {showOrientPrompt && (`;
must(t.includes(shelfAnchor), "shelf anchor missing");
if (!t.includes("kshelf-modal")) {
  t = t.replace(shelfAnchor, `          {/* #4 Knowledge shelf modal */}
          {kShelfOpen && (
            <div className="kshelf-modal" onClick={() => setKShelfOpen(false)}>
              <div className="kshelf-card" onClick={e => e.stopPropagation()}>
                <div className="kshelf-hd">
                  <span>💡 {lang === "th" ? "ความรู้ที่เก็บได้" : lang === "zh" ? "收集到的知识" : "Knowledge collected"}</span>
                  <button className="cbtn" onClick={() => setKShelfOpen(false)}>✕</button>
                </div>
                <div className="kshelf-list">
                  {kShelf && kShelf.length ? kShelf.map((k, i) => (
                    <div key={i} className="kshelf-item">
                      <span className="kshelf-key">{k.pc}</span>
                      <span className="kshelf-txt">{lang === "th" ? (k.th || k.text) : lang === "zh" ? (k.zh || k.text) : (k.en || k.text)}</span>
                    </div>
                  )) : <div className="kshelf-empty">{lang === "th" ? "เล่นให้แม่นเพื่อเก็บการ์ดความรู้!" : lang === "zh" ? "弹得准就能收集知识卡片！" : "Nail perfect hits to collect fact cards!"}</div>}
                </div>
              </div>
            </div>
          )}

          {showOrientPrompt && (`);
}

writeFileSync(B, t);
console.log("SongPlayOverlay UI patched, delta:", t.length - orig);
