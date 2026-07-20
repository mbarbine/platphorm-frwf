import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ClientFighterState, ClientRoomState } from '../game/multiplayer/ColyseusClient';
import type { ActionEvent } from '@frwf/game-protocol';

interface MockRoomType {
  id: string;
  sessionId: string;
  reconnectionToken: string;
  send: (type: string, message?: unknown) => void;
  leave: (consented?: boolean) => Promise<unknown>;
  onStateChange: (cb: (state: unknown) => void) => void;
  onMessage: (type: string, cb: (message: unknown) => void) => void;
  onLeave: (cb: (code: number) => void) => void;
  onError: (cb: (code: number, message?: string) => void) => void;
  _stateCallback: ((state: unknown) => void) | null;
  _messageCallbacks: Map<string, (message: unknown) => void>;
  _leaveCallback: ((code: number) => void) | null;
  _errorCallback: ((code: number, message?: string) => void) | null;
}

const {
  MockColyseusClient,
  mockJoinOrCreate,
  mockJoinById,
  mockCreate,
  mockReconnect,
  mockRoom,
  mockSend,
  mockLeave,
} = vi.hoisted(() => {
  const mockSend = vi.fn();
  const mockLeave = vi.fn();

  const mockRoom: MockRoomType = {
    id: 'mock-room-id',
    sessionId: 'mock-session-id',
    reconnectionToken: 'mock-reconnection-token',
    send: mockSend,
    leave: mockLeave,
    onStateChange: vi.fn().mockImplementation((cb) => {
      mockRoom._stateCallback = cb;
    }),
    onMessage: vi.fn().mockImplementation((type, cb) => {
      mockRoom._messageCallbacks.set(type as string, cb);
    }),
    onLeave: vi.fn().mockImplementation((cb) => {
      mockRoom._leaveCallback = cb;
    }),
    onError: vi.fn().mockImplementation((cb) => {
      mockRoom._errorCallback = cb;
    }),
    _stateCallback: null,
    _messageCallbacks: new Map(),
    _leaveCallback: null,
    _errorCallback: null,
  };

  const mockJoinOrCreate = vi.fn().mockResolvedValue(mockRoom);
  const mockJoinById = vi.fn().mockResolvedValue(mockRoom);
  const mockCreate = vi.fn().mockResolvedValue(mockRoom);
  const mockReconnect = vi.fn().mockResolvedValue(mockRoom);

  class MockColyseusClient {
    joinOrCreate = mockJoinOrCreate;
    joinById = mockJoinById;
    create = mockCreate;
    reconnect = mockReconnect;
  }

  return {
    MockColyseusClient,
    mockJoinOrCreate,
    mockJoinById,
    mockCreate,
    mockReconnect,
    mockRoom,
    mockSend,
    mockLeave,
  };
});

vi.mock('colyseus.js', () => {
  return {
    Client: MockColyseusClient,
  };
});

// Import them after the mock setup
import { ColyseusClient } from '../game/multiplayer/ColyseusClient';
import { useMultiplayerStore } from '../game/multiplayer/MultiplayerStore';

