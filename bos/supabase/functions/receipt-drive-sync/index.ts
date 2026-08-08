import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import { getGoogleAccessToken } from "../_shared/google-auth.ts";
import { getOrCreateDriveFolder, uploadBytesToDrive, makeDriveFileReadable } from "../_shared/drive.ts";
import * as line from "../_shared/line.ts";

// Heartbeat (pg_cron, every 5 min — see 0056_receipt_drive_sync_cron_job.sql):
// finds receipts the auto_create_receipt trigger (0055) just inserted that
// haven't been rendered to Drive yet, generates a simple printable HTML
// receipt, uploads it, makes it link-readable (the customer has no Google
// login of their own), and — if the customer has ever messaged the LINE OA
// (line_user_id set) — pushes them the link. A receipt with no LINE
// connection still gets its Drive copy; it just isn't auto-delivered.
const FOLDER_NAME = "Tiga AI BOS - Receipts";
const FOLDER_CACHE_KEY = "google_drive_receipts_folder_id";
const BATCH_LIMIT = 20;

interface ReceiptRow {
  id: string;
  receipt_number: string;
  amount: number;
  issued_at: string;
  customer_id: string;
  sent_at: string | null;
  transactions: { category: string; description: string | null; payment_method: string | null } | null;
  customers: { name: string; line_user_id: string | null } | null;
}

function renderReceiptHtml(receipt: ReceiptRow): string {
  const customerName = receipt.customers?.name ?? "-";
  const category = receipt.transactions?.category ?? "-";
  const description = receipt.transactions?.description ?? "";
  const paymentMethod = receipt.transactions?.payment_method ?? "-";
  const issuedDate = new Date(receipt.issued_at).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const amountFormatted = receipt.amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><title>ใบเสร็จ ${receipt.receipt_number}</title>
<style>
body { font-family: 'Sarabun', sans-serif; max-width: 480px; margin: 40px auto; color: #1a1a1a; }
h1 { font-size: 20px; margin-bottom: 4px; }
.muted { color: #666; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin-top: 24px; }
td { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
td:last-child { text-align: right; }
.total { font-size: 18px; font-weight: 700; }
</style></head>
<body>
<h1>Tiga Studio — ใบเสร็จรับเงิน</h1>
<p class="muted">เลขที่ ${receipt.receipt_number} · ${issuedDate}</p>
<table>
<tr><td>ลูกค้า</td><td>${customerName}</td></tr>
<tr><td>รายการ</td><td>${category}${description ? ` (${description})` : ""}</td></tr>
<tr><td>ช่องทางชำระเงิน</td><td>${paymentMethod}</td></tr>
<tr><td class="total">ยอดรวม</td><td class="total">฿${amountFormatted}</td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createAdminClient();

  try {
    const { data: pending, error } = await admin
      .from("receipts")
      .select("id, receipt_number, amount, issued_at, customer_id, sent_at, transactions(category, description, payment_method), customers(name, line_user_id)")
      .is("drive_file_id", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_LIMIT);
    if (error) throw error;
    if (!pending || pending.length === 0) return jsonResponse({ synced: 0 });

    const accessToken = await getGoogleAccessToken();
    const folderId = await getOrCreateDriveFolder(admin, accessToken, FOLDER_NAME, FOLDER_CACHE_KEY);

    let synced = 0;
    for (const receipt of pending as unknown as ReceiptRow[]) {
      try {
        const html = renderReceiptHtml(receipt);
        const bytes = new TextEncoder().encode(html);
        const { fileId, webViewUrl } = await uploadBytesToDrive(accessToken, {
          name: `${receipt.receipt_number}.html`,
          mimeType: "text/html",
          bytes,
          folderId,
        });
        await makeDriveFileReadable(accessToken, fileId);

        const lineUserId = receipt.customers?.line_user_id ?? null;
        let sentAt: string | null = null;
        if (lineUserId) {
          await line.push(lineUserId, `ใบเสร็จรับเงิน ${receipt.receipt_number} จาก Tiga Studio\nยอด ฿${receipt.amount.toLocaleString("th-TH")}\n${webViewUrl}`);
          sentAt = new Date().toISOString();
        }

        await admin.from("receipts").update({ drive_file_id: fileId, drive_file_url: webViewUrl, sent_at: sentAt }).eq("id", receipt.id);
        synced += 1;
      } catch (receiptError) {
        const message = receiptError instanceof Error ? receiptError.message : "Unknown error";
        await logSystemEvent(admin, "receipt-drive-sync", "error", `Receipt ${receipt.id}: ${message}`);
      }
    }

    return jsonResponse({ synced, pending: pending.length });
  } catch (error) {
    return await handleUnexpectedError(admin, "receipt-drive-sync", error);
  }
});
