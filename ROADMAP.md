The current frontend stack is fundamentally viable. I would not replace React Three Fiber, Three.js, or Rapier now. Rewriting into Babylon.js, PlayCanvas, Godot Web, or Unity WebGL would consume months while preserving the hardest problem: converting player intent into readable wrestling.

The stronger path is:

* Keep Three/R3F for presentation.
* Keep Rapier for collision, contacts, props, ropes, and controlled ragdoll.
* Introduce a real skeletal animation layer using SkinnedMesh, AnimationMixer, reusable skeletons, retargeting, animation masks, and additive clips.
* Treat mocap as authored motion intent blended with physics—not as final world authority.
* Add Colyseus as a dedicated authoritative multiplayer game server. Its official framework provides rooms, matchmaking, state synchronization, reconnection, fixed-tick tutorials, monitoring, testing, and load-testing support.  
* Consider Nakama later only if FRWF needs persistent accounts, social systems, tournaments, inventories, leaderboards, and broader backend services. Its authoritative multiplayer engine is much larger operationally than FRWF presently needs.  
* Add glTF Transform to the offline asset pipeline for animation resampling, deduplication, pruning, mesh compression, texture compression, KTX2/Basis output, and repeatable GLB validation.  
* Use Playwright projects for device/browser matrices and its screenshot comparison support for bounded visual regression tests.  
* Keep Rapier, but stop asking raw ragdoll physics to create the wrestling performance. Rapier provides character-control and articulated-joint primitives, but the game must add intent, constraints, motor profiles, grip tasks, fall protection, and recovery logic around them.  

The important architectural correction is:

Animation communicates intent. Physics validates contact and consequence. Rules preserve playability.

Below is the complete coding-agent prompt I would use.

RINGFALL: CHAOS CIRCUIT

PLAYABILITY RECOVERY, MOCAP-READY ANIMATION, AUTHORITATIVE MULTIPLAYER,

XR, PHYSICS, GRAPHICS, BACKEND, TESTING, AND LONG-TERM PLATFORM OVERHAUL

You are the autonomous principal game engineer, technical director, gameplay
designer, character-animation engineer, physics engineer, multiplayer engineer,
backend engineer, XR engineer, technical artist, asset-pipeline engineer,
performance engineer, DevOps engineer, observability engineer, QA lead, and
release owner for:

RINGFALL: CHAOS CIRCUIT

Repository:

mbarbine/platphorm-frwf

Current active development branch:

feat/bodyworks-gold-master

Canonical production destination:

https://frwf.platphormnews.com

Current frontend package baseline:

* React 19
* TypeScript 6
* Vite 8
* Three.js
* React Three Fiber
* Drei
* Rapier
* React Three Rapier
* Zustand
* Vitest
* Playwright

Your mission is to turn the current promising but wonky physics prototype into a
highly playable, visually mature, responsive, supportable, multiplayer-ready,
XR-capable, mocap-ready browser wrestling game.

Do not perform a blind rewrite.

Do not assume a new engine automatically fixes gameplay.

Do not delete working features merely because they are difficult to integrate.

Do not add more breadth while the core wrestler-control loop remains unclear.

The project succeeds only when:

* movement is responsive
* attacks are visually unmistakable
* grapples look like physical control
* body slams are consistently excellent
* specials are fun to initiate and watch
* characters remain upright and intentional during ordinary play
* physics creates consequence rather than random chaos
* the camera preserves control
* multiplayer feels coherent
* backend operations are observable and supportable
* mocap can be imported and retargeted without redesigning the game
* graphics scale cleanly from mobile to premium desktop and XR
* humans voluntarily play another match

===============================================================================

1. PRODUCT NORTH STAR
    ===============================================================================

The player fantasy is:

“I am a professional wrestler controlling an athletic body.”

Not:

“I am steering a ragdoll.”

The core loop is:

MOVE
->
SQUARE UP
->
STRIKE
->
BLOCK OR COUNTER
->
GRAPPLE
->
ESTABLISH CONTROL
->
SELECT MOVE
->
LIFT
->
SLAM
->
TAUNT OR CLIMB
->
SPECIAL
->
PIN
->
REMATCH

Every architecture decision must support this loop.

The game must prioritize:

1. playability
2. responsiveness
3. animation readability
4. physical credibility
5. contact quality
6. camera clarity
7. multiplayer consistency
8. performance
9. visual quality
10. feature expansion

===============================================================================
2. TECHNOLOGY DECISION

Do not replace the frontend engine stack during this pass.

Retain:

* React
* React Three Fiber
* Three.js
* Rapier
* React Three Rapier
* Zustand
* Vite
* Vitest
* Playwright

Add only focused infrastructure.

Recommended additions:

Frontend and shared game code

* @colyseus/sdk
* zod
* @gltf-transform/core
* @gltf-transform/extensions
* @gltf-transform/functions
* @gltf-transform/cli
* meshoptimizer
* KTX2/Basis tooling required by the offline asset pipeline
* a lightweight structured logger
* OpenTelemetry packages only where they provide real diagnostics
* a schema-compatible binary message codec only if Colyseus Schema is
    insufficient for a specific high-frequency stream

