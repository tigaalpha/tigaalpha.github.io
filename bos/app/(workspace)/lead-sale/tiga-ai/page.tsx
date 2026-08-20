import { Smartphone, Download, Users, TrendingUp, Plus, Filter, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function TigaAiLeadsPage() {
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
          <div className="text-2xl font-bold">0</div>
          <div className="text-xs text-muted-foreground">Lead ทั้งหมด</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-500">0</div>
          <div className="text-xs text-muted-foreground">ใหม่</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">0</div>
          <div className="text-xs text-muted-foreground">ติดต่อแล้ว</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-500">0</div>
          <div className="text-xs text-muted-foreground">ปิดการขาย</div>
        </Card>
      </div>

      {/* Lead List */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">รายชื่อ Lead</h3>
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">ยังไม่มี Lead</p>
          <p className="text-sm">เริ่มเพิ่ม Lead แรกของคุณ</p>
          <Button className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            เพิ่ม Lead แรก
          </Button>
        </div>
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
