# Conviction — Intended Full UML (Target Architecture)

> **Update (2026-06-08):** Claude Code has since closed several of the gaps originally
> listed below. See the "Status update" note at the bottom — `Asset` is now a real
> inheritance hierarchy, `HistoricalPrice` exists, and `ValuationScenario` now carries a
> proper FK to `Asset`. `PortfolioSnapshot` still uses a loose `portfolioId: UUID`.


This is the complete domain model Conviction was designed to become — combining what's
already built with the features and patterns from the original design discussion that
haven't been implemented yet. Status tags: `[BUILT]`, `[PARTIAL]`, `[PLANNED]`.

```
┌──────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
│      User        │ 1     * │      Portfolio        │ 1     * │       Account        │
│ [BUILT]          │─────────│ [BUILT]              │─────────│ [BUILT]              │
│──────────────────│         │──────────────────────│         │──────────────────────│
│ id, email        │         │ name, benchmark      │         │ accountName          │
│ username         │         │ taxStrategy: String  │         │ brokerName           │
│ passwordHash     │         │ active               │         │ accountType          │
│ timezone/country │         │ user_id: FK          │         │ portfolio_id: FK     │
│ taxRegion        │         └──────────────────────┘         └─────────┬────────────┘
└──────────────────┘                                                    │
                                                          ┌─────────────┼──────────────┐
                                                       1..*│           1│..*           │
                                              ┌────────────▼───┐  ┌─────▼──────────┐
                                              │  Transaction   │  │    Holding     │
                                              │ [BUILT]        │  │ [BUILT]        │
                                              │ source-of-truth│  │ derived/cached │
                                              └───────┬────────┘  └────────────────┘
                                                      │
                              ┌───────────────────────┼─────────────────────────┐
                          BUY │ 1──1                   │                  SELL   │ 1──*
                       ┌──────▼──────┐         ┌──────▼────────────────┐
                       │   TaxLot     │ 1    * │   TaxLotAllocation     │
                       │ [BUILT]      │────────│ [BUILT]               │
                       └──────────────┘        └───────────────────────┘
```

## Asset hierarchy — `[PARTIAL → PLANNED]`

Currently `Asset.assetType` is a plain String column. The original design called for real
OOP inheritance:

```
                    ┌──────────────────────────┐
                    │          Asset            │  [BUILT, but flat — no subclasses]
                    │ id, symbol, name          │
                    │ exchange, currency        │
                    └────────────┬──────────────┘
                                 │ inheritance [PLANNED]
              ┌──────────────────┼──────────────────┐
        ┌─────▼─────┐      ┌─────▼─────┐      ┌─────▼─────┐
        │  Equity   │      │    ETF    │      │  Crypto   │   [PLANNED]
        │ sector    │      │ expenseRatio│    │ network   │
        │ industry  │      │ holdings[] │     │ maxSupply │
        └───────────┘      └───────────┘      └───────────┘

Asset 1 ──── * HistoricalPrice   [PLANNED — for charting & valuation history]
```

## Strategy pattern layer — `[PLANNED]`

This is the part of the original UML review that never got implemented. It's what turns
"hardcoded FIFO" into a real polymorphic tax/valuation engine:

```
╔═══════════════════════════╗   ╔════════════════════════════╗   ╔══════════════════════════╗
║   <<interface>>           ║   ║   <<interface>>            ║   ║   <<interface>>          ║
║   TaxStrategy             ║   ║   ValuationStrategy        ║   ║   DCARecommendationStrategy║
║───────────────────────────║   ║────────────────────────────║   ║──────────────────────────║
║ + allocate(sell, lots)    ║   ║ + value(asset, inputs)     ║   ║ + recommend(profile)     ║
╚═══════════╦═══════════════╝   ╚════════════╦═══════════════╝   ╚════════════╦═════════════╝
            │ implements                     │ implements                     │ implements
   ┌────────┼─────────┐         ┌────────────┼─────────────┐      ┌───────────┼────────────┐
┌──▼───┐┌───▼───┐┌────▼──────┐ ┌▼─────────┐┌─▼─────────┐┌──▼─────┐┌──▼──────────┐┌▼──────────┐┌▼────────────┐
│FIFO  ││ LIFO  ││SpecificLot│ │DCFStrategy││PEGStrategy││Graham  ││ValueFocused ││RiskAdjusted││Aggressive   │
│Strategy│Strategy││Strategy │ │           ││           ││Strategy││DCA          ││DCA         ││GrowthDCA    │
└──────┘└───────┘└───────────┘ └──────────┘└───────────┘└────────┘└─────────────┘└────────────┘└─────────────┘
                                ┌──────────────────┐
                                │ CryptoRiskStrategy│
                                └──────────────────┘
```

