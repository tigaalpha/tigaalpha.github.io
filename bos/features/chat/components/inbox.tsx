"use client";

import { useMemo, useState } from "react";
import { Search, CalendarRange, Users } from "lucide-react";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ConversationWithCustomer } from "@/services/repositories/conversations.repository";

const CHANNEL_LABELS: Record<string, string> = {
  line: "LINE",
  web: "เว็บ",
  messenger: "Messenger",
  internal: "ภายใน",
  phone: "โทรศัพท์",
  walk_in: "หน้าร้าน",
};

const DAY = 86_400_000;

// Recency buckets for grouping the list ("แบ่งตามช่วงระยะเวลา")
const BUCKETS: { label: string; maxDays: number }[] = [
  { label: "วันนี้", maxDays: 1 },
  { label: "7 วันที่ผ่านมา", maxDays: 7 },
  { label: "30 วันที่ผ่านมา", maxDays: 30 },
  { label: "เก่ากว่า 30 วัน", maxDays: Infinity },
];

export function Inbox({ conversations }: { conversations: ConversationWithCustomer[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<string>("all");
  const [customerId, setCustomerId] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // customer dropdown options — every customer that has a conversation
  const customers = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) {
      if (c.customer_id && c.customerName) map.set(c.customer_id, c.customerName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "th"));
  }, [conversations]);

  const channels = Array.from(new Set(conversations.map((c) => c.channel)));

  function applyPreset(days: number | null) {
    if (days === null) {
      setFromDate("");
      setToDate("");
      return;
    }
    setFromDate(new Date(Date.now() - days * DAY).toISOString().slice(0, 10));
    setToDate("");
  }

  const filtered = conversations.filter((c) => {
    if (channel !== "all" && c.channel !== channel) return false;
    if (customerId !== "all" && c.customer_id !== customerId) return false;
    if (fromDate && new Date(c.updated_at).getTime() < new Date(fromDate + "T00:00:00").getTime()) return false;
    if (toDate && new Date(c.updated_at).getTime() > new Date(toDate + "T23:59:59.999").getTime()) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (c.summary ?? "").toLowerCase().includes(q) ||
      (c.customerName ?? "").toLowerCase().includes(q) ||
      (c.line_user_id ?? "").toLowerCase().includes(q) ||
      c.id.includes(q)
    );
  });

  // group by recency bucket so the history reads like a timeline
  const sections = useMemo(() => {
    const now = Date.now();
    const out: { label: string; conversations: ConversationWithCustomer[] }[] = [];
    for (const { label, maxDays } of BUCKETS) {
      const items = filtered.filter((c) => {
        const age = now - new Date(c.updated_at).getTime();
        if (maxDays === Infinity) return age >= 30 * DAY;
        return age >= 0 && age < maxDays * DAY;
      });
      if (items.length > 0) out.push({ label, conversations: items });
    }
    return out;
  }, [filtered]);

  const hasFilters = query.trim() !== "" || channel !== "all" || customerId !== "all" || fromDate !== "" || toDate !== "";

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 overflow-hidden rounded-2xl border border-line/5 bg-card shadow-soft md:grid-cols-[300px_1fr]">
      <div className="flex flex-col border-r border-line/5">
        <div className="space-y-2 border-b border-line/5 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/40" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา (ชื่อลูกค้า/สรุป/ID)…" className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setChannel("all")}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs transition-colors",
                channel === "all" ? "bg-primary text-white" : "bg-line/5 text-secondary/60 hover:text-secondary"
              )}
            >
              ทั้งหมด
            </button>
            {channels.map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs transition-colors",
                  channel === ch ? "bg-primary text-white" : "bg-line/5 text-secondary/60 hover:text-secondary"
                )}
              >
                {CHANNEL_LABELS[ch] ?? ch}
              </button>
            ))}
          </div>

          {/* customer filter */}
          <div className="relative">
            <Users className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/40" />
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="h-9 w-full appearance-none rounded-xl border border-line/10 bg-card pl-8 pr-8 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">ลูกค้าทั้งหมด ({customers.length})</option>
              {customers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* date range */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-secondary/50">
              <CalendarRange className="h-3.5 w-3.5" />
              ช่วงระยะเวลา (ตามกิจกรรมล่าสุด)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 text-xs" aria-label="จากวันที่" />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 text-xs" aria-label="ถึงวันที่" />
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { label: "7 วัน", days: 7 },
                { label: "30 วัน", days: 30 },
                { label: "3 เดือน", days: 90 },
              ].map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => applyPreset(days)}
                  className="rounded-full border border-line/10 px-2.5 py-0.5 text-[11px] text-secondary/60 transition-colors hover:border-primary/30 hover:text-secondary"
                >
                  {label}
                </button>
              ))}
              {hasFilters && (
                <button
                  onClick={() => {
                    applyPreset(null);
                    setQuery("");
                    setChannel("all");
                    setCustomerId("all");
                  }}
                  className="rounded-full border border-line/10 px-2.5 py-0.5 text-[11px] text-danger transition-colors hover:border-danger/40"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-secondary/40">
            {filtered.length} การสนทนา{filtered.length !== conversations.length ? ` จากทั้งหมด ${conversations.length}` : ""}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList sections={sections} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>
      <MessageThread conversationId={selectedId} />
    </div>
  );
}
