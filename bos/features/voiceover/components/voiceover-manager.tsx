"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Volume2,
  Play,
  Pause,
  Square,
  Copy,
  Trash2,
  Check,
  Loader2,
  Mic,
  User,
  Users,
  Download,
  VolumeX,
} from "lucide-react";
/* User, Users are used above for potential future use */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { CHAT_MODELS } from "@/lib/chat-models";

/* ── Voice definitions ── */

interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  gender: "male" | "female";
  rate: number;
  pitch: number;
}

const FALLBACK_VOICES: VoiceOption[] = [
  // Thai (male only)
  { id: "th-male-1", name: "ชาย 1 (Somchai)", lang: "th-TH", gender: "male", rate: 0.9, pitch: 0.9 },
  { id: "th-male-2", name: "ชาย 2 (Somsak)", lang: "th-TH", gender: "male", rate: 1.0, pitch: 1.0 },
  { id: "th-male-3", name: "ชาย 3 (Nattawut)", lang: "th-TH", gender: "male", rate: 0.95, pitch: 0.85 },
  // English (male only)
  { id: "en-male-1", name: "Male 1 (David)", lang: "en-US", gender: "male", rate: 0.9, pitch: 0.85 },
  { id: "en-male-2", name: "Male 2 (Mark)", lang: "en-US", gender: "male", rate: 1.0, pitch: 0.9 },
  { id: "en-male-3", name: "Male 3 (Jason)", lang: "en-US", gender: "male", rate: 0.95, pitch: 0.88 },
  // Chinese (male only)
  { id: "zh-male-1", name: "男声 1 (Yunxi)", lang: "zh-CN", gender: "male", rate: 0.9, pitch: 0.9 },
  { id: "zh-male-2", name: "男声 2 (Yunjian)", lang: "zh-CN", gender: "male", rate: 1.0, pitch: 0.88 },
];

/* ── DB history type ── */

interface VoiceOverItem {
  id: string;
  text: string;
  title: string;
  voice_name: string;
  voice_lang: string;
  ai_model: string;
  created_at: string;
}

/* ── Main Component ── */

