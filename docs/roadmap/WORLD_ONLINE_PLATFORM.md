# World, online and platform delivery

## Connected local world

Preserve instant quick play. Grow the existing encounter-based showground into connected Volt Dome, training/backstage and outdoor FRWF spaces. Introduce exploration/combat focus without making every nearby person attack. Doors, gates, stairs and transitions must carry player state and resolve collisions. A won or lost fight returns to exploration without reconstructing the entire session.

World saves need schema/version, checkpoint, position validity, encounter results, earned progression, corruption recovery and migration tests. Start local/offline; optional accounts must not prevent playing. Rivalries, encounter choice, training and meaningful unlocks precede a large empty map. Parking-lot/neighborhood expansion follows the first enjoyable connected route. Treat optional championships, tags, submissions, cage/ladder and other guide modes as separate rules projects with refereeing/elimination/interaction contracts; the FAQ is not an automatic commitment to clone all content.

## One online gameplay authority

Current paths differ: the browser uses Colyseus, the Node shared simulation is simplified, and Worker/DO private rooms are separate. Before choosing a hosting migration, run the same movement/strike/grapple/prop/pin fixture through both candidate architectures and document parity, latency, operational constraints and migration cost. Keep the viable rendering stack; do not introduce a new engine solely to avoid the existing pose ownership problem.

Use versioned commands with sequence/target/intent and server validation. The server owns gameplay results, resources, grips, prop ownership and elimination; clients predict presentation and reconcile bounded corrections. Do not trust client damage or replicate every decorative bone/particle as authority. Log safe room events and bounded replay data, not credentials or raw private payloads.

Required online journey: create room → share scoped invitation → second player joins → complete bout → disconnect → reconnect → spectate → rematch with stable identities. Test version mismatch, stale/duplicate/future commands, invalid actions, reconnect storms, room disposal and sustained load. Measure server tick, bandwidth, correction size and memory. Online discovery stays degraded/unconfigured until the browser uses the verified authority. Public matchmaking and optional social/account systems follow private-room acceptance, with real empty states.

## Deployment and HTTPS

Last verified runtime release was `809deca`: canonical FRWF on Vercel, separate full static game plus private-room Worker on Cloudflare. This documentation pass makes no new deployment claim. Recheck provider versions, canonical DNS, certificate hostname/chain/expiry, redirect, static asset hashes and backend auth every release. A successful Worker deploy does not move the custom domain, and HTTP 200 does not prove a complete cutover. Reproduce any renewed certificate warning on the exact URL/device before changing settings.

Keep a provider responsibility table in operations docs: frontend/static assets, game authority, D1 persistence, R2 purpose, domain/TLS owner, secrets and rollback. R2 provisioning is not evidence that all game assets are stored there. Record immutable frontend/backend versions together; canary before changing canonical routing; retain a tested previous release and schema-compatible rollback. Never weaken TLS or access controls to turn a probe green.

## PlatPhorm contract around the game

Maintain health/v1 health, docs/OpenAPI, llms files, feeds/sitemaps, manifest and well-known discovery. Test semantic content and identity as well as reachability. Registry-derived counts represent available definitions, not certified move quality. Publish supported, experimental, degraded and unavailable capabilities honestly.

Use only `PLATPHORM_API_KEY` for protected platform operations; load it from local/server secret storage without exposing it to browser bundles, screenshots, logs, replays or committed files. Public read-only discovery remains available; mutations, tests and reports require appropriate authorization. Player room tickets are scoped gameplay credentials, not the shared operator key.

Preserve W3C trace context and safe request IDs; identify actual export/propagation limitations. Relevant integrations are BrowserOps for ordinary journeys, Evals for evidence-based gates, Trace for safe diagnostics, Docs for release/incident reports and Monitor for availability. Integrate real endpoints only; do not add decorative buttons or fabricated activity. Use the root network graph and base sitemap index for platform discovery when implementing cross-site work; apply bounded trusted-domain and SSRF protections to runtime discovery/proxy inputs.

Release-triggered and operator actions must enforce auth, redaction and audit boundaries. Test unauthorized rejection and authorized behavior without persisting the key. This roadmap concerns FRWF, not certification of the other 150+ sites; each still requires its own product and contract audit.

## Operations by year end

Versioned replay/support bundles; safe room inspector; disconnect/rejection reason; performance/asset failure runbooks; deploy and rollback rehearsals; incident ownership; bounded retention; save migration/backups where persistence exists. Scheduled soak and monitoring may be designed now but are not running automations until configured. Delete obsolete transports or resources only after compatibility/migration evidence and explicit scope for removal.
