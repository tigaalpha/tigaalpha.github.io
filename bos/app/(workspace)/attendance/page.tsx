import { AttendanceManager } from "@/features/attendance/components/attendance-manager";

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">ยืนยันการมาเรียน</h1>
        <p className="text-sm text-secondary/50">ตั้งตารางเรียนรายสัปดาห์ของน้องแต่ละคน ระบบจะส่งข้อความยืนยันการมาเรียนทาง LINE ให้อัตโนมัติล่วงหน้า 24 ชั่วโมง</p>
      </div>
      <AttendanceManager />
    </div>
  );
}
