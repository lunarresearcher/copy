# GitHub setup

Everything below is ready for the repository page.

## About

Use this as the GitHub repository description:

> CLI-first copytrade terminal for Robinhood Chain. Tracks profit hunters, fresh RH tokens, COPY wallets, paper positions, and a native execution queue in one moving terminal.

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

## Images

- README / social banner: `assets/copy-banner.png`
- Avatar / project icon: `assets/copybara-avatar.png`
- Terminal screenshot: `assets/terminal.png`

## One-command GitHub setup

After the repo is pushed and GitHub CLI is authenticated:

```bash
npm run github:setup
```

That command updates the GitHub About description and topics for the current repository.

## Language stats

The large standalone HTML previews are marked as `linguist-generated` in `.gitattributes`. GitHub Linguist therefore treats them as generated artifacts instead of letting them dominate the repository language bar.
