/* One-off patch — Auto Teaching wiring (owner plan 2026-09-19, items 6,7,8,10):
   - openAdvice() snapshot when a tip fires (6)
   - recordTipAction() on follow/dismiss (7) + server-side logUsage("atip",…)
   - teaching-moment triggers: right after a rough practice, after a new best,
     and when returning after ≥3 days away (8)
   - admin effectiveness card rows from kind="atip" events (10) */
import { readFileSync, writeFileSync } from "node:fs";

function patch(F, pairs) {
  let s = readFileSync(F, "utf8");
  let fails = 0;
  for (const [oldStr, newStr, label] of pairs) {
    if (s.includes(newStr)) { console.log(`ok (already): ${label}`); continue; }
    const i = s.indexOf(oldStr);
    if (i < 0) { console.log(`FAIL: ${label} — anchor not found in ${F}`); fails++; continue; }
    s = s.slice(0, i) + newStr + s.slice(i + oldStr.length);
    console.log(`ok: ${label}`);
  }
  writeFileSync(F, s);
  return fails;
}

let fails = 0;

// ── App.tsx ──
fails += patch("App.tsx", [
  // 6: snapshot before/after state when the tip goes out
  [
`      const obj = await generateCoachTip(lang, profile);
      if (obj) {
        setAutoTeachTip(obj);
        logAutoTeachTip(obj.weakness, obj.steps.join(" / "), obj.feature, obj.topic);
      }`,
`      const obj = await generateCoachTip(lang, profile);
      if (obj) {
        setAutoTeachTip(obj);
        logAutoTeachTip(obj.weakness, obj.steps.join(" / "), obj.feature, obj.topic);
        try { openAdvice(obj, weightedStruggles()); logUsage("atip", "show"); } catch (e2) {} // วงจรปิด (ข้อ 6): จดสถานะจุดอ่อน ณ ตอนยิงไว้เทียบผลซ้อมถัดไป
      }`,
    "openAdvice on fire"],
  // 8: teaching-moment triggers (event listener + returning-learner greeting)
  [
`  const autoTeachMin = resolveAutoTeachMin(profile, autoTeachDefaultMin);
  useEffect(() => {
    clearInterval(autoTeachTimer.current);
    if (!premium || !(autoTeachMin > 0)) return;
    autoTeachTimer.current = setInterval(fetchAutoTeachTip, autoTeachMin * 60 * 1000);
    return () => clearInterval(autoTeachTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, autoTeachMin, lang]);`,
`  const autoTeachMin = resolveAutoTeachMin(profile, autoTeachDefaultMin);
  useEffect(() => {
    clearInterval(autoTeachTimer.current);
    if (!premium || !(autoTeachMin > 0)) return;
    autoTeachTimer.current = setInterval(fetchAutoTeachTip, autoTeachMin * 60 * 1000);
    return () => clearInterval(autoTeachTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, autoTeachMin, lang]);
  // Auto-Teach แม่นยำ (แผนข้อ 8): ยิงตาม "จังหวะการสอน" ไม่ใช่แค่ตัวจับเวลา —
  // (a) เพิ่งจบซ้อมที่พลาดเยอะ (<65%) → คำแนะนำมาตอนสมองกำลังถามหาคำตอบ
  // (b) เพิ่งทำลายสถิติ → โมเมนต์ภูมิใจ รับคำท้าต่อยอดได้ดี
  // (c) กลับมาหลังห่างหาย ≥3 วัน → ทักตามพร้อมจุดอ่อนล่าสุด ไม่เริ่มจากศูนย์
  useEffect(() => {
    if (!premium || !(autoTeachMin > 0)) return;
    const onPracticeDone = (e) => {
      const d = (e && e.detail) || {};
      if (d.accuracy != null && d.accuracy < 65) { setTimeout(() => fetchAutoTeachTip(), 1500); return; }
      if (d.isNewBest) setTimeout(() => fetchAutoTeachTip(), 2500);
    };
    window.addEventListener("tiga:practice-done", onPracticeDone);
    try {
      const m = readMemory();
      const gap = m && m.lastSession ? Date.now() - m.lastSession : 0;
      if (gap >= 3 * 86400000) setTimeout(() => fetchAutoTeachTip(), 3000);
    } catch (err) {}
    return () => window.removeEventListener("tiga:practice-done", onPracticeDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premium, autoTeachMin, lang]);`,
    "teaching-moment triggers"],
  // 7: follow/dismiss actions on the popup itself
  [
`        <div className="atpopup" onClick={() => setAutoTeachTip(null)}>
          <div className="atpopup-card" onClick={e => e.stopPropagation()}>
            <div className="atpopup-hd">
              <span className="atpopup-ic" aria-hidden="true">🎯</span>`,
`        <div className="atpopup" onClick={() => { try { recordTipAction("dismiss", autoTeachTip && autoTeachTip.feature); logUsage("atip", "dismiss"); } catch (e) {} setAutoTeachTip(null); }}>
          <div className="atpopup-card" onClick={e => e.stopPropagation()}>
            <div className="atpopup-hd">
              <span className="atpopup-ic" aria-hidden="true">🎯</span>`,
    "popup overlay dismiss"],
  [
`              <button className="atpopup-x" onClick={() => setAutoTeachTip(null)} aria-label="close">×</button>`,
`              <button className="atpopup-x" onClick={() => { try { recordTipAction("dismiss", autoTeachTip && autoTeachTip.feature); logUsage("atip", "dismiss"); } catch (e) {} setAutoTeachTip(null); }} aria-label="close">×</button>`,
    "popup X dismiss"],
  [
`                    onClick={() => { setAutoTeachTip(null); goToCoachStep(s, autoTeachTip.feature); }}>`,
`                    onClick={() => { try { recordTipAction("follow", autoTeachTip.feature); logUsage("atip", "follow"); } catch (e) {} setAutoTeachTip(null); goToCoachStep(s, autoTeachTip.feature); }}>`,
    "step follow"],
  [
`              <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => { setAutoTeachTip(null); setPage("coach"); }}>`,
`              <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => { try { recordTipAction("follow", autoTeachTip && autoTeachTip.feature); logUsage("atip", "follow"); } catch (e) {} setAutoTeachTip(null); setPage("coach"); }}>`,
    "details follow"],
  [
`              <button className="atpopup-ok" style={{ flex: 1 }} onClick={() => { setAutoTeachTip(null); handleCoachNavigate(autoTeachTip.feature); }}>`,
`              <button className="atpopup-ok" style={{ flex: 1 }} onClick={() => { try { recordTipAction("follow", autoTeachTip.feature); logUsage("atip", "follow"); } catch (e) {} setAutoTeachTip(null); handleCoachNavigate(autoTeachTip.feature); }}>`,
    "ok follow"],
  // 10: admin effectiveness card
  [
`          <Panel title={T("🎮 การใช้ฟีเจอร์เกม (สัตว์เลี้ยง/PvP/ร้านค้า)", "🎮 Game-feature adoption (pets/PvP/shop)", "🎮 游戏功能使用（宠物/PvP/商店）")} rows={(stats || []).filter(r => r.kind === "nav" && ["pet", "pvp", "shop", "storage"].includes(r.item_id))}
            labelFor={(id) => ({ pet: "🐾 " + T("สัตว์เลี้ยง", "Pets", "宠物"), pvp: "⚔ " + T("สนามประลอง PvP", "PvP Arena", "PvP 竞技场"), shop: "🛍 " + T("ร้านค้า", "Shop", "商店"), storage: "📦 " + T("คลังของ", "Storage", "仓库") }[id] || id)} />`,
`          <Panel title={T("🎮 การใช้ฟีเจอร์เกม (สัตว์เลี้ยง/PvP/ร้านค้า)", "🎮 Game-feature adoption (pets/PvP/shop)", "🎮 游戏功能使用（宠物/PvP/商店）")} rows={(stats || []).filter(r => r.kind === "nav" && ["pet", "pvp", "shop", "storage"].includes(r.item_id))}
            labelFor={(id) => ({ pet: "🐾 " + T("สัตว์เลี้ยง", "Pets", "宠物"), pvp: "⚔ " + T("สนามประลอง PvP", "PvP Arena", "PvP 竞技场"), shop: "🛍 " + T("ร้านค้า", "Shop", "商店"), storage: "📦 " + T("คลังของ", "Storage", "仓库") }[id] || id)} />
          {/* Auto-Teach effectiveness (owner plan 2026-09-19 #10): tips shown vs
              followed vs dismissed, and whether the NEXT practice on that topic
              actually improved. Events land in usage_events as kind="atip". */}
          <Panel title={T("🎯 ประสิทธิภาพ Auto Teaching", "🎯 Auto Teaching effectiveness", "🎯 自动教学效果")} rows={(stats || []).filter(r => r.kind === "atip")}
            labelFor={(id) => ({ show: "🎯 " + T("คำแนะนำที่แสดง", "Tips shown", "显示建议"), follow: "✅ " + T("กดตามไปฝึก", "Followed", "跟练了"), dismiss: "✖ " + T("ปิดทิ้ง", "Dismissed", "关闭了"), win: "📈 " + T("ซ้อมถัดไปดีขึ้น", "Next practice improved", "下次练习进步"), loss: "➖ " + T("ซ้อมถัดไปยังเท่าเดิม", "Next practice unchanged", "下次练习无进步") }[id] || id)} />`,
    "admin card"],
]);

