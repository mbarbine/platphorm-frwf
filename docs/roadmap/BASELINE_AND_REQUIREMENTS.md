# Baseline and requirements

Snapshot: September 12, 2026, source `8a6abe8`. That commit adds the supplied No Mercy FAQ to `controller-map.md`; the preceding runtime release is `809deca`. Source references and prior verification records were inspected for this plan. Production was not re-probed during this documentation pass.

## What has been built

- React/Three/R3F presentation and Rapier articulated fighters; local rules, contact damage, contextual controls, grabs, throws, pins, props, AI and replay paths exist.
- Fourteen selectable roster definitions and skinned characters exist. Nine original reference photographs and Thomas's written reference guide likeness work. A selectable model is not an accepted likeness.
- Contextual J prop pickup/weapon use, K downed-target stomp and distance-sensitive kicks, ground hand strike and time/range/facing constrained rushing counters were implemented in the interim release.
- Stamina-aware locomotion, physical jump acceptance, input interruption feedback, bone transform conversion, rope continuity and camera obstruction fixes have received work. User screenshots still show severe anatomical and motion defects.
- Chair, wooden table and trash can from the completion pack are imported with hashed assets, bounded textures, collision metadata and shared prop rendering. Full weapon and break presentation remains unaccepted.
- Crowd variation, signs, venue lighting/fog and showground encounters exist. The showground uses encounter transitions and local progression; it is not a seamless persistent open world.
- Platform discovery and release identity exist. The previous handoff records `809deca` on Vercel and Cloudflare, operational Worker D1/R2 and protected room creation. The canonical host remained on Vercel. A Worker room endpoint is not connected browser multiplayer.

## Evidence and limits

The [execution record](../EXECUTION_PROGRESS_2026-09-12.md) contains multiple dated test snapshots, not one current universal pass. The last runtime handoff recorded 652 local tests, three Worker integration tests and three responsive roster browser checks passing. A source-contact browser capture timed out after an expectation correction; ordinary-input and physical-device acceptance remain incomplete. These are prior results, not tests rerun for this roadmap.

The user supplied direct failures: feet curled under bodies; weak punches and sloppy kicks; missing readable uppercuts; unnatural running, walking and getting up; neck/torso deformation; poor heavyweight proportions; floating lifts; intersecting wrestlers; unreliable climbing and exits; crowded HUD and camera obstructions. These remain stronger evidence of product failure than a passing damage assertion.

## Scope ledger

| ID | Requirement and reported problem | Snapshot status | Acceptance reference / target |
| --- | --- | --- | --- |
| R01 | Anatomical body proportions, bone axes, skinning, neck, shoulders, hands and boots | implemented/unaccepted | Roster + lab; months 1–3 |
| R02 | Grounded idle, walk/run, acceleration, turns, stop, strafe/backstep, fatigue | partial | Gameplay gait fixtures; month 1 |
| R03 | Supine/prone/side recovery, planted feet, interruption and return of control | partial | Recovery suite; months 1–2 |
| R04 | Big readable jab, cross, uppercut, low/mid/high kicks and downed stomp | partial | Source-contact and visual strike suite; months 1–2 |
| R05 | Deliberate mixed combos, weak/strong strikes and directional grapples | partial; streak logic exists | Shared intent and chain tests; months 1–2 |
| R06 | Subsecond skill-based strike/grapple/rushing reversals and fair defense | partial | Timing/range/facing boundary tests; month 2 |
| R07 | Grips, lifts, slams, suplexes, piledrivers, throws, pins and submissions | implemented/unaccepted | Paired-move suite; months 2–4 |
| R08 | Jump, corner/post climb, aerial, rope rebound, apron exit/re-entry | partial | Traversal suite including Battle Royale; months 2–3 |
| R09 | Contextual pickup, carry, swing, drop, throw, prop hit and table break | partial | All prop lifecycles; months 2–4 |
| R10 | Original roster move identity, photo likeness, clothing, signature taunts/finishers | partial | Fifteen profile reviews; months 1–4 |
| R11 | All supplied assets inventoried and assigned a runtime or reference use | partial | Asset register and explicit disposition; months 1–6 |
| R12 | Human-looking packed crowd, varied signs/reactions, believable arena and lighting | partial | Venue/crowd ordinary-bout review; months 3–5 |
| R13 | Clear compact HUD, target selection, camera occlusion and spectator views | partial | Desktop/mobile/spectator journeys; months 1–3 |
| R14 | Shared-runtime physics lab, input/contact/pose timeline and reproducible captures | partial | Lab requirements; months 1–2, then ongoing |
| R15 | Fair AI spacing, attack commitment, recovery opportunities and difficulty | partial | Singles and multi-opponent bouts; months 2–4 |
| R16 | Connected world, exploration, encounters, rivalries and saved progression | partial | World journeys; months 4–6 |
| R17 | Authoritative online parity, rooms, reconnect, spectators and rematches | partial; incompatible paths | Two-client and load certification; months 7–9 |
| R18 | Animation/mocap ingest, retargeting, paired clips, provenance and replay parity | partial | Canonical rig and clip gates; months 1–4 |
| R19 | Sound weight, impact timing, crowd response, original footage and entrances | partial | Listening/visual review; months 2–5 |
| R20 | Keyboard/gamepad/touch, accessibility, measured performance and XR | partial | Physical device matrix; ongoing, XR month 10 |
| R21 | Release identity, HTTPS, provider responsibility and rollback | verified infrastructure snapshot | Reverify each release; continuous |
| R22 | Routes/discovery/auth/trace, real cross-site support and honest limitations | partial | Semantic and protected integration checks; continuous |
| R23 | Broader match rules, championships, creation/customization and progression depth | planned beyond existing modes | Mode contracts and save migration; months 6, 10–11 |
| R24 | Replay, support tools, soak tests, feedback and long-term operations | partial | Quality/operations gates; continuous, months 9–12 |

## Source map

Controls: [supplied FAQ](../../controller-map.md), [previous adaptation](../NO_MERCY_NEXT_PHASE_2026-09-12.md). Runtime: `src/game/systems/combat.ts`, `strikeResolver.ts`, `moveSelection.ts`, `src/game/state/matchStore.ts`, `src/game/physics/physicsRuntime.ts`, `src/game/data/fighters.ts`, `moves.ts`. Prior issues: [core review](../CORE_GAMEPLAY_QUALITY_REVIEW.md), [attack outcomes](../ATTACK_OUTCOME_REVIEW_2026-09-12.md). Assets: [completion import](../assets/COMPLETION_IMPORT_2026-09-12.md), [underground audit](../assets/underground-v4-audit.json). Earlier architecture and long-range scope: [legacy roadmap](../../ROADMAP.md), [collective plan](../COLLECTIVE_MASTER_PLAN.md).

Historical documents may say five fighters, 39 moves, absent Cloudflare bindings or a different default mode. Do not carry those statements forward as current facts. Recount registries and verify live provider state when implementing or releasing.

## Addition during planning

Josh “The Enforcer” is now a fifteenth local roster definition with the new reference portrait, provisional balance/taunt and an explicitly shared temporary model. This is separate from the fourteen-fighter deployed baseline above; likeness and new-build production verification remain outstanding.
