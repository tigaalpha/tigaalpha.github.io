"use client";
import { Suspense, useState } from "react";
import { TrendingUp, Users, Clapperboard, Smartphone, ArrowRight, Phone, Mail, MessageSquare, ExternalLink, Copy, BarChart3, Link as LinkIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const LEAD_TYPES = [
  {
    id: "private",
    icon: Users,
    name: "คอร์สเรียนสด Private ตัวต่อตัว",
    nameEn: "Private Live Course (1-on-1)",
    price: "฿27,000",
    priceNote: "ต่อคอร์ส",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    description: "เรียนสดตัวต่อตัวกับครูมืออาชีพ ปรับตารางเรียนตามสะดวก Feedback แบบ Real-time",
    features: ["1-on-1 Live", "Flexible Schedule", "Real-time Feedback", "Premium"],
    stats: { total: 0, new: 0, contacted: 0, converted: 0 },
  },
  {
    id: "video",
    icon: Clapperboard,
    name: "คอร์สวิดีโอ",
    nameEn: "Video Course",
    price: "฿990 – ฿1,490",
    priceNote: "ต่อคอร์ส",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    description: "เรียนได้ทุกที่ ทุกเวลา ดูซ้ำได้ไม่จำกัด มี 2 ระดับ: พื้นฐานและขั้นสูง",
    features: ["Self-paced", "Unlimited Replay", "2 Levels", "Affordable"],
    stats: { total: 0, new: 0, contacted: 0, converted: 0 },
  },
  {
    id: "tiga-ai",
    icon: Smartphone,
    name: "TIGA AI",
    nameEn: "TIGA AI App (Free)",
    price: "ฟรี",
    priceNote: "เปิดให้ใช้ฟรีในตอนนี้",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    description: "AI ครูสอนเปียโนส่วนตัว ช่องทางหลักในการสร้าง Lead ใหม่ พร้อมใช้งานทันทีบนมือถือ",
    features: ["AI Tutor", "Free", "Mobile-first", "Lead Generator"],
    stats: { total: 0, new: 0, contacted: 0, converted: 0 },
  },
];

const LEAD_SOURCES = [
  { id: "line_oa", name: "LINE OA", icon: "💬", color: "bg-green-500", leads: 0, description: "QR Code, ป้ายร้าน, ใบปลิว" },
  { id: "facebook", name: "Facebook", icon: "📘", color: "bg-blue-600", leads: 0, description: "Facebook Page, Facebook Ads" },
  { id: "tiktok", name: "TikTok", icon: "🎵", color: "bg-black", leads: 0, description: "TikTok Bio Link, TikTok Ads" },
  { id: "instagram", name: "Instagram", icon: "📸", color: "bg-gradient-to-r from-purple-500 to-pink-500", leads: 0, description: "Instagram Bio Link" },
  { id: "google", name: "Google", icon: "🔍", color: "bg-red-500", leads: 0, description: "Google Search, Google Ads" },
  { id: "landing_page", name: "Landing Page", icon: "🌐", color: "bg-indigo-500", leads: 0, description: "ฟอร์มจองเรียนทดลองฟรี" },
  { id: "referral", name: "Referral", icon: "🎁", color: "bg-yellow-500", leads: 0, description: "แนะนำเพื่อน" },
  { id: "quiz", name: "Quiz", icon: "🎵", color: "bg-pink-500", leads: 0, description: "ทดสอบระดับเปียโน" },
];

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <Card className="p-4 text-center">
      <Icon className="h-5 w-5 mx-auto mb-2 text-primary" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

function LeadSourceCard({ source }: { source: typeof LEAD_SOURCES[0] }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
      <div className={`w-10 h-10 ${source.color} rounded-full flex items-center justify-center text-white text-lg`}>
        {source.icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{source.name}</div>
        <div className="text-xs text-muted-foreground">{source.description}</div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold">{source.leads}</div>
        <div className="text-xs text-muted-foreground">leads</div>
      </div>
    </div>
  );
}

function UTMBuilder() {
  const [baseUrl, setBaseUrl] = useState("https://tigaalpha.github.io/studio/lead-sale");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (source) params.set("utm_source", source);
    if (medium) params.set("utm_medium", medium);
    if (campaign) params.set("utm_campaign", campaign);
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6 border-indigo-500/20">
      <h3 className="text-lg font-bold mb-4">🔗 UTM Builder</h3>
      <p className="text-sm text-muted-foreground mb-4">สร้าง Link ที่ track แหล่งที่มาของ lead ได้</p>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Base URL</label>
          <input 
            type="text" 
            value={baseUrl} 
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg text-sm"
            placeholder="https://tigaalpha.github.io/studio/lead-sale"
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Source (แหล่งที่มา)</label>
            <select 
              value={source} 
              onChange={(e) => setSource(e.target.value)}
              className="w-full mt-1 p-2 border rounded-lg text-sm"
            >
              <option value="">เลือก...</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="line_oa">LINE OA</option>
              <option value="google">Google</option>
              <option value="referral">Referral</option>
              <option value="quiz">Quiz</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium">Medium (ประเภท)</label>
            <select 
              value={medium} 
              onChange={(e) => setMedium(e.target.value)}
              className="w-full mt-1 p-2 border rounded-lg text-sm"
            >
              <option value="">เลือก...</option>
              <option value="social">Social Media</option>
              <option value="cpc">Paid Ads</option>
              <option value="organic">Organic</option>
              <option value="email">Email</option>
              <option value="qr">QR Code</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium">Campaign (แคมเปญ)</label>
            <input 
              type="text" 
              value={campaign} 
              onChange={(e) => setCampaign(e.target.value)}
              className="w-full mt-1 p-2 border rounded-lg text-sm"
              placeholder="เช่น promo_2024"
            />
          </div>
        </div>
        
        <div className="bg-muted p-3 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Generated URL:</div>
          <div className="text-sm font-mono break-all">{buildUrl()}</div>
        </div>
        
        <Button onClick={handleCopy} className="w-full gap-2">
          {copied ? (
            <>✓ คัดลอกแล้ว!</>
          ) : (
            <><Copy className="h-4 w-4" /> คัดลอก Link</>
          )}
        </Button>
      </div>
    </Card>
  );
}

