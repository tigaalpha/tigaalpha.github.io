import { AiCompanyView } from "@/features/ai-company/components/ai-company-view";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";

export default function AiCompanyPage() {
  return (
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">AI Company</h1>
          <p className="text-sm text-secondary/50">มอบเป้าหมายทางธุรกิจให้ CEO Agent แบ่งงานให้ทีม AI วิเคราะห์ร่วมกัน</p>
        </div>
        <AiCompanyView />
      </div>
    </OwnerOnlyGuard>
  );
}
