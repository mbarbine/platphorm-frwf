# Ringfall BodyWorks capability-combing plan

This is the release ledger for the revised BodyWorks Gold Master contract. It supersedes any earlier blanket “Gold Master” claim. A capability is **certified** only after its implementation, deterministic measurement, slow-motion browser review, cleanup check, and final release command all pass on the same commit. `Implemented — unverified` means source work is present but deliberately awaits the consolidated final gate.

## Player-first release order

1. Control and locomotion: input buffering, physical support, gait, acceleration, braking, turn, jump, camera-relative continuity, mobile and gamepad mappings.
2. Contact truth: jab, whiff, guard interception, deduplication, body-region response, and no pre-contact effects.
3. Wrestling control: visible grip acquisition, load, safe failure, body slam, falls, orientation-aware get-up, pin/KO continuity.
4. Ring creativity: elastic ropes, rebound stiff-arm, apron return, corners, dives, props, progressive table collapse, and safe arena boundaries.
5. Spectacle that follows physics: camera cues, impact hierarchy, audio, crowd, physical-transform replay, and highlights.
6. Lifecycle truth: bounded memory and object counts, AI legality, accessibility, discovery/docs parity, immutable preview, and production gating.

## Contract ledger

| § | Capability | Current implementation state | Certification evidence | Release action |
| --- | --- | --- | --- | --- |
| 1 | Credible physical cause and effect | Implemented — unverified | Full match video plus physical metrics | Block promotion until all Gold Master gates pass |
| 2 | Five Gold Master interactions before breadth | Partial | locomotion 50×; jab/whiff 100×; block 50×; grapple/break 50×; slam 100×; get-up matrix | Disable any move failing its deterministic scenario |
| 3 | Preserve Ringfall product | Implemented — unverified | menu, five fighters, beer, both rules/difficulties, pin/KO/results/rematch browser journeys | No UI rewrite or backend added |
| 4 | Safe migration and rollback flags | Implemented — unverified | flag unit test, build identity, rollback documentation | Keep only `VITE_BODYWORKS_ENABLED` after release window |
| 5 | Zero false completion | Process gate | evidence index with measurements and slow-motion captures | No certification from types/screenshots alone |
| 6 | Authority pipeline | Partial | source audit plus contact/task/browser traces | Continue moving rule mutations out of the physics runtime event path |
| 7 | Remove physical anti-patterns | Implemented — unverified for synthetic strikes, rope teleport, landing chase, aerial chase, ordinary rotation snap | source grep, jab/rope/slam browser scenarios | Any remaining transform write must be lab/reset/emergency-only |
| 8 | SI-like scale and plausible mass | Implemented — unverified | mass-ratio unit test, roster report | Keep one physics meter per scene unit |
| 9 | 16-segment physical skeleton and collider metadata | Implemented — unverified | 32-body/30-joint runtime diagnostics, collision tests | Verify selective CCD and no same-fighter collision |
| 10 | Stable joint strategy and integrity | Partial | headless 30-second stand, joint separation maximum, limit sanitation tests | Spherical joints rely on bounded active motors; certify measured limits or replace with generic joints |
| 11 | Same physical bodies through every state | Implemented — unverified | live scene inspection and replay transform parity | Physical segment rig is now the shipping visual authority |
| 12 | Data-driven motor profiles | Implemented — unverified | profile/fatigue/knockout tests and saturation metric | Tune caps only from measured scenarios |
| 13 | Finite motion-task system | Implemented — unverified | task timeout/ownership/cleanup tests, zero timeout soak | Keep one task per fighter and bounded owned resources |
| 14 | Layered pose targets | Partial | quaternion tests and slow-motion pose review | Add explicit defense/grip/impact/foot correction layers to the target composer |
| 15 | Physical locomotion gate | Partial | 50 repetitions of stand/walk/stop/turn/run/brake/reverse | Tune foot slip and stopping ranges after browser measurements |
| 16 | Foot support and balance | Partial | support score, contact markers, COM projection, foot-slip report | Add contact-force and predicted landing-point detail |
| 17 | Physical jump | Implemented — unverified | feet unsupported, pelvis apex, landing and cooldown scenario | Verify keyboard C, gamepad stick, touch action |
| 18 | Contact-true jab | Implemented — unverified | 100 in-range + 100 out-of-range trials, exactly-once damage | No swept gameplay hit fallback allowed |
| 19 | Physical block | Implemented — unverified | 50 guard trials and guard-bypass trial | Contact must name hand/forearm, not guard state alone |
| 20 | Expanded strikes | Partial | per-move contact/whiff/browser scenario | Keep unsupported moves unavailable until certified |
| 21 | Localized response | Partial | region-classifier tests and slow-motion review | Extend chain-specific compliance directly into motor profiles |
| 22 | Physical grapple acquisition | Implemented — unverified | 50 acquisitions + 50 breaks, visible hand tolerance, zero stuck grips | Tight physical catch radii remain mandatory |
| 23 | Cooperative physical performance | Partial | failure scenarios by stamina/mass/grip load | Add more physically distinct scramble outcomes |
| 24 | Gold Master body slam | Implemented — unverified | 100-attempt matrix; COM rise; feet unsupported; contact landing; cleanup | No broader grapple certification until ≥95 valid completions |
| 25 | Generalized grapples | Partial | per-move matrix | Disable any move without its own task evidence |
| 26 | Distinct suplex mechanics | Partial | snap/German side-view slow motion | Confirm no shared invisible orbit |
| 27 | Powerbomb and spinebuster distinction | Partial | paired side-view scenarios | Measure support, loading height and momentum source |
| 28 | Clothesline and spear contact | Partial | physical limb/torso contact trials | Verify no pass-through at rebound speed |
| 29 | Continuous active-ragdoll control levels | Implemented — unverified | motor-profile transitions and KO settle test | Tune state blends, never swap bodies |
| 30 | Physical get-up | Implemented — unverified | 20 back/front/left/right trials plus obstruction and KO cases | Require ≥95% unobstructed recovery without transform writes |
| 31 | Force-driven ropes | Implemented — unverified | compression/rebound/stiff-arm repeat and no teleport grep | Add measured local rope-node force telemetry if needed |
| 32 | Mat and ring response | Implemented — unverified | impact hierarchy video and frame-time check | Keep visual deformation bounded |
| 33 | Physical prop grips | Implemented — unverified | pickup, swing, hit, throw, release and cleanup journey | Verify chair does not collide destructively with holder |
| 34 | Progressive table failure | Implemented — unverified | intact→stressed→cracked→failed contact scenario | No distance/move-only collapse accepted |
| 35 | Event-driven camera director | Implemented — unverified | camera unit tests, obstruction and direction-continuity browser review | No camera cue may alter physics |
| 36 | Impact presentation from measured events | Implemented — unverified | pre-contact negative assertion, reduced-motion browser gate | Retain low-flash and high-contrast settings |
| 37 | Bounded transform replay | Implemented — unverified | physical-segment replay ordering/memory/skip tests | Replay stays separate from live physics world |
| 38 | Match highlights | Implemented — unverified | results/highlight journey | Local export remains optional, never a release blocker |
| 39 | Physics-aware AI | Partial | 50-match all-roster/difficulty/rules soak | Audit every AI command for the same legality path |
| 40 | Fighter physical identity | Implemented — unverified | roster mass/acceleration/braking/grip/lift comparisons | Tune without hidden bonuses |
| 41 | Production visual body | Implemented — unverified | front/side/impact screenshots and joint alignment | Physical segment hierarchy replaces detached shell in matches |
| 42 | Procedural physical audio | Implemented — unverified | contact/surface/body-region audio journey and voice-count soak | Add breathing/grip strain coverage where missing |
| 43 | Deterministic Physics Lab | Partial | every named scenario executable at pause/step/¼/½/1× | Add explicit metrics/assertions for any scenario still visual-only |
| 44 | Hot-path architecture | Implemented — unverified | profiler, render diagnostics, heap/object soak | No per-step React or unbounded queue growth |
| 45 | Fixed 60 Hz loop | Implemented — unverified | timestep assertion and frame/physics percentiles | Preserve stable insertion order and seeds |
| 46 | Performance budget | Uncertified | five-minute soak; physics avg/p95; render avg/p95; heap and counts | Select graphics tier without replacing physical fighters |
| 47 | Numerical health and emergency behavior | Implemented — unverified | deliberate-fault unit tests, zero ordinary resets in soak | Every emergency reset is counted and surfaced |
| 48 | Unit test contract | Partial | consolidated Vitest inventory | Fill any missing named classifier/controller tests before preview |
| 49 | Headless Rapier contract | Partial | stand/walk/brake/jump/jab/whiff/block/grapple/slam/fail/KO/get-up/reset | No WebGL required |
| 50 | Browser and slow-motion verification | Uncertified | complete 25-step journey, five videos, console and frame sequence review | Run only against production build and immutable preview |
| 51 | 50-match AI soak | Implemented harness; uncertified on final commit | artifact with all required counters and zero fail conditions | Re-run once after final build |
| 52 | Phase ordering | Active | this ledger plus Git history and gate evidence | Do not certify later phases while Gold Master gates fail |
| 53 | Source-control discipline | Active | coherent verified commits | Do not commit a broken release branch |
| 54 | Release command and preview procedure | Uncertified | install, typecheck, lint, unit, E2E, build, soak, preview logs/browser | Production remains unchanged until all pass |
| 55 | Final definition of done | Uncertified | release checklist with concrete measurements | Any failed item blocks promotion |
| 56 | Evidence report | Pending final gate | branch/commit/strategy/counts/rates/perf/preview/controls/limits | Publish exact results, never “should work” |

