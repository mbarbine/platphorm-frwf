import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActionEvent } from '@frwf/game-protocol';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';
import { ColyseusClient, parseRoomInvite } from '../game/multiplayer/ColyseusClient';

const roomId = '12345678-1234-4123-8123-123456789abc';
const ticket = 'a'.repeat(64);
const invite = `${roomId}.${ticket}`;

class FakeWebSocket extends EventTarget {
  static OPEN = 1;
  static CLOSING = 2;
  readyState = FakeWebSocket.OPEN;
  protocol = 'frwf-v1';
  readonly sent: string[] = [];
  constructor(readonly url: string, readonly protocols: string[]) {
    super();
    queueMicrotask(() => this.dispatchEvent(new Event('open')));
  }
  send(message: string) { this.sent.push(message); }
  close() { this.readyState = FakeWebSocket.CLOSING; this.dispatchEvent(new CloseEvent('close', { code: 1000 })); }
  receive(value: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })); }
}

afterEach(() => vi.unstubAllGlobals());

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
    expect(sent.map(message => message.type)).toEqual(['selectFighter', 'ready', 'command', 'rematch']);
    expect(sent[0]).toMatchObject({ fighterId: 'nova', protocolVersion: PROTOCOL_VERSION });
    expect(sent[2]).toMatchObject({ seq: 1, event: { source: 'network', sequence: 1 }, protocolVersion: PROTOCOL_VERSION });
  });

  it('rejects incomplete join codes and explains protected room creation', async () => {
    const client = new ColyseusClient({ serverUrl: 'https://frwf.ja1.io' });
    await expect(client.joinByRoomId(roomId)).rejects.toThrow('complete private room invitation');
    await expect(client.createPrivateRoom()).rejects.toThrow('protected operator API');
  });
});
