import { L } from "./i18n";
import { CHAT_TTS_ENABLED } from "./chat-ui";
import {
  fmtPrice, planPriceByCur, yearPriceByCur, b2bPriceByCur, b2bYearPriceByCur,
  CURRENCY_BY_LANG, trialDaysLeft, isTrialPlan, canonicalPlan,
} from "./payment";
/* ── PricingOverlay ──
   The "Choose Your Plan" modal (pricingOpen), extracted from PianoApp's inline
   JSX as part of Phase 2 componentization. Pricing/currency helpers import
   directly from payment.tsx (pure functions, no PianoApp-instance state); lc is
   derived from lang the same way PianoApp itself derives it, rather than
   threading a redundant prop.

   TWO CARDS, free and Premium (owner, 2026-10-04: "แค่สองแพ็กเกจ ฟรี กับ พรีเมียม").
   It used to be five: Premium, Family, Max, Max Family and Free, listed as a
   price ladder. Four tiers is not a choice, it is a decision — and the person
   reading it has to work out which one is FOR THEM, which is the work a pricing
   page is supposed to have already done. The ladder is gone and Premium now
   carries everything the upper three tiers sold, including the per-person
   family framing, so nothing was taken away to achieve it.

   `plan` arriving as a legacy string ("max", "maxfamily") is folded by
   canonicalPlan() before anything compares it: a subscriber whose row predates
   the merge must see their own card marked as current, not a page that appears
   to have forgotten them. ── */
export function PricingOverlay({ plan: rawPlan, profile, billCycle, setBillCycle, lang, startCheckout, choosePlan, setPricingOpen, setSchoolCheckout }) {
  const lc = L[lang];
  const plan = canonicalPlan(rawPlan);
  return (
        <div className="setov" onClick={() => setPricingOpen(false)}>
          <div className="setcard pricing" onClick={e => e.stopPropagation()}>
            <div className="sethdr"><span>✦ {lc.prTitle}</span><button className="cbtn" onClick={() => setPricingOpen(false)}>{lc.close}</button></div>
            <div className="setbody">
              {isTrialPlan(plan) && trialDaysLeft(profile) > 0 && (
                <div style={{ background: "rgba(217,119,87,.12)", border: "1.5px solid #d97757", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                  {lc.trialBanner} · {trialDaysLeft(profile)} {lc.trialDaysLeft}
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
                // The per-family-member figure Max Family used to quote, now
                // computed off the ONE price there is. It still earns its place
                // on the card: "≈ ฿xxx/คน" is the number that makes a ฿1,490
                // look right to someone who used to look at ฿9,999 for ten
                // people. At one profile per Premium (owner, 2026-10-04) this
                // is the unit price of the plan itself, not a seat discount —
                // shown because it is true, not because it is a tier.
                const premiumUnit = planPriceByCur(cur, "premium");
                const perPerson = fmtPrice(cur, cur === "usd" ? Math.round(premiumUnit * 100) / 100 : Math.round(premiumUnit));
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
                        <div style={{ position: "absolute", top: -10, right: 12, background: "rgba(217,119,87,.15)", border: "1px solid #d97757", color: "var(--clay-ink)", padding: "2px 10px", borderRadius: 12, fontSize: "10px", fontWeight: 800 }}>
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
                        <div style={{ fontSize: 10, color: "var(--clay-ink)", fontFamily: "var(--f-app, sans-serif)", letterSpacing: 1, margin: "10px 0 4px" }}>{lc.prB2bPerksLabel}</div>
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
                        <ul className="prfeat"><li>{lc.prF2}</li><li>{lc.prF3}</li></ul>
                        <div style={{ fontSize: 10, color: "var(--clay-ink)", fontFamily: "var(--f-app, sans-serif)", letterSpacing: 1, margin: "10px 0 4px" }}>{lc.prB2bPerksLabel}</div>
                        <ul className="prfeat"><li>{lc.prB2bPerk1}</li><li>{lc.prB2bPerk2}</li><li>{lc.prB2bPerk4}</li></ul>
                        <button className="songbtn go" onClick={() => { setPricingOpen(false); setSchoolCheckout({ tier: "standard" }); }}>{lc.prB2bCta}</button>
                      </div>

                      <div className="pr-note">{lc.prB2bSeatNote}</div>
                    </>) : (<>

                    {/* ── PREMIUM — the only thing there is to buy ──
                        The list below is the union of what the four old cards
                        each claimed, so a member who used to read "this is what
                        Max gave me" finds the same line here. Dropping any of
                        them would make the merged plan look WEAKER than the
                        tiers it replaced, which is the one way this change
                        could lose money instead of gaining it. */}
                    <div className={`prtier max${plan === "premium" ? " cur" : ""}`}
                      style={{ border: "2.5px solid #d97757", position: "relative", marginTop: 24, paddingTop: 14 }}>
                      <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "var(--clay-btn)", color: "#fff", padding: "4px 16px", borderRadius: 20, fontSize: "11.5px", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {lang === "th" ? "⚡ ครบทุกฟีเจอร์" : lang === "zh" ? "⚡ 解锁全部功能" : "⚡ Everything unlocked"}
                      </div>
                      <div className="prtier-top">
                        <span className="prtier-nm">⭐ Premium</span>
                        <div style={{ textAlign: "right" }}>
                          {priceBlk("premium")}
                          <div style={{ fontSize: "9px", color: "var(--clay-ink)", fontWeight: 800, marginTop: 2 }}>
                            ≈ {perPerson}/{lang === "th" ? "คน/เดือน" : lang === "zh" ? "人/月" : "person/mo"}
                          </div>
                        </div>
                      </div>
                      {saveLine("premium")}
                      <ul className="prfeat">
                        <li>{lc.prF2}</li>
                        <li>{lc.prF3}</li>
                        {/* the live voice teacher only while the feature is actually on — the
                            flag used to gate this line on the Max card and is kept doing so */}
                        {CHAT_TTS_ENABLED && <li>{lc.prMaxSpk}</li>}
                        <li>{lc.prMax3}</li>
                        <li>{lc.prMax4}</li>
                        <li>{lc.prMax5}</li>
                        <li>{lc.prMax6}</li>
                        <li>{lc.prMax7}</li>
                        <li>{lc.prF5}</li>
                      </ul>
                      {plan === "premium"
                        ? <button className="songbtn" disabled>✓ {lc.prCurrent}</button>
                        : <button className="songbtn go" style={{ fontWeight: 900 }} onClick={() => startCheckout("premium", yr ? "year" : "month")}>
                            {(plan === "free" || isTrialPlan(plan))
                              ? (lang === "th" ? "🚀 สมัคร Premium เลย" : lang === "zh" ? "🚀 立即订阅 Premium" : "🚀 Get Premium Now")
                              : lc.prSwitch}
                          </button>}
                    </div>

                    {/* ── FREE ── */}
                    <div className={`prtier free${plan === "free" ? " cur" : ""}`}>
                      <div className="prtier-top"><span className="prtier-nm">🎁 Free</span><span className="prtier-price">{freeLabel}</span></div>
                      <ul className="prfeat"><li>{lc.prFree1}</li><li>{lc.prFree2}</li></ul>
                      {plan !== "free" && !isTrialPlan(plan) && <button className="songbtn ghost" onClick={() => choosePlan("free")}>{lc.prDowngrade}</button>}
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
