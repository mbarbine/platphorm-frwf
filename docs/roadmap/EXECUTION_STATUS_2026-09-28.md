# Gameplay and online execution status — September 28, 2026

This is a dated evidence checkpoint for the [one-year roadmap](README.md), not a completion claim. The product is a wrestling game; infrastructure passing does not mean the wrestling feels good.

## Work in this increment

- The shared Cloudflare online simulation now accelerates into walk/run and brakes after input expiry instead of snapping velocity to full speed and zero. Run speed is deliberately bounded below the prior 4.9 m/s value. A body-spacing constraint stops ungrappled fighters from occupying the same point. Shared game-core tests cover acceleration envelope, release braking, finite position and overlap separation.
- `pnpm test` now includes the isolated `@frwf/game-core` suite. `pnpm verify` also includes Cloudflare Worker typecheck, dry build and Miniflare integration tests.
- The multiplayer browser test no longer calls the removed in-browser room creation flow. It provisions an isolated local room using a disposable key, joins separate seat tickets from two browser contexts, and exercises readiness and server snapshots. Across three attempts, both clients reached the active bout; the host connection remained `connected`, and its input collector and command-sequence counter advanced, but no Worker command acknowledgment arrived. One run also exposed browser-context throttling in the test harness; foreground ordering is corrected. Online responsiveness remains a failed release gate until an authoritative command is acknowledged.
- Skinned fighters now get restrained, stamina-scaled skin specularity to suggest perspiration. This is a surface-finish adjustment, not a sweat simulation. No generic tattoos, tears, or blood decals were applied because the supplied GLB UV layouts and per-character placement are not validated; those effects require authored per-character texture/layout review.
- Roadmap sections now describe the actual private-room Durable Object and shared simulation rather than a planned Colyseus server. They clearly track that local Rapier and online combat are separate implementations.

## Test and acceptance matrix

| Area | Evidence in this checkpoint | Status |
| --- | --- | --- |
| Build/types | `pnpm verify` passed lint, root typecheck, shared package builds and Vite production build | passed |
| Root suite | 96 files, 895 tests | passed |
| Shared online movement | acceleration/braking/spacing and strike-combo tests in `@frwf/game-core` (15 tests across 3 files) | passed |
| Worker security/runtime | local Worker typecheck, dry build and Miniflare suite (10 tests) | passed |
| Two-client browser multiplayer | three isolated local DO browser attempts; both clients reach active match, host remains connected, input/sequence advance, but no server ack is observed | failed; release blocker |
| Local heavyweight bout | prior release baseline: full playability suite 5/6; sixth table-contact case passed in a focused run | incomplete; one combined 6/6 run still required |
| Local ropes, corner, climb and prop lifecycle | code and isolated scenario coverage exist, but the latest player reports still reject the experience | not accepted |
| Character visual detail | effort-scaled skin sheen added; no image-based art acceptance after this change | unreviewed |
| Production live behavior | 1.4.2 health/discovery routes were checked after that release; no deployment in this increment | current gameplay changes are not deployed |

The browser multiplayer run confirms that a key press reaches the game input collector and advances the client sequence, but the room does not deliver the matching acknowledgment in browser play, despite the Worker integration suite passing direct command/ack coverage. The root cause is still unknown. Do not mark responsive online control as passed until the full browser scenario verifies accepted commands, shared positions, combat contact and a normal result on both clients.

## Next upgrade gates

1. Rebuild, run `pnpm verify`, and run `pnpm test:online`; investigate and fix any command acknowledgment, role, state synchronization or forfeit failure.
2. Add local-versus-online parity tests for strike, kick, grapple, slam, get-up, props, ropes and corner climbs. Keep unsupported actions visibly unavailable online until implemented.
3. Extend the Physics Lab with repeatable move/contact fixtures and assertions for input-to-start latency, travel distance, foot support, joint faults, contact location, recovery control and collider-safe prop handling. Capture ordinary-speed evidence on desktop and mobile.
4. Repair the local grappling contract for lift height, paired body control, throw release, post/corner approach, rope rebound and body traversal. Verify player action response and that no movement lease, prediction or invalid contact creates a cross-arena lunge.
5. Add per-character visual art authoring: unique body maps/validated tattoo placement, sweat buildup, bruising and restrained blood, expressive face/wince/tear animation only where the character design supports it, then compare screenshots at actual play distance. Preserve device-tier shadow and crowd budgets.
6. Add reconnect and rematch browser coverage, latency/jitter and disconnect tests, plus sustained-load evidence. Keep production room creation out of test paths.
7. Only after these gates pass, update release identity and deploy the matching frontend and Worker to Cloudflare, then record live route, match and rollback evidence.

## Scope discipline

“Tests for everything” is tracked as a subsystem acceptance matrix rather than an assertion that every possible game state has been tested. Each movement, move family, grip, recovery orientation, prop interaction, rope/post transition, controller path, network fault and device tier needs representative boundary and end-to-end cases. Deterministic tests prove rules and geometry; browser and visual tests prove that the player can see and perform them. Production verification remains a separate release gate.


## Multiplayer and combat follow-up (source changes, not deployed)

The current working tree now removes the platform-key requirement from browser room hosting. The Worker requires the configured same-origin header, applies a per-address rate limit keyed by a SHA-256 digest, and returns separate host/challenger invitation links containing one-seat tickets in fragments. Explicit leave and lobby ruleset changes hand host authority to the connected player; the room closes if no takeover is available. The 30 Hz server tick does not guarantee zero latency.

The online browser test now follows the player's host-and-share flow without injecting an operator key. New jab/right-hook/left-hook/uppercut choices have authored strike poses and per-move physics/audio mapping in local combat; the online simulator also sequences them. Synthetic impact breath cues are used instead of recorded performer voice. Focused game and Worker tests passed during this follow-up; deployment, remote matchmaking quality and a two-browser run against the local Worker are still pending.

## PWA and latest local verification (September 28, 2026)

RINGFALL now exposes browser installation from its entry and main-menu screens, platform-specific install guidance, app icons/manifest metadata, and a bounded best-effort offline shell. The offline shell and its built JS/CSS bundles were verified in Chromium after loading online once. The cache deliberately excludes API and multiplayer socket traffic; this does not make a first visit or online match available offline. Physical iOS, Android and desktop install acceptance remains outstanding. The app continues to be served on Cloudflare at `https://frwf.ja1.io`; this PWA work does not add a Vercel deployment path.

The first offline browser run exposed CDN `Vary: Accept-Encoding` headers making URL-only cached assets miss. The worker now strips `Vary` on its measured static-cache entries and shell navigation snapshots; the repeat browser journey passed with the service worker controlling the page, shell and built assets present, and the entry screen rendered offline.

Latest targeted evidence: `pnpm build`, `pnpm lint`, the PWA/platform-contract unit tests (8 tests), the Cloudflare Worker suite (13 tests), and `pnpm exec playwright test e2e/pwa-install.spec.ts` (1 browser test) passed. The most recent full root suite run passed 896 of 905 tests; nine gameplay/controls assertions remain failing across gait style isolation, recovery combo selection, Nova idle motion, six-strike hit coverage, high-punch/combo move identity, neutral strike hand/target selection, side-facing locomotion drift and the control-deck move label. Those gameplay issues remain separate from this PWA acceptance and block a full game release sign-off.
