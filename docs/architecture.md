# FRWF runtime architecture

Reviewed 2026-09-08. Product direction: an open-world style wrestling game. The current implementation combines bounded arena combat with a connected showground exploration slice and device-local continuity. See [the collective master plan](COLLECTIVE_MASTER_PLAN.md) for the implementation order and acceptance criteria.

## Delivered browser experience

Vercel serves a Vite/React application, not Next.js. `App.tsx` owns menus, local match setup, the optional online lobby, pause/settings and results. Fresh local setup selects Singles; five-wrestler Battle Royale remains available. Settings persist through optional localStorage. Match state is in memory. Bundled glTF characters, MP3 music/crowd and original FRWF archive videos load over HTTP; the old claim of no runtime network requests was incorrect.

The game scene loads lazily. Three and its loaders share one runtime chunk; Rapier WASM is separate. The current delivery remains substantial: the Rapier chunk alone is approximately 842 KB gzip. No service-worker world streaming is implemented; localStorage preserves showground position and records when available.

## Rules, physics and presentation

`systems/combat.ts` owns move legality, resources, AI, phases, pinfall and results. `state/matchStore.ts` bridges input, simulation and UI publication. Rules advance at 60 Hz alongside Rapier; ordinary UI publication is throttled. `physics/physicsRuntime.ts` owns bodies, joint motors, locomotion support, grips, contacts, props, landings and recovery. Local damage depends on physical evidence.

Each active wrestler has 16 dynamic rigid bodies and 15 joints. React supplies immutable spawn transforms and stable body metadata; publishing solved positions must not reapply spawn positions or rotational locks. The runtime changes rotational authority as moves and recovery require it. Loose props, table fragments and flexible barricades also need stable body metadata.

`HumanoidFighter.tsx` binds a skinned glTF character to solved segment transforms. The asset generator uses MakeHuman CC0 graphical data, with provenance in the asset manifest. This is a prototype human mesh, not a finished likeness or motion-captured wrestler. Character rest proportions, contact anatomy, paired throw alignment and recovery still need visible validation. Replay still has a separate legacy presentation path.

`PlayerController` supplies cancellable approach assistance for local Arcade grapples and pins. Technical controls retain directional move selection. A bounded action buffer records accepted, rejected and expired commands. Pausing clears pending actions. Rendering failures are surfaced through a scene boundary and a WebGL context interruption overlay; a compile or unit-test pass does not certify GPU recovery.

## World boundary

`data/arena.ts` defines one Volt Dome: ring, ringside floor, desk, steps, entrance and barricades. Physics and combat constrain positions to its playable bounds. Camera framing and targeting remain tied to active opponents. `MatchMode` contains Singles and Battle Royale only. A separate `game/world/WorldSession` owns exploration position and local encounter records. The showground connects yard, backstage and ringside through a shared obstacle map, with a following camera and nearby encounter offers. Offers hand off to instanced arena bouts and restore the world position afterward. Quest/reputation systems, seamless outdoor combat and region streaming remain unimplemented.

## Online and platform boundary

The browser's online client uses Colyseus. `server/` contains the Node Colyseus service; `packages/game-core` contains a simplified deterministic online simulation and `packages/game-protocol` its shared messages. This is distinct from the full local Rapier simulation. Online parity, reconciliation and production deployment must be verified independently.

`cloudflare/` contains a separate Worker/Durable Object implementation, scoped room tickets, D1 result persistence and R2 asset support. The browser is not connected to that transport. Its production environment does not yet declare D1/R2 bindings; no Cloudflare cutover is established by the presence of these files. Choose and prove one authoritative online path before removing the other.

The frontend ships static health, OpenAPI and discovery surfaces; the Worker has its own API/MCP/trace-header implementation. They must not imply that an undeployed Worker is serving the canonical frontend host. Platform credentials stay server-side. Trace export and a fleet-wide compliance certification are not established by this review.

## Verification boundary

Unit tests exercise rules and helpers; browser tests exercise real rendering and input. Lab scenarios are useful isolation tools but do not replace the ordinary menu-to-match journey. Ordinary-input and idle-opponent contact regressions passed in the preceding mobile/recovery repair. See the master plan and showground release report for current evidence; physical-device and final gameplay-quality acceptance remain open.
