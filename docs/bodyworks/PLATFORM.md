# PlatPhorm platform impact

Ringfall remains a static game. This Bodyworks pass changes gameplay, settings, and local diagnostics; it does not add backend execution, user accounts, telemetry, protected mutations, or fake cross-site integrations.

- Public canonical host: `https://frwf.platphormnews.com`.
- Existing health, OpenAPI, LLM, sitemap, feed, manifest, trust, agent, security, and unsupported-MCP files remain the platform surfaces.
- `PLATPHORM_API_KEY` is not used because the app exposes no protected or mutating route.
- Trace/span propagation and Vercel request metadata remain honestly unsupported for this static client-only deployment.
- Browser/device tests are local release evidence; they do not claim BrowserOps or Evals ingestion occurred.

Because public route behavior and capability claims are unchanged, discovery files require validation but no invented capability additions.

