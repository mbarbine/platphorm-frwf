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

## Focused browser gates

```bash
pnpm test:playability
pnpm test:soak
```

The deterministic playability file starts a fresh production-preview page for each scenario. It proves:

- a planted wrestler's center and head/pelvis relationship remain inside tight bounds;
- an elastic rope load can return into a stiff-arm knockdown;
- a three-stage corner climb launches an aerial that closes distance and deals damage;
- an apron start returns through the ropes to the ring;
- a real two-hand grapple and measured body landing collapse the commentary desk.

The soak runs exactly three instant rematches. Each round reaches a deterministic lab knockout, enters results, rematches, and verifies the expected 32 fighter bodies, 30 anatomical joints, no leaked grips/props, no emergency resets, bounded fixed-step time, and bounded heap growth where Chromium exposes `performance.memory`. It is deliberately finite.

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
