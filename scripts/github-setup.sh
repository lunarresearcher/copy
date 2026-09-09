#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install on macOS with: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Authenticate first with: gh auth login"
  exit 1
fi

repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"

description="CLI-first copytrade terminal for Robinhood Chain. Tracks profit hunters, fresh RH tokens, COPY wallets, paper positions, and a native execution queue in one moving terminal."

gh repo edit "$repo" --description "$description" \
  --add-topic copytrade \
  --add-topic robinhood-chain \
  --add-topic terminal \
  --add-topic cli \
  --add-topic tui \
  --add-topic crypto \
  --add-topic trading \
  --add-topic fomo \
  --add-topic gmgn \
  --add-topic nodejs \
  --add-topic capybara

echo "GitHub About + topics updated for $repo"
