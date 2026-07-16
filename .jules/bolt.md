## 2025-02-18 - [Optimized Crowd and Reactive Mat Layout Computations]
**Learning:** In a highly animated React Three Fiber application, performing repetitive trigonometric operations (Math.sin/cos), coordinate division/modulo arithmetic, and string allocation/concatenation for hundreds of instances per frame inside `useFrame` is a major CPU bottleneck.
**Action:** Always precompute static layout offsets, static rotations, and static scaling factors in a `useMemo` block that only updates when configuration parameters (e.g., `count`, `rows`, `columns`) change. This keeps the render loop extremely lightweight and maximizes the frame rate.

## 2025-02-19 - [Avoided GC Churn via Parameter Flatting in Frame Loops]
**Learning:** Instantiating temporary arrays or objects (such as `[rx, ry, rz]`) inside helper functions invoked hundreds of times per frame in a React Three Fiber `useFrame` render loop causes significant garbage collection overhead, leading to frame drops (micro-stutters) during intense gameplay.
**Action:** Pass coordinates individually as flat arguments (`rx, ry, rz`) instead of array wrappers inside hot path animation helpers. Precompute static offsets via `useMemo` wherever possible.
