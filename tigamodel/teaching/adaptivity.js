/* ── tigamodel/teaching/adaptivity.js ──
   PLAN v3 ระลอก 2 — ชั้นปรับตัว 3 ชั้น (จุดคูณของกริด 1M):

     W — forAge(band)     : ปรับตามวัย (เด็ก/ผู้ใหญ่) — คำสั้นลง, ชมบ่อยขึ้น,
                            ขั้นตอนน้อยลง, อีโมจิเป็นมิตร; ผู้ใหญ่ได้เหตุผล
                            เชิงเทคนิคมากขึ้น
     H — forStrategy(ex)  : ปรับตามกลยุทธ์ที่ teaching loop เลือกจริง
                            (decision.strategy_id) — "ยากไป" → แตกขั้นให้เล็ก,
                            "ง่ายไป" → เพิ่มท้าทาย, อื่น ๆ คงรูปเดิม
     Q — checkBars()      : เกณฑ์คุณภาพต่อช่องทาง (BAR as data) — bench/verify
                            อ่านจากที่นี่ ไม่ใช่ค่าที่พิมพ์ไว้ในเอกสาร

   DESIGN CONTRACTS (จากแผน §4 กันพลาด):
   • adapter ล้วน — ไม่แตะ coach/generator/loop เดิมแม้แต่บรรทัดเดียว
   • honest-null/identity: ไม่รู้อายุ → คืนของเดิมทั้งชิ้น (identity) ไม่มีการเดา
   • pure/sync, never throws — ทุกฟังก์ชันห่อ try/catch
   • ภาษา: ทุกข้อความใหม่เป็น {th,en,zh} ครบตามกติกาของ repo ── */

/* ── age bands (plan 2.1) — from the profile the app already keeps.
   W-matrix vocab of roadmap-1m: child / teen / adult. Anything unknown
   (undefined, weird values) → null → callers keep the existing content. ── */
export function ageBandFromProfile(profile) {
  try {
    if (!profile || typeof profile !== "object") return null;
    const age = profile.age != null ? Number(profile.age) : null;
    if (age != null && Number.isFinite(age) && age > 0 && age < 120) {
      if (age <= 9) return "child";
      if (age <= 15) return "teen";
      return "adult";
    }
    const band = profile.ageBand;
    return (band === "child" || band === "teen" || band === "adult") ? band : null;
  } catch (e) { return null; }
}

/* W — trilingual phrasing adjustments per band. Returns the SAME shape it is
   given (a {th,en,zh} string object), so a missed field degrades to the
   original text rather than an empty render. */
function W_STYLE(band) {
  return {
    child: { short: true, emoji: true, steps: 2, whySuffix: { th: " (แบบเด็ก เข้าใจง่าย)", en: " (kid-friendly)", zh: "（儿童版）" } },
    teen:  { short: false, emoji: true, steps: 3, whySuffix: null },
    adult: { short: false, emoji: false, steps: 3, whySuffix: null },
  }[band] || null;
}

function shortenLine(s, style, lang) {
  if (!style || !s || typeof s !== "string") return s;
  let out = s;
  if (style.short) {
    out = out.split(/ — |——/)[0].split(" (")[0];       // drop the technical tail (zh uses —— as its dash)
    if (lang === "th" && out.length > 70) out = out.slice(0, 67).trimEnd() + "…";
    if (lang === "zh" && out.length > 40) out = out.slice(0, 38).trimEnd() + "…";
    if (lang === "en" && out.length > 60) out = out.slice(0, 57).trimEnd() + "…";
  }
  return out;
}

/* Public W adapter: age-adjust ANY trilingual content object.
   Supported shapes: {th,en,zh} strings and arrays of {th,en,zh} steps.
   Unknown band / missing content → the original object back (identity). */
export function forAge(band, content) {
  try {
    const style = W_STYLE(band);
    if (!style || !content || typeof content !== "object") return content;
    const cut = style.steps;
    if (typeof content.th === "string" || typeof content.en === "string" || typeof content.zh === "string") {
      const why = {};
      for (const lg of ["th", "en", "zh"]) {
        let v = typeof content[lg] === "string" ? content[lg] : null;
        if (v == null) continue;
        v = shortenLine(v, style, lg);
        if (style.whySuffix && !v.includes(style.whySuffix[lg])) v += style.whySuffix[lg];
        why[lg] = v;
      }
      return { ...content, ...why };
    }
    if (Array.isArray(content)) {
      const arr = cut ? content.slice(0, cut) : content;
      return arr.map(step => (step && typeof step === "object") ? forAge(band, step) : step);
    }
    return content;
  } catch (e) { return content; }
}

