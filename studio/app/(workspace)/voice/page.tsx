import { VoiceCallsSection } from "@/features/voice/components/voice-calls-section";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";

export default function VoicePage() {
  return (
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">AI Receptionist</h1>
          <p className="text-sm text-secondary/50">สายโทรเข้าที่ AI รับให้อัตโนมัติ — บันทึก สรุป และลิงก์เข้ากับ CRM</p>
        </div>
        <VoiceCallsSection />
      </div>
    </OwnerOnlyGuard>
  );
}
