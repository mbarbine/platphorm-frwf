# FRWF circuit and venue upgrade — 1.2.0

Site purpose: an open-world style wrestling game with explorable grounds, physical wrestling, original FRWF identity and local play on desktop and mobile.

## What changed

- Backyard Fight Pit and Backstage Fight Club are playable physical venues, alongside Volt Dome. Each has its own environment, floor, boundaries, table and spectators. Backyard adds grass, trees, canopy and string lights; backstage adds lockers and practical lighting. Crowd animation uses three instanced meshes.
- Ring-only physics, floor-height changes, rope traversal, corner prompts, AI apron logic, camera height and player ground markers respect the selected venue. Outdoor matches retain pinfalls, physical grapples and contact-driven damage.
- Wooden tables register as landing surfaces, react to accumulated stress and break into physical fragments. Chaos bouts add usable chairs and trash cans. Calling a table spot selects a slam rather than a corner move.
- Six encounter hosts: backyard warm-up, backstage fight club, The Claw's open challenge, Tables & trouble, The reversal test and Showground championship. The original three remain accessible. Two distinct wins unlock the two harder yard encounters; three unlock the championship.
- A local circuit board shows actual completed records, three mastery objectives, rank progress and encounter tracking. Reputation comes from unique wins and objective medals; repeated wins do not farm reputation. Results show circuit progress. Returning from a bout restores the exploration position.
- Old v1 saves retain their position and records. Optional medal fields are bounded and validated; existing winning records retain their victory objective; unavailable storage leaves play usable for the current visit. These records are editable local game progression, never a trusted leaderboard.
- Pinfall counts now occur at one, two and three full seconds. The kick-out window remains open until the third count; fresh rivals can escape early covers.
- Touch strike/grapple labels now follow Arcade versus Technical execution. Arcade advertises its actual suplex follow-up, and the physical lift phase displays Release throw. World objectives and venue information fit the mobile encounter dialog.

## Files changed

- `src/game/data/venues.ts`, `world/FightVenue.tsx`: venue profiles, floor and prop configuration, environment geometry and instanced crowd.
- `world/showground.ts`, `world/worldSession.ts`, `world/circuit.ts`, `world/WorldScene.tsx`, `world/ShowgroundEnvironment.tsx`: encounter circuit, persistence, navigation and world presentation.
- `physics/physicsRuntime.ts`, `systems/combat.ts`, `systems/contextResolver.ts`, `ai/utilityAI.ts`, `state/matchStore.ts`, `types/game.ts`: venue-aware wrestling simulation and lifecycle.
- `components/GameScene.tsx`, `components/CameraRig.tsx`, `components/Arena.tsx`, `src/ui/*`, `src/app/App.tsx`, `src/styles/global.css`: scene rendering, input labels, HUD, results and responsive UI.
- Unit, physical integration and browser tests; package/release manifest; architecture and public discovery.

## Validation

- `pnpm verify`: lint, TypeScript, 372 tests in 57 files, production build passed.
- `pnpm --dir cloudflare test`: three real local Miniflare Worker/DO/D1/R2 tests passed. This does not establish production Cloudflare bindings or browser transport parity.
- New Rapier integration: physical locomotion across the former rope line stays on the outdoor floor, without rope rebounds or emergency resets.
- New unit coverage: venue rematches, floor bounds, absent rope/corner actions, table-spot selection, outdoor pins, save compatibility, reward deduplication, unlock enforcement, reachable hosts and mobile labels.
- Six ordinary browser journeys passed: completed backyard bout and earned progression, Easy strike/jump controls, Normal AI pursuit/contact, desktop and phone world-to-yard entry/return, and the connected backstage/ringside route. The input test creates distance from a live rival before isolated controls; it does not freeze the AI.
- The corrected pin cadence passed a fresh complete-bout browser check. Table integration also demonstrated a solved torso-to-table manifold before damage and breakage, with no emergency reset.
- Chrome visual review covered the circuit board and world tracking. Screenshots covered desktop/phone backyard and backstage environments. Browser emulation is not a physical iPhone check.
- Early test attempts exposed legitimate live-AI interruptions in the isolated control sequence and an uppercase winner-text mismatch in the reward assertion. Those test issues were corrected; they are not reported as clean first-run results.
- Three additional browser checks passed after the pin fix: the complete backyard bout, paused settings preserving the physical world, and actual WebGL context-loss recovery.
- The root network graph and base sitemap index both returned valid public documents containing FRWF. This is discovery evidence, not portfolio-wide certification.
- The deployed build exposes its exact source identity at `/release.json`. Staged and canonical deployment checks are recorded in the accompanying task execution log.

## Platform contract impact

Public docs and LLMS discovery describe the actual three venues, six encounters, scene handoff and local progression. Existing standard routes, static health's honest unknown status, introspection-only MCP and public/protected boundaries are preserved. No new server mutation, secret, auth mechanism or trace export is introduced. Cloudflare transport remains separate from the optional Colyseus browser client. No DNS or Cloudflare binding changes are part of this pass.

## Known gaps and next work

Exploration and combat still use separate scenes; the game does not yet provide seamless combat across the full showground. Human motion capture, higher-fidelity character art, cloud saves, multiplayer parity and physical iPhone/controller acceptance remain open. The authored physics and automated playthroughs do not certify final animation quality, long-session stability or deep player satisfaction. Next work should focus on continuous world combat, more grounded paired throw/get-up animation, environmental collision quality and longer real-device play sessions. No network-wide claim is made: the rest of the 150-site portfolio was not audited or standardized by this game pass.
