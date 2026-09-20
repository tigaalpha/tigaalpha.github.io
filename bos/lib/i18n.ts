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

/** Inline script string: sets <html lang> before paint so the document matches the stored choice early. */
export const LANG_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem("${LANG_STORAGE_KEY}");
    document.documentElement.lang = stored === "en" ? "en" : "th";
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
} as const;

export type DictKey = keyof typeof DICT;

/** Translate a dictionary key; falls back to English if a string is ever missing. */
export function translate(lang: Lang, key: DictKey): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
}
