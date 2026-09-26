# Upgrade 1 — the heavyweight wrestling exchange

Scope: R01–09, R13–15, R18–20. The first playable target is approach → jab → cross → kick → defend/counter → clinch → body slam → land → get up → pin/kickout → rematch. The lab must explain a failed step; it must not manufacture success.

## Control grammar

Adapt the mechanics in the user-supplied No Mercy guide, not its named performers or proprietary animations. Preserve an accessible preset and introduce a saved Classic Wrestling preset using the same intents. The following is the proposed FRWF mapping; it has not been implemented by this roadmap.

| Intent | Keyboard | Standard gamepad | Context |
| --- | --- | --- | --- |
| Move / sprint | WASD / Shift | Left stick / B | Camera-relative locomotion; grapple sprint becomes Irish whip |
| Strike weak / strong | J tap / hold | X tap / hold | Standing hand strike, downed hand strike, held-weapon swing, nearby pickup |
| Kick | K, direction or commitment | Y | Reachable low/body/high kick; downed opponent becomes stomp |
| Grapple weak / strong | L tap / hold | A tap / hold | Front/back acquisition; direction + strike/grapple selects follow-up |
| Traverse / context | F | LB | Corner climb, apron passage, eligible pin; one visible resolved action |
| Guard / timed reversal | I hold / Space press | RT / RB | Threat-aware strike or grapple defense; grounded recovery when downed |
| Explicit prop action | E | D-pad down | Accessible pickup/drop alternative; held-prop throw through resolved directional action |
| Target / taunt | Tab / Q | Right stick click / D-pad up | Active opponents only; interruptible signature taunt |
| Jump / aerial | C | Context action with clear prompt | Supported jump; corner aerial only after successful climb |

Finalize controller conflicts in the first prototype, including a dedicated jump binding/remapping so no gamepad action depends on an ambiguous hidden chord. Touch uses the same actions, visible strong-action alternatives and minimum practical target sizes. Pause, menu navigation, target cycling and held-input cancellation must work across devices. Platform button labels follow the actual connected controller.

One resolver returns target, action, legality, rejection reason and label. Snapshot target at acceptance; never silently retarget during a swing. Downed/recovering, secured grapple, held weapon and traversal ownership must be considered before neutral attacks. In neutral, an engaged standing foe takes precedence over incidental nearby props; reachable prop pickup remains J when unengaged, with E as explicit fallback. Test thresholds and hysteresis; proximity selects an attempt, physical contact determines damage.

Prototype a 220 ms strong-action commitment and bounded 120–250 ms combo input buffer. These are tuning candidates. A tap emits once, a hold commits once, and focus loss/device disconnect cancels safely. Display anticipation immediately without issuing both weak and strong attacks. Balance input responsiveness against waiting for release; compare tap-on-release and cancellable anticipation with real players before locking timing.

## Combos and defense

Replace reliance on streak bonuses as the definition of a combo with explicit sequence/state data: starter, branch, legal follow-up window, contact/whiff/block policy, stamina, target, interruption, terminal recovery and escape opportunity. Examples for prototype: jab → cross; jab → cross → body kick; low kick → straight punch; guarded jab → uppercut attempt. A kick press in the wrong range must not teleport a foot into contact.

Each hit has its own attack instance and anatomical source. Queue at most one follow-up; no infinite stun loops or repeated damage from a lingering collider. Heavy finishers commit longer and leave a punishable miss. Whiff, block, hit and interruption are separate outcomes. Retain existing combo scoring only where consistent with the certified sequence; remove misleading celebratory announcements when the action never visibly happened.

Reversal attempts require range, facing, actual incoming phase and stamina. Prototype move-specific windows shorter than one second, with a testable early/valid/late boundary. A rushing opponent creates a counter opportunity, not an automatic reversal from any J press. Distinguish strike defense, grapple escape and dodge; failed attempts have recovery, and repeated presses cannot cover an entire attack. Accessibility timing options must be explicit and shared by the match rules.

## Motion and physical ownership

- Walk/run: planted stance foot, clearing swing foot, bent knees within limits, pelvis weight transfer, opposing arms, readable acceleration/deceleration. Separate forward/back/strafe trajectories; avoid idle foot drift and unsolicited turns.
- Punch: closed fist, guard hand, shoulder/hip rotation, planted support, clear anticipation and extension, wrist alignment and return to guard. Uppercut travels upward from a lowered arm with body drive; a renamed jab fails.
- Kick/stomp: weight onto support leg, chamber, correct contact surface, recoil and rebalance. Stomp lifts and plants downward on a reachable grounded target; high kick requires realistic body/range support.
- Recovery: supine, prone and side variants progress through roll/support, hand/knee placement, foot plant and rise. No inverted neck, compressed torso, floating knees or instant standing teleport. Recovery has visible interruptible/protected phases defined by rules rather than arbitrary invulnerability.
- Grapple/slam: acquired hand anchors and paired ownership precede lift. Victim follows credible leverage; release precedes physical landing. Weight class affects commitment and available lifts, not stretched limbs. Pins require actual covering contact; counters and rope breaks release ownership cleanly.
- Traversal: approach alignment, actual corner/post support, climb, balance, dive and landing. Track deliberate ring exit separately from accidental escape/elimination, including falling down at ringside in Battle Royale. Never auto-return merely because a deliberately exited fighter becomes downed.
- Props: pickup reach, correct grip sockets, carried pose, swing arc, release velocity, contact, durability/break and cleanup. Tables must support a landing before breaking; decorative objects must not all become weapons.

## Six-week execution backlog

Dates assume the monthly gate allows progress; week six crosses into month two.

| Ticket | Work / principal paths | Depends on | Exit evidence |
| --- | --- | --- | --- |
| U1-01 | Record screenshot failures in shared lab; physicsRuntime, physicalSkinBinding, HumanoidFighter | none | Source/asset version, target/solved/rendered skeleton and sole comparison |
| U1-02 | Canonical pilot anatomy and body/garment export; validate heavy and agile body scales | U1-01 | Chad, Wrecking Ball and G.I. Jil neutral + gait comparisons without stretched joints |
| U1-03 | Unified intent/target/legality result; matchStore, strikeResolver, controlDeck and input adapters | none | Same resolution for keyboard/gamepad/touch/AI; threshold and cancellation tests |
| U1-04 | Walking, running, stop/turn and grounded recovery ownership | U1-01 | Ordinary-input gait and four recovery orientations, no emergency reset |
| U1-05 | Tap/hold plus sequence graph; combat, moveSelection, moves | U1-03 | Exactly-once actions; mixed chain hit/block/whiff/interruption evidence |
| U1-06 | Jab/cross/uppercut/kick/stomp targets and timed defense | U1-02/04/05 | Correct source contact plus readable full-speed clips |
| U1-07 | Pair alignment, slam/landing/pin, climb and deliberate ringside state | U1-04/06 | Complete exchange and traversal; no leaked grips or surprise return |
| U1-08 | Chair/table/trash lifecycle; HUD/camera/AI spacing and release replay | U1-06/07 | Ordinary Singles/Battle Royale + rematch, device evidence, regression report |

Weeks 1–2: U1-01/03 then anatomy/gait investigation. Weeks 3–4: U1-02/04/05 with paired visual reviews. Weeks 5–6: U1-06/07/08. Do not call the upgrade complete while a basic get-up or first punch remains visually broken. The full year remains in scope after this slice; this is its first acceptance boundary.
