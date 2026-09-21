// One-shot patcher #3 (Play Along plan #10): Online PvP.
//   use-play-along.ts  — pvp-online import, the realtime room hook/state block,
//                        finishSong result report, hook return extension.
//   SongPlayOverlay.tsx — destructure extension, live HUD strip, ready-screen
//                        room panel mount, result banner.
//   App.tsx            — OnlinePvpPanel component, overlay mount props,
//                        usePlayAlong destructure extension.
import { readFileSync, writeFileSync } from "node:fs";

function insertBefore(path, marker, insert, label) {
  let s = readFileSync(path, "utf8");
  if (s.includes(label)) { console.log(label, "— already present"); return; }
  const at = s.indexOf(marker);
  if (at < 0) { console.error(label, "— MARKER NOT FOUND in", path, ":", JSON.stringify(marker.slice(0, 70))); process.exit(1); }
  s = s.slice(0, at) + insert + s.slice(at);
  writeFileSync(path, s);
  console.log(label, "— patched OK");
}
function replaceOnce(path, marker, replacement, label) {
  let s = readFileSync(path, "utf8");
  if (s.includes(label)) { console.log(label, "— already present"); return; }
  const at = s.indexOf(marker);
  if (at < 0) { console.error(label, "— MARKER NOT FOUND in", path); process.exit(1); }
  s = s.slice(0, at) + replacement + s.slice(at + marker.length);
  writeFileSync(path, s);
  console.log(label, "— patched OK");
}

/* ── use-play-along.ts ── */
insertBefore("use-play-along.ts",
  'import { analyzeSongRun, buildSongFallback } from "./song-analysis";',
  'import { hostOnlineDuel, joinOnlineDuel, leaveOnlineRoom, sendAccept, sendStart, sendScore, sendResult, sendRematch } from "./pvp-online";\n',
  "pvp-online import");

