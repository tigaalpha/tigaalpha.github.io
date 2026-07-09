import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export interface LessonListItem {
  id: string;
  title: string;
  startTime: string;
  lessonType: "normal" | "final";
}

export function LessonListCard({ title, lessons }: { title: string; lessons: LessonListItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {lessons.length === 0 ? (
          <EmptyState icon={Clock} title="No lessons scheduled" />
        ) : (
          <ul className="space-y-2">
            {lessons.map((lesson) => (
              <li key={lesson.id} className="flex items-center justify-between rounded-xl border border-black/5 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-secondary">{lesson.title}</p>
                  <p className="text-xs text-secondary/50">
                    {new Date(lesson.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Badge variant={lesson.lessonType === "final" ? "success" : "default"}>
                  {lesson.lessonType === "final" ? "Final · collect payment" : "Normal"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
