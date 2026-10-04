# RINGFALL character and motion upgrades — October 4

RINGFALL remains a wrestling game. The acceptance target is readable, responsive wrestling with grounded recovery, distinct wrestlers, expressive faces, credible hair and clothing, independent crowd behavior, and verified multiplayer. Passing unit tests does not certify that target.

## Current changes

- Slow the captured neutral stance cadence and reduce elbow excursion while retaining shoulder movement and torso breathing. All 19 roster entries pass the existing physical idle-arm vibration and wrist-orientation checks without relaxing their thresholds.
- Add a full-cycle idle-elbow continuity regression.
- Repair strict indexed-access errors in the upstream mat optimization while retaining direct array deformation. Framing tests project a clone rather than mutating their shared point fixture.
- Record actual GLB structure in `docs/assets/character-expression-audit.json`: 17 of 19 entries contain hair meshes; none contain eye bones or named facial morph targets. This is structural evidence, not a claim of attractive or correct rendered hair.

## Verification

- `pnpm test`: 931 app tests and 22 game-core tests passed before adding the new continuity test.
- Focused combat-motion and framing run: 22 tests passed, including the new continuity test.
- `pnpm build`: passed after repairing strict indexed reads.
- `pnpm lint` and `pnpm typecheck`: passed.
- Browser idle stability: the first run failed in selection before entering a match because its case-sensitive accessible-name selector was stale. Selector repaired; rerun entered the match and passed pose-range and zero-reset assertions, then failed because the browser logged `Failed to load resource: net::ERR_FAILED`. Trace identifies `/audio/hollow-point-ritual.ccd7b9b89eee.mp3` as the failed request; the file exists in both public and dist. Playback/browser transport still requires diagnosis. No full browser acceptance claim.
- No deployment in this pass; production remains separately unverified.

## Required remaining work

1. Export independently controlled eyes and eyelids plus authored facial expressions; preserve face likeness, source provenance and performance budgets. Baked eye spheres bound to the head cannot supply gaze or blinking.
2. Inspect hair in the main humanoid renderer for silhouette, scalp coverage, transparency and venue lighting. Profile labels do not prove unique hairstyles render.
3. Validate hand-post, knee-gather and rise in actual bouts for all landing orientations and body types. Earlier recovery timing changes are not proof that get-ups look human.
4. Inspect falls and match-end poses at ropes, mat edges and overlapping bodies; distinguish outcome poses from live ragdoll state.
5. Playtest crowd reactions, avoid symmetric spread-arm poses, and improve clothing/face diversity without duplicating portraits.
6. Verify every online seat has independent input, facing, reconciliation, effects and camera focus. Measure latency; do not promise zero latency.
7. Finish mobile HUD/replay/camera acceptance and production release checks, including downloaded entry-bundle identity.

Routes, discovery, shared auth and trace behavior were not changed by this motion/build repair. Network-wide platform standardization remains outside this repository-specific verification.
