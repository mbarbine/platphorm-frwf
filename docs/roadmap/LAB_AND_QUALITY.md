# Physics lab and quality acceptance

The physics lab is the game's diagnostic workspace, not another simulation. Use the same renderer, body assets, clock, intent resolver, contacts and rules as ordinary play. Fixtures may arrange initial positions; actions must come from recorded ordinary inputs. Preserve a manual mode and record when fixture setup differs from a normal match.

## Required lab capabilities

- Versioned scenarios: gait, start/stop/turn, strikes, counters, grounded recovery, paired moves, ropes/corners, props/tables, crowded bouts, camera/spectator and frame stalls.
- Timeline: press/release → resolved intent/target → acceptance/defer/reject → move phase → submitted rendered pose → source/target contact → outcome/damage → recovery. Missing events remain missing.
- Pause, one fixed step, slow/real-time replay, front/side/rear bookmarks and synchronized comparisons. Draw intended, solved and rendered skeletons plus foot support, joint limits and grips only on demand.
- Export source SHA, asset hashes, scenario schema, seed, input stream, physical metrics, timing and capture references. Keep output bounded and private-safe. Replay never awards progression or mutates a live match.
- No “pass” from an announcement, proximity or pelvis height alone. Contact must use the correct fist/boot; a supported pelvis can still have a broken neck or folded feet.

## Acceptance scenarios

| Gate | Reproduction and evidence |
| --- | --- |
| Q1 Human support | Five representative body types; stand, walk/run, turn/stop, strafe/backpedal. Compare target/solver/skin. No uncommanded neutral falls, inverted soles or head buried in torso |
| Q2 Strike/chain | Each basic strike and mixed chain at close/edge/out-of-range; hit, miss, block, interruption. Correct source contact, visible anticipation/drive/recovery, no duplicated damage |
| Q3 Recovery | Supine/prone/left/right after ordinary knockdown; rope/table proximity, exhausted and interrupted cases. Correct supports, no teleport or emergency reset, control restored |
| Q4 Paired exchange | Weak/strong front/back grips, slam and pin/kickout across heavy/light pairs. Correct anchors, release/landing, no overlap used as a substitute for cover |
| Q5 Traversal/props | All corners and ring sides, deliberate Battle Royale exit then knockdown/re-entry; pickup/carry/attack/throw/drop/break, cleanup on rematch |
| Q6 Ordinary game | Menu → Singles and default Battle Royale → complete bout → spectator/rematch; keyboard, gamepad and touch. AI allows readable choices; camera and HUD keep action visible |
| Q7 World/network | Explore/save/reload and two-client complete session, reconnect/spectate/rematch. Same legal outcome; no stale identities or room/grip leaks |

Initially target at least 95 successful executions out of 100 for recovery and basic slam under documented seeds/body pairs, and 1,000 movement starts/stops with no neutral falls. These are proposed gates, not measured results; report denominator, failures and confidence limits. A visually unacceptable sample fails artistic acceptance even when the statistical gate passes. Store every failing seed and one-command reproduction.

## Performance and devices

Record CPU frame, render frame, physics cost, simulation catch-up/dropped time, draw calls, triangles, texture memory, active bodies/joints/grips, heap, audio voices and network tick/RTT where available. Proposed sustained targets: 60 fps desktop quality, 30 fps selected mobile tier; establish exact hardware and p95/p99 budgets during month one. Never claim those targets achieved from software rendering or browser emulation.

Test Chrome/Firefox/WebKit, integrated GPU, phone and tablet landscape/portrait, gamepad disconnect/reconnect, focus loss, reduced motion/flash and readable HUD scaling. Optional XR gets a separate comfort/device protocol with no forced camera cuts. Failed or unavailable devices stay explicitly unverified. Load selected roster/venue assets intentionally; avoid first-punch shader/animation hitches. Do not merely raise Vite chunk warning limits.

## Release evidence

Run actual package scripts: `pnpm verify`, targeted `pnpm test:playability`, `pnpm test:ai-soak`, `pnpm test:soak`, and relevant `pnpm test:e2e` scenarios. Worker/server/protocol changes require their own inspected scripts and real integration. Add deterministic rules and physical invariants, rendering/asset checks, ordinary browser journeys and sustained soak; do not replace failed assertions with easier scenarios.

Capture full-speed footage and record observer feedback on responsiveness, clarity and desire to rematch. Human playtests establish feel; they do not replace reproducible technical tests. Deployment reachability also does not establish feel. Review prior failures explicitly, then publish a concise accepted/failed/unverified matrix, source version and rollback target.

Suggested review roles (not assigned staff): gameplay owner validates rules/contact; character artist validates anatomy/deformation; QA validates reproduction/device coverage; product owner judges the ordinary bout. One person may cover multiple roles, but each evidence decision stays distinct.
