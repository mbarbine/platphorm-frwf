# Showground upgrade evidence

Site purpose: FRWF browser wrestling, progressing toward an explorable open world.

## Changes

- `src/game/world/`: connected environment, collision-constrained walking, nearby offers, touch controls, minimap and validated device-local continuity.
- `src/app/App.tsx`, AI/combat/types, styles: exploration entry and match handoff; Easy rival setting.
- `src/game/input/mobileInput.ts`: held touch inputs no longer expire after 2.5 seconds.
- Public health/docs/LLMS and `vercel.json`: accurate world scope, unknown static runtime health, unmeasured compliance score and JSON headers.
- New world/input unit tests, showground browser journeys and actual local Cloudflare integration suite.

## Commands and results

- `pnpm verify`: lint, TypeScript, 353 tests in 55 files, production build passed.
- `pnpm --dir cloudflare test`: Worker bundle plus 3 real local runtime integration tests passed.
- `pnpm --dir cloudflare typecheck`: passed.
- Chromium: desktop/phone encounter journeys, all three connected locations, mobile match entry, Easy strike/jump/recovery, Normal AI contact, paused Settings continuity and WebGL context-loss recovery passed in targeted runs.
- WebKit: phone match entry, desktop/phone encounter continuity and connected locations passed before the final host-clearance refinement; the staged production journey rechecks that refinement.
- Test corrections: wait for input readiness; approach a doorway at walking speed; exercise control sequences in Easy practice with the rival live. The original Normal sequence attempted actions while grabbed or interrupted and is not claimed as a passing deterministic control sequence.
- Production identity is exposed at `/release.json`. A local test pass alone does not establish production deployment.

## Limits and follow-up

Bouts are instanced in Volt Dome; outdoor wrestling, mocap and cloud saves are not delivered. Device-local results are not trusted online rankings. New world artwork and animation remain an early slice below the final realism target. Phone emulation is not physical iPhone acceptance. Existing trace/auth boundaries remain; no new cross-site service is certified. Cloudflare production bindings and browser integration require a separate verified cutover. The other platform sites were not audited or modified by this pass.
