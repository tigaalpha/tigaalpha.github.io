import { Clapperboard, Phone, Mail, MessageSquare, Plus, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function VideoCourseLeadsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🎬 คอร์สวิดีโอ</h1>
          <p className="text-sm text-muted-foreground">ราคา ฿990 – ฿1,490 ต่อคอร์ส • เรียนได้ทุกที่ ทุกเวลา</p>
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

      {/* Course Types */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 border-blue-500/20">
          <h3 className="font-bold mb-2">พื้นฐาน</h3>
          <p className="text-2xl font-bold text-blue-500">฿990</p>
          <p className="text-xs text-muted-foreground">สำหรับผู้เริ่มต้น</p>
        </Card>
        <Card className="p-4 border-purple-500/20">
          <h3 className="font-bold mb-2">ขั้นสูง</h3>
          <p className="text-2xl font-bold text-purple-500">฿1,490</p>
          <p className="text-xs text-muted-foreground">สำหรับผู้ที่มีพื้นฐาน</p>
        </Card>
      </div>

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
          <Clapperboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">ยังไม่มี Lead</p>
          <p className="text-sm">เริ่มเพิ่ม Lead แรกของคุณ</p>
          <Button className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            เพิ่ม Lead แรก
          </Button>
        </div>
      </Card>

      {/* Course Features */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">คุณสมบัติคอร์ส</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">จุดเด่น</p>
            <ul className="text-sm space-y-1">
              <li>• เรียนได้ทุกที่ ทุกเวลา</li>
              <li>• ดูซ้ำได้ไม่จำกัด</li>
              <li>• มี 2 ระดับ: พื้นฐาน ฿990 / ขั้นสูง ฿1,490</li>
              <li>• เหมาะสำหรับผู้เริ่มต้นที่มีงบจำกัด</li>
            </ul>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Revenue Target</p>
            <p className="text-xl font-bold text-green-500">฿990 – ฿1,490 / lead</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
