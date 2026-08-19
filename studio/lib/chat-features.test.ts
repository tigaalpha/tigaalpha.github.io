import { describe, expect, it } from "vitest";
import {
  isFeatureEnabled,
  reviewModeIsAuto,
  shouldAutoSend,
  outboxMode,
  isWithinBusinessHours,
  detectLanguage,
  buildLessonReminderFlex,
  DAILY_LIMITS,
} from "../supabase/functions/_shared/chat-features";

describe("feature flags (เปิด/ปิด + review mode)", () => {
  it("feature เปิดเมื่อค่าเป็น 'on'", () => {
    expect(isFeatureEnabled({ chat_feature_broadcast: "on" }, "broadcast")).toBe(true);
    expect(isFeatureEnabled({ chat_feature_broadcast: "off" }, "broadcast")).toBe(false);
    expect(isFeatureEnabled({}, "broadcast")).toBe(false);
  });

  it("review mode auto เฉพาะเมื่อ chat_review_mode = auto", () => {
    expect(reviewModeIsAuto({ chat_review_mode: "auto" })).toBe(true);
    expect(reviewModeIsAuto({ chat_review_mode: "always" })).toBe(false);
    expect(reviewModeIsAuto({})).toBe(false);
  });

  it("shouldAutoSend = เปิด + auto เท่านั้น", () => {
    expect(shouldAutoSend({ chat_review_mode: "auto", chat_feature_lesson_reminder: "on" }, "lessonReminder")).toBe(true);
    expect(shouldAutoSend({ chat_review_mode: "always", chat_feature_lesson_reminder: "on" }, "lessonReminder")).toBe(false);
    expect(shouldAutoSend({ chat_review_mode: "auto", chat_feature_lesson_reminder: "off" }, "lessonReminder")).toBe(false);
  });

  it("outboxMode คืนค่า auto/suggest ตามโหมด", () => {
    expect(outboxMode({ chat_review_mode: "auto", chat_feature_outbound_nurture: "on" }, "outboundNurture")).toBe("auto");
    expect(outboxMode({ chat_review_mode: "always", chat_feature_outbound_nurture: "on" }, "outboundNurture")).toBe("suggest");
  });

  it("ทุกฟีเจอร์มีวงเงินต่อวัน", () => {
    expect(DAILY_LIMITS.outbound_nurture).toBeGreaterThan(0);
    expect(DAILY_LIMITS.lesson_reminder).toBeGreaterThan(0);
    expect(DAILY_LIMITS.broadcast).toBe(1);
  });
});

describe("isWithinBusinessHours (09:00–19:00 BKK)", () => {
  it("09:00 BKK = เปิด", () => {
    expect(isWithinBusinessHours(new Date("2026-08-17T02:00:00Z"))).toBe(true); // 09:00 BKK
  });
  it("18:59 BKK = เปิด", () => {
    expect(isWithinBusinessHours(new Date("2026-08-17T11:59:00Z"))).toBe(true); // 18:59 BKK
  });
  it("08:00 BKK = ปิด", () => {
    expect(isWithinBusinessHours(new Date("2026-08-17T01:00:00Z"))).toBe(false); // 08:00 BKK
  });
  it("19:00 BKK = ปิด", () => {
    expect(isWithinBusinessHours(new Date("2026-08-17T12:00:00Z"))).toBe(false); // 19:00 BKK
  });
});

describe("detectLanguage", () => {
  it("ไทย", () => {
    expect(detectLanguage("สวัสดีค่ะ อยากได้ราคาคอร์ส")).toBe("th");
  });
  it("อังกฤษ", () => {
    expect(detectLanguage("How much is a 20-hour course?")).toBe("en");
  });
  it("จีน", () => {
    expect(detectLanguage("你好，请问课程价格是多少？")).toBe("zh");
  });
  it("อังกฤษปนไทย → ไทย (สัดส่วน)", () => {
    expect(detectLanguage("ราคา course เท่าไหร่ค่ะ")).toBe("th");
  });
  it("สัญลักษณ์ล้วน → other", () => {
    expect(detectLanguage("😊👍")).toBe("other");
  });
});

describe("buildLessonReminderFlex", () => {
  const flex = buildLessonReminderFlex({
    lessonTitle: "เปียโน 1 ชม.",
    teacherName: "ครูมอส",
    startLabel: "พรุ่งนี้ 17:00",
    customerName: "น้องตินติน",
  });

  it("เป็น bubble ขนาด giga มี header/body/footer", () => {
    expect(flex.type).toBe("bubble");
    expect(flex.size).toBe("giga");
    expect(flex.header).toBeDefined();
    expect(flex.body).toBeDefined();
    expect(flex.footer).toBeDefined();
  });

  it("มีปุ่มยืนยันมา/มาไม่ได้ (กดแล้วส่งข้อความ 'มา'/'มาไม่ได้')", () => {
    const buttons = flex.footer.contents as { action?: { type: string; text?: string } }[];
    const actions = buttons.map((b) => b.action).filter(Boolean);
    expect(actions.some((a) => a!.text === "มา")).toBe(true);
    expect(actions.some((a) => a!.text === "มาไม่ได้")).toBe(true);
  });

  it("แสดงชื่อคาบและเวลาที่ส่งให้", () => {
    expect(JSON.stringify(flex)).toContain("เปียโน 1 ชม.");
    expect(JSON.stringify(flex)).toContain("พรุ่งนี้ 17:00");
  });
});