Do not add:

* Redux
* another frontend state framework
* another 3D renderer
* another physics engine
* a second animation runtime
* a generic ECS solely because it is fashionable
* a heavyweight postprocessing suite before the gameplay loop passes

Authoritative multiplayer server

Create a dedicated Node.js TypeScript Colyseus service.

Suggested workspace:

apps/
  web/
  game-server/
packages/
  game-core/
  game-protocol/
  game-assets/
  test-harness/

If restructuring the current repository into a workspace creates excessive
risk, add:

server/
packages/

while preserving the existing frontend build.

Use Colyseus for:

* rooms
* matchmaking
* authoritative match state
* input commands
* server tick
* reconnection
* room lifecycle
* spectator sessions
* load testing
* server monitoring
* room logs

Do not run authoritative multiplayer inside Vercel serverless functions.

Vercel remains responsible for:

* static web delivery
* frontend previews
* public metadata
* documentation
* health-routing surface
* immutable frontend assets

Run the persistent game server on an appropriate long-running container or
managed game-server environment.

Support local Docker Compose.

Do not add Nakama in the first multiplayer milestone.

Design an adapter boundary so Nakama can be introduced later for:

* persistent accounts
* friends
* parties
* leaderboards
* tournaments
* inventories
* progression
* moderation
* bans
* durable social features

===============================================================================
3. MONOREPO AND SHARED CORE

Extract deterministic game rules from React, Three.js, and browser APIs.

Create:

packages/game-core/
  src/
    math/
    input/
    rules/
    moves/
    combat/
    stamina/
    momentum/
    grapples/
    match/
    simulation/
    replay/
    validation/

game-core must not import:

* React
* Three.js
* Rapier
* DOM APIs
* Web Audio
* browser storage
* Colyseus client code

It should own:

* fighter definitions
* move definitions
* legal states
* command validation
* phase progression
* stamina costs
* Momentum
* Hype
* guard
* counters
* pins
* knockouts
* match timer
* scoring
* deterministic AI intent
* event definitions
* replayable command history

Create:

packages/game-protocol/
  src/
    messages.ts
    roomState.ts
    schemas.ts
    version.ts

Protocol types must be shared between browser and server.

Validate every untrusted message.

===============================================================================
4. AUTHORITY MODEL

Use this authority pipeline:

LOCAL PLAYER INPUT
->
CLIENT COMMAND BUFFER
->
LOCAL PREDICTION
->
NETWORK COMMAND
->
SERVER VALIDATION
->
AUTHORITATIVE FIXED-TICK SIMULATION
->
AUTHORITATIVE EVENTS AND SNAPSHOTS
->
CLIENT RECONCILIATION
->
INTERPOLATED PRESENTATION

The server owns:

* match phase
* player membership
* selected fighter
* legal actions
* stamina
* health
* Momentum
* Hype
* guard state
* grapple ownership
* move phase
* move result
* contact acceptance
* pin state
* kickout result
* knockout
* props
* table state
* ring traversal state
* match result
* rematch readiness

The client owns:

* immediate local presentation
* local animation prediction
* camera
* sound
* particles
* HUD
* input collection
* cosmetic settings

The client may predict:

* movement intent
* guard entry
* attack anticipation
* grapple reach
* camera response

The client may not authoritatively decide:

* damage
* successful grapple
* successful counter
* successful pin
* knockout
* table break
* match result

===============================================================================
5. MULTIPLAYER SIMULATION STRATEGY

Do not attempt to synchronize the full articulated Rapier world bone by bone at
60 Hz.

Use a hybrid authoritative model.

The server simulates:

* canonical fighter root position
* canonical facing
* velocity
* high-level state
* move phase
* selected move
* grip state
* support state
* compact contact result
* compact reaction result
* prop root state
* critical environment state

The client simulates presentation:

* full skeleton
* active-ragdoll motor details
* secondary reaction
* cloth and hair
* particles
* camera
* mat response
* rope visual response

For important moments, synchronize compact physical descriptors:

interface PhysicalOutcome {
  eventId: number;
  actorId: string;
  targetId?: string;
  moveId: string;
  phase: string;
  impactPoint?: Vec3;
  impactNormal?: Vec3;
  impulse?: Vec3;
  targetLanding?: LandingClass;
  reactionClass?: ReactionClass;
  seed: number;
}

Use deterministic seeds to make client physical presentation similar without
sending every limb transform.

For replays, record authoritative roots and selected presentation bone samples.

===============================================================================
6. SERVER TICK AND CLIENT TICK

Use explicit clocks.

Recommended initial rates:

* server simulation: 30 Hz
* server snapshot/state patching: 15–20 Hz
* client gameplay physics: fixed 60 Hz
* render: device refresh rate
* remote interpolation delay: tuned between 80 and 140 ms
* command sequence numbers: monotonically increasing
* server acknowledgment: last processed client command

Do not hard-code these values throughout the project.

Place them in versioned network configuration.

Implement:

* input sequencing
* acknowledgment
* client prediction
* reconciliation
* interpolation
* bounded extrapolation
* stale-packet rejection
* duplicate-command rejection
* reconnection
* spectator join
* late join
* rematch
* room shutdown

