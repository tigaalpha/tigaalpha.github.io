"use client";
import { useState } from "react";
import { Users, Phone, Mail, MessageSquare, Plus, Filter, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const LEAD_SOURCES_PRIVATE = [
  { id: "line_oa", name: "LINE OA", icon: "💬", color: "bg-green-500", leads: 0, revenue: 0 },
  { id: "facebook", name: "Facebook", icon: "📘", color: "bg-blue-600", leads: 0, revenue: 0 },
  { id: "google", name: "Google", icon: "🔍", color: "bg-red-500", leads: 0, revenue: 0 },
  { id: "referral", name: "Referral", icon: "🎁", color: "bg-yellow-500", leads: 0, revenue: 0 },
  { id: "landing_page", name: "Landing Page", icon: "🌐", color: "bg-indigo-500", leads: 0, revenue: 0 },
];

const SAMPLE_LEADS = [
  { id: 1, name: "สมชาย ใจดี", phone: "081-234-5678", source: "line_oa", status: "new", date: "2024-01-15", notes: "สนใจเรียนเปียโน给孩子" },
  { id: 2, name: "สมหญิง รักลูก", phone: "089-876-5432", source: "facebook", status: "contacted", date: "2024-01-14", notes: "สอบถามราคาแล้ว" },
  { id: 3, name: "วิชัย เก่งมาก", phone: "092-345-6789", source: "referral", status: "converted", date: "2024-01-13", notes: "แนะนำโดย สมชาย" },
];

const STATUS_LABELS = {
  new: { label: "ใหม่", color: "bg-blue-500" },
  contacted: { label: "ติดต่อแล้ว", color: "bg-orange-500" },
  converted: { label: "ปิดการขาย", color: "bg-green-500" },
  lost: { label: "เสียไป", color: "bg-red-500" },
};

export default function PrivateCourseLeadsPage() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  
  const totalLeads = LEAD_SOURCES_PRIVATE.reduce((sum, s) => sum + s.leads, 0);
  const totalRevenue = LEAD_SOURCES_PRIVATE.reduce((sum, s) => sum + s.revenue, 0);
  const filteredLeads = selectedSource 
    ? SAMPLE_LEADS.filter(l => l.source === selectedSource)
    : SAMPLE_LEADS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🎹 คอร์สเรียนสด Private ตัวต่อตัว</h1>
          <p className="text-sm text-muted-foreground">ราคา ฿27,000 ต่อคอร์ส • เรียนสด 1:1 กับครูมืออาชีพ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            กรอง
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            เพิ่ม Lead
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{totalLeads}</div>
          <div className="text-xs text-muted-foreground">Lead ทั้งหมด</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-500">{LEAD_SOURCES_PRIVATE.reduce((sum, s) => sum + s.leads, 0)}</div>
          <div className="text-xs text-muted-foreground">ใหม่</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{SAMPLE_LEADS.filter(l => l.status === "contacted").length}</div>
          <div className="text-xs text-muted-foreground">ติดต่อแล้ว</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-500">{SAMPLE_LEADS.filter(l => l.status === "converted").length}</div>
          <div className="text-xs text-muted-foreground">ปิดการขาย</div>
        </Card>
      </div>

      {/* Lead Sources Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">📊 Lead Sources</h3>
        <div className="grid grid-cols-5 gap-4">
          {LEAD_SOURCES_PRIVATE.map((source) => (
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
              <div className="text-sm font-bold text-green-600 mt-1">฿{source.revenue.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Lead List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">รายชื่อ Lead</h3>
          {selectedSource && (
            <Badge variant="outline" onClick={() => setSelectedSource(null)} className="cursor-pointer">
              ✕ ล้างตัวกรอง
            </Badge>
          )}
        </div>
        
        {filteredLeads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">ยังไม่มี Lead</p>
            <p className="text-sm">เริ่มเพิ่ม Lead แรกของคุณ</p>
            <Button className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              เพิ่ม Lead แรก
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead) => {
              const source = LEAD_SOURCES_PRIVATE.find(s => s.id === lead.source);
              const status = STATUS_LABELS[lead.status as keyof typeof STATUS_LABELS];
              return (
                <div key={lead.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className={`w-10 h-10 ${source?.color || 'bg-gray-500'} rounded-full flex items-center justify-center text-white`}>
                    {source?.icon || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{lead.name}</span>
                      <Badge variant="outline" className={`text-xs ${status?.color} text-white`}>{status?.label}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{lead.phone} • {lead.source} • {lead.date}</div>
                    <div className="text-xs text-muted-foreground mt-1">{lead.notes}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline"><Phone className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline"><Mail className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline"><MessageSquare className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Course Details */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">รายละเอียดคอร์ส</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">ราคา</p>
            <p className="text-xl font-bold text-orange-500">฿27,000</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">รูปแบบ</p>
            <p className="text-xl font-bold">Private 1:1</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">จุดเด่น</p>
            <ul className="text-sm space-y-1">
              <li>• เรียนสดตัวต่อตัวกับครูมืออาชีพ</li>
              <li>• ปรับตารางเรียนตามสะดวก</li>
              <li>• Feedback แบบ Real-time</li>
              <li>• เหมาะสำหรับผู้ที่ต้องการความใส่ใจเต็มที่</li>
            </ul>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Conversion Target</p>
            <p className="text-xl font-bold text-green-500">฿27,000 / lead</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
