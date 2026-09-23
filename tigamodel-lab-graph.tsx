import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { getTigamodel, initTigamodelWeb, ensureTigamodelWeb, getUniversitySources } from "./tigamodel/web.js";

/* ── tigamodel-lab-graph.tsx ──
   "แผนที่ความรู้ของโมเดล" — the sub-page the owner asked for (2026-09-17):
   shows what the TIGA piano-intelligence model actually knows, as
   (1) a linked bullet-point outline — domain → entries, each entry's real
       relations nested as sub-bullets (requires / improves / relates), and
   (2) an Obsidian-style force-directed graph on canvas: one node per KB
       entry, one edge per KB relation, domain-coloured, draggable, pinch/
       scroll zoom, tap to inspect. Tapping a node in EITHER view highlights
       its neighbourhood and shows its detail card.

   No dependency added: the force simulation is ~60 lines of canvas code
   (repulsion + springs + centreing), the same hand-rolled approach the
   repo already uses in arena-fx.tsx rather than pulling d3-force into the
   admin bundle. All colours read the app CSS variables (the same fix the
   Lab needed after the light-theme invisibility report). ── */

const TYPE_ICON = {
  fact: "📌", principle: "🧭", strategy: "🛠️", hypothesis: "❓",
  "expert-opinion": "🎓", uncertain: "🌫️", "source-required": "🔖",
};
const TYPE_COLOR = {
  fact: "#d97757", principle: "#7c6bd6", strategy: "#3f9d63", hypothesis: "#b8860b",
  "expert-opinion": "#4a6fa5", uncertain: "#8a8f98", "source-required": "#8a8f98",
};
const DOMAIN_COLOR = {
  pedagogy: "#d97757", harmony: "#7c6bd6", rhythm: "#3f9d63", technique: "#4a9edb",
  "sight-reading": "#e0a83c", jazz: "#c95d9e", "practice-science": "#2ea8a0",
};
const domainColor = (d) => DOMAIN_COLOR[d] || "#9aa3ad";
const EDGE_STYLE = {
  requires: { color: "#c4423a", dash: [] },
  improves: { color: "#3f9d63", dash: [] },
  relates: { color: "var(--bd3, #c8c4bd)", dash: [4, 3] },
};

/* ── collect the full node/edge set from the live KB ── */
export function collectGraph(tiga) {
  if (!tiga || !tiga.kb) return { nodes: [], edges: [] };
  const entries = Array.from(tiga.kb._entries.values());
  const ids = new Set(entries.map(e => e.id));
  const sources = (() => { try { return getUniversitySources().sources; } catch (e) { return {}; } })();
  const nodes = entries.map(e => ({
    id: e.id, title: e.title, body: e.body, type: e.type, domain: e.domain,
    confidence: e.confidence, source: e.source, sourceMeta: sources[e.source] || null,
    degree: 0,
  }));
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edges = [];
  (tiga.kb.relations || []).forEach(r => {
    if (!byId[r.from] || !byId[r.to]) return; // dangling relation → skip silently
    edges.push({ from: r.from, to: r.to, type: r.type || "relates", note: r.note || "" });
    byId[r.from].degree++; byId[r.to].degree++;
  });
  return { nodes, edges };
}

