# Terminal

The COPY terminal is the main product surface. The website is optional; this TUI is where the live/replay stream, decision explanation and wallet mirrors meet.

```bash
copy terminal
```

For a deterministic moving demo:

```bash
copy terminal --demo
```

## Layout

```text
┌──────────────────────────── COPY + running COPYBARA ────────────────────────────┐
│ left: newest-first event stream        │ right: selected decision / flow walls │
│                                        │                                         │
│                                        │ hot market radar / provider pulse       │
├────────────────────────────────────────┴─────────────────────────────────────────┤
│ COPY WALLETS: rotating SHADOW / PAPER mirrors, PnL delta, sparkline             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

The renderer adapts to the current terminal width / height. A larger terminal shows more event rows and more copy-wallet rows; the underlying pool is not limited to what is currently visible.

## Event selection

`↑` and `↓` move through the visible/newest event history. The right side is always derived from the selected event's candidate snapshot, so the reason shown belongs to that event rather than a later token state.

## Filters

Press `f` to cycle:

```text
ALL → FIRE → SKIP → ALL
```

The filter changes presentation only. It does not alter rules or the scanner.

## Paper action

Press `space` on a passing candidate to ask `CopyRuntime.openPaper()` to open it.

The runtime evaluates the candidate again at action time, including:

- current five flow walls;
- current number of open paper positions;
- current paper session spend;
- current price availability.

That second evaluation prevents a visually stale `FIRE` row from bypassing a newly full exposure box.

## Track action

Press `c` to toggle the selected source in the local tracked list. Tracking is stored in `data/runtime.json` and does not imply execution.

## Scanner state

Press `p` to pause / resume scanner pulses. Provider refreshes and the rest of the runtime remain conceptually separate from the display state.

Press `r` for an immediate live sync.

## COPYBARA

The pixel capybara beside COPY is terminal-rendered, not a browser overlay. Its frame / position changes while the TUI is redrawn so the header has motion without affecting the data model.

## COPY WALLETS

The bottom desk pulls from `runtime.shadowCopies` plus local paper positions. Each visible row can contain:

```text
kind    trader    pair    current PnL    delta    sparkline
```

In replay mode the mirror pool is larger and pair assignments change regularly. Replay mirrors are always labeled.

## Quiet feeds

A quiet external feed should not look like a dead process. COPY solves that with event semantics, not fabricated trades:

- `SCAN` = scanner is alive;
- `SYNC` = providers were refreshed;
- `MOVE` = market data changed;
- `BUY` / `SELL` = only wallet activity from a live read source.

This is why the terminal can keep moving while still making it clear what actually happened.

## Terminal links

Known token addresses are formatted with external links where the renderer supports them, including GMGN token pages used by the product UI. Whether a terminal makes those links clickable depends on the terminal application.