===============================================================================
7. MATCHMAKING AND ROOMS

Initial multiplayer modes:

* private room by link
* Quick Match
* Practice with bots
* local single-player
* spectator join

Initial room size:

* two active wrestlers
* bounded spectators

Do not begin with four-way physics matches.

Room lifecycle:

1. create
2. join
3. fighter selection
4. readiness
5. match countdown
6. active match
7. result
8. rematch vote
9. next match
10. disposal

Support:

* reconnect grace period
* player replacement with AI after timeout
* spectator fallback
* room migration strategy documented
* version compatibility rejection
* safe room disposal

===============================================================================
8. BACKEND INFRASTRUCTURE

Create Docker support.

Required:

docker-compose.yml
docker/
  game-server.Dockerfile
  development.env.example

Local Compose services:

* game server
* Redis
* optional Postgres only when persistent accounts or durable results are added
* OpenTelemetry collector where used
* Prometheus-compatible metrics collector where practical
* development log viewer or documented log commands

Do not make Redis mandatory for one local room.

Support:

* in-memory local presence
* Redis production presence and room coordination

Production infrastructure requirements:

* persistent WebSocket support
* health checks
* readiness checks
* liveness checks
* graceful shutdown
* connection draining
* room shutdown protection
* structured logs
* metrics
* tracing
* region configuration
* secrets
* rate limiting
* DDoS-aware edge policy
* backup strategy for durable data
* versioned deployments
* rollback

Do not store secrets in the frontend.

===============================================================================
9. OBSERVABILITY

Instrument meaningful game behavior.

Metrics:

* active rooms
* active clients
* active spectators
* room creation rate
* join failures
* reconnect success
* command rate
* rejected commands
* server tick duration
* p50, p95, p99 tick duration
* snapshot size
* outbound bandwidth
* inbound bandwidth
* reconciliation count
* average correction distance
* match duration
* incomplete matches
* room crashes
* AI replacement rate
* rematch rate
* server memory
* event-loop lag

Client diagnostics:

* FPS
* p95 and p99 frame time
* physics step
* animation step
* render step
* network RTT
* interpolation delay
* snapshot age
* correction count
* correction magnitude
* asset load failures
* shader count
* texture count
* body count
* joint count
* grip count
* audio voices

Do not collect invasive personal data.

Do not expose internal diagnostics publicly by default.

===============================================================================
10. PLAYABILITY RECOVERY BEFORE MULTIPLAYER

Do not integrate live multiplayer until the local Toy Test passes.

The current issue is not network latency.

It is unclear local interaction.

Freeze feature expansion.

Local Gold Master requirements:

* stable combat stance
* responsive movement
* unmistakable punch
* unmistakable kick
* visible guard
* visible grapple
* excellent body slam
* readable fall
* readable recovery
* usable camera
* reliable keyboard controls
* reliable gamepad controls
* no random ordinary falling

Only after local Gold Master certification may multiplayer become a release
path.

===============================================================================
11. CHARACTER MOTOR MODEL

Do not let full free ragdoll own ordinary movement.

Use explicit physical-control levels:

LEVEL 0 — authored locomotion with physical contacts
LEVEL 1 — localized physical compliance
LEVEL 2 — active-ragdoll reaction
LEVEL 3 — protected physical fall
LEVEL 4 — downed active ragdoll
LEVEL 5 — knockout

Ordinary:

* idle
* walking
* running
* guarding
* striking
* grappling

must remain primarily intentional and motor-controlled.

Full-body loss of balance requires a reason:

* high impulse
* failed support
* severe fatigue
* counter
* throw
* environmental collision
* intentional move phase

Remove random collapse from normal roaming.

===============================================================================
12. ANIMATION STACK

Create a real skeletal animation system.

Use:

* SkinnedMesh
* shared humanoid skeleton
* AnimationMixer
* animation actions
* additive clips
* upper/lower-body masking
* motion-state graph
* transition rules
* animation events
* root-motion metadata
* retargeting helpers
* procedural IK overlays
* active-ragdoll motor targets

The animation system owns intent.

Rapier owns:

* contact
* prop collision
* external impulses
* rope collision
* falls
* landing
* controlled ragdoll response

Do not directly drive gameplay from AnimationMixer time.

Gameplay phases drive animation.

Animation events may notify:

* foot plant
* grip window
* active strike
* release
* landing anticipation

The game-rules layer remains authoritative.

===============================================================================
13. ANIMATION STATE MACHINE

Implement a data-driven state machine.

Primary layers:

Base locomotion

* idle
* combat idle
* walk forward
* walk backward
* strafe
* run
* brake
* pivot
* crouch
* climb
* downed locomotion

Upper body

* guard
* jab
* cross
* hook
* uppercut
* grapple reach
* grip
* prop hold
* taunt

Full body

* kick
* dodge
* counter
* lift
* slam
* suplex
* powerbomb
* fall
* get-up
* aerial
* finisher
* victory

Additive

* breathing
* fatigue
* pain
* impact
* facial expression
* weapon or prop recoil
* camera-facing head adjustment where appropriate

