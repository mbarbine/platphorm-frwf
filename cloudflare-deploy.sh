#!/usr/bin/env bash
# Build, migrate, publish, and smoke-test FRWF on the PH3AR Cloudflare account.
set -euo pipefail

case "${1:-}" in
  '') dry_run=false ;;
  --dry-run) dry_run=true ;;
  --help) echo 'Usage: ./cloudflare-deploy.sh [--dry-run]'; exit 0 ;;
  *) echo 'Usage: ./cloudflare-deploy.sh [--dry-run]' >&2; exit 2 ;;
esac

readonly account_id='f1ac50e4b31352abecc790ae1cde443a'
readonly d1_name='frwf-production'
readonly d1_id='09e51273-c3f1-44b1-807e-a0942ba48724'
readonly r2_name='frwf-assets-production'
readonly public_origin='https://frwf.ja1.io'
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_dir"

# Wrangler's account selection can differ between product APIs; pin it for every call.
export CLOUDFLARE_ACCOUNT_ID="$account_id"
source_sha="$(git rev-parse HEAD)"
workspace_state="$(git status --porcelain)"
artifact_dir="$(mktemp -d "${TMPDIR:-/tmp}/frwf-cloudflare.XXXXXX")"
trap 'rm -rf "$artifact_dir"' EXIT

pnpm --dir cloudflare exec wrangler whoami --json > "$artifact_dir/whoami.json"
node --input-type=module - "$artifact_dir/whoami.json" "$account_id" <<'NODE'
import fs from 'node:fs';
const [path, expected] = process.argv.slice(2);
const identity = JSON.parse(fs.readFileSync(path, 'utf8'));
if (!identity.loggedIn || !identity.accounts?.some(account => account.id === expected && account.name === 'PH3AR')) {
  throw new Error('Wrangler is not authenticated to the expected PH3AR account. No deployment was attempted.');
}
console.log('Cloudflare identity verified: PH3AR.');
NODE

pnpm --dir cloudflare exec wrangler secret list --format json --config wrangler.jsonc --env production > "$artifact_dir/secrets.json"
node --input-type=module - "$artifact_dir/secrets.json" <<'NODE'
import fs from 'node:fs';
const [path] = process.argv.slice(2);
const secrets = JSON.parse(fs.readFileSync(path, 'utf8'));
if (!secrets.some(secret => secret.name === 'PLATPHORM_API_KEY' && secret.type === 'secret_text')) {
  throw new Error('Production PLATPHORM_API_KEY secret is missing. No deployment was attempted.');
}
console.log('Required production Worker secret verified by name; its value was not read.');
NODE

# Verify account ownership of the exact resources this Worker will bind. Never reuse
# unrelated D1 databases when switching Cloudflare accounts.
pnpm --dir cloudflare exec wrangler d1 list --json > "$artifact_dir/d1.json"
node --input-type=module - "$artifact_dir/d1.json" "$d1_name" "$d1_id" <<'NODE'
import fs from 'node:fs';
const [path, name, id] = process.argv.slice(2);
const databases = JSON.parse(fs.readFileSync(path, 'utf8'));
const database = databases.find(candidate => candidate.name === name);
if (!database || database.uuid !== id) throw new Error(`Expected dedicated PH3AR D1 ${name} (${id}) was not found. No deployment was attempted.`);
console.log(`Cloudflare D1 verified: ${name}.`);
NODE

pnpm --dir cloudflare exec wrangler r2 bucket list --config wrangler.jsonc > "$artifact_dir/r2.txt"
if ! rg -q "^name:[[:space:]]+${r2_name}$" "$artifact_dir/r2.txt"; then
  echo "Expected R2 bucket ${r2_name} was not found in PH3AR. No deployment was attempted." >&2
  exit 1
fi
echo "Cloudflare R2 verified: ${r2_name}."

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

