import { L, tr } from "./i18n";
import { useTiga } from "./tiga-gateway";   // Capability Hub via the lazy gateway (plan v3 1.5)
import { dailySong } from "./play-along-progress";
import { levelInfo } from "./App";
import { readMemory } from "./ai-chat-context";
import { readPracticeLog } from "./shared-infra";
import { playUi } from "./music-engine";
import { isMaxPlan } from "./payment";
import { logUsage, dayKey } from "./shared-infra";
import { dailyPriority, pickLang, resumeHint, streakState } from "./retention";

/* Analog of the app-wide divergence guard: one measurement per day per value
   pair, so the mismatch between the two streak writers becomes DATA (see
   retention.streakState) instead of a one-off console warning nobody reads. */
let sdLogged = "";
import { sb } from "./supabase-client";
import { SONGS } from "./songs-data";
/* ── ProfileDashboardPanel ──
   The page==="profile" inline render block, extracted verbatim from
   PianoApp's inline JSX as part of Phase 2 componentization — no logic
   changes. lc is derived from lang internally. ClassQuestSection/
   SchoolLeaderboardSection/ProfilePage are threaded as props (component
   references) rather than imported, since they're still top-level
   components living in App.tsx itself, not yet extracted to their own
   files — importing them back would create a circular App.tsx <->
   component import. Likewise questToday/readStreak/streakAtRisk/
   QUEST_GOAL are top-level in App.tsx but not exported, so they're
   threaded as props too. ── */