Define valid transitions.

Prevent:

* locomotion while pinned
* attack while defeated
* grapple while airborne
* climb while holding incompatible prop
* taunt while knocked out
* old animation action surviving rematch

===============================================================================
14. MOCAP-READY CANONICAL SKELETON

Define one canonical humanoid wrestling skeleton before recording mocap.

Document:

* joint hierarchy
* joint names
* coordinate system
* up axis
* forward axis
* unit scale
* reference pose
* bone roll
* hand orientation
* foot orientation
* root bone
* hips bone
* optional twist bones
* facial bones or blend-shape strategy
* prop sockets
* grip sockets
* collision-body mapping

Create:

docs/mocap/CANONICAL_SKELETON.md

Do not let each wrestler use an incompatible skeleton.

Fighter differences should come from:

* mesh
* proportions
* skinning
* materials
* accessories
* animation offsets
* physical profile

not an entirely different bone hierarchy.

===============================================================================
15. MOCAP CAPTURE STRATEGY

Prepare for real wrestler recording.

Create:

docs/mocap/CAPTURE_PLAN.md
docs/mocap/SHOT_LIST.md
docs/mocap/SAFETY.md
docs/mocap/NAMING.md
docs/mocap/INGESTION.md

Capture categories:

Locomotion

* neutral idle
* combat idle
* walk
* backward walk
* lateral walk
* run
* sprint
* pivot
* brake
* limp
* exhausted walk
* climb

Strikes

* jab
* cross
* hook
* uppercut
* forearm
* low kick
* front kick
* roundhouse
* high kick
* running strike
* ground strike

Defense

* guard
* block high
* block body
* block kick
* dodge
* counter
* grapple denial

Grapple

Record both performers simultaneously where possible:

* collar-and-elbow
* wrist control
* waist lock
* rear waist lock
* front facelock
* leverage struggle
* arm drag
* trip
* body slam
* side slam
* suplex
* German suplex
* spinebuster
* powerbomb
* Irish whip
* rope rebound
* turnbuckle control

Downed and recovery

* front fall
* back fall
* side fall
* protected bump
* back get-up
* front get-up
* side get-up
* kick-up
* exhausted recovery

Showmanship

* taunts
* turnbuckle taunts
* victory
* defeat
* pain
* breathing
* crowd acknowledgment

Aerial

Use professional safety procedures.

Capture intent and safe stunt references.

Do not require performers to create dangerous real impact for game data.

Use mats, stunt coordination, and separate motion segments where necessary.

===============================================================================
16. MOCAP FILE CONTRACT

Accept source formats through offline tools:

* FBX
* BVH
* GLB/glTF
* provider-specific exports converted offline

Runtime format:

* optimized GLB
* canonical skeleton
* animation clips
* no runtime FBX parsing
* no runtime BVH parsing for production play

File naming:

actor_move_variant_role_take_fps.ext

Example:

atlas_body-slam_clean_attacker_01_60fps.fbx
atlas_body-slam_clean_victim_01_60fps.fbx

Clip metadata:

interface MotionClipMetadata {
  id: string;
  moveId: string;
  role: 'actor' | 'victim' | 'solo';
  variant: string;
  sourceFps: number;
  duration: number;
  rootMotion: boolean;
  loop: boolean;
  contactMarkers: ContactMarker[];
  footPlants: FootPlantMarker[];
  gripMarkers: GripMarker[];
  releaseMarkers: ReleaseMarker[];
  impactMarkers: ImpactMarker[];
}

===============================================================================
17. MOCAP INGESTION PIPELINE

Create deterministic offline commands.

Suggested:

tools/mocap/
  inspect.ts
  normalize.ts
  retarget.ts
  clean.ts
  trim.ts
  mark-events.ts
  optimize.ts
  validate.ts
  report.ts

Pipeline:

1. ingest source
2. validate units
3. validate axes
4. normalize reference pose
5. retarget to canonical skeleton
6. remove unwanted translation
7. preserve intended root motion metadata
8. remove jitter
9. correct foot sliding
10. trim
11. create clip names
12. add gameplay markers
13. resample
14. deduplicate
15. prune
16. compress
17. generate manifest
18. generate validation report
19. export optimized GLB

Use glTF Transform in this offline pipeline.

Support:

* animation resampling
* pruning
* deduplication
* mesh optimization
* texture compression
* KTX2/Basis textures
* manifest generation
* deterministic hashes

Do not run expensive retargeting in the match runtime.

===============================================================================
18. MOTION RETARGETING

Build a retargeting adapter around the canonical skeleton.

Support:

* source bone mapping
* rest-pose correction
* limb-length compensation
* hip-height adjustment
* hand-placement correction
* foot-placement correction
* mirrored clips
* paired actor/victim alignment
* fighter-specific offsets

Retargeting must not blindly copy local rotations when:

* bone axes differ
* rest poses differ
* skeleton proportions differ

Validate:

* feet
* knees
* hips
* spine
* shoulders
* elbows
* wrists
* neck
* head

Create visual retargeting test scenes.

===============================================================================
19. MOTION MATCHING STRATEGY

