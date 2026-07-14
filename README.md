# RINGFALL: CHAOS CIRCUIT

An original, local-first 3D arcade wrestling game built with React, TypeScript, Vite, Three.js, React Three Fiber, Rapier, Zustand, and Vitest.

Five original fighters collide in **The Volt Dome** across two-to-four-minute matches. Combat rules are deterministic and phase-based. A 16-body articulated Rapier contact rig per fighter owns locomotion, hand contact, two-hand grips, lift weight, knockback, and measured landings, while a richer hierarchical wrestler model mirrors that authoritative state to keep the player-facing silhouette stable and expressive.

## Run locally

Requires a current Node.js LTS release and pnpm 9.15 or a compatible Corepack-provided pnpm release.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. The game has no backend, login, cloud state, advertisements, remote assets, or runtime network requests.

Production and verification commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm preview
```

## Controls

| Action | Keyboard | Standard gamepad |
|---|---|---|
| Move / aim / choose strike or grapple direction | WASD | Left stick or D-pad |
| Run | Left Shift | Right trigger |
| Quick strike / ground strike | J | X / Square |
| Heavy / rope rebound / prop swing | K | Y / Triangle |
| Enter grapple / choose grapple move | L, then direction + J/K/L | B, then direction + X/Y/B |
| Hold guard / stuff grapple | I | Left trigger |
| Dodge / timed counter / downed kick-up / kickout / climb down | Space | A / Cross |
| Standing jump / hop | C | Left-stick press |
| Pick up, swing, drop, or throw a prop | E | Left bumper |
| Ring exit/re-entry, turnbuckle climb/dive, corner rail shot, pin, or signature | F | Right stick press |
| Signature taunt | Q | Right bumper |
| Pause | Escape | Menu / Options |

Movement is camera-relative and the live control deck always names the move that will fire. With no direction, J/K are Circuit Jab/Fault Hook. Aim forward for Skyline Cross/Voltage Uppercut, backward for Circuit Low Kick/Piston Boot, left for Neon One-Two/Arc Roundhouse, and right for Skyline Cross/Halo High Kick.

L enters a visible collar-and-elbow lock; during its anticipation window, a direction plus J/K/L selects one of fifteen named outcomes including arm drags, trips, chokes, spinebusters, suplexes, powerbombs, side tosses, slams, and an Irish whip. Near a corner, F converts that secured clinch into a physical Turnbuckle Rail Shot. A direction held through release also drives the physical throw. When the defender is already committed over the commentary desk, bounded environmental aim assist keeps the slam on the desk instead of launching the ragdoll past it. Hold I/LT to guard: strikes deal tiny chip damage and drain guard stamina, while a grapple can be stuffed until the guard breaks. Space performs a visible, stamina-bound Livewire Kick-Up while downed; ordinary recovery selects a readable back, front, or side get-up from the last impact.

Running K becomes a Railway Stiff-Arm and a registered hit guarantees a knockdown. Sprint into an elastically deforming rope to compress it; its hard elastic tier prevents normal sprint-through, reverses the complete body, and opens the faster stiff-arm window only on the inward run. Press F near a center rope to crouch through the middle ropes to ringside or return; at a corner, F is reserved for lower, middle, and top turnbuckle stages. From the top: J is Neon Drop Elbow, K is Top-Rope Missile Kick, F is Domefall Dive, Q taunts, and Space descends one stage. Fill Momentum, stagger or drop the opponent, and press F to perform that fighter's signature.

On browsers that expose `immersive-vr`, the in-match **ENTER ARENA XR** action starts a `local-floor` WebXR session suitable for Meta Quest, Steam Frame/OpenXR-compatible runtimes, and other standards-based headsets. The left XR stick moves, left trigger runs, left squeeze guards, and right-controller buttons map to strike, grapple, counter, and contextual actions. Desktop and XR both use HRTF-positioned procedural impacts, footfalls, rope snaps, and arena sounds; no remote audio assets are loaded.

### Cinematic wrestling engine

Strikes and throws use authored phase keyframes rather than one animation pose for an entire move. Jabs retract, make contact, and recover; hooks rotate through the hips and shoulders; struck fighters snap, stagger, or leave their feet according to impact weight. Elbows and knees are independently articulated, boots stay planted on the mat, and damage triggers a short body flash plus a capped contact burst.

Grapples are paired two-fighter sequences. The attacker owns the victim through a visible lock, load, lift, contact, and safe release. Powerbombs, front slams, suplexes, chokes, spinebusters, arm drags, side tosses, trips, and Irish whips have distinct victim orientation and attacker leverage. Release impulses are distributed by segment mass across the complete articulated body, preventing the pelvis stretch and vibration caused by applying a heavyweight's total impulse to one rigid body. Major landings add restrained slow motion, hit-stop, a mat shock ring, a layered synthesized thump, crowd response, and a purpose-selected camera shot. AI commits to its selected throw instead of changing moves during the lock.

The core body slam is deliberately staged: reach, two-hand grip, pull, visible resistance, foot adjustment, lowered hips, lift, peak, drive, shoulder/back landing, impact pause, and recovery. The ring deck flexes in a bounded wave whose strength follows the same presentation hierarchy as the camera and audio. Healthy, hurt, exhausted, and high-momentum fighters carry different posture even before the HUD is read.

### The Volt Dome level and camera director

The playable floor extends beyond every apron into a larger barricaded ringside map. The commentary desk, physical three-tier steel steps, entrance lane, reactive perimeter ribbons, expanded crowd bowl, lighting truss, stage wall, and tunnel create readable destinations instead of a dark void around the ring. Chairs, signs, and a metal trash can are real grippable/throwable bodies. Damped barricade panels visibly give on impact while fixed outer rails preserve the safety boundary. The ring, floor, desk, steps, ropes, posts, props, and barricades have collision authority; decorative architecture stays out of gameplay physics.

The camera director uses stable broadcast, wide, ringside-X, ringside-Z, commentary-table, aerial, grapple, and replay modes. It predicts bounded motion, holds a shot long enough to prevent rapid cuts, selects one camera hemisphere for continuity, and separately damps the look target. Camera-relative controls freeze their basis while input or a cinematic action is active, so a camera move cannot turn a held forward grapple into a side move. Reduced Motion lowers movement and disables impact shake.

Every fighter receives five optional pre-match beers. Drinking one adds five points to that match's stamina cap; unopened cans stay on the bench. Chad “The Claw” Kinsey deliberately has the roster's lowest base stamina, so choosing how much to drink is a meaningful part of his high-power, low-gas identity. Rematches preserve the selected allotment.

## Match structure

- **Standard** — no starting weapons, normal Momentum, pinfall or knockout.
- **Chaos Circuit** — stable props, stronger environmental interaction, faster Momentum, and one bounded arena event every 35–55 seconds.
- **Normal AI** — readable reactions and occasional strategic mistakes.
- **Hard AI** — faster decisions, better spacing and counter timing, with no hidden stat or damage bonus.

The five data-driven originals are Atlas Rex, Vex Volt, Nova Fang, Brick Mercy, and Chad “The Claw” Kinsey. Each has its own proportions, palette, biography, stats, strategic tendency, taunt, and signature finisher.

## Architecture

```text
src/
  app/          screen flow and session lifecycle
  game/
    ai/         utility-based shared-rule opponent decisions
    animation/  interpolated hierarchical pose library
    audio/      gesture-gated procedural Web Audio with HRTF spatial emitters
    camera/     deterministic shot selection and priority
    components/ Three/Rapier arena, fighters, camera, effects
    data/       immutable fighter, move, balance, and arena definitions
    input/      keyboard/gamepad abstraction
    state/      Zustand match and persistent settings stores
    systems/    deterministic combat and legal state transitions
    types/      strict shared contracts
  ui/           broadcast HUD, menus, tutorial, settings, results
  tests/        WebGL-free deterministic combat tests
