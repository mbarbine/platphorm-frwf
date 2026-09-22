/**
 * RINGFALL game-core — deterministic simulation layer.
 *
 * This package contains game rules, move definitions, AI logic, and match
 * state management for deterministic online simulation. It has zero dependency
 * on React, Three.js, Rapier, DOM APIs, or browser storage. Both the browser
 * client and the authoritative Colyseus/Cloudflare servers import from here.
 *
 * ── USAGE ──────────────────────────────────────────────────────────────────
 * import { createOnlineMatch, applyOnlineAction, stepOnlineMatch } from '@frwf/game-core';
 * import type { OnlineMatchState, OnlineFighterState, OnlineImpact } from '@frwf/game-core';
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
