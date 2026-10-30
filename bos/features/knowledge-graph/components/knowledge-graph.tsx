"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Copy, Download, Plus, RefreshCw, ExternalLink } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/services/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/language-context";
import { cn } from "@/lib/utils";

/* ── Knowledge Graph ───────────────────────────────────────────────────────
   One map of everything the business knows: each node is a data domain
   (sized by how many rows it actually holds), each edge is a real relation
   between domains. The same structure is exported as JSON below (Copy /
   Download) so any future AI model can read the business's shape without
   scraping the UI — that's the point of this page: a stable, human-and-agent
   readable base to re-point new models at as the trend moves. ────────────── */

interface GraphNodeDef {
  id: string;
  label: { th: string; en: string };
  desc: { th: string; en: string };
  color: string;
  /** Tables counted for this domain (head-count, RLS-scoped). */
  tables: string[];
  /** Deep link into the app, when the domain has its own page. */
  page?: string;
}

interface GraphEdgeDef {
  from: string;
  to: string;
  rel: { th: string; en: string };
}

const HUB_ID = "snapshot";

const NODES: GraphNodeDef[] = [
  {
    id: HUB_ID,
    label: { th: "ภาพรวมธุรกิจ", en: "Business Snapshot" },
    desc: { th: "จุดสรุปรวมตัวเลขหลัก ๆ ของธุรกิจในที่เดียว", en: "The single spot where the business's headline numbers roll up" },
    color: "#a78bfa",
    tables: ["business_snapshot"],
    page: "/dashboard",
  },
  {
    id: "crm",
    label: { th: "ลูกค้า / CRM", en: "Customers & CRM" },
    desc: { th: "ข้อมูลลูกค้า นักเรียน และครู — หัวใจของทุกข้อมูลอื่น", en: "Students, customers and teachers — the spine every other dataset hangs off" },
    color: "#8b5cf6",
    tables: ["customers", "teachers"],
    page: "/students",
  },
  {
    id: "sales",
    label: { th: "Pipeline การขาย", en: "Sales Pipeline" },
    desc: { th: "สถานะการขาย ประวัติการสนทนาปิดการขาย", en: "Deal stages and the conversation history behind each close" },
    color: "#6366f1",
    tables: ["sales_status_history", "sales_chat_examples"],
    page: "/sales",
  },
  {
    id: "booking",
    label: { th: "การจอง / ปฏิทิน", en: "Bookings & Calendar" },
    desc: { th: "ตารางเรียน การจอง และปฏิทิน Google ที่เชื่อมไว้", en: "Lesson bookings plus the connected Google Calendars" },
    color: "#3b82f6",
    tables: ["bookings", "google_calendar_connections"],
    page: "/calendar",
  },
  {
    id: "course",
    label: { th: "คอร์ส / บทเรียน", en: "Courses & Lessons" },
    desc: { th: "คอร์สเรียนทั้งหมดของสตูดิโอ", en: "Every course the studio runs" },
    color: "#06b6d4",
    tables: ["courses"],
  },
  {
    id: "knowledge",
    label: { th: "คลังความรู้", en: "Knowledge Base" },
    desc: { th: "เอกสาร RAG บทความ และนโยบายที่ AI ใช้อ้างอิง", en: "The RAG documents, articles and policies the AI answers from" },
    color: "#f59e0b",
    tables: ["knowledge_documents", "knowledge_chunks", "articles", "company_policies", "course_articles"],
    page: "/knowledge",
  },
  {
    id: "chat",
    label: { th: "บทสนทนา", en: "Conversations" },
    desc: { th: "แชท LINE/เว็บทั้งหมดพร้อมข้อความย่อย", en: "Every LINE/web thread and its messages" },
    color: "#ec4899",
    tables: ["conversations", "messages"],
    page: "/chat",
  },
  {
    id: "ai",
    label: { th: "เอเจนต์ & อัตโนมัติ", en: "AI Agents & Automation" },
    desc: { th: "กฎอัตโนมัติ รอบการทำงานของเอเจนต์ และบันทึกการใช้ AI", en: "Automation rules, agent workflow runs and the AI usage log" },
    color: "#d946ef",
    tables: ["automation_rules", "agent_workflow_runs", "agent_schedules", "ai_usage_log"],
    page: "/automation",
  },
  {
    id: "finance",
    label: { th: "การเงิน", en: "Finance" },
    desc: { th: "รายรับรายจ่าย ใบเสร็จ และการชำระเงิน", en: "Income, expenses, receipts and payments" },
    color: "#22c55e",
    tables: ["transactions", "payments", "receipts"],
    page: "/accounting",
  },
  {
    id: "marketing",
    label: { th: "การตลาด / คอนเทนต์", en: "Marketing & Content" },
    desc: { th: "โพสต์โซเชียล ปฏิทินคอนเทนต์ และรูปที่สร้าง", en: "Social posts, the content calendar and generated images" },
    color: "#f97316",
    tables: ["social_posts", "social_accounts", "content_calendar", "generated_images"],
    page: "/marketing-dashboard",
  },
  {
    id: "strategy",
    label: { th: "กลยุทธ์ & คู่แข่ง", en: "Strategy & Intel" },
    desc: { th: "ห้องกลยุทธ์ การวิเคราะห์คู่แข่ง และเทรนด์โซเชียล", en: "Strategy sessions, competitor analyses and social trends" },
    color: "#f43f5e",
    tables: ["strategy_sessions", "competitor_analyses", "social_trend_manual_items"],
    page: "/strategy",
  },
  {
    id: "system",
    label: { th: "ระบบ & การแจ้งเตือน", en: "System & Alerts" },
    desc: { th: "เหตุการณ์ระบบ การแจ้งเตือน และ audit log", en: "System events, notifications and the audit trail" },
    color: "#94a3b8",
    tables: ["system_events", "notifications", "audit_log"],
    page: "/system-health",
  },
];

