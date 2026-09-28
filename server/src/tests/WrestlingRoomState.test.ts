import { describe, expect, it } from 'vitest';
import { FighterStateSchema, MatchRoomStateSchema } from '../rooms/WrestlingRoomState';

describe('WrestlingRoomState schemas', () => {
  describe('FighterStateSchema', () => {
    it('initializes default properties correctly', () => {
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

    it('allows mutating fighter state fields', () => {
      const fighter = new FighterStateSchema();

      fighter.definitionId = 'nova';
      fighter.health = 75;
      fighter.stamina = 50;
      fighter.momentum = 25;
      fighter.posX = -1.5;
      fighter.posZ = 2.1;
      fighter.facing = Math.PI;
      fighter.velocityX = 0.5;
      fighter.velocityZ = -0.5;
      fighter.combatState = 'grappling';
      fighter.moveId = 'suplex';
      fighter.attackPhase = 'lift';
      fighter.pinCount = 2;
      fighter.finisherPrimed = true;
      fighter.lastCommandSeq = 42;

      expect(fighter.definitionId).toBe('nova');
      expect(fighter.health).toBe(75);
      expect(fighter.stamina).toBe(50);
      expect(fighter.momentum).toBe(25);
      expect(fighter.posX).toBe(-1.5);
      expect(fighter.posZ).toBe(2.1);
      expect(fighter.facing).toBe(Math.PI);
      expect(fighter.velocityX).toBe(0.5);
      expect(fighter.velocityZ).toBe(-0.5);
      expect(fighter.combatState).toBe('grappling');
      expect(fighter.moveId).toBe('suplex');
      expect(fighter.attackPhase).toBe('lift');
      expect(fighter.pinCount).toBe(2);
      expect(fighter.finisherPrimed).toBe(true);
      expect(fighter.lastCommandSeq).toBe(42);
    });
  });

  describe('MatchRoomStateSchema', () => {
    it('initializes default properties correctly', () => {
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
      expect(state.serverVersion).toBe('1.0.0');

      expect(state.fighters.size).toBe(0);
      expect(state.roles.size).toBe(0);
      expect(state.rematchVotes.size).toBe(0);
    });

    it('manages MapSchema collections for fighters, roles, and rematchVotes', () => {
      const state = new MatchRoomStateSchema();

      const f1 = new FighterStateSchema();
      f1.definitionId = 'atlas';
      const f2 = new FighterStateSchema();
      f2.definitionId = 'nova';

      state.fighters.set('sess-1', f1);
      state.fighters.set('sess-2', f2);
      state.roles.set('sess-1', 'player1');
      state.roles.set('sess-2', 'player2');
      state.roles.set('sess-3', 'spectator');
      state.rematchVotes.set('sess-1', true);
      state.rematchVotes.set('sess-2', false);

      expect(state.fighters.size).toBe(2);
      expect(state.fighters.get('sess-1')?.definitionId).toBe('atlas');
      expect(state.fighters.get('sess-2')?.definitionId).toBe('nova');

      expect(state.roles.size).toBe(3);
      expect(state.roles.get('sess-1')).toBe('player1');
      expect(state.roles.get('sess-2')).toBe('player2');
      expect(state.roles.get('sess-3')).toBe('spectator');

      expect(state.rematchVotes.size).toBe(2);
      expect(state.rematchVotes.get('sess-1')).toBe(true);
      expect(state.rematchVotes.get('sess-2')).toBe(false);

      // Deletion
      state.fighters.delete('sess-2');
      state.roles.delete('sess-3');
      state.rematchVotes.delete('sess-1');

      expect(state.fighters.size).toBe(1);
      expect(state.fighters.has('sess-2')).toBe(false);
      expect(state.roles.size).toBe(2);
      expect(state.roles.has('sess-3')).toBe(false);
      expect(state.rematchVotes.size).toBe(1);
      expect(state.rematchVotes.has('sess-1')).toBe(false);
    });

    it('serializes and deserializes state via Colyseus Schema encode and decode roundtrip', () => {
      const originalState = new MatchRoomStateSchema();

      originalState.phase = 'active';
      originalState.elapsed = 15.5;
      originalState.hype = 45;
      originalState.announcement = 'ROUND ONE — FIGHT!';
      originalState.ruleset = 'chaos';
      originalState.difficulty = 'hard';
      originalState.seed = 9999;

      const f1 = new FighterStateSchema();
      f1.definitionId = 'brick';
      f1.health = 90;
      f1.posX = -2.0;
      f1.lastCommandSeq = 10;
      originalState.fighters.set('sess-1', f1);
      originalState.roles.set('sess-1', 'player1');

      // Encode original state
      const encoded = originalState.encode();

      // Decode into a fresh instance
      const decodedState = new MatchRoomStateSchema();
      decodedState.decode(encoded);

      expect(decodedState.phase).toBe('active');
      expect(decodedState.elapsed).toBe(15.5);
      expect(decodedState.hype).toBe(45);
      expect(decodedState.announcement).toBe('ROUND ONE — FIGHT!');
      expect(decodedState.ruleset).toBe('chaos');
      expect(decodedState.difficulty).toBe('hard');
      expect(decodedState.seed).toBe(9999);

      expect(decodedState.fighters.size).toBe(1);
      const decodedFighter = decodedState.fighters.get('sess-1');
      expect(decodedFighter).toBeDefined();
      expect(decodedFighter?.definitionId).toBe('brick');
      expect(decodedFighter?.health).toBe(90);
      expect(decodedFighter?.posX).toBe(-2.0);
      expect(decodedFighter?.lastCommandSeq).toBe(10);

      expect(decodedState.roles.size).toBe(1);
      expect(decodedState.roles.get('sess-1')).toBe('player1');
    });
  });
});
