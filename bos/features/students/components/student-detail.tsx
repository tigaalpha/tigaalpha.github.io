import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/types/database";

interface StudentDetailProps {
  customer: Tables<"customers">;
  courses: Tables<"courses">[];
  history: Tables<"sales_status_history">[];
}

export function StudentDetail({ customer, courses, history }: StudentDetailProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>{customer.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Phone" value={customer.phone} />
          <Row label="LINE" value={customer.line_user_id} />
          <Row label="Age" value={customer.age?.toString()} />
          <Row label="Goal" value={customer.learning_goal} />
          <Row label="Budget" value={customer.budget} />
          <Row label="Experience" value={customer.experience_level} />
          <Row label="Preferred schedule" value={customer.preferred_schedule} />
          <Row label="Parent" value={customer.parent_name} />
          <div className="flex items-center justify-between border-t border-black/5 pt-3">
            <span className="text-secondary/50">Sales status</span>
            <Badge>{customer.sales_status.replace(/_/g, " ")}</Badge>
          </div>
          {customer.notes ? <p className="rounded-xl bg-black/5 p-3 text-secondary/70">{customer.notes}</p> : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Courses & Hour Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {courses.length === 0 ? (
            <p className="text-sm text-secondary/50">No courses yet.</p>
          ) : (
            courses.map((course) => (
              <div key={course.id} className="rounded-xl border border-black/5 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-secondary">{course.total_hours}-hour course</span>
                  <span className="text-secondary/50">
                    {course.current_hour} / {course.total_hours} hrs completed
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-primary-gradient"
                    style={{ width: `${(course.current_hour / course.total_hours) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-secondary/40">{course.remaining_hour} hours remaining</p>
              </div>
            ))
          )}

          <div className="border-t border-black/5 pt-4">
            <h3 className="mb-2 text-sm font-medium text-secondary">Sales Status History</h3>
            <ul className="space-y-1.5 text-xs text-secondary/60">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between">
                  <span>
                    {h.from_status ? `${h.from_status} → ` : ""}
                    {h.to_status}
                    {h.note ? ` — ${h.note}` : ""}
                  </span>
                  <span className="text-secondary/40">{new Date(h.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-secondary/50">{label}</span>
      <span className="font-medium text-secondary">{value || "—"}</span>
    </div>
  );
}
