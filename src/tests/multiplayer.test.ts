import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActionEvent } from '@frwf/game-protocol';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';
import { ColyseusClient, parseRoomInvite } from '../game/multiplayer/ColyseusClient';

const roomId = '12345678-1234-4123-8123-123456789abc';
const ticket = 'a'.repeat(64);
const invite = `${roomId}.${ticket}`;

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  static CLOSING = 2;
  readyState = FakeWebSocket.OPEN;
  protocol = 'frwf-v1';
  readonly sent: string[] = [];
  constructor(readonly url: string, readonly protocols: string[]) {
    super();
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => this.dispatchEvent(new Event('open')));
  }
  send(message: string) { this.sent.push(message); }
  close() { this.readyState = FakeWebSocket.CLOSING; this.dispatchEvent(new CloseEvent('close', { code: 1000 })); }
  receive(value: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })); }
}

afterEach(() => {
  for (const socket of FakeWebSocket.instances) socket.close();
  FakeWebSocket.instances = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Cloudflare room invitations', () => {
  it('parses a room ID and ticket from pasted invite links without using the query string', () => {
    expect(parseRoomInvite(invite)).toEqual({ roomId, ticket });
    expect(parseRoomInvite(`https://frwf.ja1.io/#room=${invite}`)).toEqual({ roomId, ticket });
    expect(parseRoomInvite(roomId)).toBeNull();
    expect(parseRoomInvite(`https://frwf.ja1.io/?room=${invite}`)).toBeNull();
  });

  it('uses the deployed Worker WebSocket path and the scoped ticket subprotocol', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const client = new ColyseusClient({ serverUrl: 'https://frwf.ja1.io' });
    await client.joinByRoomId(`https://frwf.ja1.io/#room=${invite}`);
    const socket = (client as unknown as { socket: FakeWebSocket }).socket;
    expect(socket.url).toBe(`wss://frwf.ja1.io/api/rooms/${roomId}/socket`);
    expect(socket.protocols).toEqual(['frwf-v1', ticket]);
    expect(client.currentStatus).toBe('connected');
    expect(client.roomId).toBe(roomId);
  });

  it('routes authoritative state, snapshot, impact, result and ack messages to the game adapters', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const onRoomState = vi.fn(); const onStateChange = vi.fn(); const onSnapshot = vi.fn();
    const onImpactEvent = vi.fn(); const onMatchResult = vi.fn(); const onCommandAck = vi.fn();
    const client = new ColyseusClient({ serverUrl: 'https://frwf.ja1.io', onRoomState, onStateChange, onSnapshot, onImpactEvent, onMatchResult, onCommandAck });
    await client.joinByRoomId(invite);
    const socket = (client as unknown as { socket: FakeWebSocket }).socket;
    socket.receive({ type: 'welcome', roomId, sessionId: 'seat-one', lastCommandSeq: 0 });
    socket.receive({ type: 'roomState', phase: 'lobby', roles: [{ sessionId: 'seat-one', role: 'player1' }], fighters: [{ sessionId: 'seat-one', definitionId: 'atlas' }] });
    socket.receive({ type: 'snapshot', seq: 1, elapsed: 2, hype: 4, announcement: null, fighters: [] });
    socket.receive({ type: 'impactEvent', impactId: 1 });
    socket.receive({ type: 'matchResult', winner: 'seat-one', method: 'KNOCKOUT', duration: 2, hype: 4, grade: 'D' });
    socket.receive({ type: 'commandAck', seq: 1, accepted: true, serverTimestamp: 5 });
    expect(client.sessionId).toBe('seat-one');
    expect(onRoomState).toHaveBeenCalledOnce();
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ phase: 'lobby', roles: expect.any(Map), fighters: expect.any(Map) }));
    expect(onSnapshot).toHaveBeenCalledOnce(); expect(onImpactEvent).toHaveBeenCalledOnce();
    expect(onMatchResult).toHaveBeenCalledOnce(); expect(onCommandAck).toHaveBeenCalledOnce();
  });

  it('sends versioned fighter selection, readiness, sequenced actions and rematch votes', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const client = new ColyseusClient({ serverUrl: 'https://frwf.ja1.io' });
    await client.joinByRoomId(invite);
    const socket = (client as unknown as { socket: FakeWebSocket }).socket;
    client.selectFighter('nova'); client.ready();
    const action: ActionEvent = { action: 'quickStrike', phase: 'started', sequence: 0, timestamp: Date.now(), direction: { x: 1, y: 0 }, source: 'keyboard' };
    expect(client.sendAction(action)).toBe(1); client.voteRematch();
    const sent = socket.sent.map(value => JSON.parse(value));
    expect(sent.map(message => message.type)).toEqual(['requestRoomState', 'selectFighter', 'ready', 'command', 'rematch']);
    expect(sent[1]).toMatchObject({ fighterId: 'nova', protocolVersion: PROTOCOL_VERSION });
    expect(sent[2]).toMatchObject({ ready: true, protocolVersion: PROTOCOL_VERSION });
    expect(sent[3]).toMatchObject({ seq: 1, event: { source: 'network', sequence: 1 }, protocolVersion: PROTOCOL_VERSION });
  });

  it('keeps idle clients alive, measures RTT, and stops heartbeats when leaving', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const onHeartbeat = vi.fn();
    const client = new ColyseusClient({ serverUrl: 'https://frwf.ja1.io', onHeartbeat });
    await client.joinByRoomId(invite);
    const socket = FakeWebSocket.instances.at(-1);
    if (!socket) throw new Error('Client socket was not created');
    await vi.advanceTimersByTimeAsync(10_000);
    const ping = socket.sent.map(value => JSON.parse(value)).find(message => message.type === 'ping');
    expect(ping).toMatchObject({ type: 'ping', protocolVersion: PROTOCOL_VERSION });
    expect(Number.isFinite(ping.clientTimestamp)).toBe(true);
    socket.receive({ type: 'pong', clientTimestamp: performance.now() - 25 });
    expect(onHeartbeat).toHaveBeenCalledWith(expect.any(Number));
    expect(onHeartbeat.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(25);
    await client.leave();
    const sentAtLeave = socket.sent.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(socket.sent).toHaveLength(sentAtLeave);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes the previous room before replacing its connection', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const client = new ColyseusClient({ serverUrl: 'https://frwf.ja1.io' });
    await client.joinByRoomId(invite);
    const previous = FakeWebSocket.instances.at(-1);
    if (!previous) throw new Error('Client socket was not created');
    await client.joinByRoomId(invite);
    expect(previous.readyState).toBe(FakeWebSocket.CLOSING);
    const previousCount = previous.sent.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(previous.sent).toHaveLength(previousCount);
    expect(FakeWebSocket.instances.at(-1)?.sent.map(value => JSON.parse(value).type)).toEqual(['requestRoomState', 'ping']);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('keeps the shared invite reusable while privately resuming this browser into its assigned seat', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const client = new ColyseusClient({ serverUrl: 'https://frwf.ja1.io' });
    await client.joinByRoomId(invite);
    const first = FakeWebSocket.instances.at(-1);
    if (!first) throw new Error('Client socket was not created');
    const resumeTicket = 'c'.repeat(64);
    first.receive({ type: 'welcome', roomId, sessionId: 'guest-seat', lastCommandSeq: 0, resumeTicket });
    expect(sessionStorage.getItem(`frwf-room-resume:${roomId}`)).toBe(resumeTicket);
    await client.leave(false);
    expect(sessionStorage.getItem(`frwf-room-resume:${roomId}`)).toBe(resumeTicket);

    const resumed = new ColyseusClient({ serverUrl: 'https://frwf.ja1.io' });
    await resumed.joinByRoomId(invite);
    expect(FakeWebSocket.instances.at(-1)?.protocols).toEqual(['frwf-v1', resumeTicket]);
    await resumed.leave();
    expect(sessionStorage.getItem(`frwf-room-resume:${roomId}`)).toBeNull();
  });

  it('publishes a late welcome identity to the lobby store after socket open', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const { useMultiplayerStore } = await import('../game/multiplayer/MultiplayerStore');
    await useMultiplayerStore.getState().joinByRoomId(invite);
    expect(useMultiplayerStore.getState().sessionId).toBeNull();
    const socket = FakeWebSocket.instances.at(-1);
    if (!socket) throw new Error('Client socket was not created');
    socket.receive({ type: 'welcome', roomId, sessionId: 'seat-two', lastCommandSeq: 0 });
    socket.receive({ type: 'roomState', phase: 'lobby', hostSessionId: 'seat-one', ruleset: 'standard', chat: [],
      roles: [{ sessionId: 'seat-one', role: 'player1', connected: true, ready: true }, { sessionId: 'seat-two', role: 'player2', connected: true, ready: false }],
      fighters: [{ sessionId: 'seat-one', definitionId: 'atlas' }, { sessionId: 'seat-two', definitionId: 'nova' }] });
    expect(useMultiplayerStore.getState()).toMatchObject({ sessionId: 'seat-two', myRole: 'player2', hostSessionId: 'seat-one' });
    useMultiplayerStore.getState().setReady(true);
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ type: 'ready', ready: true });
    await useMultiplayerStore.getState().disconnect();
  });

  it('rejects incomplete join codes', async () => {
    const client = new ColyseusClient({ serverUrl: 'https://frwf.ja1.io' });
    await expect(client.joinByRoomId(roomId)).rejects.toThrow('complete private room invitation');
  });

  it('creates a room without a platform credential, connects the host seat, and returns a shareable opponent link', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const joinInvite = `https://frwf.ja1.io/#room=${roomId}.${'b'.repeat(64)}`;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true, data: {
      roomId, hostInvite: `https://frwf.ja1.io/#room=${invite}`, joinInvite,
    } }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new ColyseusClient({ serverUrl: 'https://frwf.ja1.io' });
    const result = await client.createPrivateRoom({ fighterId: 'chelsea' });
    expect(result).toEqual({ roomId, joinInvite });
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://frwf.ja1.io/api/rooms'), expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }));
    const socket = (client as unknown as { socket: FakeWebSocket }).socket;
    expect(socket.protocols).toEqual(['frwf-v1', ticket]);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({ fighterId: 'chelsea', ruleset: 'standard' });
  });
});
