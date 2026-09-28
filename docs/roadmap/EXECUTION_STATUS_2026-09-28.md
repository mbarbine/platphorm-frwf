# Gameplay and online execution status — September 28, 2026

This is a dated evidence checkpoint for the [one-year roadmap](README.md), not a completion claim. The product is a wrestling game; infrastructure passing does not mean the wrestling feels good.

## Work in this increment

- The shared Cloudflare online simulation now accelerates into walk/run and brakes after input expiry instead of snapping velocity to full speed and zero. Run speed is deliberately bounded below the prior 4.9 m/s value. A body-spacing constraint stops ungrappled fighters from occupying the same point. Shared game-core tests cover acceleration envelope, release braking, finite position and overlap separation.
- `pnpm test` now includes the isolated `@frwf/game-core` suite. `pnpm verify` also includes Cloudflare Worker typecheck, dry build and Miniflare integration tests.
- The multiplayer browser test no longer calls the removed in-browser room creation flow. It provisions an isolated local room using a disposable key, joins separate seat tickets from two browser contexts, and exercises readiness and server snapshots. The first run reached the live bout but timed out waiting for a movement acknowledgment after a one-frame synthetic WASD press. The test now holds movement across rendered frames; this change is not yet accepted until the rerun passes.
- Skinned fighters now get restrained, stamina-scaled skin specularity to suggest perspiration. This is a surface-finish adjustment, not a sweat simulation. No generic tattoos, tears, or blood decals were applied because the supplied GLB UV layouts and per-character placement are not validated; those effects require authored per-character texture/layout review.
- Roadmap sections now describe the actual private-room Durable Object and shared simulation rather than a planned Colyseus server. They clearly track that local Rapier and online combat are separate implementations.

## Test and acceptance matrix

| Area | Evidence in this checkpoint | Status |
| --- | --- | --- |
| Build/types | Root production build passed before the skin-finish addition; rebuild required | rerun pending |
| Shared online movement | acceleration/braking/spacing unit tests passed in `@frwf/game-core` (13 tests across 3 files) | passed; re-run with final tree |
| Worker security/runtime | local Worker typecheck and Miniflare test passed (10 integration tests) | passed before final skin addition; re-run with final tree |
| Two-client browser multiplayer | local DO room setup and both clients reached active match; movement-ack step exceeded the test timeout | failed; fix applied, rerun pending |
| Local heavyweight bout | prior release baseline: full playability suite 5/6; sixth table-contact case passed in a focused run | incomplete; one combined 6/6 run still required |
| Local ropes, corner, climb and prop lifecycle | code and isolated scenario coverage exist, but the latest player reports still reject the experience | not accepted |
| Character visual detail | effort-scaled skin sheen added; no image-based art acceptance after this change | unreviewed |
| Production live behavior | 1.4.2 health/discovery routes were checked after that release; no deployment in this increment | current gameplay changes are not deployed |

The first browser multiplayer timeout specifically showed that a synthetic one-frame WASD tap can begin and end between movement samples; it did not demonstrate an acknowledged movement. That test now presses and holds movement long enough to cross multiple render/physics samples. Do not mark responsive online control as passed until the full browser scenario verifies accepted commands, shared positions, combat contact and a normal result on both clients.

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