{
  let s = readFileSync("use-play-along.ts", "utf8");
  if (!s.includes("const [pvpOnline, setPvpOnline]")) {
    const block = `  /* ════ ONLINE PvP (plan #10) — realtime duel rooms ════
     Supabase Realtime broadcast channels (pvp-online.ts): host creates a
     6-char room, guest joins by code, both play the same song, host fires a
     synchronized start (startAt = wall clock + ~4s), live scores stream both
     ways, final results decide the winner. Trust model deliberately matches
     the existing ?challenge= links (self-reported) — friendly duel, not a
     ranked ladder. */
  const [pvpOnline, setPvpOnline] = useState(null); // null | {phase:"idle"|"hosting"|"joining"|"waiting"|"racing"|"waiting-result"|"done", code, role, guestName, hostName, songId, startAt, opp, oppResult, myResult, err, accepted, peerSeen}
  const [codeInput, setCodeInput] = useState("");
  const pvpScoreTickRef = useRef(null);
  const clearPvpScoreTick = () => { clearInterval(pvpScoreTickRef.current); pvpScoreTickRef.current = null; };
  useEffect(() => () => { clearPvpScoreTick(); leaveOnlineRoom(); }, []);
  function openPvpOnline() {
    if (pvpOnline && (pvpOnline.phase === "hosting" || pvpOnline.phase === "waiting")) return;
    setPvpOnline({ phase: "idle", code: null, role: null, guestName: null, hostName: null, songId: null, startAt: null, opp: null, oppResult: null, myResult: null, err: null, accepted: false, peerSeen: false });
  }
  function closePvpOnline() { clearPvpScoreTick(); leaveOnlineRoom(); setPvpOnline(null); }
  async function hostPvpOnline() {
    const name = (profile && (profile.full_name || profile.email)) || "Host";
    setPvpOnline({ phase: "hosting", code: null, role: "host", guestName: null, hostName: name, songId: songMeta ? songMeta.id : null, startAt: null, opp: null, oppResult: null, myResult: null, err: null, accepted: false, peerSeen: false });
    try {
      await hostOnlineDuel(name, {
        onReady: ({ code }) => setPvpOnline(p => p && { ...p, phase: "waiting", code }),
        onPresence: ({ count }) => setPvpOnline(p => p && p.phase === "waiting" ? { ...p, peerSeen: count > 1 } : p),
        onJoinRequest: ({ name: gn }) => setPvpOnline(p => p && { ...p, guestName: gn || "Challenger" }),
        onLeave: () => setPvpOnline(p => p && ["idle", "hosting", "joining", "waiting"].includes(p.phase) ? { ...p, guestName: null, peerSeen: false } : p),
      });
    } catch (e) { setPvpOnline(p => p && { ...p, err: String(e && e.message || e) }); }
  }
  async function joinPvpOnline(code) {
    const name = (profile && (profile.full_name || profile.email)) || "Challenger";
    setPvpOnline({ phase: "joining", code, role: "guest", guestName: name, hostName: null, songId: null, startAt: null, opp: null, oppResult: null, myResult: null, err: null, accepted: false, peerSeen: false });
    try {
      await joinOnlineDuel(code, name, {
        onReady: () => setPvpOnline(p => p && { ...p, phase: "waiting" }),
        onAccept: ({ ok, name: hn }) => setPvpOnline(p => p && (ok ? { ...p, hostName: hn || "Host", accepted: true } : { ...p, err: "declined" })),
        onStart: ({ songId, startAt }) => beginPvpRace({ songId, startAt }),
        onScore: (o) => setPvpOnline(p => p && { ...p, opp: o }),
        onResult: (r) => setPvpOnline(p => p && { ...p, oppResult: r }),
        onRematch: () => setPvpOnline(p => p && { ...p, phase: "waiting", opp: null, oppResult: null, myResult: null, startAt: null }),
        onLeave: () => setPvpOnline(p => p && (p.phase === "racing" || p.phase === "waiting-result") ? { ...p, err: "opponent-left" } : p),
      });
    } catch (e) { setPvpOnline(p => p && { ...p, err: String(e && e.message || e) }); }
  }
  function acceptPvpOnline(ok) {
    if (ok) { setPvpOnline(p => p && ({ ...p, phase: "waiting", accepted: true })); sendAccept(true, (profile && (profile.full_name || profile.email)) || "Host"); }
    else { sendAccept(false); closePvpOnline(); }
  }
  function startPvpTogether() {
    const p = pvpOnline;
    if (!p || !songMeta) return;
    const startAt = Date.now() + 4000;
    sendStart(songMeta.id, startAt);
    beginPvpRace({ songId: songMeta.id, startAt });
  }
  function beginPvpRace({ songId, startAt }) {
    clearPvpScoreTick();
    // the host's chosen song becomes THIS client's song too (both clients
    // already have every built-in song locally — nothing to download)
    const target = (SONGS.find(x => x.id === songId)) || songMeta;
    if (!target) { setPvpOnline(p => p && { ...p, err: "song-not-found" }); return; }
    setPvpOnline(p => p && ({ ...p, phase: "racing", songId, startAt, opp: null, oppResult: null, myResult: null }));
    chooseSong(target);
    const wait = Math.max(0, startAt - Date.now());
    setTimeout(() => startSongPlay(), wait);
    pvpScoreTickRef.current = setInterval(() => {
      const done = songHitsRef.current + songMissRef.current;
      sendScore(songScoreRef.current, songComboRef.current, done > 0 ? Math.round(songHitsRef.current / done * 100) : 100);
    }, 1000);
  }
  function reportPvpResult(res) {
    if (!pvpOnline || pvpOnline.phase === "done") return;
    setPvpOnline(p => p && ({ ...p, phase: "waiting-result", myResult: { score: res.score, acc: res.acc, stars: res.stars } }));
    sendResult(res.score, res.acc, res.stars);
    clearPvpScoreTick();
  }
  function rematchPvpOnline() { sendRematch(); setPvpOnline(p => p && ({ ...p, phase: "waiting", opp: null, oppResult: null, myResult: null, startAt: null })); }

`;
    const marker = "  // ════ PLAY-ALONG (falling-notes) controls ════";
    const at = s.indexOf(marker);
    if (at < 0) { console.error("pvp block marker NOT FOUND"); process.exit(1); }
    s = s.slice(0, at) + block + s.slice(at);
    writeFileSync("use-play-along.ts", s);
    console.log("pvp hook block — patched OK");
  } else console.log("pvp hook block — already present");
}

