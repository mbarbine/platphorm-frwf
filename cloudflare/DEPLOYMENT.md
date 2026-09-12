# Production deployment

From the repository root, run `./cloudflare-deploy.sh --dry-run` to validate without uploading, or `./cloudflare-deploy.sh` to publish the production Worker and game assets with the installed Wrangler credentials.

The script builds the game, typechecks and tests the Worker, bundles it, and freezes the resulting Worker and static assets into a temporary directory before uploading. It leaves the checkout, existing secrets and database schema alone. Concurrent commits do not cancel deployment: dirty or changed checkouts get an explicit `workspace-<starting-sha>` marker instead of claiming an exact committed build. Avoid editing source during compilation if you need reproducible commit-level attribution.

After upload, the script verifies production health identity, the game page and its JavaScript on the Workers hostname. Degraded health exits nonzero even if the upload succeeded. The Vercel canonical game is a separate deployment. No D1 migrations, DNS changes or secrets are applied automatically; review and run schema migrations separately when required.

The Lawnmower provider permits embedding from `*.platphormnews.com`, not localhost or workers.dev. Run the live mower journey against the canonical FRWF deployment with `RUN_LIVE_INTEGRATION_TESTS=true PLAYWRIGHT_PORT=4342 pnpm exec playwright test e2e/mower-archive.spec.ts`. The default local journey verifies the archive and launcher/return flow; it does not certify remote iframe readiness.
