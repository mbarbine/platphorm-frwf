# Super-fun playability audit

The capability matrix is reviewed through six player-facing questions. A system is not complete because its code path exists; it is complete when it creates a readable choice and a satisfying consequence.

1. **Can I move exactly where I intend?** Check acceleration, braking, camera-relative direction, touch deadzone, gamepad deadzone, close-range approach, walls, ropes, apron, and recovery control.
2. **Can I read the next move before I press it?** Check live labels, anticipation silhouettes, guard contact, grapple grip count, rope glow, corner state, prop state, and finisher eligibility.
3. **Does contact feel earned?** Check whiffs, spatial blocks, active windows, recoil, hit-stop hierarchy, sound position, mat response, and no damage without contact.
4. **Can I create a wrestling story?** Check directional lock-ups, failed lift, grip escape, rope stiff-arm, ringside chase, trash/chair/sign spots, deformable barricade, turnbuckle rail shot, aerial, table collapse, pin/KO, replay, and highlights.
5. **Do opponents create pressure without cheating?** Check shared rules, recovery, spacing, props, ropes, corners, stamina decisions, repetition, and match completion across every pairing.
6. **Can I immediately play again?** Check results clarity, rematch speed, stable bodies/joints/heap, preserved setup, and no stale input or replay state.

## Execution cadence

- Use Physics Lab to isolate one behavior, slow it down, repeat the same seed/pair, and inspect contacts/loads.
- Use deterministic unit/integration tests to lock legality and bounds.
- Use production-preview browser scenarios to prove the visible behavior with real input and Rapier.
- Run the 50-match bot soak for pacing/state growth and the six-rematch browser soak for runtime cleanup.
- Finish with short human Standard and Chaos matches on desktop and touch. Physical gamepad and XR join the device-required release matrix.

When a capability fails, classify it as control, readability, contact truth, environmental truth, opponent behavior, presentation, performance, or lifecycle. Fix the smallest owning system, repeat its isolated scenario, and run the complete release gate only after the batch is finished.