// ── use-practice-mode.ts: announce the teaching moment ──
fails += patch("use-practice-mode.ts", [
  [
`    setPracticeResult({ label, total, hits, miss, accuracy, bestStreak, dyn, rhythm, prevBest, isNewBest, pathUnlocked, bossDefeated, memoryStreak, aiText: null, aiLoading: !isGuest, tigaTip });`,
`    // Auto-Teach แม่นยำ (แผนข้อ 8): ประกาศจังหวะ "เพิ่งจบซ้อม" ให้ครูคาราใน App.tsx (ผลซ้อมเพิ่งรู้ = จังหวะสอนที่ดีที่สุด)
    try { window.dispatchEvent(new CustomEvent("tiga:practice-done", { detail: { accuracy, isNewBest, label } })); } catch (e) {}
    setPracticeResult({ label, total, hits, miss, accuracy, bestStreak, dyn, rhythm, prevBest, isNewBest, pathUnlocked, bossDefeated, memoryStreak, aiText: null, aiLoading: !isGuest, tigaTip });`,
    "practice-done event"],
]);

// ── use-autoteach.ts: server-side win/loss logging when an outcome resolves ──
fails += patch("use-autoteach.ts", [
  [
`import { readMemory, writeMemory } from "./ai-chat-context";`,
`import { readMemory, writeMemory } from "./ai-chat-context";
import { logUsage } from "./shared-infra";`,
    "logUsage import"],
  [
`    rec.resolved = true;
    writeOutcomes(list);
    return true;`,
`    rec.resolved = true;
    writeOutcomes(list);
    // ข้อ 10: ผลก่อน/หลังขึ้น server ด้วย (usage_events kind="atip") เพื่อการ์ด admin รวมทุกเครื่อง
    try { if (rec.outcome && rec.outcome.improved === true) logUsage("atip", "win"); else if (rec.outcome && rec.outcome.improved === false) logUsage("atip", "loss"); } catch (e) {}
    return true;`,
    "outcome logging"],
]);

console.log(fails ? `DONE with ${fails} FAIL(s)` : "DONE all ok");
