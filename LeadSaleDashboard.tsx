import { useState, useEffect } from "react";
import { sb } from "./supabase-client";

/* ── LeadSaleDashboard.tsx ──
   Lead management dashboard organized by 3 product types:
   1. Private Live Course (1-on-1) — ฿27,000
   2. Video Course — ฿990 / ฿1,490
   3. TIGA AI — Free (currently)

   Shows lead counts, conversion rates, and quick actions per product type. */

type LeadStats = {
  total: number;
  newLeads: number;
  contacted: number;
  converted: number;
  revenue: number;
};

type ProductType = {
  id: string;
  icon: string;
  nameTh: string;
  nameEn: string;
  nameZh: string;
  price: string;
  priceNote: string;
  color: string;
  features: string[];
};

const PRODUCTS: ProductType[] = [
  {
    id: "private",
    icon: "🎹",
    nameTh: "คอร์สเรียนสด Private ตัวต่อตัว",
    nameEn: "Private Live Course (1-on-1)",
    nameZh: "私人直播课程（一对一）",
    price: "฿27,000",
    priceNote: "ต่อคอร์ส",
    color: "#d97757",
    features: [
      "เรียนสดตัวต่อตัวกับครูมืออาชีพ",
      "ปรับตารางเรียนตามสะดวก",
      "Feedback แบบ Real-time",
      "เหมาะสำหรับผู้ที่ต้องการความใส่ใจเต็มที่",
    ],
  },
  {
    id: "video",
    icon: "🎬",
    nameTh: "คอร์สวิดีโอ",
    nameEn: "Video Course",
    nameZh: "视频课程",
    price: "฿990 – ฿1,490",
    priceNote: "ต่อคอร์ส",
    color: "#6a9bcc",
    features: [
      "เรียนได้ทุกที่ ทุกเวลา",
      "ดูซ้ำได้ไม่จำกัด",
      "มี 2 ระดับ: พื้นฐาน ฿990 / ขั้นสูง ฿1,490",
      "เหมาะสำหรับผู้เริ่มต้นที่มีงบจำกัด",
    ],
  },
  {
    id: "app",
    icon: "📱",
    nameTh: "TIGA AI",
    nameEn: "TIGA AI (Free)",
    nameZh: "Tiger AI 应用（免费）",
    price: "ฟรี",
    priceNote: "เปิดให้ใช้ฟรีในตอนนี้",
    color: "#788c5d",
    features: [
      "AI ครูสอนเปียโนส่วนตัว",
      "เรียนฟรี ไม่มีค่าใช้จ่าย",
      "พร้อมใช้งานทันทีบนมือถือ",
      "ช่องทางหลักในการสร้าง Lead ใหม่",
    ],
  },
];