export function ProfileDashboardPanel({ lang, profile, plan, chestAvail, chestLocked = false, schoolHW, setSchoolHW, homework, setHomework, setHomeworkLS, mySchoolName, coins, gems, session, onSignOut, setPage, setStudioView, setPricingOpen, setShopOpen, onOpenStorage, onOpenPvp, onOpenPet, setHelpOpen, setFriendsOpen, setAiModalType, setAiModalText, setAiModalLoading, setAiModalOpen, earnCoins, buyFreeze, openChestNow, exchangeGems, questToday, readStreak, streakAtRisk, leaveSchool, QUEST_GOAL, ClassQuestSection, SchoolLeaderboardSection, ProfilePage, onAskStruggle, onReplayDrill, charModel = "vanguard", charHat = "hat-straw", charOutfit = "out-tshirt", charWeapon = "wpn-stick", charAccessory = "acc-shield", owned = [] }) {
  const lc = L[lang];
  return (
        <div className="profscroll">
          {(() => {
            // A0: ONE streak view. The server value (profiles.streak, advanced on app
            // open by use-gamification) is what badges and the weekly-report push already
            // cite, so it is the number shown here too; the device streak is the
            // guest/offline fallback. A mismatch is logged once a day — measured, not hidden.
            const device = (() => { try { return JSON.parse(localStorage.getItem("tg_streak") || "null"); } catch (e) { return null; } })();
            const sInfo = streakState({ profile, device, today: dayKey() });
            const atRisk = sInfo.atRisk;
            if (sInfo.divergence) {
              const k = dayKey() + ":" + sInfo.divergence.server + ":" + sInfo.divergence.device;
              if (sdLogged !== k) { sdLogged = k; logUsage("streak_divergence", `server:${sInfo.divergence.server}-device:${sInfo.divergence.device}`); }
            }
            const qT = questToday(profile);
            const qPct = Math.round(Math.min(qT, QUEST_GOAL) / QUEST_GOAL * 100);
            return (
              <div className="profdash">
                <div className={`dailyhub${atRisk ? " atrisk" : ""}`}>
                  <div className="dh-streak">
                    <div className="dh-flame">🔥</div>
                    <div className="dh-streaknum">{sInfo.count || 0}</div>
                    <div className="dh-streaklbl">{lc.dhStreak}</div>
                  </div>
                  <div className="dh-mid">
                    <div className="dh-goal-top">
                      <span>{atRisk ? lc.dhAtRisk : qT >= QUEST_GOAL ? lc.dhDone : lc.dhGoal}</span>
                      <b>{Math.min(qT, QUEST_GOAL)}/{QUEST_GOAL}</b>
                    </div>
                    <div className="dh-goalbar"><div style={{ width: qPct + "%" }} /></div>
                    <div className="dh-actions">
                      {(sInfo.freezes || 0) > 0 && <span className="dh-freeze">🛡️ {sInfo.freezes}{isMaxPlan(plan) ? " · Premium" : ""}</span>}
                      {(sInfo.freezes || 0) === 0 && (isMaxPlan(plan)
                        ? <span className="dh-freeze" style={{ opacity: 0.65, fontSize: "10px" }}>🛡️ {lang === "th" ? "รับ 4 ใบ/เดือน · Premium" : lang === "zh" ? "每月4次 · Premium" : "4 free/month · Premium"}</span>
                        : <button className="dh-buyfreeze" onClick={buyFreeze}>🛡️ {lc.dhFreeze} 120🪙</button>)}
                    </div>
                  </div>
                  {chestAvail
                    ? <button className="dh-chest chestpulse" onClick={openChestNow}>🎁<span>{lc.dhClaim}</span></button>
                    : <button className="dh-chest done" onClick={() => { setPage("studio"); setStudioView("menu"); }}>{chestLocked ? "🔒" : "🎮"}<span>{chestLocked ? lc.dhUnlock : lc.dhPlay}</span></button>}
                </div>
                {/* retention (S1) — "วันนี้ของฉัน": the ONE next action, chosen so the most
                    perishable thing wins (streak about to lapse → unopened reward → unfinished
                    daily mission → the thing they were last on). Rule lives in retention.ts and
                    is smoke-tested; nothing here is a claim — resume only appears when cross-session
                    memory actually knows a label. */}
                {(() => {
                  const res = resumeHint(readMemory());
                  const pri = dailyPriority({ atRisk, chestAvail, questDone: qT >= QUEST_GOAL, hasResume: !!res });
                  const txt = pickLang(pri.cta, lang) + (pri.kind === "resume" && res ? " · " + res.label : "");
                  const go = pri.kind === "chest" ? openChestNow
                    : pri.kind === "resume" ? () => { logUsage("nav", "daily-resume"); setPage("studio"); setStudioView("songs"); }
                    : () => { logUsage("nav", "daily-priority"); setPage("studio"); setStudioView("menu"); };
                  return (
                    <button className="dailyrec" onClick={go}>
                      <span className="dailyrec-lbl">🧠 TIGA</span>
                      <span className="dailyrec-ic">{pri.ic}</span>
                      <span className="dailyrec-txt">{txt}</span>
                      <span className="dailyrec-go">›</span>
                    </button>
                  );
                })()}
                {(schoolHW || (homework && homework.text)) && (
                  <div className="hwbar">
                    <span className="hwbar-ic">{schoolHW ? "🏫" : "📝"}</span>
                    <span className="hwbar-tx"><b>{schoolHW ? lc.hwFromTeacher : lc.hwLabel}</b> {schoolHW
                      ? (tr(SONGS.find(s => s.id === schoolHW.song_id), lang) || schoolHW.song_id) + (schoolHW.note ? " — " + schoolHW.note : "") + (schoolHW.ack_at ? " ✅" : "")
                      : homework.text}</span>
                    <button className="hwbar-done" aria-label="done" onClick={() => {
                      if (schoolHW) {
                        if (!schoolHW.ack_at) sb.rpc("school_ack_assignment", { p_assignment_id: schoolHW.id }).then(() => setSchoolHW(h => h ? { ...h, ack_at: new Date().toISOString() } : h));
                      } else { setHomeworkLS(null); setHomework(null); }
                      playUi("reward"); earnCoins(10);
                    }}>✓</button>
                  </div>
                )}
              </div>
            );
          })()}
          {(() => {
            // TIGA Capability Hub: honest learner summary + today's quest hint.
            // Both come from real local data via whatever engines are registered;
            // a null line hides the row instead of showing filler.
            const tiga = useTiga(m => m);   // null until the lazy model lands → the 🧠 bar hides honestly, then fills
            const summ = tiga ? tiga.tigaHub.learnerSummary(readMemory(), readPracticeLog(), profile) : null;
            const ds = dailySong(levelInfo((profile && profile.exp) || 0).level, plan);
            const hint = tiga ? tiga.tigaHub.nextQuestHint(readMemory(), profile, { dailySong: ds ? tr(ds, lang) : null }) : null;
            const line = summ && summ.line ? (summ.line[lang === "th" ? "th" : lang === "zh" ? "zh" : "en"] || summ.line.en) : null;
            const htip = hint && hint.tip ? (hint.tip[lang === "th" ? "th" : lang === "zh" ? "zh" : "en"] || hint.tip.en) : null;
            if (!line && !htip) return null;
            return (
              <div className="tigatipbar prof">
                <span className="tigatipbadge">🧠 TIGA</span>
                <span>{line || htip}{line && htip ? " · " : ""}{line && htip ? htip : ""}</span>
              </div>
            );
          })()}
          {profile && profile.school_id && (
            <div className="profsec" style={{ margin: "0 14px 10px" }}>
              <div className="profsec-h">🏫 {lc.schoolMyCard}{mySchoolName ? " — " + mySchoolName : ""}</div>
              <span className="schoolrole-badge">{profile.school_role === "teacher" ? lc.schoolMyRoleTeacher : lc.schoolMyRoleStudent}</span>
              {profile.school_role === "student" && (
                <button className="songbtn ghost" style={{ width: "100%", marginTop: 10 }} onClick={leaveSchool}>✕ {lc.schoolLeaveBtn}</button>
              )}
            </div>
          )}
          {profile && profile.school_id && <ClassQuestSection lang={lang} schoolId={profile.school_id} />}
          {profile && profile.school_id && <SchoolLeaderboardSection lang={lang} schoolId={profile.school_id} />}

          <ProfilePage lang={lang} session={session} profile={profile} onSignOut={onSignOut} coins={coins} gems={gems}
            onOpenShop={() => setShopOpen(true)} onOpenStorage={onOpenStorage} onOpenPvp={onOpenPvp} onOpenPet={onOpenPet} onOpenHelp={() => setHelpOpen(true)} onOpenFriends={() => setFriendsOpen(true)} onExchangeGems={exchangeGems} onAskStruggle={onAskStruggle} onReplayDrill={onReplayDrill}
            charModel={charModel} charHat={charHat} charOutfit={charOutfit} charWeapon={charWeapon} charAccessory={charAccessory} owned={owned} />
        </div>
  );
}