Do not begin with a complex machine-learned motion-matching system.

First implement a deterministic feature-based clip selector.

Features:

* desired velocity
* actual velocity
* facing
* turn rate
* stance
* guard
* fatigue
* recent movement
* opponent direction
* distance
* current support
* move intent

Select from:

* starts
* loops
* stops
* pivots
* strafes
* transitions

Add inertial blending and pose continuity.

Only evaluate full motion matching after:

* enough mocap exists
* the clip database is large
* basic blending is proven
* performance is measured

===============================================================================
20. PAIRED MOCAP AND GRAPPLES

Store paired clips with shared alignment metadata.

A paired grapple definition needs:

* actor clip
* victim clip
* canonical relative transform
* hand anchors
* expected body contacts
* root-motion curves
* phase markers
* allowed physical deviation
* grip break thresholds
* alternate outcomes

Do not simply play two paired animations at fixed transforms.

Use phases:

1. acquire
2. align
3. establish grips
4. blend into paired motion
5. allow physical deviation
6. release
7. resolve physics
8. recover

During the controlled phase:

* animation provides target poses
* constraints maintain hand relationships
* physics remains active
* excessive error triggers safe failure

===============================================================================
21. BODY SLAM GOLD MASTER

The body slam remains the central release benchmark.

It must combine:

* player intent
* visible reach
* two-hand grip
* stance adjustment
* weight transfer
* leg drive
* mocap or authored lift
* active-ragdoll compliance
* victim protective motion
* release
* gravity
* actual mat contact
* ring response
* camera
* audio
* crowd
* immediate pin opportunity

Create clean variants:

* heavyweight
* lightweight
* fatigued
* near ropes
* environmental

The basic center-ring body slam must complete successfully at least 95% of valid
attempts.

Physics may vary:

* foot placement
* minor torso motion
* landing angle
* limb follow-through
* mat bounce

Physics may not routinely cause:

* failed lift
* random collapse
* head-first landing
* missed contact
* stuck grip
* body separation
* move ambiguity

===============================================================================
22. RESPONSIVE MOVEMENT CONTROLLER

Separate desired motion from physical reaction.

The player controller produces:

* desired velocity
* desired facing
* desired stance
* desired action
* desired target

The movement motor produces:

* root force
* facing torque
* foot goals
* animation selection
* balance correction

Ordinary movement must be stable.

Retune:

* acceleration
* braking
* turn rate
* combat spacing
* run speed
* backward speed
* lateral speed
* camera-relative basis
* soft opponent separation
* rope handling
* ringside handling

Add automated metrics:

* input-to-motion delay
* acceleration time
* stopping distance
* turn time
* position overshoot
* uncommanded fall count
* foot-slide distance

Release requirement:

* zero ordinary uncommanded falls across repeated neutral traversal scenarios

===============================================================================
23. INPUT ACTION SYSTEM

Replace scattered key checks with a formal action layer.

Create:

type GameAction =
  | 'move'
  | 'run'
  | 'quickStrike'
  | 'heavyStrike'
  | 'grapple'
  | 'guard'
  | 'counter'
  | 'jump'
  | 'interact'
  | 'context'
  | 'taunt'
  | 'pause';

Map:

* keyboard
* gamepad
* touch
* XR controllers
* network commands

through the same action system.

Each action includes:

* started
* held
* released
* timestamp
* sequence
* direction
* device
* consumed state

Implement:

* command buffering
* action priority
* context resolution
* rebindable controls
* device glyphs
* accessibility toggles
* hold/toggle options

Do not let UI directly invoke gameplay store mutations.

UI sends actions.

===============================================================================
24. CONTEXT RESOLVER

Formalize F and E behavior.

Context priorities:

finisher
pin
kickout
turnbuckle dive
turnbuckle climb
environmental move
ring traversal
stand opponent
drag opponent
ordinary interaction

Prop priorities:

swing held prop
throw held prop
drop held prop
pick up nearby prop
open or reposition prop

Show the resolved action in the HUD.

Do not allow:

* climb instead of finisher
* exit instead of pin
* prop pickup instead of contextual slam
* stale context after target moved

===============================================================================
25. XR ARCHITECTURE

Keep WebXR standards support.

Do not create a separate XR game.

Use the same:

* actions
* rules
* match
* networking
* fighters
* assets

Create XR-specific presentation and comfort adapters.

XR requirements:

* seated and standing options
* local-floor support
* recenter
* snap turn
* smooth turn option
* vignette
* teleport only where gameplay permits
* controller glyphs
* height calibration
* arm-reach calibration
* dominant hand
* comfort camera
* reduced shake
* reduced forced camera motion
* no unrequested cinematic camera takeover

Network XR as ordinary player intent.

Do not network controller transforms as the authoritative attack result.

Use controller movement to influence:

* target limb pose
* strike style
* guard
* taunt

while server rules validate actions.

===============================================================================
26. GRAPHICS PIPELINE

Move final characters and arena props toward optimized glTF.

Asset rules:

