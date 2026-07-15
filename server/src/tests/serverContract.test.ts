import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';
import { SERVER_CONFIG } from '../config';
import { FighterStateSchema, MatchRoomStateSchema } from '../rooms/WrestlingRoomState';

describe('authoritative server contract', () => {
  it('uses the documented fixed simulation and snapshot rates', () => {
    expect(SERVER_CONFIG.SERVER_TICK_RATE).toBe(30);
    expect(SERVER_CONFIG.SNAPSHOT_RATE).toBeGreaterThanOrEqual(15);
    expect(SERVER_CONFIG.SNAPSHOT_RATE).toBeLessThanOrEqual(20);
    expect(SERVER_CONFIG.PROTOCOL_VERSION).toBe(PROTOCOL_VERSION);
    expect(SERVER_CONFIG.RECONNECT_GRACE_SECONDS).toBeGreaterThan(0);
  });

  it('starts synchronized match state in an honest empty lobby', () => {
    const state = new MatchRoomStateSchema();

    expect(state.phase).toBe('lobby');
    expect(state.resolved).toBe(false);
    expect(state.elapsed).toBe(0);
    expect(state.fighters.size).toBe(0);
    expect(state.roles.size).toBe(0);
    expect(state.rematchVotes.size).toBe(0);
  });

  it('initializes fighter resources without a fabricated match result', () => {
    const fighter = new FighterStateSchema();

    expect(fighter.definitionId).toBe('atlas');
    expect(fighter.health).toBe(100);
    expect(fighter.stamina).toBe(100);
    expect(fighter.momentum).toBe(0);
    expect(fighter.lastCommandSeq).toBe(0);
  });
});
