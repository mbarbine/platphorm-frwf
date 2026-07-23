# Bolt's Journal - Critical Learnings Only

## 2026-07-22 - [Aligning Workspace Cleanliness with Sanitized Main Branch]
**Learning:** In a workflow where the upstream `main` branch has been stripped of the primary codebase for compliance, merging or basing development directly on older commits can lead to git staging/PR reports attempting to restore thousands of deleted files.
**Action:** Always verify changes and run tests locally by checking out the fully-populated merge commits first, then reset/base your clean PR branch on the sanitized upstream HEAD, adding only the targeted optimized file to prevent code pollution.
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

## 2026-07-18 - [Stabilized Fighter Presentation Interpolation via Clamped Delta Time]
**Learning:** Using raw, unclamped frame delta times (`delta` / `dt`) in React Three Fiber `useFrame` render loops for exponential decay calculations (`Math.exp(-delta * rate)`) can cause extreme visual spikes, teleportation, skipping, and jitter on sudden frame drops, tab suspensions, or garbage collection pauses.
**Action:** Always pre-clamp frame delta times (`clampedDelta = Math.min(delta, 0.1)`) inside presentation-layer loops (such as the `useFrame` loop in `FighterModel.tsx`) before performing exponential decay or interpolation calculations, preserving perfect smoothness and interpolation stability under all framerate conditions.

## 2026-07-19 - [Avoid Object.entries/Object.keys inside hot frame loops]
**Learning:** Calling reflection functions like `Object.entries` or `Object.keys` inside high-frequency frame loops (e.g. `useFrame` in React Three Fiber) allocates temporary arrays of keys/entries on every single frame, causing significant garbage collection pressure and micro-stutters during intense scenes.
**Action:** For hot-path frame iterations with pre-known keys, unroll the loop into direct property accesses or utilize static key sets rather than dynamically re-allocating entry arrays.
## 2026-07-22 - [Avoid Inline Array Allocation in Physics Inner Loops]
**Learning:** Instantiating arrays inline (e.g., `['chest', 'abdomen', 'pelvis', 'head']`) inside deeply nested physics or collision processing loops generates unnecessary temporary allocations on every tick, increasing garbage collection (GC) pressure and degrading simulation performance over time.
**Action:** Extract inline arrays into static, module-level constant arrays (e.g., `const CORE_SEGMENTS = [...]`) to prevent repetitive GC allocations in hot-path simulation frames.

## 2025-02-28
**Title**: Optimize FighterSlot Lookups in Physics Simulation
**Failed/Successful Optimization**: Successful Optimization
**Learning**: Array `.find()` with anonymous arrow functions is exceptionally slow within critical loops (like high-frequency physics `useFrame` callbacks or fixed-step solvers). A benchmark showed `FIGHTER_SLOTS.find` running 80x slower than a chained ternary operator sequence directly checking properties on `model`.
**Action**: Replaced the `.find()` lookup with a deterministic fallback checking each slot property explicitly (`model.player === fighter ? 'player' : ...`).
## 2026-07-20 - [Optimized Action Processing using ID Maps]
**Learning:** Using `.find()` inside high-frequency input handler resolution logic (e.g. `combat.ts`) to lookup entities like props iterates over the array linearly and allocates a callback function for every evaluation, generating CPU load and Garbage Collection (GC) pressure.
**Action:** Replace `O(N)` linear searches and callback-based methods inside high-frequency frame or input routines with a direct key-value dictionary lookup (e.g., `model.propsById[id]`) which operates in `O(1)` time with zero dynamic allocations.
### 2024-07-17

**Title:** Mocking React Three Fiber Environments for UI Tests

**Learning:** When asserting pure UI behavior (such as button rendering and API interactions like `navigator.xr`) inside heavily 3D-dependent components like `GameScene`, standard testing tools like `@testing-library/react` will fail inside `jsdom` due to missing WebGL and physics engines.

**Action:** Extensively mock dependencies (`@react-three/fiber`, `@react-three/rapier`, `@react-three/drei`) alongside game-specific heavy dependencies (like `bodyWorksRuntime` and match state stores). Ensure the mocked canvas calls lifecycle initialization logic (e.g. `onCreated` in `<Canvas>`) if required to set up specific internal state, avoiding the need to execute the main game loop during tests.
## 2025-02-28 - Avoid Object.entries() in Physics Loops
* **Optimization:** Replaced 12 instances of `Object.entries(rig.bodies)` and `Object.entries(bodies)` with simple `for...in` loops in `physicsRuntime.ts`.
* **Issue:** `Object.entries()` creates an array of arrays on every call. In nested fixed-step physics ticks evaluating many bodies per frame, this allocates thousands of small tuples per second, driving up garbage collection (GC) churn and triggering micro-stutters.
* **Impact:** Reduced allocations per frame significantly, improving performance and frame consistency during intensive physics phases, particularly the continuous collision handler (CCD) and pose-matching drivers. Benchmarks indicate avoiding `Object.entries` inside the tight loop runs up to ~10x-20x faster.
## 2024-03-XX Prop Array Filtering Optimization
- **Goal:** Optimize O(N) `.find()` lookups on the `props` array inside high-frequency physics ticks and input handlers.
- **Learning:** Although iterating an array of 5 elements is fast, performing this operation every frame across multiple systems introduces unnecessary closure allocation and branch evaluation overhead. Using an explicit `.find()` generates closure trash and scales poorly as prop count increases.
- **Action:** Retained the immutable properties of `model.props` array while introducing a mirrored `propsById` O(1) dictionary in the `MatchModel`. Lookups via `model.propsById[id]` replaced explicit `.find()` calls, bypassing array traversal in hot paths and measurably dropping lookup time in synthetic benchmarks from ~90ms to ~2ms per 100K iterations.

