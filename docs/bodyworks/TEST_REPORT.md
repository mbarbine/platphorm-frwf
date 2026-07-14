# Bodyworks test report

Status: **superseded historical report; current candidate unverified and not deployed**.

The tables below record the preceding release. They are not reused for the revised BodyWorks contract. Current implementation status is in `STATUS.md`; current acceptance requirements are in `CAPABILITY_PLAN.md`. A new dated result block is added only after every final command runs on one commit.

The previous production baseline at commit `34144fa` passed lint, typecheck, 101 Vitest tests, 12 Playwright scenarios, production build, and a live smoke. This pass changes runtime loading, quality selection, metrics, props, barricades, recovery, corner grapples, device scenarios, lab tooling, and soak coverage, so previous evidence is not reused as final certification.

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
