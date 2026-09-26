> Forward planning now lives in the [one-year roadmap, September 2026–September 2027](roadmap/README.md). This document is retained as historical context; its ordering and status claims may be superseded.

# Next execution phase: deliberate wrestling controls and a trustworthy physics lab

FRWF is a wrestling simulator with showground exploration and original wrestlers. This phase improves the actual bout, not just the number of available moves. The September 12 screenshots remain evidence of failed visual quality: bent boots during standing movement, weak strike silhouettes, intersecting bodies, inaccurate proportions and clothing, and crowded HUD composition. Shipping the interim build does not close these issues.

## Control reference and adaptation

The user-selected [No Mercy guide](https://gamefaqs.gamespot.com/n64/914112-wwf-no-mercy/faqs/18978) describes tap/hold weak and strong strikes and grapples, directional follow-ups, contextual rope traversal, running, weapon interaction, targeting, taunting and defensive actions. Borrow that coherent interaction grammar; do not copy proprietary code, animation assets or the guide text. FRWF keeps its own moves and original wrestlers.

Implement a selectable Classic Wrestling preset alongside the existing accessible controls. Save the preference. Use named gameplay intents shared by keyboard, gamepad, touch, AI, lab playback and the online protocol. Do not build a second combat engine inside the preset.

| Intent | Proposed keyboard | Proposed standard gamepad | Context |
| --- | --- | --- | --- |
| Strike | J tap / hold | X tap / hold | Light / strong standing strike; ground hand strike over a downed target; weapon swing while carrying |
| Grapple | L tap / hold | A tap / hold | Quick / committed grip acquisition, then direction plus action selects follow-up |
| Kick | K | Y | Low, body, high, or ground stomp from opponent state and reachable contact region |
| Run / whip | Shift | B | Sprint in locomotion; whip from a secured front grapple |
| Traverse / interact | F | LB | Enter/exit at apron, climb at corner, pin when eligible; show one resolved action |
| Guard / reversal | I / Space | RT / RB | Guard held; timing-based reversal on press with facing, range and incoming threat |
| Weapon pickup | J nearby, E explicit | X nearby, D-pad down explicit | Preserve the user's requested contextual jab pickup; engaged foe takes priority |
| Change target / taunt | Tab / Q | Right stick click / D-pad up | Target only active opponents; taunts remain interruptible |

These bindings are proposed, not shipped. On touch, primary strike/grapple buttons support press/release with a visible commitment cue, and provide separate accessible strong-action options. Cancel held inputs on focus loss, pause, pointer cancellation and device disconnect. A held button must never repeat strikes indefinitely or generate both weak and strong actions.

## Work order and acceptance

1. **One context decision.** Extend the existing strike/context resolvers to return intent, target, move, legality, reason and label. Snapshot the selected target on acceptance. Re-evaluate legality at execution without silently attacking a different wrestler. Add hysteresis around proximity thresholds so labels do not flicker between pickup and punch. Keep collisions, not proximity alone, authoritative for hits.
2. **Tap/hold state machine.** Measure hold time against the simulation clock. Start with a tunable 220 ms strong-action threshold; it is a design candidate, not a proven feel setting. A tap produces exactly one weak action. Committed holds visibly wind up, consume resources once, and release/cancel predictably. Test keyboard, gamepad and pointer event sequences, including missed releases and frame stalls.
3. **Grounded locomotion before extra moves.** Capture one walking and one running cycle from front, side and rear for Chad, Dale, Thomas, Wrecking Ball and G.I. Jil. Compare the Rapier pelvis/thigh/shin/foot orientation with the rendered skeleton and boot sole. Separate incorrect segment targets, rig rest-axis errors and mesh weighting errors. No boot may fold beneath an idle support leg; the stance foot stays planted while the swing foot clears the mat. Backward and strafe motion need separate trajectories. Validate starting, turning, stopping and recovery, not only steady motion.
4. **Heavyweight strike contract.** Author readable anticipation, full-body drive, physical contact and controlled recovery for jab, cross, uppercut, front kick, low kick and stomp. Show shoulder/hip rotation and a planted support foot. Hand closures, guard hand and wrist alignment must remain anatomical. Record attempted, blocked, missed and landed outcomes separately. A hit notification without the correct hand/boot contacting the target fails acceptance. Do not increase damage or camera shake to hide a weak animation.
5. **Paired wrestling and traversal.** Acquire actual grips before lifting; align the victim to grip anchors without teleporting; show mass transfer and mat contact during slams. Test throws into ropes, ringside and tables, interrupted grips, grounded recovery, prop pickup/carry/swing/drop/throw, corner climb and apron exit/re-entry. Battle Royale must distinguish deliberate exit from accidental tunneling and elimination. Do not automatically return a deliberately ringside player merely because they fall down there.
6. **Likeness and clothing.** Keep reference photos beside neutral and moving renders. Replace inflated mesh scaling and painted clothing boundaries with calibrated body shapes, garment meshes and correct skinning. Wrecking Ball needs weight in torso, neck, arms and thighs; Thomas needs tall muscular proportions and long blond hair/beard. Establish an offline export review before replacing live models. Supplied props are not replacement human rigs.
7. **Bout rhythm and readability.** Tune AI spacing, anticipation and recovery to create defensible exchanges. Avoid every wrestler stacking at the player's pelvis. Reduce permanent instructional HUD area while preserving clear target, health, stamina and action feedback. Run a complete default Battle Royale and ordinary Singles bout; record which moments feel responsive or ambiguous.
8. **One proven online authority.** Browser Colyseus, shared simplified Node core and Cloudflare Durable Objects currently differ. Decide the authority through a parity prototype, not a URL substitution. Prove two-client create/share/join, hit agreement, grips, latency, disconnect/reconnect and rematch before advertising production multiplayer. Never expose the platform operator key in the browser.

## Physics lab overhaul

The lab must run the same character renderer, controls, context resolver, simulation clock and contact bridge as normal play. Scenario setup may position/reset the actors; the actual action must be a recorded ordinary input sequence. Retain a separate manual mode so tests can fail visibly.

Provide scenario groups: grounded gait; standing strikes; grounded attacks/recovery; grips/lifts/slams; rope/corner/apron traversal; weapons/tables; multi-opponent spacing; device and frame-rate stress. Each fixture names wrestler pair, venue, starting posture, distance, timing, seed and expected physical outcome. Start with the exact screenshot failures, not arbitrary demonstrations.

A compact timeline should align input pressed/released, command accepted/rejected, attack instance, phase, rendered pose submission, contact source/target, damage and recovery. Add pause, single fixed step, real-time/slow replay, camera bookmarks and synchronized side/front views. Display pose target versus solved skeleton and sole contacts only when diagnostics are enabled. Make errors explicit; successful input acceptance is not a successful move.

Export a versioned evidence bundle with source SHA, asset manifests, scenario settings, input stream, physical measurements and video. Replaying a capture must not mutate a real match or count as a player victory. Imported mocap needs skeleton mapping, scale/rest-pose checks, preview and retarget validation before use; uploading footage does not mean motion capture exists.

## Gates

- Unit rules and protocol tests pass, with no weakened contact requirements.
- Real-time visual captures show planted support, anatomical joints, readable contact and controlled recovery for representative body types.
- Ordinary desktop and touch bouts work outside the lab. No hidden state forcing may satisfy those gameplay gates.
- Measure frame time, dropped simulation time, memory and load failures on actual desktop/phone/tablet browsers. Emulated mobile and software WebGL do not certify physical devices. XR remains a separate hardware gate.
- Deployments expose their actual source SHA; HTTPS, assets, discovery and protected-action rejection are checked on both owning providers. Backend health must continue to disclose unsupported gameplay parity and absent trace export.

The first implementation slice after the interim release is the shared intent/tap-hold layer plus a gait/strike comparison lab. Finish one convincing approach → jab → counter → grapple → slam → get-up exchange before expanding move inventory.
