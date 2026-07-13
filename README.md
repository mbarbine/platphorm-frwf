# RINGFALL: CHAOS CIRCUIT

An original, local-first 3D arcade wrestling game built with React, TypeScript, Vite, Three.js, React Three Fiber, Rapier, Zustand, and Vitest.

Five original fighters collide in **The Volt Dome** across two-to-four-minute matches. Combat is deterministic and phase-based; rendering, procedural animation, physics props, camera motion, particles, and Web Audio provide the spectacle without owning match authority.

## Run locally

Requires a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The game has no backend, login, cloud state, advertisements, remote assets, or runtime network requests.

Production and verification commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

## Controls

| Action | Keyboard | Standard gamepad |
|---|---|---|
| Move / choose grapple direction | WASD | Left stick or D-pad |
| Run | Left Shift | Right trigger |
| Quick strike / ground strike | J | X / Square |
| Heavy / rope rebound / prop swing | K | Y / Triangle |
| Enter grapple / choose grapple move | L, then direction + J/K/L | B, then direction + X/Y/B |
| Hold guard / stuff grapple | I | Left trigger |
| Dodge / timed counter / kickout | Space | A / Cross |
| Pick up, swing, drop, or throw a prop | E | Left bumper |
| Ring exit/re-entry, turnbuckle climb/dive, pin, or signature | F | Right stick press |
| Signature taunt | Q | Right bumper |
| Pause | Escape | Menu / Options |

Movement is camera-relative. L enters a visible collar-and-elbow lock; during its anticipation window, a direction plus J/K/L selects one of fifteen directional outcomes including arm drags, trips, chokes, spinebusters, suplexes, powerbombs, side tosses, slams, and an Irish whip. Hold I/LT to guard: strikes deal tiny chip damage and drain guard stamina, while a grapple can be stuffed until the guard breaks. Running K becomes a stiff-arm. Run into the ropes to rebound; powerful throws can produce a deliberate ring-out. Press F at the ropes to deliberately step ringside or return. At a turnbuckle, F climbs first and F again launches a Domefall Dive at a vulnerable rival. Fill Momentum, stagger or drop the opponent, and press F to perform that fighter's signature.

### Cinematic wrestling engine

Strikes and throws use authored phase keyframes rather than one animation pose for an entire move. Jabs retract, make contact, and recover; hooks rotate through the hips and shoulders; struck fighters snap, stagger, or leave their feet according to impact weight. Elbows and knees are independently articulated, boots stay planted on the mat, and damage triggers a short body flash plus a capped contact burst.

Grapples are paired two-fighter sequences. The attacker owns the victim through a visible lock, load, lift, contact, and safe release. Powerbombs, front slams, suplexes, chokes, spinebusters, arm drags, side tosses, trips, and Irish whips have distinct victim orientation and attacker leverage. Major landings add restrained slow motion, hit-stop, a mat shock ring, a layered synthesized thump, crowd response, and a higher/wider broadcast camera cut. AI commits to its selected throw instead of changing moves during the lock.

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
    audio/      gesture-gated procedural Web Audio
    components/ Three/Rapier arena, fighters, camera, effects
    data/       immutable fighter and move definitions
    input/      keyboard/gamepad abstraction
    state/      Zustand match and persistent settings stores
    systems/    deterministic combat and legal state transitions
    types/      strict shared contracts
  ui/           broadcast HUD, menus, tutorial, settings, results
  tests/        WebGL-free deterministic combat tests
```

Combat advances at a fixed 30 Hz step. Moves have anticipation, active, and recovery phases. A target can be damaged only in the active phase and only once per move unless a move explicitly opts into multi-hit behavior. The player and AI call the same command validation and execution functions.

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

Visual simulation is deliberately subordinate to the match model. Authored poses handle knockdowns rather than unstable full-body ragdolls. Crowd geometry is instanced, particles are capped, the initial shell is code-split from the Three/Rapier arena, and device pixel ratio is adaptive.

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
- paired grapple choreography, phase interpolation, articulated strike contact/reactions, directional grapple selection, turnbuckle aerials, stiff-arms, and ringside traversal

Playwright runs one production-preview journey covering initialization, Chad selection, five-beer setup, Chaos Circuit selection, held guard, an observed grapple lock and active grapple impact, live combat through a real pin/KO result, clean console output, and instant rematch:

```bash
npm run test:e2e
```

The Vite development server also surfaces browser console errors in its terminal, which is used during live gameplay smoke testing.

## Vercel deployment

`vercel.json` declares the Vite framework, SPA fallback, clean URLs, and security headers. Static public discovery includes health, OpenAPI, LLM, sitemap, feed, manifest, security, trust, agent, and honest unsupported-MCP declarations.

```bash
vercel link --yes --project platphorm-frwf
vercel build --prod
vercel deploy --prebuilt
# Verify the immutable preview, then:
vercel promote <preview-url>
vercel inspect <production-url>
vercel logs <production-url> --since 1h --level error
```

The game intentionally does not install Vercel Analytics, Speed Insights, databases, flags, queues, functions, or Marketplace storage: each would add runtime behavior or telemetry that conflicts with this product's no-backend/no-runtime-network contract. Vercel is used for immutable static delivery, routing, headers, previews, promotion, and release inspection.

## PlatPhorm contract

RINGFALL remains a game first. Public discovery files report real static capabilities and honest `unsupported`/`degraded` states for backend health, MCP execution, trace propagation, protected mutations, Vercel request metadata, and authentication. There are no fake runs, fake counts, fake APIs, or simulated downstream integrations.
