"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  ArrowLeft,
  Clock,
  User,
  Bot,
  ChevronRight,
  Target,
  TrendingUp,
  Calculator,
  Settings,
  Scale,
  BarChart3,
  Layers,
} from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

/* ── Category Definitions ── */

interface CategoryDef {
  id: string;
  label: string;
  icon: typeof Target;
  color: string;
  bgColor: string;
  keywords: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "strategy",
    label: "กลยุทธ์",
    icon: Target,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    keywords: [
      "กลยุทธ์", "strategy", "แผนธุรกิจ", "business plan", "เป้าหมาย", "goal",
      "vision", "mission", "วิสัยทัศน์", "ทิศทาง", "roadmap", "SWOT", "competitive",
      "คู่แข่ง", " competitor", "positioning", "differentiat", "scaling", "scale",
      "ขยายธุรกิจ", "grow", "growth", "แผนปี", "annual", "quarterly", "quarter",
      "OKR", "KPI", "เป้า", "target", "วิเคราะห์ธุรกิจ", "business analysis",
    ],
  },
  {
    id: "marketing",
    label: "การตลาด",
    icon: TrendingUp,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    keywords: [
      "การตลาด", "marketing", "โฆษณา", "ad", "ads", "campaign", "แคมเปญ",
      "content", "คอนเทนต์", "โพสต์", "post", "social media", "社交媒体",
      "Facebook", "Instagram", "TikTok", "YouTube", "SEO", "SEM", "Google Ads",
      "LINE OA", "broadcast", "โปรโมท", "promot", "投放", " marketing channel",
      "lead", " nurture", "funnel", "conversion", "CTR", " impressions", "reach",
      "ยอดไลก์", "ยอดวิว", "followers", " subscriber", " engagement",
    ],
  },
  {
    id: "finance",
    label: "การเงิน",
    icon: Calculator,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    keywords: [
      "การเงิน", "finance", "บัญชี", "accounting", "รายรับ", "income", "รายจ่าย",
      "expense", "กำไร", "profit", "ขาดทุน", "loss", "cash flow", "กระแสเงินสด",
      "งบประมาณ", "budget", "ภาษี", "tax", "invoice", "ใบเสร็จ", "ใบแจ้งหนี้",
      "payment", "ชำระเงิน", "โอนเงิน", "transfer", "bank", "ธนาคาร",
      "ยอดขาย", "revenue", "sales", "GMV", "transaction", "ธุรกรรม",
      "ค่าใช้จ่าย", "cost", "ROI", "margin", " gross", " net",
    ],
  },
  {
    id: "operations",
    label: "โอปอเรชัน",
    icon: Settings,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    keywords: [
      "โอปอเรชัน", "operation", "ระบบ", "system", "ออโต้", "auto", "automat",
      "CRM", "workflow", "ขั้นตอน", "process", "Schedule", "ตาราง", " calendar",
      "นัด", "booking", "จอง", "เรียน", "lesson", "class", "structor", "ครู",
      "นักเรียน", "student", "attend", "เข้าเรียน", "สรุปวัน", "daily",
      "morning briefing", "health check", "monitor", "backup", "cron",
      "notification", "แจ้งเตือน", "follow up", "ติดตาม", "line webhook",
      "inbox", "แชท", "chat", " customer service",
    ],
  },
  {
    id: "legal",
    label: "กฎหมาย",
    icon: Scale,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    keywords: [
      "กฎหมาย", "legal", "สัญญา", "contract", "ข้อตกลง", "agreement",
      "ข้อกำหนด", "terms", "policy", "นโยบาย", "ความเป็นส่วนตัว", "privacy",
      "PDPA", "GDPR", "ลิขสิทธิ์", "copyright", "trademark", "เครื่องหมายการค้า",
      "ละเมิด", "infringement", "ฟ้อง", "sue", "คดี", "case",
      " compliance", " regulatory", "อนุญาต", "license", "permit",
    ],
  },
  {
    id: "content",
    label: "คอนเทนต์",
    icon: Layers,
    color: "text-pink-600",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    keywords: [
      "คอนเทนต์", "content", "บทความ", "article", "วิดีโอ", "video",
      "สคริปต์", "script", "รูปภาพ", "image", "ถ่ายทำ", "shoot",
      "ตัดต่อ", "edit", "produ", "repurpose", " course writer", "เขียนบทความ",
      "vertical video", " reel", " short", " tiktok content",
      "Content Calendar", "publish", "เผยแพร่", "โพสต์",
    ],
  },
];

/**
 * Classify a conversation into a category based on keyword matching
 * against the summary and last user message.
 */
