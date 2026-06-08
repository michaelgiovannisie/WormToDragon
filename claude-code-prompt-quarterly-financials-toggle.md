# Prompt for Claude Code

Add an Annual / Quarterly toggle to the "Key Metrics" financial charts on the
Research page (asset detail page).

## Context — read these first

- `backend/src/main/java/com/conviction/financials/FinancialsController.java`
  — owns `GET /api/financials/{symbol}` (read from DB) and
  `POST /api/financials/{symbol}/sync` (fetch from FMP + persist). The sync
  method calls FMP's `/income-statement`, `/balance-sheet-statement`,
  `/cash-flow-statement`, and `/key-metrics` with `limit=5` (annual only,
  FMP's default period).
- `backend/src/main/java/com/conviction/financials/FinancialSnapshot.java`
  and its repository — current schema is one row per `(symbol, fiscalYear)`.
- `frontend/src/pages/Research.tsx` — the "Financials" section
  (~line 403–507) renders three sub-tabs (profitability / growth / health),
  each showing four `MetricChart` bar charts driven off `financials` state,
  which is populated from `GET /api/financials/{symbol}` on load and
  refreshed from the sync response's `annual` array.

## Design decisions already made (please follow these, don't relitigate them)

1. **Toggle, not duplicate sections.** Add a simple Annual/Quarterly toggle
   next to the existing profitability/growth/health tabs. It swaps the
   underlying data for the *same* chart grid — don't create a second stacked
   copy of the whole financials block.
2. **Both periods are fetched together on "Sync from FMP," not lazily on
   toggle.** The toggle must be an instant, free, client-side switch over
   data that's already loaded — it should never trigger a new network
   request. This keeps "Sync" as the single, predictable, user-controlled
   action that costs FMP API calls (consistent with how the rest of the app
   treats FMP usage as a scarce resource).
3. **Quarterly shows a shorter window than annual.** Annual currently shows
   ~10 years; quarterly should default to roughly 8–12 most recent quarters
   (~2–3 years), not a mirrored 10-year span — that would be ~40 bars and
   unreadable in the current chart layout (`barSize={20}`, 180px height).
   Match the rough bar density of the annual view so toggling between them
   feels visually consistent.

## Backend changes

1. **Add a `period` column to `FinancialSnapshot`** (e.g. `"annual"` /
   `"quarter"`, or reuse FMP's own `"FY"` / `"Q1".."Q4"` convention — your
   call, but be consistent). Update the unique-lookup
   (`findBySymbolAndFiscalYear` or equivalent) so annual and quarterly rows
   for the same symbol/year don't collide or overwrite each other — the
   lookup key needs to include `period`.
2. **Update `syncFinancials`** to call the four FMP statement endpoints
   *twice* per sync: once for annual (current behavior, `limit=5` or your
   chosen window) and once with FMP's `period=quarter` query param (use a
   `limit` that comfortably covers ~8–12 quarters, e.g. `limit=12`). Persist
   both sets, tagging each saved `FinancialSnapshot` with the right `period`.
3. **Update `getFinancials`** (and the `FinancialsResponse`/`AnnualRow`
   records as needed) to return both annual and quarterly series — e.g. add
   a `quarterly` list alongside the existing `annual` list in the response,
   or add a `period` query param to filter. Pick whichever is cleaner given
   how the frontend will consume it (see below — I'd lean toward returning
   both lists in one response so the toggle never refetches).
4. Keep using the existing `FMPClient.get()` wrapper and the same
   field-mapping logic (`bd`, `pct`, `ratio`, `divide` helpers) — just
   parameterize the period.

## Frontend changes

1. Add an Annual/Quarterly toggle control near the existing
   profitability/growth/health tab buttons in the Financials section of
   `Research.tsx` (reuse the same pill-button styling pattern already used
   for `finTab`).
2. Store both annual and quarterly rows in state (from the single
   `GET /api/financials/{symbol}` load and from the sync response). Add a
   `finPeriod` (or similar) state value — `"annual" | "quarter"` — and have
   the existing `mapped`/`charts` logic select from the right series based
   on it. No new fetch should fire on toggle click.
3. Reuse the existing `MetricChart` component, `barColor` trend logic, and
   `bil`/formatter helpers as-is — just feed them the quarterly series when
   that toggle is active. Adjust the x-axis label formatter for quarters
   (e.g. "Q1 '24" instead of just the year) so bars are distinguishable.
4. Make sure the section header ("Key Metrics (Annual)") reflects the active
   period.

## Conventions / constraints

- Match existing code style, formatting, and the dark/gold theme constants
  (`C.gold`, `C.muted`, `C.green`, `C.red`, etc.) already used in
  `Research.tsx`.
- Don't change the "Sync from FMP" button's user-facing behavior beyond what's
  needed to also persist quarterly data — it's fine for sync to now make more
  FMP calls (8 instead of 4 for financials), but don't add any *additional*
  silent background fetches anywhere else.
- No DB migration framework is in place (`spring.jpa.hibernate.ddl-auto=update`)
  — a new column on `FinancialSnapshot` will be picked up automatically, just
  make sure existing rows handle a null/default `period` gracefully (treat
  null as `"annual"` for backwards compatibility with already-synced data).

## Note on verification

The sandbox can't reach Maven Central, so a full `./mvnw package` build can't
be run in an isolated environment — please do your best to verify the Java
compiles logically (correct imports, types, repository method signatures) and
flag anything you're unsure will compile so it can be checked with a local
build afterward.
