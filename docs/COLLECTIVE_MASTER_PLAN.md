# FRWF collective master plan

Updated 2026-09-08 from the repository, the architecture proposal, the conversation, and another ordinary Chrome playthrough. This is the current ordering of the larger ROADMAP, not a declaration that its features have shipped.

## Current quality decision — core wrestling remains unacceptable

After 1.3.0, the user still describes the gameplay as Atari E.T.-level. Treat that as a failed product-quality result. The passing route, unit and browser checks establish only their stated technical behaviors. A fresh recorded ordinary-input exchange also showed a pin count while the attacker knelt beside the defender, and ordinary attack guidance during the cover. See [the core gameplay review](CORE_GAMEPLAY_QUALITY_REVIEW.md).

The immediate priority is one coherent wrestling exchange: approach, contact, clinch, selectable throw, landing, recovery, physical cover and kickout. Establish shared two-wrestler interaction ownership, visible contact and phase-correct controls before further venue, move-count or spectacle expansion. The full open-world objective remains; its combat must first meet this standard. No new quality milestone is accepted merely because damage or victory counters advance.

## Product direction

FRWF is to become an **open-world style wrestling game**: inhabit a wrestler, explore memorable places, encounter other wrestlers, start or accept fights, improvise environmental spots, develop rivalries and return to the world after a bout. The ring is a destination within that world. Preserve instant local matches as a quick-play option.

The desired loop is **explore → discover a person or opportunity → choose a confrontation → wrestle with readable control → earn a meaningful result → continue exploring**. Match victory must not force the entire world to be rebuilt. Exploration should have breathing room; every nearby character should not instantly attack.

Working content direction, to be implemented and playtested: connect the Volt Dome to backstage/training space and an outdoor FRWF showground inspired by the supplied footage. Extend later into parking-lot and neighborhood venues only after the initial connected area is enjoyable. These locations are proposed content, not currently available maps.

The user's real wrestler photographs guide Chad's physique, attire and identity. Supplied videos are references for timing, weight, crowd response and future paired-animation work. The converted background clips and crowd/music assets are useful atmosphere; they do not constitute mocap or solve the wrestling controller.

## Initial review findings across the repository (historical baseline)

| Area | Current implementation and consequence | Next action |
| --- | --- | --- |
| Product shell | Vite/React menus lead to a match. Fresh setup is Singles. Online lobby is separate. | Add world entry and quick play as distinct flows once world state exists. |
| World/arena | One Volt Dome geometry contract, hard playable bounds, ring traversal and ringside props. No connected world. | Separate world/session state from encounter state; introduce connected authored regions and actual traversable entrances. |
| Movement/input | Camera-relative movement, automatic facing, Arcade approach assist, Technical directional moves, short command buffer. | Add exploration locomotion and explicit combat focus; preserve direction through camera changes. Fix recovery input before expanding controls. |
| Physics | Sixteen-body active ragdoll per wrestler; large runtime owns motors, grips, locomotion and recovery. React previously reapplied spawn/body options. | Preserve ownership; isolate support/recovery and paired throws behind independently verifiable controllers. |
| Combat | Thirty-nine authored moves, contact-driven local damage, throws, pinning, props and AI. Definition existence is not move certification. | Certify walk/stop/turn, jab, kick, clinch, body slam, get-up and pin first through ordinary controls. |
| Visuals | New skinned human assets follow physical segments. Thin/stretched anatomy and awkward airborne silhouettes remain visible. Replay has a legacy model path. | Match skeleton rest proportions, collider dimensions and joint anchors; tune paired grip/release poses, then unify replay. |
| Camera | Opponent-centered arena framing and optional broadcast cuts. | Player-follow exploration, optional combat lock and continuous framing through doors, ringside and interior spaces. No forced spectacle cuts during navigation. |
| Audio/media | Independent music/effects/crowd settings, original archive video and real crowd sample; synthetic effects remain. | Audit loudness and repetition by listening; tie crowd intensity to actual local encounters and environmental acoustics. |
| Assets/mocap | Reproducible CC0 MakeHuman mesh generator and provenance; no captured move library. | Fit canonical anatomy, add paired authored clips/markers, then ingest real footage through a documented mocap/cleanup process. |
| AI | Normal singles pressure reduced, other modes retain richer decision tree. | Encounter awareness, disengagement and fair recovery windows; world characters need schedules/roles before persistent rivalries. |
| Persistence | Local settings; match state in memory. No saved world progression. | Versioned world save, player position/checkpoint, encounter results and earned progression with recovery from invalid saves. |
| Online | Colyseus browser transport plus Node service and a simplified shared online simulation. | Prove physical/gameplay parity; do not expand networking around an incompatible local controller. |
| Cloudflare | Worker/DO rooms, D1/R2 scaffolding and separate API. Browser transport still Colyseus; production D1/R2 bindings absent. | Choose one online authority and complete configuration, preview integration, reconnect and load evidence before cutover. |
| Public contracts | Static routes exist, but old discovery said default Battle Royale and no runtime requests/backend code. | Correct public claims now; consolidate canonical host contracts with any eventual backend. |
| CI/release | Scheduled/manual browser suites plus auto-approval workflow. No ordinary-input suite in scheduled matrix. | Add the ordinary lifecycle/input journey to regression coverage; require checks on PRs/main and verify branch protection separately. |
| Accessibility/devices | Touch/gamepad/XR paths and motion/flash settings exist. | Physically test controllers/mobile; do not equate emulation or capability discovery with comfort/playability. |

