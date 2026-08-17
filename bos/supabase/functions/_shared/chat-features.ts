// Pure logic for the chat feature set (no imports — unit-testable under
// vitest). DB reads (integration_settings flags) happen in the callers.
//
// Design rule for every feature here: ON/OFF per feature + a global review
// mode. "always" (default) = AI drafts → owner approves in Inbox > AI
// Outbox; "auto" = AI sends within its daily limits. Humans can intervene
// in every step either way.

export const CHAT_REVIEW_MODE_KEY = "chat_review_mode";
export const CHAT_REVIEW_MODE_ALWAYS = "always";
export const CHAT_REVIEW_MODE_AUTO = "auto";

export const CHAT_FEATURE_KEYS = {
  outboundNurture: "chat_feature_outbound_nurture",
  lessonReminder: "chat_feature_lesson_reminder",
  richMenu: "chat_feature_rich_menu",
  flexMessages: "chat_feature_flex_messages",
  customerMemory: "chat_feature_customer_memory",
  ownerMode: "chat_feature_owner_mode",
  broadcast: "chat_feature_broadcast",
  ownerNotify: "chat_feature_owner_notify",
  multiLang: "chat_feature_multilang",
} as const;

export type ChatFeatureKey = keyof typeof CHAT_FEATURE_KEYS;

// Thai labels shared by the Settings toggles and the Outbox badges.
export const CHAT_FEATURE_LABELS: Record<ChatFeatureKey, string> = {
  outboundNurture: "AI ทักลูกค้าก่อน (ตามลูกค้าที่เงียบไป)",
  lessonReminder: "เตือนคาบเรียนอัตโนมัติทาง LINE (24 ชม. / 2 ชม. ก่อน)",
  richMenu: "LINE Rich Menu + ข้อความต้อนรับ",
  flexMessages: "การ์ด Flex Message สวยๆ",
  customerMemory: "จำลูกค้าระยะยาว (สรุปบันทึกอัตโนมัติ)",
  ownerMode: "โหมดเจ้าของดูแล + คำตอบสำเร็จรูป",
  broadcast: "ส่ง Broadcast ถึงลูกค้า",
  ownerNotify: "แจ้งเจ้าของทุกครั้งที่มีลูกค้าใหม่ทัก",
  multiLang: "ตอบลูกค้าตามภาษา (ไทย/อังกฤษ/จีน)",
};

export const CHAT_FEATURE_DESCRIPTIONS: Record<ChatFeatureKey, string> = {
  outboundNurture: "ลูกค้าถามแล้วเงียบเกิน 24 ชม. → AI ร่างข้อความตามไป ถามต่อ (เข้าคิวรอคุณอนุมัติก่อนส่ง)",
  lessonReminder: "ส่งการ์ดเตือนคาบเรียนล่วงหน้า 24 ชม. และ 2 ชม. พร้อมปุ่มกดยืนยันมา/มาไม่ได้",
  richMenu: "เมนูปุ่มกดล่างสุดในแชท LINE (จองคอร์ส / ดูตาราง / ราคา / คุยกับคน) + ทักทายคนที่แอดไลน์ใหม่",
  flexMessages: "ข้อความเตือน/โปรโมชันแสดงเป็นการ์ดสีสวย แทนข้อความเปล่า",
  customerMemory: "ทุกคืน AI สรุปข้อมูลลูกค้าจากบทสนทนา (ชื่อลูก ระดับ เพิ่มเติมลง notes ให้คุณเห็น)",
  ownerMode: "พอคุณตอบลูกค้าเอง ระบบหยุด AI แทรกในคุยนั้น + ปุ่ม 'คำตอบสำเร็จรูป' ให้ AI ร่าง 3 แบบให้คุณกดเลือก",
  broadcast: "ส่งข้อความโปรโมชันถึงลูกค้า LINE ทุกคน (ยกเว้นคนที่ขอเลิกแจ้ง) — ผ่านคิวอนุมัติเสมอ",
  ownerNotify: "ลูกค้าใหม่ทักมา LINE ครั้งแรก → แจ้งเตือนถึงคุณทันที (ในแอป + LINE ส่วนตัว)",
  multiLang: "ลูกค้าพิมพ์อังกฤษ/จีน → AI ตอบเป็นภาษานั้น (ปกติตอบไทย)",
};

export type FeatureFlags = Record<string, string | undefined>;

export function isFeatureEnabled(flags: FeatureFlags, key: ChatFeatureKey): boolean {
  return flags[CHAT_FEATURE_KEYS[key]] === "on";
}

export function reviewModeIsAuto(flags: FeatureFlags): boolean {
  return flags[CHAT_REVIEW_MODE_KEY] === CHAT_REVIEW_MODE_AUTO;
}

