# FRWF collective master plan

Updated 2026-09-08 from the repository, the architecture proposal, the conversation, and another ordinary Chrome playthrough. This is the current ordering of the larger ROADMAP, not a declaration that its features have shipped.

## Product direction

FRWF is to become an **open-world style wrestling game**: inhabit a wrestler, explore memorable places, encounter other wrestlers, start or accept fights, improvise environmental spots, develop rivalries and return to the world after a bout. The ring is a destination within that world. Preserve instant local matches as a quick-play option.

The desired loop is **explore → discover a person or opportunity → choose a confrontation → wrestle with readable control → earn a meaningful result → continue exploring**. Match victory must not force the entire world to be rebuilt. Exploration should have breathing room; every nearby character should not instantly attack.

Working content direction, to be implemented and playtested: connect the Volt Dome to backstage/training space and an outdoor FRWF showground inspired by the supplied footage. Extend later into parking-lot and neighborhood venues only after the initial connected area is enjoyable. These locations are proposed content, not currently available maps.

The user's real wrestler photographs guide Chad's physique, attire and identity. Supplied videos are references for timing, weight, crowd response and future paired-animation work. The converted background clips and crowd/music assets are useful atmosphere; they do not constitute mocap or solve the wrestling controller.

## Review findings across the repository

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

Current blocker: the ordinary-input browser test still expires the heavy-strike press during a recovery transition. Chrome also shows awkward throw poses. Fixing React ownership was necessary but did not resolve these issues by itself.

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
