"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Target } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Spend = Tables<"ad_spend_entries">;

const PLATFORMS = ["facebook", "instagram", "tiktok", "google", "line", "youtube", "x", "other"];

export function AdAttribution() {
  const [entries, setEntries] = useState<Spend[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState("facebook");
  const [amount, setAmount] = useState("");
  const [spendDate, setSpendDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [campaignName, setCampaignName] = useState("");

  const reload = useCallback(() => {
    createRepositories(createClient())
      .aiOps.listAdSpend()
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function add() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await createRepositories(createClient()).aiOps.addAdSpend({ platform, amount: value, spend_date: spendDate, campaign_name: campaignName.trim() || undefined });
      setAmount("");
      setCampaignName("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await createRepositories(createClient()).aiOps.deleteAdSpend(id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  const rows = entries ?? [];
  const byPlatform = new Map<string, number>();
  for (const e of rows) byPlatform.set(e.platform, (byPlatform.get(e.platform) ?? 0) + Number(e.amount));
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary-accent" />
          ค่าโฆษณา (Ad Spend) + Attribution
          <span className="text-sm font-normal text-secondary/50">รวม {formatCurrency(total)}</span>
        </CardTitle>
        <CardDescription>
          บันทึกค่าใช้จ่ายโฆษณารายช่องทาง แล้วเทียบกับยอดขาย — เพื่อรู้ว่าเงินโฆษณาไปไหน คุ้มไหม (ROI)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p> : null}

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <p className="mb-1 text-xs text-secondary/50">ช่องทาง</p>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs text-secondary/50">ยอดใช้จ่าย (บาท)</p>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              className="w-28 rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none focus:border-primary-accent"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-secondary/50">วันที่</p>
            <input
              type="date"
              value={spendDate}
              onChange={(e) => setSpendDate(e.target.value)}
              className="rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-secondary/50">ชื่อแคมเปญ</p>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="IG reels สิงหา"
              className="w-44 rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none focus:border-primary-accent"
            />
          </div>
          <Button size="sm" onClick={add} disabled={busy || !amount}>
            <Plus className="h-4 w-4" />
            เพิ่ม
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Target} title="ยังไม่มีค่าโฆษณา" description="เริ่มบันทึกค่าใช้จ่ายโฆษณาเพื่อดู ROI รายช่องทาง" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[...byPlatform.entries()].map(([p, amt]) => (
                <div key={p} className="rounded-xl border border-line/10 p-3">
                  <p className="text-xs text-secondary/50">{p}</p>
                  <p className="text-lg font-semibold text-secondary">{formatCurrency(amt)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {rows.slice(0, 30).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-secondary">
                      {e.platform}
                      {e.campaign_name ? ` · ${e.campaign_name}` : ""}
                    </p>
                    <p className="text-xs text-secondary/40">{e.spend_date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-secondary">{formatCurrency(Number(e.amount))}</p>
                    <Button size="sm" variant="ghost" onClick={() => remove(e.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