## Ordered implementation and acceptance criteria

### 1. Recover a trustworthy wrestler

This blocks the first world release. Fix the known transform/rotation ownership bugs, then reproduce failures from real input in controlled scenarios. Distinguish a legal input that was interrupted from input lost by the engine; show the reason without burying the player in diagnostics.

Acceptance: stand without uncommanded falls, walk/run/stop/turn without sliding or stretching, distinct readable jab/kick, reliable close-and-clinch, visible lift/release/landing, recovery that returns control, and a completed pin/rematch. Run these in ordinary menus, not only a lab with staged positions. Record failures and repeatability rather than asserting an unmeasured 95% success rate.

The ordinary-input regression subsequently passed after correcting pose locking: the initial strike, jump, return to control, and following heavy strike executed. Chrome still showed excessive throw height and weak paired poses. A bounded shoulder-height lift now passes the physical landing test; broader browser verification is in progress. This is not yet acceptance of the overall wrestling experience.

### 2. Deliver the first connected world slice

Introduce `WorldSession` (player identity, current region, exploration/combat focus, persistent encounter results) separately from `MatchModel` (participants, local rules, resources, resolution). An encounter consumes participants from the world and returns them when resolved. Do not use a global match reset to cross a doorway.

Build a small connected playable space: existing arena/ringside → backstage training space → outdoor FRWF showground. Author real walkable geometry, collider/surface metadata, entrances, navigation bounds and safe spawn/checkpoints. Preserve one authoritative coordinate system and ownership of active bodies across boundaries. Load nearby region assets on intent; dispose distant decorative resources without deleting active encounters.

Exploration controls: follow the player, allow looking around, sprint and interact; explicit combat focus engages a reachable opponent. Leaving combat must have a clear, consistent rule. Context prompts should show the actual object/person/action, not always a pin or nearest-opponent command. Teach the basics in-world through a low-pressure training interaction with the same controls used everywhere else.

Acceptance: walk through all three connected areas, initiate and finish a bout, use an environmental prop, leave the encounter and continue exploring without a results-screen dead end, reload at a valid saved checkpoint, and recover safely if a region asset fails. Keyboard, touch and gamepad must have complete bindings. No fake map nodes or buttons advertising inaccessible places.

### 3. Give exploration purpose and wrestling depth

Add a small set of repeatable, authored encounters with distinguishable opponents and environmental opportunities. Progression should unlock moves, attire or new opportunities through recorded results; avoid invented activity feeds, arbitrary inflated counts and empty grinding. Rivalries must respond to actual encounters. Training should teach counters, carry/throw choices, ground control and environmental positioning without requiring a control encyclopedia.

Acceptance: several different approaches produce understandable outcomes; world results persist; players can choose the next activity without a mandatory fight; a rematch or return visit is appealing in actual playtesting.

### 4. Raise character and world quality together

Fit believable anatomy before adding surface detail. Match the canonical visual skeleton to physical contact landmarks; prevent shoulders, elbows, knees and hands stretching during paired moves. Give Chad a reviewed recognizable character treatment based on the supplied references. Add attire materials, face/hair detail, weight shifts and foot plants. Make grip contact, resistance, release, landing and selling visible at normal game speed.

World art should establish outdoor/indoor atmosphere with authored lighting, worn materials, readable silhouettes, crowds and reactive props. Use distance-based crowd/prop simulation budgets; an open world cannot activate sixteen-body rigs for every distant NPC. Camera motion and effects must reinforce player intent and respect reduced-motion settings.

Acceptance: captured views of walking, turning, clinch, slam, recovery and exploration demonstrate coherent anatomy and contact; sustained performance is measured on representative devices. Real mocap remains a separate pipeline milestone requiring actual usable clips and retargeting evidence.

