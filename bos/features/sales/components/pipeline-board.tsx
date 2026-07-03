import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KanbanSquare } from "lucide-react";
import type { SalesStatus, Tables } from "@/types/database";

const COLUMNS: { status: SalesStatus; label: string }[] = [
  { status: "new_lead", label: "New Lead" },
  { status: "contacted", label: "Contacted" },
  { status: "qualified", label: "Qualified" },
  { status: "interested", label: "Interested" },
  { status: "trial_booked", label: "Trial Booked" },
  { status: "trial_completed", label: "Trial Completed" },
  { status: "negotiating", label: "Negotiating" },
  { status: "waiting_decision", label: "Waiting Decision" },
  { status: "won", label: "Won" },
  { status: "renew_pending", label: "Renew Pending" },
  { status: "renewed", label: "Renewed" },
  { status: "lost", label: "Lost" },
];

export function PipelineBoard({ customers }: { customers: Tables<"customers">[] }) {
  const byStatus = new Map<SalesStatus, Tables<"customers">[]>();
  for (const column of COLUMNS) byStatus.set(column.status, []);
  for (const customer of customers) byStatus.get(customer.sales_status)?.push(customer);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((column) => {
        const items = byStatus.get(column.status) ?? [];
        return (
          <div key={column.status} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-medium text-secondary">{column.label}</h3>
              <span className="text-xs text-secondary/40">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <EmptyState icon={KanbanSquare} title="Empty" className="p-6" />
              ) : (
                items.map((customer) => (
                  <Link key={customer.id} href={`/students/${customer.id}`}>
                    <Card className="p-3 transition-shadow hover:shadow-card">
                      <p className="text-sm font-medium text-secondary">{customer.name}</p>
                      <p className="mt-0.5 truncate text-xs text-secondary/50">{customer.learning_goal ?? customer.phone ?? "—"}</p>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