replaceOnce("use-play-along.ts",
  "    gainExp(reward, { quest: true });",
  "    reportPvpResult({ score, acc, stars }); // online PvP: my final result → the room (decides the winner on both sides)\n    gainExp(reward, { quest: true });",
  "finishSong result report");

replaceOnce("use-play-along.ts",
  "  return { songOpen, setSongOpen,",
  "  return { pvpOnline, openPvpOnline, closePvpOnline, hostPvpOnline, joinPvpOnline, acceptPvpOnline, startPvpTogether, rematchPvpOnline, codeInput, setCodeInput, songOpen, setSongOpen,",
  "hook return extension");

/* ── SongPlayOverlay.tsx ── */
replaceOnce("SongPlayOverlay.tsx",
  "export function SongPlayOverlay({ songMeta,",
  "export function SongPlayOverlay({ pvpOnline, openPvpOnline, closePvpOnline, hostPvpOnline, joinPvpOnline, acceptPvpOnline, startPvpTogether, rematchPvpOnline, codeInput, setCodeInput, songMeta,",
  "overlay destructure extension");

insertBefore("SongPlayOverlay.tsx",
  '                {songSetlistPos && <span className="setlistpos">🎤 {songSetlistPos.idx + 1}/{songSetlistPos.total}</span>}',
  '                {pvpOnline && pvpOnline.phase === "racing" && pvpOnline.opp && <span className="pvplive">⚔ {pvpOnline.opp.score}</span>}\n',
  "pvp HUD strip");

insertBefore("SongPlayOverlay.tsx",
  `                  <div className="songready-btns">
                    <button className="songbtn ghost" onClick={previewSong}>▶ {lc.songPreview}</button>`,
  `                  <OnlinePvpPanel pvpOnline={pvpOnline} openPvpOnline={openPvpOnline} closePvpOnline={closePvpOnline} hostPvpOnline={hostPvpOnline} joinPvpOnline={joinPvpOnline} acceptPvpOnline={acceptPvpOnline} startPvpTogether={startPvpTogether} rematchPvpOnline={rematchPvpOnline} songMeta={songMeta} lang={lang} codeInput={codeInput} setCodeInput={setCodeInput} />
`,
  "pvp ready UI");

{
  let s = readFileSync("SongPlayOverlay.tsx", "utf8");
  if (!s.includes("pvpOnline.phase === \"done\" || pvpOnline.phase === \"waiting-result\"")) {
    const banner = `
              {pvpOnline && (pvpOnline.phase === "done" || pvpOnline.phase === "waiting-result") && (() => {
                const mine = pvpOnline.myResult, theirs = pvpOnline.oppResult;
                const winner = mine && theirs ? (mine.score > theirs.score ? "me" : theirs.score > mine.score ? "them" : "tie") : null;
                const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
                return (
                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--bd1,#444)", background: "rgba(139,92,246,0.08)" }}>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>
                      ⚔ {T("ดวลเพลงออนไลน์", "Online Duel", "在线对决")}
                      {winner === "me" && <span style={{ color: "#4ade80" }}> — {T("คุณชนะ!", "You win!", "你赢了！")}</span>}
                      {winner === "them" && <span style={{ color: "#ff5252" }}> — {T("แพ้แล้ว ลองใหม่!", "Defeated — rematch!", "惜败 — 再来！")}</span>}
                      {winner === "tie" && <span> — {T("เสมอ!", "Tie!", "平局！")}</span>}
                      {!winner && <span> — {T("รอผลฝ่ายตรงข้าม...", "Waiting for opponent...", "等待对方...")}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted,#aaa)" }}>
                      {T("ฉัน", "Me", "我")}: {mine ? mine.score : "–"} · {T("ฝ่ายตรงข้าม", "Opponent", "对手")}: {theirs ? theirs.score : (pvpOnline.opp ? pvpOnline.opp.score : "–")}
                    </div>
                  </div>
                );
              })()}
`;
    const anchor2 = `                🏆 {lang === "th" ? "ท้าเพื่อน!" : lang === "zh" ? "挑战朋友!" : "Challenge a Friend!"}
              </button>`;
    const at2 = s.indexOf(anchor2);
    if (at2 < 0) { console.error("SongPlayOverlay challenge anchor NOT FOUND"); process.exit(1); }
    s = s.slice(0, at2 + anchor2.length) + banner + s.slice(at2 + anchor2.length);
    writeFileSync("SongPlayOverlay.tsx", s);
    console.log("SongPlayOverlay result banner — patched OK");
  } else console.log("SongPlayOverlay result banner — already present");
}

