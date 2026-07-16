## 2025-02-18 - [Optimized Crowd and Reactive Mat Layout Computations]
**Learning:** In a highly animated React Three Fiber application, performing repetitive trigonometric operations (Math.sin/cos), coordinate division/modulo arithmetic, and string allocation/concatenation for hundreds of instances per frame inside `useFrame` is a major CPU bottleneck.
**Action:** Always precompute static layout offsets, static rotations, and static scaling factors in a `useMemo` block that only updates when configuration parameters (e.g., `count`, `rows`, `columns`) change. This keeps the render loop extremely lightweight and maximizes the frame rate.

## 2026-07-16 - [Memoized Fighter Definitions and Static Segment Schema Generations]
**Learning:** In a performance-critical game and physics engine running continuous physics updates, repeatedly allocating 16-element arrays of segment schema objects and performing O(n) array lookups for static reference structures (like `fighterById` or `buildBodySchema`) puts heavy strain on the CPU and Garbage Collector.
**Action:** Cache the resulting arrays and objects by wrestler ID in static Map and Record structures. This ensures that lookups and schema retrievals become O(1) with zero dynamic allocation on subsequent accesses.