describe('ColyseusClient', () => {
  let client: ColyseusClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoom._messageCallbacks.clear();
    mockRoom._stateCallback = null;
    mockRoom._leaveCallback = null;
    mockRoom._errorCallback = null;
    mockRoom.reconnectionToken = 'mock-reconnection-token';
    client = new ColyseusClient();
  });

  it('starts in disconnected state', () => {
    expect(client.currentStatus).toBe('disconnected');
    expect(client.isConnected).toBe(false);
    expect(client.roomId).toBeUndefined();
    expect(client.sessionId).toBeUndefined();
  });

  it('connects via joinOrCreate', async () => {
    const onStatusChange = vi.fn();
    client.setEventHandlers({ onStatusChange });

    await client.joinOrCreate('wrestling', { fighterId: 'atlas' });

    expect(client.currentStatus).toBe('connected');
    expect(client.isConnected).toBe(true);
    expect(client.roomId).toBe('mock-room-id');
    expect(client.sessionId).toBe('mock-session-id');

    expect(mockJoinOrCreate).toHaveBeenCalledWith('wrestling', { fighterId: 'atlas' });
    expect(mockSend).toHaveBeenCalledWith('version', expect.any(Object));
  });

  it('handles connection error in joinOrCreate', async () => {
    const onStatusChange = vi.fn();
    client.setEventHandlers({ onStatusChange });

    const error = new Error('Connection failed');
    mockJoinOrCreate.mockRejectedValueOnce(error);

    await expect(client.joinOrCreate('wrestling')).rejects.toThrow('Connection failed');
    expect(client.currentStatus).toBe('error');
    expect(client.isConnected).toBe(false);
    expect(onStatusChange).toHaveBeenCalledWith('connecting');
    expect(onStatusChange).toHaveBeenCalledWith('error');
  });

  it('connects via joinRoom', async () => {
    const onStatusChange = vi.fn();
    client.setEventHandlers({ onStatusChange });

    await client.joinRoom('wrestling', { fighterId: 'atlas' });

    expect(client.currentStatus).toBe('connected');
    expect(client.isConnected).toBe(true);
    expect(client.roomId).toBe('mock-room-id');
    expect(client.sessionId).toBe('mock-session-id');

    expect(mockJoinOrCreate).toHaveBeenCalledWith('wrestling', { fighterId: 'atlas' });
    expect(mockSend).toHaveBeenCalledWith('version', expect.any(Object));
  });

  it('handles connection error in joinRoom', async () => {
    const onStatusChange = vi.fn();
    client.setEventHandlers({ onStatusChange });

    const error = new Error('Connection failed');
    mockJoinOrCreate.mockRejectedValueOnce(error);

    await expect(client.joinRoom('wrestling')).rejects.toThrow('Connection failed');
    expect(client.currentStatus).toBe('error');
    expect(client.isConnected).toBe(false);
    expect(onStatusChange).toHaveBeenCalledWith('connecting');
    expect(onStatusChange).toHaveBeenCalledWith('error');
  });

  it('connects via joinByRoomId', async () => {
    await client.joinByRoomId('room123', { fighterId: 'nova' });
    expect(client.currentStatus).toBe('connected');
    expect(mockJoinById).toHaveBeenCalledWith('room123', { fighterId: 'nova' });
  });

  it('handles connection error in joinByRoomId', async () => {
    const onStatusChange = vi.fn();
    client.setEventHandlers({ onStatusChange });

    const error = new Error('Join ID failed');
    mockJoinById.mockRejectedValueOnce(error);

    await expect(client.joinByRoomId('room123')).rejects.toThrow('Join ID failed');
    expect(client.currentStatus).toBe('error');
    expect(onStatusChange).toHaveBeenCalledWith('connecting');
    expect(onStatusChange).toHaveBeenCalledWith('error');
  });

  it('creates private room', async () => {
    const id = await client.createPrivateRoom({ fighterId: 'vex', ruleset: 'chaos' });
    expect(client.currentStatus).toBe('connected');
    expect(id).toBe('mock-room-id');
    expect(mockCreate).toHaveBeenCalledWith('practice', { fighterId: 'vex', ruleset: 'chaos', private: true });
  });

  it('handles connection error in createPrivateRoom', async () => {
    const onStatusChange = vi.fn();
    client.setEventHandlers({ onStatusChange });

    const error = new Error('Create failed');
    mockCreate.mockRejectedValueOnce(error);

    await expect(client.createPrivateRoom()).rejects.toThrow('Create failed');
    expect(client.currentStatus).toBe('error');
    expect(onStatusChange).toHaveBeenCalledWith('connecting');
    expect(onStatusChange).toHaveBeenCalledWith('error');
  });

  it('dispatches client action messages', async () => {
    await client.joinOrCreate('wrestling');

    client.selectFighter('vex');
    expect(mockSend).toHaveBeenCalledWith('selectFighter', expect.objectContaining({ fighterId: 'vex' }));

    client.ready();
    expect(mockSend).toHaveBeenCalledWith('ready', expect.any(Object));

    const dummyAction: ActionEvent = {
      action: 'move',
      phase: 'started',
      sequence: 1,
      timestamp: Date.now(),
      direction: { x: 1, y: 0 },
      source: 'keyboard',
    };
    const seq = client.sendAction(dummyAction);
    expect(seq).toBe(1);
    expect(mockSend).toHaveBeenCalledWith('command', expect.objectContaining({
      type: 'command',
      seq: 1,
    }));

    client.voteRematch();
    expect(mockSend).toHaveBeenCalledWith('rematch', expect.any(Object));
  });

  it('leaves the room cleanly when leave is called', async () => {
    await client.joinOrCreate('wrestling');
    await client.leave();

    expect(client.currentStatus).toBe('disconnected');
    expect(client.isConnected).toBe(false);
    expect(mockLeave).toHaveBeenCalledWith(true);
  });

  it('triggers registered callback events', async () => {
    const onStateChange = vi.fn();
    const onSnapshot = vi.fn();
    const onImpactEvent = vi.fn();
    const onMatchResult = vi.fn();
    const onCommandAck = vi.fn();
    const onRoomState = vi.fn();
    const onVersionRejected = vi.fn();

    const specialClient = new ColyseusClient({
      onStateChange,
      onSnapshot,
      onImpactEvent,
      onMatchResult,
      onCommandAck,
      onRoomState,
      onVersionRejected,
    });

    await specialClient.joinOrCreate('wrestling');

    // Simulate state change
    const dummyState = { phase: 'lobby' } as unknown as ClientRoomState;
    if (mockRoom._stateCallback) {
      mockRoom._stateCallback(dummyState);
    }
    expect(onStateChange).toHaveBeenCalledWith(dummyState);

    // Simulate messages
    const snapshotCb = mockRoom._messageCallbacks.get('snapshot');
    if (snapshotCb) snapshotCb('snap_data');
    expect(onSnapshot).toHaveBeenCalledWith('snap_data');

    const impactCb = mockRoom._messageCallbacks.get('impactEvent');
    if (impactCb) impactCb('impact_data');
    expect(onImpactEvent).toHaveBeenCalledWith('impact_data');

    const resultCb = mockRoom._messageCallbacks.get('matchResult');
    if (resultCb) resultCb('result_data');
    expect(onMatchResult).toHaveBeenCalledWith('result_data');

    const ackCb = mockRoom._messageCallbacks.get('commandAck');
    if (ackCb) ackCb('ack_data');
    expect(onCommandAck).toHaveBeenCalledWith('ack_data');

    const roomStateCb = mockRoom._messageCallbacks.get('roomState');
    if (roomStateCb) roomStateCb('room_state_data');
    expect(onRoomState).toHaveBeenCalledWith('room_state_data');

    const versionCb = mockRoom._messageCallbacks.get('versionRejected');
    if (versionCb) versionCb('version_data');
    expect(onVersionRejected).toHaveBeenCalledWith('version_data');
  });

  it('handles room error event', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await client.joinOrCreate('wrestling');

    if (mockRoom._errorCallback) {
      mockRoom._errorCallback(500, 'Internal Server Error');
    }
    expect(client.currentStatus).toBe('error');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Room error 500: Internal Server Error'));
    consoleSpy.mockRestore();
  });

  it('disconnects on normal clean room leave code 1000', async () => {
    await client.joinOrCreate('wrestling');

    if (mockRoom._leaveCallback) {
      mockRoom._leaveCallback(1000);
    }
    expect(client.currentStatus).toBe('disconnected');
  });

  it('attempts and succeeds at reconnecting on unexpected leave', async () => {
    await client.joinOrCreate('wrestling');

    mockReconnect.mockResolvedValueOnce(mockRoom);

    if (mockRoom._leaveCallback) {
      await mockRoom._leaveCallback(1001);
    }

    expect(client.currentStatus).toBe('connected');
    expect(mockReconnect).toHaveBeenCalledWith('mock-reconnection-token');
  });

  it('sets status to error when reconnection fails', async () => {
    await client.joinOrCreate('wrestling');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockReconnect.mockRejectedValueOnce(new Error('Reconnection token expired'));

    if (mockRoom._leaveCallback) {
      await mockRoom._leaveCallback(1001);
    }

    expect(client.currentStatus).toBe('error');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Reconnect failed'));
    warnSpy.mockRestore();
  });
});

