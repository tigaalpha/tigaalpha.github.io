/* ── campaign-funnel.ts ──
   Pure maths for the admin "funnel by campaign / browser / escape" card: raw
   usage_events rows in, one record per visitor and grouped funnel rows out.
   No React, no Supabase — it is tested by transpiling this very file
   (scripts/verify-campaign-funnel.mjs), not a copy of it.

   Why it exists: the 2026-10-02 users report could say how many visitors came
   from "fb", but not which campaign, which ad set, which creative, which landing
   variant, which browser, or from which country — and the one number that
   mattered most (79% of visitors arrive inside Facebook's or Instagram's own
   browser and sign up at 0.12% against 2.2% elsewhere) took a hand-written SQL
   session to find. The rows it reads:

     kind "land"  item_id: page:th|en|zh · view · hero:seen · piano · aha:heard ·
                  ask · gate:shown · gate:inapp · openreal-top · openreal ·
                  escape:arrived[-known]:<browser> · try:* · signup:* ·
                  signed_up_landing:<lg> · signed_up_from:<anon_id>
     kind "attr"  item_id: first;s=fb;m=…;c=<campaign>;k=<creative>;t=<ad set>;
                  v=<variant>;lg=th;tz=Asia/Bangkok;nl=th-TH;oua=<origin browser>
                  (local-identity.attributionEvent)                              */

export type Visitor = {
  id: string;
  ua: string;        // the browser kind of the FIRST row this visitor ever wrote
  src: string;
  lg: string;        // landing language: page:xx, else the attr row's lg
  c: string; k: string; t: string; m: string; v: string; tz: string; oua: string;
  viewed: boolean; seen: boolean; played: boolean; heard: boolean; asked: boolean;
  gate: boolean; inappGate: boolean; escTap: boolean; arrived: boolean;
  tried: boolean; submitted: boolean; signed: boolean;
};

export const isWebviewUa = (ua: string) => /webview/.test(String(ua || ""));

/* "first;s=fb;c=a b;tz=Asia/Bangkok" → { s: "fb", c: "a b", tz: "Asia/Bangkok" } */
export function parseTags(item: string): Record<string, string> {
  const out: Record<string, string> = {};
  String(item || "").split(";").slice(1).forEach(p => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i)] = p.slice(i + 1);
  });
  return out;
}

/* IANA zone → the market it most likely is. Only the zones that matter for this
   product's three landing pages are named; everything else is "other". */
