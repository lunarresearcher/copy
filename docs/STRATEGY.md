# Strategy: what COPY is deciding

COPY is not a “wallet bought → copy immediately” engine. The profitable wallet is the **source**, not the permission. A candidate still has to fit the market-flow box, the local exposure box, and the paper budget.

The defaults below are demonstration / paper settings. They are not a profitability claim and are not investment advice.

## 1. Source: COPY DNA

The Fomo leaderboard is normalized into a local hunter set. `walletScore()` converts the available leaderboard fields into the `COPY DNA` value shown in the terminal.

The default source wall is:

```text
EDGE: COPY DNA >= 58
```

No matching profit source means the candidate is refused with `no confirmed profit source`.

COPY score for the token is still displayed as context, but it is not the rule that opens a paper position.

## 2. Market flow walls

For a token with market cap `M`, liquidity `L`, 24h volume `V`, 24h change `C`, and current price `P`:

| Wall | Formula | Default | Refusal example |
| --- | --- | ---: | --- |
| `EDGE` | source COPY DNA | `>= 58` | `source edge 51 < 58` |
| `DEPTH` | `L / M × 100` | `>= 1.00%` | `depth 0.62% < 1.00%` |
| `TURN` | `V / L` | `>= 0.45×` | `turnover 0.18x < 0.45x` |
| `MOMO` | `C` | `-15% … +38%` | `momentum +52.0% outside -15%…+38%` |
| `PRICE` | `P > 0` | required | `price feed unavailable` |

All five walls are evaluated by `src/cli/rules.mjs`. A failed wall adds a human-readable reason. The terminal surfaces the first reason; JSON output includes the full array.

## 3. Exposure walls

Passing market flow is not enough if the local paper box is full.

| Rule | Default |
| --- | ---: |
| maximum open positions | `5` |
| size per paper copy | `0.012 ETH` |
| session paper budget | `0.080 ETH` |

The same decision function refuses a new paper entry when:

```text
open positions >= maxPositions
```

or:

```text
spentEth + buySizeEth > sessionBudgetEth
```

`spentEth` is a session accounting guard for the local paper store. It is not an on-chain wallet balance.

## 4. Entry

A `FIRE` candidate can become a `PAPER` position from the TUI with `space` or automatically inside `copy paper`.

The entry stores:

- token address and symbol;
- source trader name / handle;
- current market price as `entryPrice`;
- configured paper size;
- open timestamp;
- peak PnL initialized at zero.

No transaction is created by the CLI paper path.

## 5. Marks and exits

Open positions are re-marked from the current token price:

```text
PnL % = (currentPrice / entryPrice - 1) × 100
```

`peakPct` only moves upward. The default exit box is:

| Exit | Default | Trigger |
| --- | ---: | --- |
| take profit | `+65%` | `pnlPct >= 65` |
| stop loss | `-22%` | `pnlPct <= -22` |
| trailing | `18%` | current PnL falls at least 18 points below a positive peak |
| max hold | `32 min` | wall-clock time since paper entry reaches the limit |

When an exit triggers, the position moves from `positions` to `closed` with an exit reason.

## 6. SHADOW is not PAPER

The COPY WALLETS desk intentionally separates analytical mirrors from positions:

- `SHADOW` = a passing source/token pair that COPY can mark over time;
- `PAPER` = a local position that consumes the paper exposure box;
- `R-SHDW` = a showcase replay mirror.

A SHADOW row does not prove the trader bought at COPY's stored entry price. It is a local analytical mark. That distinction is why the label exists.

## 7. Live candidate sources

A candidate can be built from several normalized inputs:

1. a verified bootstrap trader/token relationship;
2. a wallet trade returned by a configured Fomo read source;
3. a discovered market with no confirmed trader yet.

A market-only candidate normally fails `EDGE` until a profit source is attached.

New market responses are merged into the session. A shorter provider response does not erase the longer local universe.

## 8. Replay strategy

`copy terminal --demo` uses the same wall evaluator but adds deterministic replay-only markets and wallet mirrors. It exists so the terminal can demonstrate motion without external APIs.

Replay invariants:

- replay token addresses use the `replay:` namespace;
- events begin with `REPLAY`;
- replay shadow rows render as `R-SHDW`;
- replay activity is never converted into a live `BUY`, `SELL`, or executed position.

## Changing the defaults

The normalized defaults live in `src/cli/rules.mjs`. `setRules()` persists overrides into the local runtime store when the UI or another local caller changes them.

Treat changes as changes to **your own model**, not as tuning toward a promised return. The point of the refusal log is that every relaxed wall should be visible and deliberate.
