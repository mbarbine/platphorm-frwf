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

## Changed files

Main areas: `src/game/physics/physicsRuntime.ts`, `bodySchema.ts`, `PhysicalFighterRig.tsx`; animation `poses.ts`, `choreography.ts`, `combatMotion.ts` and generated motion JSON; presentation `handPose.ts`; `HumanoidFighter.tsx`, `useHumanoidAsset.ts`, `FighterAccessories.tsx`, `Arena.tsx`, `GameScene.tsx`, `PhysicsLab.tsx`; match state, audio and styles; character generation and hashed GLBs; animation import/inspection tools; physical, skin-contact, motion and hand tests; browser recovery and wrestling journeys. Asset inventory and quality/master-plan documents are updated.

## Validation

Final command outcomes are recorded below after the final run. Earlier failures were retained and investigated: an obsolete locked-elbow pose assertion, a select locator that failed despite a visible combobox, and a motion-only recording interrupted by an AI throw. The isolated arm recording now disables AI decisions; the separate ordinary wrestling journey still uses the live easy AI.

Physical checks inspect real Rapier bodies and actual shipping skinned triangles. The visible-contact test permits a maximum 0.12 m sampled skin gap; it is a bounded regression check, not exact continuous mesh collision. Table checks cover four fall orientations and exhausted stamina. Browser recordings and screenshots are local artifacts under `test-results`.

## Platform impacts

- **Route standard:** existing API/health/platform routes are preserved; no new network route or protected mutation is added.
- **Discovery:** character hashes and motion source inventory reflect actual assets. Move certification documentation distinguishes the legacy `kick_up` registry entry from the zero-cost physical Get Up control. No inactive source clip is advertised as playable.
- **Trace/span:** existing propagation is preserved. No new trace export or external observability verification is claimed.
- **Auth:** unchanged. No secrets or new authentication paths are involved.
- **Cross-site integration:** unchanged. No new service integration or 150-site network compliance claim is made.
- **Deployment:** this report documents local development evidence. No deployment was performed by the agent during this pass.

## Known gaps and next work

Paired throws still use authored procedural targets and tolerant spring grips, not paired human capture. Lift and cover transitions remain visibly stiff and need further authored motion work. Character faces, clothing and arenas remain stylized. Knockout clips need inspection and retargeting before activation. Physical iPhone/Safari and controller acceptance, audio listening, authoritative multiplayer parity, account-backed progression and seamless world-to-fight simulation are unfinished. The remaining PlatPhorm network standardization work is outside this repository's validation.