if "$dry_run"; then
  pnpm --dir cloudflare exec wrangler deploy --config "$artifact_dir/wrangler.json" --no-bundle --dry-run
  echo 'Dry run passed; no D1 migrations or deployment were applied.'
  exit 0
fi

# The database is a fresh FRWF-only resource in PH3AR; migrations create only this
# game's match-result, map-version, and rate-limit tables.
pnpm --dir cloudflare exec wrangler d1 migrations apply "$d1_name" --remote --config "$artifact_dir/wrangler.json"
pnpm --dir cloudflare exec wrangler deploy --config "$artifact_dir/wrangler.json" --no-bundle --keep-vars

# The canonical custom domain is the release gate. The workers.dev URL is intentionally
# not treated as a substitute for frwf.ja1.io.
authoritative_ns="$(dig +short ja1.io NS | head -n 1 | sed 's/\.$//')"
if [[ -z "$authoritative_ns" ]]; then echo 'Could not discover the ja1.io authoritative DNS server.' >&2; exit 1; fi
domain_ip=''
for attempt in {1..24}; do
  domain_ip="$(dig +short "@$authoritative_ns" frwf.ja1.io A | head -n 1 || true)"
  [[ -n "$domain_ip" ]] && break
  sleep 5
done
if [[ -z "$domain_ip" ]]; then echo 'frwf.ja1.io has no authoritative A record yet.' >&2; exit 1; fi

curl_domain=(--silent --show-error --fail --max-time 20 --resolve "frwf.ja1.io:443:${domain_ip}")
health_json=''
for attempt in {1..24}; do
  if health_json="$(curl "${curl_domain[@]}" "$public_origin/api/health" 2>/dev/null)"; then
    if EXPECTED_SOURCE_SHA="$source_sha" node --input-type=module -e 'let s="";for await(const c of process.stdin)s+=c;const body=JSON.parse(s);if(!body.ok||body.data.environment!=="production"||body.data.gitSha!==process.env.EXPECTED_SOURCE_SHA)process.exit(1)' <<<"$health_json"
    then break; fi
  fi
  sleep 5
done
if [[ -z "$health_json" ]]; then echo 'Production health endpoint did not become reachable on frwf.ja1.io.' >&2; exit 1; fi

page_html="$(curl "${curl_domain[@]}" "$public_origin/")"
asset_path="$(node --input-type=module -e 'let s="";for await(const c of process.stdin)s+=c;const p=s.match(/src="([^\"]+\.js)"/)?.[1];if(!p)process.exit(1);process.stdout.write(p)' <<<"$page_html")"
content_type="$(curl "${curl_domain[@]}" -o /dev/null -w '%{content_type}' "$public_origin$asset_path")"
EXPECTED_SOURCE_SHA="$source_sha" EXPECTED_CONTENT_TYPE="$content_type" node --input-type=module -e 'let s="";for await(const c of process.stdin)s+=c;const body=JSON.parse(s);const contentType=process.env.EXPECTED_CONTENT_TYPE??"";if(!body?.ok||body.data.environment!=="production"||body.data.gitSha!==process.env.EXPECTED_SOURCE_SHA)throw new Error("Production deployment identity does not match the release");if(body.data.databaseStatus!=="operational"||body.data.assetStatus!=="operational")throw new Error("Production D1 or R2 probe is unhealthy");if(body.data.status!=="operational")throw new Error(`Production backend is degraded (auth: ${body.data.authStatus}); configure the Worker secret PLATPHORM_API_KEY before enabling room creation.`);if(!contentType.includes("javascript"))throw new Error("Game JavaScript asset is unavailable");console.log(JSON.stringify({origin:"https://frwf.ja1.io",status:body.data.status,databaseStatus:body.data.databaseStatus,assetStatus:body.data.assetStatus,authStatus:body.data.authStatus,gitSha:body.data.gitSha,multiplayerRuntime:"MatchRoom Durable Object deployed"},null,2));' <<<"$health_json"
