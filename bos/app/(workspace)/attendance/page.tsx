"use client";

import { AttendanceManager } from "@/features/attendance/components/attendance-manager";
import { CalendarView } from "@/features/calendar/components/calendar-view";
import { GoogleCalendarFilter } from "@/features/calendar/components/google-calendar-filter";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { Skeleton } from "@/components/ui/skeleton";

const RANGE_DAYS_BACK = 7;
const RANGE_DAYS_FORWARD = 30;

export default function AttendancePage() {
  const { events, connections, selectedIds, externalEvents, toggleConnection } = useCalendarEvents(RANGE_DAYS_BACK, RANGE_DAYS_FORWARD);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">ยืนยันการมาเรียน</h1>
        <p className="text-sm text-secondary/50">ตั้งตารางเรียนรายสัปดาห์ของน้องแต่ละคน ระบบจะส่งข้อความยืนยันการมาเรียนทาง LINE ให้อัตโนมัติล่วงหน้า 24 ชั่วโมง</p>
      </div>
      <AttendanceManager />

      <div className="space-y-2 border-t border-line/5 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-secondary">ปฏิทินการเรียนจริง (จากหน้า Calendar)</h2>
          <p className="text-xs text-secondary/50">
            ตารางเรียนที่มีอยู่แล้ว ทั้งจากระบบจองและปฏิทิน Google ที่เชื่อมไว้ — ใช้เทียบดูก่อนเพิ่มตารางด้านบน จะได้ไม่ซ้ำกับที่มีอยู่แล้ว
          </p>
        </div>
        {connections && connections.length > 0 ? (
          <GoogleCalendarFilter connections={connections} selectedIds={selectedIds} onToggle={toggleConnection} />
        ) : null}
        {events ? <CalendarView events={events} externalEvents={externalEvents} /> : <Skeleton className="h-[600px]" />}
      </div>
    </div>
  );
}
