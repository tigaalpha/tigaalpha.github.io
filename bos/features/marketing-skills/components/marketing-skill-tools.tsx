"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Zap,
  PenTool,
  BarChart3,
  Target,
  Megaphone,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  Brain,
  Hash,
  MessageSquare,
  Users,
  TrendingUp,
  Calendar,
  Share2,
  Video,
  BookOpen,
  FileText,
  TestTube,
  DollarSign,
  Compass,
  Flame,
  Send,
  Search,
  Shuffle,
  Trash2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { CHAT_MODELS } from "@/lib/chat-models";

/* ── Types ── */

interface SkillResult {
  toolType: string;
  topic: string;
  language: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  model: string;
  createdAt: string;
}

type TierId = "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

/* ── LocalStorage helpers ── */

const STORAGE_KEY = "tiga_marketing_content_v1";

function loadSavedContent(): SkillResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SkillResult[];
  } catch {
    return [];
  }
}

function saveContentToStorage(item: SkillResult): void {
  try {
    const existing = loadSavedContent();
    const updated = [item, ...existing].slice(0, 200); // keep 200 items max
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* ignore quota errors */ }
}

function removeContentFromStorage(createdAt: string): void {
  try {
    const existing = loadSavedContent();
    const updated = existing.filter((c) => c.createdAt !== createdAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

/* ── TIGA Quick Content Topics ── */

const TIGA_TOPICS = [
  { topic: "ทำไมเด็กอายุ 4-6 ขวบควรเริ่มเรียนเปียโน ไม่ใช่แค่ดนตรี แต่คือการสร้างสมอง", category: "piano-learning", tool: "tiktok-script" },
  { topic: "เปียโน vs กีตาร์: 乐器ไหน更适合เด็กไทยในยุค 2025 ทำไมเปียโนถึงชนะขาด", category: "piano-learning", tool: "hook-writer" },
  { topic: "5 สัญญาณที่บอกว่าลูกคุณพร้อมเรียนเปียโนแล้ว (สัญญาณที่พ่อแม่มักมองข้าม)", category: "piano-learning", tool: "reels-script" },
  { topic: "คอร์สเรียนเปียโน 40 ชั่วโมง เปลี่ยนเด็กไม่มั่นใจ เป็นเด็กกล้าแสดงออกได้อย่างไร", category: "piano-learning", tool: "carousel-writer" },
  { topic: "Trial Lesson ฟรี vs คอร์สทดลอง: แบบไหนได้ผลจริงสำหรับโรงเรียนเปียโน", category: "piano-learning", tool: "caption-writer" },
  { topic: "AI ช่วยสอนเปียโนได้จริงไหม? เปรียบเทียบ วิธีเรียนแบบเดิม vs AI-Powered", category: "innovation", tool: "tiktok-script" },
  { topic: "Piano Mindset: คอร์สวิดีโอออนไลน์ที่เปลี่ยนวิธีเรียนเปียโนของคนไทย", category: "innovation", tool: "hook-writer" },
  { topic: "ทำไม Tiga Studio ใช้ AI Voice Tutor ช่วยสอนลูกค้าได้ตลอด 24 ชม.", category: "innovation", tool: "thread-writer" },
  { topic: "0 to HERO: เรียนเปียโนจากศูนย์ถึงเล่นเพลงได้จริงใน 40 ชั่วโมง", category: "innovation", tool: "reels-script" },
  { topic: "Facebook Ads สำหรับโรงเรียนเปียโน: วิธีเพิ่ม TRIAL Sign-up 3 เท่า ด้วยงบ 500 บาท/วัน", category: "marketing", tool: "hook-writer" },
  { topic: "Content Calendar สำหรับโรงเรียนเปียโน: 14 วัน โพสต์อะไรให้ได้ลูกค้า", category: "marketing", tool: "content-calendar" },
  { topic: "Hashtag Strategy สำหรับ Piano Studio: ติด #อะไรถึงเจอพ่อแม่ที่กำลังหาโรงเรียนเปียโน", category: "marketing", tool: "hashtag-strategy" },
  { topic: "วิธีใช้ TikTok โปรโมทโรงเรียนเปียโน: จาก 0 สู่ 10K Followers ใน 3 เดือน", category: "marketing", tool: "tiktok-script" },
  { topic: "รีวิวจากลูกค้าจริง: เปลี่ยนเป็น Social Proof ยังไงให้ปัง", category: "marketing", tool: "caption-writer" },
  { topic: "อุตสาหกรรมดนตรีไทย 2025: ตัวเลขที่พ่อแม่ทุกคนควรรู้ก่อนส่งลูกเรียนเปียโน", category: "industry", tool: "linkedin-post" },
  { topic: "Piano Industry in Southeast Asia: Why Thailand is becoming the hub of music education", category: "industry", tool: "thread-writer" },
  { topic: "เปรียบเทียบค่าเรียนเปียโน: ไทย vs สิงคโปร์ vs ญี่ปุ่น ทำไมไทยคุ้มกว่า", category: "industry", tool: "carousel-writer" },
  { topic: "ดนตรีบำบัดสำหรับเด็กออทิสติก: งานวิจัยล่าสุดที่พิสูจน์ว่าเปียโนช่วยได้", category: "therapy", tool: "reels-script" },
  { topic: "Music Therapy ไม่ใช่แค่เล่นเปียโน: 5 ประโยชน์ที่พ่อแม่ไม่รู้", category: "therapy", tool: "hook-writer" },
  { topic: "เปียโนบำบัดความเครียด: วิธีที่นักเรียนผู้ใหญ่ลด anxiety ได้จริงจากการเล่น 15 นาที/วัน", category: "therapy", tool: "caption-writer" },
  { topic: "AI แต่งเพลง vs มนุษย์แต่งเพลง: ใครจะชนะในยุค 2025?", category: "tech-music", tool: "tiktok-script" },
  { topic: "MIDI Controller + iPad = ห้องซ้อมส่วนตัว: เครื่องมือที่นักเรียนยุคใหม่ต้องมี", category: "tech-music", tool: "reels-script" },
  { topic: "未来音乐教育: AI + VR จะเปลี่ยนวิธีเรียนเปียโนภายใน 5 ปี", category: "tech-music", tool: "thread-writer" },
  { topic: "เทคโนโลยี AI ใน Tiga Studio: วิธีที่เราใช้ AI ช่วยวิเคราะห์การเล่นของนักเรียน", category: "tech-music", tool: "carousel-writer" },
];

const CATEGORY_LABELS: Record<string, string> = {
  "piano-learning": "🎹 เรียน/สอนเปียโน",
  "innovation": "💡 นวัตกรรม",
  "marketing": "📈 การตลาด",
  "industry": "🏭 อุตสาหกรรมดนตรี",
  "therapy": "🎵 ดนตรีบำบัด",
  "tech-music": "🤖 เทคโนโลยี & AI",
};

/* ── Tool definitions organized by tier ── */

const TIERS: {
  id: TierId;
  name: string;
  icon: typeof Zap;
  color: string;
  description: string;
  tools: {
    id: string;
    name: string;
    icon: typeof Zap;
    description: string;
    placeholder: string;
  }[];
}[] = [
  {
    id: "tier1",
    name: "Writing Formats",
    icon: PenTool,
    color: "text-blue-500",
    description: "สร้างเนื้อหาทุก formats สำหรับทุก platform",
    tools: [
      { id: "hook-writer", name: "Hook Writer", icon: Zap, description: "เขียน Hook 10 แบบ หยุด scroll ทันที", placeholder: "เช่น ทำไมเด็กไทยเก่งกว่าเด็กนอก 3 เท่า..." },
      { id: "caption-writer", name: "Caption Writer", icon: FileText, description: "เขียน Caption 5 แบบ สำหรับทุก platform", placeholder: "เช่น โปรโมชั่นคอร์สเรียนเปียโนใหม่..." },
      { id: "tiktok-script", name: "TikTok Script", icon: Video, description: "สคริปต์ TikTok 25 บรรทัด เต็มรูปแบบ", placeholder: "เช่น เปรียบเทียบการเรียนเปียโน 2 วิธี..." },
      { id: "reels-script", name: "Reels Script", icon: Video, description: "สคริปต์ Instagram Reels 20 บรรทัด", placeholder: "เช่น Behind the scenes ห้องเรียนเปียโน..." },
      { id: "linkedin-post", name: "LinkedIn Post", icon: Users, description: "เขียน LinkedIn Post 3 แบบ ไม่ cringe", placeholder: "เช่น วิสัยทัศน์การศึกษาดนตรีไทย..." },
      { id: "thread-writer", name: "X Thread", icon: MessageSquare, description: "เขียน Thread 8 tweets น่าติดตาม", placeholder: "เช่น 7 เหตุผลที่เด็กควรเรียนเปียโน..." },
      { id: "carousel-writer", name: "Carousel", icon: Share2, description: "สร้าง Carousel 10 slides พร้อม design notes", placeholder: "เช่น 5 ข้อผิดพลาดเมื่อเลือกโรงเรียนเปียโน..." },
    ],
  },
  {
    id: "tier2",
    name: "Strategy & Planning",
    icon: Brain,
    color: "text-purple-500",
    description: "วางแผนกลยุทธ์และจัดการ content อย่างมีระบบ",
    tools: [
      { id: "content-calendar", name: "Content Calendar", icon: Calendar, description: "สร้างปฏิทิน content 14 วัน พร้อม posting schedule", placeholder: "เช่น วางแผน content เดือนหน้าสำหรับ Tiga Studio..." },
      { id: "hashtag-strategy", name: "Hashtag Strategy", icon: Hash, description: "วิเคราะห์ hashtag 3 ระดับ พร้อม strategy", placeholder: "เช่น สร้าง hashtag strategy สำหรับ piano studio..." },
      { id: "repurpose", name: "Cross-Platform Repurpose", icon: Share2, description: "เปลี่ยน 1 content เป็น 7 platform formats", placeholder: "เช่น เปลี่ยนบทความ benefit ของการเล่นเปียโน..." },
    ],
  },
  {
    id: "tier3",
    name: "Brand & Research",
    icon: Target,
    color: "text-green-500",
    description: "สร้างแบรนด์และวิเคราะห์ตลาดเชิงลึก",
    tools: [
      { id: "brand-profile", name: "Brand Profile Builder", icon: Target, description: "สร้าง Brand Profile ครบ 10 หัวข้อ", placeholder: "เช่น สร้าง brand profile สำหรับ Tiga Studio..." },
      { id: "voice-guide", name: "Voice Guide", icon: PenTool, description: "สร้างคู่มือเสียงของแบรนด์ พร้อมตัวอย่าง", placeholder: "เช่น สร้าง voice guide ให้ brand ดูเป็นกันเองแต่เชี่ยวชาญ..." },
      { id: "audience-research", name: "Audience Research", icon: Users, description: "วิเคราะห์กลุ่มเป้าหมายเชิงลึก", placeholder: "เช่น วิเคราะห์พ่อแม่ที่กำลังมองหาโรงเรียนเปียโน..." },
      { id: "dm-script", name: "DM Scripts", icon: MessageSquare, description: "สร้างสคริปต์ DM ขาย 5 สถานการณ์", placeholder: "เช่น สคริปต์ DM สำหรับ follow up ลูกค้าที่มา trial..." },
      { id: "funnel-builder", name: "Funnel Builder", icon: TrendingUp, description: "สร้าง lead generation funnel ครบวงจร", placeholder: "เช่น สร้าง funnel สำหรับทดลองเรียนฟรี..." },
    ],
  },
  {
    id: "tier4",
    name: "Advanced Growth",
    icon: TrendingUp,
    color: "text-orange-500",
    description: "เครื่องมือขั้นสูงสำหรับการเติบโต",
    tools: [
      { id: "story-structure", name: "Story Structure", icon: BookOpen, description: "สร้างโครงเรื่อง 5 แบบ สำหรับ content", placeholder: "เช่น สร้าง story structure สำหรับ success story..." },
      { id: "community-building", name: "Community Building", icon: Users, description: "สร้างแผนสร้าง community ครบชุด", placeholder: "เช่น สร้าง community plan สำหรับ parent group..." },
      { id: "ab-testing", name: "A/B Testing Plan", icon: TestTube, description: "สร้างแผนทดสอบ A/B ทุกด้าน", placeholder: "เช่น สร้าง A/B test plan สำหรับ Facebook ads..." },
      { id: "paid-ads", name: "Paid Ads Copy", icon: DollarSign, description: "สร้างชุด ad copy ทุก platform", placeholder: "เช่น สร้าง Facebook ad copy โปรโมชั่น trial lesson..." },
      { id: "analytics-report", name: "Analytics Report", icon: BarChart3, description: "สร้าง template รายงาน analytics รายสัปดาห์", placeholder: "เช่น สร้าง report template สำหรับ tracking ROI..." },
    ],
  },
  {
    id: "tier5",
    name: "Content Mastery",
    icon: Flame,
    color: "text-red-500",
    description: "เชี่ยวชาญ content ขั้นสุด",
    tools: [
      { id: "content-pillars", name: "Content Pillars", icon: Compass, description: "สร้าง content pillars 5 หมวด พร้อม 50 content ideas", placeholder: "เช่น สร้าง content pillar สำหรับ music education brand..." },
      { id: "trend-jacking", name: "Trend Jacking", icon: TrendingUp, description: "คัมภีร์จับกระแส + 10 ตัวอย่างพร้อมใช้", placeholder: "เช่น วิธี adapt เทรนด์ TikTok ล่าสุด..." },
      { id: "engagement-routine", name: "Engagement Routine", icon: Send, description: "สร้างกิจวัตร engagement รายวัน/รายสัปดาห์", placeholder: "เช่น สร้าง daily engagement routine 15 นาที..." },
      { id: "social-seo", name: "Social SEO", icon: Search, description: "คัมภีร์ SEO สำหรับทุก platform + 20 keywords", placeholder: "เช่น สร้าง SEO strategy สำหรับ TikTok piano content..." },
    ],
  },
];

const LANGUAGES = [
  { id: "th", label: "🇹🇭 ไทย", flag: "🇹🇭" },
  { id: "en", label: "🇬🇧 English", flag: "🇬🇧" },
  { id: "zh", label: "🇨🇳 中文", flag: "🇨🇳" },
];

/* ── Copy Button ── */

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

/* ── Tool name lookup ── */

function getToolName(toolId: string): string {
  for (const tier of TIERS) {
    const found = tier.tools.find((t) => t.id === toolId);
    if (found) return found.name;
  }
  return toolId;
}

function getModelLabel(modelId: string): string {
  return CHAT_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}

/* ── Main Component ── */

export function MarketingSkillTools() {
  const [activeTier, setActiveTier] = useState<TierId>("tier1");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("th");
  const [model, setModel] = useState("gemini");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SkillResult | null>(null);
  const [quickGenerating, setQuickGenerating] = useState(false);
  const [quickResult, setQuickResult] = useState<SkillResult | null>(null);
  const lastQuickCategory = useRef<string | null>(null);
  const [quickModel, setQuickModel] = useState("gemini");
  const [quickLanguage, setQuickLanguage] = useState("th");

  // Persistent saved content
  const [savedContent, setSavedContent] = useState<SkillResult[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  // Load saved content on mount
  useEffect(() => {
    setSavedContent(loadSavedContent());
  }, []);

  const currentTier = TIERS.find((t) => t.id === activeTier)!;
  const currentTool = currentTier.tools.find((t) => t.id === activeTool);

  const saveAndTrack = useCallback((item: SkillResult) => {
    saveContentToStorage(item);
    setSavedContent(loadSavedContent());
  }, []);

  const deleteContent = useCallback((createdAt: string) => {
    removeContentFromStorage(createdAt);
    setSavedContent(loadSavedContent());
  }, []);

  const generateContent = useCallback(async (toolType: string, topicText: string, lang: string, modelId: string) => {
    const supabase = createClient();
    const { data, error: fnError } = await supabase.functions.invoke<
      { result: SkillResult; error?: string }
    >("generate-marketing-skill", {
      body: { toolType, topic: topicText, language: lang, model: modelId },
    });

    if (fnError) throw new Error(fnError.message || "Generation failed");
    if (!data?.result) throw new Error(data?.error || "No result returned");
    return data.result;
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!activeTool || !topic.trim()) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await generateContent(activeTool, topic.trim(), language, model);
      setResult(res);
      saveAndTrack(res);
    } catch (err) {
      console.error("Generation error:", err);
      setResult(null);
    } finally {
      setGenerating(false);
    }
  }, [activeTool, topic, language, model, generateContent, saveAndTrack]);

  /* ── Quick Content: pick topic + tool + generate ── */
  const handleQuickContent = useCallback(async () => {
    setQuickGenerating(true);
    setQuickResult(null);
    try {
      let candidates = TIGA_TOPICS;
      if (lastQuickCategory.current) {
        const different = TIGA_TOPICS.filter((t) => t.category !== lastQuickCategory.current);
        if (different.length > 0) candidates = different;
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
      lastQuickCategory.current = pick.category;

      const res = await generateContent(pick.tool, pick.topic, quickLanguage, quickModel);
      setQuickResult(res);
      saveAndTrack(res);
    } catch (err) {
      console.error("Quick content error:", err);
      setQuickResult(null);
    } finally {
      setQuickGenerating(false);
    }
  }, [generateContent, quickModel, quickLanguage, saveAndTrack]);

  return (
    <div className="space-y-4">
      {/* ── Quick Content Banner ── */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-secondary">⚡ Quick Content</span>
              </div>
              <p className="text-xs text-secondary/50">
                กดทีเดียว AI เลือกหัวข้อ + skill ที่เหมาะสมกับ TIGA Studio ให้อัตโนมัติ
              </p>
            </div>
            <Button
              onClick={handleQuickContent}
              disabled={quickGenerating}
              size="lg"
              className="shrink-0 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-lg"
            >
              {quickGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  กำลังสร้าง...
                </>
              ) : (
                <>
                  <Shuffle className="h-4 w-4 mr-2" />
                  ⚡ Quick Content
                </>
              )}
            </Button>
          </div>

          {/* Quick Settings Row: Model + Language */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-secondary/50 mb-0.5 block">AI Model</label>
              <select
                value={quickModel}
                onChange={(e) => setQuickModel(e.target.value)}
                className="w-full rounded-lg border border-line/20 bg-background px-2 py-1.5 text-xs text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CHAT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-secondary/50 mb-0.5 block">ภาษา</label>
              <div className="flex gap-1">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => setQuickLanguage(lang.id)}
                    className={cn(
                      "flex-1 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-all",
                      quickLanguage === lang.id
                        ? "bg-primary text-white"
                        : "bg-line/10 text-secondary/60 hover:bg-line/20"
                    )}
                  >
                    {lang.flag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Result */}
          {quickResult && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30">
                  🔧 {getToolName(quickResult.toolType)}
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-blue-500/10 border-blue-500/30">
                  🤖 {getModelLabel(quickResult.model)}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {CATEGORY_LABELS[TIGA_TOPICS.find((t) => t.topic === quickResult.topic)?.category ?? ""] || "🎯 TIGA Content"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{quickResult.language}</Badge>
              </div>

              <div className="rounded-xl bg-background/80 p-4 max-h-[50vh] overflow-y-auto border border-line/10">
                <pre className="whitespace-pre-wrap text-sm text-secondary/80 font-sans leading-relaxed">
                  {quickResult.content}
                </pre>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {quickResult.tags.slice(0, 5).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">#{tag}</Badge>
                  ))}
                </div>
                <CopyButton value={quickResult.content} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Saved Content Toggle ── */}
      {savedContent.length > 0 && (
        <button
          onClick={() => setShowSaved(!showSaved)}
          className="flex items-center gap-2 w-full rounded-xl border border-line/10 bg-card p-3 text-left hover:bg-line/5 transition-colors"
        >
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-secondary">
            📚 คอนเทนต์ที่บันทึกไว้ ({savedContent.length})
          </span>
          {showSaved ? <ChevronDown className="h-4 w-4 ml-auto text-secondary/40" /> : <ChevronRight className="h-4 w-4 ml-auto text-secondary/40" />}
        </button>
      )}

      {/* ── Saved Content List ── */}
      {showSaved && savedContent.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
            {savedContent.map((item, idx) => (
              <div
                key={item.createdAt + idx}
                className="rounded-xl border border-line/10 bg-background p-3 hover:bg-line/5 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <Badge variant="outline" className="text-[9px] bg-primary/10 border-primary/30">
                        🔧 {getToolName(item.toolType)}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] bg-blue-500/10 border-blue-500/30">
                        🤖 {getModelLabel(item.model)}
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">{item.language}</Badge>
                    </div>
                    <p className="text-xs font-medium text-secondary truncate">{item.topic}</p>
                    <p className="text-[10px] text-secondary/40 mt-0.5 line-clamp-2">{item.summary || item.content.slice(0, 120)}...</p>
                    <p className="text-[9px] text-secondary/30 mt-1">
                      {new Date(item.createdAt).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton value={item.content} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => deleteContent(item.createdAt)}
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                </div>
                {/* Expand full content on click */}
                <details className="mt-2">
                  <summary className="text-[10px] text-primary cursor-pointer hover:underline">ดูเนื้อหาเต็ม</summary>
                  <pre className="whitespace-pre-wrap text-xs text-secondary/70 font-sans mt-2 bg-line/5 rounded-lg p-2 max-h-[40vh] overflow-y-auto">
                    {item.content}
                  </pre>
                </details>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tier Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {TIERS.map((tier) => (
          <button
            key={tier.id}
            onClick={() => { setActiveTier(tier.id); setActiveTool(null); setResult(null); }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all",
              activeTier === tier.id
                ? "bg-primary text-white shadow-md"
                : "bg-line/10 text-secondary/70 hover:bg-line/20"
            )}
          >
            <tier.icon className="h-4 w-4" />
            {tier.name}
          </button>
        ))}
      </div>

      {/* Tier Description */}
      <div className="text-xs text-secondary/50">{currentTier.description}</div>

      {/* Tool Selection Grid */}
      {!activeTool ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {currentTier.tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className="rounded-xl border border-line/10 bg-card p-4 text-left hover:bg-line/5 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <tool.icon className={cn("h-5 w-5", currentTier.color)} />
                <span className="text-sm font-medium text-secondary group-hover:text-primary transition-colors">{tool.name}</span>
              </div>
              <p className="text-xs text-secondary/50">{tool.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Back + Tool Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setActiveTool(null); setResult(null); }}>
              ← กลับ
            </Button>
            {currentTool && (
              <div className="flex items-center gap-2">
                <currentTool.icon className={cn("h-5 w-5", currentTier.color)} />
                <span className="font-medium text-secondary">{currentTool.name}</span>
              </div>
            )}
          </div>

          {/* Input Form */}
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Topic Input */}
              <div>
                <label className="text-xs font-medium text-secondary/70 mb-1 block">หัวข้อ / Topic</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={currentTool?.placeholder || "พิมพ์หัวข้อที่ต้องการ..."}
                  className="w-full rounded-xl border border-line/20 bg-background px-3 py-2.5 text-sm text-secondary placeholder:text-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  rows={2}
                />
              </div>

              {/* Language + Model Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-secondary/70 mb-1 block">ภาษา</label>
                  <div className="flex gap-1">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setLanguage(lang.id)}
                        className={cn(
                          "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all",
                          language === lang.id
                            ? "bg-primary text-white"
                            : "bg-line/10 text-secondary/60 hover:bg-line/20"
                        )}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-secondary/70 mb-1 block">AI Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-line/20 bg-background px-2 py-1.5 text-xs text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {CHAT_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generating || !topic.trim()}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    กำลังสร้าง...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    สร้าง Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result Display */}
          {result && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {result.title}
                    </CardTitle>
                    <CardDescription className="mt-1">{result.summary}</CardDescription>
                  </div>
                  <CopyButton value={result.content} />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30">
                    🔧 ใช้สกิล: {getToolName(result.toolType)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 border-blue-500/30">
                    🤖 {getModelLabel(result.model)}
                  </Badge>
                  {result.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">#{tag}</Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl bg-line/5 p-4 max-h-[60vh] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-secondary/80 font-sans leading-relaxed">
                    {result.content}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
