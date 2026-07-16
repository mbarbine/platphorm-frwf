import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';
import { SERVER_CONFIG } from '../config';
import { FighterStateSchema, MatchRoomStateSchema } from '../rooms/WrestlingRoomState';
import { WrestlingRoom } from '../rooms/WrestlingRoom';

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

      override onMessage(type: string | number, callback: (client: never, message: never) => void) {
        handlers.set(type.toString(), callback as unknown as MockHandler);
        return () => {};
      }

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
});