/* ── the canvas force graph ── */
function ForceGraph({ nodes, edges, focusId, setFocusId, S }) {
  const cvRef = useRef(null);
  const wrapRef = useRef(null);
  const sim = useRef(null); // { x,y,vx,vy,fx? per node } + running flag
  const view = useRef({ scale: 1, ox: 0, oy: 0 }); // pan/zoom (ox,oy in css px)
  const drag = useRef(null); // { idx, moved } | { pan: true, sx, sy, ox, oy }
  const hover = useRef(-1);
  const [, force] = useState(0);

  /* build sim state once per node-set */
  useEffect(() => {
    const W = 640, H = 480;
    sim.current = {
      W, H, alpha: 1,
      pts: nodes.map((n, i) => {
        const a = (i / nodes.length) * Math.PI * 2;
        return { x: W / 2 + Math.cos(a) * 180 + Math.sin(i * 7) * 24, y: H / 2 + Math.sin(a) * 170 + Math.cos(i * 5) * 24, vx: 0, vy: 0, fx: null, fy: null };
      }),
      running: true,
    };
    view.current = { scale: 1, ox: 0, oy: 0 };
    force(x => x + 1);
  }, [nodes]);

  /* animation + physics loop */
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const s = sim.current, cv = cvRef.current;
      if (s && cv) {
        const { pts, W, H } = s;
        if (s.running && s.alpha > 0.012) {
          s.alpha *= 0.995;
          // pairwise repulsion (O(n²) fine for ~40 nodes)
          for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
            const a = pts[i], b = pts[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let d2 = dx * dx + dy * dy || 1;
            if (d2 < 90000) {
              const f = 2200 / d2, d = Math.sqrt(d2);
              const fx = (dx / d) * f, fy = (dy / d) * f;
              a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
            }
          }
          // springs along edges
          const byId = Object.fromEntries(nodes.map((n, i) => [n.id, i]));
          edges.forEach(e => {
            const a = pts[byId[e.from]], b = pts[byId[e.to]];
            if (!a || !b) return;
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
            const f = (d - 120) * 0.012;
            const fx = (dx / d) * f, fy = (dy / d) * f;
            a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
          });
          pts.forEach((p, i) => {
            // centreing + degree-weighted pull (hubs sit more central, like Obsidian)
            p.vx += (W / 2 - p.x) * 0.0025; p.vy += (H / 2 - p.y) * 0.0025;
            p.x += p.vx = p.vx * 0.82; p.y += p.vy = p.vy * 0.82;
            if (p.fx != null) { p.x = p.fx; p.y = p.fy; }
          });
        }
        // draw
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const rect = cv.getBoundingClientRect();
        const cw = rect.width, ch = rect.height;
        if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
        const ctx = cv.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        const v = view.current;
        const tx = (x) => (x - W / 2) * v.scale + cw / 2 + v.ox;
        const ty = (y) => (y - H / 2) * v.scale + ch / 2 + v.oy;
        // edges
        const byId = Object.fromEntries(nodes.map((n, i) => [n.id, i]));
        edges.forEach(e => {
          const a = pts[byId[e.from]], b = pts[byId[e.to]];
          if (!a || !b) return;
          const hot = focusId && (e.from === focusId || e.to === focusId);
          const st = EDGE_STYLE[e.type] || EDGE_STYLE.relates;
          ctx.strokeStyle = st.color;
          ctx.globalAlpha = hot ? 0.95 : (focusId ? 0.12 : 0.5);
          ctx.lineWidth = hot ? 2 : 1.2;
          ctx.setLineDash(st.dash);
          ctx.beginPath(); ctx.moveTo(tx(a.x), ty(a.y)); ctx.lineTo(tx(b.x), ty(b.y)); ctx.stroke();
        });
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        // nodes
        pts.forEach((p, i) => {
          const n = nodes[i];
          const r = (5 + Math.min(6, n.degree * 1.2)) * v.scale;
          const isFocus = focusId === n.id;
          const dim = focusId && !isFocus;
          ctx.globalAlpha = dim ? 0.25 : 1;
          ctx.fillStyle = TYPE_COLOR[n.type] || domainColor(n.domain);
          ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), r, 0, Math.PI * 2); ctx.fill();
          if (isFocus) {
            ctx.strokeStyle = "var(--accent, #d97757)"; ctx.lineWidth = 2.5 * v.scale;
            ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), r + 3.5 * v.scale, 0, Math.PI * 2); ctx.stroke();
          }
          if (v.scale > 0.75 || isFocus || i === hover.current) {
            ctx.fillStyle = "var(--text, #333)";
            ctx.font = `${isFocus ? 700 : 500} ${Math.max(10, 11 * v.scale)}px -apple-system, system-ui, sans-serif`;
            ctx.textAlign = "center";
            const short = n.title.length > 34 ? n.title.slice(0, 33) + "…" : n.title;
            ctx.fillText(short, tx(p.x), ty(p.y) - r - 5);
          }
        });
        ctx.globalAlpha = 1;
        s.running = s.alpha > 0.012 || !!drag.current;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges, focusId]);

  /* pointer interactions: drag node / pan / tap focus / wheel+pinch zoom */
  const pick = useCallback((mx, my) => {
    const cv = cvRef.current, s = sim.current;
    if (!cv || !s) return -1;
    const rect = cv.getBoundingClientRect(), v = view.current;
    const W = s.W;
    for (let i = s.pts.length - 1; i >= 0; i--) {
      const p = s.pts[i];
      const px = (p.x - W / 2) * v.scale + rect.width / 2 + v.ox;
      const py = (p.y - W ? s.H : s.H / 2) * 0 + ((p.y - s.H / 2) * v.scale + rect.height / 2 + v.oy);
      const r = (5 + Math.min(6, nodes[i].degree * 1.2)) * v.scale + 8;
      if ((mx - px) * (mx - px) + (my - py) * (my - py) <= r * r) return i;
    }
    return -1;
  }, [nodes]);

  const onPointerDown = (e) => {
    const cv = cvRef.current; if (!cv || !sim.current) return;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const i = pick(mx, my);
    if (i >= 0) { // only capture the pointer when the gesture starts ON a node;
      // background touches keep native page scrolling (pan-y) alive.
      cv.setPointerCapture(e.pointerId);
      const p = sim.current.pts[i]; drag.current = { idx: i, moved: false }; p.fx = p.x; p.fy = p.y; sim.current.alpha = Math.max(sim.current.alpha, 0.35);
    } else if (e.pointerType === "mouse") {
      drag.current = { pan: true, sx: mx, sy: my, ox: view.current.ox, oy: view.current.oy };
    } else {
      drag.current = null;
    }
  };
  const onPointerMove = (e) => {
    const cv = cvRef.current; if (!cv || !sim.current || !drag.current) return;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (drag.current.pan) {
      view.current.ox = drag.current.ox + (mx - drag.current.sx);
      view.current.oy = drag.current.oy + (my - drag.current.sy);
      return;
    }
    if (drag.current.idx == null) return;
    const v = view.current, s = sim.current, p = s.pts[drag.current.idx];
    const dx = mx - ((p.x - s.W / 2) * v.scale + rect.width / 2 + v.ox);
    const dy = my - ((p.y - s.H / 2) * v.scale + rect.height / 2 + v.oy);
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
    p.fx = p.x + dx / v.scale; p.fy = p.y + dy / v.scale;
    p.x = p.fx; p.y = p.fy;
    sim.current.alpha = Math.max(sim.current.alpha, 0.3);
  };
  const onPointerUp = (e) => {
    const cv = cvRef.current; if (!cv || !drag.current) return;
    try { cv.releasePointerCapture(e.pointerId); } catch (err) {}
    if (drag.current.idx != null) {
      const p = sim.current.pts[drag.current.idx];
      if (!drag.current.moved) setFocusId(focusId === nodes[drag.current.idx].id ? null : nodes[drag.current.idx].id);
      p.fx = null; p.fy = null;
    }
    drag.current = null;
  };
  const onWheel = (e) => {
    e.preventDefault();
    const v = view.current;
    v.scale = Math.max(0.45, Math.min(3, v.scale * (e.deltaY < 0 ? 1.1 : 0.9)));
  };
  /* pinch */
  const pinch = useRef(null);
  const onTouchMove = (e) => {
    if (e.touches.length !== 2) return;
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (!pinch.current) { pinch.current = { d, scale: view.current.scale }; return; }
    view.current.scale = Math.max(0.45, Math.min(3, pinch.current.scale * (d / pinch.current.d)));
  };
  const onTouchEnd = () => { pinch.current = null; };

  return (
    <div ref={wrapRef} style={{ position: "relative", background: "var(--card2)", border: "1px solid var(--bd1)", borderRadius: 12, overflow: "hidden", touchAction: "pan-y" }}>
      {/* touchAction pan-y: one-finger drags stay vertical-page-scroll UNTIL they
          start on a node (pointerdown on the canvas node sets touch-action none
          via pointer capture); two-finger pinch still zooms the graph. Without
          this the wrapper ate every swipe and the page could not scroll past
          the graph on a phone. */}
      <canvas ref={cvRef} style={{ display: "block", width: "100%", height: 420, cursor: drag.current ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onWheel={onWheel} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
      <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", gap: 6 }}>
        <button aria-label="zoom in" style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 15 }} onClick={() => { view.current.scale = Math.min(3, view.current.scale * 1.2); }}>＋</button>
        <button aria-label="zoom out" style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 15 }} onClick={() => { view.current.scale = Math.max(0.45, view.current.scale / 1.2); }}>－</button>
        <button aria-label="reset" style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 12 }} onClick={() => { view.current = { scale: 1, ox: 0, oy: 0 }; }}>⌂</button>
      </div>
    </div>
  );
}

