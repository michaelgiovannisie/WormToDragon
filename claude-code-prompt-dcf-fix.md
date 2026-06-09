# Prompt for Claude Code

Fix and optimize the DCF valuation model, and activate the unused
`OWNER_EARNINGS` model type as a proper FCF-based DCF.

## Context — read these first

- `backend/src/main/java/com/conviction/valuation/strategy/DCFStrategy.java`
  — the current DCF implementation (has a mathematical flaw, detailed below)
- `backend/src/main/java/com/conviction/valuation/strategy/` — all strategy
  files; follow the same `@Component` / `ValuationStrategy` interface pattern
- `backend/src/main/java/com/conviction/valuation/enums/ValuationModelType.java`
  — `OWNER_EARNINGS` already exists as an enum value but has no strategy
  class; it currently falls back to DCF via `resolveStrategy()`
- `backend/src/main/java/com/conviction/valuation/service/ValuationService.java`
  — wires strategies by model type, runs `calculatePresets()` with hardcoded
  DCF bear/base/bull assumptions (also needs updating)
- `backend/src/main/java/com/conviction/valuation/dto/ValuationRequest.java`
  — current inputs: symbol, modelType, caseType, currentPrice,
  earningsPerShare, growthRatePercent, discountRatePercent, years,
  terminalMultiple
- `backend/src/main/java/com/conviction/valuation/entity/ValuationScenario.java`
  — persisted scenario; check if it needs a new field for FCF per share
- `frontend/src/pages/Research.tsx` — the valuation form section (~line 603
  onward); currently shows 6 input fields and a model selector with
  DCF/PEG/GRAHAM/CRYPTO_RISK; uses `formVals` state and `handleRunValuation`/
  `handleRunPresets` to call the backend

## Problem 1 — DCF math is incomplete

The current `DCFStrategy.calculateIntrinsicValue()` only discounts the
**terminal value at year N** — it ignores all intermediate cash flows from
years 1 through N-1. This significantly undervalues companies in early years
and is technically incorrect.

A proper multi-stage DCF should sum:
1. The present value of each year's projected cash flow (years 1 to N)
2. Plus the present value of the terminal value at year N

Correct formula:

```
IV = Σ(i=1 to N) [ EPS × (1+g)^i / (1+d)^i ]
   + [ EPS × (1+g)^N × terminalMultiple / (1+d)^N ]
```

Where:
- `g` = growthRatePercent / 100
- `d` = discountRatePercent / 100
- `N` = years

Fix `DCFStrategy` to implement this complete summation. Keep the same input
fields (`earningsPerShare`, `growthRatePercent`, `discountRatePercent`,
`years`, `terminalMultiple`) — no changes to `ValuationRequest` needed for
this fix.

## Problem 2 — Activate OWNER_EARNINGS as FCF-based DCF

`OWNER_EARNINGS` is defined in the enum but has no strategy and falls back to
DCF. Implement it properly as a **Free Cash Flow per share DCF** — same
corrected formula as above, but using `freeCashFlowPerShare` as the base
instead of `earningsPerShare`.

FCF-based DCF is the more conservative, Buffett-style valuation: it uses
actual cash generation rather than reported earnings, which can be distorted
by accounting choices. For capital-intensive businesses, FCF and EPS can
diverge significantly — offering both models is useful.

### Changes needed:

**Backend:**
1. Add `freeCashFlowPerShare` (nullable `BigDecimal`) to `ValuationRequest`
   — it's only used by `OWNER_EARNINGS`; all other models can pass null.
2. Add `freeCashFlowPerShare` to `ValuationPresetRequest` as well (used when
   running bear/base/bull presets for this model).
3. Check `ValuationScenario` entity — if you want to persist the FCF-per-share
   input for history/display, add the field there too. If `ddl-auto=update`
   handles the column addition automatically, that's fine; just make sure
   existing rows handle null gracefully.
4. Create `OwnerEarningsStrategy.java` in the strategy package — same
   `@Component` / `ValuationStrategy` pattern as the others, model type
   `OWNER_EARNINGS`, using the corrected DCF formula with
   `freeCashFlowPerShare` as the base. Guard against null/zero FCF gracefully
   (return zero or throw a clear validation error if FCF per share is missing).
5. Update `calculatePresets()` in `ValuationService` to also generate
   bear/base/bull presets for `OWNER_EARNINGS` when FCF per share is provided
   — use the same growth/discount/multiple assumptions as the DCF presets
   (bear: 4% growth / 11% discount / 16x; base: 8% growth / 10% discount /
   22x; bull: 12% growth / 9% discount / 28x). The preset endpoint response
   can return both DCF and OWNER_EARNINGS sets together, or a separate call
   pattern — your call on the cleanest approach.

**Frontend (`Research.tsx`):**
1. Add `"OWNER_EARNINGS"` to the `MODELS` array and add a label like
   `"Owner Earnings (FCF)"` to `MODEL_LABELS`.
2. Add a `freeCashFlowPerShare` field to `formVals` state (default empty).
3. Show the FCF per share input in the form conditionally — only when
   `OWNER_EARNINGS` is the selected model (hide/replace the EPS field since
   FCF is the base for this model, or show both and let the strategy ignore
   whichever isn't relevant).
4. Pass `freeCashFlowPerShare` in the fetch body to `POST /api/valuations`.
5. **Auto-populate FCF per share from sync data**: check if the sync response
   (`data.metrics` in `syncFromFMP`) includes a `freeCashFlowPerShare` field
   from FMP's key-metrics — if it does, pre-fill the form field the same way
   EPS gets pre-filled from `data.metrics.epsTTM`. If not available in the
   existing sync response, check `FMPKeyMetricsSync` to see if the field is
   already mapped; if not, add it there (FMP's `/key-metrics-ttm` typically
   includes `freeCashFlowPerShare`).

## Conventions / constraints

- Keep the Strategy pattern intact — one `@Component` per model, auto-wired
  by `ValuationService` via the map of model types. Don't add if/else logic
  into `ValuationService` for model-specific behaviour.
- Match existing BigDecimal precision/rounding conventions (`HALF_UP`,
  scale 2 for output, scale 8 for intermediate calculations).
- Don't touch PEG, GRAHAM, or CRYPTO_RISK — only DCF and OWNER_EARNINGS.
- The `ddl-auto=update` setting means new nullable columns are picked up
  automatically — no migration file needed, but make sure new fields have
  appropriate `@Column(nullable = true)` annotations.
- Match existing dark/gold theme and form layout conventions in `Research.tsx`.

## Note on verification

The sandbox can't reach Maven Central so a full `./mvnw package` build can't
run — please verify the Java compiles logically (imports, BigDecimal ops,
strategy registration) and flag anything uncertain for a local build check.
