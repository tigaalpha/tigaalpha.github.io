"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  ImagePlus,
  BookOpen,
  GraduationCap,
  Loader2,
  Trash2,
  X,
  Sparkles,
  Upload,
  MessageSquare,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  Lightbulb,
  Paperclip,
} from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, describeFunctionError } from "@/lib/utils";
import type { KnowledgeSourceType, Tables } from "@/types/database";

/* ── Types ── */
interface ChatMessage {
  role: "owner" | "ai";
  content: string;
  imageUrl?: string;
}

interface AiChatResponse {
  conversationId: string;
  reply: string;
  needsReview: boolean;
}

/* ── Knowledge labels ── */
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
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export function ChatbotBrainView() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      {/* Left: Chat + Image upload */}
      <div className="space-y-4">
        <ChatArea />
        <ImageUploadCard />
      </div>

      {/* Right: Training panel */}
      <div className="space-y-4">
        <TrainingPanel />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CHAT AREA — Full conversation with AI
   ══════════════════════════════════════════════════════════════ */
function ChatArea() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: "ai",
        content: "สวัสดีค่ะ! หนูเป็น TIGA AI Brain 🧠\n\nคุณสามารถ:\n• 💬 พูดคุยฝึกสอนหนูได้โดยตรง\n• 📸 อัปโหลดรูปให้หนูเรียนรู้\n• 📚 เพิ่มองค์ความรู้จากแผงด้านขวา\n\nลองถามอะไรหนูสิคะ!",
      }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    const text = draft.trim();
    if ((!text && !selectedImage) || sending) return;

    const userMsg: ChatMessage = { role: "owner", content: text || "(อัปโหลดรูป)" };
    if (selectedImage) userMsg.imageUrl = selectedImage;

    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setSelectedImage(null);
    setSending(true);
    setError(null);

    try {
      const supabase = createClient();
      const body: Record<string, unknown> = {
        conversationId: conversationIdRef.current,
        message: text || "ช่วยวิเคราะห์รูปภาพนี้ให้หน่อย",
      };

      // If image selected, include as base64
      if (selectedImage) {
        body.imageUrl = selectedImage;
      }

      body.mode = "owner";
      const { data, error: fnError } = await supabase.functions.invoke<AiChatResponse>("ai-chat", {
        body,
      });
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from ai-chat");

      conversationIdRef.current = data.conversationId;
      setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelectedImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function clearChat() {
    setMessages([]);
    conversationIdRef.current = null;
    setSelectedImage(null);
    setError(null);
  }

  const QUICK_PROMPTS = [
    { icon: "📊", text: "สรุปสถานะธุรกิจวันนี้" },
    { icon: "💬", text: "ลูกค้าคนไหนรอตอบ?" },
    { icon: "📅", text: "คาบเรียนพรุ่งนี้" },
    { icon: "💰", text: "ลูกค้าค้างชำระ" },
    { icon: "🔄", text: "ทดสอบ: ตอบลูกค้าเรื่องราคา" },
    { icon: "🎓", text: "สอน: จากนี้ให้ตอบว่า..." },
  ];

  return (
    <Card className="overflow-hidden border-primary/10">
      <CardHeader className="border-b border-line/5 bg-gradient-to-r from-primary/5 to-primary-accent/5 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-lg shadow-primary/20">
            <Bot className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              Chat with AI Brain
              <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                Online
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              พูดคุย ฝึกสอน และอัปโหลดรูปให้ AI เรียนรู้
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="border-b border-line/5 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-secondary/50">⚡ เริ่มต้นคุย</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.text}
                  onClick={() => { setDraft(q.text); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="flex items-center gap-1.5 rounded-full border border-line/10 bg-line/5 px-3 py-1 text-xs text-secondary/60 transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <span>{q.icon}</span> {q.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div ref={scrollRef} className="h-[420px] space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "owner" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "owner"
                  ? "bg-primary-gradient text-white"
                  : "bg-line/5 text-secondary"
              )}>
                {m.role === "ai" && (
                  <span className="mb-1 flex items-center gap-1 text-[10px] font-medium text-primary/60">
                    <Bot className="h-3 w-3" /> TIGA AI Brain
                  </span>
                )}
                {m.imageUrl && (
                  <img
                    src={m.imageUrl}
                    alt="uploaded"
                    className="mb-2 max-h-40 rounded-xl object-cover"
                  />
                )}
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-line/5 px-4 py-2.5 text-sm">
                <span className="mb-1 flex items-center gap-1 text-[10px] font-medium text-primary/60">
                  <Bot className="h-3 w-3" /> TIGA AI Brain
                </span>
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
                  <span className="text-xs text-secondary/40">กำลังคิด...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Image preview */}
        {selectedImage && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <img src={selectedImage} alt="preview" className="h-12 w-12 rounded-lg object-cover" />
            <span className="flex-1 truncate text-xs text-secondary/70">รูปที่เลือก</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedImage(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-line/5 p-4">
          <div className="flex items-end gap-2">
            {/* Image upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 text-secondary/40 hover:text-primary"
              title="อัปโหลดรูปภาพ"
            >
              <ImagePlus className="h-5 w-5" />
            </Button>

            {/* Text input */}
            <div className="relative flex-1">
              <Textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="พิมพ์ข้อความ หรืออัปโหลดรูปให้ AI วิเคราะห์..."
                className="min-h-10 pr-10 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
            </div>

            {/* Clear + Send */}
            <div className="flex gap-1">
              {messages.length > 1 && (
                <Button size="icon" variant="ghost" onClick={clearChat} className="shrink-0 text-secondary/40 hover:text-danger" title="ล้างแชท">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                onClick={() => void send()}
                disabled={sending || (!draft.trim() && !selectedImage)}
                className="shrink-0"
                title="ส่ง"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════
   IMAGE UPLOAD CARD — Drag & drop or click to upload
   ══════════════════════════════════════════════════════════════ */
function ImageUploadCard() {
  const [uploadedImages, setUploadedImages] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const newImages: { url: string; name: string }[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;

        // Convert to base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });

        // Upload to knowledge as image reference
        const { error: fnError } = await supabase.functions.invoke("knowledge-upload", {
          body: {
            title: `Image: ${file.name}${uploadNote ? ` — ${uploadNote}` : ""}`,
            sourceType: "example",
            content: `[รูปภาพ] ${file.name}\n${uploadNote || "รูปภาพที่อัปโหลดโดยเจ้าของเพื่อให้ AI เรียนรู้"}`,
            imageUrl: base64,
          },
        });
        if (fnError) throw fnError;

        newImages.push({ url: base64, name: file.name });
      }

      setUploadedImages((prev) => [...prev, ...newImages]);
      setUploadNote("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(e.dataTransfer.files);
  }

  return (
    <Card className="overflow-hidden border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Camera className="h-4 w-4 text-primary" />
          อัปโหลดรูปภาพให้ AI เรียนรู้
        </CardTitle>
        <CardDescription className="text-xs">
          ลากวางหรือเลือกรูป — AI จะเรียนรู้จากรูปที่คุณให้
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-line/20 hover:border-primary/30 hover:bg-line/5"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
          ) : (
            <>
              <Upload className="mb-2 h-8 w-8 text-secondary/30" />
              <p className="text-sm font-medium text-secondary/60">คลิกหรือลารูปมาวางที่นี่</p>
              <p className="mt-1 text-[11px] text-secondary/40">รองรับ JPG, PNG, WEBP</p>
            </>
          )}
        </div>

        {/* Note input */}
        <Input
          placeholder="หมายเหตุ (เช่น 'รูปนี้คือราคาคอร์ส')..."
          value={uploadNote}
          onChange={(e) => setUploadNote(e.target.value)}
          className="h-9 text-sm"
        />

        {/* Uploaded images preview */}
        {uploadedImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {uploadedImages.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.url} alt={img.name} className="h-16 w-16 rounded-lg object-cover" />
                <button
                  onClick={() => setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {success && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" /> อัปโหลดสำเร็จ!
          </span>
        )}
        {error && (
          <p className="text-xs text-danger">⚠️ {error}</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════
   TRAINING PANEL — Knowledge + Sales training
   ══════════════════════════════════════════════════════════════ */
function TrainingPanel() {
  const [documents, setDocuments] = useState<Tables<"knowledge_documents">[]>([]);
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("faq");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerMsg, setCustomerMsg] = useState("");
  const [ownerReply, setOwnerReply] = useState("");
  const [salesSubmitting, setSalesSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState<"knowledge" | "sales">("knowledge");

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.knowledge.listDocuments().then(setDocuments);
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

  const filteredDocs = documents.filter((doc) =>
    !searchQuery || doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-line/5 bg-line/[0.02] px-3 py-2.5">
          <BookOpen className="h-4 w-4 text-primary" />
          <div>
            <p className="text-lg font-bold text-secondary">{documents.length}</p>
            <p className="text-[10px] text-secondary/50">องค์ความรู้</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line/5 bg-line/[0.02] px-3 py-2.5">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <div>
            <p className="text-lg font-bold text-secondary">
              {documents.filter((d) => d.source_type === "example").length}
            </p>
            <p className="text-[10px] text-secondary/50">ตัวอย่างขาย</p>
          </div>
        </div>
      </div>

      {/* Tab switch */}
      <div className="flex gap-1 rounded-xl bg-line/5 p-1">
        <button
          onClick={() => setActiveSection("knowledge")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
            activeSection === "knowledge"
              ? "bg-card text-primary shadow-sm"
              : "text-secondary/50 hover:text-secondary/70"
          )}
        >
          <BookOpen className="h-3.5 w-3.5" /> เพิ่มองค์ความรู้
        </button>
        <button
          onClick={() => setActiveSection("sales")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
            activeSection === "sales"
              ? "bg-card text-primary shadow-sm"
              : "text-secondary/50 hover:text-secondary/70"
          )}
        >
          <Lightbulb className="h-3.5 w-3.5" /> สอนขายของ
        </button>
      </div>

      {/* Knowledge form */}
      {activeSection === "knowledge" && (
        <Card className="border-line/5">
          <CardContent className="p-4">
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
          </CardContent>
        </Card>
      )}

      {/* Sales form */}
      {activeSection === "sales" && (
        <Card className="border-line/5">
          <CardContent className="p-4">
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
          </CardContent>
        </Card>
      )}

      {/* Documents list */}
      <Card className="border-line/5">
        <CardContent className="p-4">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary/30" />
            <Input
              placeholder="ค้นหาองค์ความรู้..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {filteredDocs.length === 0 ? (
              <p className="py-4 text-center text-xs text-secondary/40">
                {searchQuery ? "ไม่พบผลลัพธ์" : "ยังไม่มีองค์ความรู้"}
              </p>
            ) : (
              filteredDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-line/5 group">
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-secondary/70">{doc.title}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {SOURCE_LABELS[doc.source_type] || doc.source_type}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-secondary/20 opacity-0 group-hover:opacity-100 hover:text-danger transition-opacity"
                    onClick={() => handleDeleteDoc(doc.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
          ⚠️ {error}
        </div>
      )}
    </>
  );
}