### 2025-02-24: Optimize Math.hypot calls in physics loop
**Learning:** `Math.hypot` is computationally expensive and commonly impacts performance within tight, high-frequency physics loops such as applying velocity constraints or limits.
**Action:** Replaced `Math.hypot` inside `capRigVelocity` (`src/game/physics/physicsRuntime.ts`) with squared magnitude checks (e.g., `x*x + y*y + z*z > threshold*threshold`). This change avoided executing `Math.sqrt` unless absolutely necessary, significantly reducing loop execution time (from ~26s to ~4.6s per 150M iterations in micro-benchmarks).

## 2026-07-23 - [Optimized Math.hypot in Math Utilities and R3F Render Loops]
**Learning:** `Math.hypot` is significantly slower than standard `Math.sqrt` (by a factor of ~8x) because it dynamically scales inputs to handle overflow/underflow. In a game simulation where coordinates are bounded and normal, this overhead is completely unnecessary and places a severe CPU burden on high-frequency rendering and physics systems.
**Action:** Replace `Math.hypot` inside common vector utility math (`length` and `distance` helpers) with standard `Math.sqrt`, and replace logic check paths inside active render/input loops (`GameScene` and `FighterModel`) with zero-allocation squared-magnitude checks.
## 2025-02-28 - [Optimized Math.hypot with direct Math.sqrt and Squared Comparisons]
**Learning:** `Math.hypot` is highly robust but extremely slow in hot execution paths like high-frequency `useFrame` rendering ticks and basic vector length/distance math helpers because of its generic multi-argument checking and underflow/overflow safety.
**Action:** Replaced helper functions `length` and `distance` in `src/game/utils/math.ts` with direct squared-sum `Math.sqrt` implementations. Additionally replaced `Math.hypot` checks in high-frequency rendering logic (e.g., `FighterModel.tsx` locomotion checking, position correction error bounds, and input held state evaluations in `GameScene.tsx`) with zero-allocation squared comparisons or straightforward `Math.sqrt` operations. This yields major CPU execution speedups and minimizes GC pressure.

## 2026-07-24 - [Optimized Math.hypot in Joint Quaternion Solver Path]
**Learning:** In highly nested, high-frequency physical joint solving callbacks like `shortestQuaternionError` in `motorController.ts`, utilizing `Math.hypot` to compute the magnitude of the 3D rotation error is highly inefficient. Standard double-precision floating point squares (`x*x + y*y + z*z`) are perfectly safe from overflow/underflow for small bounded orientation errors, making standard `Math.sqrt` up to 8x faster and significantly reducing the simulation CPU overhead.
**Action:** Replace `Math.hypot` with standard `Math.sqrt` inside `shortestQuaternionError` to optimize active joint torque evaluations.

## 2025-02-28 - [Optimized Math.hypot with Math.sqrt and Squared-Magnitude Checks in Physics Runtime]
**Learning:** Calling `Math.hypot` within the high-frequency physics runtime simulation tick (such as in target segment distance lookups, locomotion velocity evaluations, and strike dynamics) introduces heavy performance overhead. This is because `Math.hypot` executes slow dynamic scaling logic to defensively prevent underflow/overflow. For coordinates inside a bounded 3D wrestling arena, standard `Math.sqrt` is entirely safe and runs up to 8x faster. Furthermore, comparing squared distances instead of calling `Math.sqrt` completely avoids square-root calculation overhead.
**Action:** Replace `Math.hypot` with standard `Math.sqrt` or zero-allocation squared-magnitude comparisons inside the core physics runtime solver loop (`physicsRuntime.ts`).

## 2025-02-28 - [Optimized Math.hypot in Hot Physics Checks and Close-Range Separations]
**Learning:** In highly nested, high-frequency physical checks like `inspectNumericalBody` and `solveCloseRangeSeparation`, using `Math.hypot` is exceptionally slow because it defensively handles underflow/overflow under the hood. In bounded simulation contexts, we can either replace `Math.hypot` with `Math.sqrt` for up to an 8x speedup, or completely eliminate square-root computations on the happy path by utilizing zero-allocation squared magnitude checks.
**Action:** Replace `Math.hypot` with standard `Math.sqrt` inside basic coordinate geometry helpers, and use squared-magnitude thresholds to skip square roots entirely on hot logic validation paths.