* canonical units
* canonical orientation
* bounded bone count
* bounded material count
* bounded texture count
* mesh LOD
* KTX2/Basis textures
* meshopt or Draco where measured
* no runtime remote assets
* deterministic manifest
* integrity hashes
* safe fallback
* preloading
* shader prewarming

Create asset budgets.

Example fighter budget:

* close LOD: bounded triangle count
* medium LOD
* far LOD
* one shared skeleton
* limited materials
* compressed textures
* optional facial blend shapes
* bounded animation memory

Do not load every fighter’s full animation library before fighter selection.

Preload:

* selected fighter
* opponent
* core arena
* core moves

Stream optional:

* alternate cosmetics
* replay-only assets
* non-selected fighters
* higher-quality crowds
* XR extras

===============================================================================
27. ARENA AND VISUAL QUALITY

Upgrade The Volt Dome using:

* improved ring materials
* apron
* ropes
* turnbuckles
* steps
* desk
* props
* barricades
* stage
* tunnel
* lighting truss
* crowd tiers
* scoreboard
* roof structure
* background architecture
* haze
* original branding

Preserve gameplay collision.

Use visual LOD.

Use instancing.

Use effect pools.

Do not add full-scene expensive postprocessing until measured.

Prefer:

* strong lighting
* good materials
* silhouettes
* restrained fog
* local impact effects

over expensive blur and bloom.

===============================================================================
28. NETWORKED PHYSICS RULES

Do not replicate every Rapier object equally.

Classification:

Authoritative gameplay objects

* fighters
* held props
* active props involved in combat
* table state
* ropes’ gameplay state
* ring traversal
* critical debris only when it can affect play

Client-presented cosmetics

* small debris
* dust
* particles
* canvas ripple
* crowd animation
* secondary prop fragments
* camera shake
* sparks

Server prop synchronization:

* object ID
* owner
* position
* rotation
* velocity
* state
* durability
* held status
* sequence

Use server validation for:

* pickup
* drop
* swing
* throw
* hit
* table break

===============================================================================
29. REPLAY AND MATCH RECORDING

Record command and event streams.

For each match retain bounded:

* room metadata
* seed
* fighter selections
* commands
* authoritative events
* snapshots
* result
* version
* optional highlight transforms

Use cases:

* instant replay
* bug reproduction
* desync investigation
* moderation
* performance testing
* regression fixtures

Do not retain personally identifying data unnecessarily.

Create deterministic replay fixtures for:

* jab
* block
* grapple
* body slam
* counter
* turnbuckle
* finisher
* table break
* disconnect
* reconnect

===============================================================================
30. TESTING PYRAMID

Level 1 — Pure unit tests

Test:

* move legality
* phase transitions
* resource costs
* context priority
* grapple selection
* pin
* knockout
* server message validation
* interpolation math
* reconciliation math
* mocap metadata
* asset manifests

Level 2 — Headless simulation

Run game-core without rendering.

Test:

* complete match
* AI match
* command replay
* server ticks
* reconnect
* rematch
* room disposal

Level 3 — Headless Rapier scenarios

Test:

* standing
* movement
* strikes
* block
* grips
* slam
* fall
* get-up
* props
* ropes
* reset

Level 4 — Renderer integration

Test:

* skeleton loading
* animation mapping
* mocap clips
* retargeting
* LOD
* shaders
* asset cleanup

Level 5 — Browser E2E

Use Playwright projects for:

* Chromium desktop
* Firefox desktop
* WebKit desktop
* laptop
* tablet
* phone landscape
* phone portrait
* reduced motion
* performance tier
* quality tier

Level 6 — Multiplayer E2E

Launch:

* real game server
* two browser contexts
* spectator
* disconnect
* reconnect
* rematch

Level 7 — Load tests

Use Colyseus load-testing tools and custom scripts.

Test:

* room creation
* concurrent rooms
* client join
* command traffic
* reconnect storms
* room disposal
* long matches
* memory growth
* tick health

Level 8 — Human playtesting

Mandatory.

===============================================================================
31. PHYSICS TESTING STRATEGY

Physics-based games require invariants, scenarios, distributions, and soak tests.

Do not expect exact identical floating-point transforms across every browser.

Test invariants:

* no NaN
* no world escape
* no joint leak
* no grip leak
* no unbounded velocity
* no uncommanded neutral fall
* action completes
* landing class is valid
* cleanup returns counts to baseline
* result is legal

Use statistical gates:

* 100 body slams
* 100 blocks
* 100 grapple acquisitions
* 100 recoveries
* 1,000 movement starts and stops
* 50 complete matches
* repeated seeds
* small randomized starting variations

Store failing seeds.

Provide a one-command reproduction.

===============================================================================
32. VISUAL REGRESSION TESTING

Use deterministic visual scenarios.

Capture:

* every fighter
* every stance
* every main strike
* guard
* grapple
* body-slam phases
* major moves
* turnbuckle
* arena
* props
* effects
* HUD
* mobile

Do not use screenshot comparison alone.

Also validate:

* skeleton loaded
* animation active
* expected body part moved
* expected contact marker fired
* expected camera mode
* expected model visible

Keep visual-diff tolerances appropriate for GPU differences.

===============================================================================
33. PERFORMANCE TESTING

