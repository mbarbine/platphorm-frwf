# Ringfall Bodyworks baseline

> Historical baseline only. This document records the state before the revised BodyWorks contract. See `STATUS.md` and `CAPABILITY_PLAN.md` for the current candidate; none of the evidence below certifies current source.

Baseline commit: `34144fa` on `feat/bodyworks-gold-master`  
Captured: 2026-07-13  
Runtime: Node `v26.5.0`, pnpm `9.15.0`

## Product role

Ringfall is a browser-first arcade wrestling game. Its primary contract is a complete, readable match loop with responsive controls, contact-authentic offense, stable wrestlers, environmental wrestling spots, pin/knockout resolution, replay, and rematch. PlatPhorm discovery and trust surfaces support that game; they do not replace it.

## Shipped baseline

- Fixed 60 Hz Rapier scene with two persistent 16-body / 15-joint collision rigs.
- Rapier-authoritative locomotion, collisions, rope compression/rebound, apron transitions, grapples, throws, props, landings, and table failure.
- Authored visible walk, run, strike, grapple, fall, recovery, and victory motion driven from the authoritative match state.
- Keyboard, gamepad, touch, and WebXR input adapters feeding the same command model.
- Broadcast, ringside, wide, table, aerial, grapple, and replay cameras with stable camera-relative input.
- Bounded physics replay and deterministic browser scenarios for rope rebound, corner dives, apron return, table collapse, and rematches.

## Baseline evidence

The immediately preceding release pass at this commit recorded:

- ESLint: pass.
- TypeScript: pass.
- Vitest: 101/101 pass.
- Playwright: 12/12 pass.
- Production: `https://frwf.platphormnews.com`, Ready.
- Live physics registration: 32 fighter bodies, 30 fighter joints, zero emergency resets and zero containment events during the verified scenario.

Those commands were not re-run while capturing this document. This pass batches implementation first and executes a consolidated release gate afterward.

## Authority audit

Shipping fighter position is synchronized from the Rapier center of mass. Direct planar integration, rope clamps, and apron position changes in `combat.ts` are retained only for deterministic non-WebGL/unit simulations behind `!model.physicsAuthority`. Runtime `setTranslation` calls are limited to lab/reset placement, recovery from invalid/out-of-world states, ring hard-limit containment, and rope penetration correction. These are safety or tooling paths, not normal locomotion.

Two authority exceptions were identified for remediation in this pass:

- The grabbed-state legacy planar integration was not explicitly gated from the shipping physics path.
- Aerial target chase updated gameplay velocity in addition to the Rapier aerial controller.

## Remaining baseline gaps

- No explicit interaction-triggered preload state for the Three/Rapier scene.
- No user-selectable or device-derived graphics quality tier and no rolling physics average/p95.
- Physics Lab lacked playback rate, pause/step, repeat, seed, pairing, stamina, recovery-orientation, and debug controls.
- No movable trash can or elastic/deformable barricade section.
- No corner-grapple environmental finish.
- Automated multi-match soak covered rematches but not a deterministic 50-match AI simulation batch.
- Physical gamepad, iOS/Android, and XR hardware remain a release-device matrix rather than something headless CI can certify.
