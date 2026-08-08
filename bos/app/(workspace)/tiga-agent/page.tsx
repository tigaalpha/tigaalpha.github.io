import { ScheduleManager } from "@/features/tiga-agent/components/schedule-manager";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";

export default function TigaAgentPage() {
  return (
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">TIGA AI Agent</h1>
          <p className="text-sm text-secondary/50">ตั้งเวลาให้ TIGA AI Agent ทำงานอัตโนมัติตามคำสั่งที่กำหนดไว้</p>
        </div>
        <ScheduleManager />
      </div>
    </OwnerOnlyGuard>
  );
}
