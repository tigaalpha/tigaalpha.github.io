import { AutomationDashboard } from "@/features/automation/components/automation-dashboard";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";

export default function AutomationPage() {
  return (
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">Automation</h1>
          <p className="text-sm text-secondary/50">กฎอัตโนมัติ, งานติดตาม, และประวัติการทำงานของระบบ</p>
        </div>
        <AutomationDashboard />
      </div>
    </OwnerOnlyGuard>
  );
}
