# GitHub page setup

The README is written to be the repository front page. A few GitHub-side settings finish the presentation.

## About

Suggested description:

> CLI-first Robinhood Chain smart-wallet terminal — explainable flow walls, endless market intake, rotating copy-wallet mirrors, paper execution, explicit replay mode.

Website: add the public COPY wrapper URL when it exists. Until then, leave the field empty rather than pointing at an unrelated page.

## Topics

Suggested topics:

```text
robinhood-chain
copytrade
trading-terminal
smart-money
fomo
crypto
cli
terminal
nodejs
paper-trading
```

## Social preview

Use `assets/terminal.png` as the repository social preview until a dedicated 1280×640 card exists. It immediately shows that COPY is a terminal product instead of a generic bot library.

## Release naming

Keep release names product-first instead of internal build chatter:

```text
COPY 1.6 — endless terminal
COPY 1.7 — live wallet intake
COPY 1.8 — executor adapter
```

Avoid putting `v15 fixed`, `final-final`, or implementation notes in the README title. Put build history in releases / commits; keep the front page evergreen.

## Pinned files

The front-page reading path should stay:

```text
README
  → docs/TERMINAL.md
  → docs/COMMANDS.md
  → docs/STRATEGY.md
  → docs/ARCHITECTURE.md
  → docs/SAFETY.md
```

## Before a public push

```bash
npm test
git status
git add .
git commit -m "polish COPY docs and GitHub presentation"
git push
```

Make sure `.env`, `data/runtime.json`, and `data/cache.json` are not staged.
