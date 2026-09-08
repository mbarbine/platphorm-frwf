# Core wrestling quality review — 2026-09-08

## Site purpose and assessment

FRWF should be an enjoyable open-world style wrestling game. The user's rejection of 1.3.0 is a failed gameplay-quality result, despite technical checks passing. This review changes the next implementation priority; it does not claim to repair the game.

## Current direction: development rebuild, no release

The user rejected the current experience again: movement is still unsatisfactory and multiplayer does not work for them. There is no gameplay acceptance or release decision. No deployment has been performed by the agent during this unfinished pass. Concurrent user commits are preserved on main.

Priority is coherent body control and an actual two-player wrestling match, including joining, choosing wrestlers, playing, leaving and reconnecting. Localhost fallback on a deployed client, incompatible Cloudflare/Colyseus room protocols, and conflicting local/server gameplay authority are concrete multiplayer defects. A successful transport connection or one health decrement does not establish a playable multiplayer game.

## Evidence

A fresh Chromium recording of production 1.3.0 used normal menu entry, Atlas versus Easy Nova, default graphics, and a fixed sequence of L, K, J, F, movement and strikes. It did not mutate game state or choose inputs from hidden simulation counters. This was scripted play, not a human usability study or a performance benchmark; browser automation and software rendering introduce timing overhead.

- At approximately 25 seconds in the recording, the screen announces ONE while Atlas kneels beside Nova. There is no convincing body cover. The control deck simultaneously says READY TO FIGHT and advertises ordinary attacks.
- `startPin` in `src/game/systems/combat.ts` accepts a downed opponent within 1.7 world units and changes states. `updatePin` advances its count from elapsed state time, without verifying a sustained physical cover or grounded shoulders.
- `advancePhysicalGrapple` in `src/game/physics/physicsRuntime.ts` permits first/second hand acquisition at 1.04/1.1 units from the target surface. A logical secured grip therefore does not establish visible hand contact.
- The existing ordinary bout tests use simulation state and target coordinates to choose follow-up inputs. Those are useful integration checks, but they do not prove a newcomer can interpret the visible game or that a wrestling exchange looks credible.

## Rebuild acceptance criteria

1. Introduce one paired interaction owner for acquisition, clinch, throw, cover and escape, with explicit entry, interruption and exit rules. Preserve solved body/contact authority; avoid another layer of presentation-only offsets.
2. Make hands actually reach before confirming the grip. Coordinate body spacing and arm reach; simply shrinking the tolerance without fixing reach would make grapples harder to play.
3. Approach and establish a visible cover before counting. Count only while the required cover and shoulder support persist; break or pause it coherently when the relationship is lost.
4. Derive HUD and available actions from the same interaction phase. Pinning cannot advertise READY TO FIGHT or imply ordinary standing strikes are available.
5. Review the entire exchange at normal speed across roster sizes and both touch/keyboard inputs. Look for planted support, clear anticipation, a connected lift, readable landing, grounded recovery and an understandable opportunity to continue. A scored hit or completed pin alone does not satisfy this check.

Keep the open-world roadmap, but postpone additional places and spectacle until this exchange is understandable and worth repeating. Captured animation will need cleanup, retargeting and interaction integration; importing footage alone will not fix these rules.

## Baseline review report and limits

- Files changed: this review and the priority section of `COLLECTIVE_MASTER_PLAN.md`.
- Commands run: Git status, targeted source searches/reads, a temporary Playwright recording script and FFmpeg frame extraction; `git diff --check`.
- Tests: no new acceptance claim and no code test rerun for these documentation-only changes. The recorded visual review fails the physical-cover/readable-controls criterion.
- Product impact: priority and acceptance criteria corrected; runtime behavior remains unchanged.
- Route standard, discovery files, trace/span, auth and cross-site integration impact: unchanged; no deployment or provider mutation in this review.
- Known gaps: the defects above remain unfixed. Physical iPhone acceptance, character fidelity, seamless world combat and online parity remain open.
- Other network sites: not changed or certified; platform standardization remains per-site work.


