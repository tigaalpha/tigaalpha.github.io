"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, CalendarDays, Wallet, CreditCard, MessagesSquare, Clock3, Bot, UserPlus } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { LessonListCard } from "@/features/dashboard/components/lesson-list-card";
import { RecentActivitiesCard } from "@/features/dashboard/components/recent-activities-card";
import { StudentsProgressCard } from "@/features/dashboard/components/students-progress-card";
import { RevenueOverviewCard } from "@/features/dashboard/components/revenue-overview-card";
import { CommandSearch } from "@/features/dashboard/components/command-search";
import { SalesFunnelCard } from "@/features/dashboard/components/sales-funnel-card";
import { DropOffStageCard } from "@/features/dashboard/components/drop-off-stage-card";
import { BusinessSnapshotCard } from "@/features/dashboard/components/business-snapshot-card";
import { FinanceCharts } from "@/features/dashboard/components/finance-charts";
import { ActionRequiredCard } from "@/features/dashboard/components/action-required-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useT, useLang } from "@/lib/language-context";
import { tfmt } from "@/lib/i18n";
import type { RenewalOpportunity } from "@/services/repositories/courses.repository";
import type { InactiveLead } from "@/services/repositories/customers.repository";
import type { SalesStatus, Tables } from "@/types/database";

interface DashboardData {
  today: Tables<"bookings">[];
  tomorrow: Tables<"bookings">[];
  funnel: Record<SalesStatus, number>;
  dropOffStages: Record<string, number>;
  notifications: Tables<"notifications">[];
  conversations: Tables<"conversations">[];
  nearRenewal: Tables<"courses">[];
  revenue: number;
  aiResolutionRate: number;
  businessSnapshot: Tables<"business_snapshot"> | null;
  actionRenewals: RenewalOpportunity[];
  actionInactiveLeads: InactiveLead[];
  actionTrials: { booking: Tables<"bookings">; customerId: string }[];
  actionPendingBookings: Tables<"bookings">[];
  actionProblems: Tables<"system_events">[];
  totalStudents: number;
  pendingPayments: number;
  lessonsThisWeek: number;
}

