// ──────────────────────────────────────────────────────────────────────────────
// Client → Server messages (validated by server before applying to simulation).
// All messages include a monotonically increasing sequence number so the server
// can detect duplicates, reorders, and stale commands.
// ──────────────────────────────────────────────────────────────────────────────

import type { FighterId, GameCommand, Ruleset, Difficulty } from './types.js';

/** Every message from the client includes a protocol version for rejection. */
interface BaseClientMessage {
  protocolVersion: string;
}

/** Fighter selected during the lobby/selection phase. */
export interface SelectFighterMessage extends BaseClientMessage {
  type: 'selectFighter';
  fighterId: FighterId;
}

/** Player signals they are ready to start the match. */
export interface ReadyMessage extends BaseClientMessage {
  type: 'ready';
}

/** Player input command — buffered, sequenced, deduplicated on server. */
export interface CommandMessage extends BaseClientMessage {
  type: 'command';
  command: GameCommand;
  direction: { x: number; z: number };
  running: boolean;
  block: boolean;
  /** Monotonically increasing client-side sequence number. */
  seq: number;
  /** Client-local timestamp for RTT measurement. */
  clientTimestamp: number;
}

/** Player votes for a rematch after the result is shown. */
export interface RematchMessage extends BaseClientMessage {
  type: 'rematch';
}

/** Player requests to pause (single-player only; ignored in multiplayer). */
export interface PauseMessage extends BaseClientMessage {
  type: 'pause';
  paused: boolean;
}

export type ClientMessage =
  | SelectFighterMessage
  | ReadyMessage
  | CommandMessage
  | RematchMessage
  | PauseMessage;

// ──────────────────────────────────────────────────────────────────────────────
// Server → Client messages
// ──────────────────────────────────────────────────────────────────────────────

/** Server acknowledges a processed command. Client uses this for reconciliation. */
export interface CommandAckMessage {
  type: 'commandAck';
  seq: number;
  serverTimestamp: number;
}

/** Server sends a compact match snapshot at the configured rate (~15–20 Hz). */
export interface SnapshotMessage {
  type: 'snapshot';
  seq: number;
  elapsed: number;
  hype: number;
  announcement: string | null;
  fighters: ReadonlyArray<{
    sessionId: string;
    health: number;
    stamina: number;
    momentum: number;
    posX: number;
    posZ: number;
    facing: number;
    velocityX: number;
    velocityZ: number;
    combatState: string;
    moveId: string;
    attackPhase: string;
    pinCount: number;
  }>;
}

/** Server broadcasts a significant impact event for client audio/effects. */
export interface ImpactEventMessage {
  type: 'impactEvent';
  impactId: number;
  kind: string;
  intensity: number;
  posX: number;
  posZ: number;
  moveId: string | null;
  region: string | null;
}

/** Server broadcasts match result. */
export interface MatchResultMessage {
  type: 'matchResult';
  winner: string; // sessionId
  method: 'PINFALL' | 'KNOCKOUT' | 'TIMEOUT';
  duration: number;
  hype: number;
  grade: 'D' | 'C' | 'B' | 'A' | 'S';
}

/** Server rejects a client's protocol version. */
export interface VersionRejectedMessage {
  type: 'versionRejected';
  serverVersion: string;
  minClientVersion: string;
}

export type ServerMessage =
  | CommandAckMessage
  | SnapshotMessage
  | ImpactEventMessage
  | MatchResultMessage
  | VersionRejectedMessage;
