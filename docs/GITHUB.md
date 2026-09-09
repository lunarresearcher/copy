# GitHub setup

The repository already contains the banner, avatar, README, terminal screenshot, topics list, and a helper for repository metadata.

## About

**Working CLI-first copytrade terminal for Robinhood Chain — live token discovery, profit hunters, COPY wallets, paper engine and native queue.**

## Topics

```text
copytrade
robinhood-chain
terminal
cli
tui
crypto
trading
fomo
gmgn
nodejs
capybara
```

## Apply About + topics

After the repo is pushed and GitHub CLI is authenticated:

```bash
npm run github:setup
```

The script detects the current repository and updates its GitHub description/topics automatically.

## Images

- README banner: `assets/copy-banner.png`
- COPYBARA avatar: `assets/copybara-avatar.png`
- Terminal screenshot: `assets/terminal.png`

Generated standalone browser previews are intentionally ignored by Git. They can be recreated locally with the preview scripts, but they are not shipped in the Git-ready repository so GitHub language stats reflect the actual CLI/source code instead of generated HTML.
