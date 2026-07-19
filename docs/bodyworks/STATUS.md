# BodyWorks current status

Updated: 2026-07-15

Status: **implementation active; not Gold Master certified; production unchanged**.

The revised BodyWorks contract supersedes earlier blanket certification language. The current branch is rebuilding the decisive player-facing gates around physical contact, stable articulated control, repeatable grapples, committed landings, ropes/corners/props, mobile controls, and bounded lifecycle behavior. A successful build is evidence of bundle integrity only; it is not gameplay certification.

## Current local candidate checkpoint

- Input devices now converge on the shared semantic action contract and one bounded physics-authority action buffer with 150 ms ordinary and 110 ms context windows.
- Buffer priority, sequence, deduplication, overflow rejection, expiry, explicit outcome status, and player-facing rejection reasons are deterministic and covered by unit tests.
- Pause, focus loss, visibility loss, teardown, defeat, and victory clear pending local input. Resume sampling prevents a held gamepad button from producing a false new edge.
- Mobile pause is a verified physical hit target; paused controls are disabled and cannot leak a stale touch action into resumed play.
- Exact pre-input labels now cover neutral strikes, collar lock, taunt, and resolver-owned context/prop actions. Executed feedback stores the resolved display name rather than depending on short-lived animation state.
- Neutral L now starts the promised default Voltage Slam/body slam, while a second L during the lock preserves the deeper Voltage Piledriver selection.
- Full, compact, prompts-only, and hidden coaching modes are implemented and browser-verified. The compact view exposes five primary actions; hidden mode suppresses every coaching overlay without disabling gameplay input.
- The current combined controls/neutral candidate passes lint, strict TypeScript, 32 Vitest files / 197 tests, production build, a three-test gamepad/mobile lifecycle set, and the 4/4 control-deck browser matrix.
- The broader playability suite passed 6/6 once, then failed rope-contact repeatability on the immediate rerun with 5/6 passing. The loaded stiff-arm appeared, but physical contact, impact, and knockdown did not. This remains an open blocker rather than a recycled pass.
- Neutral locomotion now separates movement heading, combat-facing chest orientation, and bounded head tracking instead of forcing one full-body direction.
- Exact center overlap now receives a deterministic, bounded soft-separation response; already-separating fighters are not launched.
- The all-roster headless traversal matrix covered five fighters and eight directions with clean stops and zero unknown falls, unexplained unstable time, or emergency resets.
- The focused production-build neutral suite passed 2/2 across stand, walk, stop, run, brake, rapid turn, and soft separation. The automated Toy Test passed 1/1 with zero unknown falls, unexplained unstable time, or emergency resets.
- The 50-match AI soak completed 50/50 and categorized all 218 falls: 102 registered impacts and 116 throws, with zero unknown falls or unexplained unstable time.
- A production-preview visual sample showed both wrestlers upright, planted on two feet, squared up, and holding raised hands with no browser-console errors. Their close-range procedural appearance remains a separate visual-maturity blocker.
- Default Battle Royale passed its focused production-build browser gate 3/3 in 1.9 minutes: all five physical rigs initialized, player target cycling and movement remained authoritative, active bodies stayed above the deck, and the browser emitted no game errors.

This is working-tree evidence only. It is not a commit, immutable preview, production deployment, human-play certification, or Gold Master claim.

## Currently demonstrated in the production-preview browser

- two stable 16-body / 15-joint Rapier wrestlers at fixed 60 Hz;
- readable authored wrestler presentation over persistent physical bodies;
- planted locomotion support with no ordinary emergency reset in the sampled scenarios;
- an in-range jab that scores from the active physical hand contact exactly once;
- an out-of-range jab that leaves health unchanged;
- two surface-based physical grapple grips and a mass-driven lift path;
- bounded runtime metrics for support, joint separation, motor saturation, contacts, tasks, replay, and presentation alignment;
- keyboard, touch, gamepad-adapter, and XR-adapter mappings through the same command buffer;
- independently lazy Three, Fiber, Drei, React Rapier, physical rig, scene, lab, replay, settings, and Rapier WASM chunks.

## Open release blockers

- complete the human neutral-control matrix and ten-minute manual Toy Test on keyboard, physical gamepad, and touch hardware; automated zero-unknown-fall evidence does not certify feel;
- verify exact control names and the four coaching modes with representative human keyboard, physical gamepad, and touch-device play, not headless Chromium alone;
- make the loaded rope stiff-arm produce repeatable physical contact, impact, and knockdown; the current automated scenario passed once and failed its immediate repeat;
- certify a forearm/hand guard interception rather than merely a clean miss;
- finish and repeat the physical core/shoulder landing gate for slams, then re-certify table and corner landings;
- repeat rope rebound stiff-arm, apron return, corner dive, table collapse, and full match/rematch scenarios on the final build;
- reduce idle motor saturation and close the authored-shell-to-physical-segment alignment gap before claiming a single production visual body;
- run the final lint, type, unit, browser, AI, rematch, five-minute heap/performance, preview, discovery, and live route gates once;
- complete representative iOS Safari, Android Chrome, physical gamepad, and OpenXR hardware checks.
- prove disconnect/reconnect input clearing only when the later multiplayer phase is actually introduced; it is not inferred from local pause/focus coverage.

The exact capability ledger and acceptance evidence are maintained in `CAPABILITY_PLAN.md`. Previous production identifiers remain useful rollback history only and are not evidence for this candidate.
