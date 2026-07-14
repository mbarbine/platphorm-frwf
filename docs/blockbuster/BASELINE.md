# Ringfall Blockbuster baseline

Captured: 2026-07-13 EDT  
Branch: `feat/bodyworks-gold-master`  
Source HEAD: `5e92dad2ecab632084f0acca611d988d210cc4ab`  
Canonical production: `https://frwf.platphormnews.com`  
Production deployment: `dpl_HrVffReG45hfrGuYgsMNhovp27L2` (`platphorm-frwf-96mnzf2hs-platphormnews.vercel.app`, Ready)  
Rollback deployment: `dpl_3xBENaQxmnLLKQ5eLBCiNke84WbE`

## Baseline verdict

BodyWorks is a functional and mostly deterministic physics foundation, but the shipping presentation is not a blockbuster wrestling game. The close-range wrestler is still the primitive fallback hierarchy, strike silhouettes are frequently obscured by overlap, the grapple camera crops into interpenetrating models, and the body slam does not present a readable load/lift/peak/drive/impact sequence. The new release is blocked until the presentation, continuous-resource, release-identity, visual-certification, and human-playtest gates in the Blockbuster contract pass.

No product implementation was started before this document. Baseline capture used the existing build plus a temporary, uncommitted Playwright evidence harness.

## Source and release truth

| Check | Evidence | Baseline status |
| --- | --- | --- |
| Working tree | Clean at audit start | pass |
| Branch | `feat/bodyworks-gold-master` | pass |
| Branch vs current `origin/main` | 5 branch-only commits and 8 main-only commits; `origin/main` is `0f8a49e` | divergent; preserve and reconcile deliberately |
| Current GitHub release | `0.0.6` points to merge commit `0f8a49e` | does not identify branch HEAD |
| Production deployment | Vercel confirms `dpl_HrVffReG45hfrGuYgsMNhovp27L2` serves the canonical alias | Ready |
| Production Git SHA | Not exposed in health, UI, or generated diagnostics | fail |
| Build timestamp/environment | Not exposed | fail |
| Fighter/move/arena/asset manifest versions | Not defined | fail |
| Service worker | No service-worker source or registration found | not applicable; no stale-worker path |
| Runtime network assets | No remote wrestler, arena, texture, model, animation, or audio asset dependency exists | pass, but presentation asset set is absent |

The UI says `RINGFALL v1.0`, `package.json` says `1.0.0`, and public discovery also says `1.0.0`; none binds the running code to a Git SHA or manifest versions.

## Command baseline

| Command | Result |
| --- | --- |
| `corepack enable` | fail: `corepack` is not installed |
| `pnpm install --frozen-lockfile` | pass; lockfile current |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | pass: 16 files, 106 tests |
| `pnpm test:playability` | pass: 6/6 |
| `pnpm test:ai-soak` | pass: 50/50 matches, 0 timeouts, 27 pinfalls, 23 knockouts |
| `pnpm test:soak` | pass: 6 rematches, flat forced-GC heap in the short rematch test |
| `pnpm build` | pass: 616 transformed modules |
| `pnpm test:e2e` | **fail: 15/16**; standing-jump pelvis peak did not clear the required `reset + 0.2 m` threshold |

The earlier green report is therefore superseded for this baseline. `corepack` absence is a tooling issue; the full-suite jump failure is a gameplay/release blocker.

## Chunk graph

| Chunk | Minified | Gzip | Gate |
| --- | ---: | ---: | --- |
| Rapier WASM | 2,236.67 KB | 842.37 KB | above 900 KB warning threshold |
| Three core | 724.62 KB | 184.61 KB | below threshold, still material |
| Main application | 193.38 KB | 56.32 KB | below threshold |
| React runtime | 189.69 KB | 59.69 KB | below threshold |
| React Three Fiber | 148.77 KB | 47.48 KB | below threshold |
| GameScene | 62.99 KB | 17.94 KB | lazy |
| React Rapier | 23.07 KB | 7.72 KB | lazy vendor |
| FighterModel | 18.61 KB | 5.95 KB | lazy |
| FighterPreview | 1.00 KB | 0.55 KB | lazy |
| Drei | 0.79 KB | 0.44 KB | split |

The build still emits the chunk warning because Rapier WASM remains above 900 KB. The limit has not been raised to hide it.

