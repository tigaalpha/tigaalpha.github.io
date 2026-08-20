"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  BookOpen,
  GraduationCap,
  Settings,
  MessageSquare,
  Plus,
  FileText,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
  Eye,
  Sparkles,
  TrendingUp,
  Zap,
  Shield,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, describeFunctionError } from "@/lib/utils";
import { BASE_PATH } from "@/lib/constants";
import type { KnowledgeSourceType, Tables } from "@/types/database";

/* ── Types ── */
type PanelTab = "chat" | "train" | "control";

interface ChatMessage {
  role: "owner" | "ai";
  content: string;
}

interface AiChatResponse {
  conversationId: string;
  reply: string;
  needsReview: boolean;
}

/* ── Knowledge source type labels (Thai) ── */
const SOURCE_LABELS: Record<KnowledgeSourceType, string> = {
  pricing: "💰 ราคา",
  promotion: "🎁 โปรโมชัน",
  teachers: "👨‍🏫 คุณครู",
  policies: "📋 นโยบาย",
  faq: "❓ คำถามที่พบบ่อย",
  school_info: "🏫 ข้อมูลโรงเรียน",
  holiday: "📅 วันหยุด",
  internal_sop: "📝 SOP ภายใน",
  sales_script: "🗣️ สคริปต์ขาย",
  objection_handling: "🛡️ จัดการข้อโต้แย้ง",
  rule: "⚖️ กฎ",
  example: "💬 ตัวอย่างสนทนา",
  correction: "✏️ แก้ไข",
};

const TRAIN_TYPES: KnowledgeSourceType[] = [
  "pricing", "promotion", "teachers", "policies", "faq",
  "school_info", "sales_script", "objection_handling", "rule", "example",
];

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT — AI Command Center
   ══════════════════════════════════════════════════════════════ */
export function AiControlPanel({ onReplied }: { onReplied?: () => void }) {
  const [tab, setTab] = useState<PanelTab>("chat");

  return (
    <Card className="overflow-hidden border-primary/10 shadow-sm">
      {/* ── Header ── */}
      <CardHeader className="border-b border-line/5 bg-gradient-to-r from-primary/5 via-primary-accent/5 to-primary/5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-lg shadow-primary/20">
              <Bot className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                TIGA AI Agent
                <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Online
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                พูดคุย ฝึก และควบคุม Chatbot ของคุณโดยตรง
              </CardDescription>
            </div>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="mt-3 flex gap-1 rounded-xl bg-line/5 p-1">
          <TabButton
            active={tab === "chat"}
            onClick={() => setTab("chat")}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            label="💬 คุยกับ AI"
          />
          <TabButton
            active={tab === "train"}
            onClick={() => setTab("train")}
            icon={<GraduationCap className="h-3.5 w-3.5" />}
            label="📚 สอน AI"
          />
          <TabButton
            active={tab === "control"}
            onClick={() => setTab("control")}
            icon={<Settings className="h-3.5 w-3.5" />}
            label="⚙️ ควบคุม"
          />
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {tab === "chat" && <OwnerChatTab onReplied={onReplied} />}
        {tab === "train" && <TrainTab />}
        {tab === "control" && <ControlTab />}
      </CardContent>
    </Card>
  );
}

/* ── Tab Button ── */
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
        active
          ? "bg-card text-primary shadow-sm"
          : "text-secondary/50 hover:text-secondary/70"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB 1: OWNER CHAT — Direct line to the AI
   ══════════════════════════════════════════════════════════════ */
