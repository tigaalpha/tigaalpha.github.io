export const LANG_STORAGE_KEY = "tiga-bos-lang";

export type Lang = "th" | "en";

export function getStoredLang(): Lang | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return stored === "th" || stored === "en" ? stored : null;
}

export function setStoredLang(lang: Lang) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // private-mode / storage-full — the in-memory choice still applies for this session
  }
}

/**
 * Inline script string, run before paint (same technique as THEME_INIT_SCRIPT).
 * Sets <html lang> and — when the stored choice differs from the server-rendered
 * default ("th") — marks the document data-lang-pending so globals.css keeps the
 * body invisible until the LanguageProvider effect has applied the stored
 * language. Without this, an English device renders the Thai static HTML first
 * and visibly flips to English a beat later (the exact "language switching feels
 * broken" symptom the owner reported). The 250ms self-heal timeout is the safety
 * net: if React never mounts (crash, old cached bundle), the page reveals in the
 * default language instead of staying blank forever.
 */
export const LANG_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem("${LANG_STORAGE_KEY}");
    var lang = stored === "en" ? "en" : "th";
    document.documentElement.lang = lang;
    if (lang === "en") {
      var de = document.documentElement;
      de.setAttribute("data-lang-pending", "en");
      setTimeout(function() { de.removeAttribute("data-lang-pending"); }, 250);
    }
  } catch (e) {}
})();
`;

/**
 * UI chrome dictionary — everything rendered by the app shell (sidebar,
 * topbar, user menu, login, settings language card). Page bodies stay as
 * they are for now; new strings should be added here rather than hardcoded.
 */
export const DICT = {
  // ── Top-level nav ────────────────────────────────────────────────────────
  "nav.aiAutomationChat": { th: "แชท AI อัตโนมัติ", en: "AI Automation Chat" },
  "nav.dashboard": { th: "แดชบอร์ด", en: "Dashboard" },
  "nav.marketingDashboard": { th: "แดชบอร์ดการตลาด", en: "Marketing Dashboard" },
  "nav.calendar": { th: "ปฏิทิน", en: "Calendar" },
  "nav.notifications": { th: "การแจ้งเตือน", en: "Notifications" },

  // ── Nav groups ───────────────────────────────────────────────────────────
  "group.aiAgent": { th: "เอเจนต์ AI", en: "AI Agent" },
  "group.aiControl": { th: "ควบคุม AI", en: "AI Control" },
  "group.strategy": { th: "กลยุทธ์", en: "Strategy" },
  "group.leadSale": { th: "ขายลีด", en: "Lead Sale" },
  "group.salesCrm": { th: "เซลส์และ CRM", en: "Sales & CRM" },
  "group.marketing": { th: "การตลาด", en: "Marketing" },
  "group.content": { th: "คอนเทนต์", en: "Content" },
  "group.financeLegal": { th: "การเงินและกฎหมาย", en: "Finance & Legal" },
  "group.system": { th: "ระบบ", en: "System" },

  // ── AI Agent items ───────────────────────────────────────────────────────
  "nav.tigaAgent": { th: "เอเจนต์ TIGA AI", en: "TIGA AI Agent" },
  "nav.automation": { th: "ระบบอัตโนมัติ", en: "Automation" },
  "nav.aiCompany": { th: "บริษัท AI", en: "AI Company" },

  // ── AI Control items ─────────────────────────────────────────────────────
  "nav.aiControlPanel": { th: "แผงควบคุม AI", en: "AI Control Panel" },
  "nav.aiTaskRouter": { th: "จัดสรรงาน AI", en: "AI Task Router" },
  "nav.predictiveScoring": { th: "คะแนนคาดการณ์", en: "Predictive Scoring" },
  "nav.sentimentDashboard": { th: "แดชบอร์ดความรู้สึกลูกค้า", en: "Sentiment Dashboard" },
  "nav.aiSalesCoach": { th: "โค้ชเซลส์ AI", en: "AI Sales Coach" },
  "nav.smartScheduler": { th: "ตารางอัจฉริยะ", en: "Smart Scheduler" },
  "nav.aiPhoneCall": { th: "โทรศัพท์ AI", en: "AI Phone Call" },
  "nav.mimoAi": { th: "Mimo AI (OpenRouter)", en: "Mimo AI (OpenRouter)" },

  // ── Strategy items ───────────────────────────────────────────────────────
  "nav.aiStrategyRoom": { th: "ห้องกลยุทธ์ AI", en: "AI Strategy Room" },
  "nav.strategyActions": { th: "แผนปฏิบัติการ", en: "Strategy Actions" },
  "nav.chatbotBrain": { th: "สมองแชทบอท", en: "Chatbot Brain" },
  "nav.competitorAnalysis": { th: "วิเคราะห์คู่แข่ง", en: "Competitor Analysis" },

  // ── Lead Sale items ──────────────────────────────────────────────────────
  "nav.leadDashboard": { th: "แดชบอร์ด Lead", en: "Lead Dashboard" },
  "nav.salesFunnel": { th: "กรวยการขาย", en: "Sales Funnel" },
  "nav.revenueAttribution": { th: "แหล่งที่มาของรายได้", en: "Revenue Attribution" },
  "nav.privateCourse": { th: "คอร์ส Private ตัวต่อตัว", en: "Private 1-on-1 Course" },
  "nav.videoCourse": { th: "คอร์สวิดีโอ", en: "Video Course" },
  "nav.tigaAiFree": { th: "TIGA AI (ฟรี)", en: "TIGA AI (Free)" },
  "nav.referralTracking": { th: "ติดตามการแนะนำ", en: "Referral Tracking" },
  "nav.leadQuiz": { th: "แบบทดสอบลีด", en: "Lead Quiz" },

  // ── Sales & CRM items ────────────────────────────────────────────────────
  "nav.inbox": { th: "กล่องข้อความ", en: "Inbox" },
  "nav.attendance": { th: "ยืนยันการมาเรียน", en: "Attendance" },
  "nav.students": { th: "นักเรียน / CRM", en: "Students / CRM" },
  "nav.salesPipeline": { th: "ไปป์ไลน์เซลส์", en: "Sales Pipeline" },
  "nav.bookings": { th: "การจองเรียน", en: "Bookings" },

  // ── Marketing items ──────────────────────────────────────────────────────
  "nav.marketingRoi": { th: "ผลตอบแทนการตลาด", en: "Marketing ROI" },
  "nav.aiWeeklyReport": { th: "รายงานรายสัปดาห์ AI", en: "AI Weekly Report" },
  "nav.abTestAi": { th: "ทดสอบ A/B AI", en: "A/B Test AI" },
  "nav.competitiveIntel": { th: "ข่าวกรองคู่แข่ง", en: "Competitive Intel" },
  "nav.competitiveAnalysis": { th: "วิเคราะห์คู่แข่ง", en: "Competitive Analysis" },
  "nav.conversionTracking": { th: "ติดตามการแปลง", en: "Conversion Tracking" },
  "nav.performanceDashboard": { th: "แดชบอร์ดผลงาน", en: "Performance Dashboard" },
  "nav.adCampaigns": { th: "แคมเปญโฆษณา", en: "Ad Campaigns" },
  "nav.marketingChannels": { th: "ช่องทางการตลาด", en: "Marketing Channels" },
  "nav.socialTrends": { th: "เทรนด์โซเชียล", en: "Social Trends" },
  "nav.marketingSkills": { th: "ทักษะการตลาด", en: "Marketing Skills" },
  "nav.landingPages": { th: "หน้าแลนดิง", en: "Landing Pages" },
  "nav.dripCampaign": { th: "แคมเปญ Drip", en: "Drip Campaign" },

  // ── Content items ────────────────────────────────────────────────────────
  "nav.aiAutoSchedule": { th: "ตารางโพสต์อัตโนมัติ", en: "AI Auto-Schedule" },
  "nav.autoPublish": { th: "ไปป์ไลน์โพสต์อัตโนมัติ", en: "Auto-Publish Pipeline" },
  "nav.contentRepurpose": { th: "รีไซเคิลคอนเทนต์", en: "Content Repurpose" },
  "nav.personalization": { th: "ปรับให้เหมาะกับลูกค้า", en: "Personalization" },
  "nav.contentOptimization": { th: "ปรับปรุงคอนเทนต์", en: "Content Optimization" },
  "nav.mobileContent": { th: "คอนเทนต์สำหรับมือถือ", en: "Mobile-First Content" },
  "nav.internalLinking": { th: "ลิงก์ภายใน", en: "Internal Linking" },
  "nav.knowledgeBase": { th: "ฐานความรู้", en: "Knowledge Base" },
  "nav.seoContent": { th: "คอนเทนต์ SEO/AEO", en: "SEO/AEO Content" },
  "nav.seoPublish": { th: "ไปป์ไลน์เผยแพร่ SEO", en: "SEO Publish Pipeline" },
  "nav.courseWriter": { th: "เขียนคอร์สออนไลน์", en: "Online Course Writer" },
  "nav.appAdKit": { th: "ชุดโฆษณาแอป", en: "App Ad Kit" },
  "nav.imageStudio": { th: "สตูดิโอภาพ", en: "Image Studio" },
  "nav.verticalVideo": { th: "วิดีโอแนวตั้ง", en: "Vertical Video" },
  "nav.voiceOver": { th: "สคริปต์บรรยาย", en: "Voice Over" },
  "nav.videoScriptWriter": { th: "เขียนสคริปต์วิดีโอ", en: "Video Script Writer" },
  "nav.postAllChannels": { th: "โพสต์ทุกช่องทาง", en: "Post to All Channels" },

  // ── Finance & Legal items ────────────────────────────────────────────────
  "nav.accounting": { th: "บัญชี", en: "Accounting" },
  "nav.receipts": { th: "ใบเสร็จ", en: "Receipts" },
  "nav.payments": { th: "การชำระเงิน", en: "Payments" },
  "nav.aiReceptionist": { th: "พนักงานต้อนรับ AI", en: "AI Receptionist" },
  "nav.autoTax": { th: "ภาษีอัตโนมัติ", en: "Auto Tax" },
  "nav.events": { th: "งานแสดง/กิจกรรม", en: "Events" },
  "nav.documentsContracts": { th: "เอกสาร/สัญญา", en: "Documents/Contracts" },
  "nav.reports": { th: "รายงาน", en: "Reports" },

  // ── System items ─────────────────────────────────────────────────────────
  "nav.controlCenter": { th: "ศูนย์ควบคุม", en: "Control Center" },
  "nav.aiCost": { th: "ต้นทุน AI", en: "AI Cost" },
  "nav.aiQuality": { th: "คุณภาพ AI", en: "AI Quality" },
  "nav.winback": { th: "ดึงลูกค้ากลับ", en: "Win-back" },
  "nav.approvals": { th: "การอนุมัติ", en: "Approvals" },
  "nav.dataHealth": { th: "สุขภาพข้อมูล", en: "Data Health" },
  "nav.systemHealth": { th: "สุขภาพระบบ", en: "System Health" },
  "nav.settings": { th: "ตั้งค่า", en: "Settings" },

  // ── Mobile bottom tabs ───────────────────────────────────────────────────
  "tab.students": { th: "นักเรียน", en: "Students" },
  "tab.messages": { th: "ข้อความ", en: "Messages" },
  "tab.more": { th: "เพิ่มเติม", en: "More" },

  // ── App shell / topbar ───────────────────────────────────────────────────
  "shell.openMenu": { th: "เปิดเมนู", en: "Open menu" },
  "shell.closeMenu": { th: "ปิดเมนู", en: "Close menu" },
  "shell.soloToFull": { th: "สลับไปโหมดเต็ม", en: "Switch to full mode" },
  "shell.soloToSolo": { th: "สลับไปโหมด Solo", en: "Switch to Solo mode" },
  "shell.soloHintFull": { th: "โหมด Solo — คลิกเพื่อดูเมนูทั้งหมด", en: "Solo mode — click to show all menus" },
  "shell.soloHintEnter": { th: "คลิกเพื่อเข้าโหมด Solo (ย่อเมนูให้เหลือแต่ที่ใช้ทุกวัน)", en: "Click to enter Solo mode (menu trimmed to daily essentials)" },
  "shell.advanced": { th: "ขั้นสูง", en: "Advanced" },

  // ── Roles ────────────────────────────────────────────────────────────────
  "role.owner": { th: "เจ้าของ", en: "Owner" },
  "role.admin": { th: "ผู้ดูแลระบบ", en: "Admin" },
  "role.teacher": { th: "ครู", en: "Teacher" },
  "role.staff": { th: "พนักงาน", en: "Staff" },
  "role.fallbackAdmin": { th: "ผู้ดูแลระบบ", en: "Admin" },

  // ── User menu ────────────────────────────────────────────────────────────
  "user.signOut": { th: "ออกจากระบบ", en: "Sign out" },

  // ── Theme toggle ─────────────────────────────────────────────────────────
  "theme.toLight": { th: "สลับเป็นโหมดสว่าง", en: "Switch to light mode" },
  "theme.toDark": { th: "สลับเป็นโหมดมืด", en: "Switch to dark mode" },

  // ── Language toggle / picker ─────────────────────────────────────────────
  "lang.toggleAria": { th: "เปลี่ยนภาษา", en: "Change language" },
  "lang.title": { th: "ภาษา", en: "Language" },
  "lang.desc": { th: "เลือกภาษาที่ใช้แสดงผลทั่วทั้งแอป — บันทึกไว้ในเครื่องนี้ทันที", en: "Choose the language used across the app — saved on this device instantly." },
  "lang.thName": { th: "ไทย", en: "ไทย" },
  "lang.enName": { th: "English", en: "English" },

  // ── Settings page ────────────────────────────────────────────────────────
  "page.settings": { th: "ตั้งค่า", en: "Settings" },
  "page.settingsSub": { th: "การตั้งค่าสตูดิโอ", en: "Studio configuration" },

  // ── Login ────────────────────────────────────────────────────────────────
  "login.subtitle": { th: "ลงชื่อเข้าใช้เพื่อจัดการสตูดิโอของคุณ", en: "Sign in to manage your studio" },
  "login.continueGoogle": { th: "ดำเนินการต่อด้วย Google", en: "Continue with Google" },
  "login.redirecting": { th: "กำลังเปลี่ยนเส้นทาง…", en: "Redirecting…" },
  "login.failed": { th: "ลงชื่อเข้าใช้ไม่สำเร็จ: ", en: "Sign-in failed: " },

  // ── Root error boundary ──────────────────────────────────────────────────
  "error.title": { th: "เกิดข้อผิดพลาดบางอย่าง", en: "Something went wrong" },
  "error.retry": { th: "ลองใหม่", en: "Retry" },

  // ── Dashboard page ───────────────────────────────────────────────────────
  "dash.greeting": { th: "สวัสดีตอนเช้า, Tiga! 👋", en: "Good morning, Tiga! 👋" },
  "dash.sub": { th: "นี่คือสิ่งที่เกิดขึ้นกับสตูดิโอของคุณวันนี้", en: "Here's what's happening with your school today." },
  "dash.totalStudents": { th: "นักเรียนทั้งหมด", en: "Total Students" },
  "dash.allTimeCrm": { th: "รวมทุกเวลาใน CRM", en: "All-time in CRM" },
  "dash.lessonsThisWeek": { th: "คาบเรียนสัปดาห์นี้", en: "Lessons This Week" },
  "dash.todayCount": { th: "{n} วันนี้", en: "{n} today" },
  "dash.revenue": { th: "รายรับ", en: "Revenue" },
  "dash.fromAccounting": { th: "จากฝั่งบัญชี", en: "From Accounting" },
  "dash.pendingPayments": { th: "รอยืนยันการชำระเงิน", en: "Pending Payments" },
  "dash.needConfirm": { th: "{n} รายการรอยืนยัน", en: "{n} need confirmation" },
  "dash.allClear": { th: "ชำระครบแล้ว", en: "All clear" },
  "dash.needsReview": { th: "รอตรวจสอบ", en: "Needs Review" },
  "dash.nearRenewal": { th: "ใกล้ต่ออายุ", en: "Near Renewal" },
  "dash.coursesEndingSoon": { th: "คอร์สจะหมดเร็ว ๆ นี้", en: "Courses ending soon" },
  "dash.newLeads": { th: "ลีดใหม่", en: "New Leads" },
  "dash.aiPerformance": { th: "ประสิทธิภาพ AI", en: "AI Performance" },
  "dash.resolvedNoEscalation": { th: "จบเองโดยไม่ต้องต่อคนจริง", en: "Resolved without escalation" },
  "dash.todaysLessons": { th: "คาบเรียนวันนี้", en: "Today's Lessons" },
  "dash.tomorrowsLessons": { th: "คาบเรียนพรุ่งนี้", en: "Tomorrow's Lessons" },
  "dash.loadFailed": { th: "โหลดข้อมูลแดชบอร์ดไม่สำเร็จ — ", en: "Failed to load dashboard — " },
  "dash.retry": { th: "ลองใหม่", en: "Retry" },

  // ── Lesson list card ─────────────────────────────────────────────────────
  "lesson.viewCalendar": { th: "ดูปฏิทิน", en: "View calendar" },
  "lesson.empty": { th: "ไม่มีคาบเรียนที่นัดไว้", en: "No lessons scheduled" },
  "lesson.time": { th: "เวลา", en: "Time" },
  "lesson.lesson": { th: "คาบเรียน", en: "Lesson" },
  "lesson.type": { th: "ประเภท", en: "Type" },
  "lesson.status": { th: "สถานะ", en: "Status" },
  "lesson.confirmed": { th: "ยืนยันแล้ว", en: "Confirmed" },
  "lesson.pending": { th: "รอยืนยัน", en: "Pending" },
  "lesson.declined": { th: "ปฏิเสธ", en: "Declined" },
  "lesson.final": { th: "Final", en: "Final" },
  "lesson.normal": { th: "ปกติ", en: "Normal" },

  // ── Recent activities card ───────────────────────────────────────────────
  "activity.title": { th: "กิจกรรมล่าสุด", en: "Recent Activities" },
  "activity.viewAll": { th: "ดูทั้งหมด", en: "View all" },
  "activity.empty": { th: "ไม่มีอะไรค้างอยู่แล้ว", en: "You're all caught up" },
  "activity.justNow": { th: "เมื่อสักครู่", en: "just now" },
  "activity.minAgo": { th: "{n} นาทีที่แล้ว", en: "{n}m ago" },
  "activity.hourAgo": { th: "{n} ชม.ที่แล้ว", en: "{n}h ago" },
  "activity.yesterday": { th: "เมื่อวาน", en: "1d ago" },
  "activity.dayAgo": { th: "{n} วันที่แล้ว", en: "{n}d ago" },

  // ── Students pipeline card ───────────────────────────────────────────────
  "pipeline.title": { th: "ความคืบหน้านักเรียน", en: "Students Pipeline" },
  "pipeline.empty": { th: "ยังไม่มีข้อมูลไปป์ไลน์", en: "No pipeline data yet" },
  "pipeline.newLead": { th: "ลีดใหม่", en: "New Leads" },
  "pipeline.contacted": { th: "ติดต่อแล้ว", en: "Contacted" },
  "pipeline.interested": { th: "สนใจ", en: "Interested" },
  "pipeline.trialBooked": { th: "นัดทดลองเรียนแล้ว", en: "Trial Booked" },
  "pipeline.trialDone": { th: "ทดลองเรียนแล้ว", en: "Trial Done" },
  "pipeline.won": { th: "ปิดการขาย", en: "Won" },

  // ── Revenue overview card ────────────────────────────────────────────────
  "revenue.title": { th: "ภาพรวมรายรับ", en: "Revenue Overview" },
  "revenue.thisYear": { th: "ปีนี้", en: "This Year" },

  // ── Sales funnel card ────────────────────────────────────────────────────
  "funnel.title": { th: "กรวยการขาย", en: "Sales Funnel" },
  "funnel.newLead": { th: "ลีดใหม่", en: "New Lead" },
  "funnel.contacted": { th: "ติดต่อแล้ว", en: "Contacted" },
  "funnel.qualified": { th: "คัดกรองแล้ว", en: "Qualified" },
  "funnel.interested": { th: "สนใจ", en: "Interested" },
  "funnel.trialBooked": { th: "นัดทดลองเรียนแล้ว", en: "Trial Booked" },
  "funnel.trialCompleted": { th: "ทดลองเรียนแล้ว", en: "Trial Completed" },
  "funnel.negotiating": { th: "กำลังเจรจา", en: "Negotiating" },
  "funnel.waitingDecision": { th: "รอการตัดสินใจ", en: "Waiting Decision" },
  "funnel.won": { th: "ปิดการขาย", en: "Won" },
  "funnel.lost": { th: "ปิด/เสีย", en: "Lost" },
  "funnel.renewPending": { th: "รอต่ออายุ", en: "Renew Pending" },
  "funnel.renewed": { th: "ต่ออายุแล้ว", en: "Renewed" },

  // ── Drop-off stage card ──────────────────────────────────────────────────
  "dropoff.title": { th: "ลูกค้าหยุดคุยตรงไหน", en: "Where customers drop off" },
  "dropoff.opening": { th: "ทักทาย/รับข้อมูลคอร์สแล้วเงียบ", en: "Greeted, then went quiet" },
  "dropoff.general": { th: "คุยทั่วไปแล้วเงียบ", en: "Chatted, then went quiet" },
  "dropoff.toolUsed": { th: "กำลังจอง/เช็คตารางแล้วเงียบ", en: "Was booking, then went quiet" },
  "dropoff.handoff": { th: "ขอคุยกับคนจริง", en: "Asked for a human" },
  "dropoff.fallback": { th: "บอทตอบไม่ได้", en: "Bot couldn't answer" },

  // ── Action required card ─────────────────────────────────────────────────
  "action.title": { th: "ต้องทำวันนี้", en: "Action required today" },
  "action.empty": { th: "ไม่มีอะไรเร่งด่วนวันนี้", en: "Nothing urgent today" },
  "action.nearEndHours": { th: "ใกล้หมดชั่วโมง", en: "Running out of hours" },
  "action.hoursLeft": { th: "เหลือ {a} / {b} ชม.", en: "{a} / {b} h left" },
  "action.recordPayment": { th: "บันทึกรับเงิน", en: "Record payment" },
  "action.coldLeads": { th: "Lead เงียบหายไปนาน", en: "Cold leads" },
  "action.quietDays": { th: "เงียบไป {n} วัน", en: "Quiet for {n} days" },
  "action.trialsToday": { th: "Trial วันนี้/พรุ่งนี้", en: "Trials today/tomorrow" },
  "action.awaitConfirm": { th: "รอยืนยันการจอง", en: "Bookings awaiting confirmation" },
  "action.problems": { th: "ปัญหาที่ควรรู้", en: "Issues to know about" },
  "action.sevError": { th: "ผิดพลาด", en: "Error" },
  "action.sevWarn": { th: "คำเตือน", en: "Warning" },

  // ── Business snapshot card ───────────────────────────────────────────────
  "snapshot.title": { th: "สถานะธุรกิจปัจจุบัน", en: "Business Snapshot" },
  "snapshot.descEdit": { th: "แก้ไขตัวเลขสรุปธุรกิจ — อัปเดตเองเป็นระยะตามที่คำนวณได้", en: "Edit your business summary numbers — update them periodically" },
  "snapshot.lastUpdated": { th: "อัปเดตล่าสุด {date}", en: "Last updated {date}" },
  "snapshot.noData": { th: "ยังไม่มีข้อมูล", en: "No data yet" },
  "snapshot.fActive": { th: "นักเรียน Active (คน)", en: "Active students" },
  "snapshot.fHoursWeek": { th: "ชั่วโมงสอน/สัปดาห์", en: "Teaching hours/week" },
  "snapshot.fAvgMonth": { th: "ชั่วโมงสอนเฉลี่ย/เดือน", en: "Avg teaching hours/month" },
  "snapshot.fCac": { th: "CAC (บาท/ลูกค้า)", en: "CAC (baht/customer)" },
  "snapshot.fLtvMin": { th: "LTV ต่ำสุด (บาท)", en: "Min LTV (baht)" },
  "snapshot.fLtvMax": { th: "LTV สูงสุด (บาท)", en: "Max LTV (baht)" },
  "snapshot.fPolicy": { th: "นโยบายขายปัจจุบัน", en: "Current sales policy" },
  "snapshot.fNote": { th: "หมายเหตุ", en: "Note" },
  "snapshot.save": { th: "บันทึก", en: "Save" },
  "snapshot.saving": { th: "กำลังบันทึก…", en: "Saving…" },
  "snapshot.cancel": { th: "ยกเลิก", en: "Cancel" },
  "snapshot.saveFailed": { th: "บันทึกไม่สำเร็จ", en: "Save failed" },
  "snapshot.statActive": { th: "นักเรียน Active", en: "Active students" },
  "snapshot.statHoursWeek": { th: "ชั่วโมงสอน/สัปดาห์", en: "Hours/week" },
  "snapshot.statAvgMonth": { th: "เฉลี่ย/เดือน", en: "Avg/month" },
  "snapshot.persons": { th: "คน", en: "students" },
  "snapshot.hours": { th: "ชม.", en: "hrs" },
  "snapshot.x": { th: "เท่า", en: "x" },
  "snapshot.approxCac": { th: "CAC โดยประมาณ", en: "Approx. CAC" },
  "snapshot.perCustomer": { th: "/ลูกค้า", en: "/customer" },
  "snapshot.ltvRange": { th: "LTV ขั้นต่ำ–สูงสุด", en: "LTV min–max" },
  "snapshot.policy": { th: "นโยบายขายปัจจุบัน", en: "Sales policy" },

  // ── Command search ───────────────────────────────────────────────────────
  "search.placeholder": { th: "ค้นหาทุกอย่าง…", en: "Search anything…" },
  "search.noMatches": { th: "ไม่พบผลลัพธ์", en: "No matches" },

  // ── Floating assistant (TIGA AI AGENT) ───────────────────────────────────
  "fab.newChat": { th: "ใหม่", en: "New" },
  "fab.newChatAria": { th: "แชทใหม่", en: "New chat" },
  "fab.openAria": { th: "เปิด TIGA AI Agent", en: "Open TIGA AI Agent" },
  "fab.closeAria": { th: "ปิด TIGA AI Agent", en: "Close TIGA AI Agent" },
  "fab.modelAria": { th: "เลือกโมเดล AI", en: "Choose AI model" },
  "fab.modelTitle": { th: "กำลังคุยกับโมเดล AI นี้ — เปลี่ยนได้ที่นี่", en: "Currently using this AI model — change it here" },
  "fab.placeholder": { th: "สั่งงาน AI…", en: "Command the AI…" },
  "fab.hint": { th: "หรือพิมพ์สั่งงานได้เลย เช่น \"สร้าง TikTok Script\", \"สร้าง Video Package\", \"วิเคราะห์เทรนด์\" หรือถามข้อมูลในคลังความรู้", en: "Or type a command directly — e.g. \"Create a TikTok script\", \"Create a Video Package\", \"Analyze trends\" — or ask the knowledge base" },
  "fab.qaTodayTasks": { th: "🎯 งานวันนี้", en: "🎯 Today's tasks" },
  "fab.qaSummary": { th: "📊 สรุปวันนี้", en: "📊 Today's summary" },
  "fab.qaAllStudents": { th: "👥 นักเรียนทั้งหมด", en: "👥 All students" },
  "fab.qaLessonsToday": { th: "📅 คาบเรียนวันนี้", en: "📅 Today's lessons" },
  "fab.qaMonthIncome": { th: "💰 รายรับเดือนนี้", en: "💰 This month's income" },
  "fab.qaCreateContent": { th: "📝 สร้าง Content", en: "📝 Create content" },
  "fab.qaPlan": { th: "🧠 วางแผน", en: "🧠 Plan" },
  "fab.qaFollowLeads": { th: "🎯 Lead ที่ควรติดตาม", en: "🎯 Leads to follow up" },
  "fab.qaVideoPackage": { th: "🎬 Video Package", en: "🎬 Video Package" },
  "fab.qaRepurpose": { th: "🔄 Repurpose Content", en: "🔄 Repurpose content" },
  "fab.qaMktDashboard": { th: "📈 Marketing Dashboard", en: "📈 Marketing Dashboard" },
  "fab.qaAddKnowledge": { th: "เพิ่มความรู้", en: "Add knowledge" },
  "fab.cancelPlan": { th: "ยกเลิกแผน", en: "Cancel plan" },
  "fab.cancelPlanReply": { th: "ยกเลิกแผนแล้วครับ 🔄 พิมพ์คำสั่งใหม่ได้เลย", en: "Plan cancelled 🔄 Type a new command anytime" },

  // ── Daily priorities card ────────────────────────────────────────────────
  "prio.title": { th: "🎯 งานสำคัญวันนี้", en: "🎯 Today's priorities" },
  "prio.byValue": { th: "เรียงตามคุณค่า", en: "Sorted by value" },
  "prio.impactLabel": { th: "คุณค่า: {v}", en: "Value: {v}" },
  "prio.impactVeryHigh": { th: "สูงมาก", en: "Very high" },
  "prio.impactHigh": { th: "สูง", en: "High" },
  "prio.impactMid": { th: "กลาง", en: "Medium" },
  "prio.impactLow": { th: "ต่ำ", en: "Low" },
  "prio.diffEasy": { th: "ง่าย", en: "Easy" },
  "prio.diffMid": { th: "กลาง", en: "Medium" },
  "prio.diffHard": { th: "ยาก", en: "Hard" },

  // ── Execution plan card ──────────────────────────────────────────────────
  "plan.title": { th: "แผนงาน {n} ขั้นตอน", en: "Plan: {n} steps" },
  "plan.executing": { th: "กำลังทำ...", en: "Running…" },
  "plan.allDone": { th: "เสร็จทั้งหมด ✓", en: "All done ✓" },
  "plan.errors": { th: "{n} ผิดพลาด", en: "{n} errors" },
  "plan.stepDone": { th: "✓ เสร็จ", en: "✓ Done" },
  "plan.stepError": { th: "✗ ผิดพลาด", en: "✗ Failed" },
  "plan.approve": { th: "อนุมัติและทำเลย", en: "Approve & run" },
  "plan.cancel": { th: "ยกเลิก", en: "Cancel" },
  "plan.finished": { th: "🎉 ทำเสร็จทั้งหมดแล้ว! ({a}/{b} ขั้นตอน)", en: "🎉 All steps completed! ({a}/{b})" },
} as const;

export type DictKey = keyof typeof DICT;

/** Translate a dictionary key; falls back to English if a string is ever missing. */
export function translate(lang: Lang, key: DictKey): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
}

/**
 * Translate + substitute {placeholders} in one call:
 *   tfmt(lang, "action.hoursLeft", { a: "12", b: "20" })
 * Unmatched placeholders are left as-is so a typo stays visible.
 */
export function tfmt(lang: Lang, key: DictKey, vars: Record<string, string | number>): string {
  let out = translate(lang, key);
  for (const [name, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
  }
  return out;
}

/** Locale for Intl date formatting that follows the app language. */
export function langLocale(lang: Lang): string {
  return lang === "th" ? "th-TH" : "en-GB";
}
