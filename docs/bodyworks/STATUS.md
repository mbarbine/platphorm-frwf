# BodyWorks current status

Updated: 2026-07-13

Status: **implementation active; not Gold Master certified; production unchanged**.

The revised BodyWorks contract supersedes earlier blanket certification language. The current branch is rebuilding the decisive player-facing gates around physical contact, stable articulated control, repeatable grapples, committed landings, ropes/corners/props, mobile controls, and bounded lifecycle behavior. A successful build is evidence of bundle integrity only; it is not gameplay certification.

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

- certify a forearm/hand guard interception rather than merely a clean miss;
- finish and repeat the physical core/shoulder landing gate for slams, then re-certify table and corner landings;
- repeat rope rebound stiff-arm, apron return, corner dive, table collapse, and full match/rematch scenarios on the final build;
- reduce idle motor saturation and close the authored-shell-to-physical-segment alignment gap before claiming a single production visual body;
- run the final lint, type, unit, browser, AI, rematch, five-minute heap/performance, preview, discovery, and live route gates once;
- complete representative iOS Safari, Android Chrome, physical gamepad, and OpenXR hardware checks.

The exact capability ledger and acceptance evidence are maintained in `CAPABILITY_PLAN.md`. Previous production identifiers remain useful rollback history only and are not evidence for this candidate.