```

Combat and Rapier advance at a fixed 60 Hz step. Moves have anticipation, active, and recovery phases. A stance-anchored swept hurt volume makes a visually valid strike reliable even when a distal hand joint trails by a few milliseconds; eligibility still exists only during active frames and retains one-hit-per-attack deduplication. The player and AI call the same command validation and execution functions.

### Adjustable balance rubric

All match-shaping constants live in `src/game/data/balance.ts` instead of being scattered through rendering code.

| Dial | Current target |
|---|---|
| Match pace | A decisive match in roughly 2–4 minutes |
| Stamina identity | Fighter stat sets the cap; low stamina slows choices without disabling control |
| Beer tradeoff | 0–5 beers, +5 cap each, visible before the bell and on the HUD |
| Guard | Low hold drain, meaningful impact drain, chip only, grapple stuff with guard break |
| Grapple readability | Visible lock, directional selection window, lift/contact/landing sequence |
| Crowd Hype | Variety beats repetition; counters, finishers, near falls, and environment spike it |

Deterministic rules remain separate from presentation, but physical contacts are authoritative in the shipping match. The hidden articulated collision rigs use bounded muscle forces, shared center-of-mass locomotion, coherent whole-body impulses, and stable segment rotations rather than uncontrolled ragdoll impulses. The separate production wrestler hierarchy supplies readable walk, run, strike, throw, fall, and recovery performance. The initial shell starts preloading the lazy game scene only after menu interaction, and the production build splits React, Three core, React Three Fiber, Drei, React Rapier, and Rapier WASM into separate cacheable chunks. Auto/Performance/Quality profiles bound crowd density, DPR, antialiasing, and shadows without changing the simulation.

### UI-free Toy Test

Append `?toyTest=1` to the local URL and start a match to run the feel gate. The HUD, tutorial, touch overlay, and crowd are removed; crowd audio is muted; health, Momentum, Hype, stats, pinfall, and knockout progression are frozen. Movement, stamina, AI pressure, strikes, guards, reactions, grapples, slams, ropes, camera, impact effects, and spatial impact audio remain active. This mode exists to answer one question honestly: is controlling the wrestler fun without scoring or interface rewards?

## Testing

Vitest covers:

- active-phase-only damage
- per-swing hit deduplication
- stamina and Momentum bounds
- finisher and pin eligibility
- counter interruption
- pause freezing
- rematch cleanup
- AI legality under state/stamina pressure
- attack phase transitions
- seeded determinism
- complete finisher victory and rematch reset
- strike and grapple guard pressure, guard breaks, and legal transitions
- five-beer stamina caps and Chad's deliberately low gas tank
- paired grapple choreography, phase interpolation, articulated strike contact/reactions, the five-direction strike grid, directional grapple selection, visual kick-up, staged turnbuckles, three aerials, elastic rebound stiff-arms, and center-rope traversal
- a fifty-slam weight/approach soak that proves clean release without a stuck attacker
- standard and WebXR gamepad axis normalization, including alternate XR thumbstick axes and missing-button fallbacks
- UI-free Toy Test isolation for health, score, Hype, Momentum, and result progression

Playwright covers the production-preview full match plus controlled Bodyworks, Toy Test, and mobile journeys: initialization, Chad selection, five-beer setup, Chaos Circuit, exact situational controls, movement and braking, jumping, punch and directional-kick damage, visible guard, a live kick-up, elastic rope load, stiff-arm knockdown, observed two-hand grapple and physical slam landing, three-stage climb, top-rope options, real pin/KO resolution, clean console output, and instant rematch.

Dedicated deterministic browser scenarios prove idle-body stability, rope rebound into a stiff-arm knockdown, a tracked top-rope dive, apron exit/re-entry, a physical commentary-table collapse, standard gamepad control, WebXR capability discovery, and portrait/landscape touch behavior. A 50-match deterministic bot soak checks completion and bounded state. A bounded six-rematch soak checks Rapier body/joint cleanup, emergency resets, rolling frame cost, and browser heap growth without turning the test into an unbounded benchmark.

```bash
pnpm test:playability
pnpm test:ai-soak
pnpm test:soak
pnpm test:e2e
```

The Vite development server also surfaces browser console errors in its terminal, which is used during live gameplay smoke testing.

## Vercel deployment

`vercel.json` declares the Vite framework, clean URLs, build output, XR policy, and security headers. Static public discovery includes health, OpenAPI, LLM, sitemap, feed, manifest, security, trust, agent, and honest unsupported-MCP declarations.

```bash
pnpm exec vercel link --yes --project platphorm-frwf
pnpm exec vercel pull --yes --environment=preview
pnpm exec vercel build
pnpm exec vercel deploy --prebuilt
# Verify the immutable preview, then:
pnpm exec vercel promote <preview-url>
pnpm exec vercel inspect <production-url>
pnpm exec vercel logs <production-url> --since 1h --level error
```

For a direct production rebuild, keep the prebuild and deploy targets aligned:

```bash
pnpm exec vercel pull --yes --environment=production
pnpm exec vercel build --prod
pnpm exec vercel deploy --prebuilt --prod
```

The game intentionally does not install Vercel Analytics, Speed Insights, databases, flags, queues, functions, or Marketplace storage: each would add runtime behavior or telemetry that conflicts with this product's no-backend/no-runtime-network contract. Vercel is used for immutable static delivery, routing, headers, previews, promotion, and release inspection.

## PlatPhorm contract

RINGFALL remains a game first. Public discovery files report real static capabilities and honest `unsupported`/`degraded` states for backend health, MCP execution, trace propagation, protected mutations, Vercel request metadata, and authentication. There are no fake runs, fake counts, fake APIs, or simulated downstream integrations.

The detailed Bodyworks baseline, architecture, attached-contract audit, capability matrix, tuning, performance, test, release, device, platform, and fun-audit documents live in [`docs/bodyworks/`](docs/bodyworks/).
