# Bodyworks test report

Status: implementation complete; final consolidated gate pending.

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

This file is updated with exact counts and measurements only after those commands run.

