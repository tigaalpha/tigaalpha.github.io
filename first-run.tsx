/* first-run.tsx — the 3-minute first run of a NEW member (Step 3.1, owner 2026-11-26; the old welcome card stays suspended, this one is short and skippable).
   Page 1 (welcome): "you are on the free 7-day Pro trial, no card" + one tap for the player's level. Page 2 is the normal song-ready screen of the app (App.tsx opens the easiest short song through chooseSong;
   there is NO second song player). Page 3 (tip): after the song, 1-2 sentences of coach advice from the result, the trial status and "next lesson". Every page has Skip. The tip is rule-based and local: it
   spends no AI budget. Play build: no price anywhere (this file never prints one). Lazy-loaded by App.tsx. */
import { pickT } from "./lang-extra";
export type Level = "none" | "little" | "played";
export function firstRunTip(lang: string, acc: number, stars: number): string {
  const T = (th: string, en: string, zh: string) => pickT(lang, th, en, zh);
  if (acc >= 90 || stars >= 3) return T("เยี่ยมมาก! จังหวะแม่นเลย ลองบทเรียนถัดไปเพื่อฝึกให้คล่องขึ้นอีกนิด", "Lovely! Your timing is solid. Try the next lesson to build on it.", "太棒了！节奏很稳。试试下一课继续进步。");
  if (acc >= 60 || stars >= 1) return T("ทำได้ดีเลย! ท่อนที่พลาดลองเล่นช้าลงสักนิดแล้วเล่นซ้ำ จะแม่นขึ้นเร็วมาก", "Nice work! Slow the tempo a little on the bars you missed and replay them — accuracy comes fast.", "做得不错！失误的小节放慢速度再弹一遍，很快就会更准。");
  return T("ไม่เป็นไร ทุกคนเริ่มจากตรงนี้ ลองลดความเร็วแล้วเล่นช้า ๆ ทีละโน้ต บทเรียนถัดไปจะพาไปทีละก้าว", "No worries — everyone starts here. Slow it down and play one note at a time; the next lesson takes you step by step.", "没关系，大家都从这里开始。放慢速度，一个音一个音地弹，下一课会一步步带你。");
}
export default function FirstRun({ step, lang, daysLeft, showTrial, tip, onLevel, onSkip, onNext }: { step: "welcome" | "tip"; lang: string; daysLeft: number; showTrial: boolean; tip: string; onLevel: (l: Level) => void; onSkip: () => void; onNext: () => void }) {
  const T = (th: string, en: string, zh: string) => pickT(lang, th, en, zh);
  const trialLine = T("คุณได้ทดลอง Pro ฟรี 7 วัน ไม่ต้องผูกบัตร", "You have a free 7-day Pro trial — no card needed", "你已获得 7 天 Pro 免费试用，无需绑卡");
  if (step === "welcome") return (
    <div className="setov" data-first-run="welcome" style={{ zIndex: 1300 }}>
      <div className="setcard" role="dialog" aria-modal="true" aria-label="TIGA ALPHA" style={{ maxWidth: 360, outline: "none" }}>
        <div className="sethdr"><span>🎹 TIGA ALPHA</span><button className="cbtn" data-first-run-skip onClick={onSkip}>{T("ข้าม", "Skip", "跳过")}</button></div>
        <div className="setbody" style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch", padding: "6px 6px 14px" }}>
          <div style={{ textAlign: "center", fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>{T("ยินดีต้อนรับสู่ TIGA ALPHA", "Welcome to TIGA ALPHA", "欢迎来到 TIGA ALPHA")}</div>
          {showTrial && <div style={{ textAlign: "center", fontSize: 13.5, fontWeight: 700, color: "var(--clay-ink, #a8502f)" }}>{trialLine}</div>}
          <div style={{ textAlign: "center", fontSize: 13.5, opacity: 0.8 }}>{T("เล่นเปียโนมาก่อนไหม? แตะเลือกได้เลย แล้วเราจะเปิดเพลงสั้น ๆ ให้ลองเล่นทันที", "Have you played piano before? Tap one — we will open a very short song for you right away.", "你以前弹过钢琴吗？点一下，我们马上为你打开一首很短的曲子。")}</div>
          <button type="button" className="songbtn go" data-first-run-level="none" onClick={() => onLevel("none")}>{T("ไม่เคยเล่นเลย", "Never played", "从没弹过")}</button>
          <button type="button" className="songbtn" data-first-run-level="little" onClick={() => onLevel("little")}>{T("เล่นได้นิดหน่อย", "A little", "会一点")}</button>
          <button type="button" className="songbtn" data-first-run-level="played" onClick={() => onLevel("played")}>{T("เล่นได้แล้ว", "I can play", "已经会弹")}</button>
        </div>
      </div>
    </div>
  );
  return (
    <div className="gvalue" data-first-run="tip" role="region" aria-label="TIGA ALPHA">
      <div className="gvalue-t">{tip}</div>
      {showTrial && daysLeft > 0 && <div className="gvalue-t" style={{ fontWeight: 600, opacity: 0.85 }}>{T("ทดลอง Pro ฟรี: เหลือ " + daysLeft + " วัน", "Free Pro trial: " + daysLeft + " day" + (daysLeft === 1 ? "" : "s") + " left", "Pro 免费试用：还剩 " + daysLeft + " 天")}</div>}
      <div className="gvalue-act">
        <button type="button" className="gvalue-go" data-first-run-next onClick={onNext}>{T("ไปบทเรียนถัดไป", "Go to the next lesson", "去下一课")}</button>
        <button type="button" className="gvalue-x" data-first-run-skip onClick={onSkip}>{T("ข้าม", "Skip", "跳过")}</button>
      </div>
    </div>
  );
}
