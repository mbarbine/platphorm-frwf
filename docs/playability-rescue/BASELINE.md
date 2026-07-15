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

## Phase 1 checkpoint — 2026-07-15

Status: **local controls/action-resolution checkpoint passed; human play, physical devices, preview identity, and production remain unverified**.

- The runtime now accepts the shared typed `GameAction` / `ActionEvent` contract through one authoritative, instrumented `ActionBuffer` before physics execution.
- Ordinary actions expire after 150 ms, context actions after 110 ms, and duplicate edges are rejected inside a 48 ms window. The buffer is bounded at 32 actions and rejects new overflow honestly instead of silently evicting an accepted action.
- Ready actions resolve by explicit gameplay priority and then sequence. Context, dodge/counter, grapple, and strike ordering is therefore deterministic without erasing same-priority input order.
- Buffer feedback distinguishes buffered, executed, duplicate, expired, and rejected actions and includes a concise reason where one exists. HUD diagnostics expose the latest status and reason.
- Pause, focus loss, document hiding, teardown, defeat, and victory clear or reject pending local actions. Gamepad state is sampled on resume so a button held through pause cannot become a fresh edge.
- Mobile match controls become unavailable while paused, the pause button retains a real physical hit target, and a touch edge attempted during pause does not execute after resume.
- Neutral J/K/L prompts now name Circuit Jab, Piston Boot, and Collar Lock before input. F and E labels come from the same authoritative context/prop resolvers used by execution, and executed feedback retains the exact resolved name after transient move state clears.
- The neutral first L establishes a collar lock on the default Voltage Slam/body-slam path. A second neutral L during the secured grapple still selects Voltage Piledriver, preserving move depth instead of deleting it.
- Settings now expose full, compact, prompts-only, and hidden control-deck modes. Compact shows five primary actions; prompts-only retains contextual/action feedback; hidden removes the deck, tutorial, contextual hint, grapple guide, and action strip.
- Local controls evidence on the current working tree: lint passed; strict TypeScript passed; 30 Vitest files / 190 tests passed; production build passed; the three-test gamepad/mobile lifecycle set passed in 36.9 seconds; and the four-mode control-deck browser matrix passed 4/4 in 48.4 seconds.
- The broader playability suite passed 6/6 once in 3.5 minutes, then passed only 5/6 on the immediate final repeat in 4.4 minutes. The rope scenario visibly loaded and entered the stiff-arm move but never produced the required physical forearm contact, health impact, or knockdown. It remains a deterministic-repeatability blocker and is not reported as green.
- The build still reports the known isolated Rapier WASM chunk at 2,236.66 kB minified, above the 900 kB warning threshold. This is recorded, not treated as a failed control gate or hidden.
- Network disconnect clearing is not claimed by this checkpoint because multiplayer transport is a later gated phase. Neutral human feel, unexplained-fall rate, real device latency, and visible action readability still require their own acceptance evidence.

## Phase 2 checkpoint — 2026-07-15

Status: **neutral stability passes the current automated production-build gate; human feel, manual Toy Test, and physical-device certification remain open**.

- Neutral idle, locomotion, and blocking now use a formal combat-orientation model with independent movement heading, opponent-facing chest orientation, and bounded head tracking. Rear targets cannot snap the full body away from the selected movement direction.
- The production wrestler hierarchy applies the bounded torso and head corrections while the physical rig remains authoritative for support and movement.
- Exact center overlap now receives a deterministic separation direction instead of being mistaken for an already-safe distance. Closing fighters receive a bounded push; fighters already separating do not receive an artificial launch.
- The headless Rapier traversal matrix moved all five wrestlers through eight cardinal/diagonal directions and a stop phase with zero unknown falls, zero unexplained unstable time, and zero emergency resets.
- The production-build neutral browser suite passed 2/2 in 54.8 seconds: standing, walk, stop, run, brake, rapid turn, and close-overlap separation all completed with supported idle return, zero unknown falls, zero unexplained unstable time, and zero emergency resets.
- The 50-match deterministic AI soak completed 50/50. Its 218 falls were categorized as 102 registered-impact falls and 116 throw falls; unknown falls, unexplained unstable time, and emergency fall attribution were zero.
- The production-build automated Toy Test passed 1/1 in 32.5 seconds after movement with zero unknown falls, zero unexplained unstable time, and zero emergency resets.
- A production-preview screenshot review showed two upright, two-foot-supported wrestlers squared toward one another with raised hands. The same frame reported combat stance, zero facing error, zero unknown falls, and no console errors. The close-range models remain visibly procedural, so this is not wrestler-visual certification.
- A human still must complete the neutral keyboard/gamepad/touch traversal matrix and the ten-minute Toy Test. Automation cannot certify responsiveness, visual intention, or fun.

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
