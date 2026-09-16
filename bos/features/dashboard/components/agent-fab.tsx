"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Brain,
  X,
  Bell,
  GraduationCap,
  CalendarDays,
  CreditCard,
  AlertTriangle,
  MessageSquare,
  Megaphone,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import type { Tables } from "@/types/database";

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string; bg: string; label: string; href: string }
> = {
  lesson_today: {
    icon: CalendarDays,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "📅 ตารางเรียน",
    href: "/calendar",
  },
  conflict_booking: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    label: "⚠️ ตารางซ้อน",
    href: "/calendar",
  },
  customer_near_end_course: {
    icon: GraduationCap,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    label: "🎓 ใกล้หมดชั่วโมง",
    href: "/students",
  },
  payment_reminder: {
    icon: CreditCard,
    color: "text-red-500",
    bg: "bg-red-500/10",
    label: "💰 ค้างชำระ",
    href: "/accounting",
  },
  ai_needs_review: {
    icon: MessageSquare,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    label: "🤖 AI รอตรวจ",
    href: "/chat",
  },
  new_customer: {
    icon: Sparkles,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "✨ ลูกค้าใหม่",
    href: "/students",
  },
};

const AGENT_DEPARTMENTS = [
  { key: "sales", label: "ฝ่ายขาย", icon: TrendingUp, color: "text-blue-400", href: "/lead-sale" },
  { key: "marketing", label: "ฝ่ายการตลาด", icon: Megaphone, color: "text-pink-400", href: "/marketing-dashboard" },
  { key: "finance", label: "ฝ่ายการเงิน", icon: CreditCard, color: "text-emerald-400", href: "/accounting" },
  { key: "ops", label: "ฝ่ายปฏิบัติการ", icon: CheckCircle2, color: "text-amber-400", href: "/calendar" },
  { key: "content", label: "ฝ่ายเนื้อหา", icon: Sparkles, color: "text-purple-400", href: "/content" },
  { key: "research", label: "ฝ่ายวิจัย", icon: Bell, color: "text-cyan-400", href: "/strategy" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม. ที่แล้ว`;
  const days = Math.floor(hrs / 24);
  return `${days} วัน ที่แล้ว`;
}

export function AgentFAB() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Tables<"notifications">[]>([]);
  const [recentWorkflows, setRecentWorkflows] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Fetch data
  const fetchData = async () => {
    try {
      const repos = createRepositories(createClient());
      const [notifs, workflows, approvals, chats] = await Promise.all([
        repos.notifications.listUnread(20),
        // Fetch recent agent workflow runs
        createClient()
          .from("agent_workflow_runs")
          .select("id, goal, status, created_at, summary, recommended_actions, feedback")
          .order("created_at", { ascending: false })
          .limit(5),
        createClient()
          .from("approval_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        createClient()
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("needs_review", true),
      ]);

      setNotifications(notifs);
      setRecentWorkflows(workflows.data ?? []);
      setPendingApprovals(approvals.count ?? 0);
      setUnreadChats(chats.count ?? 0);
    } catch {
      // Silently ignore errors — FAB is non-critical
    }
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(intervalRef.current);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Mark as read
  const markRead = async (id: string) => {
    await createRepositories(createClient()).notifications.markRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllRead = async () => {
    await createRepositories(createClient()).notifications.markAllRead();
    setNotifications([]);
  };

  const totalBadge =
    notifications.length + pendingApprovals + unreadChats;
  const hasNewWorkflows = recentWorkflows.some(
    (w) => w.status === "completed" || w.status === "synthesized"
  );

  // Group notifications by type
  const grouped = notifications.reduce((acc, n) => {
    const t = n.type;
    if (!acc[t]) acc[t] = [];
    acc[t].push(n);
    return acc;
  }, {} as Record<string, Tables<"notifications">[]>);

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-36 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/30 transition-all hover:scale-110 hover:shadow-xl active:scale-95 sm:right-6 md:top-24 md:right-8 md:h-14 md:w-14"
        aria-label="Agent Notifications"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <div className="relative">
            <Brain className="h-6 w-6" />
            {totalBadge > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {totalBadge > 99 ? "99+" : totalBadge}
              </span>
            )}
            {hasNewWorkflows && (
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 animate-pulse" />
            )}
          </div>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-end bg-black/20 p-4 md:items-center md:justify-end md:p-8">
          <div
            ref={panelRef}
            className="w-full max-w-sm rounded-2xl border border-line/20 bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-line/10 bg-card/95 backdrop-blur px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-secondary">
                    AI Agents
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-secondary/50 hover:text-primary"
                    >
                      อ่านทั้งหมด
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1 hover:bg-line/10"
                  >
                    <X className="h-4 w-4 text-secondary/50" />
                  </button>
                </div>
              </div>

              {/* Quick stats */}
              <div className="mt-2 flex gap-3 text-xs text-secondary/60">
                {pendingApprovals > 0 && (
                  <Link
                    href="/approval"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-amber-500 hover:bg-amber-500/20"
                  >
                    <Clock className="h-3 w-3" />
                    รออนุมัติ {pendingApprovals}
                  </Link>
                )}
                {unreadChats > 0 && (
                  <Link
                    href="/chat"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-1 rounded-lg bg-purple-500/10 px-2 py-1 text-purple-500 hover:bg-purple-500/20"
                  >
                    <MessageSquare className="h-3 w-3" />
                    แชทรอตรวจ {unreadChats}
                  </Link>
                )}
              </div>
            </div>

            {/* Scrollable content */}
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Agent Departments - Active Status */}
              <div className="border-b border-line/10 px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary/40">
                  แผนก AI ที่ทำงานอยู่
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {AGENT_DEPARTMENTS.map((dept) => {
                    const DeptIcon = dept.icon;
                    return (
                      <Link
                        key={dept.key}
                        href={dept.href}
                        onClick={() => setOpen(false)}
                        className="flex flex-col items-center gap-1 rounded-xl bg-line/5 p-2 text-center transition hover:bg-line/10 hover:scale-105 active:scale-95"
                      >
                        <DeptIcon className={`h-4 w-4 ${dept.color}`} />
                        <span className="text-[10px] text-secondary/60">
                          {dept.label}
                        </span>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Notifications by Type */}
              {Object.entries(grouped).map(([type, items]) => {
                const config = TYPE_CONFIG[type] || {
                  icon: Bell,
                  color: "text-secondary",
                  bg: "bg-secondary/10",
                  label: type,
                  href: "/dashboard",
                };
                const Icon = config.icon;
                return (
                  <div key={type} className="border-b border-line/10 px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-secondary/60">
                        {config.label} ({items.length})
                      </span>
                      <Link
                        href={config.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                      >
                        ดูทั้งหมด <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="space-y-1.5">
                      {items.slice(0, 3).map((notif) => (
                        <div
                          key={notif.id}
                          className="group flex items-start gap-2 rounded-xl bg-line/5 p-2.5 transition hover:bg-line/10"
                        >
                          <Icon
                            className={`mt-0.5 h-4 w-4 shrink-0 ${config.color}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-secondary line-clamp-1">
                              {notif.title}
                            </p>
                            {notif.body && (
                              <p className="mt-0.5 text-[10px] text-secondary/50 line-clamp-2">
                                {notif.body}
                              </p>
                            )}
                            <p className="mt-1 text-[10px] text-secondary/30">
                              {timeAgo(notif.created_at)}
                            </p>
                          </div>
                          <button
                            onClick={() => markRead(notif.id)}
                            className="mt-0.5 shrink-0 rounded p-0.5 text-secondary/30 hover:bg-line/20 hover:text-primary"
                            title="ทำเครื่องหมายอ่านแล้ว"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Recent CEO Agent Reports */}
              {recentWorkflows.length > 0 && (
                <div className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-secondary/60">
                      📊 รายงานล่าสุดจาก CEO Agent
                    </span>
                    <Link
                      href="/ai-company"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                    >
                      ดูทั้งหมด <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {recentWorkflows.slice(0, 3).map((wf) => (
                      <Link
                        key={wf.id}
                        href="/ai-company"
                        onClick={() => setOpen(false)}
                        className="block rounded-xl bg-line/5 p-3 transition hover:bg-line/10"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-secondary line-clamp-1">
                            {wf.goal}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                              wf.status === "completed" || wf.status === "synthesized"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : wf.status === "running"
                                ? "bg-blue-500/10 text-blue-500"
                                : "bg-secondary/10 text-secondary/50"
                            }`}
                          >
                            {wf.status === "completed" || wf.status === "synthesized"
                              ? "เสร็จ"
                              : wf.status === "running"
                              ? "กำลังวิเคราะห์"
                              : wf.status}
                          </span>
                        </div>
                        {wf.summary && (
                          <p className="mt-1 text-[10px] text-secondary/40 line-clamp-2">
                            {wf.summary.slice(0, 120)}...
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-secondary/30">
                          {timeAgo(wf.created_at)}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {notifications.length === 0 &&
                recentWorkflows.length === 0 &&
                pendingApprovals === 0 &&
                unreadChats === 0 && (
                  <div className="px-4 py-8 text-center">
                    <Brain className="mx-auto mb-2 h-8 w-8 text-secondary/20" />
                    <p className="text-xs text-secondary/40">
                      ไม่มีข้อความใหม่จาก AI Agents
                    </p>
                    <p className="mt-1 text-[10px] text-secondary/20">
                      AI กำลังทำงานอัตโนมัติอยู่เบื้องหลัง
                    </p>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