describe('MultiplayerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoom._messageCallbacks.clear();
    mockRoom._stateCallback = null;
    mockRoom._leaveCallback = null;
    mockRoom._errorCallback = null;

    // Reset store state to initial
    useMultiplayerStore.setState({
      status: 'disconnected',
      roomId: null,
      sessionId: null,
      myRole: null,
      roomPhase: 'lobby',
      fighters: new Map(),
      roles: new Map(),
      lastCommandSeq: 0,
    });
  });

  it('connects to matchmaking and synchronizes room state', async () => {
    mockJoinOrCreate.mockResolvedValueOnce(mockRoom);

    await useMultiplayerStore.getState().connect('wrestling', { fighterId: 'atlas' });

    expect(useMultiplayerStore.getState().status).toBe('connected');
    expect(useMultiplayerStore.getState().roomId).toBe('mock-room-id');
    expect(useMultiplayerStore.getState().sessionId).toBe('mock-session-id');

    // Simulate State Sync
    const mockFighters = new Map([
      ['session1', { definitionId: 'atlas', health: 100, stamina: 100 } as unknown as ClientFighterState],
    ]);
    const mockRoles = new Map([
      ['mock-session-id', 'player1'],
      ['session2', 'player2'],
    ]);

    if (mockRoom._stateCallback) {
      mockRoom._stateCallback({
        phase: 'active',
        fighters: mockFighters,
        roles: mockRoles,
      });
    }

    expect(useMultiplayerStore.getState().roomPhase).toBe('active');
    expect(useMultiplayerStore.getState().fighters.get('session1')).toEqual({ definitionId: 'atlas', health: 100, stamina: 100 });
    expect(useMultiplayerStore.getState().roles.get('mock-session-id')).toBe('player1');
    expect(useMultiplayerStore.getState().myRole).toBe('player1');
  });

  it('connects and handles private room creation', async () => {
    mockCreate.mockResolvedValueOnce(mockRoom);

    const roomId = await useMultiplayerStore.getState().createPrivateRoom({ fighterId: 'nova' });

    expect(roomId).toBe('mock-room-id');
    expect(useMultiplayerStore.getState().status).toBe('connected');
    expect(useMultiplayerStore.getState().roomId).toBe('mock-room-id');
    expect(useMultiplayerStore.getState().sessionId).toBe('mock-session-id');
  });

  it('joins room by ID', async () => {
    mockJoinById.mockResolvedValueOnce(mockRoom);

    await useMultiplayerStore.getState().joinByRoomId('specific-room-id', { fighterId: 'vex' });

    expect(useMultiplayerStore.getState().status).toBe('connected');
    expect(useMultiplayerStore.getState().roomId).toBe('mock-room-id');
    expect(useMultiplayerStore.getState().sessionId).toBe('mock-session-id');
  });

  it('sends selectFighter, ready, sendAction, and voteRematch commands', async () => {
    // First establish connection
    mockJoinOrCreate.mockResolvedValueOnce(mockRoom);
    await useMultiplayerStore.getState().connect();

    // selectFighter
    useMultiplayerStore.getState().selectFighter('nova');
    expect(mockSend).toHaveBeenCalledWith('selectFighter', expect.objectContaining({ fighterId: 'nova' }));

    // ready
    useMultiplayerStore.getState().ready();
    expect(mockSend).toHaveBeenCalledWith('ready', expect.any(Object));

    // sendAction
    const dummyAction: ActionEvent = {
      action: 'move',
      phase: 'started',
      sequence: 1,
      timestamp: Date.now(),
      direction: { x: -1, y: 0 },
      source: 'keyboard',
    };
    useMultiplayerStore.getState().sendAction(dummyAction);
    expect(useMultiplayerStore.getState().lastCommandSeq).toBeGreaterThan(0);
    expect(mockSend).toHaveBeenCalledWith('command', expect.objectContaining({
      type: 'command',
    }));

    // voteRematch
    useMultiplayerStore.getState().voteRematch();
    expect(mockSend).toHaveBeenCalledWith('rematch', expect.any(Object));
  });

  it('disconnects and clears state cleanly', async () => {
    // Connect first
    mockJoinOrCreate.mockResolvedValueOnce(mockRoom);
    await useMultiplayerStore.getState().connect();

    // Populate some states
    useMultiplayerStore.setState({
      myRole: 'player1',
      roomPhase: 'active',
      fighters: new Map([['test', {} as unknown as ClientFighterState]]),
      roles: new Map([['test', 'player1']]),
    });

    await useMultiplayerStore.getState().disconnect();

    expect(useMultiplayerStore.getState().status).toBe('disconnected');
    expect(useMultiplayerStore.getState().roomId).toBeNull();
    expect(useMultiplayerStore.getState().sessionId).toBeNull();
    expect(useMultiplayerStore.getState().myRole).toBeNull();
    expect(useMultiplayerStore.getState().fighters.size).toBe(0);
    expect(useMultiplayerStore.getState().roles.size).toBe(0);
    expect(mockLeave).toHaveBeenCalled();
  });
});