### 5. Production services and multiplayer

Preserve Vercel frontend delivery. Use Cloudflare for the approved authoritative service path after resolving the current Colyseus/DO split. Share validated commands and encounter outcomes, enforce server authority, support reconnect and reject incompatible clients. Persist genuine progression/results. Keep platform credentials server-side; players receive scoped sessions. Provision and verify D1/R2 environments before claiming durable production behavior.

Acceptance: two browsers explore/join the intended experience with consistent outcomes; disconnect/reconnect/rematch, security, load, cleanup and rollback are demonstrated. Health, discovery, trace and cross-site capabilities reflect the services actually deployed. Do not publish a leaderboard from client-trusted results.

## This review's changes and evidence

- Fixed unstable fighter body metadata that caused React Rapier to reapply rotational locks. Kept spawn transforms immutable across solved-position publications.
- Stabilized loose-prop spawn transforms and dynamic prop/debris/barricade metadata.
- Added lifecycle regression coverage that checks all sixteen body metadata identities as well as spawn positions across movement/recovery renders and remounts.
- Corrected architecture and LLMS discovery to distinguish delivered local gameplay, optional Colyseus, separate Cloudflare implementation and future open-world scope.
- Added ordinary browser regressions for viewport sizing, paused Settings continuity and real WebGL context loss.
- `pnpm verify` passed lint, typecheck, 323 tests in 51 files and production build before the final documentation/browser-test additions; final rerun is recorded below.
- Ordinary Singles browser test: AI pursues and damages the idle player through physical contact; strike/jump/recovery sequence fails at the final heavy input (expires during recovery). This is a remaining product blocker, not a passing release gate.
- Chrome playthrough: game renders; attempted grapple/throw exchange is visible; pause → Settings retains physical bodies, health and match. Airborne anatomy/recovery still below the requested quality bar.

## Platform report and limits

Site purpose: open-world wrestling target, currently a local-first arena wrestling game. Product impact: physics lifecycle fixes and clearer truthful scope, with recovery and animation still unresolved. Route standard: no endpoint removed or new public mutation added. Discovery: LLMS files corrected. Trace/span, authentication and cross-site integrations: unchanged in this batch; no new integration certified. Deployment: no agent push or deployment performed. Other network sites were not changed or certified; their remaining route/auth/discovery/trace standardization needs independent per-site audits.

Next remediation: finish reliable physical recovery and canonical body fitting, implement the connected world/session slice, then build satisfying encounters and progression. Retain the larger infrastructure/mocap plan in ROADMAP.md, but treat this open-world product direction and the latest user feedback as the current priority.

## Latest gameplay-first objective and verification

The replacement execution objective read on 2026-09-08 prioritizes player experience over cross-repository extraction. Keep the open-world direction above. Investigate and reuse platform services where beneficial; do not make GameCore extraction a prerequisite for improving wrestling.

- The live root graph and base sitemap index were read. Their historical alias metadata identifies FRWF, GameCore, Games, Gamers and Spec, but is not current deployment proof. The local GameCore repository is presently a Quake companion application with player/community/proxy surfaces, not an established shared engine package. No cross-repository runtime dependency was introduced.
- Normal gameplay camera framing now measures actual articulated body bounds and reserves a viewport inset for HUD/limbs. Six projection tests cover standing, elevated throws and ringside landings in landscape and portrait. Chrome showed the airborne wrestler remaining visible.
- Pose authority now lets segments settle toward their intended world pose before locking. This also allows a standing wrestler to unwind after a hit and follow a changed facing direction. The pelvis must be upright before its roll/pitch lock engages.
- The physical torso recovery regression passes without an emergency reset. The ordinary Singles browser journey and idle-opponent contact journey both passed before the final bounded-lift change.
- The previous body-slam integration measured a 3.4424 m pelvis rise above standing height. The shoulder-height servo now passes the same actual-contact test with a required rise between 0.55 and 1.8 m; no exact new peak has been reported. Landing damage still requires the solved torso-to-mat contact.
- Character generation now applies trunk colors only to torso/thigh regions, preventing hand/finger/forearm vertices from inheriting clothing colors. Rebuilt hashed GLBs retain the existing provenance.
- All match modes wait for initial physical body registration before advancing the local match clock and AI. Decorative model loading still has a visible fallback.
- Latest local `pnpm verify`: lint, typecheck, 339 tests in 53 files, and production build passed. The expanded browser suite is still running; its first failure was an ambiguous existing fighter-signature selector matching both visible copy and an accessibility announcement. The selector now targets the exact visible text.