function weekRange(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7; // Monday-based
  start.setDate(start.getDate() - dow);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function DashboardPage() {
  const t = useT();
  const { lang } = useLang();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoadError(null);
    const repos = createRepositories(createClient());
    const { start, end } = weekRange();

    Promise.all([
      repos.bookings.listToday(),
      repos.bookings.listTomorrow(),
      repos.sales.funnelCounts(),
      repos.notifications.listUnread(8),
      repos.conversations.listNeedingReview(),
      repos.courses.listNearingCompletion(1),
      repos.transactions.totalIncome(),
      repos.conversations.aiResolutionStats(),
      repos.businessSnapshot.get(),
      repos.courses.renewalOpportunities(3),
      repos.customers.inactiveLeads(),
      repos.bookings.listTrialsTodayAndTomorrow(),
      repos.bookings.listPending(5),
      repos.systemEvents.recentProblems(5),
      repos.conversations.dropOffStageCounts(),
      repos.customers.listPipeline(),
      repos.payments.listPending(50),
      repos.bookings.listBetween(start, end),
    ]).then(
      ([
        today,
        tomorrow,
        funnel,
        notifications,
        conversations,
        nearRenewal,
        revenue,
        aiStats,
        businessSnapshot,
        actionRenewals,
        actionInactiveLeads,
        actionTrials,
        actionPendingBookings,
        actionProblems,
        dropOffStages,
        pipeline,
        pendingPayments,
        weekBookings,
      ]) => {
        setData({
          today,
          tomorrow,
          funnel,
          notifications,
          conversations,
          nearRenewal,
          revenue,
          aiResolutionRate: aiStats.resolutionRate,
          businessSnapshot,
          actionRenewals,
          actionInactiveLeads,
          actionTrials,
          actionPendingBookings,
          actionProblems,
          dropOffStages,
          totalStudents: pipeline.length,
          pendingPayments: pendingPayments.length,
          lessonsThisWeek: weekBookings.length,
        });
      },
      (err) => {
        // Never show a silently-zero dashboard: surface the real failure
        // (most commonly a 401/403 or missing table on this Supabase
        // project) so the owner can act on it instead of assuming the
        // school has no data.
        setLoadError(err instanceof Error ? err.message : t("dash.loadFailed"));
      }
    );
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          ⚠️ {t("dash.loadFailed")}{loadError}
          <button className="ml-2 underline underline-offset-2" onClick={() => reload()}>
            {t("dash.retry")}
          </button>
        </div>
        <Skeleton className="h-8 w-56 bg-white/5" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56 bg-white/5" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 bg-white/5" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 bg-white/5 lg:col-span-2" />
          <Skeleton className="h-72 bg-white/5" />
        </div>
      </div>
    );
  }

  const {
    today,
    tomorrow,
    funnel,
    notifications,
    conversations,
    nearRenewal,
    revenue,
    aiResolutionRate,
    businessSnapshot,
    actionRenewals,
    actionInactiveLeads,
    actionTrials,
    actionPendingBookings,
    actionProblems,
    dropOffStages,
    totalStudents,
    pendingPayments,
    lessonsThisWeek,
  } = data;

  const toLessonItem = (b: Tables<"bookings">) => ({
    id: b.id,
    title: b.title,
    startTime: b.start_time,
    lessonType: b.lesson_type,
    attendanceStatus: b.attendance_status ?? null,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-secondary dark:text-white">{t("dash.greeting")}</h1>
          <p className="mt-1 text-sm text-secondary/45">{t("dash.sub")}</p>
        </div>
        <CommandSearch />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("dash.totalStudents")} value={totalStudents} icon={Users} tone="purple" subtext={t("dash.allTimeCrm")} href="/students" />
        <MetricCard label={t("dash.lessonsThisWeek")} value={lessonsThisWeek} icon={CalendarDays} tone="blue" subtext={tfmt(lang, "dash.todayCount", { n: today.length })} href="/calendar" />
        <MetricCard label={t("dash.revenue")} value={formatCurrency(revenue)} icon={Wallet} tone="green" subtext={t("dash.fromAccounting")} href="/accounting" />
        <MetricCard
          label={t("dash.pendingPayments")}
          value={pendingPayments}
          icon={CreditCard}
          tone="orange"
          subtext={pendingPayments > 0 ? tfmt(lang, "dash.needConfirm", { n: pendingPayments }) : t("dash.allClear")}
          subtextPositive={pendingPayments === 0}
          href="/accounting"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueOverviewCard />
        </div>
        <RecentActivitiesCard notifications={notifications} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LessonListCard titleKey="dash.todaysLessons" lessons={today.map(toLessonItem)} />
        </div>
        <StudentsProgressCard counts={funnel} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("dash.needsReview")} value={conversations.length} icon={MessagesSquare} tone="purple" href="/chat" />
        <MetricCard label={t("dash.nearRenewal")} value={nearRenewal.length} icon={Clock3} tone="orange" subtext={t("dash.coursesEndingSoon")} href="/students" />
        <MetricCard label={t("dash.newLeads")} value={funnel.new_lead} icon={UserPlus} tone="blue" href="/sales" />
        <MetricCard label={t("dash.aiPerformance")} value={`${aiResolutionRate}%`} icon={Bot} tone="green" subtext={t("dash.resolvedNoEscalation")} href="/chat" />
      </div>

      <ActionRequiredCard
        renewals={actionRenewals}
        inactiveLeads={actionInactiveLeads}
        trials={actionTrials}
        pendingBookings={actionPendingBookings}
        problems={actionProblems}
      />

      <FinanceCharts />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LessonListCard titleKey="dash.tomorrowsLessons" lessons={tomorrow.map(toLessonItem)} />
        <div className="flex flex-col gap-6">
          <DropOffStageCard counts={dropOffStages} />
          <SalesFunnelCard counts={funnel} />
        </div>
      </div>

      <BusinessSnapshotCard snapshot={businessSnapshot} onChanged={reload} />
    </div>
  );
}