/** Feature เปิดอยู่และโหมดเป็น auto → AI ส่งเองได้ (ยังมีวงเงินอีกชั้นในฟังก์ชัน) */
export function shouldAutoSend(flags: FeatureFlags, key: ChatFeatureKey): boolean {
  return isFeatureEnabled(flags, key) && reviewModeIsAuto(flags);
}

/** โหมดที่ควรบันทึกลง ai_outbox: "auto" | "suggest" */
export function outboxMode(flags: FeatureFlags, key: ChatFeatureKey): "auto" | "suggest" {
  return shouldAutoSend(flags, key) ? "auto" : "suggest";
}

/** ตอนนี้อยู่ในเวลาทำการของร้าน (09:00–19:00 BKK) หรือไม่ — ข้อความหาลูกค้าจะส่งเฉพาะในเวลาทำการ */
export function isWithinBusinessHours(date: Date, startHour = 9, endHour = 19): boolean {
  const bkk = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  }).format(date);
  const hour = Number(bkk);
  return Number.isFinite(hour) && hour >= startHour && hour < endHour;
}

export type ChatLang = "th" | "en" | "zh" | "other";

/** ตรวจจับภาษาหลักของข้อความลูกค้า (ไทย/อังกฤษ/จีน) — ใช้สัดส่วนสคริปต์ */
export function detectLanguage(text: string): ChatLang {
  const clean = text.trim();
  if (!clean) return "other";
  const thai = (clean.match(/[\u0E00-\u0E7F]/g) ?? []).length;
  const latin = (clean.match(/[A-Za-z]/g) ?? []).length;
  const cjk = (clean.match(/[\u3400-\u9FFF\uF900-\uFAFF]/g) ?? []).length;
  const total = thai + latin + cjk;
  if (total === 0) return "other";
  const thaiShare = thai / total;
  const cjkShare = cjk / total;
  if (cjkShare > 0.5) return "zh";
  if (thaiShare > 0.5) return "th";
  if (latin > 0 && latin / total > 0.5) return "en";
  return "other";
}

export const LANG_INSTRUCTION: Record<Exclude<ChatLang, "th">, string> = {
  en: "Reply in English (the customer wrote in English). Keep the warm, personal tone of the studio owner.",
  zh: "用中文回复（客户用中文发送）。保持亲切、像店主本人回复的语气。",
  other: "Reply in the same language the customer used. Keep the warm, personal tone of the studio owner.",
};

/**
 * LINE Flex card สำหรับเตือนคาบเรียน — ใช้ได้ทั้ง "ยืนยันการมาเรียน" และแจ้ง
 * รายละเอียดคาบ (pure — ทดสอบได้)
 */
export interface LessonReminderInput {
  lessonTitle: string;
  teacherName: string;
  startLabel: string; // e.g. "พรุ่งนี้ 17:00"
  customerName: string;
  bookingRef?: string;
}

export function buildLessonReminderFlex(input: LessonReminderInput) {
  return {
    type: "bubble",
    size: "giga",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#6D28D9",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "🎹 เตือนคาบเรียน", color: "#FFFFFF", weight: "bold", size: "lg" },
        { type: "text", text: input.startLabel, color: "#E9D5FF", size: "sm", marginTop: "4px" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: input.lessonTitle, weight: "bold", size: "lg", wrap: true },
        { type: "text", text: `คุณครู: ${input.teacherName}`, size: "sm", color: "#6B7280" },
        { type: "text", text: "อย่าลืมมาเรียนนะคะ ถ้ามาไม่ได้ตอบ 'มาไม่ได้' ได้เลยค่ะ", size: "xs", color: "#6B7280", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          action: { type: "message", label: "✅ มาแน่นอน", text: "มา" },
        },
        {
          type: "button",
          style: "secondary",
          action: { type: "message", label: "❌ มาไม่ได้", text: "มาไม่ได้" },
        },
      ],
    },
  };
}

export function flexMessage(payload: unknown) {
  return { type: "flex", altText: "📅 แจ้งเตือนจาก Tiga Studio", contents: payload };
}

/** วงเงินต่อวันของแต่ละฟีเจอร์ (ยังมีอีกชั้นใน autonomy) */
export const DAILY_LIMITS: Record<string, number> = {
  outbound_nurture: 5,
  lesson_reminder: 40,
  broadcast: 1,
};

/** ฟีเจอร์ไหน "รอคนตรวจ" ได้ — broadcast ต้องผ่านคิวเสมอ (คนเป็นคนเริ่ม) */
export function broadcastAlwaysReviewed(): boolean {
  return true;
}
