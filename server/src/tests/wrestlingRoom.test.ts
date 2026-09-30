import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WrestlingRoom } from '../rooms/WrestlingRoom';
import { SERVER_CONFIG } from '../config';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';

// Helper types for mock client and handlers
interface MockClient {
  sessionId: string;
  send: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
}

type MockHandler = (client: MockClient, msg?: unknown) => void;

class TestWrestlingRoom extends WrestlingRoom {
  public handlers = new Map<string, MockHandler>();
  public intervals = new Map<number, () => void>();
  public broadcasts: Array<{ type: string; payload: unknown }> = [];
  public allowReconnectionMock = vi.fn();

  constructor() {
    super();
    this.clock = {
      start: () => {},
      setInterval: (callback: () => void, milliseconds: number) => {
        this.intervals.set(milliseconds, callback);
        return { clear: () => this.intervals.delete(milliseconds) };
      },
      setTimeout: () => ({ clear: () => {} }),
      currentTime: 0,
      elapsedTime: 0,
      tick: () => {},
    } as unknown as typeof this.clock;
  }

  override onMessage: WrestlingRoom['onMessage'] = ((type: string | number, callback: unknown) => {
    this.handlers.set(type.toString(), callback as MockHandler);
    return () => {};
  }) as WrestlingRoom['onMessage'];

  override setPrivate = vi.fn().mockResolvedValue(undefined);

  override broadcast(type: string | number, message?: unknown): void {
    this.broadcasts.push({ type: type.toString(), payload: message });
  }

  override allowReconnection(client: unknown, seconds?: number): Promise<unknown> {
    return this.allowReconnectionMock(client, seconds);
  }

  // Public accessors for testing internal state
  public getSessions() {
    return (this as unknown as { sessions: Map<string, unknown> }).sessions;
  }

  public getMatchModel() {
    return (this as unknown as { matchModel: unknown }).matchModel;
  }

  public setMatchModel(model: unknown) {
    (this as unknown as { matchModel: unknown }).matchModel = model;
  }

  public callTick() {
    (this as unknown as { tick: () => void }).tick();
  }

  public callBroadcastSnapshot() {
    (this as unknown as { broadcastSnapshot: () => void }).broadcastSnapshot();
  }

  public callEndMatch(method?: 'PINFALL' | 'KNOCKOUT' | 'TIMEOUT' | 'FORFEIT', winnerSessionId?: string) {
    (this as unknown as { endMatch: (method?: string, winner?: string) => void }).endMatch(method, winnerSessionId);
  }
}

