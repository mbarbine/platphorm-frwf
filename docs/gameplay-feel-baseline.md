# FRWF gameplay-feel baseline

Date: 2026-07-13  
Branch: `feat/bodyworks-gold-master`  
Scope: production-preview keyboard play, recorded Playwright video/trace review, deterministic simulation inspection, and Rapier headless checks before the playability-first retune.

## Product role

RINGFALL: CHAOS CIRCUIT is a browser arcade-wrestling game. Its primary value is the immediate match loop—move, strike, visibly secure a wrestler, slam them, use the ring, finish, see results, and rematch. Platform/discovery surfaces remain subordinate to that game.

## Evidence captured

- Fresh TypeScript, lint, 56-test, production-build, Chaos-prop, and mobile-control gates had passed before this feel pass.
- A previous complete production-preview match reached a real pin/KO result and reset through instant rematch.
- Four additional recorded production-preview journeys were used to isolate the new grapple/replay gate. They exposed one long unresolved match, one Chaos weapon/grapple priority conflict, and two direction/counter timing failures rather than browser crashes.
- Rapier-without-WebGL integration now holds a 16-body, 15-joint wrestler through a ten-second 60 Hz standing soak and verifies walk, stop, jump, landing, and cleanup.
- The shipping match runs 32 articulated fighter bodies and 30 anatomical joints, with physical strike contacts, two-hand grapple constraints, real prop joints, and contact-scored landings.

## Baseline findings

### Input and keyboard grammar

- Keyboard events are acknowledged immediately and repeated keydown events are debounced.
- The command buffer was 130 ms, but commands were resolved newest-first. A quick `L`, then direction + `K` could execute the strike before the grapple. This was reproduced in the production browser gate.
- Rejected buffered commands stayed queued until expiry, but expiry was silent.
- Context priority allowed a corner climb before a valid pin when both were spatially available.
- `C` jump, `I` guard, `L` grapple, and the contextual `F` path are present and do not conflict at the DOM-input layer.

### Movement

- Shipping Rapier walk drive required roughly 240–310 ms to reach ordinary speed depending on fighter; Atlas sprint drive could require roughly 680 ms. That is visibly slower than the new 150–220 ms walk and 250–350 ms run target.
- Releasing movement while Shift remained held used the lower sprint acceleration as braking. Heavy fighters could slide for more than half a second.
- Fighter-specific top speeds existed, but the physical acceleration controller did not use the complete fighter locomotion profile.
- Gait phase followed speed, but when speed reached zero a foot could remain frozen in a lifted phase.
- No explicit planted-foot force opposed planar foot drift in the active-ragdoll rig.
- Opposing articulated bodies collide correctly, but close locomotion could read as bumper-car pushing before grapple range.

### Camera and directional reliability

- The neutral broadcast framing keeps both wrestlers visible and handles ringside separation.
- Camera-relative input was recalculated from the current cinematic camera every 60 Hz step. During the visible grapple camera move, a held `W` could change from the intended forward grapple branch into a side branch. The browser trace reproduced this.
- Major-move framing starts when the move is recognized and generally keeps grip/lift/impact visible, but input axes must not follow that shot.
- Ordinary camera damping is restrained; recurring shake was not observed. Replay orbit is intentionally separate and Reduced Motion suppresses replay.

### Strikes and blocking

- Jabs, combos, hooks, ground strikes, rebound stiff-arms, aerials, and prop attacks use explicit anticipation/active/recovery phases.
- Damage in the shipping match requires a measured Rapier contact during the active phase and is deduplicated per attack instance.
- Guard is a visible pose. Spatial forearm/hand contact distinguishes a block from a body hit and transfers reduced force, chip damage, and stamina loss.
- The prior move grammar lacked a standing front kick and running spear; this limited full-body striking variety.
- Misses correctly produce no contact damage, but player-facing miss/rejection feedback was too quiet.

### Grapple and body slam

- A grapple creates real hand-to-body rope joints only after the hands close to 0.58 m. The lock records reach, acquire, clinch, load, lift, release, and impact phases.
- Damage is not awarded when the grab begins. A grapple scores only when the airborne defender's torso/pelvis produces a measured mat, floor, or table landing.
- Browser telemetry confirmed repeated grip creation and complete physical landings with no leaked grip after release.
- The former neutral `L` path selected Arc Suplex. The new brief requires the basic deliberate action to be a body slam.
- Correctly timed directional follow-ups could be lost because of newest-first buffering and moving camera axes, not because the grip system was absent.
- Basic slam replay eligibility was too narrow, making a valid physical slam look under-presented unless it crossed the old intensity threshold.