Today: FIFO logic is hardcoded directly in `ProjectionRebuildService` / `TransactionService`.
The `taxStrategy: String` field exists on `Portfolio` but nothing dispatches on it — that's
the seam where `TaxStrategy` would plug in.

## Other planned domain pieces (from the README roadmap, not yet modeled)

```
┌──────────────────────┐        ┌───────────────────────┐
│      Watchlist        │        │   AssetComparison      │
│ [PLANNED]             │        │ [PLANNED]              │
│ user_id: FK           │        │ assetIds: UUID[]       │
│ items: Asset[]        │        │ metrics snapshot       │
└──────────────────────┘        └───────────────────────┘

┌──────────────────────┐        ┌───────────────────────┐
│   BenchmarkSeries     │        │  DCASimulationResult   │
│ [PLANNED]             │        │ [PLANNED]              │
│ symbol (e.g. SPY)     │        │ strategy, schedule     │
│ historicalReturns[]   │        │ projectedOutcome       │
└──────────────────────┘        └───────────────────────┘
```

`ValuationScenario` and `PortfolioSnapshot` exist today `[BUILT]` but use loose
`symbol`/`portfolioId` String/UUID references instead of real FKs — worth tightening
once the Asset hierarchy lands, since a real FK to `Asset` is what lets
`ValuationStrategy` implementations dispatch by asset subtype (e.g. `CryptoRiskStrategy`
only makes sense once `Asset` actually has a `Crypto` subclass to check against).

## Relationship summary (target state)

```
User              1 ── *  Portfolio
Portfolio         1 ── *  Account
Account           1 ── *  Transaction
Account           1 ── *  Holding
Asset             1 ── *  Transaction / Holding / TaxLot / HistoricalPrice
Transaction(BUY)  1 ── 1  TaxLot
Transaction(SELL) 1 ── *  TaxLotAllocation
TaxLot            1 ── *  TaxLotAllocation
Asset             ◁── inherits ── Equity | ETF | Crypto
TaxStrategy       ◁── implements ── FIFOStrategy | LIFOStrategy | SpecificLotStrategy
ValuationStrategy ◁── implements ── DCFStrategy | PEGStrategy | GrahamStrategy | CryptoRiskStrategy
DCARecommendationStrategy ◁── implements ── ValueFocusedDCA | RiskAdjustedDCA | AggressiveGrowthDCA
```

## Gap summary — what separates "intended" from "current"

1. ~~**Asset is flat, not polymorphic.**~~ **RESOLVED.** `Asset` now uses
   `@Inheritance(strategy = SINGLE_TABLE)` with a `asset_type` discriminator column, and
   `Equity` (`sector`, `industry`, `marketCap`, `peRatio`, `eps`), `ETF`
   (`expenseRatio`, `underlying`, `fundFamily`), and `Crypto` (`network`,
   `consensusType`, `circulatingSupply`, `marketCapRank`) all extend it as real
   subclasses. `HistoricalPrice` also exists now, with a proper `@ManyToOne` FK to
   `Asset` and a unique constraint on `(asset_id, price_date)`.
2. **Strategy pattern — mostly resolved.** `TaxStrategy` / `FIFOStrategy` /
   `LIFOStrategy` / `SpecificLotStrategy` exist and `TaxLotService` dispatches through a
   `Map<String, TaxStrategy>` (Claude wired the dispatch to read `Portfolio.taxStrategy`
   on 2026-06-08). `ValuationStrategy` work has also started — there's now a
   `CryptoRiskStrategy` in `valuation/strategy/`. `DCARecommendationStrategy` and its
   three implementations are still not present.
3. **Loose references — half resolved.** `ValuationScenario` now has a real
   `@ManyToOne Asset asset` FK (`asset_id` column) alongside the legacy `symbol: String`
   field. `PortfolioSnapshot` is **still unresolved** — it stores a bare
   `portfolioId: UUID` with no `@ManyToOne Portfolio` relation.
4. **README features with no domain model yet:** Watchlist, Asset comparison, benchmark
   comparison series, DCA simulation results.

## Status update (2026-06-08)

Claude Code made real progress on the architecture gaps since this doc was written:

- Asset inheritance hierarchy (`Equity`/`ETF`/`Crypto` extending `Asset`) — done, matches
  the original UML almost exactly (the discriminator-column approach is a clean,
  idiomatic JPA implementation of it).
- `HistoricalPrice` entity — done, properly tied to `Asset` via FK.
- `ValuationScenario` → `Asset` FK — done (the `symbol` field is still there too,
  presumably kept for backward compatibility / display convenience).
- `CryptoRiskStrategy` — a `ValuationStrategy` implementation now exists, suggesting
  that interface is taking shape even if not all pieces are visible yet.

Remaining open item from this list: **`PortfolioSnapshot.portfolioId` is still a raw
UUID, not a `@ManyToOne Portfolio` FK.** That's a quick, low-risk fix — adding the
relation and a migration to backfill/rename the column.