function OwnerChatTab({ onReplied }: { onReplied?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Always start a fresh owner-mode conversation
  useEffect(() => {
    // Reset conversation so we always create a new "internal" channel
    // conversation with mode: "owner" on each mount
    conversationIdRef.current = null;
    setMessages([{
      role: "ai",
      content: "สวัสดีค่ะ! หนูเป็น TIGA AI Agent ของโรงเรียน เป็นผู้ช่วย AI ธุรกิจของคุณ\n\nคุณสามารถ:\n• 📊 ถามเรื่องสถานะธุรกิจ ลูกค้า รายได้\n• 💬 คุยทดสอบกับลูกค้าในแชท\n• 📅 ดูตารางเรียน จองคาบ\n• 🎓 สอนหนูให้ตอบได้ดีขึ้น\n\nลองถามอะไรหนูสิคะ! 🎹",
    }]);
  }, []);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "owner", content: text }]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<AiChatResponse>("ai-chat", {
        body: { conversationId: conversationIdRef.current, message: text, mode: "owner" },
      });
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from ai-chat");

      conversationIdRef.current = data.conversationId;
      setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
      onReplied?.();
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function clearChat() {
    setMessages([]);
    conversationIdRef.current = null;
    setError(null);
  }

  const QUICK_ACTIONS = [
    { icon: "📊", text: "สรุปสถานะธุรกิจวันนี้", desc: "ลูกค้า คาบเรียน รายได้" },
    { icon: "💬", text: "ลูกค้าคนไหนรอตอบ?", desc: "แชทที่ needs_review" },
    { icon: "📅", text: "คาบเรียนพรุ่งนี้มีอะไรบ้าง?", desc: "ตารางเรียน" },
    { icon: "💰", text: "ลูกค้าค้างชำระใครบ้าง?", desc: "ตรวจสอบยอดค้าง" },
    { icon: "🔄", text: "ทดสอบ: ถ้าลูกค้าถามราคา จะตอบว่า?", desc: "ลองตอบเป็นลูกค้า" },
    { icon: "🎓", text: "สอน: ต่อจากนี้ให้ตอบว่า...", desc: "สอนคำตอบใหม่" },
  ];

  return (
    <div className="space-y-3">
      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-secondary/60">⚡ สั่งงานด่วน</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.text}
                onClick={() => { setDraft(a.text); setTimeout(() => inputRef.current?.focus(), 50); }}
                className="flex items-start gap-2 rounded-xl border border-line/5 bg-line/[0.02] px-3 py-2 text-left transition-all hover:border-primary/20 hover:bg-primary/5"
              >
                <span className="mt-0.5 text-sm">{a.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-secondary/80 truncate">{a.text}</p>
                  <p className="text-[10px] text-secondary/40">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-72 space-y-2 overflow-y-auto rounded-xl bg-line/5 p-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "owner" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "owner"
                    ? "bg-primary-gradient text-white"
                    : "bg-card text-secondary shadow-soft"
                )}
              >
                {m.role === "ai" && (
                  <span className="mb-1 flex items-center gap-1 text-[10px] font-medium text-primary/60">
                    <Bot className="h-3 w-3" /> TIGA AI
                  </span>
                )}
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-card px-3 py-2 text-sm shadow-soft">
                <span className="mb-1 flex items-center gap-1 text-[10px] font-medium text-primary/60">
                  <Bot className="h-3 w-3" /> TIGA AI
                </span>
                <div className="flex items-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
                  <span className="text-xs text-secondary/40">กำลังคิด...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="พิมพ์ข้อความถึง AI ของคุณ..."
            className="min-h-10 pr-10 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
        </div>
        <div className="flex gap-1">
          {messages.length > 1 && (
            <Button size="icon" variant="ghost" onClick={clearChat} className="shrink-0 text-secondary/40 hover:text-danger" title="ล้างแชท">
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" onClick={() => void send()} disabled={sending || !draft.trim()} className="shrink-0" title="ส่ง">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB 2: TRAIN — Knowledge & Sales training
   ══════════════════════════════════════════════════════════════ */
function TrainTab() {
  const [documents, setDocuments] = useState<Tables<"knowledge_documents">[]>([]);
  const [examples, setExamples] = useState<Tables<"sales_chat_examples">[]>([]);
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("faq");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [customerMsg, setCustomerMsg] = useState("");
  const [ownerReply, setOwnerReply] = useState("");
  const [salesSubmitting, setSalesSubmitting] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"add" | "sales" | "list">("add");
  const [selectedDoc, setSelectedDoc] = useState<Tables<"knowledge_documents"> | null>(null);
  const [editingDoc, setEditingDoc] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.knowledge.listDocuments().then(setDocuments);
    repos.salesChatExamples.list().then(setExamples);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleAddKnowledge(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();
      const { error: fnError } = await supabase.functions.invoke("knowledge-upload", {
        body: { title, sourceType, content },
      });
      if (fnError) throw fnError;
      setTitle("");
      setContent("");
      setSuccess(true);
      reload();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddSalesExample(e: React.FormEvent) {
    e.preventDefault();
    if (!customerMsg.trim() || !ownerReply.trim()) return;
    setSalesSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: fnError } = await supabase.functions.invoke("knowledge-upload", {
        body: {
          title: `Sales: ${customerMsg.slice(0, 40)}`,
          sourceType: "example",
          content: `ลูกค้า: ${customerMsg}\nเจ้าของ: ${ownerReply}`,
        },
      });
      if (fnError) throw fnError;
      setCustomerMsg("");
      setOwnerReply("");
      setShowSalesForm(false);
      setExpandedSection("list");
      reload();
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setSalesSubmitting(false);
    }
  }

  async function handleDeleteDoc(id: string) {
    const repos = createRepositories(createClient());
    await repos.knowledge.deleteDocument(id);
    reload();
  }

  function startEditDoc() {
    if (!selectedDoc) return;
    setEditTitle(selectedDoc.title || "");
    setEditContent(selectedDoc.raw_text || "");
    setEditingDoc(true);
  }

  async function saveEditDoc() {
    if (!selectedDoc) return;
    setSaving(true);
    try {
      const repos = createRepositories(createClient());
      await repos.knowledge.updateDocument(selectedDoc.id, {
        title: editTitle.trim() || selectedDoc.title,
        raw_text: editContent,
      });
      setDocuments((prev) => prev.map((d) => d.id === selectedDoc.id ? { ...d, title: editTitle.trim() || d.title, raw_text: editContent } : d));
      setSelectedDoc({ ...selectedDoc, title: editTitle.trim() || selectedDoc.title, raw_text: editContent });
      setEditingDoc(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const filteredDocs = documents.filter((doc) =>
    !searchQuery || doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.source_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-line/5 px-3 py-1.5 text-xs text-secondary/60">
          <BookOpen className="h-3.5 w-3.5" /> {documents.length} องค์ความรู้
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-line/5 px-3 py-1.5 text-xs text-secondary/60">
          <MessageSquare className="h-3.5 w-3.5" /> {examples.length} ตัวอย่างขาย
        </div>
      </div>

      {/* Add knowledge section */}
      <CollapsibleSection
        title="➕ เพิ่มองค์ความรู้"
        icon={<BookOpen className="h-4 w-4 text-primary" />}
        expanded={expandedSection === "add"}
        onToggle={() => setExpandedSection(expandedSection === "add" ? "list" : "add")}
      >
        <form onSubmit={handleAddKnowledge} className="space-y-2">
          <Input
            placeholder="หัวข้อ เช่น 'ราคาคอร์ส 20 ชม.'"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 text-sm"
          />
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as KnowledgeSourceType)}
            className="h-9 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {TRAIN_TYPES.map((type) => (
              <option key={type} value={type}>{SOURCE_LABELS[type]}</option>
            ))}
          </select>
          <Textarea
            placeholder="วางข้อมูล เช่น ราคา โปรโมชัน นโยบาย FAQ..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-20 text-sm"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={submitting || !content.trim()}>
              {submitting ? "กำลังบันทึก..." : "💾 บันทึก"}
            </Button>
            {success && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" /> บันทึกแล้ว!
              </span>
            )}
          </div>
        </form>
      </CollapsibleSection>

      {/* Sales training section */}
      <CollapsibleSection
        title="🗣️ สอน AI ขายของ"
        icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
        expanded={expandedSection === "sales"}
        onToggle={() => setExpandedSection(expandedSection === "sales" ? "list" : "sales")}
      >
        <p className="mb-2 text-[11px] text-secondary/50">
          ใส่ตัวอย่างบทสนทนาที่คุณเคยตอบลูกค้า — AI จะเรียนรู้สไตล์การขายของคุณ
        </p>
        <form onSubmit={handleAddSalesExample} className="space-y-2">
          <Textarea
            placeholder="ลูกค้าพิมพ์ว่า..."
            value={customerMsg}
            onChange={(e) => setCustomerMsg(e.target.value)}
            className="min-h-16 text-sm"
          />
          <Textarea
            placeholder="คุณตอบว่า..."
            value={ownerReply}
            onChange={(e) => setOwnerReply(e.target.value)}
            className="min-h-16 text-sm"
          />
          <Button type="submit" size="sm" variant="outline" disabled={salesSubmitting || !customerMsg.trim() || !ownerReply.trim()}>
            {salesSubmitting ? "กำลังบันทึก..." : "💬 บันทึกตัวอย่าง"}
          </Button>
        </form>
      </CollapsibleSection>

      {/* Documents list */}
      <CollapsibleSection
        title={`📋 องค์ความรู้ทั้งหมด (${filteredDocs.length})`}
        icon={<FileText className="h-4 w-4 text-secondary/50" />}
        expanded={expandedSection === "list"}
        onToggle={() => setExpandedSection(expandedSection === "list" ? "add" : "list")}
      >
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary/30" />
          <Input
            placeholder="ค้นหา..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {filteredDocs.length === 0 ? (
            <p className="py-4 text-center text-xs text-secondary/40">
              {searchQuery ? "ไม่พบผลลัพธ์" : "ยังไม่มีองค์ความรู้ — เพิ่มได้จากด้านบน"}
            </p>
          ) : (
            filteredDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-line/5 group cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                <div className="min-w-0 flex-1">
                  <span className="truncate text-secondary/70">{doc.title}</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {SOURCE_LABELS[doc.source_type] || doc.source_type}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-secondary/20 opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                    onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc); }}
                    title="ดูรายละเอียด"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-secondary/20 opacity-0 group-hover:opacity-100 hover:text-danger transition-opacity"
                    onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }}
                    title="ลบ"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CollapsibleSection>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Document Detail Popup */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setSelectedDoc(null); setEditingDoc(false); }}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{SOURCE_LABELS[selectedDoc.source_type]?.split(" ")[0] || "📄"}</span>
                {editingDoc ? (
                  <input
                    className="flex-1 rounded-lg border border-line/20 bg-line/5 px-3 py-1.5 text-sm font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="ชื่อองค์ความรู้"
                  />
                ) : (
                  <h3 className="text-sm font-semibold text-secondary">{selectedDoc.title}</h3>
                )}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedDoc(null); setEditingDoc(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {SOURCE_LABELS[selectedDoc.source_type] || selectedDoc.source_type}
              </Badge>
              {selectedDoc.created_at && (
                <Badge variant="outline" className="text-[10px] text-secondary/50">
                  📅 {new Date(selectedDoc.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                </Badge>
              )}
              {editingDoc && (
                <Badge variant="outline" className="text-[10px] text-primary animate-pulse">
                  ✏️ กำลังแก้ไข
                </Badge>
              )}
            </div>
            {editingDoc ? (
              <textarea
                className="min-h-[200px] w-full rounded-xl border border-line/20 bg-line/5 p-4 text-sm leading-relaxed text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="เนื้อหาองค์ความรู้..."
              />
            ) : (
              <div className="whitespace-pre-wrap rounded-xl bg-line/5 p-4 text-sm leading-relaxed text-secondary/80">
                {selectedDoc.raw_text || selectedDoc.file_path || "(ไม่มีเนื้อหา)"}
              </div>
            )}
            <div className="mt-3 flex justify-between gap-2">
              <div>
                <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => { handleDeleteDoc(selectedDoc.id); setSelectedDoc(null); setEditingDoc(false); }}>
                  <Trash2 className="mr-1 h-3 w-3" /> ลบ
                </Button>
              </div>
              <div className="flex gap-2">
                {editingDoc ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditingDoc(false)}>ยกเลิก</Button>
                    <Button size="sm" onClick={saveEditDoc} disabled={saving}>
                      {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedDoc(null); setEditingDoc(false); }}>ปิด</Button>
                    <Button size="sm" onClick={startEditDoc}>
                      ✏️ แก้ไข
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB 3: CONTROL — AI features & status
   ══════════════════════════════════════════════════════════════ */
function ControlTab() {
  const [docCount, setDocCount] = useState<number | null>(null);
  const [exampleCount, setExampleCount] = useState<number | null>(null);
  const [convoCount, setConvoCount] = useState<number | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.knowledge.listDocuments().then((d) => setDocCount(d.length));
    repos.salesChatExamples.list().then((e) => setExampleCount(e.length));
    repos.conversations.listRecent(100).then((c) => setConvoCount(c.length));
  }, []);

  const features = [
    { icon: "💬", name: "รับแชท LINE / Web", desc: "AI ตอบลูกค้าอัตโนมัติ", link: `${BASE_PATH}/chat` },
    { icon: "📅", name: "จอง/เลื่อนคาบ", desc: "ลูกค้าจองผ่านแชทได้เลย", link: `${BASE_PATH}/calendar` },
    { icon: "💰", name: "ตรวจสอบสลิป", desc: "AI ตรวจสลิปและบันทึกรายได้", link: `${BASE_PATH}/accounting` },
    { icon: "🔄", name: "Automation Rules", desc: "กฎอัตโนมัติ เตือน/ต่ออายุ", link: `${BASE_PATH}/automation` },
    { icon: "📚", name: "Knowledge Base", desc: "องค์ความรู้ที่ AI ค้นหา", link: `${BASE_PATH}/knowledge` },
    { icon: "📊", name: "รายงานธุรกิจ", desc: "สรุปรายวัน/รายสัปดาห์", link: `${BASE_PATH}/reports` },
    { icon: "🎓", name: "Sales Style Learning", desc: "เรียนรู้สไตล์การขาย", link: `${BASE_PATH}/knowledge` },
    { icon: "🛡️", name: "Objection Handling", desc: "จัดการข้อโต้แย้งลูกค้า", link: `${BASE_PATH}/knowledge` },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox icon="📚" label="องค์ความรู้" value={docCount} link={`${BASE_PATH}/knowledge`} />
        <StatBox icon="💬" label="ตัวอย่างขาย" value={exampleCount} link={`${BASE_PATH}/knowledge`} />
        <StatBox icon="📨" label="แชททั้งหมด" value={convoCount} link={`${BASE_PATH}/chat`} />
      </div>

      {/* AI Features */}
      <div>
        <p className="mb-2 text-xs font-medium text-secondary/60">🤖 ฟีเจอร์ที่ AI ทำได้</p>
        <div className="space-y-1.5">
          {features.map((f) => (
            <a
              key={f.name}
              href={f.link}
              className="flex items-center gap-3 rounded-xl border border-line/5 px-3 py-2 transition-colors hover:border-primary/20 hover:bg-primary/5"
            >
              <span className="text-base">{f.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-secondary">{f.name}</p>
                <p className="text-[11px] text-secondary/50">{f.desc}</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:bg-green-900/20 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Active
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-secondary/30" />
            </a>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2">
        <a href={`${BASE_PATH}/automation`}>
          <Button variant="outline" size="sm" className="w-full text-xs">
            <Zap className="mr-1 h-3 w-3" /> Automation
          </Button>
        </a>
        <a href={`${BASE_PATH}/knowledge`}>
          <Button variant="outline" size="sm" className="w-full text-xs">
            <BookOpen className="mr-1 h-3 w-3" /> Knowledge
          </Button>
        </a>
      </div>
    </div>
  );
}

/* ── Stat Box ── */
function StatBox({ icon, label, value, link }: { icon: string; label: string; value: number | null; link: string }) {
  return (
    <a href={link} className="flex flex-col items-center rounded-xl border border-line/5 p-3 transition-colors hover:border-primary/20 hover:bg-primary/5">
      <span className="text-base">{icon}</span>
      <span className="mt-1 text-lg font-bold text-secondary">{value !== null ? value : "…"}</span>
      <span className="text-[10px] text-secondary/50">{label}</span>
    </a>
  );
}

/* ── Collapsible Section ── */
function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line/5">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-secondary">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-secondary/40" />
        ) : (
          <ChevronDown className="h-4 w-4 text-secondary/40" />
        )}
      </button>
      {expanded && <div className="border-t border-line/5 px-3 pb-3 pt-3">{children}</div>}
    </div>
  );
}