## 1.4.1 implementation

The user committed and deployed an intermediate 1.4.0 during this work. Version 1.4.1 contains the subsequent contact/cover corrections and revised default-graphics journey.

This pass repairs the contact and presentation defects found above. It is not a claim of photorealism or completed open-world gameplay.

- Chest colliders now preserve shoulder width with a shallower rounded cross-section. The floor penetration fallback uses the rotated chest dimensions and only corrects actual penetration; its old spherical approximation lifted the visible torso before contact. Cover posture lowers the hips, bends the knees and puts weight onto the opponent.
- Physical knee motor targets now match the hinge flexion direction. Fallen wrestlers retain passive limb support relative to their actual pelvis rather than switching off every limb motor. Gravity and solved landing contacts still determine the fall.
- Carry poses now follow the physical lift phase for both wrestlers; the old generic animation clock still showed the attacker crouching while the victim had already been lifted. The manual release beat is longer and still has an automatic fallback.
- All standing throw choices enter through the same reachable collar tie. Hand acquisition tolerances shrink from 1.04/1.1 to 0.34/0.46 world units from the target surface. This remains a tolerant spring grip, not exact finger contact.
- Uppercuts use a compact loaded stance, a rising bent-elbow path and a short physical step. Arcade quick attacks cycle jab, combination and uppercut. Nearby strikes have cancellable approach assistance; guard, retreat, pause, target loss and expiry cancel it.
- Major throws leave a longer follow-up window. Pinning drives an actual cross-body pose. Counting requires recent solved torso contact (100 ms tolerance for solver chatter), torso overlap, appropriate vertical separation, a supine defender and shoulders near the floor. Lost geometry resets the count; persistent failure releases the interaction. This combines existing solver manifolds with geometric checks, not a referee-vision system.
- Pin controls now say COVERING/HOLD COVER instead of READY TO FIGHT. Routine duplicate messages and oversized hit text are suppressed. Default screen shake is reduced, low-flash defaults on, and standard bouts omit lasers and moving light decorations. Saved settings are preserved.
- Round ring ropes, neutral ring lighting, joint-attached knee pads, wrist tape and boot laces improve readable wrestling detail. Atlas's crown stays in preview/victory rather than floating through combat. The existing human assets are preserved; no captured motion or new photoreal character scan is included.

### Hosting and platform boundaries

Vercel remains the canonical host. Cloudflare production now has a static-assets deployment configuration for the same local game plus the existing isolated private-room Worker. No DNS migration is part of this pass. D1, R2 and production operator auth are deliberately not configured: Worker health must report degraded/not_configured, protected creation must fail closed, and online parity/cloud saves must not be advertised. Worker private rooms are not connected to the current client matchmaking.

Cloudflare static assets preserve frame restrictions and safe browser headers. Worker API responses retain PLATPHORM_API_KEY authorization, bounded input parsing, JSON-RPC introspection and local trace context. No cross-site trace export or new integration is claimed. Client discovery describes the new local controls and cover evidence. Other network repositories are neither changed nor certified by this development work.

### Validation scope

Existing tests are retained only for their narrow regression claims. They are not an acceptance score or certification of playability. The ordinary exchange journey now follows visible throw/pin prompts at default graphics and records its video; hidden state cannot choose the next action. Visual review already rejected two earlier passing cover implementations in this pass.

The unit/physics checks cover uppercut contact, legal knee flexion, real solver-driven cover establishment, no pin counting from state flags, loss of cover, cancelled approaches and the neutral uppercut sequence. Browser checks cover menu entry, ordinary throw/cover controls, recovery, render lifecycle, mobile entry and world combat. Development evidence records exact commands and outcomes separately; an assertion passing is not proof that the game meets the user's quality bar.

Next work: authored or captured paired animation clips, more consistent human silhouettes during every throw, deeper grounded mat wrestling, physical iPhone playtesting and seamless exploration-to-combat interaction. Storage-backed progression and online parity remain separate unfinished features.


