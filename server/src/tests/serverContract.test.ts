import { describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';
import { SERVER_CONFIG } from '../config';
import { FighterStateSchema, MatchRoomStateSchema } from '../rooms/WrestlingRoomState';
import { WrestlingRoom } from '../rooms/WrestlingRoom';
import type { ActionEvent } from '@frwf/game-protocol';

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

  it('safely handles null or invalid message payloads in WrestlingRoom message handlers without crashing', async () => {
    type MockHandler = (client: unknown, msg: unknown) => void;
    const handlers = new Map<string, MockHandler>();

    // Mock class extending WrestlingRoom to capture and test handlers
    class TestWrestlingRoom extends WrestlingRoom {
      constructor() {
        super();
        // Mock required parent properties to prevent errors during construction or onCreate
        this.clock = {
          start: () => {},
          setInterval: () => ({ clear: () => {} }),
          setTimeout: () => ({ clear: () => {} }),
          currentTime: 0,
          elapsedTime: 0,
        } as unknown as typeof this.clock;
      }

      override onMessage: WrestlingRoom['onMessage'] = ((type: string | number, callback: unknown) => {
        handlers.set(type.toString(), callback as MockHandler);
        return () => {};
      }) as WrestlingRoom['onMessage'];

      // Mock other methods called in onCreate
      override setPrivate() {
        return Promise.resolve();
      }
    }

    const room = new TestWrestlingRoom();
    await room.onCreate({});

    const mockClient = {
      sessionId: 'test-session',
      send: () => {},
      leave: () => {},
    } as unknown as Parameters<MockHandler>[0];

    // Test 'version' handler with null / undefined
    const versionHandler = handlers.get('version');
    expect(versionHandler).toBeDefined();
    if (versionHandler) {
      expect(() => versionHandler(mockClient, null)).not.toThrow();
      expect(() => versionHandler(mockClient, undefined)).not.toThrow();
      expect(() => versionHandler(mockClient, { clientVersion: 123 })).not.toThrow();
    }

    // Test 'pause' handler with null / undefined
    const pauseHandler = handlers.get('pause');
    expect(pauseHandler).toBeDefined();
    if (pauseHandler) {
      expect(() => pauseHandler(mockClient, null)).not.toThrow();
      expect(() => pauseHandler(mockClient, undefined)).not.toThrow();
      expect(() => pauseHandler(mockClient, { paused: 'not-a-boolean' })).not.toThrow();
    }

    // Test 'selectFighter' handler with null / undefined
    const selectFighterHandler = handlers.get('selectFighter');
    expect(selectFighterHandler).toBeDefined();
    if (selectFighterHandler) {
      expect(() => selectFighterHandler(mockClient, null)).not.toThrow();
      expect(() => selectFighterHandler(mockClient, undefined)).not.toThrow();
    }

    // Test 'command' handler with null / undefined
    const commandHandler = handlers.get('command');
    expect(commandHandler).toBeDefined();
    if (commandHandler) {
      expect(() => commandHandler(mockClient, null)).not.toThrow();
      expect(() => commandHandler(mockClient, undefined)).not.toThrow();
      expect(() => commandHandler(mockClient, { seq: 'not-a-number' })).not.toThrow();
    }
  });

  it('safely handles null, undefined, or malformed options in onCreate and onJoin without crashing', async () => {
    class TestWrestlingRoom extends WrestlingRoom {
      constructor() {
        super();
        this.clock = {
          start: () => {},
          setInterval: () => ({ clear: () => {} }),
          setTimeout: () => ({ clear: () => {} }),
          currentTime: 0,
          elapsedTime: 0,
        } as unknown as typeof this.clock;
      }
      override setPrivate() {
        return Promise.resolve();
      }
    }

    const room = new TestWrestlingRoom();

    // Verify onCreate handles various types of options safely
    expect(() => room.onCreate(null as unknown as { ruleset?: string })).not.toThrow();
    expect(() => room.onCreate(undefined as unknown as { ruleset?: string })).not.toThrow();
    expect(() => room.onCreate({ ruleset: 123, difficulty: { foo: 'bar' }, private: 'yes' } as unknown as { ruleset?: string })).not.toThrow();

    // Check fallback to defaults
    expect(room.state.ruleset).toBe('standard');
    expect(room.state.difficulty).toBe('normal');

    // Verify onJoin handles various types of options safely
    const mockClient = {
      sessionId: 'test-session-join',
      send: () => {},
      leave: () => {},
    } as unknown as Parameters<WrestlingRoom['onJoin']>[0];

    expect(() => room.onJoin(mockClient, null as unknown as { fighterId?: unknown })).not.toThrow();
    expect(() => room.onJoin(mockClient, undefined as unknown as { fighterId?: unknown })).not.toThrow();
    expect(() => room.onJoin(mockClient, { fighterId: { nested: true }, spectate: 'maybe' } as unknown as { fighterId?: unknown })).not.toThrow();
  });

  it('applies two sequenced clients to authoritative movement and swept strike contact', async () => {
    type MockHandler = (client: MockClient, msg?: unknown) => void;
    interface MockClient { sessionId: string; send: ReturnType<typeof vi.fn>; leave: ReturnType<typeof vi.fn> }
    const handlers = new Map<string, MockHandler>(); const intervals = new Map<number, () => void>(); const broadcasts: Array<{ type: string; payload: unknown }> = [];
    class TestWrestlingRoom extends WrestlingRoom {
      constructor() {
        super();
        this.clock = {
          start: () => {},
          setInterval: (callback: () => void, milliseconds: number) => { intervals.set(milliseconds, callback); return { clear: () => intervals.delete(milliseconds) }; },
          setTimeout: () => ({ clear: () => {} }), currentTime: 0, elapsedTime: 0,
        } as unknown as typeof this.clock;
      }
      override onMessage: WrestlingRoom['onMessage'] = ((type: string | number, callback: unknown) => { handlers.set(type.toString(), callback as MockHandler); return () => {}; }) as WrestlingRoom['onMessage'];
      override setPrivate() { return Promise.resolve(); }
      override broadcast(type: string | number, message?: unknown): void { broadcasts.push({ type: type.toString(), payload: message }); }
    }
    const room = new TestWrestlingRoom(); await room.onCreate({ ruleset: 'standard' });
    const p1: MockClient = { sessionId: 'p1', send: vi.fn(), leave: vi.fn() }; const p2: MockClient = { sessionId: 'p2', send: vi.fn(), leave: vi.fn() };
    await room.onJoin(p1 as never, { fighterId: 'atlas' }); await room.onJoin(p2 as never, { fighterId: 'nova' });
    handlers.get('ready')?.(p1); handlers.get('ready')?.(p2);
    expect(room.state.phase).toBe('active');
    const event = (action: ActionEvent['action'], sequence: number, direction: ActionEvent['direction'], phase: ActionEvent['phase'] = 'started'): ActionEvent => ({ action, sequence, direction, phase, timestamp: sequence * 16, source: 'network' });
    const tick = intervals.get(1000 / SERVER_CONFIG.SERVER_TICK_RATE); expect(tick).toBeDefined();
    let movementSequence = 0;
    for (let frame = 0; frame < 16; frame += 1) {
      if (frame % 6 === 0) {
        movementSequence += 1;
        handlers.get('command')?.(p1, { seq: movementSequence, event: event('move', movementSequence, { x: 1, y: 0 }, frame === 0 ? 'started' : 'held') });
        handlers.get('command')?.(p2, { seq: movementSequence, event: event('move', movementSequence, { x: -1, y: 0 }, frame === 0 ? 'started' : 'held') });
      }
      tick?.();
    }
    const releaseSequence = movementSequence + 1; const strikeSequence = releaseSequence + 1;
    handlers.get('command')?.(p1, { seq: releaseSequence, event: event('move', releaseSequence, { x: 0, y: 0 }, 'released') });
    handlers.get('command')?.(p2, { seq: releaseSequence, event: event('move', releaseSequence, { x: 0, y: 0 }, 'released') });
    handlers.get('command')?.(p1, { seq: strikeSequence, event: event('quickStrike', strikeSequence, { x: 0, y: 0 }) });
    for (let frame = 0; frame < 24; frame += 1) tick?.();
    expect(room.state.fighters.get('p2')?.health).toBeLessThan(100);
    expect(room.state.fighters.get('p1')?.lastCommandSeq).toBe(strikeSequence);
    expect(p1.send).toHaveBeenCalledWith('commandAck', expect.objectContaining({ seq: strikeSequence, accepted: true }));
    expect(broadcasts.some((message) => message.type === 'impactEvent')).toBe(true);
  });
});
