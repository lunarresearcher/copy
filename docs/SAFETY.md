# Safety

COPY starts in observation / paper mode. It does not broadcast a transaction from the CLI in this repository.

For live execution, connect a separate executor/relayer through the existing server-side queue interface. Keep signing material outside the browser and never commit secrets.

The included Fomo/market data is for discovery and can be stale, incomplete or unavailable. The terminal exposes provider state (`LIVE`, `SNAPSHOT`, `degraded`) instead of disguising a snapshot as live data.
