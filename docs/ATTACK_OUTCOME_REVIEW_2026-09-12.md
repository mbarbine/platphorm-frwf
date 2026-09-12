# Attack outcome and interruption review

FRWF is an open-world wrestling simulator. This pass addresses a specific control/readability defect: accepted heavy attacks could be canceled by an incoming strike before a visible pose update, while the HUD continued reporting executed. It does not certify the overall game feel or realism.

## Findings and shared implementation

The earlier ordinary-control trace contained a valid uppercut impact, a staggered player, an empty player move ID and an executed heavy-input message. Input acceptance and physical performance are separate events. A failed assertion on the sampled HUD move ID alone could not distinguish interruption from a dropped input or missing animation.

`src/game/input/attackOutcome.ts` now owns one bounded record for the latest accepted move, keyed by action sequence, move ID and attack instance. It tracks phase, outcome, accepted contact result and pose-frame submissions independently. Repeated moves cannot inherit older contact or render evidence. No historical list grows during a match.

- The command path associates an accepted move with its input sequence.
- The existing contact bridge records hit, blocked or countered only after `applyPhysicalContact` accepts the contact. No additional damage or hit event is produced by the tracker.
- Rules and physical state updates use the same observer to recognize interrupted or ended moves. Ended does not mean hit. An interrupted move may still have landed an earlier valid contact.
- The character renderer counts a pose submission only after updating all physical segment bones, using `BODY_SEGMENT_COUNT` from the shared body schema. This proves rig submission, not GPU visibility, camera framing, anatomical quality, or player satisfaction.
- Interruption changes feedback only for the matching accepted input. A newer queued input retains its own feedback. Lab resets and runtime resets clear the record.
- The HUD shows MOVE STOPPED and the known cause, including countered moves. The message remains for 2.4 simulation seconds and is visible in the mobile layout without capturing touches. Existing explicit hidden-control preferences remain honored.

No invulnerability, strike damage, contact force, move duration, stamina cost or AI difficulty was changed to force a successful animation. The production architecture remains React/Three/Rapier; no dependency was added.

## Verification and evidence boundaries

`pnpm verify` passed lint, typecheck, 529 tests across 68 files, and build. `git diff --check` passed. New cases cover repeated/stale instances, missing pose evidence, each representative strike/grapple interruption, stale move IDs during knockdown, normal completion without contact, matching hit/guard contact, parry, rejected contacts, newer-input preservation and actual HUD text after interruption.

Browser validation uses two complementary checks:

1. The ordinary Singles journey requires matching pose submissions or an explicitly identified interruption for an accepted attack. An interruption must be visible in the HUD; its message is also checked at a 390-pixel viewport when that path occurs. Running jump, landing and no-emergency-reset assertions remain.
2. The close-range source punch/kick journey requires actual rig pose submissions, matching accepted contact, opponent health loss, move completion and supported recovery. It cannot pass merely because all attacks were interrupted. The visible lab sets initial spacing; ordinary keys issue the attacks.

Final browser run results are recorded below. Synthetic contact tests validate event handling; they do not replace the real Rapier and browser contact checks. Browser viewport emulation is not physical-device or XR certification.

## Platform and release impact

No public API, discovery file, authentication contract, trace/span propagation or cross-site integration behavior changed. This pass adds no new platform capability claims and does not audit the rest of the network. No PR was approved or merged, and nothing was pushed or deployed by the agent. The user committed the prior batch to main during work; the source checkout remains main.

## Remaining work

The new evidence separates accepted input, rig presentation and combat interruption; it does not make current character art realistic. Next review should use normal-speed footage to judge startup readability, contact silhouettes, neutral exchange pacing and full paired slams. MPFB authoring/export, aligned underground venue integration, multiplayer authority/reconnect, sustained performance and physical device testing remain unfinished.
