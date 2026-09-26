#!/usr/bin/env bash
# Build and publish FRWF's production Worker plus game assets. No secrets or D1 migrations are changed.
set -euo pipefail
case "${1:-}" in
  '') dry_run=false ;;
  --dry-run) dry_run=true ;;
  --help) echo 'Usage: ./cloudflare-deploy.sh [--dry-run]'; exit 0 ;;
  *) echo 'Usage: ./cloudflare-deploy.sh [--dry-run]' >&2; exit 2 ;;
esac
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_dir"
source_sha="$(git rev-parse HEAD)"
workspace_state="$(git status --porcelain)"
artifact_dir="$(mktemp -d "${TMPDIR:-/tmp}/frwf-cloudflare.XXXXXX")"
trap 'rm -rf "$artifact_dir"' EXIT
pnpm build
pnpm --dir cloudflare typecheck
pnpm --dir cloudflare test
# Freeze built assets and the bundled Worker so later local edits cannot change the upload.
cp -R dist "$artifact_dir/assets"
pnpm --dir cloudflare exec wrangler deploy --env production --dry-run --outdir "$artifact_dir/worker"
if [[ -n "$workspace_state" || "$(git rev-parse HEAD)" != "$source_sha" || -n "$(git status --porcelain)" ]]; then
  source_sha="workspace-${source_sha:0:12}"
fi
node --input-type=module - "$repo_dir" "$artifact_dir" "$source_sha" <<'NODE'
import fs from 'node:fs';
const [repo, artifact, sha] = process.argv.slice(2);
const original = JSON.parse(fs.readFileSync(`${repo}/cloudflare/wrangler.jsonc`, 'utf8'));
const config = { ...original, ...original.env.production };
delete config.env;
delete config.$schema;
config.main = `${artifact}/worker/index.js`;
config.assets = { ...config.assets, directory: `${artifact}/assets` };
config.vars = { ...config.vars, SOURCE_SHA: sha };
for (const db of config.d1_databases ?? []) db.migrations_dir = `${repo}/cloudflare/migrations`;
fs.writeFileSync(`${artifact}/wrangler.json`, JSON.stringify(config, null, 2));
NODE
args=(deploy --config "$artifact_dir/wrangler.json" --no-bundle --keep-vars)
if "$dry_run"; then args+=(--dry-run); fi
pnpm --dir cloudflare exec wrangler "${args[@]}"
if "$dry_run"; then echo 'Dry run passed; nothing uploaded.'; exit 0; fi
node --input-type=module - "$source_sha" <<'NODE'
const expected = process.argv[2];
const origin = 'https://frwf-game-production.barbine-michael.workers.dev';
let last;
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (!response.ok || !body.ok || body.data.environment !== 'production' || body.data.gitSha !== expected) throw new Error('Deployment identity not yet visible');
    const page = await fetch(origin, { signal: AbortSignal.timeout(15000) });
    const html = await page.text();
    const asset = html.match(/src="([^\"]+\.js)"/)?.[1];
    if (!page.ok || !asset) throw new Error('Game entry page missing');
    const script = await fetch(new URL(asset, origin), { signal: AbortSignal.timeout(15000) });
    if (!script.ok || !(script.headers.get('content-type') ?? '').includes('javascript')) throw new Error('Game JavaScript unavailable');
    console.log(JSON.stringify({ origin, ...body.data }, null, 2));
    if (body.data.status !== 'operational') throw new Error('Worker deployed but health is degraded');
    process.exit(0);
  } catch (error) { last = error; await new Promise(resolve => setTimeout(resolve, 5000)); }
}
throw last;
NODE
