"use client";

import { PaymentsView } from "@/features/payments/components/payments-view";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";

export default function PaymentsPage() {
  return (
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">การชำระเงิน</h1>
          <p className="text-sm text-secondary/50">สร้างใบแจ้งชำระ ตรวจสลิป และยืนยันเงินเข้า — เจ้าของ/แอดมินเท่านั้น</p>
        </div>
        <PaymentsView />
      </div>
    </OwnerOnlyGuard>
  );
}
