import { L, tr } from "./i18n";
import { playUi } from "./music-engine";
import { isMaxPlan } from "./payment";
import { logUsage } from "./shared-infra";
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
export function ProfileDashboardPanel({ lang, profile, plan, chestAvail, schoolHW, setSchoolHW, homework, setHomework, setHomeworkLS, mySchoolName, coins, gems, session, onSignOut, setPage, setStudioView, setPricingOpen, setShopOpen, setHelpOpen, setFriendsOpen, setBuyCurrencyOpen, setAiModalType, setAiModalText, setAiModalLoading, setAiModalOpen, earnCoins, buyFreeze, openChestNow, exchangeGems, questToday, readStreak, streakAtRisk, leaveSchool, QUEST_GOAL, ClassQuestSection, SchoolLeaderboardSection, ProfilePage, onAskStruggle }) {
  const lc = L[lang];
  return (
        <div className="profscroll">
          {(() => {
            const sInfo = readStreak();
            const atRisk = streakAtRisk();
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
                      {(sInfo.freezes || 0) > 0 && <span className="dh-freeze">🛡️ {sInfo.freezes}{isMaxPlan(plan) ? " · Max" : ""}</span>}
                      {(sInfo.freezes || 0) === 0 && (isMaxPlan(plan)
                        ? <span className="dh-freeze" style={{ opacity: 0.65, fontSize: "10px" }}>🛡️ {lang === "th" ? "รับ 4 ใบ/เดือน · Max" : lang === "zh" ? "每月4次 · Max" : "4 free/month · Max"}</span>
                        : <button className="dh-buyfreeze" onClick={buyFreeze}>🛡️ {lc.dhFreeze} 120🪙</button>)}
                    </div>
                  </div>
                  {chestAvail
                    ? <button className="dh-chest" onClick={openChestNow}>🎁<span>{lc.dhClaim}</span></button>
                    : <button className="dh-chest done" onClick={() => { setPage("studio"); setStudioView("menu"); }}>🎮<span>{lc.dhPlay}</span></button>}
                </div>
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
          {/* My Stats + Report Card live as sub-pages of Profile (moved out of the nav) */}
          <button className="tdstep" style={{ width: "calc(100% - 28px)", margin: "0 14px 10px", cursor: "pointer", textAlign: "left" }}
            onClick={() => { playUi("click"); if (!isMaxPlan(plan)) { setPricingOpen(true); return; } logUsage("nav", "profile-stats"); setPage("insights"); }}>
            <span className="tdico">📊</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tdlbl">{lc.navStats}{!isMaxPlan(plan) && <span style={{ fontSize: "10px", color: "#d97757", fontWeight: 700, marginLeft: 6 }}>👑 Max</span>}</div>
              <div className="tdtag">{lang === "th" ? "กราฟการซ้อม · จุดที่ควรเก็บ · ช่วงเวลาที่ซ้อมบ่อย" : lang === "zh" ? "练习图表 · 待加强 · 常练时间" : "Practice charts · weak spots · best hours"}</div>
            </div>
            <span className="tdgo">{isMaxPlan(plan) ? "→" : "👑"}</span>
          </button>
          <button className="tdstep" style={{ width: "calc(100% - 28px)", margin: "0 14px 10px", cursor: "pointer", textAlign: "left" }}
            onClick={() => { playUi("click"); logUsage("nav", "profile-report"); setPage("report"); }}>
            <span className="tdico">🏅</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tdlbl">{lc.navReport}</div>
              <div className="tdtag">{lang === "th" ? "สรุปรายสัปดาห์ · คำติชมครู · ใบประกาศนียบัตร" : lang === "zh" ? "每周总结 · 老师评语 · 证书" : "Weekly summary · teacher comment · certificates"}</div>
            </div>
            <span className="tdgo">→</span>
          </button>
          <button className="tdstep" style={{ width: "calc(100% - 28px)", margin: "0 14px 10px", cursor: "pointer", textAlign: "left" }}
            onClick={() => { playUi("click"); if (!isMaxPlan(plan)) { setPricingOpen(true); return; } setAiModalType("report"); setAiModalText(""); setAiModalLoading(false); setAiModalOpen(true); }}>
            <span className="tdico">📋</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tdlbl">{lang === "th" ? "รายงานพัฒนาการ AI" : lang === "zh" ? "AI 进度报告" : "AI Weekly Report"}{!isMaxPlan(plan) && <span style={{ fontSize: "10px", color: "#d97757", fontWeight: 700, marginLeft: 6 }}>👑 Max</span>}</div>
              <div className="tdtag">{lang === "th" ? "รายงานพัฒนาการรายสัปดาห์ที่ AI สร้างเป็นการส่วนตัว" : lang === "zh" ? "AI 个性化生成的每周进度总结" : "AI-generated personal weekly progress report"}</div>
            </div>
            <span className="tdgo">{isMaxPlan(plan) ? "→" : "👑"}</span>
          </button>
          <button className="tdstep" style={{ width: "calc(100% - 28px)", margin: "0 14px 10px", cursor: "pointer", textAlign: "left" }}
            onClick={() => { playUi("click"); if (!isMaxPlan(plan)) { setPricingOpen(true); return; } setAiModalType("plan"); setAiModalText(""); setAiModalLoading(false); setAiModalOpen(true); }}>
            <span className="tdico">🗓️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tdlbl">{lang === "th" ? "แผนซ้อมส่วนตัว AI" : lang === "zh" ? "AI 练习计划" : "AI Practice Plan"}{!isMaxPlan(plan) && <span style={{ fontSize: "10px", color: "#d97757", fontWeight: 700, marginLeft: 6 }}>👑 Max</span>}</div>
              <div className="tdtag">{lang === "th" ? "แผนซ้อม 7 วัน AI วิเคราะห์จุดอ่อนส่วนตัว" : lang === "zh" ? "AI 根据弱点生成的7天个性化练习计划" : "Personalized 7-day AI plan based on your weak spots"}</div>
            </div>
            <span className="tdgo">{isMaxPlan(plan) ? "→" : "👑"}</span>
          </button>
          <ProfilePage lang={lang} session={session} profile={profile} onSignOut={onSignOut} coins={coins} gems={gems}
            onOpenShop={() => setShopOpen(true)} onOpenHelp={() => setHelpOpen(true)} onOpenFriends={() => setFriendsOpen(true)} onExchangeGems={exchangeGems} onBuyCurrency={() => setBuyCurrencyOpen(true)} onAskStruggle={onAskStruggle} />
        </div>
  );
}
