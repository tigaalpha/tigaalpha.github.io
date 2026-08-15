import { L } from "./i18n";
import {
  fmtPrice, planPriceByCur, yearPriceByCur, b2bPriceByCur, b2bYearPriceByCur,
  CURRENCY_BY_LANG, trialDaysLeft,
} from "./payment";
/* ── PricingOverlay ──
   The "Choose Your Plan" modal (pricingOpen), extracted verbatim from
   PianoApp's inline JSX as part of Phase 2 componentization — no logic
   changes. Pricing/currency helpers import directly from payment.tsx (pure
   functions, no PianoApp-instance state); lc is derived from lang the same
   way PianoApp itself derives it, rather than threading a redundant prop.
   ── */
export function PricingOverlay({ plan, profile, billCycle, setBillCycle, lang, startCheckout, choosePlan, setPricingOpen, setSchoolCheckout }) {
  const lc = L[lang];
  return (
        <div className="setov" onClick={() => setPricingOpen(false)}>
          <div className="setcard pricing" onClick={e => e.stopPropagation()}>
            <div className="sethdr"><span>✦ {lc.prTitle}</span><button className="cbtn" onClick={() => setPricingOpen(false)}>{lc.close}</button></div>
            <div className="setbody">
              {plan === "trial" && trialDaysLeft(profile) > 0 && (
                <div style={{ background: "rgba(217,119,87,.12)", border: "1.5px solid #d97757", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                  🎁 {lc.trialBanner} · {trialDaysLeft(profile)} {lc.trialDaysLeft}
                </div>
              )}
              <p className="pr-sub">{lc.prSub}</p>
              {(() => {
                const yr = billCycle === "year";
                const cur = CURRENCY_BY_LANG[lang] || "thb";
                const dispMo = (tier) => fmtPrice(cur, planPriceByCur(cur, tier));
                const dispYr = (tier) => fmtPrice(cur, yearPriceByCur(cur, tier));
                const dispPerMoFromYr = (tier) => {
                  const n = yearPriceByCur(cur, tier) / 12;
                  return fmtPrice(cur, cur === "usd" ? Math.round(n * 100) / 100 : Math.round(n));
                };
                const priceBlk = (tier) => yr
                  ? <span className="prtier-price">{dispYr(tier)}<small>/{lc.prYear}</small></span>
                  : <span className="prtier-price">{dispMo(tier)}<small>/{lc.prMonth}</small></span>;
                const saveLine = (tier) => yr
                  ? <div className="pr-yrsave">💚 {lc.prSave3} · ≈ {dispPerMoFromYr(tier)}/{lc.prMonth}</div>
                  : null;
                const buyBtn = (tier) => plan === tier
                  ? <button className="songbtn" disabled>✓ {lc.prCurrent}</button>
                  : <button className="songbtn go" onClick={() => startCheckout(tier, yr ? "year" : "month")}>{(plan === "free" || plan === "trial") ? lc.prGet : lc.prSwitch}</button>;
                // Max Family savings vs 10 × individual Max
                const mxfMaxUnit = planPriceByCur(cur, "max");
                const mxfFamilyUnit = planPriceByCur(cur, "maxfamily");
                const mxfSave = 10 * mxfMaxUnit - mxfFamilyUnit;
                const mxfSaveStr = fmtPrice(cur, cur === "usd" ? Math.round(mxfSave * 100) / 100 : Math.round(mxfSave));
                // per-person price (Max Family / 10, Family / 3)
                const perPersonMxf = fmtPrice(cur, cur === "usd" ? Math.round(mxfFamilyUnit / 10 * 100) / 100 : Math.round(mxfFamilyUnit / 10));
                const perPersonFam = fmtPrice(cur, cur === "usd" ? Math.round(planPriceByCur(cur,"family") / 3 * 100) / 100 : Math.round(planPriceByCur(cur,"family") / 3));
                const freeLabel = cur === "usd" ? "US$0" : cur === "cny" ? "¥0" : "฿0";
                const isB2B = billCycle === "b2b";
                const b2bPriceBlk = (tier) => <span className="prtier-price">{fmtPrice(cur, b2bPriceByCur(cur, tier))}<small>/{lc.prMonth}/{lc.prSeat}</small></span>;
                const b2bYearNote = (tier) => <div className="pr-yrsave">{lc.prB2bOrYearly.replace("{x}", fmtPrice(cur, b2bYearPriceByCur(cur, tier)) + "/" + lc.prYear + "/" + lc.prSeat)}</div>;
                return (
                  <>
                    <div className="billtoggle">
                      <button className={`billtog${billCycle === "month" ? " on" : ""}`} onClick={() => setBillCycle("month")}>{lc.prBillMonth}</button>
                      <button className={`billtog${billCycle === "year" ? " on" : ""}`} onClick={() => setBillCycle("year")}>{lc.prBillYear} <span className="billsave">-3%</span></button>
                      <button className={`billtog billtog-b2b${isB2B ? " on" : ""}`} onClick={() => setBillCycle("b2b")}>{lc.prBillB2B}</button>
                    </div>

                    {isB2B ? (<>
                      <p className="pr-sub" style={{ margin: "-4px 0 14px" }}>{lc.prB2bSub}</p>

                      {/* ── B2B PLUS (Max-equivalent) ── */}
                      <div className="prtier max" style={{ position: "relative", marginTop: 6 }}>
                        <div style={{ position: "absolute", top: -10, right: 12, background: "rgba(217,119,87,.15)", border: "1px solid #d97757", color: "#d97757", padding: "2px 10px", borderRadius: 12, fontSize: "10px", fontWeight: 800 }}>
                          ⚡ {lang === "th" ? "แนะนำ" : lang === "zh" ? "推荐" : "Recommended"}
                        </div>
                        <div className="prtier-top">
                          <div>
                            <span className="prtier-nm">👑 {lc.prB2bPlusNm}</span>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{lc.prB2bPlusSub}</div>
                          </div>
                          {b2bPriceBlk("plus")}
                        </div>
                        {b2bYearNote("plus")}
                        <ul className="prfeat"><li>{lc.prMax2}</li><li>{lc.prMax4}</li><li>{lc.prMax7}</li></ul>
                        <div style={{ fontSize: 10, color: "#d97757", fontFamily: "'Orbitron',sans-serif", letterSpacing: 1, margin: "10px 0 4px" }}>{lc.prB2bPerksLabel}</div>
                        <ul className="prfeat"><li>{lc.prB2bPerk1}</li><li>{lc.prB2bPerk2}</li><li>{lc.prB2bPerk4}</li></ul>
                        <button className="songbtn go" onClick={() => { setPricingOpen(false); setSchoolCheckout({ tier: "plus" }); }}>{lc.prB2bCta}</button>
                      </div>

                      {/* ── B2B STANDARD (Premium-equivalent) ── */}
                      <div className="prtier">
                        <div className="prtier-top">
                          <div>
                            <span className="prtier-nm">⭐ {lc.prB2bStdNm}</span>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{lc.prB2bStdSub}</div>
                          </div>
                          {b2bPriceBlk("standard")}
                        </div>
                        {b2bYearNote("standard")}
                        <ul className="prfeat"><li>{lc.prF2}</li><li>{lc.prF3}</li><li>{lc.prF4}</li></ul>
                        <div style={{ fontSize: 10, color: "#d97757", fontFamily: "'Orbitron',sans-serif", letterSpacing: 1, margin: "10px 0 4px" }}>{lc.prB2bPerksLabel}</div>
                        <ul className="prfeat"><li>{lc.prB2bPerk1}</li><li>{lc.prB2bPerk2}</li><li>{lc.prB2bPerk4}</li></ul>
                        <button className="songbtn go" onClick={() => { setPricingOpen(false); setSchoolCheckout({ tier: "standard" }); }}>{lc.prB2bCta}</button>
                      </div>

                      <div className="pr-note">{lc.prB2bSeatNote}</div>
                    </>) : (<>

                    {/* ── MAX FAMILY — ไฮไลต์สุด ── */}
                    <div className={`prtier maxfam${plan === "maxfamily" ? " cur" : ""}`}
                      style={{ border: "2.5px solid #d97757", position: "relative", marginTop: 24, paddingTop: 14 }}>
                      <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "#d97757", color: "#fff", padding: "4px 18px", borderRadius: 20, fontSize: "11px", fontWeight: 900, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
                        {lang === "th" ? "🏆 คุ้มที่สุด — เลือกไว้เลย" : lang === "zh" ? "🏆 最超值 — 全家共享" : "🏆 Best Value — Most Complete"}
                      </div>
                      <div className="prtier-top">
                        <span className="prtier-nm">👑👨‍👩‍👧 Max Family</span>
                        <div style={{ textAlign: "right" }}>
                          {priceBlk("maxfamily")}
                          <div style={{ fontSize: "9px", color: "#d97757", fontWeight: 800, marginTop: 2 }}>
                            ≈ {perPersonMxf}/{lang === "th" ? "คน/เดือน" : lang === "zh" ? "人/月" : "person/mo"}
                          </div>
                        </div>
                      </div>
                      {saveLine("maxfamily")}
                      <div style={{ background: "rgba(217,119,87,.12)", border: "1px solid rgba(217,119,87,.35)", borderRadius: 8, padding: "7px 12px", margin: "6px 0 8px", fontSize: "11px", color: "#d97757", fontWeight: 700, textAlign: "center" }}>
                        💰 {lang === "th" ? `ประหยัด ${mxfSaveStr}/เดือน เทียบซื้อ Max 10 คนแยก` : lang === "zh" ? `比10人分别买Max每月省${mxfSaveStr}` : `Save ${mxfSaveStr}/mo vs 10 separate Max plans`}
                      </div>
                      <ul className="prfeat">
                        <li>✓ {lc.prMxf1}</li>
                        <li>✓ {lc.prMxf2}</li>
                        <li>✓ {lc.prMxf3}</li>
                        <li>✓ {lc.prMax7}</li>
                      </ul>
                      {plan === "maxfamily"
                        ? <button className="songbtn" disabled>✓ {lc.prCurrent}</button>
                        : <button className="songbtn go" style={{ fontWeight: 900 }} onClick={() => startCheckout("maxfamily", yr ? "year" : "month")}>
                            {(plan === "free" || plan === "trial")
                              ? (lang === "th" ? "🚀 สมัคร Max Family เลย" : lang === "zh" ? "🚀 立即订阅 Max Family" : "🚀 Get Max Family Now")
                              : lc.prSwitch}
                          </button>}
                    </div>

                    {/* ── MAX ── */}
                    <div className={`prtier max${plan === "max" ? " cur" : ""}`} style={{ position: "relative", marginTop: 6 }}>
                      <div style={{ position: "absolute", top: -10, right: 12, background: "rgba(217,119,87,.15)", border: "1px solid #d97757", color: "#d97757", padding: "2px 10px", borderRadius: 12, fontSize: "10px", fontWeight: 800 }}>
                        ⚡ {lang === "th" ? "สุดยอด" : lang === "zh" ? "最受欢迎" : "Most Popular"}
                      </div>
                      <div className="prtier-top"><span className="prtier-nm">👑 Max</span>{priceBlk("max")}</div>
                      {saveLine("max")}
                      <ul className="prfeat">
                        <li>{lc.prMax2}</li>
                        <li>{lc.prMax3}</li>
                        <li>{lc.prMax4}</li>
                        <li>{lc.prMax5}</li>
                        <li>{lc.prMax6}</li>
                        <li>{lc.prMax7}</li>
                      </ul>
                      {buyBtn("max")}
                    </div>

                    {/* ── FAMILY (monthly only) ── */}
                    {!yr && (
                      <div className={`prtier${plan === "family" ? " cur" : ""}`}>
                        <div className="prtier-top">
                          <span className="prtier-nm">👨‍👩‍👧 Family</span>
                          <div style={{ textAlign: "right" }}>
                            {priceBlk("family")}
                            <div style={{ fontSize: "9px", color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>
                              ≈ {perPersonFam}/{lang === "th" ? "คน" : lang === "zh" ? "人" : "person"}
                            </div>
                          </div>
                        </div>
                        <ul className="prfeat"><li>{lc.prFam1}</li><li>{lc.prFam2}</li></ul>
                        {buyBtn("family")}
                      </div>
                    )}

                    {/* ── PREMIUM ── */}
                    <div className={`prtier${plan === "premium" ? " cur" : ""}`}>
                      <div className="prtier-top"><span className="prtier-nm">⭐ Premium</span>{priceBlk("premium")}</div>
                      {saveLine("premium")}
                      <ul className="prfeat"><li>{lc.prF2}</li><li>{lc.prF3}</li><li>{lc.prF4}</li><li>{lc.prF5}</li></ul>
                      {buyBtn("premium")}
                    </div>

                    {/* ── FREE ── */}
                    <div className={`prtier free${plan === "free" ? " cur" : ""}`}>
                      <div className="prtier-top"><span className="prtier-nm">🎁 Free</span><span className="prtier-price">{freeLabel}</span></div>
                      <ul className="prfeat"><li>{lc.prFree1}</li><li>{lc.prFree2}</li></ul>
                      {plan !== "free" && plan !== "trial" && <button className="songbtn ghost" onClick={() => choosePlan("free")}>{lc.prDowngrade}</button>}
                    </div>
                    </>)}
                  </>
                );
              })()}
              {billCycle !== "b2b" && (<>
                <div className="pr-note">{lc.prNote}</div>
                <button className="pr-school" onClick={() => setBillCycle("b2b")}>🏫 {lc.prSchool}</button>
              </>)}
            </div>
          </div>
        </div>
  );
}
