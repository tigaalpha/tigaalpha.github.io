"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { aggregateByMonth, formatBaht, type MonthlyPoint } from "@/lib/finance";

const GRID = "rgba(148, 163, 184, 0.08)";
const TICK = "rgba(226, 232, 240, 0.4)";

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#12141d] px-3 py-2 text-xs shadow-card">
      <p className="mb-0.5 font-medium text-secondary/50">{label}</p>
      <p className="font-semibold text-purple-300">{formatBaht(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

export function RevenueOverviewCard() {
  const [monthly, setMonthly] = useState<MonthlyPoint[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1);
    repos.transactions.listBetween(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)).then((transactions) => {
      setMonthly(aggregateByMonth(transactions, start, end));
    });
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Revenue Overview</CardTitle>
        <span className="rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-xs text-secondary/45">This Year</span>
      </CardHeader>
      <CardContent>
        {!monthly ? (
          <div className="h-64 animate-pulse rounded-xl bg-white/[0.03]" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="monthLabel" stroke={TICK} fontSize={12} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis
                stroke={TICK}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}K`}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                fill="url(#revenueFill)"
                dot={false}
                activeDot={{ r: 4, fill: "#a78bfa", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
