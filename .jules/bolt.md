## 2025-02-18 - [Optimized Crowd and Reactive Mat Layout Computations]
**Learning:** In a highly animated React Three Fiber application, performing repetitive trigonometric operations (Math.sin/cos), coordinate division/modulo arithmetic, and string allocation/concatenation for hundreds of instances per frame inside `useFrame` is a major CPU bottleneck.
**Action:** Always precompute static layout offsets, static rotations, and static scaling factors in a `useMemo` block that only updates when configuration parameters (e.g., `count`, `rows`, `columns`) change. This keeps the render loop extremely lightweight and maximizes the frame rate.

## 2025-02-19 - [Avoided GC Churn via Parameter Flatting in Frame Loops]
**Learning:** Instantiating temporary arrays or objects (such as `[rx, ry, rz]`) inside helper functions invoked hundreds of times per frame in a React Three Fiber `useFrame` render loop causes significant garbage collection overhead, leading to frame drops (micro-stutters) during intense gameplay.
**Action:** Pass coordinates individually as flat arguments (`rx, ry, rz`) instead of array wrappers inside hot path animation helpers. Precompute static offsets via `useMemo` wherever possible.

## 2026-07-16 - [Memoized Fighter Definitions and Static Segment Schema Generations]
**Learning:** In a performance-critical game and physics engine running continuous physics updates, repeatedly allocating 16-element arrays of segment schema objects and performing O(n) array lookups for static reference structures (like `fighterById` or `buildBodySchema`) puts heavy strain on the CPU and Garbage Collector.
**Action:** Cache the resulting arrays and objects by wrestler ID in static Map and Record structures. This ensures that lookups and schema retrievals become O(1) with zero dynamic allocation on subsequent accesses.

## 2026-07-17 - [Optimized CameraRig Allocation in High-Frequency Frames]
**Learning:** Instantiating objects (such as `safeSlotState` returned objects and camera context objects) and allocating temporary arrays (such as `activeSlots` and `framingSlots` via filter/map) inside high-frequency `useFrame` loops causes severe Garbage Collection (GC) pressure and micro-stutter.
**Action:** Pre-allocate cache objects/arrays in `useRef` and perform in-place mutation/lookup during hot paths. Consolidate math operations like min/max boundaries into single-pass loops without temporary wrapper arrays.
## 2026-07-17 - [Optimized Visual Trail Width Scaling and Stabilized Multi-Agent Targeting]
**Learning:** In Battle Royale mode, constant target flicking caused characters to rotate and execute physics commands erratically, creating huge frame drops and coordinate jitter. Applying target persistence and preventing retargeting mid-move stabilized the physics solver. Furthermore, scaling visual motion trails dynamically by referencing existing move properties avoids hot-path array allocations in Three.js and preserves zero GC churn.
**Action:** Prevent AIs from target switching during mid-move active states, implement stable target buffers (1.35m) for active brawls, and scale motion trail widths directly within the layout solver instead of instantiating new geometries.
