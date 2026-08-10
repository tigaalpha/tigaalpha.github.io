import Link from "next/link";
import { GraduationCap, UserX, Sparkles, CalendarPlus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { RenewalOpportunity } from "@/services/repositories/courses.repository";
import type { InactiveLead } from "@/services/repositories/customers.repository";
import type { Tables } from "@/types/database";

interface ActionRequiredCardProps {
  renewals: RenewalOpportunity[];
  inactiveLeads: InactiveLead[];
  trials: { booking: Tables<"bookings">; customerId: string }[];
  pendingBookings: Tables<"bookings">[];
  problems: Tables<"system_events">[];
}

function Row({ href, primary, secondary }: { href: string; primary: string; secondary: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-lg bg-line/5 px-3 py-2 text-sm hover:bg-line/10">
      <span className="text-secondary">{primary}</span>
      <span className="text-xs text-secondary/50">{secondary}</span>
    </Link>
  );
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

export function ActionRequiredCard({ renewals, inactiveLeads, trials, pendingBookings, problems }: ActionRequiredCardProps) {
  const nothingToDo = renewals.length === 0 && inactiveLeads.length === 0 && trials.length === 0 && pendingBookings.length === 0 && problems.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary-accent" />
          ต้องทำวันนี้
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nothingToDo ? (
          <EmptyState icon={CheckCircle2} title="ไม่มีอะไรเร่งด่วนวันนี้" />
        ) : (
          <div className="space-y-4">
            {renewals.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary/50">
                  <GraduationCap className="h-3.5 w-3.5" />
                  ใกล้หมดชั่วโมง
                </p>
                {renewals.slice(0, 5).map((r) => (
                  <Row key={r.courseId} href={`/students/detail?id=${r.customerId}`} primary={r.customerName} secondary={`เหลือ ${r.remainingHour} / ${r.totalHours} ชม.`} />
                ))}
              </div>
            ) : null}

            {inactiveLeads.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary/50">
                  <UserX className="h-3.5 w-3.5" />
                  Lead เงียบหายไปนาน
                </p>
                {inactiveLeads.slice(0, 5).map((c) => (
                  <Row key={c.id} href={`/students/detail?id=${c.id}`} primary={c.name} secondary={`เงียบไป ${daysSince(c.lastActivityAt)} วัน`} />
                ))}
              </div>
            ) : null}

            {trials.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary/50">
                  <Sparkles className="h-3.5 w-3.5" />
                  Trial วันนี้/พรุ่งนี้
                </p>
                {trials.slice(0, 5).map(({ booking, customerId }) => (
                  <Row
                    key={booking.id}
                    href={`/students/detail?id=${customerId}`}
                    primary={booking.title}
                    secondary={new Date(booking.start_time).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  />
                ))}
              </div>
            ) : null}

            {pendingBookings.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary/50">
                  <CalendarPlus className="h-3.5 w-3.5" />
                  รอยืนยันการจอง
                </p>
                {pendingBookings.slice(0, 5).map((b) => (
                  <Row
                    key={b.id}
                    href="/booking"
                    primary={b.title}
                    secondary={new Date(b.start_time).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  />
                ))}
              </div>
            ) : null}

            {problems.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary/50">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  ปัญหาที่ควรรู้
                </p>
                {problems.slice(0, 5).map((e) => (
                  <Row key={e.id} href="/system-health" primary={e.message} secondary={e.severity === "error" ? "ผิดพลาด" : "คำเตือน"} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
