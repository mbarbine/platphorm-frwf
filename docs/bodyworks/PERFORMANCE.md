# Bodyworks performance plan

## Runtime strategy

- Interaction-triggered preload overlaps Three/Rapier download with fighter and rules selection while preserving a light first menu.
- Vendor chunks keep React, Three core, Fiber, Drei, React Rapier, and Rapier WASM independently cacheable.
- Auto quality chooses a performance profile on constrained/mobile devices and a balanced profile elsewhere. Players can override Performance or Quality in Settings. Physics Lab removes the decorative crowd so profiling measures the wrestlers and arena interactions.
- Profiles vary DPR, antialiasing, baked shadows, and bounded instanced-crowd size. Simulation quality and rules never change.
- Physics timing uses a 240-sample ring buffer; average and p95 are recomputed without retaining an unbounded history.
- Physical replay uses a 300-frame ring buffer and publishes an estimated byte count in Physics Lab.
- Props, particles, rules replay, AI match duration, and rematch count are all explicitly bounded.

## Release measurements

The final consolidated gate records:

- Vite chunk names and compressed sizes;
- Physics Lab FPS plus rolling average, p95, and max step time;
- exact bodies/joints, reset/containment counts, replay size;
- six-rematch Chromium heap samples after requested garbage collection;
- relative renderer-rate retention across the rematch batch, because absolute headless WebGL FPS is machine-dependent;
- 50 deterministic simulated match results, timeout count, average step wall time, maximum replay frames, and maximum prop count.

Headless and local browser numbers are evidence for regression control, not a claim that every physical phone or headset has identical performance. The hardware matrix remains a device-required release task.

## Final local measurement

- Six-rematch browser soak: 12 FPS baseline, 23 FPS final, 0.338 ms physics average, 0.500 ms p95, 208.3 KB physical replay, and a flat 29.4 MB requested-GC heap across seven samples.
- Fifty-match rules soak: 50 complete, zero timeout, 0.0027 ms average step, 4.82 ms p95 whole-match wall time, 75 maximum replay frames, and 4 maximum props.
- Runtime chunking: 62.99 KB GameScene, 23.07 KB React Rapier, 148.77 KB Fiber, 724.62 KB Three core, and 2,236.67 KB isolated Rapier WASM before gzip.
