// Guard against the two price tables drifting apart again.
//
//   node supabase/functions/stripe-checkout/check-prices-match.cjs
//
// Reads the REAL tables out of payment.tsx (what the app shows) and
// index.ts (what the card is charged) and compares every plan x currency x
// cycle, applying each file's own yearly-rounding rule. Exits non-zero on any
// mismatch. Run it after touching either price table — a drift here once meant
// a Thai Max Family yearly plan displayed at THB 116,388 and charged 57,257.
// Every price the app can display, checked against what the Stripe checkout
// function would charge — parsed out of BOTH real source files, not retyped.
const fs = require("fs");
const APP = fs.readFileSync(require("path").join(__dirname, "../../../payment.tsx"), "utf8");
const FN  = fs.readFileSync(require("path").join(__dirname, "index.ts"), "utf8");

const tableFrom = (src, re) => {
  const m = src.match(re);
  if (!m) throw new Error("could not find " + re);
  const t = {};
  for (const [, k, v] of m[1].matchAll(/(\w+)\s*:\s*([\d.]+)/g)) t[k] = +v;
  return t;
};
const app = {
  thb: tableFrom(APP, /PLAN_PRICE\s*=\s*\{([^}]*)\}/),
  usd: tableFrom(APP, /PLAN_PRICE_USD\s*=\s*\{([^}]*)\}/),
  cny: tableFrom(APP, /PLAN_PRICE_CNY\s*=\s*\{([^}]*)\}/),
};
const fn = {
  thb: tableFrom(FN, /thb:\s*\{([^}]*)\}/),
  usd: tableFrom(FN, /usd:\s*\{([^}]*)\}/),
  cny: tableFrom(FN, /cny:\s*\{([^}]*)\}/),
};
// the app's own rounding rule, from payment.tsx
const yearApp = (cur, monthly) => { const n = monthly * 12 * 0.97; return cur === "usd" ? Math.round(n * 100) / 100 : Math.round(n); };
// the function's rule, from the edge source
const yearFn  = (cur, monthly) => { const n = monthly * 12 * 0.97; return cur === "usd" ? Math.round(n * 100) / 100 : Math.round(n); };
const YEAR_PLANS = ["premium", "max", "maxfamily"];
const sym = { thb: "฿", usd: "US$", cny: "¥" };

let bad = 0, checked = 0;
console.log("cur  plan        cycle   app shows      stripe charges   ");
console.log("──────────────────────────────────────────────────────────");
for (const cur of ["thb", "usd", "cny"]) {
  for (const plan of ["premium", "family", "max", "maxfamily"]) {
    for (const cycle of ["month", "year"]) {
      if (cycle === "year" && !YEAR_PLANS.includes(plan)) continue;
      const a = cycle === "year" ? yearApp(cur, app[cur][plan]) : app[cur][plan];
      const f = cycle === "year" ? yearFn(cur, fn[cur][plan])  : fn[cur][plan];
      checked++;
      const ok = Math.abs(a - f) < 0.005;
      if (!ok) bad++;
      console.log(`${cur}  ${plan.padEnd(11)} ${cycle.padEnd(6)}  ${(sym[cur] + a.toLocaleString()).padStart(13)}  ${(sym[cur] + f.toLocaleString()).padStart(15)}   ${ok ? "✓" : "✗ MISMATCH"}`);
    }
  }
}
// the books figure the webhook records must also track the app's THB price
console.log("\nTHB recorded for the books (metadata.amount_thb):");
for (const plan of ["premium", "family", "max", "maxfamily"]) {
  for (const cycle of ["month", "year"]) {
    if (cycle === "year" && !YEAR_PLANS.includes(plan)) continue;
    const a = cycle === "year" ? yearApp("thb", app.thb[plan]) : app.thb[plan];
    const f = cycle === "year" ? yearFn("thb", fn.thb[plan]) : fn.thb[plan];
    checked++; if (Math.abs(a - f) >= 0.005) bad++;
    console.log(`  ${plan.padEnd(11)} ${cycle.padEnd(6)} ฿${f.toLocaleString()} ${Math.abs(a - f) < 0.005 ? "✓" : "✗"}`);
  }
}
console.log(`\n${checked} prices compared · ${bad} mismatched`);
process.exit(bad ? 1 : 0);
