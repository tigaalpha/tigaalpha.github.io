"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/services/supabase/client";
import { CalendarCheck, CalendarX } from "lucide-react";

interface StatusCheck {
  connected: boolean;
  detail: string;
}

interface StatusResponse {
  googleCalendar: StatusCheck;
}

/**
 * Bookings already push/pull through calendar.ts once Google Calendar is
 * connected (Settings > Integrations) — this is just a visibility prompt so
 * the owner notices when it isn't connected yet, instead of silently
 * wondering why the calendar page looks empty.
 */
export function GoogleCalendarBanner() {
  const [status, setStatus] = useState<StatusCheck | "loading">("loading");

  useEffect(() => {
    const supabase = createClient();
    supabase.functions.invoke<StatusResponse>("integrations-status").then(({ data }) => {
      if (data) setStatus(data.googleCalendar);
    });
  }, []);

  if (status === "loading") return null;

  if (status.connected) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
        <CalendarCheck className="h-4 w-4" />
        เชื่อมต่อ Google Calendar แล้ว — การจองใหม่จะซิงก์ขึ้นปฏิทินจริงอัตโนมัติ
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
      <span className="flex items-center gap-2">
        <CalendarX className="h-4 w-4" />
        ยังไม่ได้เชื่อมต่อ Google Calendar — ปฏิทินนี้จะเห็นเฉพาะการจองในระบบ ไม่ได้ซิงก์กับ Google Calendar จริง
      </span>
      <Link href="/settings" className="whitespace-nowrap font-medium underline">
        ไปเชื่อมต่อ
      </Link>
    </div>
  );
}
