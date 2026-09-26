# Physical wrestling and supplied combat motion — September 8, 2026

## Site purpose and scope

FRWF is an open-world wrestling game. This development pass on main addresses articulated movement, hit registration, lifts, landings and getting back under player control. It does not certify the complete game, seamless world combat, online parity or physical-device performance. The user committed intermediate work during the pass; the remaining working diff is not its complete change history.

## Product changes

- Replaced competing arm drives with one bounded controller per segment. Elbows use legal hinge targets, wrists follow the actual forearm, and standing hit reactions retain support. Recovery remains active until the wrestler is upright with foot contact, rather than declaring control restored while still folded.
- Get Up works at zero stamina. Repeated presses do not restart recovery. All five wrestlers recover from actual slams in the physical tests. A downward query against registered, intact tables selects the actual support surface; recovery no longer drives a wrestler through a tabletop toward the arena floor.
- Reproduced Chad's supplied backstage-table screenshot through the visible lab. Space gets him standing on the table; ordinary movement takes him off the edge and back onto supported floor control. The lab can now select the venue and minimize its diagnostics for unobstructed visual inspection.
- Tightened hand, arm and head colliders around the shipping skin, including the closed palm and forward boot toe. Predicted strike travel cannot score damage unless the solved collider actually reaches the target. Head and torso support correction uses the actual shapes and offsets, reducing premature landing separation.
- Clinch support, compact carry poses, release timing and torso landing support improve the lift-to-slam sequence. The ordinary keyboard journey follows visible grapple, release and cover prompts through an established cover, two-count and AI kickout.
- Imported five motion clips from four of the eleven supplied Combat FBXs: fighting stance, right punch, left punch, front kick and roundhouse. These become physical motor targets; they are not a separately animated skin. File hashes, trims and conversion details are in [Combat motion assets](COMBAT_MOTION_ASSETS.md). Seven supplied files remain catalogued but inactive.
- Corrected finger curling using the plane formed by actual finger joints. The previous assumed palm axis bent fingers sideways. The thumb now folds across the fist. Shipping-model regression checks cover both hands on all five characters.
- Regenerated more muscular character assets with skinned wrist tape and knee details; adjusted side lighting and shadows. Impact sound design now separates quiet swing air from layered contact transients. This pass did not include a listening acceptance test; louder audio is not proof of better combat.

## Follow-up from the supplied pose screenshots

- Reproduced intermediate waist inversion rather than only checking the final standing state: the front recovery reached 3.139 radians of relative spine rotation. Added physical angular limits to both spine joints and both hips. The limits run in Rapier, so the rendered skeleton and contact bodies share the same restriction. The 30 roster checks cover all five wrestlers across four recovery orientations and both sideways directions; the first expanded run exposed boot crossing on Vex and Nova.
- Knees and ankles follow their actual solved parent. Grounded thighs follow the pelvis through turns. Side shuffles limit inward leg travel; hip adduction and twist limits prevent the two legs winding around each other. No render-only correction hides an invalid physics pose.
- Removed the conflicting upward force on distal limbs during throw follow-through. The connected body now receives a common vertical impulse; authored poses retain limb articulation. Suplex, side toss, powerbomb and real contact-dependent pins are included in the physical suite.
- Fixed lab ownership: ordinary play keys release scripted held inputs, TAKE CONTROL restores normal playback and hides diagnostics, and automated approach yields to sideways steering. Editable form controls keep their keyboard input.
- COLLISION OVERLAY retains the actual human models. The steady camera uses a fixed angled view, with body bounds projected into that view, so fighters are less likely to completely overlap on screen.
- Removed the lab's forced half-resolution, un-antialiased rendering. The selected quality profile applies to the lab; decorative crowd work can still be reduced. Removed frozen shadow updates after a recording showed the newly selected backstage room disappearing. The repeated recording shows the floor, table, walls, lockers and both wrestlers again.
- Corrected lab playback pacing. The old rate divided the physics timestep, which caused more steps per wall-clock second and changed controller behavior. Lab playback now accumulates scaled wall time and advances the same 1/60-second steps as a normal match. STEP queues one fixed tick and remains paused afterward.

