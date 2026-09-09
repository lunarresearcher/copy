# COPY

> **A live-first Robinhood Chain copytrade terminal. Fomo finds the wallet. COPY keeps scanning, scores the token, explains the refusal, and tracks the paper mirror.**

![COPY terminal](./assets/terminal.png)

COPY is CLI-first. The website is only a wrapper around the same data/services.

```bash
git clone <your-repo-url>
cd copy
npm install
cp .env.example .env
npm start
```

`npm start` opens the full-screen **COPY // COPYBARA terminal** directly in your terminal.

Node 20+ is enough. There are no npm runtime dependencies.

## The terminal does not sit still

The v1.4 terminal is built around a moving event stream rather than a static table. COPYBARA now runs beside the COPY wordmark while the scanner is active.

While the engine is running it continuously writes:

```text
NEW      new Robinhood market discovered
BUY      confirmed Fomo wallet buy read
SELL     confirmed Fomo wallet sell read
MOVE     market price / volume changed on refresh
SCAN     COPYBARA re-evaluated one token against the walls
COPY     a paper copy was opened
PNL      an open paper copy received a new market mark
EXIT     TP / SL / trailing / clock / manual exit
SYNC     provider refresh completed
```

New token addresses are merged into the session instead of replacing the old list. The intake can come from Fomo wallet activity, Fomo trending data when configured, and Robinhood markets discovered by DEX data.

Even during a quiet market the scanner keeps rotating through the current universe and printing its decision. It never invents a live trade just to make the screen move.

## COPY WALLETS

The bottom desk is now a dense **10-line mirror desk** in showcase mode and grows from confirmed trader/token pairs in live mode. It shows two different things explicitly:

- **SHADOW** — a local mark of a passing profitable-wallet/token pair. It is analytics only and does not claim a trade was executed.
- **PAPER** — a paper copy you actually opened with `space`.

Both are re-marked from refreshed token prices. The terminal shows current PnL, the change since the previous mark, and a tiny session sparkline.

Example:

```text
R-SHDW @ether_monk      → $CASHCAT   +4.18%  Δ+0.22  ▁▂▃▄▆█
R-SHDW @threem          → $AI        -0.41%  Δ-0.13  ▆▅▄▃▂▁
R-SHDW @Ppricedin       → $CASHCAT  +13.26%  Δ+0.11  ▁▂▄▅▇█
PAPER  @DumbCrayonEater → $AI         +0.73%  Δ+0.09  ▁▁▂▄▅█
```

## Right side

The right pane now combines:

- selected token + trader read;
- COPY score;
- live event type and age;
- market cap / liquidity / 24h flow;
- clickable GMGN / Fomo / explorer links;
- COPY-native flow walls (source edge, depth ratio, turnover, momentum band, price mark);
- first refusal reason;
- live COPY desk;
- session counts for newly discovered markets, wallet trades, market moves and scanner passes;
- provider-refresh countdown;
- hot-market radar + session pulse;
- animated pixel COPYBARA beside the wordmark.

## Start it

```bash
npm start
```

Useful keys:

```text
↑ / ↓    move through the live event stream
f        ALL → FIRE → SKIP
space    open selected passing signal as a PAPER copy
c        track / untrack selected source
p        pause / resume scanner
r        refresh providers now
q        quit
```

The engine starts **running** by default.

## Showcase / recording mode

For a video, screenshot, demo call, or README capture:

```bash
npm run showcase
```

or:

```bash
copy terminal --demo
```

This mode is loudly labeled **REPLAY** in the header. It applies deterministic replay market ticks to the real bootstrap token set, rotates replay shadow-wallet entries, marks up to ten mirror PnLs, emits replay intake / mirror / PnL events, and keeps the right-side radar moving even when external providers are unavailable. Replay events are never labeled as live wallet trades.

## Raw scrolling mode

If you want the wall-of-text terminal look:

```bash
npm run hunt
```

It now prints the same ongoing event stream instead of dumping one static candidate list and waiting.

```bash
copy hunt --fire-only
copy hunt --for 300
copy hunt --json
```

## Live inputs

Without credentials COPY still has:

- last-known-good Fomo leaderboard bootstrap;
- public Fomo leaderboard refresh;
- keyless DEX discovery / prices / liquidity / volume;
- Robinhood Chain RPC health;
- scanner pulses and local paper bookkeeping.

For richer wallet-level activity configure one of the optional read paths in `.env`:

```bash
REPLYNODES_API_KEY=
# or
FOMO_BEARER_TOKEN=
```

With wallet activity available, a newly seen Fomo BUY/SELL becomes a real `BUY`/`SELL` event in the terminal and its token address is immediately fed into market enrichment.

## COPY FLOW BOX

The terminal no longer gates tokens with the old generic `score + max market cap + min liquidity` trio. v1.4 uses its own copytrade-oriented flow box:

```text
source edge             >= 58 COPY DNA
market depth            >= 1.00% liquidity / market cap
turnover                >= 0.45x 24h volume / liquidity
momentum band           -15% ... +38%
price mark              required

paper size              0.012 ETH
maximum open positions  5
session budget          0.080 ETH
take profit             +65%
stop loss               -22%
trailing                18%
max hold                32 min
```

These are demo/default paper rules, not a claim that they are profitable settings. A high COPY score is still displayed, but it is no longer the permission gate.

```text
profit source
    ↓
wallet event / market discovery
    ↓
EDGE → DEPTH → TURNOVER → MOMENTUM → PRICE
    ↓
FIRE / SKIP
    ↓
shadow mirror / PAPER copy
    ↓
live marks → PnL delta → exit rule
```

## Commands

```bash
npm run doctor
npm start
npm run hunt
npm run paper
npm run showcase
npm run web
```

Or install the local binary:

```bash
npm install -g .
copy terminal
copy hunt --fire-only
copy trader ether_monk
copy scan CASHCAT
copy positions
copy rules
copy doctor --probe
```

See [`docs/COMMANDS.md`](docs/COMMANDS.md), [`docs/STRATEGY.md`](docs/STRATEGY.md), and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Data honesty

The status header always distinguishes `LIVE`, `SNAPSHOT`, and `REPLAY`.

- a `BUY` / `SELL` line comes from wallet activity returned by a configured Fomo read source;
- `MOVE` comes from a changed market read or is explicitly labeled replay in demo mode;
- `SCAN` means the local decision engine evaluated a token, not that somebody traded it;
- `SHADOW` is analytics; in REPLAY it is rendered as `R-SHDW`;
- `PAPER` is a local paper position;
- no line is called an executed on-chain position without an execution receipt.

## Project layout

```text
bin/copy.mjs                CLI entrypoint
src/cli/runtime.mjs         live intake + event stream + paper marks
src/cli/render.mjs          full-screen TUI
src/cli/terminal.mjs        keyboard + timers
src/providers/              Fomo / Robinhood / DEX readers
src/services/               scoring + shared state
public/                     optional web wrapper
data/seed.json              last-known-good bootstrap
contracts/CopyRegistry.sol  optional on-chain rules registry
docs/                       commands, strategy, architecture, safety
```

## Test

```bash
npm test
```