## Arm and hand defect correction — September 8, 2026

**Site purpose:** FRWF is an open-world wrestling game. This is an unfinished development correction on main, not a release or an acceptance claim.

**Summary / product impact:** The idle arm defect was reproducible in the actual Rapier rig: Atlas reached the 24 rad/s angular-speed safety cap, with a 2.283 rad (131 degree) hand-to-forearm rotation error. Elbow targets included rotations forbidden by their X-only hinges. The same arm received a bounded angular-velocity drive followed by a PD torque impulse and an opposite parent impulse. Hands additionally switched between world rotation locks and driven motion. The correction keeps the wrist chain live, limits elbow targets to their legal bend, follows the solved parent, and uses one controller for each arm segment. Arm support was tuned against real hand positions so holding guard raises the hands toward the chin.

The hand renderer now curls fingers toward their own palm plane with distinct thumb/link angles. Wrist tape is colored into the skinned character geometry rather than duplicated as floating torus accessories. Regenerated character files retain the existing source attribution and content hashes. This does not introduce captured human motion or solve all mesh retargeting defects.

**Files changed:** `src/game/physics/physicsRuntime.ts`, `src/game/animation/poses.ts`, `src/game/components/HumanoidFighter.tsx`, `src/game/components/useHumanoidAsset.ts`, `src/game/components/FighterAccessories.tsx`, `tools/characters/build-human-assets.mjs`, `public/characters/manifest.json` and five new hashed GLBs, `src/tests/physicsRuntime.integration.test.ts`, `src/tests/bodyworksUpgrade.test.ts`, `e2e/arm-control-review.spec.ts`, and this report. The user committed intermediate changes during the work; the current working diff is not the complete change history.

**Tests and commands:**

- `node tools/characters/build-human-assets.mjs` — generated all five assets.
- `pnpm build` — passed, including TypeScript compilation.
- `pnpm lint` — passed.
- `pnpm test` — 396 passed, 1 failed. The remaining failure is the actual cross-body cover/count regression in `physicsRuntime.integration.test.ts`; it is retained as a failure.
- All five characters pass real-rig idle checks: arm angular speed below 1 rad/s after settling and wrist error below 0.35 rad. A new physical guard check requires both hands to reach chest height within one second of holding guard.
- Removed the old guard test that asserted arbitrary authored Euler ranges, including sideways elbow twist. Its replacement measures the solved hand positions; this is not a quality score.
- `PLAYWRIGHT_PORT=4298 PLAYWRIGHT_SUITE=arm-skin-review pnpm exec playwright test e2e/arm-control-review.spec.ts` — passed the default-graphics menu/input sequence, held movement, held guard, and punches, with no page errors. Reviewed screenshots and frames from the recording at `test-results/arm-skin-review/arm-control-review-records-f379e-hes-through-player-controls/video.webm`. This narrow automated sequence does not certify combat quality.

**Route standard impact:** No route changes. Existing platform surfaces remain in place and were not re-certified by this arm pass.

**Discovery file impact:** Character asset manifest updated to actual generated hashes. No new API capabilities or online availability claims.

**Trace/span impact:** No trace or propagation changes; no cross-site export verification claimed.

**Auth impact:** No authentication changes, secret changes, or new public operator actions.

**Cross-site integration impact:** No provider deployment or new integration in this correction. Other network sites remain outside this repository's validation scope.

**Known gaps:** The physical cover can settle without sustained torso contact and therefore never count; the failing test remains. Browser footage still exposes poor knockdown/recovery poses and detached-looking knee equipment. The character/contact skeleton fit needs more work. Production multiplayer parity, mobile-device playability, and the broader open-world experience are still unfinished. The normal throw-to-pin journey previously failed and has not been reclassified as passing.

**Next remediation:** Correct cover weight/support and paired body placement while preserving real contact requirements; repair knockdown-to-recovery pose continuity; align remaining skin/accessory landmarks; continue the actual two-player match and physical-mobile journeys. Do not release based on these narrow tests.