/* ── linked bullet-point outline (domain → entry → relations) ── */
function Outline({ nodes, edges, focusId, setFocusId, T, S }) {
  if (!S) return null; // styles prop missing → render nothing rather than crash the whole app
  const byDomain = useMemo(() => {
    const m = new Map();
    nodes.forEach(n => { if (!m.has(n.domain)) m.set(n.domain, []); m.get(n.domain).push(n); });
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [nodes]);
  const relsOf = useMemo(() => {
    const m = new Map();
    edges.forEach(e => {
      if (!m.has(e.from)) m.set(e.from, []);
      m.get(e.from).push({ other: e.to, type: e.type, note: e.note });
      if (e.type === "relates" || e.type === "requires") { // show the reverse too — these are mutual-readable
        if (!m.has(e.to)) m.set(e.to, []);
        m.get(e.to).push({ other: e.from, type: e.type + "-back", note: e.note });
      }
    });
    return m;
  }, [edges]);
  const REL_LABEL = {
    requires: (t) => T("ต้องมีก่อน: ", "requires: ", "先决条件："),
    "requires-back": (t) => T("เป็นรากฐานของ: ", "foundation for: ", "是…的基础："),
    improves: (t) => T("ช่วยพัฒนา: ", "improves: ", "提升："),
    "improves-back": (t) => T("ถูกพัฒนาโดย: ", "improved by: ", "被…提升："),
    relates: (t) => T("เกี่ยวข้องกับ: ", "relates to: ", "相关："),
    "relates-back": (t) => T("เกี่ยวข้องกับ: ", "relates to: ", "相关："),
  };

  return (
    <div>
      {byDomain.map(([dom, ns]) => (
        <div key={dom} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: domainColor(dom), display: "inline-block" }} />
            <b style={{ fontSize: 14, color: "var(--text)" }}>{dom}</b>
            <span style={{ ...S.mono }}>{T(ns.length + " รายการ", ns.length + " entries", ns.length + " 条")}</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 6, listStyle: "none" }}>
            {ns.map(n => {
              const rels = relsOf.get(n.id) || [];
              const open = focusId === n.id;
              return (
                <li key={n.id} style={{ marginBottom: 3 }}>
                  <button onClick={() => setFocusId(open ? null : n.id)}
                    style={{ display: "flex", gap: 7, alignItems: "baseline", textAlign: "left", border: "none", padding: "3px 4px", cursor: "pointer", width: "100%", borderRadius: 8, background: open ? "color-mix(in srgb, var(--accent, #d97757) 10%, transparent)" : "none" }}>
                    <span style={{ color: TYPE_COLOR[n.type] || "var(--text2)", fontSize: 12 }}>{TYPE_ICON[n.type] || "•"}</span>
                    <span style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.45 }}>{n.title}</span>
                    {rels.length > 0 && <span style={{ ...S.mono, marginLeft: "auto", whiteSpace: "nowrap" }}>↔ {rels.length}</span>}
                  </button>
                  {open && (
                    <div style={{ margin: "4px 0 8px 26px", borderLeft: "2px solid var(--bd2, #ddd)", paddingLeft: 10 }}>
                      <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>{n.body}</div>
                      {rels.length === 0 && <div style={{ ...S.mono, fontSize: 12 }}>{T("ยังไม่มีความเชื่อมโยง", "no links yet", "暂无关联")}</div>}
                      {rels.map((r, i) => {
                        const other = nodes.find(x => x.id === r.other);
                        if (!other) return null;
                        const mk = REL_LABEL[r.type] || REL_LABEL.relates;
                        return (
                          <div key={i} style={{ marginBottom: 3 }}>
                            <span style={{ ...S.mono }}>{mk()}</span>
                            <button onClick={() => setFocusId(r.other)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent, #4a6fa5)", fontSize: 13 }}>
                              {other.title} ↝
                            </button>
                            {r.note ? <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>{r.note}</div> : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── detail card for the focused node ── */
function DetailCard({ node, edges, nodes, setFocusId, T, S }) {
  const src = node.sourceMeta;
  const outs = edges.filter(e => e.from === node.id);
  const ins = edges.filter(e => e.to === node.id);
  return (
    <div style={{ ...S.card, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16 }}>{TYPE_ICON[node.type] || "•"}</span>
        <b style={{ fontSize: 15, color: "var(--text)" }}>{node.title}</b>
        <span style={{ ...S.chip(false), fontSize: 11, padding: "2px 8px" }}>{node.type}</span>
        <span style={{ ...S.chip(false), fontSize: 11, padding: "2px 8px" }}>{node.domain}</span>
        <button style={{ ...S.btnGhost, marginLeft: "auto", padding: "3px 10px", fontSize: 12 }} onClick={() => setFocusId(null)}>✕</button>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--text)", margin: "8px 0" }}>{node.body}</div>
      <div style={{ ...S.mono, marginBottom: 8 }}>
        confidence {node.confidence}
        {node.degree > 0 && <> · {T("เชื่อมโยง", "links", "关联")} {node.degree}</>}
      </div>
      {(outs.length > 0 || ins.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {outs.map((e, i) => {
            const o = nodes.find(x => x.id === e.to); if (!o) return null;
            return <button key={"o" + i} style={{ ...S.chip(e.type === "requires"), fontSize: 12 }} onClick={() => setFocusId(e.to)}>{e.type} → {o.title.slice(0, 30)}{o.title.length > 30 ? "…" : ""}</button>;
          })}
          {ins.map((e, i) => {
            const o = nodes.find(x => x.id === e.from); if (!o) return null;
            return <button key={"i" + i} style={{ ...S.chip(false), fontSize: 12 }} onClick={() => setFocusId(e.from)}>← {o.title.slice(0, 30)}{o.title.length > 30 ? "…" : ""}</button>;
          })}
        </div>
      )}
      {src ? (
        <a href={src.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "var(--accent, #4a6fa5)", wordBreak: "break-all" }}>
          🏛 {src.institution} · 🔗 {src.url}
        </a>
      ) : (
        <span style={{ ...S.mono, fontSize: 12 }}>{T("แหล่งที่มา: องค์ความรู้ต้นทางของ TIGA", "source: TIGA-original pedagogy", "来源：TIGA 原创教学法")}</span>
      )}
    </div>
  );
}

/* ── the exported sub-page ── */
export function KnowledgeGraphView({ lang = "th", S }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const [mode, setMode] = useState("graph"); // graph | outline
  const [focusId, setFocusId] = useState(null);
  // sync build on first render (found via owner screenshot 2026-09-17 17:34:
  // ensureTigamodelWeb() is ASYNC — returning its Promise here left tiga.kb
  // undefined and the map stuck on "Starting…" forever). initTigamodelWeb()
  // is the synchronous builder; the async session-token upgrade below only
  // re-registers the provider, it does not change the KB, so no re-render
  // is needed when it resolves.
  const [tiga, setTiga] = useState(() => { try { return initTigamodelWeb(); } catch (e) { return getTigamodel(); } });
  useEffect(() => { let alive = true; ensureTigamodelWeb().then(t => { if (alive && t && t !== tiga) setTiga(t); }).catch(() => {}); return () => { alive = false; }; }, []);
  const { nodes, edges } = useMemo(() => collectGraph(tiga), [tiga]);
  const focus = nodes.find(n => n.id === focusId) || null;

  if (!tiga || !tiga.kb) return <div style={S.card}>{T("กำลังเริ่มระบบ…", "Starting…", "启动中…")}</div>;

  const nUni = nodes.filter(n => n.sourceMeta).length;
  const nTiga = nodes.length - nUni;

  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
        {T(
          "ทุกองค์ความรู้ในโมเดลตอนนี้ — จุดวงกลมคือความรู้ 1 ชิ้น เส้นคือความเชื่อมโยง (แดง = ต้องมีก่อน, เขียว = ฝึกแล้วพัฒนา, เส้นประ = เกี่ยวข้องกัน) ลากจุดเพื่อจัดกราฟ ลากพื้นเพื่อเลื่อน สกรอบ/ถ่างนิ้วเพื่อซูม แตะจุดเพื่อดูรายละเอียด",
          "Everything the model knows right now — each dot is one knowledge entry, each line a real link (red = requires first, green = improves, dashed = related). Drag dots to rearrange, drag the background to pan, scroll/pinch to zoom, tap a dot to inspect.",
          "模型目前掌握的全部知识 — 圆点为知识条目，连线为真实关联（红=先决，绿=提升，虚线=相关）。拖动排列，滚动/双指缩放，点按查看详情。"
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <button style={S.chip(mode === "graph")} onClick={() => setMode("graph")}>🕸 {T("กราฟ", "Graph", "图谱")}</button>
        <button style={S.chip(mode === "outline")} onClick={() => setMode("outline")}>📋 {T("รายการแบบลิสต์", "Outline", "大纲")}</button>
        <span style={{ ...S.mono, marginLeft: "auto" }}>
          {nodes.length} {T("รายการ", "entries", "条")} · {edges.length} {T("เส้นเชื่อม", "links", "连线")} · 🏛 {nUni} · 🎹 {nTiga}
        </span>
      </div>
      {focus && <DetailCard node={focus} edges={edges} nodes={nodes} setFocusId={setFocusId} T={T} S={S} />}
      {mode === "graph"
        ? <ForceGraph nodes={nodes} edges={edges} focusId={focusId} setFocusId={setFocusId} S={S} />
        : <Outline nodes={nodes} edges={edges} focusId={focusId} setFocusId={setFocusId} T={T} S={S} />}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
        {Object.entries(TYPE_COLOR).map(([t, c]) => (
          <span key={t} style={{ fontSize: 11.5, color: "var(--muted)" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: c, marginRight: 4 }} />{t}
          </span>
        ))}
      </div>
    </div>
  );
}
