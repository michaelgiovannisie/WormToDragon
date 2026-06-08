# Prompt for Claude Code

Add a "Sync NASDAQ-100" feature: a button (shown on the Dashboard, Holdings,
and Research pages) that kicks off a background batch sync of all ~100
NASDAQ-100 constituent symbols — profile, key metrics, historical prices, and
financial statements (annual + quarterly) — with a visible progress indicator.

## Context — read these first

- `backend/src/main/java/com/conviction/fmp/FMPSyncController.java` — already
  has `syncAllHoldings()`, which loops over a symbol list calling
  `profileSync.sync()`, `keyMetricsSync.sync()`, `historicalSync.syncFull()`,
  with per-symbol try/catch so one failure doesn't kill the batch. This is the
  closest existing pattern — reuse its structure and fault-tolerance approach.
- `backend/src/main/java/com/conviction/fmp/FMPClient.java` — the shared FMP
  HTTP wrapper (`get()` with query params, base URL + API key from
  `application.properties`).
- `backend/src/main/java/com/conviction/financials/FinancialsController.java`
  — the financials sync logic (now fetches annual + quarterly per the recent
  toggle feature) — reuse this for each symbol's financial statements.
- Frontend: `frontend/src/pages/Dashboard.tsx`, `Holdings.tsx`,
  `Research.tsx` — the three pages that should show the button. Look at how
  `Research.tsx` implements its existing "Sync from FMP" button/status message
  for the UI conventions (loading state, status text, theme colors `C.*`) to
  match.

## Why this needs to be a background job, not a simple click handler

A full NASDAQ-100 sync is roughly 100 symbols × ~11 FMP calls each
(profile + metrics + historical prices + 8 financial-statement calls for
annual/quarterly) ≈ **~1,100 calls**, taking **5–8 minutes** even on a
300-calls/minute plan. That's far too long for a synchronous HTTP request —
it must run asynchronously in the background, with the frontend polling for
progress. Please design it accordingly from the start; don't build it as a
long-blocking endpoint.

## Backend requirements

1. **Symbol source**: find the right FMP endpoint for NASDAQ-100 constituents
   (check FMP's index/constituent endpoints — verify which one actually
   returns the NASDAQ-100 list specifically, as opposed to the full NASDAQ
   composite). Fetch this list fresh each run (don't hardcode the 100 symbols,
   since index membership changes periodically) — but cache/reuse it for the
   duration of a single batch run rather than re-fetching mid-job.

2. **Background execution**: use Spring's `@Async` (with a configured
   `ThreadPoolTaskExecutor`, single thread is fine — we want sequential,
   throttled calls, not parallel bursts) so the "start" endpoint returns
   immediately while the sync runs in the background.

3. **Throttling**: actively pace the calls to stay safely under the 300
   calls/minute cap — target roughly 4 calls/second (~240/minute), leaving
   headroom for normal interactive use (e.g., someone using the Research page
   "Sync from FMP" button while this batch job runs). A simple sleep/delay
   between calls is sufficient; no need for a sophisticated rate-limiter
   library at this scale.

4. **Progress tracking**: maintain in-memory job state (a single-user personal
   app doesn't need a DB-backed job table) — e.g., status
   (`idle`/`running`/`completed`/`failed`), symbols completed, total symbols,
   current symbol, and a list of any per-symbol failures. Expose:
   - `POST /api/fmp/sync-nasdaq100` — starts the job (no-op / returns a
     "already running" response if one is already in progress; only one batch
     job should run at a time)
   - `GET /api/fmp/sync-nasdaq100/status` — returns current progress, for the
     frontend to poll
   Guard against concurrent runs (e.g., an `AtomicBoolean` or similar) since
   this is a shared, expensive operation.

5. **Per-symbol fault tolerance**: mirror `syncAllHoldings` — wrap each
   symbol's sync in try/catch, record failures, and continue the loop. One bad
   symbol shouldn't abort the whole run.

6. **Reuse, don't duplicate**: call into the existing `FMPProfileSync`,
   `FMPKeyMetricsSync`, `FMPHistoricalPriceSync`, and the financials sync logic
   for each symbol — don't reimplement the FMP-fetching/mapping logic.

## Frontend requirements

1. **Shared component**: build one reusable component/hook for the button +
   progress indicator (e.g., a small card showing "Syncing NASDAQ-100... 47/100
   (AAPL)" with a progress bar, plus a "Sync NASDAQ-100" button when idle), and
   render it on Dashboard, Holdings, and Research. Don't duplicate the
   polling/state logic three times — share it.
2. **Polling**: while a job is running, poll `GET
   /api/fmp/sync-nasdaq100/status` on an interval (e.g., every 2–3 seconds) to
   update the progress display; stop polling when the job completes or fails.
3. **Idle/running/done states**: show a plain button when idle, a progress
   indicator while running (with the option to navigate away and have it keep
   running in the background — the polling should pick back up if the user
   returns to a page with the component while a job is in progress), and a
   brief completion summary (e.g., "Synced 98/100 — 2 failed: TSLA, ABNB")
   when done.
4. **Styling**: match the existing dark/gold theme constants (`C.gold`,
   `C.muted`, `C.green`, `C.red`, ets.) and component conventions already used
   on these pages.
5. **Don't block other UI**: this is a long-running background process — the
   rest of each page should remain fully usable while it runs.

## Conventions / constraints

- Match existing code style and patterns throughout (the codebase already has
  good examples of FMP sync controllers, async-ish batch loops, and themed
  React components — follow them).
- Be conservative with the throttle — it's better to run a bit slower and stay
  well clear of the rate limit (and leave headroom for normal interactive FMP
  usage) than to risk 429s mid-batch.
- No new infrastructure dependencies (job queues, schedulers, external
  libraries) — this is a personal single-user app; in-memory state and a
  simple async method are sufficient.

## Note on verification

The sandbox can't reach Maven Central, so a full `./mvnw package` build can't
be run in isolation — please verify the Java compiles logically (imports,
types, bean wiring for `@Async`/executor config) and flag anything uncertain
so it can be checked with a local build afterward.
