> Forward planning now lives in the [one-year roadmap, September 2026–September 2027](roadmap/README.md). This document is retained as historical context; its ordering and status claims may be superseded.

# Next execution phase: a wrestling exchange worth repeating

Status: execution in progress; the phase is not accepted. Prepared September 12, 2026. See [the execution report](EXECUTION_PROGRESS_2026-09-12.md) for implemented changes, measured checks and remaining failures.

## Purpose and recap

FRWF is an open-world style wrestling game: explore, choose a confrontation, wrestle, earn an understandable result, and continue exploring. Quick play remains available, with Battle Royale as the requested default and principal multi-fighter test scenario. The user wants believable physical performance, satisfying contact, detailed original wrestlers, useful cameras, easy multiplayer and complete device controls.

The existing collective master plan remains the overall roadmap. This phase turns its core-wrestling priority into ordered delivery gates. More moves, stronger impulses and more effects alone do not satisfy it.

Planning baseline (historical snapshot; see the execution report for newer checks):

- Located the clean `main` checkout at `/Users/bwm.barbinewarnermichael/Documents/Documents - Michael’s MacBook Pro - 1/github/platphorm-frwf`; HEAD is `0aa4861`. The earlier Documents/github path is absent.
- Live `/release.json` reports 1.4.1, source `7549cc7ae254e52938362ef19128ca3c9afd79fa`, six wrestlers and 39 moves. Release metadata proves identity, not playability or equality with local HEAD.
- Repository reports describe three combat venues, a connected exploration circuit and saved local results. They explicitly retain a scene boundary between exploration and combat.
- Source contains a shared locomotion profile, physical move tasks, recovery support checks, contact-driven combat, a match-standing HUD helper and Dale's 6′4″/225 lb identity and Welcome to the Jungle biography.
- The physical-contact report records five imported combat clips, anatomy limits, physical recovery and contact regression coverage. These are historical results; no gameplay tests were rerun during this planning pass.
- Repeated user reports remain unresolved acceptance evidence: floating, backward gait, twisted limbs, weak or disconnected strikes, tangled landings, failed get-up, confusing match standing and unreliable multiplayer.

## Engineering direction

Retain React/Three/Rapier while inspecting current package compatibility before any upgrade. Establish explicit ownership of movement, articulated pose, paired interactions and contact events. The visual skeleton and collision landmarks must agree throughout each move. Avoid concurrent controllers fighting over the same limb.

Use shared move definitions for startup, active contact, recovery, interruption, paired grips and player prompts. Local simulation, the lab, replay and eventual online authority should consume the same rules. Separate physical authority from presentation without hiding invalid physical contact behind a cosmetic animation.

Motion is a candidate for restrained HUD, result and menu transitions, with reduced-motion behavior and bundle measurement. Its official project describes web animation, gestures, springs and layout transitions: https://github.com/motiondivision/motion. It does not supply wrestling mocap or a paired-character controller. Add it only for a concrete UI improvement.

## Ordered execution