Outstanding product work remains substantial: improve paired body contact and anatomy, make the opening and recovery fair in repeated ordinary play, deliver a connected explorable world with encounter continuity, improve authored world/character detail, then validate the appropriate backend cutover and production player journey. No open-world completion, physical-device acceptance, or network-wide compliance is claimed.

## Mobile entry and ringside repair — 2026-09-08

The supplied phone screenshot exposed an actual navigation blocker: a broad CSS selector changed inset menu panels to relative positioning inside a root that hides overflow. Fighter select grew beyond the screen, making its start controls unreachable. Panels now keep a bounded viewport; on phones and short landscape screens the roster/details scroll while Back and Lock In remain visible. Dynamic viewport height and safe-area insets accommodate browser chrome.

The phone entry regression uses real taps at 375 × 640, asserts buttons are fully inside the viewport before any auto-scroll, selects Chad, starts a match, opens Settings, resumes with the same 32 physical bodies, and rotates to 812 × 375. This passed in Chromium and desktop WebKit with mobile emulation. Additional Chromium checks passed movement, touch action delivery, guard, paused-input rejection, match/rematch cleanup, viewport sizing and WebGL context-loss recovery. A loaded phone screenshot confirms Chad's model and visible Lock In controls. This is not physical iPhone testing.

Ringside lifting also revealed a separate physics fault: once a body rose above a height threshold, the rope controller treated it as leaving the ring and pulled it inward from the table. The runtime now remembers established ringside occupancy until actual ring re-entry. A regression failed before the fix (a lift at z = −6.1 was pulled to −2.99) and passes afterward. The rope spring still contains ring-origin falls, and explicit apron return still works.

Latest validation: `pnpm verify` passed lint, typecheck, 341 tests in 53 files and production build. All four targeted browser environmental checks passed: rope rebound/contact/knockdown, apron return, physical table collapse, and turnbuckle landing. Earlier interrupted table runs are superseded by this successful check. Manual Chrome inspection confirms the loaded character preview; longer gameplay, controller and physical-device evaluation remain open.

Platform impact: this repair preserves existing public routes, discovery files, auth boundaries and trace/span behavior. No cross-site integration or backend cutover was added or certified. Network-wide standardization still requires separate per-site verification.

Release evidence: code commit `0275e0c7c6702f76fa2321f0bb6706f4392374c2` is on `main` and `origin/main`. Deployment `dpl_8PeYUnLr1wkrmEFLPgpL3qrhWqfa` was built with production settings and automatic domain assignment disabled, passed the WebKit phone journey, and was then promoted. The canonical host and immutable deployment URL both report that exact commit in `/release.json`, with build timestamp `2026-09-08T06:00:32.679Z` and environment `production`. After promotion, Chromium and WebKit each passed the phone journey on `https://frwf.platphormnews.com`. The final local six-case match/mobile/render suite also passed after the ringside change.

Read-only canonical probes with `RUN_LIVE_INTEGRATION_TESTS=true` returned HTTP 200 for twenty standard public surfaces; structured JSON and feed/sitemap XML parsed successfully. MCP ping/tools-list preserved JSON-RPC IDs, and POST to the read-only route-compliance handler returned 405. These are reachability and format checks, not a complete platform certification: the extensionless static health/docs routes still return `application/octet-stream`, existing static health scores need an evidence audit, and trace export/authenticated backend integrations were not validated. Next platform remediation is accurate JSON response headers and honest health evidence, alongside the product priorities above.

## Connected showground pass — 2026-09-08

FRWF's first explorable world slice now connects the outdoor yard, backstage Corner School and ringside Main Event. `WorldSession` owns a separate, versioned device-local save (position, selected wrestler, visited areas and completed encounter records). Corrupt, incompatible and obstructed saves recover to a valid start; denied browser storage keeps the visit playable with an explicit unsaved status. These records are editable local progress, never a trusted leaderboard.

Walk to one of three hosts with keyboard, left stick or the phone joystick, inspect the nearby offer and start a bout. Combat currently transitions to the existing Volt Dome arena; returning restores the exploration position. Abandoning a bout awards no completion or win. Real match results update the local encounter record once. This is a connected exploration slice with instanced bouts, not seamless outdoor wrestling or a finished open-world game.

The yard adds textured grass, paths, picnic tables, a food truck, lockers, fencing, trees, ring ropes, signage and string lights. World geometry and the bounded wall-sliding movement solver share obstacle definitions. The distance-driven exploration gait uses the existing skinned wrestlers with lowered resting arms; arena combat retains the physical rig. This remains procedural animation and environment art, with substantial anatomy, animation and authored detail work ahead.

