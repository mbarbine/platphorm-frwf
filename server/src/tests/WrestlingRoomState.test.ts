import { describe, expect, it } from 'vitest';
import { FighterStateSchema, MatchRoomStateSchema } from '../rooms/WrestlingRoomState';

describe('WrestlingRoomState schema models', () => {
  describe('FighterStateSchema', () => {
    it('initializes with expected default property values', () => {
      const fighter = new FighterStateSchema();

      expect(fighter.definitionId).toBe('atlas');
      expect(fighter.health).toBe(100);
      expect(fighter.stamina).toBe(100);
      expect(fighter.momentum).toBe(0);

      expect(fighter.posX).toBe(0);
      expect(fighter.posZ).toBe(0);
      expect(fighter.facing).toBe(0);
      expect(fighter.velocityX).toBe(0);
      expect(fighter.velocityZ).toBe(0);

      expect(fighter.combatState).toBe('idle');
      expect(fighter.moveId).toBe('');
      expect(fighter.attackPhase).toBe('');

      expect(fighter.pinCount).toBe(0);
      expect(fighter.finisherPrimed).toBe(false);
      expect(fighter.lastCommandSeq).toBe(0);
    });

    it('allows updating resources and position fields accurately', () => {
      const fighter = new FighterStateSchema();

      fighter.definitionId = 'nova';
      fighter.health = 75;
      fighter.stamina = 50;
      fighter.momentum = 25;

      fighter.posX = 2.5;
      fighter.posZ = -1.2;
      fighter.facing = Math.PI;
      fighter.velocityX = 0.5;
      fighter.velocityZ = -0.5;

      expect(fighter.definitionId).toBe('nova');
      expect(fighter.health).toBe(75);
      expect(fighter.stamina).toBe(50);
      expect(fighter.momentum).toBe(25);
      expect(fighter.posX).toBe(2.5);
      expect(fighter.posZ).toBe(-1.2);
      expect(fighter.facing).toBe(Math.PI);
      expect(fighter.velocityX).toBe(0.5);
      expect(fighter.velocityZ).toBe(-0.5);
    });

    it('allows updating combat, pin, and sequence state', () => {
      const fighter = new FighterStateSchema();

      fighter.combatState = 'attacking';
      fighter.moveId = 'quick_strike';
      fighter.attackPhase = 'active';
      fighter.pinCount = 2;
      fighter.finisherPrimed = true;
      fighter.lastCommandSeq = 42;

      expect(fighter.combatState).toBe('attacking');
      expect(fighter.moveId).toBe('quick_strike');
      expect(fighter.attackPhase).toBe('active');
      expect(fighter.pinCount).toBe(2);
      expect(fighter.finisherPrimed).toBe(true);
      expect(fighter.lastCommandSeq).toBe(42);
    });
  });

  describe('MatchRoomStateSchema', () => {
    it('initializes with expected default property values', () => {
      const state = new MatchRoomStateSchema();

      expect(state.phase).toBe('lobby');
      expect(state.resolved).toBe(false);
      expect(state.elapsed).toBe(0);
      expect(state.hype).toBe(8);
      expect(state.announcement).toBe('RINGFALL — CHAOS CIRCUIT');
      expect(state.announcementTimer).toBe(2);
      expect(state.ruleset).toBe('standard');
      expect(state.difficulty).toBe('normal');

      expect(state.winnerSessionId).toBe('');
      expect(state.winMethod).toBe('');
      expect(state.seed).toBe(1337);

      expect(state.fighters.size).toBe(0);
      expect(state.roles.size).toBe(0);
      expect(state.rematchVotes.size).toBe(0);
      expect(state.serverVersion).toBe('1.0.0');
    });

    it('supports managing fighters MapSchema and nested state updates', () => {
      const state = new MatchRoomStateSchema();
      const fighter1 = new FighterStateSchema();
      fighter1.definitionId = 'brick';

      state.fighters.set('session-1', fighter1);

      expect(state.fighters.size).toBe(1);
      expect(state.fighters.get('session-1')).toBe(fighter1);
      expect(state.fighters.get('session-1')?.definitionId).toBe('brick');

      // Mutate nested fighter state
      const retrieved = state.fighters.get('session-1');
      if (retrieved) {
        retrieved.health = 80;
      }
      expect(state.fighters.get('session-1')?.health).toBe(80);

      // Remove fighter from map
      state.fighters.delete('session-1');
      expect(state.fighters.size).toBe(0);
      expect(state.fighters.has('session-1')).toBe(false);
    });

    it('supports managing roles MapSchema', () => {
      const state = new MatchRoomStateSchema();

      state.roles.set('session-1', 'player1');
      state.roles.set('session-2', 'player2');
      state.roles.set('session-3', 'spectator');

      expect(state.roles.size).toBe(3);
      expect(state.roles.get('session-1')).toBe('player1');
      expect(state.roles.get('session-2')).toBe('player2');
      expect(state.roles.get('session-3')).toBe('spectator');

      state.roles.delete('session-3');
      expect(state.roles.size).toBe(2);
      expect(state.roles.has('session-3')).toBe(false);
    });

    it('supports managing rematchVotes MapSchema', () => {
      const state = new MatchRoomStateSchema();

      state.rematchVotes.set('session-1', true);
      state.rematchVotes.set('session-2', false);

      expect(state.rematchVotes.size).toBe(2);
      expect(state.rematchVotes.get('session-1')).toBe(true);
      expect(state.rematchVotes.get('session-2')).toBe(false);

      state.rematchVotes.clear();
      expect(state.rematchVotes.size).toBe(0);
    });

    it('allows mutating match lifecycle, metadata, and resolution properties', () => {
      const state = new MatchRoomStateSchema();

      state.phase = 'active';
      state.elapsed = 45.5;
      state.hype = 95;
      state.announcement = 'FINAL ROUND!';
      state.announcementTimer = 3;
      state.ruleset = 'hardcore';
      state.difficulty = 'hard';
      state.seed = 9999;

      expect(state.phase).toBe('active');
      expect(state.elapsed).toBe(45.5);
      expect(state.hype).toBe(95);
      expect(state.announcement).toBe('FINAL ROUND!');
      expect(state.announcementTimer).toBe(3);
      expect(state.ruleset).toBe('hardcore');
      expect(state.difficulty).toBe('hard');
      expect(state.seed).toBe(9999);

      // Set match result
      state.resolved = true;
      state.winnerSessionId = 'session-1';
      state.winMethod = 'PINFALL';

      expect(state.resolved).toBe(true);
      expect(state.winnerSessionId).toBe('session-1');
      expect(state.winMethod).toBe('PINFALL');
    });
  });
});