The unrestricted spherical-joint behavior is consistent with [Rapier's joint documentation](https://rapier.rs/docs/user_guides/javascript/joints/). Multi-axis limits use the installed 0.19.2 binding's typed raw joint-set API, isolated in `installAnatomicalLimits`; a dependency upgrade must preserve that contract. Joint handles are collected before mutation to avoid borrowing the WASM joint set during iteration.

## Changed files

Main areas: `src/game/physics/physicsRuntime.ts`, `bodySchema.ts`, `PhysicalFighterRig.tsx`; animation `poses.ts`, `choreography.ts`, `combatMotion.ts` and generated motion JSON; presentation `handPose.ts`; `HumanoidFighter.tsx`, `useHumanoidAsset.ts`, `FighterAccessories.tsx`, `Arena.tsx`, `GameScene.tsx`, `PhysicsLab.tsx`; match state, lab playback state, rendering quality, camera framing, player input, audio and styles; character generation and hashed GLBs; animation import/inspection tools; physical, skin-contact, motion and hand tests; browser recovery and wrestling journeys. Asset inventory and quality/master-plan documents are updated.

## Validation

Current local commands:

- `pnpm test`: **477 passed in 63 files**, including 93 actual-physics integration tests. Log: `/tmp/frwf-full-clock-anatomy-tests.log`.
- `pnpm build`: passed, including TypeScript compilation. Log: `/tmp/frwf-clock-build.log`.
- Lint passed. All six browser journeys passed (6.3 minutes), including intermediate recovery, exact single-step, and quarter-speed playback.
- `PLAYWRIGHT_PORT=4301 PLAYWRIGHT_SUITE=venue-live-shadows pnpm exec playwright test e2e/backstage-table-recovery.spec.ts`: passed, with console errors included and the restored room inspected in the screenshot.
- A separate native Chrome lab review displayed 60 FPS at idle. This is a single observation, not a frame-rate guarantee or a physical-device acceptance result.

 Earlier failures were retained and investigated: an obsolete locked-elbow pose assertion, a select locator that failed despite a visible combobox, and a motion-only recording interrupted by an AI throw. The isolated arm recording now disables AI decisions; the separate ordinary wrestling journey still uses the live easy AI.

Physical checks inspect real Rapier bodies and actual shipping skinned triangles. The visible-contact test permits a maximum 0.12 m sampled skin gap; it is a bounded regression check, not exact continuous mesh collision. Table checks cover four fall orientations and exhausted stamina. Browser recordings and screenshots are local artifacts under `test-results`.

## Platform impacts

- **Route standard:** existing API/health/platform routes are preserved; no new network route or protected mutation is added.
- **Discovery:** character hashes and motion source inventory reflect actual assets. Move certification documentation distinguishes the legacy `kick_up` registry entry from the zero-cost physical Get Up control. No inactive source clip is advertised as playable.
- **Trace/span:** existing propagation is preserved. No new trace export or external observability verification is claimed.
- **Auth:** unchanged. No secrets or new authentication paths are involved.
- **Cross-site integration:** unchanged. No new service integration or 150-site network compliance claim is made.
- **Deployment:** this report documents local development evidence. No deployment was performed by the agent during this pass.

## Known gaps and next work

The screenshot failures remain the quality reference; passing tests do not certify believable animation or fun. Paired throws still use authored procedural targets and tolerant spring grips, not paired human capture. Lift and cover transitions remain visibly stiff and need further authored motion work. Character faces, clothing and arenas remain stylized. Knockout clips need inspection and retargeting before activation. Physical iPhone/Safari and controller acceptance, audio listening, authoritative multiplayer parity, account-backed progression and seamless world-to-fight simulation are unfinished. The remaining PlatPhorm network standardization work is outside this repository's validation.
