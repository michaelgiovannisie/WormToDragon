# Prompt for Claude Code

Four small polish fixes to the DCF valuation implementation. All are targeted
— no architectural changes, no new features.

---

## Fix 1 — Exit multiple cross-check includes intermediate cash flows
**File:** `backend/src/main/java/com/conviction/valuation/strategy/DCFStrategy.java`
**Method:** `exitMultipleValue()` static helper

**Problem:** the current formula only discounts the exit-multiple terminal value:
```java
finalCF × exitMultiple / (1+d)^N
```
The primary DCF includes intermediate cash flows (years 1–N) PLUS the
discounted terminal value. So comparing them is misleading — the primary DCF
will always be higher not just because the terminal assumptions differ but
because one includes 10 years of accumulated cash flows and the other doesn't.
A user seeing "Primary: $183 / Cross-check: $142" would wrongly conclude the
exit multiple implies a much cheaper company; part of that gap is just missing
intermediate CFs.

**Fix:** add the same PV-of-intermediate-cash-flows summation loop that
`dcfValue()` uses, then add the discounted exit-multiple terminal value on top.
Only the terminal value formula should differ between the two methods:

```java
public static BigDecimal exitMultipleValue(
        BigDecimal base, BigDecimal growthPct, BigDecimal discountPct,
        int years, BigDecimal exitMultiple) {

    BigDecimal g = growthPct.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
    BigDecimal d = discountPct.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
    BigDecimal onePlusG = BigDecimal.ONE.add(g);
    BigDecimal onePlusD = BigDecimal.ONE.add(d);

    // PV of intermediate cash flows — same as dcfValue()
    BigDecimal pvCashFlows = BigDecimal.ZERO;
    for (int i = 1; i <= years; i++) {
        BigDecimal cf = base.multiply(onePlusG.pow(i));
        BigDecimal pv = cf.divide(onePlusD.pow(i), 8, RoundingMode.HALF_UP);
        pvCashFlows = pvCashFlows.add(pv);
    }

    // Exit-multiple terminal value (differs from perpetuity approach)
    BigDecimal finalCF    = base.multiply(onePlusG.pow(years));
    BigDecimal terminalTV = finalCF.multiply(exitMultiple);
    BigDecimal pvTerminal = terminalTV.divide(onePlusD.pow(years), 8, RoundingMode.HALF_UP);

    return pvCashFlows.add(pvTerminal).setScale(2, RoundingMode.HALF_UP);
}
```

---

## Fix 2 — Hide irrelevant form fields for PEG model
**File:** `frontend/src/pages/Research.tsx`
**Location:** the `fields` array inside the `showForm` section (~line 692)

**Problem:** `years` and `discountRatePercent` both have `show: true`, meaning
they appear for PEG even though `PEGStrategy` ignores them entirely (PEG only
multiplies EPS × growth rate).

**Fix:** update the `show` condition for those two fields:
```tsx
{ key: "discountRatePercent", label: "...", show: model !== "PEG" },
{ key: "years",               label: "Years", show: model !== "PEG" },
```
Graham uses `discountRatePercent` (as bond yield) so keep it visible there.
Graham doesn't use `years` either — you can also hide it for Graham:
```tsx
{ key: "years", label: "Years", show: isDcfModel },
```
where `isDcfModel` is already defined as `model === "DCF" || model === "OWNER_EARNINGS"`.

---

## Fix 3 — Guard against negative FCF in OwnerEarningsStrategy
**File:** `backend/src/main/java/com/conviction/valuation/strategy/OwnerEarningsStrategy.java`
**Location:** the null/zero guard in `calculateIntrinsicValue()`

**Problem:** the guard catches null and zero but not negative FCF. A company
with negative FCF produces a meaningless negative intrinsic value with no
explanation.

**Fix:** extend the condition to also reject negative values:
```java
if (fcf == null || fcf.compareTo(BigDecimal.ZERO) <= 0) {
    throw new IllegalArgumentException(
        fcf != null && fcf.compareTo(BigDecimal.ZERO) < 0
            ? "FCF per share is negative — Owner Earnings DCF requires positive cash generation. Consider using the EPS-based DCF model instead."
            : "freeCashFlowPerShare is required and must be non-zero for the OWNER_EARNINGS model");
}
```

---

## Fix 4 — Fair value range bar uses most current price
**File:** `frontend/src/pages/Research.tsx`
**Location:** the fair value range bar section (~line 631)

**Problem:** `const cur = Number(bearCase.currentPrice ?? detail?.holding?.marketPrice ?? 0)`
uses the price saved inside the scenario as the primary source. If the market
has moved since the last valuation run, the marker position is stale.

**Fix:** flip the priority so the live holding price is used first:
```tsx
const cur = Number(detail?.holding?.marketPrice ?? bearCase.currentPrice ?? 0);
```

---

## Conventions
- Don't touch anything else — these are the only four changes needed.
- Match existing BigDecimal precision/rounding conventions.
- No DB schema changes, no new fields, no new files.