Create performance profiles:

* desktop quality
* desktop balanced
* integrated GPU
* mobile
* XR

Measure:

* CPU frame
* GPU frame where available
* physics step
* animation update
* skinning cost
* draw calls
* triangles
* textures
* shader programs
* rigid bodies
* joints
* active grips
* audio voices
* heap
* garbage collection
* network RTT
* snapshot age
* server tick

Scenarios:

* neutral match
* intense grapple
* repeated slams
* props
* table break
* crowd peak
* replay
* multiplayer
* XR

Set budgets.

Fail CI on major structural regressions.

Do not claim physical-device performance from emulation alone.

===============================================================================
34. BUILD AND BUNDLE STRATEGY

The current Vite build reports very large chunks.

Do not merely raise the warning threshold.

Split:

* core menus
* game scene
* Rapier
* XR
* Physics Lab
* replay viewer
* advanced crowd
* mocap development tools
* multiplayer client
* non-selected fighter libraries

Preload intentionally after user interaction.

Do not create a first-use hitch when:

* first punch lands
* first grapple starts
* first slam lands
* first table breaks
* first replay runs

Prewarm:

* core shaders
* core fighter clips
* effects
* mat response
* ropes

===============================================================================
35. CI/CD

Create separate workflows:

Frontend verification

* install
* lint
* typecheck
* unit tests
* build
* asset validation
* Playwright smoke
* bundle budget

Server verification

* lint
* typecheck
* unit tests
* room tests
* protocol tests
* Docker build
* load-test smoke

Integration

* start Redis
* start game server
* start frontend
* run multiplayer E2E
* run reconnect
* run rematch
* archive traces and videos

Scheduled soak

* long AI soak
* multiplayer room soak
* memory soak
* physics soak
* performance report

Do not deploy production from an unverified branch.

===============================================================================
36. SUPPORTABILITY

Add operator documentation:

docs/operations/
  local-development.md
  environments.md
  deploy-frontend.md
  deploy-game-server.md
  rollback.md
  incidents.md
  room-debugging.md
  desync-debugging.md
  asset-failures.md
  performance.md
  xr-support.md
  mocap-pipeline.md

Add support tools:

* room inspector
* player/session lookup
* active-room list
* room event timeline
* match replay download
* server version
* client version
* disconnect reason
* kicked reason
* rejected-command reason
* safe room termination
* no direct mutation without audit log

Do not expose these tools publicly without authentication.

===============================================================================
37. SECURITY

Validate:

* room options
* fighter ID
* move ID
* command sequence
* direction
* timestamp
* prop ID
* target ID
* rematch vote
* player name
* version
* authentication token when introduced

Rate-limit:

* join
* room create
* commands
* chat when introduced
* spectator requests

Reject:

* impossible phase
* impossible speed
* impossible position
* invalid target
* duplicate command
* stale command
* future command
* invalid resource state
* oversized payload

Do not trust client damage.

Do not trust client match result.

===============================================================================
38. PERSISTENCE ROADMAP

Phase 1 multiplayer needs no required account.

Use anonymous signed sessions.

Later optional account layer may support:

* display name
* cosmetics
* settings
* match history
* favorites
* moderation
* leaderboards
* achievements

Introduce Nakama or a custom persistence service only when these features are
approved.

Do not make account creation block playing.

===============================================================================
39. IMPLEMENTATION ORDER

Follow this order.

Phase 0 — Stabilize local play

* baseline
* uncommanded-fall diagnostics
* input/action layer
* context resolver
* locomotion
* attack readability
* grapple readability
* body-slam Gold Master
* camera
* Toy Test certification

Phase 1 — Shared deterministic core

* extract rules
* protocol
* command model
* replay model
* deterministic tests

Phase 2 — Skeletal animation foundation

* canonical skeleton
* final wrestler rig
* AnimationMixer
* state machine
* masking
* IK overlays
* active-ragdoll targets
* current authored clips migrated

Phase 3 — Asset pipeline

* glTF Transform
* manifests
* KTX2
* mesh compression
* LOD
* validation
* preload strategy

Phase 4 — Mocap readiness

* documentation
* retargeter
* importer
* paired-clip schema
* clip markers
* validation tools
* sample synthetic or available test clips

Do not claim real mocap complete until real recordings exist.

Phase 5 — Local graphics and arena

* mature fighters
* attire
* faces
* arena
* crowd
* props
* effects
* performance tiers

Phase 6 — Multiplayer server

* Colyseus service
* room lifecycle
* schemas
* commands
* fixed tick
* bots
* reconnection
* spectator
* Docker
* Redis

Phase 7 — Client multiplayer

* client connection
* prediction
* reconciliation
* interpolation
* remote animation
* remote physical outcomes
* lobby
* private links
* Quick Match

Phase 8 — Multiplayer certification

* two-browser match
* disconnect
* reconnect
* spectator
* rematch
* load test
* soak
* server metrics

Phase 9 — XR integration

* shared action system
* comfort
* calibration
* multiplayer XR
* device testing

Phase 10 — Supportability

* operators
* telemetry
* replay
* debugging
* incident docs
* rollout
* rollback