| Gate | Work | Required evidence before advancing |
| --- | --- | --- |
| 0 — reproducible baseline | Read current repo instructions, compare main with deployed source, run actual scripts, inspect existing failing artifacts. Record ordinary-input desktop and touch journeys. Audit gameplay tests for forced state and assertions that only check counters. | A defect ledger linking each reported failure to a repeatable scenario, video, source owner and a regression check. Unknowns remain unknown. |
| 1 — grounded control | Trace input → intent → simulation → pose. Fix forward/backward/strafe gait, run acceleration/braking, facing, foot support and camera-relative steering. Handle held touch input, release, pause and focus loss consistently. | All roster members walk, run, backpedal, turn and stop on ring, yard and backstage surfaces without unintended flight, curled limbs or loss of control. Record ordinary controls and intermediate poses. |
| 2 — strikes that connect | Certify jab, cross, uppercut and front kick first. Align anticipation, planted support, contact and follow-through. Generate damage, sound, recoil and feedback from the same accepted contact event. Keep whiffs and guards readable. | Legal contact, miss, guard, interruption and repeated input each produce the corresponding visible result. No damage from a predicted swing that never reaches the defender; no duplicate hit from one strike window. |
| 3 — coherent paired wrestling | One interaction owner drives both participants through acquisition, secured clinch, choice, lift, release, landing and separation. Certify body slam before suplex, side toss and powerbomb. Repair recovery by physical cause; do not remove standing checks just to advance state. | Visible hand/body contact through the lift; believable center of mass and landing; no prolonged interpenetration, joint inversion or collapsed anatomy. Get Up works from front/back/both sides, exhausted stamina and table landings; repeated presses do not restart it. Movement resumes after physical recovery. |
| 4 — readable match and cameras | Show player/target identity, actual damage and stamina, valid immediate action, danger and the real win condition. Distinguish health advantage from victory probability. Tune follow, broadcast and first-person visibility. | In Battle Royale, ordinary players can identify themselves, their opponent, why an action failed, who remains and how to win. First person preserves aim/control and avoids head/torso obstruction. Finish elimination, result and rematch journeys. |
| 5 — character and venue finish | Improve silhouettes, shoulders/hands, muscle definition, materials, lighting and contact shadows after anatomy is stable. Review Chad against supplied references and Dale against his stated proportions. Author and certify Welcome to the Jungle as a paired move. | Before/after normal-speed footage of the same exchange. No lighting or effect hides contact. Existing music slider, crowd audio and source footage remain usable. Imported clips retain provenance; supplied video is not advertised as completed mocap. |
| 6 — repeatable world loop | Reuse the certified controller in actual venue encounters. Preserve checkpoint, identity and earned results on return. Then prototype one encounter in the exploration simulation before expanding continuous combat. | Explore → choose encounter → fight → earn result → resume exploration → reload. No ring-specific physics leaks into yard/backstage. Report scene handoff honestly until shared simulation is demonstrated. |
| 7 — authoritative online loop | Audit browser Colyseus, Node shared core and Cloudflare room implementations. Select and document one authoritative gameplay path based on measured parity. Wire create/share/join, authoritative actions, reconciliation, disconnect/reconnect and rematch. | Two independently controlled clients agree on contact, damage, grapple ownership and results under latency, jitter, packet loss and reconnect. Record tick cost, corrections, bandwidth and load/soak results before calling multiplayer ready. |
| 8 — devices and release | Verify keyboard/mouse, gamepad, phone and tablet; evaluate XR separately. Keep requested Ultra default with explicit saved preference and a measured fallback for unsupported/resource-constrained devices. Validate release on both owning deployment planes. | Browser/device matrix, measured frame times and memory, no blank-screen lifecycle failure, clean relevant gates, Vercel source identity, Cloudflare integration evidence and rollback references. Physical-device/XR gaps are explicitly labeled. |

## First implementation batch

### Supplied Underground Living v4 venue

The user confirmed the relocated checkout and supplied `/Users/bwm.barbinewarnermichael/Desktop/frwf/frwf_underground_venue_living_v4.zip`. Read-only ZIP inventory and manifest inspection found approximately 79.2 MB uncompressed, with a primary scene at `scene/frwf_underground_living_venue_v4.glb`, modular architecture/ring/props, separate collision scenes, crowd proxies, material maps, decals, FX textures, lighting profiles and environment presets. The archive README describes it as a generated production base. File names and presets do not establish implemented runtime behavior. No assets have been imported or visually certified in this planning pass.

Use this as the concrete environment candidate for gates 5–6. Asset inspection can begin during baseline work; combat acceptance still precedes presenting the venue as a finished playable experience.

