import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export interface LessonListItem {
  id: string;
  title: string;
  startTime: string;
  lessonType: "normal" | "final";
  attendanceStatus?: "unconfirmed" | "confirmed" | "declined" | null;
}

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "Confirmed", cls: "bg-emerald-500/15 text-emerald-400" },
  unconfirmed: { label: "Pending", cls: "bg-orange-500/15 text-orange-400" },
  declined: { label: "Declined", cls: "bg-red-500/15 text-red-400" },
  final: { label: "Final", cls: "bg-purple-500/15 text-purple-400" },
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LessonListCard({ title, lessons }: { title: string; lessons: LessonListItem[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Link href="/calendar" className="text-xs font-medium text-purple-400 hover:text-purple-300">
          View calendar
        </Link>
      </CardHeader>
      <CardContent>
        {lessons.length === 0 ? (
          <EmptyState icon={CalendarX2} title="No lessons scheduled" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-secondary/35">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Lesson</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((lesson) => {
                  const pill = lesson.attendanceStatus
                    ? STATUS_PILL[lesson.attendanceStatus]
                    : lesson.lessonType === "final"
                      ? STATUS_PILL.final
                      : undefined;
                  return (
                    <tr key={lesson.id} className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.02]">
                      <td className="py-2.5 pr-4 font-medium text-white">{timeLabel(lesson.startTime)}</td>
                      <td className="py-2.5 pr-4 text-secondary/75">{lesson.title}</td>
                      <td className="py-2.5 pr-4 text-secondary/45">{lesson.lessonType === "final" ? "Final" : "Normal"}</td>
                      <td className="py-2.5">
                        {pill ? (
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", pill.cls)}>{pill.label}</span>
                        ) : (
                          <span className="text-secondary/35">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