describe('WrestlingRoom Unit Tests', () => {
  let room: TestWrestlingRoom;

  beforeEach(async () => {
    room = new TestWrestlingRoom();
    await room.onCreate({});
  });

  describe('Lifecycle & Options (onCreate)', () => {
    it('initializes default state and options correctly', () => {
      expect(room.state.ruleset).toBe('standard');
      expect(room.state.difficulty).toBe('normal');
      expect(room.state.serverVersion).toBe(PROTOCOL_VERSION);
      expect(room.state.phase).toBe('lobby');
      expect(room.state.seed).toBeGreaterThanOrEqual(0);
      expect(room.state.seed).toBeLessThanOrEqual(0xFFFFFF);
      expect(room.maxClients).toBe(SERVER_CONFIG.MAX_CLIENTS_PER_ROOM);
    });

    it('accepts custom valid creation options', async () => {
      const customRoom = new TestWrestlingRoom();
      await customRoom.onCreate({ ruleset: 'chaos', difficulty: 'hard', private: true });

      expect(customRoom.state.ruleset).toBe('chaos');
      expect(customRoom.state.difficulty).toBe('hard');
      expect(customRoom.setPrivate).toHaveBeenCalledWith(true);
    });

    it('falls back to default values when passed invalid creation options', async () => {
      const customRoom = new TestWrestlingRoom();
      await customRoom.onCreate({
        ruleset: 'invalid_ruleset' as never,
        difficulty: 'extreme' as never,
        private: 'yes' as never,
      });

      expect(customRoom.state.ruleset).toBe('standard');
      expect(customRoom.state.difficulty).toBe('normal');
    });
  });

  describe('Client Join & Role Assignment (onJoin)', () => {
    it('assigns player1 role to first client and player2 to second client', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };

      await room.onJoin(p1 as never, { fighterId: 'atlas' });
      expect(room.state.roles.get('p1')).toBe('player1');
      expect(room.state.fighters.get('p1')?.definitionId).toBe('atlas');
      expect(room.state.fighters.get('p1')?.posX).toBe(-2.3);

      await room.onJoin(p2 as never, { fighterId: 'nova' });
      expect(room.state.roles.get('p2')).toBe('player2');
      expect(room.state.fighters.get('p2')?.definitionId).toBe('nova');
      expect(room.state.fighters.get('p2')?.posX).toBe(2.3);
    });

    it('assigns spectator role when max active players joined or spectate option is set', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      const spec: MockClient = { sessionId: 'spec', send: vi.fn(), leave: vi.fn() };
      const explicitSpec: MockClient = { sessionId: 'explicitSpec', send: vi.fn(), leave: vi.fn() };

      await room.onJoin(p1 as never, {});
      await room.onJoin(explicitSpec as never, { spectate: true });
      expect(room.state.roles.get('explicitSpec')).toBe('spectator');
      expect(room.state.fighters.has('explicitSpec')).toBe(false);

      await room.onJoin(p2 as never, {});
      expect(room.state.roles.get('p2')).toBe('player2');

      await room.onJoin(spec as never, {});
      expect(room.state.roles.get('spec')).toBe('spectator');
      expect(room.state.fighters.has('spec')).toBe(false);
    });

    it('validates fighterId during join and falls back to atlas if invalid', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, { fighterId: 'unknown_fighter' as never });

      expect(room.state.fighters.get('p1')?.definitionId).toBe('atlas');
    });

    it('assigns spectator role if joining during active phase', async () => {
      room.state.phase = 'active';
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };

      await room.onJoin(p1 as never, { fighterId: 'atlas' });
      expect(room.state.roles.get('p1')).toBe('spectator');
    });
  });

  describe('Version Check Handler', () => {
    it('accepts matching client version', () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const handler = room.handlers.get('version');

      handler?.(p1, { clientVersion: PROTOCOL_VERSION });
      expect(p1.leave).not.toHaveBeenCalled();
    });

    it('rejects mismatched client version with code 4000', () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const handler = room.handlers.get('version');

      handler?.(p1, { clientVersion: '0.0.1-old' });

      expect(p1.send).toHaveBeenCalledWith('versionRejected', expect.objectContaining({
        type: 'versionRejected',
        serverVersion: PROTOCOL_VERSION,
        minClientVersion: PROTOCOL_VERSION,
      }));
      expect(p1.leave).toHaveBeenCalledWith(4000);
    });

    it('rejects invalid payload format with code 4001', () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const handler = room.handlers.get('version');

      handler?.(p1, null);
      expect(p1.leave).toHaveBeenCalledWith(4001);

      p1.leave.mockClear();
      handler?.(p1, { clientVersion: 123 });
      expect(p1.leave).toHaveBeenCalledWith(4001);
    });
  });

  describe('Fighter Selection Handler', () => {
    it('allows active players to select valid fighters in lobby phase', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, { fighterId: 'atlas' });

      const handler = room.handlers.get('selectFighter');
      handler?.(p1, { fighterId: 'nova' });

      expect(room.state.fighters.get('p1')?.definitionId).toBe('nova');
      expect(room.state.phase).toBe('selection');
    });

    it('ignores selectFighter messages during active phase', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, { fighterId: 'atlas' });
      room.state.phase = 'active';

      const handler = room.handlers.get('selectFighter');
      handler?.(p1, { fighterId: 'nova' });

      expect(room.state.fighters.get('p1')?.definitionId).toBe('atlas');
    });

    it('ignores selectFighter messages from spectators or invalid payloads', async () => {
      const spec: MockClient = { sessionId: 'spec', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(spec as never, { spectate: true });

      const handler = room.handlers.get('selectFighter');
      handler?.(spec, { fighterId: 'nova' });

      expect(room.state.fighters.has('spec')).toBe(false);

      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});

      handler?.(p1, null);
      expect(room.state.fighters.get('p1')?.definitionId).toBe('atlas');
    });
  });

  describe('Ready & Match Start Handler', () => {
    it('sets readiness and announces waiting if only one player is ready', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});

      const handler = room.handlers.get('ready');
      handler?.(p1);

      expect(room.state.announcement).toBe('WAITING FOR SECOND WRESTLER');
      expect(room.state.phase).toBe('lobby');
    });

    it('starts match when both player1 and player2 are ready and connected', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, { fighterId: 'atlas' });
      await room.onJoin(p2 as never, { fighterId: 'nova' });

      const handler = room.handlers.get('ready');
      handler?.(p1);
      expect(room.state.phase).toBe('lobby');

      handler?.(p2);
      expect(room.state.phase).toBe('active');
      expect(room.state.announcement).toBe('ROUND ONE — FIGHT!');
      expect(room.getMatchModel()).toBeDefined();
    });
  });

  describe('Command Handler', () => {
    it('validates, processes and acknowledges client action commands', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});
      room.handlers.get('ready')?.(p1);
      room.handlers.get('ready')?.(p2);

      const validCommand = {
        seq: 1,
        event: {
          action: 'move',
          phase: 'started',
          sequence: 1,
          timestamp: 100,
          direction: { x: 1, y: 0 },
          source: 'keyboard',
        },
      };

      const handler = room.handlers.get('command');
      handler?.(p1, validCommand);

      expect(p1.send).toHaveBeenCalledWith('commandAck', expect.objectContaining({
        type: 'commandAck',
        seq: 1,
        accepted: true,
      }));
      expect(room.state.fighters.get('p1')?.lastCommandSeq).toBe(1);
    });

    it('rejects duplicate or out-of-order command sequence numbers', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});
      room.handlers.get('ready')?.(p1);
      room.handlers.get('ready')?.(p2);

      const makeCmd = (seq: number) => ({
        seq,
        event: {
          action: 'move' as const,
          phase: 'started' as const,
          sequence: seq,
          timestamp: 100,
          direction: { x: 1, y: 0 },
          source: 'keyboard' as const,
        },
      });

      const handler = room.handlers.get('command');
      handler?.(p1, makeCmd(5));
      p1.send.mockClear();

      handler?.(p1, makeCmd(3)); // Out of order sequence
      expect(p1.send).not.toHaveBeenCalled();

      handler?.(p1, makeCmd(5)); // Duplicate sequence
      expect(p1.send).not.toHaveBeenCalled();
    });

    it('rejects malformed command payloads that fail schema validation', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});
      room.handlers.get('ready')?.(p1);
      room.handlers.get('ready')?.(p2);

      const invalidCommand = {
        seq: 1,
        event: {
          action: 'invalid_action',
          direction: { x: 10, y: 0 }, // Out of range [-1, 1]
        },
      };

      const handler = room.handlers.get('command');
      handler?.(p1, invalidCommand);

      expect(p1.send).not.toHaveBeenCalled();
    });

    it('rejects command payloads exceeding Number.MAX_SAFE_INTEGER or negative timestamp', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});
      room.handlers.get('ready')?.(p1);
      room.handlers.get('ready')?.(p2);

      const handler = room.handlers.get('command');

      // Reject seq > Number.MAX_SAFE_INTEGER
      handler?.(p1, {
        seq: Number.MAX_SAFE_INTEGER + 1,
        event: {
          action: 'move',
          phase: 'started',
          sequence: 1,
          timestamp: 100,
          direction: { x: 1, y: 0 },
          source: 'keyboard',
        },
      });
      expect(p1.send).not.toHaveBeenCalled();

      // Reject event.sequence > Number.MAX_SAFE_INTEGER
      handler?.(p1, {
        seq: 1,
        event: {
          action: 'move',
          phase: 'started',
          sequence: Number.MAX_SAFE_INTEGER + 1,
          timestamp: 100,
          direction: { x: 1, y: 0 },
          source: 'keyboard',
        },
      });
      expect(p1.send).not.toHaveBeenCalled();

      // Reject negative event.timestamp
      handler?.(p1, {
        seq: 1,
        event: {
          action: 'move',
          phase: 'started',
          sequence: 1,
          timestamp: -1,
          direction: { x: 1, y: 0 },
          source: 'keyboard',
        },
      });
      expect(p1.send).not.toHaveBeenCalled();

      // Reject commands with mismatched seq and event.sequence
      handler?.(p1, {
        seq: 2,
        event: {
          action: 'move',
          phase: 'started',
          sequence: 5,
          timestamp: 100,
          direction: { x: 1, y: 0 },
          source: 'keyboard',
        },
      });
      expect(p1.send).not.toHaveBeenCalled();
    });
  });

  describe('Single Player Practice Pause Handler', () => {
    it('allows active single player to toggle pause mode', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      room.state.phase = 'active';

      const handler = room.handlers.get('pause');
      handler?.(p1, { paused: true });
      expect(room.state.phase).toBe('lobby');

      handler?.(p1, { paused: false });
      expect(room.state.phase).toBe('active');
    });

    it('ignores pause command in multiplayer mode or from spectators', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});
      room.state.phase = 'active';

      const handler = room.handlers.get('pause');
      handler?.(p1, { paused: true });
      expect(room.state.phase).toBe('active'); // Unchanged in multiplayer
    });
  });

  describe('Sync State Handler', () => {
    it('sends current room state on syncState message', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, { fighterId: 'atlas' });

      const handler = room.handlers.get('syncState');
      handler?.(p1);

      expect(p1.send).toHaveBeenCalledWith('roomState', expect.objectContaining({
        type: 'roomState',
        phase: 'lobby',
        roles: [{ sessionId: 'p1', role: 'player1' }],
        fighters: [{ sessionId: 'p1', definitionId: 'atlas' }],
      }));
    });
  });

  describe('Rematch Handler', () => {
    it('collects rematch votes in result phase and restarts match when all active players agree', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});

      room.handlers.get('ready')?.(p1);
      room.handlers.get('ready')?.(p2);
      expect(room.state.phase).toBe('active');

      room.callEndMatch('PINFALL', 'p1');
      expect(room.state.phase).toBe('result');

      const handler = room.handlers.get('rematch');
      handler?.(p1);
      expect(room.state.phase).toBe('result'); // Waiting for p2

      handler?.(p2);
      expect(room.state.phase).toBe('active'); // Restarted
    });

    it('ignores rematch requests when phase is not result', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});

      const handler = room.handlers.get('rematch');
      handler?.(p1);

      expect(room.state.rematchVotes.size).toBe(0);
    });
  });

  describe('Match Simulation & Snapshot Broadcasting', () => {
    it('broadcasts snapshots with formatted fighter state entries', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, { fighterId: 'atlas' });

      room.broadcasts = [];
      room.callBroadcastSnapshot();

      const snapshotBroadcast = room.broadcasts.find(b => b.type === 'snapshot');
      expect(snapshotBroadcast).toBeDefined();
      expect(snapshotBroadcast?.payload).toMatchObject({
        type: 'snapshot',
        seq: 1,
        fighters: [
          expect.objectContaining({
            sessionId: 'p1',
            definitionId: 'atlas',
            health: 100,
          }),
        ],
      });
    });

    it('triggers endMatch with TIMEOUT when match elapsed time exceeds MATCH_TIMEOUT_SECONDS', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});
      room.handlers.get('ready')?.(p1);
      room.handlers.get('ready')?.(p2);

      expect(room.state.phase).toBe('active');

      // Set match model to null so tick falls back to state.elapsed incrementing
      room.setMatchModel(null);
      room.state.elapsed = SERVER_CONFIG.MATCH_TIMEOUT_SECONDS + 0.1;

      room.callTick();

      expect(room.state.phase).toBe('result');
      expect(room.state.winMethod).toBe('TIMEOUT');
      expect(room.state.announcement).toBe('TIME LIMIT!');
    });

    it('maps match hype scores to proper letter grades (S, A, B, C, D)', async () => {
      const testHypeGrade = (hypeScore: number, expectedGrade: string) => {
        room.state.hype = hypeScore;
        room.callEndMatch('KNOCKOUT', 'p1');
        const matchResult = room.broadcasts.reverse().find(b => b.type === 'matchResult');
        expect(matchResult?.payload).toMatchObject({ grade: expectedGrade });
      };

      testHypeGrade(95, 'S');
      testHypeGrade(75, 'A');
      testHypeGrade(55, 'B');
      testHypeGrade(35, 'C');
      testHypeGrade(15, 'D');
    });
  });

  describe('Disconnection & Forfeit (onLeave)', () => {
    it('removes spectator immediately on leave', async () => {
      const spec: MockClient = { sessionId: 'spec', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(spec as never, { spectate: true });
      expect(room.state.roles.has('spec')).toBe(true);

      await room.onLeave(spec as never, true);
      expect(room.state.roles.has('spec')).toBe(false);
    });

    it('resolves forfeit immediately if active player leaves with consent during active match', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});
      room.handlers.get('ready')?.(p1);
      room.handlers.get('ready')?.(p2);

      await room.onLeave(p1 as never, true); // Consented leave

      expect(room.state.phase).toBe('result');
      expect(room.state.winMethod).toBe('FORFEIT');
      expect(room.state.winnerSessionId).toBe('p2');
    });

    it('handles unconsented disconnect grace period and reconnection success', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});
      room.handlers.get('ready')?.(p1);
      room.handlers.get('ready')?.(p2);

      room.allowReconnectionMock.mockResolvedValueOnce(true);

      await room.onLeave(p1 as never, false); // Unconsented disconnect

      expect(room.allowReconnectionMock).toHaveBeenCalledWith(p1, SERVER_CONFIG.RECONNECT_GRACE_SECONDS);
      expect(room.state.phase).toBe('active'); // Reconnected successfully, match continues
    });

    it('resolves forfeit if unconsented reconnect attempt times out', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});
      room.handlers.get('ready')?.(p1);
      room.handlers.get('ready')?.(p2);

      room.allowReconnectionMock.mockRejectedValueOnce(new Error('Reconnection timeout'));

      await room.onLeave(p1 as never, false);

      expect(room.state.phase).toBe('result');
      expect(room.state.winMethod).toBe('FORFEIT');
      expect(room.state.winnerSessionId).toBe('p2');
    });
  });

  describe('Resource Disposal (onDispose)', () => {
    it('clears all active simulation and snapshot clock intervals on disposal', async () => {
      const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() };
      const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
      await room.onJoin(p1 as never, {});
      await room.onJoin(p2 as never, {});
      room.handlers.get('ready')?.(p1);
      room.handlers.get('ready')?.(p2);

      expect(room.intervals.size).toBeGreaterThan(0);

      await room.onDispose();

      expect(room.intervals.size).toBe(0);
    });
  });
});
