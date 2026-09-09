# Commands

## Main terminal

```bash
copy terminal
```

Starts the full-screen live event terminal. The scanner starts running immediately.

```text
↑ / ↓    select event
f        ALL / FIRE / SKIP
space    open a passing event as PAPER copy
c        track selected source
p        pause / resume scanner
r        provider refresh
q        quit
```

## Showcase / replay

```bash
copy terminal --demo
# or
npm run showcase
```

Uses the bootstrap Robinhood token set and deterministic replay ticks so the UI can be demonstrated offline. The terminal header says `REPLAY` and replay wallet ticks are labeled `REPLAY BUY` / `REPLAY SKIP`.

## Hunt

```bash
copy hunt
copy hunt --fire-only
copy hunt --for 300
copy hunt --json
```

A scrolling version of the same ongoing stream. Scanner pulses keep printing between provider refreshes.

## Paper engine

```bash
copy paper
copy paper --for 300
```

Runs the local dry-run copy engine and position marks.

## Read one token

```bash
copy scan CASHCAT
copy scan 0x...
```

## Read one profit hunter

```bash
copy trader ether_monk
```

## Positions

```bash
copy positions
```

Shows open and recently closed paper positions.

## Rules

```bash
copy rules
```

## Provider health

```bash
copy doctor --probe
```

## Optional website wrapper

```bash
copy web
```
