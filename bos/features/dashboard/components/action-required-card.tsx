import Link from "next/link";
import { GraduationCap, UserX, Sparkles, CalendarPlus, AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useT, useLang } from "@/lib/language-context";
import { tfmt, langLocale } from "@/lib/i18n";
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
  const t = useT();
  const { lang } = useLang();
  const locale = langLocale(lang);
  const nothingToDo = renewals.length === 0 && inactiveLeads.length === 0 && trials.length === 0 && pendingBookings.length === 0 && problems.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary-accent" />
          {t("action.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nothingToDo ? (
          <EmptyState icon={CheckCircle2} title={t("action.empty")} />
        ) : (
          <div className="space-y-4">
            {renewals.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary/50">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {t("action.nearEndHours")}
                </p>
                {renewals.slice(0, 5).map((r) => (
                  <div key={r.courseId} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Row href={`/students/detail?id=${r.customerId}`} primary={r.customerName} secondary={tfmt(lang, "action.hoursLeft", { a: r.remainingHour, b: r.totalHours })} />
                    </div>
                    <Link
                      href={`/accounting?customerId=${r.customerId}&courseId=${r.courseId}`}
                      title={t("action.recordPayment")}
                      className="shrink-0 rounded-lg bg-line/5 p-2 text-secondary/50 hover:bg-line/10 hover:text-secondary"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}

            {inactiveLeads.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary/50">
                  <UserX className="h-3.5 w-3.5" />
                  {t("action.coldLeads")}
                </p>
                {inactiveLeads.slice(0, 5).map((c) => (
                  <Row key={c.id} href={`/students/detail?id=${c.id}`} primary={c.name} secondary={tfmt(lang, "action.quietDays", { n: daysSince(c.lastActivityAt) })} />
                ))}
              </div>
            ) : null}

            {trials.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary/50">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("action.trialsToday")}
                </p>
                {trials.slice(0, 5).map(({ booking, customerId }) => (
                  <Row
                    key={booking.id}
                    href={`/students/detail?id=${customerId}`}
                    primary={booking.title}
                    secondary={new Date(booking.start_time).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  />
                ))}
              </div>
            ) : null}

            {pendingBookings.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary/50">
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {t("action.awaitConfirm")}
                </p>
                {pendingBookings.slice(0, 5).map((b) => (
                  <Row
                    key={b.id}
                    href="/booking"
                    primary={b.title}
                    secondary={new Date(b.start_time).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  />
                ))}
              </div>
            ) : null}

            {problems.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary/50">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  {t("action.problems")}
                </p>
                {problems.slice(0, 5).map((e) => (
                  <Row key={e.id} href="/system-health" primary={e.message} secondary={e.severity === "error" ? t("action.sevError") : t("action.sevWarn")} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
