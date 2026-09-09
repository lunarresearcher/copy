# Strategy

COPY deliberately separates **discovery** from **permission**.

A profitable Fomo trader is a discovery signal. A copy only receives `FIRE` if the token also clears the local rule box:

1. confirmed Fomo trader / tracked source
2. COPY score >= 60
3. market cap <= $250M
4. liquidity >= $20K
5. fewer than 3 open paper positions
6. 0.05 ETH session budget not exhausted

Default paper exits: +80% take profit, -35% stop, 25% trailing from peak, 45 minute max hold.

All values are readable and stored locally in `data/runtime.json` once changed.
