import { ControlCenterView } from "@/features/control-center/components/control-center-view";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";

export default function ControlCenterPage() {
  return (
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">Control Center</h1>
          <p className="text-sm text-secondary/50">ภาพรวมธุรกิจและ AI ในหน้าจอเดียว — รายได้, ไปป์ไลน์, CAC/LTV, การอนุมัติ, และผลงาน AI Agent</p>
        </div>
        <ControlCenterView />
      </div>
    </OwnerOnlyGuard>
  );
}
