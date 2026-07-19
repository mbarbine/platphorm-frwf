# Bodyworks architecture

## Authority model

Ringfall uses one shipping match model and one shipping physics world. Combat rules own legality, phase timing, stamina, damage, score, AI choices, results, and highlights. Rapier owns fighter center-of-mass motion, collision, body support, ropes, apron movement, physical grips, props, thrown-body motion, and environmental contact evidence.

Each wrestler registers 16 persistent rigid bodies and 15 anatomical joints. The bodies form a hidden collision skeleton with bounded coherent translation and stable rotations. The player-facing wrestler is a separate authored hierarchy that reads the authoritative match state. It does not drive a second physics solver or write transforms back into Rapier. This hybrid is intentional: collision/contact truth stays physical while walk, run, grapple, fall, orientation-specific recovery, and character identity stay readable.

Normal shipping movement never writes a fighter transform directly. The deterministic non-WebGL simulator retains direct planar integration behind `!model.physicsAuthority` so unit and 50-match tests can run without WebGL. Runtime translations are restricted to lab placement, out-of-world recovery, hard arena containment, and rope penetration correction.

## Fixed-step order

1. Read keyboard, touch, gamepad, or XR input into the shared command frame.
2. Freeze or update the camera-relative input basis.
3. Advance rules and AI at the fixed step.
4. Apply bounded controller, posture, foot, rope, grapple, prop, and environmental forces.
5. Step Rapier.
6. Classify contacts and committed landings.
7. Resolve legal damage/table stress and synchronize fighter center-of-mass state.
8. Capture a bounded replay frame and publish low-frequency UI state.

The production step is 1/60 second. Physics Lab can render the same fixed-step systems at 0.25× or 0.5× by reducing simulated time per rendered step; no variable gameplay timestep is introduced.

## Gameplay systems

- Strikes: active-window contact eligibility, swept physical volume, per-attack deduplication, spatial forearm/hand blocking, localized reaction.
- Grapples: reach, two spring grips, clinch, load, lift, release, and measured landing. A load or anchor error can break the grip.
- Ropes: compression, hard elastic tier, coherent-body rebound, and inward-only stiff-arm window.
- Corners: force-driven lower/middle/top climb, three aerial choices, climb-down, taunt, and a context-selected turnbuckle rail shot from a secured nearby clinch.
- Props: real dynamic bodies and hand joints for chairs, signs, and trash cans; released velocity and angular motion remain physical.
- Barricades: damped dynamic impact panels sit inside fixed outer safety walls, providing visible give without opening the map boundary.
- Table: staged stress and fragments only after a committed physical landing.
- Recovery: deterministic back/front/left/right orientation drives an authored grounded-to-kneeling-to-standing sequence while support force restores the physical collision rig.

## Runtime loading and cleanup

The menu shell and fighter preview load independently from the Three/Rapier scene. The scene import starts only after the player enters the menu or focuses/points at Play. The runtime still builds separate React, Three, Fiber, Drei, React Rapier, and Rapier WASM chunks.

Every rematch clears command/contact buffers, pending landings, spring grips, prop joints, replay frames, timing samples, registrations, instrumentation, and diagnostics. `runtimeId` remounts physical scene objects. The release soak asserts that fighter bodies and joints return to their expected bounded counts.

