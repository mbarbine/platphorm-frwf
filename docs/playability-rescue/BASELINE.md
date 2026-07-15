# Playability rescue baseline

Date: 2026-07-14  
Repository: `platphorm-frwf`  
Branch: `main`  
Baseline commit: `0cf60d84ff9b60c6a7714a36caa73a99cbe28ef1`

Status: **control-to-visible-action rescue in progress; not playability certified; production not promoted by this pass**.

## Product role

RINGFALL: CHAOS CIRCUIT is a browser arcade-wrestling game. Its decisive user loop is immediate and physical: move a wrestler intentionally, see the wrestler plant and face the threat, perform a readable action, understand whether it hit or missed, grapple, slam, survive or lose, then spectate or rematch. Platform routes remain important, but they do not compensate for an unreadable or uncontrollable match.

## Truth captured before the rescue

- `main` and `origin/main` both pointed at the baseline commit above when this file was created.
- `pnpm verify` passed lint, TypeScript, 27 Vitest files / 154 tests, and the production build on the preceding candidate. That proves code and bundle integrity, not playability.
- The focused Battle Royale Playwright journey passed two scenarios in roughly two minutes on the preceding candidate.
- Focused combat and camera unit coverage passed after the Battle Royale opening grace was extended to 4.2 seconds.
- The focused Physics Lab browser journey most recently failed before it could prove the standing-jump control acknowledgement (`data-saw-active-jump-control`). This remains a release blocker until reproduced and fixed on the rescue candidate.
- An in-app Browser local match showed five procedural rigs converging into an opening pile. A player could be knocked airborne before their action intent became visually legible. The rigs and action poses still read as primitive articulated puppets rather than deliberate wrestlers.
- A fresh local DOM sample began with the player idle and all five fighters at 100 health. This proves initial state only; it does not prove control response.
- The in-app Browser could not open `https://frwf.platphormnews.com/api/release` during this capture because the client reported `ERR_BLOCKED_BY_CLIENT`. Production release identity is therefore **unverified**, not healthy by assumption.
- The Chrome extension bridge was unavailable because the browser profile/native-host checks were denied by the local environment. Chrome is an open tooling/device verification gap for this pass.

## Reproducible failure ledger

| Gate | Setup | Expected | Baseline result |
| --- | --- | --- | --- |
| Battle Royale opening | Default Battle Royale, seed `1337`, Atlas player | A readable opening bell with enough time to orient and move | Opening grace is now 4.2 seconds, but the full human feel gate is not certified |
| Neutral movement | Fresh match, hold and release each cardinal direction | Prompt acceleration, planted steps, clean stop, no puppet drift | Automated movement coverage exists; human stability and legibility remain unverified |
| Input acknowledgement | Fresh match, press one action at a time | One semantic action, one visible acknowledgement, one outcome | Two command buffers exist and expiry/rejection is mostly silent |
| Punch and kick | Legal and deliberately out-of-range setups | Distinct anticipation/contact/recovery and explicit hit or miss | Contact tests exist; silhouette and player-facing outcome readability remain uncertified |
| Context actions | Competing pin, finisher, climb, apron, and prop opportunities | Deterministic priority with an explainable resolved action | Priority is embedded in `requestCommand`; it has no typed preview/outcome contract |
| Standing jump | `PLAYWRIGHT_PORT=42821 pnpm exec playwright test e2e/physics-lab.spec.ts --grep "bodyworks" --reporter=line` | Jump control lights and pelvis rises by more than 0.2 m | Last focused run failed at active jump-control acknowledgement |
| Production identity | In-app Browser to `/api/release` | Public, inspectable release identity | Browser blocked the request; current production is unverified |

## Architectural causes

1. Keyboard, gamepad, XR, and touch map directly to legacy `GameCommand` strings instead of a shared semantic `GameAction` event.
2. Device inputs first enter a 220–240 ms `BoundedCommandBuffer`; gameplay then copies them into a second 160 ms physics command queue. The duplicate buffering obscures sequence, source, acknowledgement, and expiry timing.
3. Movement, run, and guard are transported as unrelated held booleans while edge actions are bare strings. There is no common `started` / `held` / `released` lifecycle.
4. Context resolution, combat legality, physical side effects, and player feedback are coupled inside `requestCommand` and the match store callback.
5. Rejected commands can remain queued until expiry, but the game does not expose bounded counts for buffered, executed, expired, rejected, or duplicate actions.
6. The shipping keyboard grammar still uses `U` for dodge and `Space` for jump, contrary to the rescue grammar of `Space` dodge/counter/kickout and `C` jump.
7. Mobile controls choose legacy commands in the UI. This allows presentation code to participate in gameplay semantics instead of emitting the same action contract used by every device.

## Rescue order

1. Introduce one typed `GameAction` / `ActionEvent` contract for keyboard, gamepad, touch, XR, AI, replay, and network sources.
2. Add a bounded, instrumented action buffer with deterministic sequence, priority, deduplication, consumption, expiry, and wait-time metrics.
3. Centralize device mapping and migrate the keyboard grammar to J/K/L/I, Space, C, E, F, and Q.
4. Resolve `F` and `E` through typed context previews and outcomes; show concise player-facing acknowledgement.
5. Re-certify neutral movement and unexplained-fall behavior before expanding combat.
6. Re-certify stance, punch, kick, guard, hit, miss, and counter in that order.
7. Re-certify grapple acquisition and the basic body slam.
8. Run focused automation, then the longer GitHub Actions matrix, device/hardware checks, human-play matrices, preview identity, and live route verification.

## Acceptance rule

No control is complete because a keydown handler fired, a unit test passed, or an animation state changed. It is complete only when one semantic action is accepted once, produces an immediate readable acknowledgement, resolves to an honest outcome, and is repeatable in deterministic automation and human play without unexplained falls, duplicate execution, or hidden expiry.
