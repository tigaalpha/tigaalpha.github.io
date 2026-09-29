/* ── admin-nav.tsx — split out of AdminAIModels.tsx (plan v3 1.5) ──
   AdminNav renders on EVERY admin page but AdminAIModels pulls the whole
   tigamodel hub into the main chunk. The nav + its group data are pure UI,
   so they live here; AdminAIModels imports them (one copy, no drift) and the
   nav no longer drags the model in. ── */

import { useState } from "react";

const ADMIN_NAV_GROUPS = [
  { id: "ai", icon: "🤖", th: "AI และคอนเทนต์", en: "AI & Content", zh: "AI 与内容", items: [
    { id: "ai", icon: "🤖", tier: 3, th: "สอน AI", en: "Teach AI", zh: "训练 AI" },
    { id: "aimodel", icon: "🧠", tier: 3, th: "โมเดล AI", en: "AI Models", zh: "AI 模型" },
    { id: "tigamodel", icon: "🧪", tier: 3, th: "TIGA Model Lab", en: "TIGA Model Lab", zh: "TIGA 模型实验室" },
    { id: "tigabackoffice", icon: "🧠", tier: 3, th: "หลังบ้าน TIGA", en: "TIGA Back Office", zh: "TIGA 后台" },
    { id: "videos", icon: "🎬", tier: 3, th: "วิดีโอ", en: "Videos", zh: "视频" },
    { id: "autoteach", icon: "⏱️", tier: 2, th: "ตั้งเวลาสอน", en: "Auto Teaching", zh: "自动教学" },
  ]},
  { id: "people", icon: "👥", th: "ผู้เรียนและโรงเรียน", en: "Learners & Schools", zh: "学员与学校", items: [
    { id: "students", icon: "👥", tier: 0, th: "นักเรียน", en: "Students", zh: "学生" },
    { id: "schools", icon: "🏫", tier: 0, th: "โรงเรียน", en: "Schools", zh: "学校" },
  ]},
  { id: "business", icon: "💰", th: "ธุรกิจ", en: "Business", zh: "业务", items: [
    { id: "payments", icon: "💳", tier: 3, th: "ชำระเงิน", en: "Payments", zh: "付款" },
    { id: "analytics", icon: "📊", tier: 3, th: "สถิติ", en: "Analytics", zh: "统计" },
    { id: "activity", icon: "📈", tier: 3, th: "กิจกรรมผู้ใช้", en: "User Activity", zh: "用户活动" },
    { id: "anonvisit", icon: "👁️", tier: 3, th: "ผู้เข้าชม (ยังไม่ล็อกอิน)", en: "Visitors (not logged in)", zh: "未登录访客" },
    { id: "simbots", icon: "🤖", tier: 3, th: "ข้อมูลจำลอง", en: "Demo Bots", zh: "模拟数据" },
  ]},
  { id: "leadsale", icon: "🎯", th: "Lead Sale", en: "Lead Sale", zh: "获客与销售", items: [
    { id: "leadsale", icon: "📊", tier: 0, th: "แดชบอร์ด Lead", en: "Lead Dashboard", zh: "线索仪表板" },
    { id: "leadlanding", icon: "🌐", tier: 0, th: "Landing Page", en: "Landing Page", zh: "落地页" },
    { id: "leadreferral", icon: "🎁", tier: 0, th: "แนะนำเพื่อน", en: "Referral", zh: "推荐奖励" },
    { id: "leadquiz", icon: "🎵", tier: 0, th: "Quiz ระดับเปียโน", en: "Piano Level Quiz", zh: "钢琴等级测试" },
  ]},
  { id: "engage", icon: "📣", th: "การตลาดและกิจกรรม", en: "Marketing & Events", zh: "营销与活动", items: [
    { id: "broadcast", icon: "📢", tier: 3, th: "ประกาศ", en: "Broadcast", zh: "公告" },
    { id: "weeklyreport", icon: "📊", tier: 3, th: "รายงานรายสัปดาห์", en: "Weekly Report", zh: "周报告" },
    { id: "event", icon: "🎉", tier: 3, th: "อีเว้นท์", en: "Event", zh: "活动" },
    { id: "games", icon: "🎮", tier: 3, th: "เกม", en: "Games", zh: "游戏" },
  ]},
];

export function AdminNav({ lang, tier, adminTab, setAdminTab }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [open, setOpen] = useState(false);
  const flat = ADMIN_NAV_GROUPS.flatMap(g => g.items);
  const cur = flat.find(i => i.id === adminTab) || flat[0];
  return (
    <div className="adminnav">
      <button className="adminnav-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}
        aria-label={T("เมนูแอดมิน", "Admin menu", "管理菜单")}>
        <span className="adminnav-burger">☰</span>
        <span className="adminnav-cur">{cur.icon} {T(cur.th, cur.en, cur.zh)}</span>
        <span className="adminnav-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          <div className="adminnav-scrim" onClick={() => setOpen(false)} />
          <div className="adminnav-pop">
            {ADMIN_NAV_GROUPS.map(g => (
              <div className="adminnav-group" key={g.id}>
                <div className="adminnav-gh">{g.icon} {T(g.th, g.en, g.zh)}</div>
                <div className="adminnav-items">
                  {g.items.filter(it => tier >= it.tier).map(it => (
                    <button key={it.id} className={`adminnav-item${adminTab === it.id ? " on" : ""}`}
                      onClick={() => { setAdminTab(it.id); setOpen(false); }}>
                      <span className="adminnav-ic">{it.icon}</span>
                      <span className="adminnav-lb">{T(it.th, it.en, it.zh)}</span>
                      {adminTab === it.id && <span className="adminnav-dot" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
