#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
playwright_port="${PLAYWRIGHT_PORT:-4173}"
cd "$repo_root/cloudflare"

# Wrangler's local D1 and Durable Object runtimes are isolated to this checkout.
# The credential is deliberately a disposable test value, never a production key.
pnpm exec wrangler d1 migrations apply frwf-development --local
exec ./node_modules/.bin/wrangler dev --local --ip 127.0.0.1 --port 8787 \
  --var 'PLATPHORM_API_KEY:local-e2e-test-only' \
  --var "PUBLIC_ORIGIN:http://127.0.0.1:${playwright_port}" \
  --var 'RELEASE:local-e2e'