## “Super fun” playtest rubric

Each final browser playthrough scores these from 1–5, with no item below 4 allowed for release:

- Control ownership: the player can predict movement, stopping, turn, jump, guard, grapple direction, rope rebound, corner climb and recovery.
- Contact satisfaction: clean hits visibly connect, whiffs remain honest, blocks displace limbs, and impact timing has no perceptible early/late response.
- Wrestling creativity: at least three coherent player-authored sequences work in each ruleset, including one rope/corner/environmental spot.
- Opponent quality: AI spaces, guards, fails visibly, varies offense, respects stamina/mass, and finishes a match without cheating.
- Readability: both bodies, the legal action, danger, camera orientation and recovery opportunity remain clear on laptop and mobile layouts.
- Spectacle: camera, mat, ropes, crowd, audio and replay amplify the physical event without obscuring control.
- Rematch desire: match pacing, move variety, highlights and cleanup support an immediate rematch without slowdown or stale state.

## Evidence artifact layout

Final artifacts belong under `test-results/bodyworks-gold-master/`:

- `gold-master-results.json`
- `ai-soak.json`
- `five-minute-soak.json`
- `performance.json`
- `cleanup.json`
- `browser-console.json`
- `screenshots/`
- `videos/`
- `traces/`
- `preview-smoke.json`

Hardware-only iOS Safari, Android Chrome, physical gamepad and OpenXR comfort checks are reported as `device-required` until actually run. They are never converted into automated success.