export function LeadSaleDashboard({ lang = "th" }: { lang?: string }) {
  const [stats, setStats] = useState<Record<string, LeadStats>>({});
  const [loading, setLoading] = useState(true);

  const t = {
    th: {
      title: "🎯 Lead Sale Dashboard",
      subtitle: "จัดการ Lead ตามประเภทสินค้า",
      totalLeads: "Lead ทั้งหมด",
      newLeads: "Lead ใหม่",
      contacted: "ติดต่อแล้ว",
      converted: "ปิดการขาย",
      revenue: "รายได้",
      baht: "฿",
      noData: "ยังไม่มีข้อมูล",
      addLead: "+ เพิ่ม Lead",
      viewLeads: "ดู Lead ทั้งหมด",
      quickActions: "การทำงานด่วน",
      followUp: "📞 ติดตาม",
      sendInfo: "📩 ส่งข้อมูล",
      createCampaign: "📣 สร้างแคมเปญ",
    },
    en: {
      title: "🎯 Lead Sale Dashboard",
      subtitle: "Manage leads by product type",
      totalLeads: "Total Leads",
      newLeads: "New Leads",
      contacted: "Contacted",
      converted: "Converted",
      revenue: "Revenue",
      baht: "฿",
      noData: "No data yet",
      addLead: "+ Add Lead",
      viewLeads: "View All Leads",
      quickActions: "Quick Actions",
      followUp: "📞 Follow Up",
      sendInfo: "📩 Send Info",
      createCampaign: "📣 Create Campaign",
    },
    zh: {
      title: "🎯 销售线索仪表板",
      subtitle: "按产品类型管理线索",
      totalLeads: "总线索",
      newLeads: "新线索",
      contacted: "已联系",
      converted: "已转化",
      revenue: "收入",
      baht: "฿",
      noData: "暂无数据",
      addLead: "+ 添加线索",
      viewLeads: "查看全部线索",
      quickActions: "快捷操作",
      followUp: "📞 跟进",
      sendInfo: "📩 发送资料",
      createCampaign: "📣 创建活动",
    },
  };

  const c = t[lang] || t.th;

  useEffect(() => {
    // Load stats from localStorage (placeholder — will connect to Supabase later)
    const stored = localStorage.getItem("tiga_lead_stats");
    if (stored) {
      try { setStats(JSON.parse(stored)); } catch (e) {}
    }
    // Initialize empty stats for each product if not present
    const defaults: Record<string, LeadStats> = {};
    for (const p of PRODUCTS) {
      defaults[p.id] = stats[p.id] || { total: 0, newLeads: 0, contacted: 0, converted: 0, revenue: 0 };
    }
    setStats(prev => ({ ...defaults, ...prev }));
    setLoading(false);
  }, []);

  function renderStatCard(label: string, value: string | number, icon: string) {
    return (
      <div style={{
        padding: "14px 12px", borderRadius: 12,
        background: "rgba(255,255,255,0.05)", textAlign: "center", flex: 1, minWidth: 80,
      }}>
        <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#ffd23f" }}>{value}</div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{label}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 2px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>{c.title}</h2>
        <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>{c.subtitle}</p>
      </div>

      {/* Product Type Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {PRODUCTS.map((product) => {
          const s = stats[product.id] || { total: 0, newLeads: 0, contacted: 0, converted: 0, revenue: 0 };
          return (
            <div key={product.id} style={{
              borderRadius: 16, overflow: "hidden",
              border: `1px solid ${product.color}33`,
              background: "rgba(255,255,255,0.03)",
            }}>
              {/* Product Header */}
              <div style={{
                padding: "16px 18px",
                background: `linear-gradient(135deg, ${product.color}22, ${product.color}11)`,
                borderBottom: `1px solid ${product.color}22`,
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{ fontSize: 36 }}>{product.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{lang === "th" ? product.nameTh : lang === "zh" ? product.nameZh : product.nameEn}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{
                      fontSize: 20, fontWeight: 800, color: product.color,
                    }}>{product.price}</span>
                    <span style={{ fontSize: 11, opacity: 0.5 }}>{product.priceNote}</span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ padding: "14px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {renderStatCard(c.totalLeads, s.total, "📊")}
                {renderStatCard(c.newLeads, s.newLeads, "🆕")}
                {renderStatCard(c.contacted, s.contacted, "📞")}
                {renderStatCard(c.converted, s.converted, "✅")}
              </div>

              {/* Features */}
              <div style={{ padding: "0 16px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.5, marginBottom: 6 }}>คุณสมบัติ</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {product.features.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, opacity: 0.7, display: "flex", gap: 6 }}>
                      <span style={{ color: product.color }}>•</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{
                padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex", gap: 8, flexWrap: "wrap",
              }}>
                <button style={{
                  padding: "6px 14px", borderRadius: 8, border: "none",
                  background: product.color, color: "#fff", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", flex: 1,
                }}>{c.addLead}</button>
                <button style={{
                  padding: "6px 14px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
                  color: "#fff", fontSize: 12, cursor: "pointer",
                }}>{c.followUp}</button>
                <button style={{
                  padding: "6px 14px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
                  color: "#fff", fontSize: 12, cursor: "pointer",
                }}>{c.sendInfo}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div style={{
        marginTop: 20, padding: 16, borderRadius: 12,
        background: "rgba(255,210,63,0.08)", border: "1px solid rgba(255,210,63,0.15)",
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📈 สรุป Lead ทั้งหมด</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 11, opacity: 0.5 }}>ทั้งหมด</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#ffd23f" }}>
              {Object.values(stats).reduce((a, s) => a + (s?.total || 0), 0)}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 11, opacity: 0.5 }}>ปิดการขาย</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80" }}>
              {Object.values(stats).reduce((a, s) => a + (s?.converted || 0), 0)}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 11, opacity: 0.5 }}> Conversion Rate</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#6a9bcc" }}>
              {(() => {
                const total = Object.values(stats).reduce((a, s) => a + (s?.total || 0), 0);
                const converted = Object.values(stats).reduce((a, s) => a + (s?.converted || 0), 0);
                return total > 0 ? `${Math.round((converted / total) * 100)}%` : "–";
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
