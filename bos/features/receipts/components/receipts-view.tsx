"use client";

import { useEffect, useState } from "react";
import { Receipt as ReceiptIcon, ExternalLink } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import type { ReceiptWithCustomer } from "@/services/repositories/receipts.repository";

function StatusBadge({ receipt }: { receipt: ReceiptWithCustomer }) {
  if (!receipt.drive_file_id) return <Badge variant="outline">กำลังบันทึกเข้า Drive…</Badge>;
  if (receipt.sent_at) return <Badge variant="success">ส่งให้ลูกค้าแล้ว (LINE)</Badge>;
  return <Badge variant="outline">บันทึกแล้ว — ลูกค้ายังไม่เชื่อม LINE</Badge>;
}

export function ReceiptsView() {
  const [receipts, setReceipts] = useState<ReceiptWithCustomer[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.receipts.listRecent().then(setReceipts);
  }, []);

  if (receipts === null) return null;

  if (receipts.length === 0) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        title="ยังไม่มีใบเสร็จ"
        description="ใบเสร็จจะถูกสร้างให้อัตโนมัติทุกครั้งที่บันทึกรายรับในหน้า Accounting โดยระบุลูกค้า"
      />
    );
  }

  return (
    <div className="space-y-3">
      {receipts.map((receipt) => (
        <Card key={receipt.id}>
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="min-w-0">
              <p className="font-medium text-secondary">{receipt.receipt_number}</p>
              <p className="truncate text-sm text-secondary/70">{receipt.customerName}</p>
              <p className="text-xs text-secondary/40">{new Date(receipt.issued_at).toLocaleDateString("th-TH")}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <p className="font-semibold text-secondary">{formatCurrency(receipt.amount)}</p>
              <StatusBadge receipt={receipt} />
              {receipt.drive_file_url ? (
                <a href={receipt.drive_file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary-accent underline">
                  เปิดใบเสร็จ <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
