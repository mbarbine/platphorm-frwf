# Bodyworks capability matrix

Status vocabulary: **complete** is implemented and covered by a release gate; **partial** is useful but has a documented limitation; **device-required** cannot be honestly certified in headless CI.

| Capability | Baseline | This pass | Evidence gate |
| --- | --- | --- | --- |
| Stable physics-authoritative match loop | Complete | Harden authority exceptions | Unit + browser playability |
| Persistent articulated collision rigs | Complete | Preserve 32 bodies / 30 joints across rematches | Runtime diagnostics + soak |
| Walk/run readability and responsive control | Complete | Preserve with adaptive rendering | Browser input scenarios |
| Contact-true strikes and spatial guard | Complete | Preserve | Contact integration tests |
| Physical grapple acquisition, load, throw, landing | Complete | Add corner-directed grapple | Grapple + corner browser scenario |
| Rope elasticity and rebound stiff-arm | Complete | Preserve | Deterministic rope scenario |
| Apron exit/return | Complete | Preserve | Deterministic apron scenario |
| Corner climb and aerial attack | Complete | Preserve | Deterministic dive scenario |
| Breakable commentary table | Complete | Preserve | Deterministic collapse scenario |
| Chairs and signs | Complete | Preserve | Chaos/prop browser scenario |
| Trash can | Missing | Add dynamic, grippable, throwable can | Unit + browser scene inspection |
| Barricade response | Fixed collision only | Add damped movable panels inside safety walls | Browser contact/containment gate |
| Back/front/side recovery | Partial authored recovery | Add deterministic orientation state and lab scenarios | Unit + Physics Lab browser scenarios |
| Failed lift / grip-break visibility | Partial runtime metrics | Add dedicated lab scenarios and diagnostics | Physics Lab scenarios |
| Physics Lab time/debug tooling | Partial | Add pause, step, 0.25/0.5/1x, reset, repeat, seed, pairing, stamina and debug | Lab browser test |
| Event camera/replay/highlights | Complete | Preserve | Camera + replay tests |
| Adaptive quality | Adaptive DPR only | Add auto/performance/quality profiles | Unit + browser settings |
| Runtime physics percentiles | Max only | Add bounded rolling avg/p95 + replay byte estimate | Unit + lab diagnostics |
| Lazy Three/Rapier runtime | Complete route chunk | Add menu-intent preload and preload state | Build chunk report + browser assertion |
| Keyboard and touch | Complete | Preserve | Desktop + mobile browser tests |
| Gamepad | Implemented | Add deterministic browser emulation; physical device gate remains | Browser emulation + device matrix |
| WebXR | Implemented when supported | Add adapter coverage; physical headset gate remains | Unit + device matrix |
| 50-match AI soak | Missing | Add deterministic bounded batch and stats artifact | Vitest soak |
| Multi-rematch heap/body soak | Complete at 3 rematches | Expand bounded browser soak and percentile assertions | Playwright soak |
| Platform routes/discovery/trust | Complete baseline | Revalidate only if public behavior changes | Platform contract tests |
| Rollback control | Partial documentation | Document one-release rollback flag and removal rule | Release document review |

## Gold Master gates

1. Stability: no startup collapse, spontaneous launch, unbounded velocity, invalid body, or rematch body/joint growth.
2. Contact truth: damage only follows legal windows and physical contact; blocks require spatial interception.
3. Grapple truth: grips acquire within reach, remain bounded, can fail, and release into a physical landing.
4. Environment truth: ropes, apron, corners, props, table, and barricades respond through physics-backed systems.
5. Release truth: lint, typecheck, unit/integration, deterministic browser scenarios, 50-match simulation soak, bounded rematch soak, build, preview, and live smoke must all pass before promotion.

