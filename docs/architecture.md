# RINGFALL architecture

## Runtime boundary

RINGFALL is a static, local-first Vite application. It has no application server, database, login, telemetry client, runtime fetch, or mutating API. Zustand owns the in-memory match model. The deterministic combat model, Rapier world, rendered wrestler hierarchy, procedural audio, and HUD advance in the browser.

The initial React shell does not import the arena synchronously. `GameScene` is lazy, and the production build creates independent chunks for React, Three core, React Three Fiber, Drei, React Rapier, and Rapier WASM. Rapier's `JointData` factory is injected only after the lazy game scene loads, keeping the WASM dependency out of the menu shell.

## Simulation ownership

The deterministic combat system owns legal states, stamina, health, Momentum, move phases, AI decisions, match resolution, and rematch state. Rapier owns physical body positions, contacts, support, elastic rope response, grips, props, and landing evidence during a shipping match. Simulation advances at a fixed 60 Hz step before each Rapier update; contacts are consumed after the physics step.

Each wrestler has 16 rigid bodies and 15 anatomical joints. Locomotion computes mass-weighted planar center-of-mass velocity and applies the same bounded velocity correction to every segment. Planted states temporarily constrain collision-skeleton pitch/roll and apply an internal core posture drive. Grabs, throws, aerials, knockdowns, recovery, and climbing restore full-body rotations.

Visual wrestler meshes mirror the authoritative physical model through authored walk, run, strike, grapple, reaction, and recovery poses. The visual hierarchy supplies readable character performance; the hidden articulated rig supplies collision and impact truth.

## Contact and environmental authority

Strikes are eligible only during active frames and use a stance/velocity-aligned swept volume so a few milliseconds of distal joint lag cannot invalidate a visibly correct hit. Grapples require two physical hand grips and do not award damage at acquisition. A grapple scores only when the thrown defender's core produces a measured ring, floor, or commentary-table landing.

Throw and dive velocity changes are distributed by each segment's own mass. This keeps the articulated body coherent and prevents a pelvis-only impulse from stretching joints or catapulting the wrestler. The commentary desk applies bounded targeting only when the defender is already close enough for a deliberate environmental spot; collapse still requires a physical table landing.

## Arena and camera

`data/arena.ts` is the common geometry contract for the expanded Volt Dome floor, playable limits, barricades, desk, entrance lane, and steps. `Arena.tsx` separates physical surfaces from decorative broadcast architecture. Ropes, ring, floor, desk, steps, props, posts, and barricades participate in collision. Crowd, LEDs, truss, stage, and lighting do not add solver load.

`camera/cameraDirector.ts` chooses the semantic shot. `CameraRig.tsx` owns shot continuity, placement, target damping, FOV, and impact response. Camera-relative movement freezes its basis while input is held or a cinematic action is active, decoupling control meaning from shot changes.

## Cleanup lifecycle

Every rematch resets commands, contacts, pending landings, grips, prop joints, replay frames, metrics, and world registrations. React keys include `runtimeId`, forcing old physical rigs and broken-table fragments to unmount before the next match. The bounded browser soak asserts that bodies and joints return to their expected counts across three complete rematches and checks heap growth when Chromium exposes precise memory information.
