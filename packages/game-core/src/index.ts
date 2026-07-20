/**
 * RINGFALL game-core — deterministic simulation layer.
 *
 * This package contains all game rules, move definitions, AI logic, and match
 * state management. It has zero dependency on React, Three.ts, Rapier, DOM
 * APIs, or browser storage. Both the browser client and the authoritative
 * Colyseus server import from here.
 *
 * ── CURRENT STATE ──────────────────────────────────────────────────────────
 * The game rules currently live in src/game/systems/combat.ts in the frontend
 * workspace. They are being extracted here incrementally. The single blocker
 * is the `BodyWorksContact` import from physicsRuntime — that type has been
 * replaced by `PhysicalContact` in game-protocol, allowing full extraction.
 *
 * ── EXTRACTION STATUS ──────────────────────────────────────────────────────
 * ✅ types/         — fully mirrored to game-protocol
 * ✅ utils/math     — pure, no dependencies
 * ✅ data/balance   — pure data
 * 🔄 combat/        — extraction in progress (see src/combat/)
 * 🔄 ai/            — extraction in progress
 * 🔄 physics/grapple — extraction in progress
 * 🔄 physics/body   — extraction in progress
 *
 * ── USAGE ──────────────────────────────────────────────────────────────────
 * import { createMatch, advanceMatch, requestCommand } from '@frwf/game-core';
 * import type { MatchModel, FighterRuntime } from '@frwf/game-core';
 */

// Re-export the protocol types that the rules layer operates on
export type {
  FighterId, Ruleset, Difficulty, FighterState, AttackPhase,
  MoveCategory, GameCommand, Vec2, PhysicalContact,
} from '@frwf/game-protocol';

// Utilities
export * from './utils/math.js';

// Data
export { BALANCE } from './data/balance.js';

// Deterministic server authority for online movement, attack windows, swept
// collider contact, resources, grapples, and match resolution.
export * from './onlineSimulation.js';

// Simulation API — the primary integration surface for both client and server
// TODO: uncomment as extraction completes
// export { createMatch, createFighterRuntime, advanceMatch, requestCommand } from './combat/combat.ts';
// export type { FrameInput, MatchModel, FighterRuntime } from './combat/types.ts';
