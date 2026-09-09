# COPY strategy / flow box

COPY v1.4 intentionally does **not** use the old generic score + market-cap + liquidity gate. The terminal keeps COPY score as context, while permission is based on copytrade flow quality.

## Discovery walls

1. **EDGE** — the confirmed profit source needs COPY DNA >= 58.
2. **DEPTH** — liquidity / market cap must be >= 1.00%.
3. **TURN** — 24h volume / liquidity must be >= 0.45x.
4. **MOMO** — 24h move must stay inside -15% to +38%.
5. **PRICE** — a current market price is required before a paper copy can open.

## Paper box

- size: 0.012 ETH
- max open: 5
- session budget: 0.080 ETH
- take profit: +65%
- stop loss: -22%
- trailing: 18%
- max hold: 32 min

These are defaults for the local paper engine and showcase, not a profitability recommendation.

## Mirror desk

`SHADOW` is an analytics mark for a passing source/token pair. `PAPER` is a local paper position. In `--demo` / showcase mode, replay mirrors are explicitly labeled `R-SHDW`; up to ten are rotated and re-marked so the terminal can be recorded without pretending those events are live trades.
