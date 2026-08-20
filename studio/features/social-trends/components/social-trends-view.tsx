"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Youtube,
  Music2,
  Instagram,
  Facebook,
  MessageCircle,
  CreditCard,
  BookMarked,
  RefreshCw,
  Pencil,
  Trash2,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";
import type { ManualTrendPlatform } from "@/services/repositories/social-trends.repository";

interface TrendItem {
  rank: number;
  topic: string;
  detail?: string;
}

interface TrendStatus {
  connected: boolean;
  detail: string;
  items?: TrendItem[];
}

interface AutoStatusResponse {
  google: TrendStatus;
  youtube: TrendStatus;
}

const AUTO_REFRESH_MS = 5 * 60 * 1000;

const MANUAL_PLATFORMS: { platform: ManualTrendPlatform; label: string; icon: LucideIcon }[] = [
  { platform: "tiktok", label: "TikTok", icon: Music2 },
  { platform: "instagram", label: "Instagram", icon: Instagram },
  { platform: "facebook", label: "Facebook", icon: Facebook },
  { platform: "wechat", label: "WeChat", icon: MessageCircle },
  { platform: "alipay", label: "Alipay", icon: CreditCard },
  { platform: "xiaohongshu", label: "Xiaohongshu (Little Red Note)", icon: BookMarked },
];

function StatusBadge({ status }: { status: TrendStatus | null }) {
  if (!status) return <Badge variant="outline">กำลังตรวจสอบ…</Badge>;
  return <Badge variant={status.connected ? "success" : "danger"}>{status.connected ? "ข้อมูลสด" : "ไม่พร้อมใช้งาน"}</Badge>;
}

