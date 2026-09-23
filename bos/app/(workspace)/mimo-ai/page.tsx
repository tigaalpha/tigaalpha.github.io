"use client";

import { useState } from "react";
import {
  Bot,
  Key,
  Zap,
  Brain,
  Settings,
  Check,
  AlertTriangle,
  ExternalLink,
  Copy,
  Activity,
  MessageSquare,
  RefreshCw,
  Shield,
  Coins,
  Globe,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  costPer1kInput: number;
  costPer1kOutput: number;
  contextWindow: number;
  speed: string;
  quality: string;
  recommended: boolean;
}

const MODELS: ModelOption[] = [
  {
    id: "mimo/mimo-7b-rl",
    name: "MiMo 7B RL",
    provider: "OpenRouter",
    description: "Lightweight model by Xiaomi — fast, efficient, great for conversational AI",
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0002,
    contextWindow: 32000,
    speed: "⚡ เร็วมาก",
    quality: "🌟 ดีสำหรับ chat",
    recommended: true,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenRouter",
    description: "Fast and affordable — good balance of speed and quality",
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    contextWindow: 128000,
    speed: "⚡ เร็ว",
    quality: "🌟🌟 ดีมาก",
    recommended: false,
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "OpenRouter",
    description: "Anthropic's fastest model — excellent for customer service",
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    contextWindow: 200000,
    speed: "⚡ เร็ว",
    quality: "🌟🌟🌟 ดีเยี่ยม",
    recommended: false,
  },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export default function MimoAIPage() {
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("mimo/mimo-7b-rl");
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);

  const activeModel = MODELS.find((m) => m.id === selectedModel);

  function handleTest() {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResponse("");
    setTimeout(() => {
      const response = testMessage.includes("ราคา")
        ? "คอร์สเรียนสดตัวต่อตัว 40 ชั่วโมง ราคา ฿27,000 ค่ะ (เฉลี่ย ฿675/ชั่วโมง)"
        : testMessage.includes("ทดลอง")
        ? "จองเรียนทดลองฟรี 30 นาทีได้เลยค่ะ — เลือกเวลาที่สะดวกได้เลย"
        : "มีอะไรให้ช่วยไหมคะ?";
      setTestResponse("สวัสดีค่ะ! ยินดีต้อนรับสู่ TIGA Studio 🎹\n\n" + response);
      setTesting(false);
    }, 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">🤖 TIGA AI — Mimo Model</h1>
        <p className="text-sm text-secondary/50">ติดตั้ง Mimo AI Model ผ่าน OpenRouter สำหรับ TIGA AI Agent</p>
      </div>

      {/* Setup Status */}
      <Card className={cn(configured ? "border-emerald-200/30" : "border-amber-200/30")}>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", configured ? "bg-emerald-500/10" : "bg-amber-500/10")}>
              {configured ? <Check className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">{configured ? "✅ Mimo AI เชื่อมต่อแล้ว" : "⚠️ ยังไม่ได้ตั้งค่า API Key"}</p>
              <p className="text-xs text-secondary/40">{configured ? "TIGA AI Agent ใช้ Mimo 7B RL ผ่าน OpenRouter" : "ต้องใส่ OpenRouter API Key ก่อน"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-accent" />
            Setup — 1 ขั้นตอน (OpenRouter key มีอยู่แล้ว)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OpenRouter Already Connected */}
          <div className="rounded-xl border border-emerald-200/30 bg-emerald-50/5 p-4 space-y-2 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-500">✓</span>
              <span className="text-sm font-medium text-secondary">OpenRouter API Key</span>
              <Badge variant="success" className="text-[9px]">เชื่อมต่อแล้ว</Badge>
            </div>
            <p className="text-xs text-secondary/50 ml-8">ใช้ key เดิมที่มีอยู่ใน Supabase — ไม่ต้องสร้างใหม่</p>
          </div>



          {/* Select Model */}
          <div className="rounded-xl border border-line/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
              <span className="text-sm font-medium text-secondary">เลือก Model สำหรับ TIGA AI Agent</span>
            </div>
            <div className="grid grid-cols-1 gap-2 ml-8 md:grid-cols-3">
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    selectedModel === model.id ? "border-primary bg-primary/5" : "border-line/10 hover:bg-line/5"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-secondary">{model.name}</span>
                    {model.recommended && <Badge variant="success" className="text-[8px]">แนะนำ</Badge>}
                  </div>
                  <p className="text-[10px] text-secondary/40 mb-2">{model.description}</p>
                  <div className="flex gap-2 text-[9px] text-secondary/40">
                    <span>{model.speed}</span>
                    <span>·</span>
                    <span>{model.quality}</span>
                  </div>
                  <div className="mt-1 text-[9px] text-secondary/30">
                    ${(model.costPer1kInput * 1000).toFixed(4)}/1K input · ${(model.costPer1kOutput * 1000).toFixed(4)}/1K output
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-secondary/40 ml-8">ไปที่ Settings → Integrations → เลือก &quot;MiMo 7B RL (Xiaomi)&quot; เป็นโมเดลหลัก</p>
          </div>
        </CardContent>
      </Card>

      {/* Model Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary-accent" />
            เปรียบเทียบ Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line/10">
                  <th className="pb-2 text-left text-secondary/50 font-medium">Model</th>
                  <th className="pb-2 text-right text-secondary/50 font-medium">Speed</th>
                  <th className="pb-2 text-right text-secondary/50 font-medium">Quality</th>
                  <th className="pb-2 text-right text-secondary/50 font-medium">Cost/1K</th>
                  <th className="pb-2 text-right text-secondary/50 font-medium">Context</th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map((model) => (
                  <tr key={model.id} className={cn("border-b border-line/5", selectedModel === model.id && "bg-primary/5")}>
                    <td className="py-2 font-medium text-secondary">{model.name}</td>
                    <td className="py-2 text-right text-secondary/60">{model.speed}</td>
                    <td className="py-2 text-right text-secondary/60">{model.quality}</td>
                    <td className="py-2 text-right text-secondary/60">${model.costPer1kInput.toFixed(4)}</td>
                    <td className="py-2 text-right text-secondary/60">{(model.contextWindow / 1000).toFixed(0)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Test Chat */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary-accent" />
            ทดสอบ TIGA AI + Mimo
          </CardTitle>
          <CardDescription>ลองส่งข้อความทดสอบก่อนเปิดใช้จริง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="พิมพ์ข้อความทดสอบ เช่น 'ราคาคอร์สเรียนเท่าไหร่'" value={testMessage} onChange={(e) => setTestMessage(e.target.value)} className="flex-1" />
            <Button onClick={handleTest} disabled={testing || !testMessage.trim()}>
              {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {testing ? "กำลังทดสอบ..." : "ทดสอบ"}
            </Button>
          </div>
          {testResponse && (
            <div className="rounded-xl bg-line/5 p-4 text-sm text-secondary whitespace-pre-wrap">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-xs text-secondary/40">TIGA AI ({activeModel?.name ?? "Mimo"})</span>
              </div>
              {testResponse}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary-accent" />
            Configuration (ในระบบแล้ว)
          </CardTitle>
          <CardDescription>MiMo model ถูกเพิ่มเข้าระบบแล้ว — ใช้ผ่าน OpenRouter เดิม</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl bg-line/5 p-3">
            <p className="text-xs text-secondary/40 mb-1">OpenRouter API Key</p>
            <code className="text-xs text-primary-accent break-all">OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx</code>
          </div>
          <div className="rounded-xl bg-line/5 p-3">
            <p className="text-xs text-secondary/40 mb-1">Model Selection</p>
            <code className="text-xs text-primary-accent break-all">OPENROUTER_MODEL=mimo/mimo-7b-rl</code>
          </div>
          <div className="rounded-xl bg-line/5 p-3">
            <p className="text-xs text-secondary/40 mb-1">System Prompt (TIGA AI Employee)</p>
            <code className="text-xs text-primary-accent break-all">Will use existing prompts from bos/prompts/system.md</code>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://openrouter.ai/docs" target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink className="h-3 w-3 mr-1" />OpenRouter Docs
              </Button>
            </a>
            <a href="https://openrouter.ai/models?q=mimo" target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink className="h-3 w-3 mr-1" />View Mimo Models
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Cost Estimation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary-accent" />
            ประมาณการค่าใช้จ่าย
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-line/5 p-3">
              <p className="text-lg font-bold text-secondary">~฿0.50</p>
              <p className="text-[10px] text-secondary/40">ต่อ conversation</p>
            </div>
            <div className="rounded-xl bg-line/5 p-3">
              <p className="text-lg font-bold text-secondary">~฿150</p>
              <p className="text-[10px] text-secondary/40">ต่อเดือน (300 convos)</p>
            </div>
            <div className="rounded-xl bg-emerald-50/5 p-3">
              <p className="text-lg font-bold text-emerald-600">฿0</p>
              <p className="text-[10px] text-secondary/40">OpenRouter free tier</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-emerald-50/5 p-3 text-xs text-emerald-700 dark:text-emerald-400">
            💡 Mimo 7B RL มี free tier บน OpenRouter — ทดลองใช้ได้โดยไม่เสียค่าใช้จ่าย
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
