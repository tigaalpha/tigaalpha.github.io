import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

interface CompetitorEntry {
  name: string;
  type: "direct" | "indirect";
  category: string;
  marketingChannels: string[];
  notes: string;
}

interface StrategyEntry {
  approach: "compete" | "avoid";
  title: string;
  description: string;
}

/**
 * Formats the most recent row from competitor_analyses (the Competitor
 * Analysis page) as a compact text block, for AI callers that give business
 * strategy advice -- the Strategy Room (strategy-ask) and TIGA AI AGENT
 * (chat-core.ts, owner/internal channel only) -- so every advisor grounds
 * competitive-strategy answers in the same real, AI-researched competitor
 * data instead of speaking generically. Returns null when no analysis has
 * been run yet, so callers can skip the block entirely.
 */
export async function getLatestCompetitorContext(db: SupabaseClient): Promise<string | null> {
  const { data } = await db
    .from("competitor_analyses")
    .select("summary, competitors, strategies, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const competitors = (data.competitors ?? []) as CompetitorEntry[];
  const strategies = (data.strategies ?? []) as StrategyEntry[];
  const direct = competitors.filter((c) => c.type === "direct");
  const indirect = competitors.filter((c) => c.type === "indirect");
  const compete = strategies.filter((s) => s.approach === "compete");
  const avoid = strategies.filter((s) => s.approach === "avoid");

  const formatCompetitor = (c: CompetitorEntry) =>
    `- ${c.name} (${c.category}) — channels: ${c.marketingChannels.join(", ") || "ไม่พบข้อมูล"} — ${c.notes}`;
  const formatStrategy = (s: StrategyEntry) => `- ${s.title}: ${s.description}`;

  return [
    `## Latest competitor analysis (from the Competitor Analysis page, run on ${new Date(data.created_at).toISOString().slice(0, 10)})`,
    data.summary,
    "",
    "Direct competitors (piano schools/studios in Thailand):",
    ...(direct.length > 0 ? direct.map(formatCompetitor) : ["- none found"]),
    "",
    "Indirect competitors (global piano-learning apps):",
    ...(indirect.length > 0 ? indirect.map(formatCompetitor) : ["- none found"]),
    "",
    "Already-identified moves to compete head-to-head:",
    ...(compete.length > 0 ? compete.map(formatStrategy) : ["- none yet"]),
    "",
    "Already-identified moves to avoid competing on directly:",
    ...(avoid.length > 0 ? avoid.map(formatStrategy) : ["- none yet"]),
  ].join("\n");
}
