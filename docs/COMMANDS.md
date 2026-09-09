# Command reference

Every command the current COPY CLI exposes, plus the environment that changes live intake. The installed binary is `copy`; from a source checkout the matching npm scripts are shown where one exists.

No CLI command in this repository needs a signing key or broadcasts an on-chain trade.

| Command | What it does | Persistent writes |
| --- | --- | --- |
| `terminal` | interactive two-pane event terminal | tracking, paper positions, local rules |
| `hunt` | raw scrolling event / decision feed | none beyond normal runtime sync state |
| `paper` | automatic paper-copy loop + marks / exits | paper positions |
| `trader` | inspect one profit hunter | no |
| `scan` | inspect one known market | no |
| `positions` | open + recently closed paper positions | marks may update |
| `rules` | print current COPY flow / exposure rules | no |
| `doctor` | provider / chain health | no |
| `web` | optional wrapper + native queue server | backend cache / queue |

---

## terminal

```bash
copy terminal
copy terminal --demo
```

`copy terminal` starts the full-screen TUI. The scanner starts running immediately. `--demo` switches the runtime into explicit `REPLAY` mode.

Keys:

```text
↑ / ↓    select an event
f        cycle ALL / FIRE / SKIP
space    open selected FIRE candidate as PAPER
c        track / untrack selected source
p        pause / resume scanner
r        refresh providers immediately
q        quit
```

The terminal uses the same `CopyRuntime` as `hunt` and `paper`; it is a renderer, not a separate signal engine.

## hunt

```bash
copy hunt
copy hunt --fire-only
copy hunt --for 300
copy hunt --json
```

| Flag | Default | Meaning |
| --- | ---: | --- |
| `--fire-only` | off | print only events whose candidate verdict is `FIRE` |
| `--for <seconds>` | unlimited | stop after the requested wall-clock duration |
| `--json` | off | one JSON object per printed event instead of formatted terminal text |

JSON rows include the timestamp, event type, verdict, score, symbol, token, trader, message, refusal reasons, market cap and liquidity when those fields exist.

## paper

```bash
copy paper
copy paper --for 300
```

Loops over candidates, opens a local paper position for unseen `FIRE` candidates while the exposure box allows it, re-marks open positions every provider cycle, and closes on TP / SL / trailing / max hold.

| Flag | Default | Meaning |
| --- | ---: | --- |
| `--for <seconds>` | unlimited | stop the paper loop after this duration |

The paper loop sleeps 15 seconds between passes. It does not sign or broadcast.

## trader

```bash
copy trader ether_monk
```

Matches the supplied text against the current hunter handle / name and prints rank, COPY DNA, available 24h / 7d / 30d PnL fields, and a verified RH token snapshot when one exists.

## scan

```bash
copy scan CASHCAT
copy scan 0x1234...abcd
```

Finds a known market by symbol or exact token address after a provider refresh. Prints COPY score, market cap, liquidity, 24h volume / change, contract and external token links.

## positions

```bash
copy positions
```

Refreshes market data, marks open paper positions, then prints open positions and up to ten recent closes. Local paper state is stored in `data/runtime.json` unless `COPY_RUNTIME_FILE` points somewhere else.

## rules

```bash
copy rules
```

Prints every normalized field from the active rule set. Defaults live in `src/cli/rules.mjs`; persisted overrides live in the local runtime store.

## doctor

```bash
copy doctor
copy doctor --probe
```

`doctor` checks Node version and reports the current provider/bootstrap state. `--probe` performs a full `CopyRuntime.sync()` first, which attempts the configured Fomo, DEX and Robinhood RPC reads.

## web

```bash
copy web
# or
npm run web
```

Starts `server.mjs`, the optional browser wrapper and server-side native queue. This is separate from the CLI paper engine.

---

## npm scripts

```bash
npm start          # copy terminal
npm run terminal   # copy terminal
npm run hunt       # copy hunt
npm run paper      # copy paper
npm run doctor     # copy doctor --probe
npm run showcase   # copy terminal --demo
npm run web        # optional wrapper / API server
npm test           # local smoke + CLI behavior checks
```

## Environment

Copy `.env.example` to `.env` if you want to configure live providers. The source checkout also works from process environment variables supplied by your shell or deployment platform.

| Variable | Default | Used for |
| --- | --- | --- |
| `REPLYNODES_API_KEY` | empty | optional Fomo leaderboard, user trades and trending token reads |
| `REPLYNODES_FOMO_CHAIN` | `robinhood` | chain parameter for ReplyNodes Fomo reads |
| `FOMO_BEARER_TOKEN` | empty | optional direct Fomo API / stream read path |
| `RH_RPC_URL` | official Robinhood mainnet RPC | chain ID / server chain reads |
| `RH_RPC_FALLBACK` | official Robinhood mainnet RPC | fallback RPC for the web/server provider |
| `RH_INITIAL_LOOKBACK` | `24000` | initial server-side RH log lookback |
| `POLL_DEX_MS` | `15000` | web/server DEX refresh cadence |
| `POLL_FOMO_MS` | `15000` | web/server Fomo refresh cadence |
| `POLL_CHAIN_MS` | `5000` | web/server chain refresh cadence |
| `PORT` | `8787` | optional web wrapper port |
| `CACHE_FILE` | `./data/cache.json` | optional web/server cache |
| `NATIVE_EXECUTOR_WEBHOOK` | empty | external server-side executor endpoint; empty = queue only |
| `NATIVE_EXECUTOR_TOKEN` | empty | optional bearer token sent to the executor webhook |
| `NATIVE_EXECUTOR_POLL_MS` | `1500` | server executor queue poll cadence |
| `COPY_RUNTIME_FILE` | `./data/runtime.json` | override local CLI paper/tracking store path |

### Provider behavior without keys

With both Fomo credentials empty, COPY can still use the public fomp leaderboard capture and DEX enrichment. Wallet-level Fomo `BUY` / `SELL` events require one of the richer read paths.

### Executor behavior

`NATIVE_EXECUTOR_WEBHOOK` is used by the optional server wrapper, not by `copy terminal`, `copy hunt`, or `copy paper`. When unset, queued entries stay local. When set, the server posts a normalized order to infrastructure you control and only marks an execution with a transaction hash when the executor returns one.

## Files written at runtime

| Path | Contents |
| --- | --- |
| `data/runtime.json` | CLI rules, tracked sources, open / closed paper positions, session paper spend |
| `data/cache.json` | optional web/server last-known state when configured |
| `.env` | local provider / executor settings; ignored by git |

`data/seed.json` is checked in and is the last-known-good bootstrap used to keep the interface populated when a live source is unavailable.
