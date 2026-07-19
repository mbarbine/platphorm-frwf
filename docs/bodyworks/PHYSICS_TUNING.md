# Bodyworks physics tuning

## Release budgets

| Signal | Target | Failure meaning |
| --- | --- | --- |
| Fixed simulation rate | 60 Hz | Rules and physics can diverge |
| Rolling physics/controller average | under 4 ms | Main-thread control budget is too high |
| Rolling p95 | under 7 ms on release browser | Spikes can cause missed input or visible judder |
| Emergency resets | zero in release scenarios | Non-finite body state |
| Containment corrections | zero in ordinary release scenarios | A rig reached the hard arena safety path |
| Fighter bodies/joints | 32 / 30 after each rematch | Registration leak or incomplete cleanup |
| Replay | 300 physical frames maximum | Unbounded memory growth |
| Rules replay | 75 frames maximum | Unbounded result/highlight state |

## Stability rules

- Whole-rig velocity changes are distributed by segment mass. Do not apply a heavyweight's total impulse to one pelvis or hand.
- Cross-wrestler grips are bounded springs, not a closed loop of hard joints.
- All registered body linear and angular speeds are capped before controller forces are applied.
- Rotations in the hidden collision skeleton remain stable. Visible fall and recovery rotation belongs to the authored hierarchy.
- Foot support and posture forces are bounded by state, fatigue, and contact. Downed/defeated wrestlers do not receive standing support.
- Emergency body placement is a diagnostic failure path, never locomotion.

## Feel tuning

- Walk reaches useful speed quickly and brakes deliberately; sprint requires more commitment and consumes stamina.
- Close-range approach braking prevents touch/gamepad overshoot without stopping lock-up acquisition.
- Ropes compress before returning energy. The inward stiff-arm window lasts long enough for a human reaction but cannot be opened by running away from the ring.
- Grapple acquisition tolerates normal articulated hand travel, then tightens its error/load bounds after a grace interval.
- Lift feasibility uses mass, power, muscle/fatigue, and defender mass. Physics Lab's fatigued-lift and grip-stress cases expose failure behavior.
- Environmental guidance is local and bounded. It only selects an already-near table or turnbuckle and never teleports either wrestler.
- Physics Lab mass override adds the selected kilograms across the registered Rapier segments and updates gameplay leverage mass; it is not a cosmetic stat edit.

The lab's explicit cases cover standing, walk/run/brake, turning, jump/landing, hit/whiff/guard, grapple acquisition/failure/throws, rope/apron/corner/table interactions, all recovery orientations, knockout, and a complete runtime reset. Debug mode combines Rapier colliders with centers of mass, projected support footprints, attack reach, grip linkage, impact markers, and the textual force/timing/object diagnostics.

Tuning values live beside their owning system: general match balance in `src/game/data/balance.ts`, arena dimensions in `src/game/data/arena.ts`, controller/rope/grip limits in `src/game/physics/physicsRuntime.ts`, and move phase/damage data in `src/game/data/moves.ts`.