Easy rivals provide a five-second opening, slower decisions and fewer rapid grapple/counter choices without changing wrestler health or damage. Normal and Hard remain available. The phone exploration regression exposed a shared input defect: a stationary held joystick lost active status after 2.5 seconds. Held movement, sprint and guard now remain active until release or reset; the fix applies to both world exploration and matches.

Platform remediation: extensionless static health/docs/release routes declare JSON content types in Vercel configuration. Static health no longer claims a measured operational state or a fabricated 100 route score. LLMS/API discovery describes the delivered world slice and local-save boundary. Trace export, frontend auth and cross-site runtime dependencies are unchanged. Other network sites still require independent route/auth/discovery/trace verification.

The Cloudflare suite now bundles the Worker and executes real local workerd/Durable Object/D1/R2 integration checks: actual storage probes, empty leaderboards, protected room creation, distinct tickets, invalid socket rejection, trace identity, origin checks and JSON-RPC IDs/batch bounds. Installed Miniflare 5's supported v4-options converter bridges the harness configuration. This does not deploy Cloudflare, add missing production storage bindings, wire the browser transport or certify cloud multiplayer/save functionality.

Release checks and exact deployment identity are recorded in `docs/SHOWGROUND_RELEASE.md`. Next product work: improve paired wrestling animation and contact readability, author more satisfying encounters and environmental interactions, and extend the world beyond arena handoffs. Physical iPhone/controller play, motion capture, cloud identity/saves and authoritative online parity remain open.

## Circuit and physical venues pass — September 8, 2026

Implemented the next layer of the open-world wrestling direction: three physical combat venues, six explorable encounter hosts, device-local circuit reputation and mastery, encounter tracking, harder unlocked rivals, breakable wooden tables and Arcade-aware mobile labels. Venue rules now govern physical floor height, boundaries, rope/corner availability, AI traversal, camera and ground marker. See [the circuit release report](CIRCUIT_UPGRADE_RELEASE.md) for validation and limitations.

The next structural milestone is sharing the world scene and physical simulation so fights can begin without scene handoff. Character motion quality remains a separate major workstream: authored paired throws and recoveries need continued visual review before real human motion clips are introduced. Local progression must remain clearly separate from future account-backed progression and leaderboards.

## Wrestling motion and arena polish — FRWF 1.3.0

This pass addresses action/visual disagreement directly: the defender's authored half of paired grapples now reaches the physical motor controller; release profiles distinguish slams, backward suplexes, lateral throws and power drops; eight-way movement follows solved travel relative to facing; and a brief secured-clinch decision beat precedes the player lift. Release prompts use the actual physical phase. Contact effects preserve the 3D collision point instead of inventing a height.

The Volt Dome now has a continuous woven/scuffed branded canvas, padded corners, restrained rope lighting and articulated instanced crowd silhouettes. This is procedural physical animation and art; character fidelity, hand-placement tolerance, physical device acceptance and seamless world combat remain open. Validation and deployment evidence belong in `WRESTLING_POLISH_RELEASE.md`.

## Physical contact and Combat source integration — September 8, 2026

Implemented bounded arm control, legal elbow/wrist targets, zero-stamina supported recovery, tabletop support, fitted hit shapes, solved-contact confirmation, more muscular assets and five retargeted motion clips from the supplied Combat files. Chad's table recovery and the ordinary lift/slam/cover sequence are covered by recorded browser journeys. See [physical contact review](PHYSICAL_CONTACT_REVIEW_2026-09-08.md) for exact validation and limitations.

Continue with authored paired holds, throws and mat transitions, then activate suitable knockout/reaction clips after visual review. The weapon clips are not part of the unarmed move set. Online parity, seamless world simulation and physical-device acceptance remain unfinished; this increment is not a finished-game certification.


## Screenshot-driven anatomy and control correction — September 8, 2026

The supplied folded-waist and crossed-boot images led to new intermediate-frame checks, not just final-state checks. Physical spine/hip limits, parent-relative leg targets, non-crossing side steps, and coherent throw impulses now cover the full roster. The lab preserves the shipping human skin and selected rendering quality, releases scripted input when the player takes over, and uses actual fixed-step slow playback. Frozen shadows were removed after a recorded venue transition made the backstage room disappear.

The quality bar remains readable player-controlled wrestling. Continue with paired hand placement and authored mat-to-kneel-to-stand transitions; investigate frame sequences instead of treating a final upright flag or test count as visual certification. See [the physical contact review](PHYSICAL_CONTACT_REVIEW_2026-09-08.md) for validation and remaining multiplayer, device, animation and world-simulation gaps.
