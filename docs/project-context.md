# Project Context

## Product

Conviction is a portfolio intelligence and investment research platform for serious retail investors. The product philosophy is to provide tools, not buy/sell answers.

Core areas:

- Portfolio management across portfolios and accounts
- Asset research and market data
- Investment analysis and valuation modeling
- Transaction tracking and tax-aware cost basis
- Dashboard analytics for holdings, allocation, and performance

## Architecture Direction

The backend is organized by business domain rather than by technical layer.

Current domain structure includes:

- `auth`
- `portfolio`
- `account`
- `asset`
- `assetdetail`
- `transaction`
- `holding`
- `marketdata`
- `imports`
- `valuation`

The target model uses transactions as the source of truth and holdings as a derived projection.

## UML Notes From Prior Review

The prior UML/database model was considered mostly sound, especially:

- `Asset` inheritance with `Equity`, `ETF`, and `Crypto`
- `User -> Portfolio -> Account` ownership hierarchy
- Separation between `Transaction` and `Holding`
- Use of `TaxLot` and `TaxLotAllocation`
- `HistoricalPrice` related to `Asset` rather than modeled through inheritance
- Strategy pattern concepts for tax, valuation, and DCA recommendation logic

Recommended cleanup before treating the UML as final:

- Add explicit cardinality on relationships:
  - `User 1 -> * Portfolio`
  - `Portfolio 1 -> * Account`
  - `Account 1 -> * Transaction`
  - `Account 1 -> * Holding`
  - `Asset 1 -> * HistoricalPrice`
  - `Asset 1 -> * Transaction`
  - `Asset 1 -> * Holding`
- Show concrete strategy classes implementing their interfaces:
  - `FIFOStrategy`, `LIFOStrategy`, `SpecificLotStrategy` implement `TaxStrategy`
  - `DCFStrategy`, `PEGStrategy`, `GrahamStrategy`, `CryptoRiskStrategy` implement `ValuationStrategy`
  - `ValueFocusedDCA`, `RiskAdjustedDCA`, `AggressiveGrowthDCA` implement `DCARecommendationStrategy`
- Add the missing `Transaction -> TaxLot` relationship:
  - Buy transaction creates one tax lot
- Add the missing sell allocation relationships:
  - Sell transaction has many tax lot allocations
  - Each tax lot allocation points to one tax lot
- Make `HistoricalPrice` direction clear:
  - Many historical prices belong to one asset
- Optionally add an enum section for `TransactionType` values such as `BUY`, `SELL`, `DIVIDEND`, `TRANSFER_IN`, `TRANSFER_OUT`, `INTEREST`, and `FEE`

## Implementation Guidance

Keep the service layer domain-oriented. Add abstractions only when they match a real domain concept or remove meaningful complexity.

For tax behavior, preserve the accounting distinction:

- A buy transaction creates inventory through a tax lot.
- A sell transaction consumes inventory through tax lot allocations.
- Holdings are calculated from transaction history or maintained as projections, not treated as the source of truth.

For valuation behavior, strategy interfaces are appropriate when multiple valuation methods need to share one orchestration flow.
