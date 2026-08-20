import { Users, Phone, Mail, MessageSquare, Plus, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PrivateCourseLeadsPage() {
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