1. Validate GLBs, scene bounds, scale, axes, texture references, material color spaces, provenance and archive integrity. Inspect the actual rendered scene. Measure geometry, textures, draw calls and decoded memory; the similarly sized LOD files require measurement rather than assuming useful simplification.
2. Import a curated, hashed asset set through the existing asset pipeline. Deduplicate embedded/shared textures, budget compression and lazy loading, and keep a fallback when the venue fails to load.
3. Map collision classes to actual Rapier shapes and venue surfaces. Verify visual/collider alignment, ring height, stairs, doorways, barriers, safe spawns, camera clearance and recovery on props. Decorative catwalks and doors must not imply traversability until collision/navigation supports it.
4. Stage a playable route through entrance, ringside and backstage. Connect an actual encounter and return checkpoint; only mark it seamless if simulation ownership is continuous.
5. Wire lighting/environment presets, crowd and effects to real encounter phases with bounded mobile cost. Preserve visibility of hands, feet and contact; haze and wetness must not obscure gameplay.
6. Run the certified strike/slam/recovery exchange here, followed by Battle Royale, ordinary touch traversal, asset-failure recovery and sustained performance checks. Update venue discovery only after the venue is reachable and tested.

Keep the first code batch focused on gates 0–3: reproduce backward sliding, the weak kick and blocked recovery; trace ownership; implement a coherent fix; capture approach → strike → clinch → body slam → get up → move away using ordinary inputs. Start with Chad versus Dale for different proportions, then run the roster/venue matrix. Add active opponents and Battle Royale before accepting the batch.

Inspect `src/game/animation/locomotion.ts`, `src/game/physics/physicsRuntime.ts`, `motionTaskRunner.ts`, `bodyDynamics.ts`, `src/game/systems/combat.ts`, presentation rig mapping and input handlers together. Existing balance-based recovery completion is a hypothesis to investigate, not a confirmed root cause: its support gate intentionally prevents claiming recovery while sideways.

## Evidence and quality rules

- Do not discard the existing tests wholesale. Classify unit invariants, real-physics checks, ordinary-input journeys and visual evidence. Replace incorrect expectations with behavior-based checks and retain useful security/platform coverage.
- A counter increment cannot certify contact. Inspect shipping geometry and intermediate frames as well as events. Record contact gap, grip error, unsupported airtime, time to recovered control, unintended falls and emergency resets; set defensible tolerances from body scale and intended movement.
- Use normal-speed clips and close views for anatomy plus normal gameplay camera views for readability. Lab setup is useful for diagnosis; ordinary-menu journeys are required to prove integration.
- Run repository scripts as defined: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; select the existing contact/recovery/wrestling/Battle Royale/browser suites from the actual changes. Run Cloudflare tests when that plane changes. Do not claim these ran in this planning pass.
- Proposed performance targets: stable 60 fps on a named reference desktop and at least 30 fps on a named supported phone, measured over a five-minute battle. Establish hardware and settings before treating these as achievable acceptance budgets. XR requires its own headset-specific comfort and frame budget.
- Software checks establish bounded correctness. Fun and believable wrestling require hands-on assessment. Record what remains awkward and preserve it as open work; do not declare quality solved from passing tests.

## Platform and release obligations

Preserve the site's gameplay identity and current standard routes, auth boundaries and trace propagation. Update public discovery only for delivered behavior. Use real capabilities and honest unsupported/degraded states; no invented online readiness, device support or mocap claims. Platform protected operations retain PLATPHORM_API_KEY; never expose it in gameplay or artifacts.

Before release, check FRWF's actual public routes/discovery and membership through the root network graph and base sitemap index. Verify frontend and backend independently; neither a Vercel build nor a Worker deploy proves the complete online experience. Keep last-known-good versions and migration compatibility available for rollback. Other portfolio sites require their own audits and remain outside this phase's certification.

## Planning-pass report

- Files changed: this phase document and a link in COLLECTIVE_MASTER_PLAN.md.
- Commands: filesystem discovery, `git status`, `git log`, bounded source/document reads, and a read-only production `/release.json` request; Motion's official repository was reviewed.
- Tests: not run; documentation-only planning change. Validate with `git diff --check`.
- Product impact: executable priorities and acceptance evidence defined; no runtime behavior changed.
- Routes, discovery, trace/span, auth and cross-site integration: unchanged and not freshly certified.
- Known gaps: visual/physical-device review, current full test baseline, production gameplay and authoritative online parity remain unverified.
- Next action: execute gates 0–3 on current main, preserving unrelated work, and report measured gameplay evidence before widening the pass.
