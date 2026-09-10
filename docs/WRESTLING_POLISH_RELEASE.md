# Wrestling motion and arena polish — FRWF 1.3.0

## Site purpose and summary

FRWF is an open-world style, local-first wrestling game with connected exploration and instanced bouts. This pass concentrates on readable wrestling motion, physical throw choices and arena presentation. It does not complete the larger open-world or motion-capture roadmap.

The physical defender previously used combat idle while grabbed and a diving pose after release: its half of the authored paired move was never sent to the motor controller. Both wrestlers now receive their respective move poses through the real articulated bodies. Neutral suplexes travel backward, side throws travel laterally, and power drops use less horizontal travel than slams. Deliberate player steering and environmental targeting retain priority. Damage still requires a solved contact; no pose or release awards a hit.

A short secured-clinch decision beat gives the player time to choose J/K/L before loading the throw. The physical lift then offers a 0.7-second decision window: J releases immediately, while a neutral grapple completes its default slam automatically. Desktop prompts and the grapple guide report Release Throw from the actual physical lift phase, matching the existing mobile button. Lightweight wooden venue tables yield more readily to a completed physical throw than the reinforced arena desk.

Locomotion now derives forward, backward and lateral steps from solved velocity relative to facing. Small movements scale the stride down, sprint stride stays compact, and combat movement retains a guard. Exploration uses the shared gait with relaxed arms. This is procedural gait rather than motion capture or a new foot-contact solver.

## Files changed

- `src/game/animation/locomotion.ts`, `src/game/world/WorldWrestler.tsx`: shared travel-aware gait and exploration knee/arm motion.
- `src/game/physics/throwMotion.ts`, `physicsRuntime.ts`, `grappleDynamics.ts`: distinct physical release profiles, paired defender motor targets, elapsed physical lift time and motion-task allowance for the decision beats.
- `src/game/systems/combat.ts`, `src/game/types/game.ts`: clinch cadence, contact point preservation and wooden-table response.
- `src/game/presentation/impactPresentation.ts`, `components/ImpactEffects.tsx`: effects anchored to the 3D manifold, short cloth/dust bursts, reduced-motion/low-flash handling and bounded cleanup.
- `src/game/components/WrestlingMat.tsx`, `Spectators.tsx`, `Arena.tsx`: continuous woven/scuffed canvas, printed FRWF branding, restrained rope emission, padded corners and articulated crowd silhouettes using five shared instanced meshes. The ring collider retains its original dimensions; visual cloth flex is bounded to 3.5 cm.
- `src/game/components/GameScene.tsx`: smaller player marker, identity retained during wrestling and ringside marker raised to the actual floor.
- `src/ui/ControlDeck.tsx`, `HUD.tsx`: actual lift-phase prompts.
- `src/tests/wrestlingPolish.test.ts`, `physicsRuntime.integration.test.ts`, `e2e/wrestling-polish.spec.ts`: motion, contact anchoring, distinct physical throws and ordinary-input throw selection/release coverage.
- `package.json`, public LLMS/API discovery and the collective master plan: version and accurate delivered scope.

## Commands and validation

- `pnpm verify` completed lint, typecheck, tests and production build on the final code.
- Full unit/integration run: 381 tests in 58 files passed. The physical suite contains 24 tests, including slam, suplex, side toss, powerbomb, wooden table, recovery and containment.
- Initial browser build: seven Chromium journeys passed (`circuit-combat`, `singles-input-motion`, `mobile-entry`, `showground`). These cover an ordinary completed outdoor bout with earned persistence, strikes/jump, live AI contact, phone entry and connected traversal.
- A later browser run passed the ordinary outdoor bout and both renderer lifecycle checks (pause/settings preserve the simulation; WebGL context loss recovers). The completed bout recorded two grapples and a pinfall through ordinary inputs.
- The final `e2e/wrestling-polish.spec.ts` run passed: normal menu entry, secured two-hand clinch, K throw choice, actual lift prompt, J manual release, contact-based damage and zero emergency resets. This timing-sensitive software-rendered test uses the game's Performance graphics setting. Earlier attempts exposed a short lift decision window and slow screenshot/input calls; those failures were investigated before the final 0.7-second physical window was verified.
- Staged and canonical deployment verification will be recorded after release.

## Product and platform impact

Product: clearer movement and paired throws, a readable throw-choice beat, less obstructive effects and a more detailed wrestling arena. Existing local world progression and all six encounters remain available.

Route standard: no route removed and no public mutation introduced. Discovery: LLMS and API capabilities describe the delivered procedural motion and physical release behavior. Trace/span, authentication and cross-site runtime behavior are unchanged. No new cloud integration or authentication capability is claimed. No Cloudflare deployment or storage cutover is part of this pass.

## Known gaps and next remediation

- These are procedural motors and art, not motion capture or photorealism. Grip tolerances, anatomical deformation, recovery silhouettes and paired hand placement still need work at normal game speed across the roster.
- Exploration and combat remain separate scenes. Seamless world combat requires shared scene/simulation ownership.
- Physical iPhone/controller acceptance, extended device performance and authoritative online parity remain unverified in this pass.
- Other PlatPhormNews sites were not changed or certified. Their remaining route, discovery, auth and trace standardization requires independent per-site work.
- Next product work: closer physical hand acquisition, grounded paired recovery, shared world/combat simulation, and usable captured/retargeted movement assets.