function AutoTrendCard({ icon: Icon, label, status }: { icon: LucideIcon; label: string; status: TrendStatus | null }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-secondary/60" />
            <p className="font-medium text-secondary">{label}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        {status?.connected && status.items && status.items.length > 0 ? (
          <ol className="space-y-1.5">
            {status.items.map((item) => (
              <li key={item.rank} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 w-5 shrink-0 text-right text-xs font-semibold text-secondary/40">{item.rank}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-secondary">{item.topic}</span>
                  {item.detail ? <span className="block text-xs text-secondary/40">{item.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-secondary/50">{status?.detail ?? "กำลังตรวจสอบ…"}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface ManualFormState {
  rank: string;
  topic: string;
  detail: string;
}

const EMPTY_FORM: ManualFormState = { rank: "", topic: "", detail: "" };

function ManualTrendCard({
  icon: Icon,
  label,
  items,
  onAdd,
  onUpdate,
  onDelete,
}: {
  icon: LucideIcon;
  label: string;
  items: Tables<"social_trend_manual_items">[];
  onAdd: (form: ManualFormState) => Promise<void>;
  onUpdate: (id: string, form: ManualFormState) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ManualFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function startAdd() {
    setEditingId(null);
    setForm({ rank: String(items.length + 1), topic: "", detail: "" });
    setAdding(true);
  }

  function startEdit(row: Tables<"social_trend_manual_items">) {
    setAdding(false);
    setEditingId(row.id);
    setForm({ rank: String(row.rank), topic: row.topic, detail: row.detail ?? "" });
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.topic.trim()) return;
    setSaving(true);
    if (editingId) await onUpdate(editingId, form);
    else await onAdd(form);
    setSaving(false);
    cancel();
  }

  const showForm = adding || editingId !== null;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-secondary/60" />
            <p className="font-medium text-secondary">{label}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={startAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {items.length > 0 ? (
          <ol className="space-y-1.5">
            {items.map((row) => (
              <li key={row.id} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 w-5 shrink-0 text-right text-xs font-semibold text-secondary/40">{row.rank}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-secondary">{row.topic}</span>
                  {row.detail ? <span className="block text-xs text-secondary/40">{row.detail}</span> : null}
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(row)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void onDelete(row.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        ) : !showForm ? (
          <p className="text-xs text-secondary/50">ยังไม่มีการบันทึกเทรนด์ — กด + เพื่อเพิ่ม</p>
        ) : null}

        {showForm ? (
          <div className="space-y-2 rounded-lg border border-line/10 bg-line/5 p-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                placeholder="อันดับ"
                value={form.rank}
                onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))}
                className="w-20"
              />
              <Input
                placeholder="หัวข้อ/ประเด็นที่กำลังฮิต"
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                className="flex-1"
              />
              <Button variant="ghost" size="icon" onClick={cancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
              value={form.detail}
              onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
            />
            <Button size="sm" onClick={() => void save()} disabled={saving || !form.topic.trim()}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SocialTrendsView() {
  const [autoStatus, setAutoStatus] = useState<AutoStatusResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [manualItems, setManualItems] = useState<Tables<"social_trend_manual_items">[] | null>(null);
  const userIdRef = useRef<string | null>(null);

  const refreshAuto = useCallback(async () => {
    setChecking(true);
    const supabase = createClient();
    const { data } = await supabase.functions.invoke<AutoStatusResponse>("social-trends-status");
    if (data) {
      setAutoStatus(data);
      setLastChecked(new Date());
    }
    setChecking(false);
  }, []);

  const reloadManual = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.socialTrends.listManualItems().then(setManualItems);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
    reloadManual();
    void refreshAuto();

    const interval = setInterval(() => void refreshAuto(), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshAuto, reloadManual]);

  async function addItem(platform: ManualTrendPlatform, form: ManualFormState) {
    const repos = createRepositories(createClient());
    await repos.socialTrends.addItem(platform, Number(form.rank) || 1, form.topic.trim(), form.detail.trim() || null, userIdRef.current);
    reloadManual();
  }

  async function updateItem(id: string, form: ManualFormState) {
    const repos = createRepositories(createClient());
    await repos.socialTrends.updateItem(id, Number(form.rank) || 1, form.topic.trim(), form.detail.trim() || null, userIdRef.current);
    reloadManual();
  }

  async function deleteItem(id: string) {
    const repos = createRepositories(createClient());
    await repos.socialTrends.deleteItem(id);
    reloadManual();
  }

  const itemsByPlatform = new Map<ManualTrendPlatform, Tables<"social_trend_manual_items">[]>();
  for (const row of manualItems ?? []) {
    const platform = row.platform as ManualTrendPlatform;
    const list = itemsByPlatform.get(platform) ?? [];
    list.push(row);
    itemsByPlatform.set(platform, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-secondary">ดึงข้อมูลอัตโนมัติ (Real-time)</h2>
          {lastChecked ? <p className="text-xs text-secondary/40">เช็คล่าสุด {lastChecked.toLocaleTimeString("th-TH")}</p> : null}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refreshAuto()} disabled={checking}>
          <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AutoTrendCard icon={Search} label="Google Trends" status={autoStatus?.google ?? null} />
        <AutoTrendCard icon={Youtube} label="YouTube Trending" status={autoStatus?.youtube ?? null} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-secondary">บันทึกเทรนด์ด้วยตัวเอง</h2>
        <p className="text-xs text-secondary/40">
          แพลตฟอร์มเหล่านี้ไม่มี API สาธารณะสำหรับดึงหัวข้อกำลังฮิตแบบอัตโนมัติ — บันทึกสิ่งที่สังเกตเห็นแล้วจัดอันดับเองได้ที่นี่
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MANUAL_PLATFORMS.map(({ platform, label, icon }) => (
          <ManualTrendCard
            key={platform}
            icon={icon}
            label={label}
            items={itemsByPlatform.get(platform) ?? []}
            onAdd={(form) => addItem(platform, form)}
            onUpdate={updateItem}
            onDelete={deleteItem}
          />
        ))}
      </div>
    </div>
  );
}
