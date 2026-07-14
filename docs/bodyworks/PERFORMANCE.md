# Bodyworks performance plan

## Runtime strategy

- Interaction-triggered preload overlaps Three/Rapier download with fighter and rules selection while preserving a light first menu.
- Vendor chunks keep React, Three core, Fiber, Drei, React Rapier, and Rapier WASM independently cacheable.
- Auto quality chooses a performance profile on constrained/mobile devices and a balanced profile elsewhere. Players can override Performance or Quality in Settings.
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
- 50 deterministic simulated match results, timeout count, average step wall time, maximum replay frames, and maximum prop count.

Headless and local browser numbers are evidence for regression control, not a claim that every physical phone or headset has identical performance. The hardware matrix remains a device-required release task.