/* ── H — strategy → exercise variant (plan 2.2). The teaching loop's decision
   (decision.strategy_id) already exists per run; this maps it to a presentation
   variant for the SAME exercise (the teaching DECISION steers the display,
   spec §21 RESPOND→ADAPT). ── */
const H_VARIANTS = {
  "simplify-on-confusion":      { variant: "chunked", note: { th: "แตกขั้นทีละช่วงสั้น ๆ ก่อนรวมทั้งท่อน", en: "Break it into short chunks before joining the whole phrase", zh: "先分段慢练，再连成整句" } },
  "simplify-on-hard-report":    { variant: "chunked", note: { th: "ช้าลงแล้วซ้อมทีละท่อนเล็ก", en: "Slow down and drill one small piece at a time", zh: "放慢速度，一次练一小段" } },
  "return-to-prerequisite":     { variant: "scaffold", note: { th: "เริ่มจากพื้นฐานก่อนหน้าแล้วค่อยกลับมา", en: "Start from the prerequisite first, then return here", zh: "先回到基础，再回来练这个" } },
  "raise-challenge":            { variant: "challenge", note: { th: "ลองแบบท้าทาย: เร็วขึ้นเล็กน้อยหรือปิดดูคีย์", en: "Challenge: slightly faster, or try without looking at the keys", zh: "挑战：稍微加速，或试着不看琴键" } },
  "ease-off-on-low-engagement": { variant: "game", note: { th: "วันนี้เล่นแบบสนุก ๆ สั้น ๆ พอ", en: "Today, keep it short and fun", zh: "今天轻松玩一小段就好" } },
  "continue-current-plan":      { variant: "standard", note: null },
};

export function strategyVariant(strategyId) {
  return (strategyId && H_VARIANTS[strategyId]) || { variant: "standard", note: null };
}

/* Public H adapter: decorate an exercise with its strategy variant.
   ex unchanged when nothing applies (honest identity). */
export function forStrategy(ex, strategyId) {
  try {
    if (!ex || typeof ex !== "object") return ex;
    const { variant, note } = strategyVariant(strategyId);
    if (variant === "standard") return ex;
    return { ...ex, hVariant: variant, hNote: note };
  } catch (e) { return ex; }
}

/* ── Q — quality bars per surface (plan 2.3). Single source of truth; the
   bench imports this so shipped bars and measured bars can never drift apart. ── */
export const QUALITY_BARS = [
  { surface: "dashboard",        metric: "render_ms",       bar: 100,  desc: { th: "แดชบอร์ดต้องพร้อม <100ms", en: "dashboard ready <100ms", zh: "仪表板 <100ms" } },
  { surface: "song-analysis",    metric: "first_card_ms",   bar: 0,    desc: { th: "การ์ดวิเคราะห์ต้องมีข้อความจริงทันที (0ms) ก่อน AI เสริม", en: "analysis card shows real content instantly (0ms), AI upgrades later", zh: "分析卡须立即显示真实内容（0ms）" } },
  { surface: "practice-verdict", metric: "lang_mismatch",   bar: 0,    desc: { th: "verdict ต้องตรงภาษาโหมด 100%", en: "verdict must match the app language 100%", zh: "评价须与界面语言 100% 一致" } },
  { surface: "capability-map",   metric: "warm_read_ms",    bar: 50,   desc: { th: "อ่านแผนที่ความสามารถซ้ำ <50ms", en: "warm capability-map read <50ms", zh: "能力图二次读取 <50ms" } },
  { surface: "main-bundle",      metric: "bytes",           bar: 3145728, desc: { th: "ก้อนหลัก ≤3MB", en: "main bundle ≤3MB", zh: "主包 ≤3MB" } },
];

/* Q adapter: quality bars for one surface (null = surface unknown, honest —
   an empty array would be indistinguishable from "surface has no bars"). */
export function barsFor(surface) {
  try {
    const r = QUALITY_BARS.filter(b => b.surface === surface);
    return r.length ? r : null;
  } catch (e) { return null; }
}
