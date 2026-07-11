import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollText } from "lucide-react";
import type { Tables } from "@/types/database";

const ACTION_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  INSERT: "success",
  UPDATE: "default",
  DELETE: "danger",
};

export function AuditLogCard({ entries }: { entries: Tables<"audit_log">[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {entries.length === 0 ? (
          <EmptyState icon={ScrollText} title="No activity recorded yet" />
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 rounded-xl bg-line/5 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-secondary">
                    <span className="font-medium">{entry.entity_type}</span>
                    {entry.entity_id ? <span className="text-secondary/50"> #{entry.entity_id.slice(0, 8)}</span> : null}
                  </p>
                  <p className="text-xs text-secondary/50">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
                <Badge variant={ACTION_TONE[entry.action] ?? "default"}>{entry.action}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
