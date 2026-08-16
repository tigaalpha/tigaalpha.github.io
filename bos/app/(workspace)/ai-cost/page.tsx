import { AiCostView } from "@/features/ai-cost/components/ai-cost-view";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";

export default function AiCostPage() {
  return (
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">ต้นทุน AI</h1>
          <p className="text-sm text-secondary/50">ค่าใช้จ่าย AI โดยประมาณแยกตามโมเดล/งาน + แนวโน้มรายวัน + สถานะงบต่อวัน</p>
        </div>
        <AiCostView />
      </div>
    </OwnerOnlyGuard>
  );
}