export function VoiceOverManager() {
  const [text, setText] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState("th-male-1");
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [filterGender] = useState<"all" | "male" | "female">("male");
  const [filterLang, setFilterLang] = useState<string>("all");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [history, setHistory] = useState<VoiceOverItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const supabase = createClient();

  // Preview samples per language
  const PREVIEW_TEXT: Record<string, string> = {
    th: "สวัสดีครับ ยินดีที่ได้รู้จัก",
    en: "Hello, nice to meet you!",
    zh: "你好，很高兴认识你！",
    ja: "こんにちは、はじめまして",
    ko: "안녕하세요, 반갑습니다",
    hi: "नमस्ते, आपसे मिलकर खुशी हुई",
    id: "Halo, senang berkenalan dengan Anda!",
    ms: "Halo, senang berkenalan dengan anda!",
    de: "Hallo, freut mich!",
    fr: "Bonjour, enchanté !",
    es: "¡Hola, mucho gusto!",
    pt: "Olá, prazer em conhecê-lo!",
    it: "Ciao, piacere di conoscerti!",
    ru: "Здравствуйте, приятно познакомиться!",
    ar: "مرحباً، سعيد بلقائك!",
    tr: "Merhaba, tanıştığımıza memnun oldum!",
    vi: "Xin chào, rất vui được gặp bạn!",
    default: "Hello, nice to meet you!",
  };

  // Preview voice: play a short sample
  const handlePreviewVoice = useCallback((voice: VoiceOption) => {
    window.speechSynthesis?.cancel();
    setPreviewingId(voice.id);

    const langCode = voice.lang.split("-")[0] ?? "en";
    const sampleText = PREVIEW_TEXT[langCode] ?? PREVIEW_TEXT.default;

    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.lang = voice.lang;
    utterance.rate = voice.rate;
    utterance.pitch = voice.pitch;
    utterance.volume = 1.0;

    // Try to match actual browser voice
    const browserVoices = window.speechSynthesis?.getVoices() ?? [];
    const match = browserVoices.find((bv) => bv.voiceURI === voice.id || bv.name === voice.name);
    if (match) utterance.voice = match;

    utterance.onend = () => setPreviewingId(null);
    utterance.onerror = () => setPreviewingId(null);

    window.speechSynthesis?.speak(utterance);
  }, []);

  // Load history from Supabase
  const loadHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("voiceover_history" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data && !error) setHistory((data as unknown as VoiceOverItem[]) ?? []);
    } catch {
      // Table may not exist yet — fall back to empty
    }
  }, [supabase]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Get browser voices
  const getBrowserVoices = useCallback((): VoiceOption[] => {
    if (typeof window === "undefined" || !window.speechSynthesis) return FALLBACK_VOICES;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return FALLBACK_VOICES;

    const result: VoiceOption[] = [];
    for (const v of voices) {
      const isMale = /male|david|mark|somsak|somchai|yunxi|yunjian|男性|nattawut/i.test(v.name);
      if (!isMale) continue; // male voices only
      const ALLOWED_PREFIXES = ["th", "en", "zh"];
      if (!ALLOWED_PREFIXES.some((p) => v.lang.startsWith(p))) continue; // Thai/Eng/Chinese only
      result.push({
        id: v.voiceURI,
        name: `${v.lang.startsWith("th") ? "🇹🇭" : v.lang.startsWith("zh") ? "🇨🇳" : "🇺🇸"} ${v.name}`,
        lang: v.lang,
        gender: "male",
        rate: 1.0,
        pitch: 0.9,
      });
    }
    return result.length > 0 ? result : FALLBACK_VOICES;
  }, []);

  const allVoices = getBrowserVoices();
  const filteredVoices = allVoices.filter((v) => {
    if (filterGender !== "all" && v.gender !== filterGender) return false;
    if (filterLang !== "all" && !v.lang.startsWith(filterLang)) return false;
    return true;
  });
  const availableLangs = ["th", "en", "zh"];

  // Play with Web Speech API
  const handlePlay = useCallback((playText: string, voiceId?: string) => {
    if (!playText.trim()) return;
    window.speechSynthesis?.cancel();

    const voice = allVoices.find((v) => v.id === (voiceId || selectedVoiceId)) ?? allVoices[0];
    if (!voice) return;
    if (!voice) return;

    const utterance = new SpeechSynthesisUtterance(playText);
    utterance.lang = voice.lang;
    utterance.rate = voice.rate;
    utterance.pitch = voice.pitch;

    const browserVoices = window.speechSynthesis?.getVoices() ?? [];
    const match = browserVoices.find((bv) => bv.voiceURI === voice.id || bv.name === voice.name);
    if (match) utterance.voice = match;
    // suppress unused warning
    void voice;

    utterance.onstart = () => { setIsPlaying(true); setPlayingId(voiceId || "current"); };
    utterance.onend = () => { setIsPlaying(false); setPlayingId(null); };
    utterance.onerror = () => { setIsPlaying(false); setPlayingId(null); };

    window.speechSynthesis?.speak(utterance);
  }, [allVoices, selectedVoiceId]);

  const handleStop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
    setPlayingId(null);
  }, []);

  // Generate voice over — save to Supabase
  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    const voiceOpt = allVoices.find((v) => v.id === selectedVoiceId) ?? allVoices[0];
    const voiceName = voiceOpt?.name ?? "Unknown";
    const voiceLang = voiceOpt?.lang ?? "th-TH";

    // Generate title from first line
    const title = (text.trim().split("\n")[0] ?? "Voice Over").slice(0, 80);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("voiceover_history" as any)
        .insert({
          user_id: user?.id ?? "",
          text: text.trim(),
          title,
          voice_name: voiceName,
          voice_lang: voiceLang,
          ai_model: selectedModel,
        });
      if (!error) await loadHistory();
    } catch {
      // Table may not exist
    }

    // Play the audio
    handlePlay(text, selectedVoiceId);
    setLoading(false);
  }, [text, selectedVoiceId, selectedModel, allVoices, supabase, loadHistory, handlePlay]);

  // Delete from history
  const handleDelete = useCallback(async (id: string) => {
    try {
      await supabase.from("voiceover_history" as any).delete().eq("id", id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch {
      setHistory((prev) => prev.filter((h) => h.id !== id));
    }
  }, [supabase]);

  // Copy text
  const handleCopy = useCallback((txt: string, id: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-4">
      {/* ── Paste & Generate Card ── */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            แปลงบทความเป็นเสียง
          </CardTitle>
          <CardDescription>
            วางบทความจากหน้าอื่น → เลือกเสียง → กดฟังได้ทันที
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Text Paste Area */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-secondary/70">วางบทความ / Paste Article</label>
              <div className="flex items-center gap-2 text-[10px] text-secondary/40">
                <span>{charCount} ตัวอักษร</span>
                <span>·</span>
                <span>{wordCount} คำ</span>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"วางบทความที่ต้องการเปลี่ยนเป็นเสียงที่นี่...\n\nสามารถคัดลอกบทความจากหน้าอื่นมาวางได้เลย\nเช่น บทความจาก Video Articles, Marketing Skills, หรือ Post"}
              className="w-full rounded-xl border border-line/20 bg-background px-4 py-3 text-sm text-secondary placeholder:text-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none min-h-[160px]"
              rows={7}
            />
          </div>

          {/* Voice Selection */}
          <div>
            <label className="text-xs font-medium text-secondary/70 mb-2 block">เลือกเสียง</label>

            {/* Language Filter */}
            <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setFilterLang("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[10px] font-medium whitespace-nowrap transition-all",
                  filterLang === "all"
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-line/10 text-secondary/50 hover:bg-line/20"
                )}
              >
                ทุกภาษา
              </button>    { availableLangs.map((langCode) => (
                <button
                  key={langCode}
                  onClick={() => setFilterLang(langCode)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[10px] font-medium whitespace-nowrap transition-all",
                    filterLang === langCode
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-line/10 text-secondary/50 hover:bg-line/20"
                  )}
                >
                  {langCode === "th" ? "🇹🇭 ภาษาไทย" : langCode === "en" ? "🇺🇸 English" : langCode === "zh" ? "🇨🇳 จีนกลาง" : langCode}
                </button>
              ))}
            </div>

            {/* Voice Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[180px] overflow-y-auto pr-1">
              {filteredVoices.map((voice) => (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => setSelectedVoiceId(voice.id)}
                  className={cn(
                    "rounded-xl border p-2.5 text-left transition-all group relative",
                    selectedVoiceId === voice.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-line/10 bg-background hover:border-primary/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded inline-block mb-0.5",
                      voice.gender === "male" ? "bg-blue-500/10 text-blue-600" : "bg-pink-500/10 text-pink-600"
                    )}>
                      {voice.gender === "male" ? "♂ ชาย" : "♀ หญิง"}
                    </span>
                    {/* Preview button — click to hear a sample */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlePreviewVoice(voice); }}
                      className="shrink-0 rounded-full p-1 hover:bg-primary/10 transition-colors"
                      title="ฟังเสียงตัวอย่าง"
                    >
                      {previewingId === voice.id ? (
                        <VolumeX className="h-3 w-3 text-primary animate-pulse" />
                      ) : (
                        <Volume2 className="h-3 w-3 text-secondary/40 group-hover:text-primary" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-medium text-secondary truncate">{voice.name}</p>
                  <p className="text-[10px] text-secondary/40">{voice.lang}</p>
                </button>
              ))}
            </div>
          </div>

          {/* AI Model Selection */}
          <div>
            <label className="text-xs font-medium text-secondary/70 mb-1 block">AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-xl border border-line/20 bg-background px-3 py-2 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {CHAT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <div className="flex gap-2">
            <Button
              onClick={isPlaying ? handleStop : handleGenerate}
              disabled={!text.trim() || loading}
              className={cn(
                "flex-1",
                isPlaying
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              )}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังสร้าง...</>
              ) : isPlaying ? (
                <><Square className="h-4 w-4 mr-2" /> หยุด</>
              ) : (
                <><Play className="h-4 w-4 mr-2" /> สร้างและฟังเสียง</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── History ── */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              ประวัติ Voice Over ({history.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-line/10 bg-background p-3 hover:bg-line/5 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">🔊 {item.voice_name}</Badge>
                      <Badge variant="outline" className="text-[9px]">🤖 {item.ai_model}</Badge>
                    </div>
                    <p className="text-xs font-medium text-secondary mb-0.5 truncate">{item.title}</p>
                    <p className="text-[10px] text-secondary/50 line-clamp-1">{item.text.slice(0, 100)}...</p>
                    <p className="text-[10px] text-secondary/30 mt-1">
                      {new Date(item.created_at).toLocaleString("th-TH", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopy(item.text, item.id)}
                    >
                      {copiedId === item.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => playingId === item.id ? handleStop() : handlePlay(item.text, item.voice_lang)}
                    >
                      {playingId === item.id ? <Square className="h-3 w-3 text-red-500" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-600"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