const EDGES: GraphEdgeDef[] = [
  { from: "crm", to: "booking", rel: { th: "จองบทเรียน", en: "creates bookings" } },
  { from: "crm", to: "course", rel: { th: "ลงทะเบียนเรียน", en: "enrolled in" } },
  { from: "crm", to: "chat", rel: { th: "คุยกับ AI", en: "talks with the AI" } },
  { from: "crm", to: "sales", rel: { th: "อยู่ใน pipeline ขาย", en: "enters the pipeline" } },
  { from: "crm", to: "finance", rel: { th: "ชำระเงิน", en: "pays" } },
  { from: "crm", to: HUB_ID, rel: { th: "สรุปในภาพรวม", en: "summarized in snapshot" } },
  { from: "booking", to: "course", rel: { th: "จองเพื่อคอร์ส", en: "booking is for a course" } },
  { from: "booking", to: "finance", rel: { th: "เรียกเก็บเงิน", en: "billed" } },
  { from: "course", to: "knowledge", rel: { th: "สอนจากคลังความรู้", en: "taught from the knowledge base" } },
  { from: "knowledge", to: "chat", rel: { th: "อ้างอิงคำตอบ AI (RAG)", en: "grounds AI answers (RAG)" } },
  { from: "knowledge", to: "ai", rel: { th: "ป้อนเอเจนต์ AI", en: "feeds the AI agents" } },
  { from: "knowledge", to: "strategy", rel: { th: "สนับสนุนกลยุทธ์", en: "informs strategy" } },
  { from: "knowledge", to: "marketing", rel: { th: "ข้อความจากคลัง", en: "copy comes from the base" } },
  { from: "chat", to: "ai", rel: { th: "ให้ระบบอัตโนมัติดูแล", en: "handled by automation" } },
  { from: "chat", to: "sales", rel: { th: "คัดกรอง lead", en: "qualifies leads" } },
  { from: "ai", to: "system", rel: { th: "บันทึกการทำงาน/เหตุการณ์", en: "writes runs & events" } },
  { from: "marketing", to: "sales", rel: { th: "สร้าง lead", en: "generates leads" } },
  { from: "marketing", to: HUB_ID, rel: { th: "สรุปในภาพรวม", en: "summarized in snapshot" } },
  { from: "strategy", to: "marketing", rel: { th: "กำหนดแคมเปญ", en: "guides campaigns" } },
  { from: "strategy", to: "sales", rel: { th: "กำหนดกลยุทธ์ขาย", en: "sets sales plays" } },
  { from: "finance", to: HUB_ID, rel: { th: "สรุปในภาพรวม", en: "summarized in snapshot" } },
];

