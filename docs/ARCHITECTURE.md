# Architecture

```text
Fomo leaderboard / trade feed ─┐
                               ├─> normalize ─> profit hunters ─┐
Robinhood token markets ───────┘                                │
                                                                ├─> candidate
DEX / RH market marks ──────────────────────────────────────────┤
                                                                ├─> score
local rules + exposure + budget ────────────────────────────────┤
                                                                ├─> FIRE / SKIP + reasons
                                                                ├─> paper position / queue
                                                                └─> terminal + optional web wrapper
```

The terminal has no browser-wallet dependency. `data/seed.json` is last-known-good bootstrap data; live providers merge on top rather than erasing the screen when a provider degrades.