export function regionOfTz(tz: string): string {
  const z = String(tz || "");
  if (!z) return "?";
  if (z === "Asia/Bangkok") return "TH";
  if (/^Asia\/(Shanghai|Chongqing|Harbin|Urumqi|Kashgar|Macau)$/.test(z)) return z === "Asia/Macau" ? "HK/MO/TW" : "CN";
  if (/^Asia\/(Hong_Kong|Taipei)$/.test(z)) return "HK/MO/TW";
  if (/^Asia\/(Singapore|Kuala_Lumpur|Jakarta|Manila|Ho_Chi_Minh|Saigon|Phnom_Penh|Vientiane|Yangon|Rangoon|Brunei)$/.test(z)) return "SEA";
  if (/^America\//.test(z)) return "Americas";
  if (/^Europe\//.test(z)) return "Europe";
  return "other";
}

const blank = (id: string, ua: string, src: string): Visitor => ({
  id, ua: ua || "?", src: src || "direct", lg: "", c: "", k: "", t: "", m: "", v: "", tz: "", oua: "",
  viewed: false, seen: false, played: false, heard: false, asked: false,
  gate: false, inappGate: false, escTap: false, arrived: false,
  tried: false, submitted: false, signed: false,
});

/* rows MUST be in id (time) order — the first row of a visitor is what says
   which browser they started in. */
export function buildVisitors(rows: Array<{ anon_id?: string | null; kind: string; item_id: string; ua?: string | null; src?: string | null }>): Map<string, Visitor> {
  const by = new Map<string, Visitor>();
  for (const r of rows) {
    if (!r || !r.anon_id) continue;
    let v = by.get(r.anon_id);
    if (!v) { v = blank(r.anon_id, r.ua || "", r.src || ""); by.set(r.anon_id, v); }
    const it = String(r.item_id || "");
    if (r.kind === "attr") {
      const g = parseTags(it);
      // the FIRST touch decides the campaign; a later "touch" row only fills gaps
      if (g.c && !v.c) v.c = g.c;
      if (g.k && !v.k) v.k = g.k;
      if (g.t && !v.t) v.t = g.t;
      if (g.m && !v.m) v.m = g.m;
      if (g.v && !v.v) v.v = g.v;
      if (g.tz && !v.tz) v.tz = g.tz;
      if (g.oua && !v.oua) v.oua = g.oua;
      if (g.lg && !v.lg && /^(th|en|zh)$/.test(g.lg)) v.lg = g.lg;
      if (g.s && it.startsWith("first;") && (!v.src || v.src === "direct")) v.src = g.s;
      continue;
    }
    if (r.kind !== "land") continue;
    if (it.startsWith("page:")) { if (!v.lg) v.lg = it.slice(5, 7); v.viewed = true; }
    else if (it === "view") v.viewed = true;
    else if (it === "hero:seen") v.seen = true;
    else if (it === "piano") v.played = true;
    else if (it === "aha:heard") v.heard = true;
    else if (it === "ask" || it === "q:spend") v.asked = true;
    else if (it === "gate:shown" || it === "nudge:shown" || it === "timeup") v.gate = true;
    else if (it === "gate:inapp") v.inappGate = true;
    else if (it === "openreal-top" || it === "openreal") v.escTap = true;
    else if (it.startsWith("escape:arrived")) { v.arrived = true; const o = it.split(":")[2]; if (o && !v.oua) v.oua = o; }
    else if (it.startsWith("try:")) v.tried = true;
    else if (it === "signup:email-otp" || it === "signup:email") v.submitted = true;
    else if (it.startsWith("signed_up_landing:") || it === "signup:google" || it === "signup:email-link" || it === "signup:line") v.signed = true;
  }
  return by;
}

export type Dim = "browser" | "inapp" | "source" | "campaign" | "adset" | "creative" | "variant" | "lang" | "region" | "escape";
export const DIMS: Dim[] = ["inapp", "browser", "source", "campaign", "adset", "creative", "variant", "lang", "region", "escape"];

export function keyOf(v: Visitor, dim: Dim): string {
  switch (dim) {
    case "browser": return v.ua || "?";
    case "inapp": return isWebviewUa(v.ua) ? "in-app" : "real";
    case "source": return v.src || "direct";
    case "campaign": return v.c || "—";
    case "adset": return v.t || "—";
    case "creative": return v.k || "—";
    case "variant": return v.v || "a";
    case "lang": return v.lg || "?";
    case "region": return regionOfTz(v.tz);
    case "escape": return v.escTap || v.arrived ? "escaped" : "stayed";
  }
}

export type Row = { key: string; n: number; seen: number; played: number; gate: number; tried: number; submitted: number; signed: number; escTap: number; arrived: number };

export function groupVisitors(vis: Iterable<Visitor>, dim: Dim): Row[] {
  const m = new Map<string, Row>();
  for (const v of vis) {
    if (!v.viewed) continue; // landing funnel: someone who actually opened the page
    const key = keyOf(v, dim);
    let r = m.get(key);
    if (!r) { r = { key, n: 0, seen: 0, played: 0, gate: 0, tried: 0, submitted: 0, signed: 0, escTap: 0, arrived: 0 }; m.set(key, r); }
    r.n++;
    if (v.seen) r.seen++;
    if (v.played) r.played++;
    if (v.gate) r.gate++;
    if (v.tried) r.tried++;
    if (v.submitted) r.submitted++;
    if (v.signed) r.signed++;
    if (v.escTap) r.escTap++;
    if (v.arrived) r.arrived++;
  }
  return Array.from(m.values()).sort((a, b) => b.n - a.n);
}