const TABLE_LIST: string[] = [...new Set(NODES.flatMap((n) => n.tables))];

const COPY = {
  th: {
    title: "กราฟองค์ความรู้ธุรกิจ",
    subtitle: "แผนผังข้อมูลทั้งหมดของธุรกิจ — คนดูเป็นภาพ อ่านเป็น JSON คัดลอกไปป้อนโมเดล AI ตัวไหนก็ได้ในอนาคต",
    refreshed: "อัปเดต",
    refresh: "รีเฟรช",
    overview: "ภาพรวมข้อมูล",
    domains: "หมวดข้อมูล",
    tableCount: "ตาราง",
    knownRows: "แถวข้อมูลที่นับได้",
    connections: "การเชื่อมโยง",
    addKnowledge: "เพิ่มข้อมูล & องค์ความรู้",
    copyJson: "คัดลอก JSON ให้ AI",
    copied: "คัดลอกแล้ว!",
    downloadJson: "ดาวน์โหลด",
    catalog: "คลังข้อมูล (Data Catalog)",
    catalogHint: "แต่ละหมวดบอกว่ามีตารางอะไร มากน้อยแค่ไหน และเชื่อมกับส่วนไหน — วางให้ AI ตัวไหนอ่านก็ได้",
    detailTitle: "รายละเอียด",
    tablesLabel: "ตารางในหมวดนี้",
    rowsLabel: "แถว",
    connectionsLabel: "เชื่อมกับ",
    openPage: "เปิดหน้า",
    noConnections: "ไม่มีการเชื่อมโยง",
    tapHint: "แตะจุดบนแผนผัง หรือรายการด้านล่าง เพื่อดูรายละเอียด",
    unknown: "ยังนับไม่ได้",
    sumNote: "นับจากตารางที่เข้าถึงได้",
  },
  en: {
    title: "Business Knowledge Graph",
    subtitle: "Map of every dataset in the business — visual for people, JSON for machines. Copy it into any future AI model.",
    refreshed: "Updated",
    refresh: "Refresh",
    overview: "Data overview",
    domains: "Domains",
    tableCount: "Tables",
    knownRows: "Rows counted",
    connections: "Connections",
    addKnowledge: "Add data & knowledge",
    copyJson: "Copy JSON for AI",
    copied: "Copied!",
    downloadJson: "Download",
    catalog: "Data Catalog",
    catalogHint: "Each domain lists its tables, row counts and relations — hand it to any AI model as-is",
    detailTitle: "Details",
    tablesLabel: "Tables in this domain",
    rowsLabel: "rows",
    connectionsLabel: "Connected to",
    openPage: "Open page",
    noConnections: "No connections",
    tapHint: "Tap a node or a list row to see its connections",
    unknown: "unavailable",
    sumNote: "summed over reachable tables",
  },
} as const;

/* ── physics ───────────────────────────────────────────────────────────── */

interface SimNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const REPULSION = 5200;
const SPRING_K = 0.014;
const GRAVITY = 0.011;
const DAMPING = 0.86;
const PAD = 36;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function springLength(w: number, h: number): number {
  return clamp(Math.min(w, h) * 0.27, 92, 172);
}

