"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Search,
  Megaphone,
  TrendingUp,
  Shield,
  Settings,
  Users,
  ShoppingCart,
  Headphones,
  Share2,
  Target,
  Loader2,
  Cpu,
} from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { CHAT_MODELS, DEFAULT_CHAT_MODEL_ID } from "@/lib/chat-models";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

/* ── Department registry ──────────────────────────────────────────────── */
interface Department {
  slug: string;
  label: string;
  icon: typeof Megaphone;
  color: string;
  bg: string;
  systemPrompt: string;
}

const DEPARTMENTS: Department[] = [
  {
    slug: "chief_of_staff",
    label: "Chief of Staff",
    icon: Shield,
    color: "text-orange-500",
    bg: "bg-orange-500",
    systemPrompt:
      "คุณคือ Chief of Staff ของ TIGA.AI — ผู้ประสานงานทุกฝ่าย ดูแลภาพรวมธุรกิจ จัดลำดับความสำคัญ สั่งงานแผนกต่างๆ และรายงานให้เจ้าของธุรกิจ ตอบเป็นภาษาไทย กระชับ ชัดเจน",
  },
  {
    slug: "marketing",
    label: "การตลาด",
    icon: Megaphone,
    color: "text-purple-500",
    bg: "bg-purple-500",
    systemPrompt:
      "คุณคือฝ่ายการตลาดของ TIGA.AI — โรงเรียนสอนเปียโน ดูแลแคมเปญโฆษณา โปรโมชัน SEO Content Marketing Social Media วิเคราะห์ ROI และวางแผนกลยุทธ์การตลาด ตอบเป็นภาษาไทย กระชับ มีข้อมูลสนับสนุน",
  },
  {
    slug: "growth",
    label: "Growth",
    icon: TrendingUp,
    color: "text-teal-500",
    bg: "bg-teal-500",
    systemPrompt:
      "คุณคือฝ่าย Growth ของ TIGA.AI — โรงเรียนสอนเปียโน ดูแลการเติบโตของธุรกิจ Lead Generation Conversion Optimization Retention Referral วิเคราะห์ Funnel และหาโอกาสเติบโต ตอบเป็นภาษาไทย",
  },
  {
    slug: "alpha",
    label: "อัลฟา",
    icon: Target,
    color: "text-green-500",
    bg: "bg-green-500",
    systemPrompt:
      "คุณคือ Alpha Agent — หัวหน้าทีม AI ของ TIGA.AI โรงเรียนสอนเปียโน ดูแลภาพรวมการดำเนินงาน ประสานงานทุกฝ่าย วิเคราะห์สถานการณ์ และเสนอแนะเชิงกลยุทธ์ ตอบเป็นภาษาไทย ฉลาด ตรงประเด็น",
  },
  {
    slug: "operations",
    label: "ปฏิบัติการ",
    icon: Settings,
    color: "text-orange-600",
    bg: "bg-orange-600",
    systemPrompt:
      "คุณคือฝ่ายปฏิบัติการของ TIGA.AI — โรงเรียนสอนเปียโน ดูแลตารางเรียน การจองคิวครู ยืนยันการมาเรียน อุปกรณ์ และการดำเนินงานประจำวัน ตอบเป็นภาษาไทย กระชับ ปฏิบัติได้จริง",
  },
  {
    slug: "sales",
    label: "ขาย",
    icon: ShoppingCart,
    color: "text-pink-500",
    bg: "bg-pink-500",
    systemPrompt:
      "คุณคือฝ่ายขายของ TIGA.AI — โรงเรียนสอนเปียโน ดูแล Lead Pipeline การติดตามลูกค้า การปิดการขาย โปรโมชัน การต่ออายุคอร์ส และกลยุทธ์ขาย ตอบเป็นภาษาไทย กระตือรือร้น มีเทคนิคขาย",
  },
  {
    slug: "customer",
    label: "ลูกค้า",
    icon: Users,
    color: "text-amber-500",
    bg: "bg-amber-500",
    systemPrompt:
      "คุณคือฝ่ายบริการลูกค้าของ TIGA.AI — โรงเรียนสอนเปียโน ดูแลความพึงพอใจลูกค้า แก้ไขปัญหา ตอบคำถาม ดูแลสัมพันธภาพ และให้บริการหลังการขาย ตอบเป็นภาษาไทย สุภาพ เป็นมิตร",
  },
  {
    slug: "tech",
    label: "Tech",
    icon: Headphones,
    color: "text-orange-500",
    bg: "bg-orange-400",
    systemPrompt:
      "คุณคือฝ่าย Tech ของ TIGA.AI — ดูแลระบบ Technology Infrastructure แอปพลิเคชัน เว็บไซต์ API Database การ deploy และ technical issues ตอบเป็นภาษาไทย ชัดเจน มีความรู้ทางเทคนิค",
  },
  {
    slug: "content",
    label: "เนื้อหา",
    icon: Share2,
    color: "text-blue-500",
    bg: "bg-blue-500",
    systemPrompt:
      "คุณคือฝ่ายเนื้อหาของ TIGA.AI — โรงเรียนสอนเปียโน ดูแล Content Calendar บทความ SEO Social Media วิดีโอ สื่อการสอน และแบรนด์ Content ตอบเป็นภาษาไทย สร้างสรรค์ มีไอเดีย",
  },
  {
    slug: "strategy",
    label: "กลยุทธ์",
    icon: Target,
    color: "text-yellow-600",
    bg: "bg-yellow-600",
    systemPrompt:
      "คุณคือฝ่ายกลยุทธ์ของ TIGA.AI — โรงเรียนสอนเปียโน ดูแลแผนธุรกิจ วิเคราะห์คู่แข่ง วางเป้าหมายระยะยาว ตัดสินใจเชิงกลยุทธ์ และวางแผนเติบโต ตอบเป็นภาษาไทย มีวิสัยทัศน์ ลึกซึ้ง",
  },
];