## Asset inventory baseline

`public/` contains 19 files: favicon plus static health, docs, OpenAPI, LLMS, sitemap, feed, manifest, and well-known discovery documents. There are no PNG, WebP, GLB, texture, animation, font, or audio files. Runtime visuals are procedural geometry/materials and runtime audio is procedural.

Consequences:

- no mature fighter mesh or shared skinned skeleton exists;
- no fighter-specific face, attire, hair, tattoo, or material asset exists;
- no arena texture/material asset set exists;
- no local move animation clips exist;
- no local move-specific audio asset set exists;
- no asset-manifest version or critical-asset release gate exists;
- browser console inspection found zero failed asset or application errors in the audited optimized build.

This is a complete inventory of the current public asset surface; detailed per-file classification moves to `ASSET_INVENTORY.md`.

## Visual and playability findings

### Character maturity

All five fighter previews were captured. Each uses the same primitive hierarchy: box torso/pelvis/hands/boots, capsule limbs, low-segment joints, dodecahedron head, and simple procedural headwear. Palettes and gross width/height differ, but anatomy, faces, attire, hands, joints, and fighter-specific movement identity do not meet the requested close-range standard.

### Locomotion and controls

- The articulated collision rig remains upright and reported zero invalid bodies or emergency resets during the live audit.
- The visible presentation still uses a generic `walk` or `run` pose for all planar directions; it has no authored forward/back/strafe/diagonal/brake/pivot states.
- HUD input names are useful, but legal-input frame acknowledgement and bounded buffering are not measured.
- Existing Playwright keyboard and gamepad journeys pass; native Chrome automation is unavailable because the ChatGPT Chrome connection cannot read the selected profile. Computer Use confirmed Chrome is running and inspected the current `0.0.6` release page without changing account state.
- Physical gamepad, iOS/Android, and OpenXR hardware are not certified by emulation.

### Strike readability

- Jab, heavy, low/high kick, block, counter, whiff, and guard scenarios were captured.
- At the first 70 ms post-trigger jab observation, the move already reported `recovery`; its contact silhouette was not readable without the HUD.
- The heavy-strike anticipation remained largely front-on with the opponent obscuring the attacking limb.
- A front-kick active frame reported correct move state, but the boot/contact limb was hidden by model overlap.
- `jab`, `combo`, and `high_punch` share the same `jab` animation key; all kick families share `kick`; several grapples share `throw`, `slam`, `lift`, or `grappleEntry`. Data-level distinction is therefore not equivalent to visual identity.

### Grapple readability

The grapple scenario established two physical grips, but the audited frame reported 1.739 m maximum grip error. The camera pushed into the models, primitive limbs crossed through torsos, hands did not read as anchored control points, and the HUD matrix obscured additional action. The physics relationship exists; the player-facing grapple does not yet look like professional wrestling control.

### Body slam

At 650 ms after scenario start the slam still reported anticipation/lift with two grips; 700 ms later the move and grips were already cleared. The first captured frame was an extreme close-up of interpenetrating primitive bodies, and the next was both fighters standing. The required stance load, visible hand control, support loss, lift peak, rotation, downward drive, landing, ring response, and pin opportunity were not continuously readable. No 100-trial or human-recognition certification exists. Baseline status: **fail**.

### Remaining moves

Suplex, powerbomb, rope rebound stiff-arm, apron return, turnbuckle, aerial, table collapse, knockout/result, walking, running, and braking were captured in the reproducible evidence run. Their deterministic state paths exist, but the visual evidence does not yet prove every public move has a unique silhouette, grip, victim pose, audio, VFX, camera, and recovery.

## Arena, camera, effects, and audio

- The ring has readable neon ropes, posts, canvas and an enlarged playable footprint.
- Close action is frequently blocked by the Physics Lab panel, control deck, grapple matrix, foreground ropes, or an over-tight camera.
- The grapple/slam camera can crop heads, feet, and contact points, making weight transfer impossible to judge.
- Distant architecture remains mostly dark procedural bars; the arena still reads as a ring in a black void rather than a complete premium venue.
- Crowd, entrance depth, commentary equipment, prop detail, table failure states, chair anatomy, and trash-can anatomy remain low-detail procedural representations.
- Impact particles and camera reactions exist, but frame review does not yet prove contact-synchronized tiers for every move/material.
- Procedural audio exists and stayed console-clean; move-by-move eyes-closed identification is not certified.

