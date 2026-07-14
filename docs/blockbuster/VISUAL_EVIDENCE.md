# Blockbuster visual evidence contract

Final evidence root: `test-results/blockbuster-release/`  
Baseline scratch root: `/tmp/ringfall-blockbuster-baseline/`

Every release-candidate capture uses a deterministic seed, fixed fighter pairing, named camera shot, quality tier, viewport, reduced-motion state, and release identity. Pixel-perfect cross-GPU equality is not the only gate; screenshots and videos are reviewed for silhouette, contact, control, clipping, camera, and outcome.

## Required capture set

- Fighters: front, side, combat stance, guard, short taunt, victory, defeat, signature for Atlas, Vex, Nova, Brick and Chad.
- Locomotion: idle, forward, backward, left/right strafe, diagonal, run, brake, pivot, guard-walk, exhausted, ringside, apron and turnbuckle.
- Strikes: jab anticipation/contact/recovery, hook, uppercut, low kick, front kick, roundhouse, high kick, blocked punch, blocked kick, counter, whiff and running stiff-arm.
- Grapples: approach, first grip, second grip, collar lock, wrist control, waist lock, resistance, selected move, body-slam load/peak/impact, suplex, powerbomb, spinebuster, arm drag, side toss, trip, whip, corner rail shot and every signature.
- Environment: four ring sides, ringside, entrance, commentary table intact/stressed/cracked/collapsed, chair, sign, trash can, steps, barricade, crowd, arena event and results.
- Devices and settings: mobile portrait/landscape, gamepad prompt, touch simultaneous move/action, reduced motion, high contrast, performance, balanced and quality tiers.

## Naming

`<seed>-<fighter>-<opponent>-<scenario>-<phase>-<camera>-<tier>-<viewport>.png|webm`

## Human review columns

Each artifact is scored pass/fail for: action recognizable without HUD; attacker limb visible; defender reaction localized; grip anchors visible; feet/support believable; no material clipping; no teleport; camera preserves axis; impact timing correct; control returned; fighter identity distinct; arena hierarchy supports the action.