### Climbing, aerials, taunts, and finishers

- `F` near a corner enters a force-driven corner anchor; `F` again launches a physically impulsed aerial. The body is not directly assigned to the turnbuckle transform in the shipping path.
- Climbing currently jumps to one top-anchor phase rather than visibly progressing lower rope → middle rope → top turnbuckle.
- Aerial aiming chases the opponent but lacks a clear pre-launch targeting indicator and safe climb-down path.
- Taunts are fighter-authored in data and grant Momentum/Hype with repetition decay, but only one gameplay taunt tier is currently exposed.
- Finishers use fighter-specific paired choreography and physical grips, but player participation is limited to setup and activation.

### Arena and interaction

- The Volt Dome has a raised ring, reactive ropes, posts/pads, apron, crowd, stage/tunnel, scoreboard, lighting, barricades, commentary desk, bell, chair, and crowd sign.
- Ropes apply bounded force and return energy; deliberate apron transitions are force-driven.
- Chair/sign pickup creates a real spherical hand joint; release inherits hand velocity and an explicit throw impulse.
- The commentary desk only accumulates stress from a measured landing on its collider and breaks into four bounded fragments. Proximity alone cannot break it.
- Steel steps, trash can, movable barricade deformation, corner grapples, and placing an opponent on the desk are still absent.

### AI, match pacing, and cleanup

- Utility AI approaches, blocks, strikes, grapples directionally, pins, uses finishers, recovers stamina, and physically leaves the ring to collect/use props in Chaos mode.
- A dedicated browser journey confirmed AI ringside traversal, prop pickup, a real prop grip joint, and a measured weapon impact.
- Normal AI can fairly counter a major grapple. Browser tests must retry rather than treat a legitimate counter as an engine failure.
- One recorded automation match ran to 210 seconds with both fighters low on stamina and no result; subsequent low-stamina disengagement and match-driver changes restored a completed result in an independent run.
- Rematch clears bodies, commands, contacts, grips, replay frames, props, and transient match state. A stale result timeout lacked explicit unmount cleanup and has been corrected.

## First implementation decisions

1. Freeze the movement basis while input is held or a cinematic action owns the camera.
2. Resolve the 160 ms command buffer FIFO and accept at most one action per fighter per fixed step.
3. Show concise rejection feedback when a buffered action expires.
4. Retune walking to approximately 170–220 ms acceleration, sprinting to approximately 260–350 ms, and ordinary braking to approximately 160–220 ms, with real fighter differences.
5. Stabilize planted feet with bounded planar muscle force and settle both feet when movement ends.
6. Add soft close-range separation before bodies overlap without defeating deliberate approach or grapple acquisition.
7. Make neutral `L` reliably begin the central body slam; preserve directional move selection after the lock.
8. Make substantial physical slams replay eligible while keeping routine strikes out of replay.

## Release blockers at baseline

- Complete the new movement/braking/camera-axis browser proof.
- Make the deliberate body slam pass reliably across repeated valid setups and different sizes.
- Add progressive climb/down/aim behavior and better taunt utility.
- Expand the production-preview journey to movement in all directions, clean stop, miss, taunt, climb, aerial, finisher, result, and rematch.
- Complete the manual five-Standard/five-Chaos playability matrix, including gamepad when available.
- Create and verify an immutable preview before production promotion.

## Upgrade implementation status

The follow-up Bodyworks pass implements the baseline's primary control and stability remediations. Locomotion now drives one mass-weighted center of mass instead of pushing the pelvis with the wrestler's full mass. Planted fighters use bounded core posture drive and temporary collision-skeleton rotation limits; full articulation returns for grabs, throws, aerials, knockdowns, recovery, and climbing. Touch activity no longer starts in a false-active state.

Corner dives and grapple releases distribute a shared velocity change across every articulated segment. Aerial collision uses a swept volume aligned to flight velocity. Grapple landings are accepted only at a measured ring, floor, or table surface; downward velocity alone is no longer mistaken for a landing. A nearby commentary desk supplies bounded environmental targeting so a committed desk spot lands on the desk without bypassing contact scoring.

The new camera director selects stable broadcast, wide, ringside, desk, aerial, grapple, and replay shots. Its look target is separately damped, its prediction is bounded, and shot changes use a hold window. The arena now has a larger playable floor, expanded physical barricades, physical steel steps, an entrance lane, reactive perimeter lighting, and a larger crowd/stage silhouette.

Deterministic Playwright scenarios and the bounded rematch/heap soak are implemented. Their final production-build gate and the production deployment are intentionally reported separately from implementation status; see `docs/testing.md` for the exact commands and acceptance criteria.
