# Wrestling control and asset preparation — September 12, 2026

## Purpose and scope

FRWF remains an open-world wrestling simulator. This batch addresses competing movement controllers, fatigue consistency, skin-to-physics compatibility, and build reliability. It does not certify the full simulator as fun or production-ready. PR approval and merging are being handled by the user; this batch has not been pushed or deployed by the agent.

## Implemented

- One facing target per simulation tick replaces travel-facing followed by opponent-facing. Steady backpedalling no longer generates turn recoil merely because looking and travelling point in opposite directions. A small retreat stance clearance fixes the four previously failing actual-rig boot-lane cases. These earlier edits were committed by the user during the pass.
- A shared stamina-aware locomotion intent now controls both the rules integrator and physical drive. Holding sprint at zero stamina produces the same movement as exhausted walking, rather than retaining a separate physical sprint speed.
- World-space physical poses are converted into local bone transforms. Parent rotation/translation and uniform scale are tested, including changing nested parents. Character fitting measures world-space head-to-foot span. This prepares for richer authored rigs; it does not retarget arbitrary MPFB bone pivots or introduce new character art.
- Shared workspace packages build before dev, typecheck, test and production build, fixing missing package entry points on fresh checkouts.
- Reconciled the spectator announcement after concurrent merges: one atomic live region and a defined camera name.
- Singles browser journeys explicitly choose Singles instead of relying on the Battle Royale default. Recovery evidence hides the lab overlay before capturing the standing frame.
- Audited the supplied underground archive, hashes, geometry, materials and collision bounds. No runtime venue replacement has been made. The old skeleton proposal is now clearly labelled as distinct from the shipping contract.

## Verification

Current checkout at validation: main, e9ce688 plus the changes in this batch.

- `pnpm verify`: passed lint, typecheck, all 514 tests across 67 files, and production build.
- `git diff --check`: passed.
- Current-build browser batch: four passed, one failed. Passing: touch get-up, ordinary clinch/throw/cover/kickout, Battle Royale default plus backstep/camera/mobile HUD checks, and ordinary AI pursuit/contact. The failing Singles journey completed its first retreat and jump but failed a second straight retreat after entering a rope rebound.
- Removed that redundant second retreat from the heavy-action setup; retained the first retreat, jump-height, landing, action and no-emergency-reset assertions. Targeted rerun still failed: Jump input was recorded but no jumping state appeared within eight seconds while the live opponent resumed attacks. This intermittent input/action-window failure remains open; the browser suite is not green.
- Re-ran touch recovery after hiding the lab for its evidence screenshot: passed. Targeted ESLint on changed browser tests passed.
- Commands: `PLAYWRIGHT_PORT=4319 PLAYWRIGHT_SUITE=phase-final pnpm exec playwright test e2e/match-readability.spec.ts e2e/get-up-control.spec.ts e2e/wrestling-polish.spec.ts e2e/singles-input-motion.spec.ts`; separate targeted recovery and Easy Singles reruns used ports 4320 and 4321. Browser-emulated touch is not physical-device certification.
- Evidence: `test-results/readability-grounded.png`, `test-results/touch-get-up-standing.png`, and the failing trace under `test-results/phase-ordinary-control/`. Inspected standing frames show supported bodies, but current mesh/material detail still falls short of the requested realism.

## Platform impact

No API, auth, route, discovery or trace behavior is intentionally changed by this simulator batch. Existing platform contract checks run within the suite; this is not a fresh live audit of the 150-site network. No new cross-site integration is claimed. Temporary PR-review backend changes were not copied into this batch.

## Remaining priorities

1. Resolve the intermittent ordinary Singles jump/action-window failure. Inspect command acceptance, rope rebound ownership, and legal-state changes between input and physical execution. Retain the failing jump assertion; add a dedicated ordinary-control rope-release scenario instead of requiring uninterrupted straight retreat through a ring boundary.
2. Judge full-speed strike, paired slam and recovery footage for visible contact and controllability. Passing numerical checks alone is insufficient.
3. Author and inspect one MPFB wrestler with correct anatomical bind offsets, materials and physical dimensions before replacing the roster. Blender/MPFB export was not available in this pass.
4. Align the underground venue collider deck and dimensions with its visual scene and encounter boundaries. The provided LODs differ in content; do not assume interchangeability.
5. Measure full-match frame time and memory; complete two-client network authority/reconnect testing and physical phone/tablet/XR checks before claiming broad platform support.

## Continuation: jump acceptance and interruption feedback

The previous failing trace records `jump` as expired while the wrestler was staggered (85.6 stamina, near-ground vertical offset). That is an interrupted action window, not evidence that the browser lost the key. The previous test stopped retreating and waited for idle, allowing the rival to attack before C. The test now jumps while retreating through open space and explicitly checks executed status, upward travel, landing and zero emergency resets.

A separate physical acceptance defect was fixed: the old rules path spent stamina and announced jumping before queuing an impulse that the later physical controller could discard for missing support or cooldown. The store now waits for actual foot support/cooldown before accepting a standing jump. Accepted jumps apply the impulse immediately. Corner aerials keep their own dive path. No pelvis-height fallback manufactures support, and rejected/repeated launch requests apply no impulse.

Buffered actions retain the cause of deferral through expiration. The HUD can explain being hit, being held, or waiting for landing instead of showing only a generic expired-input message. The buffer duration remains bounded at 250 ms for ordinary actions.

New regressions cover the actual store-to-Rapier transition (no stamina spent while unsupported; one launch when support returns), unsupported/repeated impulses, physical upward travel and preserved interruption feedback. `pnpm verify` passed lint, typecheck, 517 tests across 67 files, and build. Browser results follow below.

Changed implementation files in this continuation: `src/game/physics/physicsRuntime.ts`, `src/game/state/matchStore.ts`; tests: `src/tests/physicsRuntime.integration.test.ts`, `src/tests/combat.test.ts`, `e2e/singles-input-motion.spec.ts`. No dependencies, public routes, discovery files, auth behavior, trace handling, cross-site integrations, PRs or deployments were changed. Real-device, multiplayer and full visual-quality acceptance remain outstanding.

### Browser outcome for the continuation

`PLAYWRIGHT_PORT=4322 PLAYWRIGHT_SUITE=jump-acceptance pnpm exec playwright test e2e/singles-input-motion.spec.ts e2e/get-up-control.spec.ts e2e/wrestling-polish.spec.ts` passed all four journeys (2.7 minutes).

`PLAYWRIGHT_PORT=4323 PLAYWRIGHT_SUITE=jump-repeat pnpm exec playwright test e2e/singles-input-motion.spec.ts --grep 'Easy Singles' --repeat-each=2` produced one pass and one failure. Both repetitions completed accepted jump, measurable ascent and landing. The failing repetition reached a pelvis peak of 4.476 m, then failed the heavy-strike visibility assertion: the HUD reported the heavy input executed while the trace showed an uppercut impact, player staggered, and no remaining move ID. The assertion remains intact. This is a separate accepted-attack/interruption visibility issue; the full browser suite is not certified stable.

Next remediation: correlate accepted attack instances with physical interruptions so the UI distinguishes started, visibly performed and interrupted attacks. Inspect whether a move can be canceled before a render frame and evaluate the pacing of neutral exchanges. Do not grant arbitrary invulnerability or weaken the visible-action assertion merely to pass the test. Jump readiness/launch acceptance is fixed and covered; the wider wrestling-quality phase remains in progress.
