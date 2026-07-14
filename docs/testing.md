# Verification and release gates

## Local quality gate

Use the committed pnpm lockfile and run the complete gate once after an implementation batch:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm verify` runs the same lint, type, unit, build, and browser sequence without reinstalling dependencies.

Playwright serves the existing production bundle through Vite preview, so build before invoking a focused browser command directly. Readiness-sensitive scenarios wait for both registered physics bodies and completed fixed steps; this prevents first-frame shader compilation from being misreported as failed movement.

## Focused browser gates

```bash
pnpm test:playability
pnpm test:ai-soak
pnpm test:soak
pnpm test:soak:5m
```

The deterministic playability file starts a fresh production-preview page for each scenario. It proves:

- a planted wrestler's center and head/pelvis relationship remain inside tight bounds;
- an elastic rope load stays inside the ring boundary, returns inward, and becomes a stiff-arm knockdown;
- a three-stage corner climb launches an aerial that closes distance and deals damage;
- an apron start returns through the ropes to the ring;
- a real two-hand grapple and measured body landing collapse the commentary desk.

The AI soak runs exactly 50 seeded bot matches across every fighter, both difficulties, and both rulesets. It requires 50 results with bounded 75-frame rules replay, bounded Chaos props, and an average headless simulation step below the physics budget.

The regular browser soak runs exactly six instant rematches. The explicit `test:soak:5m` gate runs a wall-clock-bounded five-minute rematch/heap soak, attaches a JSON artifact, caps heap growth, and verifies body/joint/fault/performance invariants. The long soak is opt-in so ordinary browser development remains fast; release certification requires it.

## Build evidence

The Vite size report must show distinct `react-runtime`, `three-core`, `react-three-fiber`, `react-three-drei`, `react-rapier`, and `rapier-wasm` assets. Rapier WASM remains the largest cacheable payload and may still trigger the configured chunk warning; that warning is not treated as proof that the libraries were merged back together.

## Deployment gate

```bash
pnpm exec vercel pull --yes --environment=production
pnpm exec vercel build --prod
pnpm exec vercel deploy --prebuilt --prod
pnpm exec vercel inspect <production-url>
```

Release reporting keeps these states separate: source changed, local tests passed, production build passed, deployment became Ready, and the public alias served the new immutable deployment. Static discovery routes are checked separately from gameplay because a green health file does not prove a playable WebGL match.
