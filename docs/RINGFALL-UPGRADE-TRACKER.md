# RINGFALL upgrade tracker

This tracker records evidence against `upgrade-9262026.md`. A build or a unit
test for a helper does not count as proof of a visible, interactive gameplay
requirement. “Partial” means implementation exists but important acceptance
checks remain; “Unverified” means the implementation or evidence is not yet
strong enough to claim completion.

| Area | Current evidence | Status | Next acceptance evidence |
| --- | --- | --- | --- |
| Repository / system ownership | React Three Fiber, Rapier, fixed-step `BodyWorksRuntime`, combat state machine, local input and Colyseus networking are present. | Partial | Audit every position/orientation writer and prove normal speed/contact behavior across physics and non-physics modes. |
| Character rigs / proportions | `FighterModel`, `PhysicalPoseBinding`, `bodySchema`, and roster-specific visual profiles exist. | Unverified | Capture a representative roster review and measure sole, wrist, joint, and scale alignment. |
| Locomotion / foot placement | `bodyDynamics.ts`, `FighterModel.tsx`, `gaitCycle.ts`, `physicsRuntime.ts`; tests cover speed, braking, backstep, analog/diagonal limits, and bounded gait amplitude. Footstep offsets now follow solved travel direction while body facing can remain locked on the opponent; a live Singles check confirms keyboard walk produces real rigid-body speed and settles after release. | Partial | Measure planted-foot drift and compare walk/run, turn, retreat, and strafe captures at normal and slow speed. |
| Input / target selection | `playerController.ts`, action layer, device and mobile-control tests exist. | Partial | Verify simultaneous multitouch, cancellation/focus loss, buffer expiry, target hysteresis, and retained target on committed attacks. |
| Strikes / contact | Move data, strike resolver, physical contact events, and combat tests exist. | Partial | Demonstrate swept active windows, one hit per target, miss/block/counter distinctions, and matching reactions at varied frame rates. |
| Paired wrestling | Grapple state and physical grip tracking/cleanup are implemented in combat and `physicsRuntime.ts`. | Partial | Verify each named sequence end-to-end, paired phase clock, grip anchors, interruption, size differences, and cleanup. |
| Specific move choreography | Move catalog, paired poses, and move-specific controllers exist. | Unverified | Record normal and slow-motion evidence for each requested sequence in `upgrade-9262026.md`. |
| Falls / recovery | Recovery state and poses plus knockdown tests exist. | Partial | Verify prone/supine/side recovery, planted rise, residual settling, and restored control without snapping. |
| Ring / spatial behavior | Ring bounds, ropes, turnbuckles, ringside transitions, and arena venues exist. | Partial | Verify visible/collision agreement and representative rope, corner, and ringside transitions. |
| Match pacing / fun | Stamina, momentum, counters, hit reactions, and battle-royale modes are present. | Unverified | Run controlled match scenarios for stun chains, defensive options, stamina recovery, and match duration. |
| AI | Targeting and opponent decisions exist, including battle-royale opponent selection. | Partial | Measure commitment crowding, reservations, grounded response, difficulty fairness, and eliminated-target rejection in full-roster matches. |
| Character visuals | Procedural roster models, authored source portraits, clothing and roster-specific profiles exist. | Partial | Review actual close/medium shots for all roster members and correct proportions/deformation with provenance recorded. |
| Arena / crowd / lighting | Turkey Dome, backyard, and other venue components plus crowd/lighting assets exist. | Partial | Capture venue comparisons and verify foreground readability, atmosphere, crowd variety, and device cost. |
| Audio / impact | Browser sound and combat/crowd event paths exist. | Unverified | Verify footfall and impact timing against confirmed contact, audio activation, mute, volume persistence, and concurrency. |
| Cameras / spectator | Broadcast, first-person, third-person, and spectator states exist. | Partial | Test every camera through grapples, knockdowns, elimination handoff, clipping, labels, and touch orbit/zoom. |
| Mobile HUD / controls | Responsive HUD and touch actions exist; live portrait inspection showed cramped HUD and substantial control obstruction. | Partial | Verify portrait/landscape at representative phone/tablet dimensions, simultaneous touch, safe areas, readable names, and unobscured contact. |
| Performance | Runtime metrics and quality tiers exist. | Unverified | Record hardware, median/p95 frame time, simulation/render cost, draw calls, memory and soak behavior in representative matches. |
| Multiplayer integrity | Colyseus server/client and replicated match state exist. | Unverified | Validate committed move identity/phases, stale events, latency/correction, disconnect cleanup, and authority in multiplayer. |
| Developer lab / scenarios | Physics Lab, diagnostics, soak and browser test suites exist. | Partial | Add/reset deterministic scenarios for every listed interaction and expose root ownership, contacts, anchors, and phase in lab. |
| Acceptance evidence | Unit, integration, browser suites, and visual evidence tooling exist. | Partial | Produce before/after normal- and slow-motion recordings, measured tolerances, and sustained-match results. |
| Platform route / discovery contract | Site is the RINGFALL game; this upgrade pass changes no public routes, API, auth, discovery, or cross-site behavior. | Unchanged | Audit current health/discovery routes separately before any platform-surface changes. |

## Current pass

- Restored the prior stride, knee, and arm-swing amplitudes after the larger
  values read as exaggerated on the character rig.
- Keep the locomotion state active during the braking interval so the visual and
  physical gait do not snap to idle while the wrestler is still moving.
- Added regression checks for bounded walking pose amplitude, alternating
  legs, stop-state continuity, diagonal speed caps, and analog speed scaling.
- Reversed the latest character-presentation experiment after code review found
  it replaced the established travel posture and disabled physical stride
  offsets while walking. The proven posture, arm swing, and foot-stride path are
  restored; simulation travel and braking behavior remain unchanged.
- Added a browser regression for ordinary Singles that checks walk intent,
  nonzero Rapier speed, and less than 8 cm of drift 400 ms after release. The
  speed diagnostic lives on a hidden child element, so the test reads it from
  its actual source rather than the visible HUD container.
- Footstep placement now uses the solved movement vector while stance width
  stays aligned with combat facing. Added deterministic checks for mirrored
  backpedal offsets and left/right strafe offsets without rotating the target
  facing.
- Replaced the mobile target-switch pseudo-label with explicit desktop/mobile
  labels so only one target prompt is rendered at a time.
- Movement is not fully signed off: the live check covers keyboard walking and
  stopping, but does not yet verify run speed separation, foot-plant slip,
  turns, directional transitions, or mobile/controller locomotion.
