# COPY

> **A local copytrade terminal for Robinhood Chain. Fomo finds the wallet. COPY decides whether the move is allowed.**

![COPY terminal](./assets/terminal.png)

COPY is CLI-first. The website is only a wrapper.

The main thing you run is this:

```bash
git clone <your-repo-url>
cd copy
npm install
cp .env.example .env
npm start
```

`npm start` opens the full-screen **COPY // COPYBARA terminal** in your terminal — not a browser.

No npm runtime dependencies are required. Node 20+ is enough.

## 60 seconds

```bash
npm run doctor          # Fomo / Robinhood / DEX health
npm start               # interactive two-pane terminal
npm run hunt            # raw newest-first decision feed
npm run paper           # dry-run copy engine + position exits
npm run web             # optional website wrapper on localhost:8787
```

Install globally if you want the binary:

```bash
npm install -g .
copy terminal
copy hunt --fire-only
copy trader ether_monk
copy scan CASHCAT
copy paper --for 300
```

Windows checkout includes `start-terminal.cmd`, `start-hunt.cmd`, and `start-paper.cmd` — double click and go.

## What the terminal does

The left side is a newest-first decision stream. Every line has the token, COPY score, profit hunter, market box and the exact first wall that refused it.

The right side is the selected read: trader, token, market cap, liquidity, 24h flow, contract, links, and every refusal reason.

Keyboard:

```text
p        start / pause the engine
f        ALL → FIRE → SKIP filter
↑ / ↓    move through candidates
space    open a passing candidate as a paper position
c        track / untrack the selected source
r        force provider refresh
q        quit
```

Token links are OSC-8 hyperlinks, so `gmgn`, `fomo` and `explorer` are Ctrl+clickable in Windows Terminal, iTerm2, kitty and VS Code.

## The walls

```text
0.01 ETH per paper copy
minimum COPY score      60
maximum market cap      $250M
minimum liquidity       $20K
maximum open positions  3
session budget          0.05 ETH
TP                      +80%
SL                      -35%
trailing                25%
max hold                45 min
```

A green Fomo leaderboard entry is **not** permission to copy it. Discovery is one layer; permission is another.

## Data

- Fomo leaderboard / trader discovery
- optional Fomo direct session or read-only gateway for trade activity
- real Robinhood token markets via DEX data
- Robinhood Chain RPC health / chain id 4663
- real token deep links to GMGN, Fomo and Blockscout
- last-known-good bootstrap data so the terminal still opens when a provider is temporarily unavailable

The header tells you whether the source is `LIVE`, `SNAPSHOT`, `REPLAY`, or degraded. A snapshot is never presented as a live trade.

## Commands

See [`docs/COMMANDS.md`](docs/COMMANDS.md).

## Why the repo is structured like this

```text
bin/copy.mjs                CLI entrypoint
src/cli/                    terminal renderer, rules, paper engine
src/providers/              Fomo / Robinhood / DEX readers
src/services/               scoring + shared state
public/                     optional web wrapper
data/seed.json              last-known-good bootstrap
contracts/CopyRegistry.sol  optional on-chain watch/rule registry
docs/                       commands, strategy, architecture, safety
```

## X / launch copy

> **MY COPY BOT DOESN'T COPY A WALLET JUST BECAUSE IT'S GREEN. IT MAKES THE TRADE PASS THE BOX FIRST. HERE IS THE EXACT SETUP.**
>
> Most copy bots do one stupid thing:
>
> `wallet buys → you buy`
>
> COPY does not.
>
> Fomo finds the profitable trader. Robinhood gives the market. Then COPY asks whether the move is actually allowed.
>
> Five walls in the order I built them 👇
>
> 1. profitable Fomo trader / wallet I explicitly track  
> 2. COPY score has to clear 60  
> 3. market cap ≤ $250M and liquidity ≥ $20K  
> 4. three open positions means there is no fourth  
> 5. 0.05 ETH session budget is gone → the terminal stops firing
>
> My current paper box:
>
> `0.01 ETH per copy`  
> `3 open positions max`  
> `0.05 ETH per session`  
> `take profit +80%`  
> `stop -35%`  
> `trailing 25%`  
> `out after 45 min`
>
> The part I care about is not the green PnL number. It is the line that tells me **why COPY refused the trade**.
>
> `Fomo hunter → RH token → score → walls → FIRE / SKIP → paper position → exit log`
>
> The capybara is the risk manager.
>
> repo ↓  
> `github.com/<you>/copy`
>
> Post your rules under this. I want to see where they leak.

## Inspiration

The terminal interaction is inspired by local-first trading CLIs that make their decision process visible instead of hiding it behind a glossy button: line feeds, readable refusal reasons, local rules, dry-run first, and a browser board only as a secondary view.

COPY applies that pattern to **Fomo smart-money discovery and Robinhood Chain copytrade**.

## Test

```bash
npm test
```
