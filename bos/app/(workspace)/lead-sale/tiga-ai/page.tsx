"use client";
import { useState } from "react";
import { Smartphone, Download, Users, TrendingUp, Plus, Filter, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const LEAD_SOURCES_TIGA = [
  { id: "tiktok", name: "TikTok", icon: "🎵", color: "bg-black", leads: 0, description: "TikTok Bio Link" },
  { id: "facebook", name: "Facebook", icon: "📘", color: "bg-blue-600", leads: 0, description: "Facebook Ads" },
  { id: "google", name: "Google", icon: "🔍", color: "bg-red-500", leads: 0, description: "Google Ads" },
  { id: "referral", name: "Referral", icon: "🎁", color: "bg-yellow-500", leads: 0, description: "แนะนำเพื่อน" },
  { id: "landing_page", name: "Landing Page", icon: "🌐", color: "bg-indigo-500", leads: 0, description: "ฟอร์มจองเรียนทดลองฟรี" },
];

const SAMPLE_USERS_TIGA = [
  { id: 1, name: "ผู้ใช้ TikTok 01", email: "user1@example.com", source: "tiktok", status: "free", date: "2024-01-15", appVersion: "13.7.31" },
  { id: 2, name: "ผู้ใช้ Facebook 01", email: "user2@example.com", source: "facebook", status: "trial", date: "2024-01-14", appVersion: "13.7.31" },
  { id: 3, name: "ผู้ใช้ Referral 01", email: "user3@example.com", source: "referral", status: "converted", date: "2024-01-13", appVersion: "13.7.31" },
];

const STATUS_LABELS = {
  free: { label: "ฟรี", color: "bg-gray-500" },
  trial: { label: "ทดลอง", color: "bg-blue-500" },
  converted: { label: "ซื้อคอร์ส", color: "bg-green-500" },
  inactive: { label: "ไม่ active", color: "bg-red-500" },
};

export default function TigaAiLeadsPage() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  
  const totalUsers = LEAD_SOURCES_TIGA.reduce((sum, s) => sum + s.leads, 0);
  const filteredUsers = selectedSource 
    ? SAMPLE_USERS_TIGA.filter(u => u.source === selectedSource)
    : SAMPLE_USERS_TIGA;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📱 TIGA AI</h1>
          <p className="text-sm text-muted-foreground">เปิดให้ใช้ฟรี • ช่องทางหลักในการสร้าง Lead ใหม่</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            ดูแอป
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            เพิ่ม Lead
          </Button>
        </div>
      </div>

      {/* Free Badge */}
      <Card className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Smartphone className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h3 className="font-bold text-green-600">ฟรี!</h3>
            <p className="text-sm text-muted-foreground">TIGA AI เปิดให้ใช้ฟรีในตอนนี้ เป็นช่องทางหลักในการสร้าง Lead ใหม่</p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{totalUsers}</div>
          <div className="text-xs text-muted-foreground">ผู้ใช้ทั้งหมด</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-500">{LEAD_SOURCES_TIGA.reduce((sum, s) => sum + s.leads, 0)}</div>
          <div className="text-xs text-muted-foreground">ใหม่</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{SAMPLE_USERS_TIGA.filter(u => u.status === "trial").length}</div>
          <div className="text-xs text-muted-foreground">ทดลองใช้</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-500">{SAMPLE_USERS_TIGA.filter(u => u.status === "converted").length}</div>
          <div className="text-xs text-muted-foreground">ซื้อคอร์ส</div>
        </Card>
      </div>

      {/* Lead Sources Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">📊 Lead Sources</h3>
        <div className="grid grid-cols-5 gap-4">
          {LEAD_SOURCES_TIGA.map((source) => (
            <div 
              key={source.id}
              className={`p-4 rounded-lg cursor-pointer transition-all ${selectedSource === source.id ? 'bg-primary/10 border-2 border-primary' : 'bg-muted/30 hover:bg-muted/50'}`}
              onClick={() => setSelectedSource(selectedSource === source.id ? null : source.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 ${source.color} rounded-full flex items-center justify-center text-white`}>
                  {source.icon}
                </div>
                <span className="font-medium text-sm">{source.name}</span>
              </div>
              <div className="text-2xl font-bold">{source.leads}</div>
              <div className="text-xs text-muted-foreground">leads</div>
              <div className="text-xs text-muted-foreground mt-1">{source.description}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* User List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">รายชื่อผู้ใช้</h3>
          {selectedSource && (
            <Badge variant="outline" onClick={() => setSelectedSource(null)} className="cursor-pointer">
              ✕ ล้างตัวกรอง
            </Badge>
          )}
        </div>
        
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">ยังไม่มีผู้ใช้</p>
            <p className="text-sm">เริ่มแชร์ TIGA AI ให้เพื่อน</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user) => {
              const source = LEAD_SOURCES_TIGA.find(s => s.id === user.source);
              const status = STATUS_LABELS[user.status as keyof typeof STATUS_LABELS];
              return (
                <div key={user.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className={`w-10 h-10 ${source?.color || 'bg-gray-500'} rounded-full flex items-center justify-center text-white`}>
                    {source?.icon || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.name}</span>
                      <Badge variant="outline" className={`text-xs ${status?.color} text-white`}>{status?.label}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email} • {user.source} • {user.date}</div>
                    <div className="text-xs text-muted-foreground mt-1">App v{user.appVersion}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline"><Smartphone className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* App Features */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">ฟีเจอร์ TIGA AI</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">จุดเด่น</p>
            <ul className="text-sm space-y-1">
              <li>• AI ครูสอนเปียโนส่วนตัว</li>
              <li>• เรียนฟรี ไม่มีค่าใช้จ่าย</li>
              <li>• พร้อมใช้งานทันทีบนมือถือ</li>
              <li>• ช่องทางหลักในการสร้าง Lead ใหม่</li>
            </ul>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lead Strategy</p>
            <ul className="text-sm space-y-1">
              <li>• ใช้เป็น Funnel ต้อนรับ Lead ใหม่</li>
              <li>• Upsell ไปคอร์สวิดีโอ/Private</li>
              <li>• สร้าง Loyalty ก่อนขาย</li>
              <li>• Viral Growth ผ่านการแนะนำ</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Conversion Funnel */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-secondary/5">
        <h3 className="text-lg font-bold mb-4">📈 Conversion Funnel</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-32 text-sm font-medium">Free User</div>
            <div className="flex-1 bg-muted rounded-full h-6">
              <div className="bg-green-500 h-6 rounded-full flex items-center px-3 text-white text-xs font-bold" style={{ width: "100%" }}>
                ทั้งหมด
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 text-sm font-medium">Trial User</div>
            <div className="flex-1 bg-muted rounded-full h-6">
              <div className="bg-blue-500 h-6 rounded-full flex items-center px-3 text-white text-xs font-bold" style={{ width: "0%" }}>
                0%
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 text-sm font-medium">Paid User</div>
            <div className="flex-1 bg-muted rounded-full h-6">
              <div className="bg-orange-500 h-6 rounded-full flex items-center px-3 text-white text-xs font-bold" style={{ width: "0%" }}>
                0%
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
