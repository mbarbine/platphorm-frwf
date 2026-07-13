# RINGFALL: CHAOS CIRCUIT

An original, local-first 3D arcade wrestling game built with React, TypeScript, Vite, Three.js, React Three Fiber, Rapier, Zustand, and Vitest.

Four original fighters collide in **The Volt Dome** across two-to-four-minute matches. Combat is deterministic and phase-based; rendering, procedural animation, physics props, camera motion, particles, and Web Audio provide the spectacle without owning match authority.

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
| Move | WASD | Left stick |
| Run | Left Shift | Right trigger |
| Quick strike / ground strike | J | X / Square |
| Heavy / rope rebound / prop swing | K | Y / Triangle |
| Grapple | L | B / Circle |
| Dodge / timed counter / kickout | Space | A / Cross |
| Pick up, swing, drop, or throw a prop | E | Left bumper |
| Pin, corner aerial, or signature finisher | F | Right stick press |
| Signature taunt | Q | Right bumper |
| Pause | Escape | Menu / Options |

Movement is camera-relative. Grapples cycle through a body slam, suplex-style throw, takedown, and Irish whip. Run into the ropes to rebound; powerful throws can produce a deliberate ring-out. At a turnbuckle, use F against a vulnerable rival for a Domefall Dive. Fill Momentum, stagger or drop the opponent, and press F to perform that fighter's signature.

## Match structure

- **Standard** — no starting weapons, normal Momentum, pinfall or knockout.
- **Chaos Circuit** — stable props, stronger environmental interaction, faster Momentum, and one bounded arena event every 35–55 seconds.
- **Normal AI** — readable reactions and occasional strategic mistakes.
- **Hard AI** — faster decisions, better spacing and counter timing, with no hidden stat or damage bonus.

The four data-driven originals are Atlas Rex, Vex Volt, Nova Fang, and Brick Mercy. Each has its own proportions, palette, biography, stats, strategic tendency, taunt, and signature finisher.

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
