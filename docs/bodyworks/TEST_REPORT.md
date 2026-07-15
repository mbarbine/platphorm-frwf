# Bodyworks test report

Status: **superseded historical report; current candidate unverified and not deployed**.

The tables below record the preceding release. They are not reused for the revised BodyWorks contract. Current implementation status is in `STATUS.md`; current acceptance requirements are in `CAPABILITY_PLAN.md`. A new dated result block is added only after every final command runs on one commit.

The previous production baseline at commit `34144fa` passed lint, typecheck, 101 Vitest tests, 12 Playwright scenarios, production build, and a live smoke. This pass changes runtime loading, quality selection, metrics, props, barricades, recovery, corner grapples, device scenarios, lab tooling, and soak coverage, so previous evidence is not reused as final certification.

## Current local Phase 1 checkpoint — 2026-07-15

This checkpoint covers the controls-to-authoritative-action buffer, paused-input lifecycle, exact action feedback, neutral grapple semantics, and four coaching-display modes on the current uncommitted working tree. It does not replace the required final matrix below and does not establish preview or production identity.

| Gate | Command | Result |
| --- | --- | --- |
| Frozen install | `CI=1 npx --yes pnpm@11.13.0 install --frozen-lockfile` | pass; lockfile already current |
| Lint | `npx --yes pnpm@11.13.0 lint` | pass, zero warnings/errors |
| Strict types | `npx --yes pnpm@11.13.0 typecheck` | pass, zero errors |
| Unit/integration | `npx --yes pnpm@11.13.0 test` | 30 files, 190/190 pass |
| Production bundle | `npx --yes pnpm@11.13.0 build` | pass; known Rapier WASM size warning remains |
| Paused touch lifecycle | `npx --yes pnpm@11.13.0 exec playwright test e2e/mobile-controls.spec.ts -g "paused touch controls"` | 1/1 pass in 9.2 seconds |
| Gamepad + touch lifecycle | `npx --yes pnpm@11.13.0 exec playwright test e2e/device-inputs.spec.ts e2e/mobile-controls.spec.ts -g "standard gamepad\|paused touch controls"` | 3/3 pass in 36.9 seconds |
| Exact control labels + display modes | `PLAYWRIGHT_SUITE=control-deck-modes-four npx --yes pnpm@11.13.0 playwright test e2e/control-deck-modes.spec.ts` | 4/4 pass in 48.4 seconds; full/compact labels matched resolvers, compact first-L path observed `slam`, prompts-only retained exact feedback, hidden removed coaching overlays |
| Playability regressions, first run | `npx --yes pnpm@11.13.0 test:playability` | 6/6 pass in 3.5 minutes |
| Playability regressions, repeat | `npx --yes pnpm@11.13.0 test:playability` | **fail**, 5/6 pass in 4.4 minutes; loaded stiff-arm had no required physical contact, impact, or knockdown |

The focused touch proof uses a physical Playwright click, verifies the pause button remains the page hit target, confirms paused controls are disabled, attempts a touch edge while paused, resumes, and confirms the executed-action count does not advance. The gamepad proof pauses and resumes with the standard Start button while physics is stopped and likewise rejects a paused strike. The display-mode proof uses real keyboard edges and a MutationObserver only to retain the transient resolved move ID; it does not mutate gameplay state. No `force` click or direct pause-state mutation is used. The non-repeatable rope result prevents broader playability signoff.

## Current local Phase 2 checkpoint — 2026-07-15

This checkpoint covers neutral stance/orientation, all-roster traversal, braking, rapid turns, soft separation, and explicit fall attribution on the current uncommitted working tree. It is automated local evidence only; it is not a human-play, physical-device, preview-deployment, or release certificate.

| Gate | Command | Result |
| --- | --- | --- |
| Orientation and separation units | `npx --yes pnpm@11.13.0 exec vitest run src/tests/combatOrientation.test.ts src/tests/closeRangeSeparation.test.ts` | pass, 6/6; bounded independent orientation and exact-overlap separation |
| Headless physical traversal | `npx --yes pnpm@11.13.0 exec vitest run src/tests/physicsRuntime.integration.test.ts` | pass, 7/7; all five wrestlers × eight directions, stop, support, and fall audit included |
| Neutral production-build browser | `PLAYWRIGHT_SUITE=neutral-orientation npx --yes pnpm@11.13.0 playwright test e2e/neutral-stability.spec.ts` | pass, 2/2 in 54.8 seconds; stand/walk/stop/run/brake/rapid-turn/soft-separation, zero unknown falls, unexplained instability, or emergency resets |
| AI fall-attribution soak | `npx --yes pnpm@11.13.0 test:ai-soak` | pass, 2/2; singles 50/50 complete with 218 known falls (102 impact, 116 throw), zero unknown falls or unexplained unstable time; Battle Royale sample also zero unknown/unstable |
| Automated Toy Test neutral gate | `PLAYWRIGHT_SUITE=toy-neutral npx --yes pnpm@11.13.0 playwright test e2e/toy-test.spec.ts` | pass, 1/1 in 32.5 seconds; zero unknown falls, unexplained instability, or emergency resets after movement |
| Production-preview visual sample | local optimized preview at `127.0.0.1:4182` with Playwright Chromium | pass for the scoped neutral sample: two-foot support, combat stance, zero facing error, zero unknown/unstable telemetry, no console errors; procedural close-range visuals remain uncertified |
| Combined fast gate | `npx --yes pnpm@11.13.0 verify` | pass; lint, strict types, 32 files / 197 tests, and production build; known isolated Rapier WASM size warning remains |
| Default Battle Royale production-build browser | `PLAYWRIGHT_SUITE=battle-royale-final npx --yes pnpm@11.13.0 playwright test e2e/battle-royale.spec.ts` | pass, 3/3 in 1.9 minutes; five rigs, default-mode UI, target cycling, authoritative movement, above-deck active bodies, and clean browser error capture |