## Runtime and resource measurements

Optimized Physics Lab idle sample:

- reported renderer cadence: 120 FPS;
- physics/controller average: 0.381 ms;
- physics/controller p95: 0.500 ms;
- observed maximum step: 9.600 ms;
- fighter bodies: 32;
- world bodies: 49;
- permanent fighter/world joints: 30/30;
- idle temporary grips: 0; grapple sample: 2;
- invalid bodies: 0;
- emergency resets/containments: 0/0;
- contacts: 32 idle;
- physical replay: bounded to 75 rule frames, but the lab byte estimate varied by scenario.

Five-minute headless Toy Test sample after forced garbage collection:

| Elapsed | JS heap | DOM nodes | Documents | Frames | Listeners | Fighter bodies |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 s | 29.3 MB | 58 | 1 | 1 | 175 | 32 |
| 65 s | 165.3 MB | 58 | 1 | 1 | 175 | 32 |
| 125 s | 405.1 MB | 58 | 1 | 1 | 175 | 32 |
| 185 s | 561.3 MB | 58 | 1 | 1 | 175 | 32 |
| 245 s | 702.6 MB | 58 | 1 | 1 | 175 | 32 |
| 300 s | 807.4 MB | 58 | 1 | 1 | 175 | 32 |

The stable DOM/listener/body counts rule out simple React-node or rigid-body duplication, but the linear forced-GC heap growth is a release blocker until diagnosed. The headless software-WebGL frame sample produced p50 329 ms, p95 736 ms, p99 1,196.2 ms, one-percent-low 0.74 FPS, and maximum 1,712.6 ms. Those absolute frame numbers are not representative of a hardware-accelerated desktop, but they establish that this environment cannot certify the desktop performance envelope.

The runtime does not expose draw calls, geometry count, texture count/memory, shader-program count, collider count, presentation-bone error, or p50/p99 physics step time. Those are instrumentation gaps, not zero values.

Short six-rematch soak remained bounded at 32 fighter bodies, 30 joints and a flat 26 MB forced-GC heap in its isolated run. The contradiction with continuous five-minute growth means rematch cleanup can be green while long-match allocation is still broken.

## Evidence captured

Temporary evidence root: `/tmp/ringfall-blockbuster-baseline`

- 30 PNG screenshots covering five selection previews, five live fighter matches, center ring, walking, running, braking, jab, hook, low/high kick, block, counter, grapple, body slam, suplex, powerbomb, rope rebound, apron, turnbuckle, aerial, table, and knockout/result.
- Two WebM recordings covering all five fighters/keyboard input and the move/arena/prop sequence.
- Two Playwright traces for frame-by-frame review.
- Full-suite failed-jump screenshot, video and trace under the current `test-results/physics-lab-*` directory.
- `/tmp/ringfall-blockbuster-baseline/five-minute-soak.json` contains frame and resource samples.

The evidence is baseline material, not final certification. Final deterministic visual artifacts must be regenerated from the release candidate and retained with the release report.

## Release blockers entering implementation

1. Full E2E matrix fails standing jump.
2. Five-minute Toy Test shows severe linear forced-GC heap growth.
3. Production cannot identify its Git SHA, build timestamp, environment, or manifest versions.
4. Close-range wrestlers remain primitive fallback models.
5. No mature fighter/arena/animation/audio asset set or versioned asset manifest exists.
6. Locomotion lacks directional visual states and credible foot/body mechanics.
7. Punch, kick, guard, reaction, grapple, slam, finisher, climb, aerial, taunt, and prop presentation are not visually certified.
8. Body slam lacks 100-trial and human-recognition evidence.
9. Camera frequently obscures contact and weight transfer.
10. Arena/background/props/crowd do not meet premium venue quality.
11. Draw-call, geometry, texture, shader, collider, alignment-error, load-time, and physical-device instrumentation/evidence are missing.
12. Chrome extension automation is unavailable in this environment; Browser and Playwright evidence remain available.
13. No representative human playtest has been run.

Implementation may begin only against these explicit failures while preserving the green BodyWorks, rules, roster, device adapters, match, prop, rematch, and static-platform systems.
