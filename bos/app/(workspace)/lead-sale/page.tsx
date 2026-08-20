import { Suspense } from "react";
import { TrendingUp, Users, Clapperboard, Smartphone, ArrowRight, Phone, Mail, MessageSquare } from "lucide-react";
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

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <Card className="p-4 text-center">
      <Icon className="h-5 w-5 mx-auto mb-2 text-primary" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

export default function LeadSalePage() {
  const totalLeads = LEAD_TYPES.reduce((sum, lt) => sum + lt.stats.total, 0);
  const totalConverted = LEAD_TYPES.reduce((sum, lt) => sum + lt.stats.converted, 0);
  const conversionRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0;

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