function classifyConversation(
  summary: string | null,
  lastMessage: string | null
): string {
  const text = `${summary ?? ""} ${lastMessage ?? ""}`.toLowerCase();
  if (!text.trim()) return "other";

  let bestCategory = "other";
  let bestScore = 0;

  for (const cat of CATEGORIES) {
    let score = 0;
    for (const kw of cat.keywords) {
      if (text.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat.id;
    }
  }

  return bestScore > 0 ? bestCategory : "other";
}

function getCategoryDef(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/* ── Conversation List View ── */

interface ConversationWithMeta extends Tables<"conversations"> {
  messageCount: number;
  lastMessage: string | null;
  category: string;
}

function ConversationListItem({
  convo,
  onClick,
}: {
  convo: ConversationWithMeta;
  onClick: () => void;
}) {
  const timeDiff = Date.now() - new Date(convo.updated_at).getTime();
  const isRecent = timeDiff < 3600_000;
  const catDef = getCategoryDef(convo.category);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full text-left rounded-xl border border-line/10 bg-card p-4 hover:bg-line/5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <MessageSquare className="h-4 w-4 shrink-0 text-primary-accent" />
            <p className="font-medium text-sm text-secondary truncate">
              {convo.summary || "แชทกับ TIGA AI Agent"}
            </p>
          </div>
          {convo.lastMessage && (
            <p className="mt-1 text-xs text-secondary/50 line-clamp-2">
              {convo.lastMessage}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge variant={isRecent ? "success" : "outline"} className="text-[10px]">
            {convo.messageCount} ข้อความ
          </Badge>
          <span className="text-[10px] text-secondary/40">
            {new Date(convo.updated_at).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
      {/* Category badge */}
      {catDef && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              catDef.bgColor,
              catDef.color
            )}
          >
            <catDef.icon className="h-3 w-3" />
            {catDef.label}
          </span>
        </div>
      )}
      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary/20 hidden md:block" />
    </button>
  );
}

/* ── Conversation Detail View ── */

function ConversationDetail({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Tables<"messages">[]>([]);
  const [loading, setLoading] = useState(true);
  const [convo, setConvo] = useState<Tables<"conversations"> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const repos = createRepositories(supabase);

    Promise.all([
      repos.conversations.listMessages(conversationId, 200),
      supabase.from("conversations").select("*").eq("id", conversationId).single(),
    ]).then(([msgs, convoRes]) => {
      setMessages(msgs);
      setConvo(convoRes.data);
      setLoading(false);
    });
  }, [conversationId]);

  const category = useMemo(() => {
    if (!convo) return null;
    const catId = classifyConversation(convo.summary, null);
    return getCategoryDef(catId);
  }, [convo]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-secondary break-words">
            {convo?.summary || "แชทกับ TIGA AI Agent"}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondary/40">
            {category && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  category.bgColor,
                  category.color
                )}
              >
                <category.icon className="h-3 w-3" />
                {category.label}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {convo && new Date(convo.created_at).toLocaleString("th-TH")}
            </span>
            <span>· {messages.length} ข้อความ</span>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-secondary/40 py-8">ยังไม่มีข้อความ</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    msg.sender === "customer" || msg.sender === "owner"
                      ? "justify-end"
                      : "justify-start"
                  )}
                >
                  {msg.sender === "ai" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-gradient text-white text-xs">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                      msg.sender === "customer" || msg.sender === "owner"
                        ? "bg-primary-gradient text-white"
                        : "bg-line/5 text-secondary shadow-soft"
                    )}
                  >
                    {msg.content}
                  </div>
                  {(msg.sender === "customer" || msg.sender === "owner") && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-line/10 text-secondary text-xs">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Filter Tabs ── */

function FilterTabs({
  active,
  onSelect,
  counts,
}: {
  active: string;
  onSelect: (id: string) => void;
  counts: Record<string, number>;
}) {
  const allCount = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
      <button
        type="button"
        onClick={() => onSelect("all")}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          active === "all"
            ? "border-primary bg-primary/10 text-primary"
            : "border-line/10 bg-line/5 text-secondary/60 hover:bg-line/10"
        )}
      >
        <BarChart3 className="h-3 w-3" />
        ทั้งหมด
        <span className="text-[10px] opacity-70">({allCount})</span>
      </button>
      {CATEGORIES.map((cat) => {
        const count = counts[cat.id] ?? 0;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active === cat.id
                ? cn("border-current", cat.bgColor, cat.color)
                : "border-line/10 bg-line/5 text-secondary/60 hover:bg-line/10"
            )}
          >
            <cat.icon className="h-3 w-3" />
            {cat.label}
            {count > 0 && <span className="text-[10px] opacity-70">({count})</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Main Component ── */

export function ConversationHistory() {
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    const supabase = createClient();
    const repos = createRepositories(supabase);

    repos.conversations.listInternalConversations(50).then(async (rows) => {
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const msgs = await repos.conversations.listMessages(row.id, 200);
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
          // Get the first user message for classification
          const firstUserMsg = msgs.find(
            (m) => m.sender === "customer" || m.sender === "owner"
          );
          const category = classifyConversation(
            row.summary,
            firstUserMsg?.content ?? lastMsg?.content ?? null
          );
          return {
            ...row,
            messageCount: msgs.length,
            lastMessage: lastMsg?.content ?? null,
            category,
          };
        })
      );
      setConversations(enriched);
      setLoading(false);
    });
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of conversations) {
      counts[c.category] = (counts[c.category] ?? 0) + 1;
    }
    return counts;
  }, [conversations]);

  // Filtered list
  const filtered = useMemo(() => {
    if (activeFilter === "all") return conversations;
    return conversations.filter((c) => c.category === activeFilter);
  }, [conversations, activeFilter]);

  if (selectedId) {
    return (
      <ConversationDetail
        conversationId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary-accent" />
          ประวัติแชทกับ TIGA AI Agent
        </CardTitle>
        <p className="text-xs text-secondary/50">
          ทุกข้อความที่คุณคุยกับ TIGA AI Agent ผ่าน Floating Assistant จะถูกบันทึกไว้ที่นี่ — แบ่งตามหมวดหมู่ธุรกิจ
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="ยังไม่มีประวัติแชท"
            description="เริ่มคุยกับ TIGA AI Agent ผ่านปุ่ม Floating Assistant มุมขวาล่าง แล้วประวัติจะปรากฏที่นี่"
          />
        ) : (
          <>
            {/* Filter tabs */}
            <FilterTabs
              active={activeFilter}
              onSelect={setActiveFilter}
              counts={categoryCounts}
            />

            {/* Conversation list */}
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-secondary/40 py-6">
                  ยังไม่มีแชทในหมวดหมู่นี้
                </p>
              ) : (
                filtered.map((convo) => (
                  <ConversationListItem
                    key={convo.id}
                    convo={convo}
                    onClick={() => setSelectedId(convo.id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
