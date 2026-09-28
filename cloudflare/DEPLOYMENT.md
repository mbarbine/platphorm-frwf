# Production deployment

From the repository root, run `./cloudflare-deploy.sh --dry-run` to validate without uploading, or `./cloudflare-deploy.sh` to publish the production Worker and game assets with the installed Wrangler credentials.

The script builds the game, typechecks and tests the Worker, bundles it, and freezes the resulting Worker and static assets into a temporary directory before uploading. A production deployment applies the repo's idempotent D1 migrations to the dedicated FRWF database; it leaves the checkout and existing secrets alone. Concurrent commits do not cancel deployment: dirty or changed checkouts get an explicit `workspace-<starting-sha>` marker instead of claiming an exact committed build. Avoid editing source during compilation if you need reproducible commit-level attribution.

After upload, the script verifies production health identity, the game page and its JavaScript on the Workers hostname. Degraded health exits nonzero even if the upload succeeded. It does not change DNS or Worker secrets. The Vercel canonical game is a separate deployment.

The Lawnmower provider permits embedding from `*.platphormnews.com`, not localhost or workers.dev. Run the live mower journey against the canonical FRWF deployment with `RUN_LIVE_INTEGRATION_TESTS=true PLAYWRIGHT_PORT=4342 pnpm exec playwright test e2e/mower-archive.spec.ts`. The default local journey verifies the archive and launcher/return flow; it does not certify remote iframe readiness.
# Private multiplayer room invitations

Match hosting is a public, same-origin game action and does not require
`PLATPHORM_API_KEY`. `POST /api/rooms` creates two single-seat invitation links;
the host connects automatically and shares the challenger link from the lobby.
Links carry a one-hour bearer ticket in the URL fragment, which is not sent to
the Worker as an HTTP path or referrer. Do not post invitation links publicly.

The Worker checks the browser origin and limits room creation by a one-way hash
of the connecting address. The Durable Object stores ticket hashes only. An
explicit host leave or a lobby ruleset change gives host control to the other
connected player; the room closes when no connected player can take over. The
shared platform key remains server-side and is still required for publishing
maps and other protected platform operations.

The client joins through `/api/rooms/{id}/socket` using the `frwf-v1` ticket
subprotocol. Private rooms are not public matchmaking and do not create a
persistent player identity. The simulation runs at 30 Hz; real-world latency
still depends on network conditions and has not been certified as lag-free.