The AI result records causes instead of treating match completion as sufficient. The browser orientation telemetry is derived from the same pure orientation model used by the fighter presentation, while support/fall/reset evidence comes from the live physical runtime. A manual ten-minute Toy Test and physical keyboard/gamepad/touch matrix remain required.

## Required final evidence

| Gate | Command | Acceptance |
| --- | --- | --- |
| Lint | `pnpm lint` | zero warnings/errors |
| Strict types | `pnpm typecheck` | zero errors |
| Unit/integration + AI soak | `pnpm test` | all tests, including 50 matches, pass |
| Production bundle | `pnpm build` | successful Vite output and separate runtime chunks |
| Browser matrix | `pnpm test:e2e` | all deterministic desktop/mobile/gamepad/XR-surface/lab scenarios pass |
| Rematch/heap soak | included in browser matrix | six rematches, stable body/joint counts, bounded heap |
| Preview smoke | immutable preview URL | menu, match, controls, physics, and discovery routes |
| Production smoke | canonical alias after promotion | no promotion unless all earlier gates pass |

## Historical local evidence — 2026-07-13

| Gate | Result |
| --- | --- |
| Install integrity | `pnpm install --frozen-lockfile` — lockfile current |
| Lint | pass, zero warnings/errors |
| Strict types | pass, zero errors |
| Vitest | 16 files, 106/106 pass |
| Browser matrix | 16/16 pass in 4.7 minutes |
| Rebound stress repeat | 5/5 pass after continuous attack-path sweep fix |
| AI soak | 50/50 complete, 0 timeouts, 27 pinfalls, 23 knockouts |
| Production build | pass, 616 transformed modules |

AI soak: 25.31 simulated seconds average; 0.0027 ms average rules-simulation step; 4.82 ms p95 whole-match wall time; 75 maximum rules-replay frames; 4 maximum props.

Six-rematch browser soak: 32 fighter bodies and 30 permanent fighter joints after every reset; zero emergency resets; headless renderer 12 FPS baseline and 23 FPS final; 0.338 ms average physics/controller step; 0.500 ms p95; 208.3 KB physical replay estimate; requested-GC heap stayed flat at 29.4 MB across all seven samples.

Production chunks: GameScene 62.99 KB / 17.94 KB gzip; React Rapier 23.07 / 7.72; Fiber 148.77 / 47.48; React runtime 189.69 / 59.69; Three core 724.62 / 184.61; Rapier WASM 2,236.67 / 842.37. The build warning is limited to the intentionally isolated Rapier WASM chunk exceeding 900 KB minified.

## Historical deployment evidence — 2026-07-13

- Immutable preview `dpl_73dSYfWhAccjJHN7bHAV66vKKZUq` reached Ready at `https://platphorm-frwf-9nt87eqs5-platphormnews.vercel.app`. Team Deployment Protection correctly redirected the unauthenticated browser to Vercel login, so the preview is recorded as protected rather than falsely reported as a public gameplay smoke.
- The exact preview source was promoted as production deployment `dpl_HrVffReG45hfrGuYgsMNhovp27L2`, which reached Ready at `https://platphorm-frwf-96mnzf2hs-platphormnews.vercel.app`.
- The custom alias did not advance automatically during promotion. It was explicitly reassigned, and Vercel confirmed `https://frwf.platphormnews.com` now points to the new production deployment. The previous rollback target is `dpl_3xBENaQxmnLLKQ5eLBCiNke84WbE`.
- Canonical production browser smoke passed the splash, main menu, fighter selection, match setup, runtime chunk load, live match and keyboard-input path. The live HUD reported physics authority enabled, 32 fighter bodies, 30 permanent joints, zero invalid bodies and zero emergency resets. Browser output contained no errors from the Ringfall production origin.
- Direct navigation to non-HTML discovery assets is blocked by the in-app browser client. Their generated contents and route inventory are covered by the passing local platform/discovery tests and production build; that client limitation is not represented as a live HTTP route pass.

Physical iOS/Android, gamepad and OpenXR comfort/latency checks remain device-required and are not represented as automated success.
