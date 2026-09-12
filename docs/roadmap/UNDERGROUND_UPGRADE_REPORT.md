# Underground, originals and gameplay baseline — September 12, 2026

## Site purpose and scope

FRWF remains a local-first browser wrestling game with an explorable showground. This increment expands playable content and repairs specific interaction defects. It does **not** close the movement, striking, recovery or character-art quality work. The user's September 12 screenshots remain failed visual acceptance evidence: bent/inverted boots, unstable carrying, stiff strikes and unfinished likenesses.

## Product changes

- FRWF Underground is selectable in match setup and reachable through a showground encounter. Twelve of the 45 supplied venue models are imported with hashed files and shared textures: chair, table, trash can, brick wall, column, beam, gate, banner, crate, work light, bleachers and speakers. Decorative architecture is not a claim of climbable scenery.
- Nineteen selectable wrestlers, including Josh, Chelsea Whiplash, Britt Bash, Beer Bandit Bill and Beer Bandit Ted. Each has a movement profile, quick-strike sequence, taunt pose and named signature based on existing physical move families. Josh and the newest four explicitly use provisional shared models. Their likeness, outfit and bespoke animation delivery remains open. Bill and Ted's challenges are singles; team identity does not imply tag-team mechanics.
- Eleven local showground encounters. Fifteen original supplied images are preserved unedited in `public/archive`, with SHA-256 provenance records and an in-game historical archive. Historical tournament notices and flyers do not control current results or advertise current events.
- One original procedural push mower in the showground at x=4, z=15 launches `https://lawnmower.platphormnews.com` inside an iframe. FRWF pauses and checkpoints its own position. Closing removes the iframe and resumes exploration. No separate-tab launch, API key, shared score claim or remote save integration.
- Battle royale traversal and object climbing no longer reject an uninvolved wrestler merely because two other wrestlers are grappling.
- Climbing has gravity-compensated vertical drive and physical stage advancement. The old per-frame upward velocity cap could not overcome gravity. Table climbing uses an intact table's actual surface height.
- Knockdown releases held props. Dropping no longer launches a weapon as if thrown. Throws use the requested direction. Pickup approaches the actual grip anchor before attaching, reducing the old half-metre joint snap. Carrying, swings and acquisition still require additional dynamic-body and visual acceptance.

## Lab and baseline

The lab now includes selected-character special, quick chain, mixed punch/kick, ring exit, table climb, pickup/carry/drop and pickup/aim/throw scenarios. A rules selector permits Chaos props. Scenarios use shipping keyboard events and fixed simulation time after fixture setup. Export baseline JSON records release, pair, seed, venue, scenario, signature and bounded samples of state, move, speed, support feet, uprightness, foot height and damage.

This is baseline version 1, not the completed lab overhaul. Physical-controller hardware is unverified. The export explicitly says visual acceptance is unassessed; telemetry cannot approve a folded boot. Synchronized intended/solved/skinned comparisons, complete action/contact timelines, export replay and automatic visual gates remain planned. Fixtures that arrange a vulnerable target for a special are setup, not proof of earning a special during a bout.

## Files changed

Roster/protocol: `packages/game-protocol/src/types.ts`, fighters, styles, portraits, visuals, choreography, character manifests/material aliases and provisional asset tooling. Gameplay: context resolver, combat, physics runtime, prop release helper, input bindings and match store. World/UI: App, FighterSelection, venues, FightVenue, UndergroundSet, WorldWrestler, WorldScene, showground, FrwfArchive, LawnmowerActivity and PhysicsLab. Assets: `public/venue/completion`, `public/archive`. Verification: undergroundUpgrade, upgradeBaseline, contextResolver, physicsRuntime integration, roster/contract tests, and mower-archive browser journey.

## Verification and evidence boundaries

- Production build (`pnpm build`) passes after correcting `WorldWrestler` to pass the existing `fighter` parameter.
- `pnpm test`: 732 tests passed across 76 files after prop-release corrections. This includes rules/asset/input checks and existing physics tests, not 732 visual playtests.
- `pnpm lint`: passed before the final lab rules-selector edit; final check recorded in the task response.
- Earlier targeted physical corner ascent: ordinary context command reached all three stages with no emergency reset. The fixture does not certify every real corner/rope collision or table interaction.
- Lawnmower HTTPS returned 200 with no frame-blocking header in the inspected response. Actual iframe journey result is recorded below when complete.
- No production deployment, DNS change, certificate repair or authenticated integration was performed in this increment. The user has been committing concurrently; source availability is not deployment proof.

## Platform impact

Discovery reports updated encounter/roster scope and preserves honest local-save/online limitations. Existing standard routes, auth boundary and trace behavior remain intact. No key read, copy or exposure was needed. Lawnmower is a fixed trusted-origin public game embed; no arbitrary URL proxy or shared privileged channel was added. No other portfolio sites were modified or certified. Cross-site trace propagation and shared progression for the embed remain unimplemented.

## Next remediation tasks

1. Establish visual baselines for neutral walk/run/stop, lateral/backward motion, jab/kick recovery and holding a chair across representative body types. Fix solver-to-skin foot/ankle and shoulder alignment; do not only tune gait coefficients.
2. Expand physical prop acceptance to acquisition timeout, mass compensation, two-hand support, swing contact, interrupted throws, drops and recovery. No floating chair or body drag is acceptable.
3. Complete lab timelines, controller mapping replay, actual hardware tests and skin/solver overlays. Keep existing failing screenshots beside new captures.
4. Finish Josh/Chelsea/Britt/Bill/Ted models and attire; replace provisional aliases only after asset and visual checks.
5. Improve showground scenery/crowd and integrate the remaining 33 source models in measured batches. Preserve the real FRWF backyard direction.
6. Verify final production release and canonical host separately after gameplay acceptance; do not confuse an uploaded build with a completed gameplay overhaul.
