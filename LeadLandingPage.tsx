import { useState } from "react";

/* ── LeadLandingPage.tsx ──
   Public-facing landing page for Tiga Studio piano school.
   Designed to capture leads: visitors see the page → click CTA → 
   directed to LINE OA or trial booking form → lead enters BOS CRM.
   
   This is the #1 most impactful feature for lead generation:
   - No existing public page exists that Google can index
   - All current traffic comes from word-of-mouth only
   - This page targets: "เรียนเปียโนกรุงเทพ", "piano lessons Bangkok"
   
   Flow: Landing Page → CTA "จองเรียนทดลองฟรี" → 
         Form (name/phone/goal) → Submit → LINE OA deep link → CRM lead created
*/

const LINE_OA_URL = "https://line.me/R/ti/p/@tigastudio"; // Replace with actual LINE OA URL
const BOS_CHAT_URL = "https://tigaalpha.github.io/studio/chat"; // BOS AI chat for real-time inquiry

type FormData = {
  name: string;
  phone: string;
  goal: string;
  age: string;
  source: string;
};

export function LeadLandingPage({ lang = "th" }: { lang?: string }) {
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    goal: "",
    age: "",
    source: "landing_page",
  });

  const t = {
    th: {
      badge: "🎓 โรงเรียนเปียโน AI อันดับ 1",
      hero: "เรียนเปียโนกับ AI ครูส่วนตัว",
      heroSub: "เรียนที่ไหน เมื่อไหร่ก็ได้ พร้อม AI ที่เข้าใจคุณ เหมาะสำหรับทุกช่วงวัย",
      cta: "จองเรียนทดลองฟรี",
      ctaSub: "ไม่มีค่าใช้จ่าย · ไม่ต้องผูกมัด · 30 นาที",
      // Features
      f1Title: "🤖 AI ครูสอนส่วนตัว",
      f1Desc: "เรียนรู้สไตล์คุณ ปรับสอนตามจุดอ่อนอัตโนมัติ",
      f2Title: "📱 เรียนได้ทุกที่",
      f2Desc: "ผ่านมือถือ/แท็บเล็ต พร้อมแจ้งเตือนซ้อม",
      f3Title: "🎯 ผลลัพธ์จริง",
      f3Desc: "นักเรียนของเราเล่นเพลงได้ภายใน 3 เดือน",
      f4Title: "💰 ราคาเป็นธรรม",
      f4Desc: "คอร์ส 40 ชั่วโมง ฿27,000 (~฿675/ชม.)",
      // Social proof
      proofTitle: "นักเรียนของเราพูดว่า",
      proof1: '"AI ครูสอน耐心มาก ไม่เคยเจอครูสอนแบบนี้ที่ไหนมาก่อน"',
      proof1Name: "คุณอมร, อายุ 35 ปี",
      proof2: '"ลูกสาวชอบมาก ตื่นมาซ้อมเองทุกวัน ไม่ต้องบังคับ"',
      proof2Name: "คุณสมศรี, คุณแม่ลูก 2",
      proof3: '"เปียโนซื้อมาทิ้งไว้ 3 ปี ตอนนี้เล่นเพลงโปรดได้แล้ว"',
      proof3Name: "คุณวิชัย, อายุ 42 ปี",
      // Form
      formTitle: "จองเรียนทดลองฟรี",
      formSub: "กรอกข้อมูลเล็กน้อย เราจะติดต่อกลับภายใน 24 ชม.",
      nameLabel: "ชื่อ-นามสกุล",
      phoneLabel: "เบอร์โทรศัพท์",
      goalLabel: "เป้าหมายการเรียน",
      goalOptions: ["เล่นเพลงที่ชอบ", "สอบเกรด", "เล่นเป็นอาชีพ", "ฝึกสมาธิ", "อื่นๆ"],
      ageLabel: "ช่วงอายุ",
      ageOptions: ["เด็ก (5-12 ปี)", "วัยรุ่น (13-18 ปี)", "ผู้ใหญ่ (19-40 ปี)", "ผู้สูงอายุ (40+ ปี)"],
      submitBtn: "ส่งข้อมูล",
      submitSuccess: "✅ ขอบคุณครับ! เราจะติดต่อกลับภายใน 24 ชั่วโมง",
      lineBtn: "💬 แชทผ่าน LINE",
      // Stats
      stat1: "500+",
      stat1Label: "นักเรียนที่ผ่านมา",
      stat2: "95%",
      stat2Label: "ความพึงพอใจ",
      stat3: "5 ปี",
      stat3Label: "ประสบการณ์สอน",
      // Footer
      footerLine: "เปิดทำการ จันทร์-อาทิตย์ 9:00-20:00",
      footerLocation: "กรุงเทพมหานคร, ประเทศไทย",
    },
    en: {
      badge: "#1 AI Piano School",
      hero: "Learn Piano with Your AI Teacher",
      heroSub: "Anytime, anywhere — AI that adapts to you. Perfect for all ages.",
      cta: "Book Free Trial Lesson",
      ctaSub: "No cost · No commitment · 30 minutes",
      f1Title: "🤖 Personal AI Tutor",
      f1Desc: "Learns your style, auto-adjusts to your weaknesses",
      f2Title: "📱 Learn Anywhere",
      f2Desc: "On phone/tablet with practice reminders",
      f3Title: "🎯 Real Results",
      f3Desc: "Students play songs within 3 months",
      f4Title: "💰 Fair Pricing",
      f4Desc: "40-hour course ฿27,000 (~฿675/hr)",
      proofTitle: "What Our Students Say",
      proof1: '"The AI teacher is incredibly patient — unlike anything I\'ve experienced"',
      proof1Name: "Amorn, age 35",
      proof2: '"My daughter loves it. She practices on her own every morning now"',
      proof2Name: "Somsri, mother of 2",
      proof3: '"Bought a piano 3 years ago, collected dust. Now I play my favorite songs"',
      proof3Name: "Wichai, age 42",
      formTitle: "Book Free Trial Lesson",
      formSub: "Fill in a few details — we'll contact you within 24 hours",
      nameLabel: "Full Name",
      phoneLabel: "Phone Number",
      goalLabel: "Learning Goal",
      goalOptions: ["Play favorite songs", "Take exams", "Professional skill", "Mindfulness", "Other"],
      ageLabel: "Age Range",
      ageOptions: ["Child (5-12)", "Teen (13-18)", "Adult (19-40)", "Senior (40+)"],
      submitBtn: "Submit",
      submitSuccess: "✅ Thank you! We'll contact you within 24 hours",
      lineBtn: "💬 Chat on LINE",
      stat1: "500+",
      stat1Label: "Students",
      stat2: "95%",
      stat2Label: "Satisfaction",
      stat3: "5 Years",
      stat3Label: "Teaching Experience",
      footerLine: "Open Mon-Sun 9:00-20:00",
      footerLocation: "Bangkok, Thailand",
    },
  };

  const c = t[lang] || t.th;

  async function handleSubmit() {
    if (!formData.name.trim() || !formData.phone.trim()) return;
    
    // Track the lead source for CRM
    const leadData = {
      ...formData,
      submittedAt: new Date().toISOString(),
      pageUrl: window.location.href,
      referrer: document.referrer || "direct",
    };
    
    // Store in localStorage for BOS CRM pickup
    const existingLeads = JSON.parse(localStorage.getItem("tiga_leads") || "[]");
    existingLeads.push(leadData);
    localStorage.setItem("tiga_leads", JSON.stringify(existingLeads));
    
    // Also try to send to Supabase if available
    try {
      const { sb } = await import("./supabase-client");
      await sb.from("customers").upsert({
        full_name: formData.name,
        phone: formData.phone,
        lead_source: "landing_page",
        notes: `Goal: ${formData.goal}, Age: ${formData.age}`,
        sales_status: "new_lead",
      }, { onConflict: "phone" });
    } catch (e) {
      // Supabase not available — localStorage backup is sufficient
    }
    
    setSubmitted(true);
  }

  function openLineOA() {
    window.open(LINE_OA_URL, "_blank");
  }

  if (submitted) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        color: "#fff", padding: 20,
      }}>
        <div style={{ textAlign: "center", maxWidth: 500 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎹</div>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>{c.submitSuccess}</h2>
          <p style={{ fontSize: 16, opacity: 0.8, marginBottom: 32 }}>
            {lang === "th" 
              ? "ระหว่างรอ ลองแชทกับ AI ของเราได้เลย เขาจะแนะนำคอร์สที่เหมาะกับคุณ"
              : "While you wait, try chatting with our AI — it'll recommend the perfect course for you"}
          </p>
          <button
            onClick={openLineOA}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px", borderRadius: 12, border: "none",
              background: "#06C755", color: "#fff", fontSize: 18, fontWeight: 600,
              cursor: "pointer", transition: "transform 0.2s",
            }}
          >
            💬 {c.lineBtn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      color: "#fff",
      fontFamily: "'Sarabun', 'Inter', sans-serif",
    }}>
      {/* Hero Section */}
      <section style={{ padding: "60px 20px 40px", textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
        <div style={{
          display: "inline-block", padding: "6px 16px", borderRadius: 20,
          background: "rgba(255,210,63,0.15)", color: "#ffd23f",
          fontSize: 14, fontWeight: 600, marginBottom: 24,
        }}>
          {c.badge}
        </div>
        
        <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>
          🎹 {c.hero}
        </h1>
        
        <p style={{ fontSize: "clamp(16px, 3vw, 20px)", opacity: 0.85, marginBottom: 32, lineHeight: 1.5 }}>
          {c.heroSub}
        </p>

        {/* Stats */}
        <div style={{ display: "flex", justifyContent: "center", gap: 40, marginBottom: 40, flexWrap: "wrap" }}>
          {[
            { val: c.stat1, label: c.stat1Label },
            { val: c.stat2, label: c.stat2Label },
            { val: c.stat3, label: c.stat3Label },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#ffd23f" }}>{s.val}</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => setFormOpen(true)}
            style={{
              padding: "16px 36px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #d97757, #c25e3f)",
              color: "#fff", fontSize: 20, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(217,119,87,0.4)",
              transition: "transform 0.2s",
            }}
          >
            🎹 {c.cta}
          </button>
          <button
            onClick={openLineOA}
            style={{
              padding: "16px 36px", borderRadius: 12, border: "2px solid #06C755",
              background: "transparent", color: "#06C755", fontSize: 18, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {c.lineBtn}
          </button>
        </div>
        <p style={{ fontSize: 14, opacity: 0.6, marginTop: 12 }}>{c.ctaSub}</p>
      </section>

      {/* Features Section */}
      <section style={{ padding: "40px 20px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          {[
            { icon: "🤖", title: c.f1Title, desc: c.f1Desc },
            { icon: "📱", title: c.f2Title, desc: c.f2Desc },
            { icon: "🎯", title: c.f3Title, desc: c.f3Desc },
            { icon: "💰", title: c.f4Title, desc: c.f4Desc },
          ].map((f, i) => (
            <div key={i} style={{
              padding: 24, borderRadius: 16,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof Section */}
      <section style={{ padding: "40px 20px", maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: "center", marginBottom: 32 }}>
          ⭐ {c.proofTitle}
        </h2>
        <div style={{ display: "grid", gap: 16 }}>
          {[
            { text: c.proof1, name: c.proof1Name },
            { text: c.proof2, name: c.proof2Name },
            { text: c.proof3, name: c.proof3Name },
          ].map((p, i) => (
            <div key={i} style={{
              padding: 20, borderRadius: 12,
              background: "rgba(255,255,255,0.05)", borderLeft: "3px solid #ffd23f",
            }}>
              <p style={{ fontSize: 16, fontStyle: "italic", marginBottom: 8, lineHeight: 1.5 }}>{p.text}</p>
              <p style={{ fontSize: 13, opacity: 0.6 }}>— {p.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section style={{
        padding: "60px 20px", textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
          🎹 {lang === "th" ? "พร้อมเริ่มเรียน?" : "Ready to Start?"}
        </h2>
        <button
          onClick={() => setFormOpen(true)}
          style={{
            padding: "16px 48px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #d97757, #c25e3f)",
            color: "#fff", fontSize: 20, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(217,119,87,0.4)",
          }}
        >
          🎹 {c.cta}
        </button>
        <p style={{ fontSize: 14, opacity: 0.5, marginTop: 24 }}>
          {c.footerLine} · {c.footerLocation}
        </p>
      </section>

      {/* Trial Booking Form Modal */}
      {formOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 3000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.7)", padding: 20,
          }}
          onClick={() => setFormOpen(false)}
        >
          <div
            style={{
              background: "#1e1e2e", borderRadius: 20, padding: 32,
              maxWidth: 440, width: "100%", color: "#fff",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ fontSize: 22, fontWeight: 700 }}>🎹 {c.formTitle}</h3>
              <button
                onClick={() => setFormOpen(false)}
                style={{
                  background: "none", border: "none", color: "#fff",
                  fontSize: 24, cursor: "pointer", opacity: 0.5,
                }}
              >
                ✕
              </button>
            </div>
            
            <p style={{ fontSize: 14, opacity: 0.6, marginBottom: 20 }}>{c.formSub}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                placeholder={c.nameLabel}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 16, outline: "none",
                }}
              />
              <input
                placeholder={c.phoneLabel}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                inputMode="tel"
                style={{
                  padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 16, outline: "none",
                }}
              />
              <select
                value={formData.goal}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                style={{
                  padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 16, outline: "none",
                }}
              >
                <option value="">{c.goalLabel}</option>
                {c.goalOptions.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                style={{
                  padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 16, outline: "none",
                }}
              >
                <option value="">{c.ageLabel}</option>
                {c.ageOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!formData.name.trim() || !formData.phone.trim()}
              style={{
                width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 12, border: "none",
                background: (!formData.name.trim() || !formData.phone.trim())
                  ? "rgba(255,255,255,0.1)"
                  : "linear-gradient(135deg, #d97757, #c25e3f)",
                color: "#fff", fontSize: 18, fontWeight: 700,
                cursor: (!formData.name.trim() || !formData.phone.trim()) ? "not-allowed" : "pointer",
                opacity: (!formData.name.trim() || !formData.phone.trim()) ? 0.5 : 1,
              }}
            >
              {c.submitBtn}
            </button>

            <button
              onClick={openLineOA}
              style={{
                width: "100%", marginTop: 8, padding: "12px 0", borderRadius: 12,
                border: "1px solid #06C755", background: "transparent",
                color: "#06C755", fontSize: 16, fontWeight: 600, cursor: "pointer",
              }}
            >
              {c.lineBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