Do not parallelize later phases in ways that destabilize the local Gold Master.

===============================================================================
40. LOCAL GOLD MASTER RELEASE GATES

Require:

* zero uncommanded neutral falls
* unmistakable jab
* unmistakable kick
* physical guard
* visible grapple
* basic body slam succeeds at least 95%
* no stuck grip
* physical recovery succeeds at least 95%
* climb succeeds
* aerial works
* finisher works
* pin works
* rematch cleanup passes
* keyboard passes
* gamepad passes
* touch passes
* Toy Test retains testers for ten minutes
* humans choose rematch

===============================================================================
41. MULTIPLAYER RELEASE GATES

Require:

* two players join
* distinct stable identities
* same match state
* input sequence validation
* movement prediction
* bounded reconciliation
* strike result consistency
* grapple ownership consistency
* body-slam outcome consistency
* prop ownership consistency
* pin consistency
* knockout consistency
* result consistency
* reconnect
* spectator
* rematch
* no room leak
* no server tick runaway
* no client crash
* version mismatch rejected cleanly

Measure:

* RTT
* correction magnitude
* server tick
* patch size
* bandwidth
* memory
* rematch retention

===============================================================================
42. MOCAP RELEASE GATES

Before accepting a mocap clip:

* canonical skeleton matches
* scale matches
* axes match
* root behaves correctly
* foot plants marked
* contact markers marked
* grip markers marked
* clip trimmed
* jitter acceptable
* no invalid joint rotation
* retargeting works on all five fighters
* compressed asset budget passes
* animation cleanup passes
* game phase alignment passes

Before accepting paired wrestling mocap:

* actor and victim remain aligned
* hands reach target anchors
* feet remain plausible
* physical grips can replace purely visual pairing
* release marker is correct
* landing remains physics-authoritative
* safe failure path exists

===============================================================================
43. FINAL FAILURE CONDITIONS

Do not declare completion if:

* local controls remain unclear
* wrestlers still roam and fall randomly
* punches and kicks look similar
* grapples remain visual proximity
* basic slam is unreliable
* animation hides physics mismatch
* physics overpowers player intent
* multiplayer sends full skeletons every frame
* server trusts client damage
* Vercel is used as a persistent WebSocket game server
* real-time server has no graceful shutdown
* reconnect is absent
* rematch creates new fragmented groups
* mocap pipeline has no canonical skeleton
* runtime loads raw FBX files
* optional assets block control
* game server cannot run in Docker
* no operator diagnostics exist
* load testing is absent
* XR has forced camera cuts
* mobile becomes unreadable
* large chunks are merely ignored
* tests pass but humans do not choose rematch

===============================================================================
44. FINAL VERIFICATION

Frontend:

corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:playability
pnpm test:ai-soak
pnpm test:soak
pnpm build
pnpm test:e2e

Server:

pnpm --filter game-server lint
pnpm --filter game-server typecheck
pnpm --filter game-server test
pnpm --filter game-server build

Integration:

docker compose up --build -d
pnpm test:multiplayer
pnpm test:reconnect
pnpm test:multiplayer-soak
pnpm test:load-smoke

Asset pipeline:

pnpm assets:inspect
pnpm assets:validate
pnpm mocap:validate
pnpm mocap:build

Verify this complete story:

OPEN GAME
→ PLAY LOCALLY
→ MOVE
→ PUNCH
→ KICK
→ BLOCK
→ GRAPPLE
→ BODY SLAM
→ CLIMB
→ SPECIAL
→ PIN
→ REMATCH
→ CREATE MULTIPLAYER ROOM
→ SHARE LINK
→ SECOND PLAYER JOINS
→ COMPLETE MATCH
→ DISCONNECT
→ RECONNECT
→ SPECTATE
→ REMATCH

===============================================================================
45. FINAL REPORT

Return:

* branch
* final commit
* frontend architecture
* server architecture
* shared-core architecture
* retained libraries
* added libraries
* rejected library alternatives and reasons
* input-system changes
* locomotion changes
* uncommanded-fall results
* animation architecture
* canonical skeleton
* mocap tooling
* retargeting results
* body-slam results
* local playtest results
* multiplayer design
* server tick metrics
* reconciliation metrics
* bandwidth
* load-test results
* reconnect results
* XR results
* mobile results
* asset-pipeline results
* bundle results
* performance
* observability
* deployment URLs
* rollback
* incomplete future work

Do not claim real mocap completion if no real wrestlers were recorded.

Do not claim multiplayer production-ready without load, reconnect, soak, and
operator evidence.

Do not claim playability fixed without human playtest evidence.

Begin now.

First recover the local wrestler-control fantasy.

Then establish the canonical animation and mocap pipeline.

Then extract deterministic shared rules.

Then add authoritative multiplayer.

Then add persistent support infrastructure only where the game genuinely needs
it.

The game must remain fun first.

The most consequential recommendation is to avoid replacing the rendering stack and instead replace the current presentation architecture. The existing stack can support the target; the missing layer is a canonical skeleton, structured animation state machine, controlled physics blending, authoritative multiplayer boundary, and serious test infrastructure.