/* ── Conversation helpers (Supabase) ─────────────────────────────────── */
const DEPT_PREFIX = "dept:";

function supabase() {
  return createClient();
}

async function findDeptConversation(deptSlug: string): Promise<Tables<"conversations"> | null> {
  const tag = `${DEPT_PREFIX}${deptSlug}`;
  const { data } = await supabase()
    .from("conversations")
    .select("*")
    .eq("line_user_id", tag)
    .eq("channel", "internal")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function createDeptConversation(deptSlug: string): Promise<Tables<"conversations">> {
  const tag = `${DEPT_PREFIX}${deptSlug}`;
  const { data, error } = await supabase()
    .from("conversations")
    .insert({ channel: "internal", line_user_id: tag })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function getDeptConversation(deptSlug: string): Promise<Tables<"conversations">> {
  const existing = await findDeptConversation(deptSlug);
  if (existing) return existing;
  return createDeptConversation(deptSlug);
}

async function loadMessages(conversationId: string): Promise<Tables<"messages">[]> {
  const { data } = await supabase()
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function sendAiMessage(
  conversationId: string,
  message: string,
  _dept: Department
): Promise<string> {
  const { data, error } = await supabase().functions.invoke("ai-chat", {
    body: { conversationId, message, mode: "owner" },
  });
  if (error) throw error;
  return data?.reply ?? "ขออภัย เกิดข้อผิดพลาดในการตอบกลับ";
}

/* ── UI: Department avatar ────────────────────────────────────────────── */
function DeptAvatar({ dept, size = 44 }: { dept: Department; size?: number }) {
  const Icon = dept.icon;
  return (
    <div
      className={cn("flex items-center justify-center rounded-full shrink-0", dept.bg)}
      style={{ width: size, height: size }}
    >
      <Icon className="text-white" style={{ width: size * 0.45, height: size * 0.45 }} />
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const diff = now.getTime() - d.getTime();
  if (diff < 7 * 86_400_000) return d.toLocaleDateString("th-TH", { weekday: "short" });
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

/* ── UI: Department card (inbox row) ──────────────────────────────────── */
interface DeptCardProps {
  dept: Department;
  lastMessage?: string;
  lastTime?: string;
  onClick: () => void;
}

function DeptCard({ dept, lastMessage, lastTime, onClick }: DeptCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100"
    >
      <DeptAvatar dept={dept} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-900 truncate">{dept.label}</span>
          {lastTime && (
            <span className="shrink-0 text-[11px] text-gray-400">{lastTime}</span>
          )}
        </div>
        {lastMessage ? (
          <p className="mt-0.5 truncate text-xs text-gray-500">{lastMessage}</p>
        ) : (
          <p className="mt-0.5 truncate text-xs text-gray-300 italic">ยังไม่มีข้อความ</p>
        )}
      </div>
    </button>
  );
}

/* ── UI: Message thread view ──────────────────────────────────────────── */
function ThreadView({
  dept,
  messages,
  onBack,
  onSend,
  sending,
  chatModel,
  onModelChange,
  savingModel,
}: {
  dept: Department;
  messages: Tables<"messages">[];
  onBack: () => void;
  onSend: (text: string) => void;
  sending: boolean;
  chatModel: string;
  onModelChange: (value: string) => void;
  savingModel: boolean;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    onSend(draft.trim());
    setDraft("");
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 shrink-0 bg-white">
        <button onClick={onBack} className="lg:hidden p-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <DeptAvatar dept={dept} size={36} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-900">{dept.label}</span>
          <p className="text-[11px] text-gray-400">AI Automation</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 pl-2 pr-1 py-1">
          <Cpu className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <select
            value={chatModel}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={savingModel}
            aria-label="เลือกโมเดล AI"
            title="โมเดล AI ที่แผนกนี้ใช้ตอบ — เปลี่ยนได้ที่นี่"
            className="min-w-0 max-w-[120px] cursor-pointer appearance-none border-0 bg-transparent py-0.5 pr-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-0"
          >
            {CHAT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {savingModel && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-gray-400" />}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <DeptAvatar dept={dept} size={56} />
            <p className="mt-3 text-sm font-medium text-gray-600">{dept.label}</p>
            <p className="mt-1 text-xs text-gray-400">เริ่มสนทนากับ AI {dept.label} ได้เลย</p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwner = msg.sender === "owner";
          return (
            <div
              key={msg.id}
              className={cn("flex", isOwner ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                  isOwner
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-white text-gray-800 border border-gray-200 shadow-sm rounded-bl-md"
                )}
              >
                {msg.content}
                <div
                  className={cn(
                    "mt-1 text-[10px]",
                    isOwner ? "text-blue-200" : "text-gray-400"
                  )}
                >
                  {new Date(msg.created_at).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
              <span className="text-xs text-gray-400">กำลังคิด...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 px-4 py-3 shrink-0 bg-white">
        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`พิมพ์ข้อความถึง ${dept.label}...`}
            className="min-h-[40px] max-h-[120px] resize-none bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim() || sending}
            className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────── */
export function AiAutomationChat() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [messages, setMessages] = useState<Tables<"messages">[]>([]);
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [lastMessages, setLastMessages] = useState<
    Record<string, { text: string; time: string }>
  >({});
  const [query, setQuery] = useState("");
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL_ID);
  const [savingModel, setSavingModel] = useState(false);
  const selectedDept = DEPARTMENTS.find((d) => d.slug === selectedSlug) ?? null;

  // Load the model the whole AI Automation system currently runs on
  // (same `ai_chat_model` setting the ai-chat edge function reads).
  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.integrations
      .get("ai_chat_model")
      .then((v) => setChatModel(v ?? DEFAULT_CHAT_MODEL_ID))
      .catch(() => {});
  }, []);

  async function changeChatModel(value: string) {
    setChatModel(value);
    setSavingModel(true);
    try {
      const repos = createRepositories(createClient());
      await repos.integrations.set("ai_chat_model", value);
    } catch {
      // keep the optimistic UI; the next load re-syncs from the server
    }
    setSavingModel(false);
  }

  useEffect(() => {
    (async () => {
      const results: Record<string, { text: string; time: string }> = {};
      for (const dept of DEPARTMENTS) {
        const conv = await findDeptConversation(dept.slug);
        if (conv) {
          const msgs = await loadMessages(conv.id);
          if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg) {
              results[dept.slug] = {
                text: lastMsg.content.slice(0, 80),
                time: formatTime(lastMsg.created_at),
              };
            }
          }
        }
      }
      setLastMessages(results);
    })();
  }, []);

  async function selectDept(slug: string) {
    setSelectedSlug(slug);
    setMobileShowThread(true);
    const conv = await getDeptConversation(slug);
    setConvId(conv.id);
    const msgs = await loadMessages(conv.id);
    setMessages(msgs);
  }

  async function handleSend(text: string) {
    if (!convId || !selectedDept) return;
    setSending(true);
    try {
      await sendAiMessage(convId, text, selectedDept);
      const updatedMsgs = await loadMessages(convId);
      setMessages(updatedMsgs);
      setLastMessages((prev) => ({
        ...prev,
        [selectedDept.slug]: {
          text: text.slice(0, 80),
          time: "เมื่อสักครู่",
        },
      }));
    } catch {
      // Silently handle errors
    }
    setSending(false);
  }

  const filteredDepts = DEPARTMENTS.filter((d) =>
    !query.trim()
      ? true
      : d.label.toLowerCase().includes(query.toLowerCase()) ||
        d.slug.includes(query.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-white">
      {/* Sidebar: department list */}
      <div
        className={cn(
          "flex w-full flex-col border-r border-gray-200 lg:w-[360px] shrink-0 bg-white",
          mobileShowThread ? "hidden lg:flex" : "flex"
        )}
      >
        {/* Header — model selector sits right beside the title */}
        <div className="border-b border-gray-200 px-4 py-4 bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 shrink-0">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              AI Automation Chat
            </h2>
            <div className="relative min-w-0 flex-1 flex justify-end">
              <div className="flex min-w-0 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 pl-2 pr-1 py-1">
                <Cpu className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                <select
                  value={chatModel}
                  onChange={(e) => void changeChatModel(e.target.value)}
                  disabled={savingModel}
                  aria-label="เลือกโมเดล AI"
                  title="โมเดล AI ที่ทุกแผนกใช้ตอบ — เปลี่ยนได้ที่นี่"
                  className="min-w-0 max-w-[150px] truncate cursor-pointer appearance-none border-0 bg-transparent py-0.5 pr-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-0"
                >
                  {CHAT_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {savingModel && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-gray-400" />}
              </div>
            </div>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">
            สนทนากับ AI แยกตามแผนก
          </p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาแผนก..."
              className="pl-9 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Department list */}
        <div className="flex-1 overflow-y-auto">
          {filteredDepts.map((dept) => (
            <DeptCard
              key={dept.slug}
              dept={dept}
              lastMessage={lastMessages[dept.slug]?.text}
              lastTime={lastMessages[dept.slug]?.time}
              onClick={() => selectDept(dept.slug)}
            />
          ))}
          {filteredDepts.length === 0 && (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <Search className="h-8 w-8 mb-2" />
              <p className="text-sm">ไม่พบแผนกที่ค้นหา</p>
            </div>
          )}
        </div>
      </div>

      {/* Thread view */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          !mobileShowThread ? "hidden lg:flex" : "flex"
        )}
      >
        {selectedDept ? (
          <ThreadView
            dept={selectedDept}
            messages={messages}
            onBack={() => setMobileShowThread(false)}
            onSend={handleSend}
            sending={sending}
            chatModel={chatModel}
            onModelChange={(v) => void changeChatModel(v)}
            savingModel={savingModel}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center bg-gray-50">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-blue-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">เลือกแผนกเพื่อเริ่มสนทนา</p>
            <p className="mt-1 text-xs text-gray-400">
              แตะแผนกทางด้านซ้ายเพื่อเริ่มแชทกับ AI
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
