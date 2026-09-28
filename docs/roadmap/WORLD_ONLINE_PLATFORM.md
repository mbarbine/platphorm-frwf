# World, online and platform delivery

## Connected local world

Preserve instant quick play. Grow the existing encounter-based showground into connected FRWF Arena, training/backstage and outdoor FRWF spaces. Introduce exploration/combat focus without making every nearby person attack. Doors, gates, stairs and transitions must carry player state and resolve collisions. A won or lost fight returns to exploration without reconstructing the entire session.

World saves need schema/version, checkpoint, position validity, encounter results, earned progression, corruption recovery and migration tests. Start local/offline; optional accounts must not prevent playing. Rivalries, encounter choice, training and meaningful unlocks precede a large empty map. Parking-lot/neighborhood expansion follows the first enjoyable connected route. Treat optional championships, tags, submissions, cage/ladder and other guide modes as separate rules projects with refereeing/elimination/interaction contracts; the FAQ is not an automatic commitment to clone all content.

## One online gameplay authority

Current online flow is implemented on Cloudflare: the browser connects over a versioned WebSocket to a Durable Object match room; same-origin browser room hosting issues two distinct, time-limited seat invitations without a platform key; host authority transfers on a lobby ruleset change or host departure. The room stores its match state in the Durable Object, uses D1 for completed results, and shares commands, snapshots, impacts and outcomes. It is not Colyseus and there is no public matchmaking or player identity.

Online combat is still a smaller deterministic swept-contact simulation in `packages/game-core/src/onlineSimulation.ts`, not the local Rapier BodyWorks runtime. It currently offers movement, run, guard, jab/headbutt, low kick and a basic collar-lock/slam path. It has no online props, corner climb, rope rebound/traversal, pinfall/submission, spectator, or validated reconnect/rematch experience. A generic “heavy strike” becoming a low kick or a collar lock becoming a slam is not acceptable final move variety. Do not describe the game as parity-certified.

Near-term work should make movement acceleration, braking, body spacing, command acceptance, both-client state agreement and contact readable; the shared online movement test now checks those bounded trajectories. Online graphics remain client presentation; server snapshots own positions, stamina, damage, move phase and result. Current bounded physical corrections do not amount to full client prediction or rollback. The multiplayer browser journey is isolated from production and should provision a room through the same no-key, same-origin flow as players; release gates must not mutate production rooms.

Before expanding matchmaking, run the same movement/strike/grapple/recovery/prop/rope fixtures in local and online modes. Define explicit support for each action or show the control as unavailable online. Then build the required journey: provision → share scoped invite → both ready → complete a bout → disconnect → resume the same seat → spectate → rematch. Test protocol mismatch, stale/duplicate/future commands, invalid actions, reconnect storms, room disposal and sustained load. Measure tick rate, bandwidth, correction size, memory and fairness under latency. Public matchmaking follows private-room acceptance, with honest empty states.

## Deployment and HTTPS

The current deployed baseline is Cloudflare Worker/static assets release `1.4.2` at `https://frwf.ja1.io`, with D1, R2 and the private-room Durable Object binding configured. A health response and route 200s are infrastructure checks, not proof of cross-client match quality. Recheck provider version, canonical DNS, certificate chain/expiry, redirects, asset hashes, protected room creation, room ticket isolation, gameplay lifecycle and rollback evidence on every release. Keep the whole service on Cloudflare; Vercel is not a production dependency.

Keep a provider responsibility table in operations docs: frontend/static assets, game authority, D1 persistence, R2 purpose, domain/TLS owner, secrets and rollback. R2 provisioning is not evidence that all game assets are stored there. Record immutable frontend/backend versions together; canary before changing canonical routing; retain a tested previous release and schema-compatible rollback. Never weaken TLS or access controls to turn a probe green.

## PlatPhorm contract around the game

Maintain health/v1 health, docs/OpenAPI, llms files, feeds/sitemaps, manifest and well-known discovery. Test semantic content and identity as well as reachability. Registry-derived counts represent available definitions, not certified move quality. Publish supported, experimental, degraded and unavailable capabilities honestly.

Use only `PLATPHORM_API_KEY` for protected platform operations; load it from local/server secret storage without exposing it to browser bundles, screenshots, logs, replays or committed files. Public read-only discovery remains available; room provisioning and publishing require operator authorization. Player room tickets are scoped gameplay credentials, not the shared operator key. Local e2e uses a disposable value and a local Worker only.

Preserve W3C trace context and safe request IDs; identify actual export/propagation limitations. Relevant integrations are BrowserOps for ordinary journeys, Evals for evidence-based gates, Trace for safe diagnostics, Docs for release/incident reports and Monitor for availability. Integrate real endpoints only; do not add decorative buttons or fabricated activity. Use the root network graph and base sitemap index for platform discovery when implementing cross-site work; apply bounded trusted-domain and SSRF protections to runtime discovery/proxy inputs.

Release-triggered and operator actions must enforce auth, redaction and audit boundaries. Test unauthorized rejection and authorized behavior without persisting the key. This roadmap concerns FRWF, not certification of the other 150+ sites; each still requires its own product and contract audit.

## Operations by year end

Versioned replay/support bundles; safe room inspector; disconnect/rejection reason; performance/asset failure runbooks; deploy and rollback rehearsals; incident ownership; bounded retention; save migration/backups where persistence exists. Scheduled soak and monitoring may be designed now but are not running automations until configured. Delete obsolete transports or resources only after compatibility/migration evidence and explicit scope for removal.