function initPositions(w: number, h: number): Record<string, SimNode> {
  const cx = w / 2;
  const cy = h / 2;
  const ring = Math.max(60, Math.min(w, h) * 0.34);
  const m = NODES.length - 1; // everything except the hub
  const out: Record<string, SimNode> = {};
  NODES.forEach((n, i) => {
    if (n.id === HUB_ID) {
      out[n.id] = { x: cx, y: cy, vx: 0, vy: 0 };
      return;
    }
    const j = i - 1;
    const ang = (j / m) * Math.PI * 2 - Math.PI / 2;
    // deterministic spread — no Math.random, so tests and reloads agree
    const jitter = 0.8 + (((j * 2654435761) % 997) / 997) * 0.4;
    out[n.id] = { x: cx + Math.cos(ang) * ring * jitter, y: cy + Math.sin(ang) * ring * jitter, vx: 0, vy: 0 };
  });
  return out;
}

function simulate(pos: Record<string, SimNode>, w: number, h: number, alpha: number, dragged: string | null): void {
  const cx = w / 2;
  const cy = h / 2;
  const target = springLength(w, h);
  const lo = Math.min(PAD, w - PAD);
  const hi = Math.max(PAD, w - PAD);
  const loY = Math.min(PAD, h - PAD);
  const hiY = Math.max(PAD, h - PAD);

  // pairwise repulsion (n is small — 13 — so O(n²) is nothing)
  for (let i = 0; i < NODES.length; i++) {
    const na = NODES[i];
    const a = na ? pos[na.id] : undefined;
    if (!na || !a) continue;
    for (let j = i + 1; j < NODES.length; j++) {
      const nb = NODES[j];
      const b = nb ? pos[nb.id] : undefined;
      if (!nb || !b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        dx = ((i * 31 + j * 17) % 13) - 6 || 4;
        dy = ((i * 17 + j * 7) % 11) - 5 || 3;
        d2 = dx * dx + dy * dy;
      }
      const f = (REPULSION / Math.max(d2, 400)) * alpha;
      const d = Math.sqrt(d2);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  // springs along the real relations
  for (const e of EDGES) {
    const a = pos[e.from];
    const b = pos[e.to];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) continue;
    const f = SPRING_K * (d - target) * alpha;
    a.vx += (dx / d) * f;
    a.vy += (dy / d) * f;
    b.vx -= (dx / d) * f;
    b.vy -= (dy / d) * f;
  }

  // settle toward the centre, integrate, clamp
  for (const n of NODES) {
    const p = pos[n.id];
    if (!p) continue;
    p.vx += (cx - p.x) * GRAVITY * alpha;
    p.vy += (cy - p.y) * GRAVITY * alpha;
    if (dragged === n.id) {
      p.vx = 0;
      p.vy = 0;
      continue;
    }
    p.vx *= DAMPING;
    p.vy *= DAMPING;
    p.x = clamp(p.x + p.vx, lo, hi);
    p.y = clamp(p.y + p.vy, loY, hiY);
  }
}

function scheduleRaf(fn: FrameRequestCallback): number {
  return typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(fn) : (setTimeout(fn, 32) as unknown as number);
}

function cancelRaf(id: number): void {
  if (typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(id);
  else clearTimeout(id);
}

/** Node radius from row count: log scale so a 40-row table is still visible next to a 40k one. */
function nodeRadius(rows: number | null): number {
  if (rows == null) return 16;
  const decades = Math.min(Math.log10(1 + rows), 4.5);
  return 15 + (decades / 4.5) * 17;
}

/* ── component ─────────────────────────────────────────────────────────── */

export function KnowledgeGraph() {
  const { lang } = useLang();
  const c = lang === "th" ? COPY.th : COPY.en;
  const nf = useMemo(() => new Intl.NumberFormat(lang === "th" ? "th-TH" : "en-US"), [lang]);

  const [counts, setCounts] = useState<Record<string, number | null> | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setCounts(null);
    // Dynamic table list — head-counts only (no rows), RLS still decides
    // what's visible; a blocked table just shows as "unknown" below.
    const db = createClient() as SupabaseClient;
    const results = await Promise.all(
      TABLE_LIST.map(async (t) => {
        try {
          // PostgrestBuilder is PromiseLike only (no .catch) — await + try/catch.
          const r = await db.from(t).select("*", { count: "exact", head: true });
          return [t, r.error ? null : (r.count ?? 0)] as const;
        } catch {
          return [t, null] as const;
        }
      })
    );
    setCounts(Object.fromEntries(results));
    setFetchedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [load]);

  /* per-domain row totals (partial counts tolerated) */
  const domainRows = useMemo(() => {
    const out: Record<string, { known: number; unknown: number }> = {};
    for (const n of NODES) {
      let known = 0;
      let unknown = 0;
      for (const t of n.tables) {
        const v = counts?.[t];
        if (v == null) unknown++;
        else known += v;
      }
      out[n.id] = { known, unknown };
    }
    return out;
  }, [counts]);

  const totals = useMemo(() => {
    let knownRows = 0;
    let knownTables = 0;
    if (counts) {
      for (const t of TABLE_LIST) {
        const v = counts[t];
        if (v != null) {
          knownRows += v;
          knownTables++;
        }
      }
    }
    return { knownRows, knownTables };
  }, [counts]);

  /* ── graph container sizing ── */
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── simulation loop ── */
  const posRef = useRef<Record<string, SimNode>>({});
  const prevSizeRef = useRef<{ w: number; h: number } | null>(null);
  const alphaRef = useRef(1);
  const dragRef = useRef<string | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const kickRef = useRef<(() => void) | null>(null);
  const [, setFrame] = useState(0);

  useEffect(() => {
    if (!size) return;
    const prev = prevSizeRef.current;
    if (!prev) {
      posRef.current = initPositions(size.w, size.h);
    } else if (prev.w > 0 && prev.h > 0 && (prev.w !== size.w || prev.h !== size.h)) {
      const sx = size.w / prev.w;
      const sy = size.h / prev.h;
      for (const n of NODES) {
        const p = posRef.current[n.id];
        if (!p) continue;
        p.x *= sx;
        p.y *= sy;
        p.vx = 0;
        p.vy = 0;
      }
    } else {
      return; // same size — nothing to redo
    }
    prevSizeRef.current = size;
    alphaRef.current = 1;

    let stopped = false;
    let raf: number | null = null;
    const tick = () => {
      raf = null;
      if (stopped) return;
      simulate(posRef.current, size.w, size.h, alphaRef.current, dragRef.current);
      alphaRef.current *= 0.98;
      setFrame((f) => f + 1);
      if (alphaRef.current > 0.02 || dragRef.current !== null) raf = scheduleRaf(tick);
    };
    kickRef.current = () => {
      if (!stopped && raf === null) raf = scheduleRaf(tick);
    };
    raf = scheduleRaf(tick);

    return () => {
      stopped = true;
      if (raf !== null) cancelRaf(raf);
      kickRef.current = null;
    };
  }, [size]);

  const startDrag = useCallback((id: string, e: React.PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = id;
    rectRef.current = svgRef.current?.getBoundingClientRect() ?? null;
    setSelected(id);
    alphaRef.current = Math.max(alphaRef.current, 0.5);
    kickRef.current?.();
  }, []);

  const moveDrag = useCallback((id: string, e: React.PointerEvent<SVGCircleElement>) => {
    if (dragRef.current !== id) return;
    const rect = rectRef.current;
    const p = posRef.current[id];
    if (!rect || !p) return;
    p.x = e.clientX - rect.left;
    p.y = e.clientY - rect.top;
    p.vx = 0;
    p.vy = 0;
    alphaRef.current = Math.max(alphaRef.current, 0.35);
    kickRef.current?.();
    setFrame((f) => f + 1);
  }, []);

  const endDrag = useCallback(() => {
    if (dragRef.current === null) return;
    dragRef.current = null;
    alphaRef.current = Math.max(alphaRef.current, 0.4);
    kickRef.current?.();
  }, []);

  /* ── selection ── */
  const neighborIds = useMemo(() => {
    if (!selected) return null;
    const s = new Set<string>([selected]);
    for (const e of EDGES) {
      if (e.from === selected) s.add(e.to);
      if (e.to === selected) s.add(e.from);
    }
    return s;
  }, [selected]);

  const selectedNode = selected ? NODES.find((n) => n.id === selected) ?? null : null;
  const selectedEdges = selected ? EDGES.filter((e) => e.from === selected || e.to === selected) : [];

  /* ── JSON catalog (the machine-readable half) ── */
  const catalogJson = useMemo(
    () =>
      JSON.stringify(
        {
          schema: "tiga-agent.data-catalog/v1",
          app: "TIGA Agent",
          generatedAt: fetchedAt,
          note: "Live row counts are head-counts under row-level security; null = not visible to the requesting role.",
          totals: {
            domains: NODES.length,
            tables: TABLE_LIST.length,
            tablesCounted: totals.knownTables,
            rowsCounted: totals.knownRows,
            connections: EDGES.length,
          },
          domains: NODES.map((n) => ({
            id: n.id,
            label: n.label,
            description: n.desc,
            page: n.page ?? null,
            rows: domainRows[n.id]?.known ?? null,
            tables: n.tables.map((t) => ({ name: t, rows: counts?.[t] ?? null })),
          })),
          connections: EDGES.map((e) => ({ from: e.from, to: e.to, relation: e.rel })),
        },
        null,
        2
      ),
    [counts, domainRows, fetchedAt, totals.knownRows, totals.knownTables]
  );

  const copyJson = useCallback(() => {
    const done = () => {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
    };
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = catalogJson;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        done();
      } finally {
        ta.remove();
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(catalogJson).then(done).catch(fallback);
    } else {
      fallback();
    }
  }, [catalogJson]);

  const downloadJson = useCallback(() => {
    const blob = new Blob([catalogJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tiga-data-catalog.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [catalogJson]);

  const fmtRows = (v: number | null | undefined): string => (v == null ? c.unknown : nf.format(v));

  const fmtTime = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso.slice(0, 16).replace("T", " ");
    }
  };

  const labelOf = (n: GraphNodeDef): string => (lang === "th" ? n.label.th : n.label.en);
  const descOf = (n: GraphNodeDef): string => (lang === "th" ? n.desc.th : n.desc.en);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-secondary dark:text-white">{c.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary/50 dark:text-white/50">{c.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {fetchedAt ? (
            <span className="text-xs text-secondary/40 dark:text-white/40">
              {c.refreshed}: {fmtTime(fetchedAt)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={counts === null}
            className="inline-flex items-center gap-2 rounded-xl border border-line/10 bg-white px-3 py-2 text-sm font-medium text-secondary/70 transition-colors hover:text-secondary disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-white"
          >
            <RefreshCw className={cn("h-4 w-4", counts === null && "animate-spin")} />
            {c.refresh}
          </button>
          {/* Add-data CTA — sits at the right end of the refresh row. Opens the
              dedicated input page (text or any file type) whose saves land in
              this graph's คลังความรู้ domain. */}
          <Link
            href="/knowledge-graph/add"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-gradient px-3 py-2 text-sm font-semibold text-white shadow-glow transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {c.addKnowledge}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── graph card ── */}
        <div className="rounded-2xl border border-line/10 bg-white p-3 shadow-card lg:col-span-2 dark:border-white/10 dark:bg-[#0d1017]">
          <div ref={wrapRef} className="relative h-[420px] w-full sm:h-[480px] md:h-[560px]">
            {counts === null ? (
              <Skeleton className="absolute inset-2 bg-white/5" />
            ) : size ? (
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                className="block select-none"
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) setSelected(null);
                }}
              >
                {/* edges */}
                <g className="pointer-events-none">
                  {EDGES.map((e) => {
                    const a = posRef.current[e.from];
                    const b = posRef.current[e.to];
                    const fromNode = NODES.find((n) => n.id === e.from);
                    if (!a || !b || !fromNode) return null;
                    const active = selected === e.from || selected === e.to;
                    const dim = selected !== null && !active;
                    return (
                      <line
                        key={`${e.from}-${e.to}`}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={fromNode.color}
                        strokeWidth={active ? 1.9 : 1.1}
                        strokeLinecap="round"
                        opacity={active ? 0.95 : dim ? 0.07 : 0.24}
                      />
                    );
                  })}
                </g>
                {/* nodes */}
                {NODES.map((n) => {
                  const p = posRef.current[n.id];
                  if (!p) return null;
                  const r = nodeRadius(domainRows[n.id]?.known ?? null);
                  const connected = !neighborIds || neighborIds.has(n.id);
                  const isSel = selected === n.id;
                  return (
                    <g key={n.id} opacity={connected ? 1 : 0.3} className="cursor-grab active:cursor-grabbing">
                      {isSel ? <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={n.color} strokeWidth={2} opacity={0.85} /> : null}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={r}
                        fill={n.color}
                        onPointerDown={(e) => startDrag(n.id, e)}
                        onPointerMove={(e) => moveDrag(n.id, e)}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onLostPointerCapture={endDrag}
                        style={{ touchAction: "none" }}
                      >
                        <title>{`${labelOf(n)} — ${fmtRows(domainRows[n.id]?.known ?? null)} ${c.rowsLabel}`}</title>
                      </circle>
                      <text
                        x={p.x}
                        y={p.y + r + 14}
                        textAnchor="middle"
                        className="pointer-events-none fill-secondary/75 text-[11.5px] font-medium dark:fill-white/75"
                        style={{ paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 3.5, strokeLinejoin: "round" }}
                      >
                        {labelOf(n)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : null}
          </div>

          {/* legend / tap-to-select */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
            {NODES.map((n) => (
              <button
                key={n.id}
                type="button"
                aria-pressed={selected === n.id}
                onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
                  selected === n.id
                    ? "bg-line/10 text-secondary dark:bg-white/10 dark:text-white"
                    : "text-secondary/50 hover:text-secondary/80 dark:text-white/50 dark:hover:text-white/80"
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: n.color }} />
                {labelOf(n)}
              </button>
            ))}
            <span className="w-full text-[11px] text-secondary/35 dark:text-white/35 sm:w-auto">{c.tapHint}</span>
          </div>
        </div>

        {/* ── side panel: detail or overview ── */}
        <div className="rounded-2xl border border-line/10 bg-white p-4 shadow-card dark:border-white/10 dark:bg-[#0d1017]">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: selectedNode.color }} />
                <h2 className="text-lg font-bold text-secondary dark:text-white">{labelOf(selectedNode)}</h2>
              </div>
              <p className="text-sm leading-relaxed text-secondary/55 dark:text-white/55">{descOf(selectedNode)}</p>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary/35 dark:text-white/35">{c.tablesLabel}</p>
                <ul className="space-y-1.5">
                  {selectedNode.tables.map((t) => (
                    <li key={t} className="flex items-center justify-between gap-3 rounded-lg bg-line/[0.04] px-2.5 py-1.5 text-sm dark:bg-white/[0.04]">
                      <code className="truncate text-secondary/70 dark:text-white/70">{t}</code>
                      <span className="shrink-0 tabular-nums text-secondary/55 dark:text-white/55">{fmtRows(counts?.[t])}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary/35 dark:text-white/35">{c.connectionsLabel}</p>
                {selectedEdges.length ? (
                  <ul className="space-y-1.5">
                    {selectedEdges.map((e) => {
                      const otherId = e.from === selectedNode.id ? e.to : e.from;
                      const other = NODES.find((n) => n.id === otherId);
                      if (!other) return null;
                      return (
                        <li key={`${e.from}-${e.to}`}>
                          <button
                            type="button"
                            onClick={() => setSelected(otherId)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-secondary/65 transition-colors hover:bg-line/5 dark:text-white/65 dark:hover:bg-white/5"
                          >
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: other.color }} />
                            <span className="truncate">{labelOf(other)}</span>
                            <span className="ml-auto shrink-0 text-[11px] text-secondary/40 dark:text-white/40">
                              {lang === "th" ? e.rel.th : e.rel.en}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-secondary/40 dark:text-white/40">{c.noConnections}</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                {selectedNode.page ? (
                  <Link
                    href={selectedNode.page}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:underline dark:text-purple-300"
                  >
                    {c.openPage} <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-line/10 px-2.5 py-1 text-xs text-secondary/50 hover:text-secondary dark:border-white/10 dark:text-white/50 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-secondary dark:text-white">{c.overview}</h2>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-line/[0.04] p-3 dark:bg-white/[0.04]">
                  <dt className="text-[11px] uppercase tracking-wider text-secondary/40 dark:text-white/40">{c.domains}</dt>
                  <dd className="text-xl font-bold tabular-nums text-secondary dark:text-white">{NODES.length}</dd>
                </div>
                <div className="rounded-xl bg-line/[0.04] p-3 dark:bg-white/[0.04]">
                  <dt className="text-[11px] uppercase tracking-wider text-secondary/40 dark:text-white/40">{c.tableCount}</dt>
                  <dd className="text-xl font-bold tabular-nums text-secondary dark:text-white">
                    {totals.knownTables}
                    <span className="text-sm font-normal text-secondary/40 dark:text-white/40">/{TABLE_LIST.length}</span>
                  </dd>
                </div>
                <div className="rounded-xl bg-line/[0.04] p-3 dark:bg-white/[0.04]">
                  <dt className="text-[11px] uppercase tracking-wider text-secondary/40 dark:text-white/40">{c.knownRows}</dt>
                  <dd className="text-xl font-bold tabular-nums text-secondary dark:text-white">{nf.format(totals.knownRows)}</dd>
                </div>
                <div className="rounded-xl bg-line/[0.04] p-3 dark:bg-white/[0.04]">
                  <dt className="text-[11px] uppercase tracking-wider text-secondary/40 dark:text-white/40">{c.connections}</dt>
                  <dd className="text-xl font-bold tabular-nums text-secondary dark:text-white">{EDGES.length}</dd>
                </div>
              </dl>
              <p className="text-xs leading-relaxed text-secondary/40 dark:text-white/40">
                {c.catalogHint}. ({c.sumNote})
              </p>
              <p className="text-xs text-secondary/40 dark:text-white/40">{c.tapHint}</p>
            </div>
          )}
        </div>

        {/* ── data catalog ── */}
        <div className="rounded-2xl border border-line/10 bg-white p-4 shadow-card lg:col-span-3 dark:border-white/10 dark:bg-[#0d1017]">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-secondary dark:text-white">{c.catalog}</h2>
              <p className="text-xs text-secondary/45 dark:text-white/45">{c.catalogHint}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={copyJson}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-gradient px-3 py-2 text-sm font-semibold text-white shadow-glow transition-opacity hover:opacity-90"
              >
                <Copy className="h-4 w-4" />
                {copied ? c.copied : c.copyJson}
              </button>
              <button
                type="button"
                onClick={downloadJson}
                className="inline-flex items-center gap-2 rounded-xl border border-line/10 px-3 py-2 text-sm font-medium text-secondary/70 hover:text-secondary dark:border-white/10 dark:text-white/70 dark:hover:text-white"
              >
                <Download className="h-4 w-4" />
                {c.downloadJson}
              </button>
            </div>
          </div>

          {counts === null ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 bg-white/5" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-line/10 dark:divide-white/5">
              {NODES.map((n) => {
                const rows = domainRows[n.id];
                return (
                  <li key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <button
                      type="button"
                      onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: n.color }} />
                      <span className="truncate text-sm font-semibold text-secondary dark:text-white">{labelOf(n)}</span>
                      <span className="hidden truncate text-xs text-secondary/40 dark:text-white/40 sm:inline">{descOf(n)}</span>
                    </button>
                    <span className="shrink-0 text-xs tabular-nums text-secondary/50 dark:text-white/50">
                      {n.tables.length} {c.tableCount.toLowerCase()} · {fmtRows(rows?.known ?? null)} {c.rowsLabel}
                      {rows?.unknown ? ` +${rows.unknown}?` : ""}
                    </span>
                    {n.page ? (
                      <Link
                        href={n.page}
                        className="shrink-0 text-xs font-medium text-purple-600 hover:underline dark:text-purple-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.openPage} →
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