/* ── App.tsx ── */
{
  let s = readFileSync("App.tsx", "utf8");
  if (!s.includes("function OnlinePvpPanel")) {
    const comp = `/* ── Online PvP room panel (Play Along plan #10) — the ready-screen UI for
   realtime duel rooms: host a 6-char room / join by code / accept the
   challenger / synchronized start. State + handlers live in use-play-along
   (see pvp-online.ts for the transport). ── */
function OnlinePvpPanel({ pvpOnline, openPvpOnline, closePvpOnline, hostPvpOnline, joinPvpOnline, acceptPvpOnline, startPvpTogether, rematchPvpOnline, songMeta, lang, codeInput, setCodeInput }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const p = pvpOnline;
  const copyLink = () => {
    try { navigator.clipboard.writeText(\`\${window.location.origin}\${window.location.pathname}?pvp=\${p.code}\`); } catch (e) {}
  };
  if (!p) return (
    <button className="songbtn ghost" style={{ width: "100%", marginTop: 8 }} onClick={openPvpOnline}>
      ⚔ {T("ดวลออนไลน์กับเพื่อน", "Online duel with a friend", "与好友在线对决")}
    </button>
  );
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid var(--bd1,#444)", background: "rgba(139,92,246,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>⚔ {T("ดวลออนไลน์", "Online Duel", "在线对决")}</b>
        <button className="cbtn" onClick={closePvpOnline}>×</button>
      </div>
      {p.err && <div style={{ color: "#ff5252", fontSize: 13, marginTop: 6 }}>{p.err === "opponent-left" ? T("ฝ่ายตรงข้ามออกจากห้อง", "Opponent left", "对方已离开") : p.err === "declined" ? T("ถูกปฏิเสธ", "Declined", "被拒绝") : p.err}</div>}
      {p.phase === "idle" && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="songbtn go" style={{ flex: 1 }} onClick={hostPvpOnline}>{T("สร้างห้อง", "Host room", "创建房间")}</button>
          <div style={{ flex: 1, display: "flex", gap: 4 }}>
            <input value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 6))} placeholder={T("รหัสห้อง", "ROOM CODE", "房间码")}
              style={{ flex: 1, minWidth: 0, padding: "8px", borderRadius: 10, border: "1px solid var(--bd1,#444)", background: "var(--card,#222)", color: "#fff", textAlign: "center", fontWeight: 800, letterSpacing: 2 }} />
            <button className="songbtn go" onClick={() => joinPvpOnline(codeInput)}>{T("เข้า", "Join", "加入")}</button>
          </div>
        </div>
      )}
      {p.phase === "hosting" && <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted,#aaa)" }}>{T("กำลังสร้างห้อง...", "Creating room...", "正在创建...")}</div>}
      {p.phase === "joining" && <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted,#aaa)" }}>{T("กำลังเข้าห้อง...", "Joining...", "正在加入...")}</div>}
      {p.phase === "waiting" && p.role === "host" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: "var(--muted,#aaa)" }}>{T("รหัสห้อง — ส่งให้เพื่อน", "Room code — share it", "房间码 — 发给好友")}</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 6, textAlign: "center", margin: "6px 0" }}>{p.code}</div>
          <button className="songbtn ghost" style={{ width: "100%" }} onClick={copyLink}>🔗 {T("คัดลอกลิงก์เชิญ", "Copy invite link", "复制邀请链接")}</button>
          {p.guestName ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 6 }}>🤝 {p.guestName} {T("ต้องการดวลด้วย — เพลง:", "wants to duel — song:", "请求对决 — 曲目：")} <b>{tr(songMeta, lang)}</b></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="songbtn go" style={{ flex: 1 }} onClick={() => acceptPvpOnline(true)}>✓ {T("รับ", "Accept", "接受")}</button>
                <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => acceptPvpOnline(false)}>✕ {T("ปฏิเสธ", "Decline", "拒绝")}</button>
              </div>
            </div>
          ) : <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted,#aaa)" }}>{T("รอผู้ท้าชิง...", "Waiting for a challenger...", "等待挑战者...")}</div>}
        </div>
      )}
      {p.phase === "waiting" && p.role === "guest" && (
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted,#aaa)" }}>
          {p.accepted ? T("รับแล้ว — รอหัวห้องเริ่ม...", "Accepted — waiting for host to start...", "已接受 — 等待房主开始...") : T("ส่งคำขอแล้ว รอตอบรับ...", "Request sent, waiting...", "请求已发送...")}
        </div>
      )}
      {p.phase === "racing" && (() => {
        const waitMs = Math.max(0, (p.startAt || 0) - Date.now());
        return (
          <div style={{ marginTop: 8, textAlign: "center" }}>
            {waitMs > 300 ? <b style={{ fontSize: 20 }}>⚔ {T("เริ่มใน", "Starting in", "即将开始")} {Math.ceil(waitMs / 1000)}s</b> : <b style={{ fontSize: 16 }}>⚔ {T("สู้ ๆ!", "Go!", "加油！")}</b>}
          </div>
        );
      })()}
      {p.phase === "waiting-result" && <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted,#aaa)", textAlign: "center" }}>{T("ส่งผลแล้ว — รอฝ่ายตรงข้ามจบ", "Result sent — waiting for opponent", "已发送 — 等待对方")}</div>}
    </div>
  );
}

`;
    const anchor = "/* ── Daily Song Quest day card";
    const at = s.indexOf(anchor);
    if (at < 0) { console.error("App.tsx OnlinePvpPanel anchor NOT FOUND"); process.exit(1); }
    s = s.slice(0, at) + comp + s.slice(at);
    console.log("OnlinePvpPanel component — inserted");
  }
  if (!s.includes("pvpOnline={pvpOnline}")) {
    const anchor = "{songOpen && songMeta && <SongPlayOverlay songMeta={songMeta}";
    const at = s.indexOf(anchor);
    if (at < 0) { console.error("SongPlayOverlay mount anchor NOT FOUND"); process.exit(1); }
    s = s.slice(0, at) + "{songOpen && songMeta && <SongPlayOverlay pvpOnline={pvpOnline} openPvpOnline={openPvpOnline} closePvpOnline={closePvpOnline} hostPvpOnline={hostPvpOnline} joinPvpOnline={joinPvpOnline} acceptPvpOnline={acceptPvpOnline} startPvpTogether={startPvpTogether} rematchPvpOnline={rematchPvpOnline} codeInput={codeInput} setCodeInput={setCodeInput} songMeta={songMeta}" + s.slice(at + anchor.length);
    console.log("SongPlayOverlay mount — props threaded");
  }
  if (!s.includes("const { pvpOnline, openPvpOnline")) {
    const anchor = "  const { songOpen, setSongOpen, songMeta, setSongMeta,";
    const at = s.indexOf(anchor);
    if (at < 0) { console.error("usePlayAlong destructure anchor NOT FOUND"); process.exit(1); }
    s = s.slice(0, at) + "  const { pvpOnline, openPvpOnline, closePvpOnline, hostPvpOnline, joinPvpOnline, acceptPvpOnline, startPvpTogether, rematchPvpOnline, codeInput, setCodeInput, songOpen, setSongOpen, songMeta, setSongMeta," + s.slice(at + anchor.length);
    console.log("usePlayAlong destructure — extended");
  }
  writeFileSync("App.tsx", s);
}
console.log("patch3 complete");
