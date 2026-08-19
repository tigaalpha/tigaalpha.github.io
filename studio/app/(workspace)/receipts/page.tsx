import { ReceiptsView } from "@/features/receipts/components/receipts-view";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";

export default function ReceiptsPage() {
  return (
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">ใบเสร็จ</h1>
          <p className="text-sm text-secondary/50">สร้างอัตโนมัติทุกครั้งที่บันทึกรายรับพร้อมระบุลูกค้า — เก็บเข้า Google Drive และส่งให้ลูกค้าทาง LINE ให้เอง</p>
        </div>
        <ReceiptsView />
      </div>
    </OwnerOnlyGuard>
  );
}
