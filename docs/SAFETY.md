# Safety

COPY's current CLI is observation + paper execution. It does not broadcast an on-chain trade.

That is a product boundary, not a missing label: the terminal can be visually busy while remaining non-custodial.

## Custody

- `copy terminal`, `hunt`, `paper`, `scan`, `trader`, `positions`, `rules`, and `doctor` do not read a private key.
- The browser wrapper does not use `window.ethereum`, `eth_requestAccounts`, or a connect-wallet flow.
- `.env` is git-ignored and should contain only provider / executor settings you intentionally configure.
- `data/runtime.json` contains local paper/tracking state, not signing material.

## Paper is not live

A `PAPER` row means COPY recorded a local entry price and is marking it from current market data. It is not a fill receipt.

A `SHADOW` row means COPY is analytically marking a wallet/token pair. It is not proof that the source trader entered at COPY's local baseline.

The CLI never relabels either one as an executed trade.

## Replay is not live

Showcase mode exists to make demos reproducible and visually active when APIs are unavailable.

It is deliberately obvious:

- header mode = `REPLAY`;
- generated addresses use `replay:`;
- event types start with `REPLAY`;
- replay shadow rows use `R-SHDW`.

Do not crop those labels out and present the output as an on-chain result.

## Live data can still be wrong or late

Risk | What COPY does | What it cannot guarantee
--- | --- | ---
Fomo leaderboard changes / public markup changes | keeps a last-known-good bootstrap and exposes source state | that a public mirror is complete at every moment
wallet trade API is unavailable | emits no fake live `BUY` / `SELL`; scanner can continue independently | wallet-level activity without a configured working source
DEX mark is stale or missing | `PRICE` can refuse an entry; snapshot/live state stays visible | that every external market API is current
provider returns fewer tokens than before | merges by address instead of replacing the universe | that an old token still has an active market
network / RPC degrades | health becomes degraded / snapshot rather than pretending success | uptime of a public endpoint
paper PnL moves sharply | marks are recalculated from the latest price COPY has | an executable exit price or available size on-chain

## The optional native executor

The web/server path contains a **queue boundary**, not a bundled signer.

When `NATIVE_EXECUTOR_WEBHOOK` is empty, `ARMED` entries stay in the queue. When it is set, `src/services/native-executor.mjs` POSTs a normalized order to the endpoint you configured.

The request can include:

```text
chainId = 4663
action
tokenAddress
sizeEth
slippage / tax limits
TP / SL preferences
source rule / trade metadata
```

COPY considers a returned transaction hash evidence that the external executor accepted/broadcast a transaction. The safety, key custody, router selection, simulation, allowance management and transaction correctness of that external service are **outside this repository**.

If you build one:

1. keep its signing key on the executor machine, not in the browser;
2. use a dedicated wallet with a deliberately limited balance;
3. validate chain ID and token address server-side;
4. enforce size / session limits again inside the executor — do not trust only the UI;
5. simulate where the venue supports it;
6. persist transaction hashes and receipts;
7. distinguish `QUEUED`, `SENT`, `CONFIRMED`, `REVERTED`, and `CLOSED` rather than treating a webhook response as a fill.

## Secrets

Never commit:

```text
FOMO_BEARER_TOKEN
REPLYNODES_API_KEY
NATIVE_EXECUTOR_TOKEN
any private key used by your own executor
```

If a secret was committed, removing the line in a later commit is not enough. Rotate the credential.

## Rules are not protection from market risk

`EDGE`, `DEPTH`, `TURN`, `MOMO`, `PRICE`, max positions and the paper session budget are deterministic software rules. They can reduce what the engine chooses to model; they cannot make a token safe, liquid, honest or profitable.

The defaults exist so the terminal has a coherent paper model. Change them only if you understand what each refusal is removing.

## Not investment advice

COPY reads third-party / chain data and applies rules configured in software. The repository does not endorse a token or guarantee a return.
