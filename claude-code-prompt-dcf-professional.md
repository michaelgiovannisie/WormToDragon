# Prompt for Claude Code

Upgrade the DCF and Owner Earnings valuation models to use a professional-grade
terminal growth rate (perpetuity) as the primary driver, with an optional exit
multiple cross-check. Also add a fair value range summary to the frontend.

## Context — read these first

- `backend/src/main/java/com/conviction/valuation/strategy/DCFStrategy.java`
  — contains the shared static `dcfValue()` method used by both DCF and
  OWNER_EARNINGS strategies. The terminal value currently uses a terminal
  multiple; this needs to change to a perpetuity formula.
- `backend/src/main/java/com/conviction/valuation/strategy/OwnerEarningsStrategy.java`
  — delegates to `DCFStrategy.dcfValue()`. Will be automatically improved
  by updating that shared method.
- `backend/src/main/java/com/conviction/valuation/dto/ValuationRequest.java`
  — current inputs include `terminalMultiple`; this gets replaced.
- `backend/src/main/java/com/conviction/valuation/dto/ValuationResponse.java`
  — needs a new field for the exit multiple cross-check value.
- `backend/src/main/java/com/conviction/valuation/entity/ValuationScenario.java`
  — persisted scenario entity; needs new fields added (keep existing ones
  for backward compatibility with already-saved scenarios).
- `backend/src/main/java/com/conviction/valuation/service/ValuationService.java`
  — `calculatePresets()` hardcodes bear/base/bull assumptions that need
  updating for the new input structure.
- `frontend/src/pages/Research.tsx` — the valuation form (~line 617 onward)
  and the valuation range display (~line 566 onward).

---

## Problem and goal

The current DCF uses `terminalValue = futureEPS × terminalMultiple` — the
terminal multiple is opaque (what does "22x" mean to a user?) and technically
inferior to a perpetuity approach. Professional equity research uses:

```
Terminal Value = finalYearCF × (1 + terminalGrowthRate) / (discountRate − terminalGrowthRate)
```

Where `terminalGrowthRate` is the assumed long-run annual growth rate forever
after year N — anchored to GDP growth (typically 2–4%). This is more intuitive
("this company grows at 3% in perpetuity") and more defensible than a P/E exit
multiple.

Additionally: professionals never trust one model output alone. Use the exit
multiple as a **secondary cross-check** shown alongside the primary DCF value
— not as the primary driver.

---

## Backend changes

### 1. Update `DCFStrategy.dcfValue()` signature

Replace `terminalMultiple` parameter with `terminalGrowthRatePercent`.

New perpetuity terminal value formula:
```java
// terminalGrowthRatePercent is e.g. 2.5 for 2.5%
BigDecimal gT = terminalGrowthRatePercent.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
BigDecimal finalCF = base.multiply(onePlusG.pow(years));
// Terminal value = finalCF × (1 + gT) / (d - gT)
BigDecimal denominator = d.subtract(gT);
// Guard: if discount rate ≤ terminal growth rate, the formula breaks
// Throw IllegalArgumentException("Discount rate must exceed terminal growth rate")
BigDecimal terminalValue = finalCF.multiply(BigDecimal.ONE.add(gT))
                                  .divide(denominator, 8, RoundingMode.HALF_UP);
BigDecimal pvTerminal = terminalValue.divide(onePlusD.pow(years), 8, RoundingMode.HALF_UP);
```

The sum of discounted intermediate cash flows (years 1 to N) stays exactly as
it is — don't change that part, it's correct.

### 2. Add optional exit multiple cross-check calculation

Add a separate helper method (or inline logic) that, when `exitMultiple` is
provided, also computes:
```
exitMultipleValue = finalYearCF × exitMultiple / (1 + discountRate)^years
```
(Same discounting, just using a P/E-style exit multiple instead of perpetuity.)
Return this as a nullable second value alongside the primary intrinsic value.

### 3. Update `ValuationRequest`

Replace `terminalMultiple` with:
```java
BigDecimal terminalGrowthRatePercent,  // e.g. 2.5 for 2.5% — required for DCF/OWNER_EARNINGS
BigDecimal exitMultiple,               // nullable — optional cross-check only
```

PEG, GRAHAM, CRYPTO_RISK still don't use either field — they can pass null.

### 4. Update `ValuationResponse`

Add:
```java
BigDecimal terminalGrowthRatePercent,  // replaces terminalMultiple in output
BigDecimal exitMultiple,               // nullable, echoed back if provided
BigDecimal exitMultipleValue,          // nullable, the cross-check intrinsic value
```

