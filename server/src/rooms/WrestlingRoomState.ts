import { Schema, type, MapSchema } from '@colyseus/schema';

// ──────────────────────────────────────────────────────────────────────────────
// Colyseus schema classes for the wrestling room.
// These are automatically delta-encoded and synchronized to all clients.
// Keep them lean — only data clients genuinely need every patch interval.
// ──────────────────────────────────────────────────────────────────────────────

export class FighterStateSchema extends Schema {
  /** Which fighter definition this player selected. */
  @type('string') definitionId: string = 'atlas';

  // Resources
  @type('number') health: number = 100;
  @type('number') stamina: number = 100;
  @type('number') momentum: number = 0;

  // Position (2D ring plane — Y is owned by client physics)
  @type('number') posX: number = 0;
  @type('number') posZ: number = 0;
  @type('number') facing: number = 0;
  @type('number') velocityX: number = 0;
  @type('number') velocityZ: number = 0;

  // Combat state — string to survive schema evolution
  @type('string') combatState: string = 'idle';
  @type('string') moveId: string = '';
  @type('string') attackPhase: string = '';

  // Pin state
  @type('number') pinCount: number = 0;
  @type('boolean') finisherPrimed: boolean = false;

  /** Last acknowledged client input sequence. Used for reconciliation. */
  @type('number') lastCommandSeq: number = 0;
}

export class MatchRoomStateSchema extends Schema {
  /** Room lifecycle phase. */
  @type('string') phase: string = 'lobby';

  // Match state
  @type('boolean') resolved: boolean = false;
  @type('number') elapsed: number = 0;
  @type('number') hype: number = 8;
  @type('string') announcement: string = 'RINGFALL — CHAOS CIRCUIT';
  @type('number') announcementTimer: number = 2;
  @type('string') ruleset: string = 'standard';
  @type('string') difficulty: string = 'normal';

  // Result (set on resolution)
  @type('string') winnerSessionId: string = '';
  @type('string') winMethod: string = '';

  // Deterministic seed for synchronized AI/chaos decisions
  @type('number') seed: number = 1337;

  // Per-fighter state map: sessionId → FighterStateSchema
  @type({ map: FighterStateSchema }) fighters = new MapSchema<FighterStateSchema>();

  // Role map: sessionId → 'player1' | 'player2' | 'spectator'
  @type({ map: 'string' }) roles = new MapSchema<string>();

  // Rematch vote map: sessionId → boolean
  @type({ map: 'boolean' }) rematchVotes = new MapSchema<boolean>();

  @type('string') serverVersion: string = '1.0.0';
}