export default function LeadSalePage() {
  const totalLeads = LEAD_TYPES.reduce((sum, lt) => sum + lt.stats.total, 0);
  const totalConverted = LEAD_TYPES.reduce((sum, lt) => sum + lt.stats.converted, 0);
  const conversionRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0;
  const totalSourceLeads = LEAD_SOURCES.reduce((sum, s) => sum + s.leads, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">🎯 Lead Sale Dashboard</h1>
        <p className="text-sm text-muted-foreground">จัดการ Lead ตามประเภทสินค้า 3 ประเภท</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Lead ทั้งหมด" value={totalLeads} icon={TrendingUp} />
        <StatCard label="Lead ใหม่" value={LEAD_TYPES.reduce((sum, lt) => sum + lt.stats.new, 0)} icon={TrendingUp} />
        <StatCard label="ปิดการขาย" value={totalConverted} icon={Users} />
        <StatCard label="Conversion Rate" value={`${conversionRate}%`} icon={TrendingUp} />
      </div>

      {/* Lead Sources Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">📊 Lead Sources</h3>
            <p className="text-sm text-muted-foreground">แหล่งที่มาของ Lead ทั้งหมด {totalSourceLeads} คน</p>
          </div>
          <Badge variant="outline">{LEAD_SOURCES.length} แหล่ง</Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {LEAD_SOURCES.map((source) => (
            <LeadSourceCard key={source.id} source={source} />
          ))}
        </div>
      </Card>

      {/* Product Type Cards */}
      <div className="grid gap-6">
        {LEAD_TYPES.map((leadType) => {
          const Icon = leadType.icon;
          return (
            <Card key={leadType.id} className={`p-6 border ${leadType.borderColor}`}>
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`p-3 rounded-xl ${leadType.bgColor}`}>
                  <Icon className={`h-6 w-6 ${leadType.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold">{leadType.name}</h2>
                    <Badge variant="outline" className={leadType.color}>{leadType.price}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{leadType.description}</p>

                  {/* Features */}
                  <div className="flex gap-2 flex-wrap mb-4">
                    {leadType.features.map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <div className="text-lg font-bold">{leadType.stats.total}</div>
                      <div className="text-xs text-muted-foreground">ทั้งหมด</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <div className="text-lg font-bold text-blue-500">{leadType.stats.new}</div>
                      <div className="text-xs text-muted-foreground">ใหม่</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <div className="text-lg font-bold text-orange-500">{leadType.stats.contacted}</div>
                      <div className="text-xs text-muted-foreground">ติดต่อแล้ว</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <div className="text-lg font-bold text-green-500">{leadType.stats.converted}</div>
                      <div className="text-xs text-muted-foreground">ปิดการขาย</div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-2">
                  <Button size="sm" className="gap-1">
                    <Phone className="h-4 w-4" />
                    ติดตาม
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1">
                    <Mail className="h-4 w-4" />
                    ส่งข้อมูล
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1">
                    <MessageSquare className="h-4 w-4" />
                    แชท
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* UTM Builder */}
      <UTMBuilder />

      {/* Funnel Summary */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-secondary/5">
        <h3 className="text-lg font-bold mb-4">📈 Lead Funnel Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-blue-500">{totalLeads}</div>
            <div className="text-sm text-muted-foreground"> Awareness (Lead ทั้งหมด)</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-500">
              {LEAD_TYPES.reduce((sum, lt) => sum + lt.stats.contacted, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Interest (ติดต่อแล้ว)</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-500">{totalConverted}</div>
            <div className="text-sm text-muted-foreground">Action (ปิดการขาย)</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