Remove `terminalMultiple` from the record (it no longer applies to new runs).

### 5. Update `ValuationScenario` entity

Add new nullable columns — **do not remove `terminalMultiple`**, existing saved
scenarios still have it and removing the column would require a migration:
```java
@Column(precision = 19, scale = 4, nullable = true)
private BigDecimal terminalGrowthRatePercent;

@Column(precision = 19, scale = 4, nullable = true)
private BigDecimal exitMultiple;

@Column(precision = 19, scale = 4, nullable = true)
private BigDecimal exitMultipleValue;
```

`terminalMultiple` stays as a nullable legacy field — `ddl-auto=update` handles
the new columns automatically.

### 6. Update `ValuationService.calculatePresets()`

New hardcoded assumptions for bear/base/bull using terminal growth rates:

| Case | Growth Rate | Discount Rate | Terminal Growth | Exit Multiple (cross-check) |
|------|-------------|---------------|-----------------|----------------------------|
| Bear | 4%          | 11%           | 1.5%            | 14x                        |
| Base | 8%          | 10%           | 2.5%            | 20x                        |
| Bull | 12%         | 9%            | 3.5%            | 26x                        |

Run both DCF and OWNER_EARNINGS presets as before (when EPS / FCF per share
are provided respectively).

### 7. Update `persistScenario()` in `ValuationService`

Save the new fields: `terminalGrowthRatePercent`, `exitMultiple`,
`exitMultipleValue`. Keep saving `terminalMultiple` as null for new runs (it
stays on the entity for old records).

---

## Frontend changes (`Research.tsx`)

### 1. Update form inputs

For DCF and OWNER_EARNINGS models:
- Replace "Terminal Multiple" input with **"Terminal Growth Rate (%)"** 
  (e.g. default value 2.5)
- Add an optional **"Exit Multiple (cross-check)"** input below or alongside
  (e.g. default 20 for base case — user can clear it to skip the cross-check)
- Update `formVals` state accordingly:
  replace `terminalMultiple` with `terminalGrowthRatePercent` (default "2.5"),
  add `exitMultiple` (default "20")
- PEG / GRAHAM / CRYPTO_RISK: don't show either field (they don't use them —
  fix the conditional `show` logic to hide irrelevant fields per model)

### 2. Update the valuation output display

When a scenario has both `intrinsicValue` (primary DCF) AND `exitMultipleValue`
(cross-check), show both side by side in the scenario card — for example:
```
Primary (DCF):        $183.40
Cross-check (Exit):   $201.00
```
A small label differentiating the two methods is sufficient — no new section
needed, just additional lines within the existing scenario card.

### 3. Add a Fair Value Range summary

After the bear/base/bull scenario cards, add a simple summary band derived
from the *primary* intrinsic values across all three cases (ignore null/zero
values):

```
Fair Value Range   $145 ─────●─────── $235
                             ↑ current price $188
```

- Range = bear intrinsicValue (low) to bull intrinsicValue (high)
- Show current price as a marker within or outside the range
- Color: current price below range = green (undervalued), within range = gold
  (fairly valued), above range = red (overvalued)
- Show this for whichever model type the user last ran presets for
- This is a purely frontend calculation over already-loaded `detail.valuationScenarios`

### 4. Fix growth rate label

Dynamically label the growth rate field:
- "EPS Growth Rate (%)" when model is DCF
- "FCF Growth Rate (%)" when model is OWNER_EARNINGS
- "Growth Rate (%)" for PEG / GRAHAM

---

## Conventions / constraints

- Keep the Strategy pattern — no model-specific if/else in `ValuationService`
- `dcfValue()` static method stays in `DCFStrategy` and is shared by
  `OwnerEarningsStrategy` — just update its signature
- Match existing BigDecimal precision/rounding conventions (scale 8 for
  intermediate, scale 2 for output)
- Match existing dark/gold theme in `Research.tsx` — no new styles needed,
  the fair value range bar can reuse `C.green`, `C.gold`, `C.red`, `C.muted`
- `ddl-auto=update` handles new nullable columns automatically — no migration
  file needed
- Don't touch PEG, GRAHAM, or CRYPTO_RISK calculation logic

## Note on verification

Sandbox can't reach Maven Central — verify Java compiles logically, especially
the `dcfValue()` signature change cascading into `OwnerEarningsStrategy`, and
flag anything uncertain for a local build check.
