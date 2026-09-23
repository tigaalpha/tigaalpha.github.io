// Marketing automation tools for TIGA AI Agent — Phase 1-5
// This file adds marketing-specific tools to the AI Agent's toolkit.
// Import and call from tools.ts executeTool function.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type ToolResult = Record<string, unknown>;

export async function executeMarketingTool(
  name: string,
  args: Record<string, unknown>,
  db: SupabaseClient,
): Promise<ToolResult> {
  switch (name) {
    case "use_marketing_skill": {
      const skillName = String(args.skillName ?? "");
      const topic = String(args.topic ?? "");
      const language = args.language ? String(args.language) : "th";
      const model = args.model ? String(args.model) : "gemini";
      if (!skillName || !topic) throw new Error("skillName and topic are required");
      return {
        action: "use_marketing_skill",
        skillName,
        topic,
        language,
        model,
        instruction: `เปิดหน้า Marketing Skills แล้วใช้สกิล ${skillName} กับหัวข้อ: ${topic}`,
        navigateTo: "/marketing-skills",
      };
    }

    case "get_daily_priorities": {
      const today = new Date().toISOString().slice(0, 10);
      const { data: pendingApprovals } = await db
        .from("approvals")
        .select("id, action_type")
        .eq("status", "pending")
        .limit(10);
      const { data: recentLeads } = await db
        .from("sales_pipeline")
        .select("id, customer_name, status")
        .in("status", ["new_lead", "contacted", "interested", "trial_booked"])
        .order("updated_at", { ascending: false })
        .limit(10);
      const { data: todayLessons } = await db
        .from("bookings")
        .select("id")
        .gte("start_time", today + "T00:00:00")
        .lte("start_time", today + "T23:59:59")
        .eq("status", "confirmed");
      const { data: unscheduledContent } = await db
        .from("content_history")
        .select("id")
        .is("scheduled_date", null)
        .limit(5);

      const priorities: Array<{
        rank: number;
        task: string;
        category: string;
        impact: string;
        difficulty: string;
        reason: string;
        actionText: string;
      }> = [];

      if ((pendingApprovals ?? []).length > 0) {
        priorities.push({
          rank: priorities.length + 1,
          task: `อนุมัติ ${(pendingApprovals ?? []).length} รายการที่รออนุมัติ`,
          category: "operational",
          impact: "สูง",
          difficulty: "ง่าย",
          reason: "งานค้างที่รอการตัดสินใจ — ยิ่งเร็วยิ่งดี",
          actionText: "ดูรายการรอการอนุมัติ",
        });
      }
      if ((recentLeads ?? []).length > 0) {
        const leadNames = (recentLeads ?? [])
          .slice(0, 3)
          .map((l: Record<string, string>) => l.customer_name)
          .join(", ");
        priorities.push({
          rank: priorities.length + 1,
          task: `ติดตาม lead ${(recentLeads ?? []).length} คน: ${leadNames}${(recentLeads ?? []).length > 3 ? "..." : ""}`,
          category: "sales",
          impact: "สูงมาก",
          difficulty: "กลาง",
          reason: `lead ที่ยังไม่ปิด — ยิ่งติดตามเร็วยิ่งมีโอกาส converting สูง`,
          actionText: "ดู Sales Pipeline",
        });
      }
      if ((unscheduledContent ?? []).length > 0) {
        priorities.push({
          rank: priorities.length + 1,
          task: `วางแผนโพสต์ content ${(unscheduledContent ?? []).length} ชิ้นที่สร้างแล้ว`,
          category: "marketing",
          impact: "กลาง",
          difficulty: "ง่าย",
          reason: "content ที่สร้างแล้วแต่ยังไม่ได้โพสต์ — เสียโอกาส",
          actionText: "สร้าง Content Calendar",
        });
      }
      if (priorities.length < 3) {
        priorities.push({
          rank: priorities.length + 1,
          task: "สร้าง content ใหม่ 1 ชิ้นสำหรับสัปดาห์นี้",
          category: "marketing",
          impact: "กลาง",
          difficulty: "ง่าย",
          reason: "content สม่ำเสมอ = lead สม่ำเสมอ",
          actionText: "สร้าง Content",
        });
      }
      if (priorities.length < 3) {
        priorities.push({
          rank: priorities.length + 1,
          task: "ตรวจสอบสรุปการเงินเดือนนี้",
          category: "finance",
          impact: "กลาง",
          difficulty: "ง่าย",
          reason: "รู้ตัวเลข = ตัดสินใจได้ดีกว่า",
          actionText: "ดูการเงิน",
        });
      }

      return {
        date: today,
        priorities: priorities.slice(0, 3),
        summary: {
          pendingApprovals: (pendingApprovals ?? []).length,
          activeLeads: (recentLeads ?? []).length,
          todayLessons: (todayLessons ?? []).length,
          unscheduledContent: (unscheduledContent ?? []).length,
        },
      };
    }

    case "get_content_performance": {
      const period = args.period ? String(args.period) : "month";
      const now = new Date();
      let startDate2: string;
      if (period === "week")
        startDate2 = new Date(now.getTime() - 7 * 86400000).toISOString();
      else if (period === "quarter")
        startDate2 = new Date(now.getTime() - 90 * 86400000).toISOString();
      else
        startDate2 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const { data: content } = await db
        .from("content_history")
        .select("id, title, content_type, platform, created_at, skill_used, language")
        .gte("created_at", startDate2)
        .order("created_at", { ascending: false })
        .limit(50);
      const totalContent = (content ?? []).length;
      const byType: Record<string, number> = {};
      const byPlatform: Record<string, number> = {};
      (content ?? []).forEach((c: Record<string, string>) => {
        byType[c.content_type || "unknown"] =
          (byType[c.content_type || "unknown"] || 0) + 1;
        byPlatform[c.platform || "unknown"] =
          (byPlatform[c.platform || "unknown"] || 0) + 1;
      });
      return {
        period,
        totalContent,
        byType,
        byPlatform,
        recentContent: (content ?? [])
          .slice(0, 5)
          .map((c: Record<string, string>) => ({
            title: c.title?.slice(0, 80),
            type: c.content_type,
            platform: c.platform,
            date: c.created_at?.slice(0, 10),
          })),
      };
    }

    case "schedule_post": {
      const title = String(args.title ?? "");
      const contentText = String(args.content ?? "");
      const platform = String(args.platform ?? "all");
      const scheduledDate = String(args.scheduledDate ?? "");
      if (!title || !contentText || !scheduledDate)
        throw new Error("title, content, and scheduledDate are required");
      const { data: scheduled, error: sErr } = await db
        .from("content_history")
        .insert({
          title,
          content: contentText,
          content_type: "scheduled_post",
          platform,
          scheduled_date: scheduledDate,
          status: "scheduled",
        })
        .select("id")
        .single();
      if (sErr) throw sErr;
      return {
        action: "schedule_post",
        postId: scheduled?.id,
        title,
        platform,
        scheduledDate,
        instruction: `บันทึก post แล้ว: "${title}" จะโพสต์บน ${platform} วันที่ ${scheduledDate}`,
      };
    }

    case "get_trend_analysis": {
      const topic = args.topic ? String(args.topic) : "piano education trends";
      return {
        action: "get_trend_analysis",
        topic,
        instruction: `วิเคราะห์เทรนด์: ${topic} — ใช้ Knowledge Base และ web search`,
        navigateTo: "/social-trends",
      };
    }

    case "create_video_package": {
      const topic = String(args.topic ?? "");
      const style = args.style ? String(args.style) : "educational";
      const languages = args.languages
        ? (args.languages as string[])
        : ["th"];
      if (!topic) throw new Error("topic is required");
      return {
        action: "create_video_package",
        topic,
        style,
        languages,
        instruction: `สร้าง Video Package ครบ: Script (${languages.join(", ")}) → Voice Over → Scene Images หัวข้อ: ${topic} สไตล์: ${style}`,
        navigateTo: "/video-script-writer",
      };
    }

    case "repurpose_content": {
      const originalContent = String(args.originalContent ?? "");
      const platforms = args.platforms
        ? (args.platforms as string[])
        : ["tiktok", "instagram", "facebook"];
      if (!originalContent) throw new Error("originalContent is required");
      return {
        action: "repurpose_content",
        originalContent: originalContent.slice(0, 3000),
        platforms,
        instruction: `แปลง content เป็น ${platforms.length} แพลตฟอร์ม: ${platforms.join(", ")}`,
        navigateTo: "/marketing-skills",
      };
    }

    case "get_marketing_dashboard": {
      const weekAgo2 = new Date(Date.now() - 7 * 86400000).toISOString();
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: weekContent } = await db
        .from("content_history")
        .select("id")
        .gte("created_at", weekAgo2);
      const { data: monthContent } = await db
        .from("content_history")
        .select("id")
        .gte("created_at", monthAgo);
      const { data: scheduledPosts } = await db
        .from("content_history")
        .select("id")
        .eq("status", "scheduled");
      const { data: voHistory } = await db
        .from("voiceover_history")
        .select("id")
        .gte("created_at", weekAgo2);
      return {
        thisWeek: {
          contentCreated: (weekContent ?? []).length,
          voiceoversCreated: (voHistory ?? []).length,
          scheduledPosts: (scheduledPosts ?? []).length,
        },
        thisMonth: { contentCreated: (monthContent ?? []).length },
        tip:
          (monthContent ?? []).length < 8
            ? "💡 ควรสร้าง content อย่างน้อย 2 ชิ้นต่อสัปดาห์"
            : "✅ content สม่ำเสมอดี!",
      };
    }

    default:
      return null as unknown as ToolResult;
  }
}
