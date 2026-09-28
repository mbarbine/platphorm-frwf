import { gameServerEndpoint } from './serverEndpoint';
import type { ActionEvent, CommandMessage, SelectFighterMessage } from '@frwf/game-protocol';
import type { CommandAckMessage, ImpactEventMessage, LobbyChatEventMessage, MatchResultMessage, RoomStateMessage, SnapshotMessage } from '@frwf/game-protocol';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';

export interface ClientRoomState {
  phase: string; resolved: boolean; elapsed: number; hype: number; announcement: string;
  ruleset: 'standard' | 'chaos'; difficulty: string; winnerSessionId: string; winMethod: string;
  fighters: Map<string, ClientFighterState>; roles: Map<string, string>;
}
export interface ClientFighterState {
  definitionId: string; health: number; stamina: number; momentum: number; posX: number; posZ: number;
  facing: number; velocityX: number; velocityZ: number; combatState: string; moveId: string;
  attackPhase: string; phaseElapsed: number; grappleTargetSessionId: string | null; pinCount: number;
  finisherPrimed: boolean; lastCommandSeq: number;
}
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export interface ColyseusClientOptions {
  serverUrl?: string;
  onStatusChange?: (status: ConnectionStatus) => void;
  onStateChange?: (state: ClientRoomState) => void;
  onSnapshot?: (snapshot: SnapshotMessage) => void;
  onImpactEvent?: (event: ImpactEventMessage) => void;
  onMatchResult?: (result: MatchResultMessage) => void;
  onCommandAck?: (ack: CommandAckMessage) => void;
  onRoomState?: (state: RoomStateMessage) => void;
  onLobbyChat?: (event: LobbyChatEventMessage) => void;
  onVersionRejected?: (info: { serverVersion: string }) => void;
}

const INVITE = /^([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.([a-f0-9]{64})$/i;
export function parseRoomInvite(value: string): { roomId: string; ticket: string } | null {
  let candidate = value.trim();
  try {
    if (/^https?:\/\//i.test(candidate)) {
      const url = new URL(candidate);
      candidate = url.hash.replace(/^#(?:room=)?/, '');
      if (candidate.includes('&')) candidate = new URLSearchParams(candidate).get('room') ?? '';
    }
  } catch { return null; }
  const match = INVITE.exec(candidate);
  return match?.[1] && match[2] ? { roomId: match[1].toLowerCase(), ticket: match[2].toLowerCase() } : null;
}

/** Ticket-authenticated Cloudflare Durable Object WebSocket client. The historical
 * export name remains stable for the Zustand and game-state adapters. */
export class ColyseusClient {
  private socket: WebSocket | null = null;
  private commandSeq = 0;
  private status: ConnectionStatus = 'disconnected';
  private roomIdValue: string | undefined;
  private sessionIdValue: string | undefined;
  private intentionalLeave = false;
  private readonly options: Required<ColyseusClientOptions>;

  constructor(options: ColyseusClientOptions = {}) {
    this.options = {
      serverUrl: options.serverUrl ?? gameServerEndpoint ?? '',
      onStatusChange: options.onStatusChange ?? (() => undefined),
      onStateChange: options.onStateChange ?? (() => undefined),
      onSnapshot: options.onSnapshot ?? (() => undefined),
      onImpactEvent: options.onImpactEvent ?? (() => undefined),
      onMatchResult: options.onMatchResult ?? (() => undefined),
      onCommandAck: options.onCommandAck ?? (() => undefined),
      onRoomState: options.onRoomState ?? (() => undefined),
      onLobbyChat: options.onLobbyChat ?? (() => undefined),
      onVersionRejected: options.onVersionRejected ?? (() => undefined),
    };
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { void this.leave(true); }, { once: true });
  }

  async joinOrCreate(_roomName: string, _options: { fighterId?: string; spectate?: boolean } = {}): Promise<void> {
    throw new Error('Quick matchmaking is unavailable. Join with a private room invitation.');
  }
  async joinRoom(_roomName: string, _options: { fighterId?: string } = {}): Promise<void> {
    throw new Error('Room names are not join codes. Use the room ID and private ticket from your invitation.');
  }
  async createPrivateRoom(options: { fighterId?: string; ruleset?: string } = {}): Promise<{ roomId: string; joinInvite: string; guestInvites: string[] }> {
    if (!this.options.serverUrl) throw new Error('The Cloudflare match service is not configured for this environment.');
    const endpoint = new URL('/api/rooms', this.options.serverUrl);
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fighterId: options.fighterId ?? 'atlas', ruleset: options.ruleset ?? 'standard' }) });
    const payload = await response.json() as { ok?: boolean; data?: { roomId?: string; hostInvite?: string; joinInvite?: string; guestInvites?: string[] }; error?: { code?: string } };
    if (!response.ok || !payload.ok || !payload.data?.roomId || !payload.data.hostInvite || !payload.data.joinInvite) {
      throw new Error(payload.error?.code === 'room_host_rate_limited' ? 'Too many matches were hosted from this connection. Try again in a minute.' : 'Could not host a match. Check your connection and try again.');
    }
    await this.joinByRoomId(payload.data.hostInvite);
    return { roomId: payload.data.roomId, joinInvite: payload.data.joinInvite, guestInvites: payload.data.guestInvites ?? [payload.data.joinInvite] };
  }

  async joinByRoomId(inviteOrUrl: string, options: { fighterId?: string } = {}): Promise<void> {
    const invite = parseRoomInvite(inviteOrUrl);
    if (!invite) throw new Error('Enter a complete private room invitation (room ID and seat ticket).');
    if (!this.options.serverUrl) throw new Error('The Cloudflare match service is not configured for this environment.');
    this.intentionalLeave = false;
    this.roomIdValue = invite.roomId; this.commandSeq = 0;
    this.setStatus('connecting');
    const base = new URL(this.options.serverUrl);
    base.protocol = base.protocol === 'https:' || base.protocol === 'wss:' ? 'wss:' : 'ws:';
    base.pathname = `/api/rooms/${invite.roomId}/socket`; base.search = ''; base.hash = '';
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(base.toString(), ['frwf-v1', invite.ticket]);
      this.socket = socket;
      const timeout = setTimeout(() => { socket.close(); reject(new Error('Match server connection timed out.')); }, 12000);
      socket.addEventListener('open', () => {
        clearTimeout(timeout);
        if (socket.protocol !== 'frwf-v1') { socket.close(1002, 'Protocol mismatch'); this.setStatus('error'); reject(new Error('Match server protocol mismatch.')); return; }
        this.setStatus('connected'); resolve();
      }, { once: true });
      socket.addEventListener('error', () => {
        clearTimeout(timeout); this.setStatus('error'); reject(new Error('Could not connect to the private match. Check the invitation and try again.'));
      }, { once: true });
      socket.addEventListener('message', event => this.receive(event.data));
      socket.addEventListener('close', event => {
        clearTimeout(timeout);
        if (this.socket !== socket) return;
        this.socket = null;
        if (this.intentionalLeave || event.code === 1000) this.setStatus('disconnected');
        else this.setStatus('error');
      });
    });
    if (options.fighterId) this.selectFighter(options.fighterId);
  }

  async leave(_consented = true): Promise<void> {
    this.intentionalLeave = true;
    const socket = this.socket;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'leave', protocolVersion: PROTOCOL_VERSION }));
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'Player left');
    this.roomIdValue = undefined; this.sessionIdValue = undefined;
    this.setStatus('disconnected');
  }

  selectFighter(fighterId: string): void {
    const msg: SelectFighterMessage = { type: 'selectFighter', fighterId: fighterId as SelectFighterMessage['fighterId'], protocolVersion: PROTOCOL_VERSION };
    this.send(msg);
  }
  ready(ready = true): void { this.send({ type: 'ready', ready, protocolVersion: PROTOCOL_VERSION }); }
  startMatch(): void { this.send({ type: 'startMatch', protocolVersion: PROTOCOL_VERSION }); }
  sendLobbyChat(text: string): void { this.send({ type: 'lobbyChat', text, protocolVersion: PROTOCOL_VERSION }); }
  sendAction(event: ActionEvent): number {
    this.commandSeq += 1;
    const msg: CommandMessage = { type: 'command', event: { ...event, sequence: this.commandSeq, source: 'network' },
      seq: this.commandSeq, clientTimestamp: performance.now(), protocolVersion: PROTOCOL_VERSION };
    this.send(msg); return this.commandSeq;
  }
  voteRematch(): void { this.send({ type: 'rematch', protocolVersion: PROTOCOL_VERSION }); }
  updateRoomSettings(ruleset: 'standard' | 'chaos'): void { this.send({ type: 'hostSettings', ruleset, protocolVersion: PROTOCOL_VERSION }); }

  get roomId(): string | undefined { return this.roomIdValue; }
  get sessionId(): string | undefined { return this.sessionIdValue; }
  get currentStatus(): ConnectionStatus { return this.status; }
  get isConnected(): boolean { return this.status === 'connected'; }

  setEventHandlers(handlers: Partial<ColyseusClientOptions>): void { Object.assign(this.options, handlers); }

  private send(message: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
  private receive(raw: unknown) {
    if (typeof raw !== 'string') return;
    let message: Record<string, unknown>;
    try { message = JSON.parse(raw) as Record<string, unknown>; } catch { return; }
    switch (message.type) {
      case 'welcome':
        if (typeof message.sessionId === 'string') this.sessionIdValue = message.sessionId;
        if (typeof message.lastCommandSeq === 'number') this.commandSeq = message.lastCommandSeq;
        break;
      case 'roomState': {
        const state = message as unknown as RoomStateMessage;
        this.options.onRoomState(state);
        const fighters = new Map(state.fighters.map(f => [f.sessionId, { definitionId: f.definitionId } as ClientFighterState]));
        const roles = new Map(state.roles.map(r => [r.sessionId, r.role]));
        this.options.onStateChange({ phase: state.phase, resolved: state.phase === 'result', elapsed: 0, hype: 0, announcement: '', ruleset: state.ruleset, difficulty: 'normal', winnerSessionId: '', winMethod: '', fighters, roles });
        break;
      }
      case 'lobbyChatEvent': this.options.onLobbyChat(message as unknown as LobbyChatEventMessage); break;
      case 'snapshot': this.options.onSnapshot(message as unknown as SnapshotMessage); break;
      case 'impactEvent': this.options.onImpactEvent(message as unknown as ImpactEventMessage); break;
      case 'matchResult': this.options.onMatchResult(message as unknown as MatchResultMessage); break;
      case 'commandAck': this.options.onCommandAck(message as unknown as CommandAckMessage); break;
      case 'versionRejected': this.options.onVersionRejected({ serverVersion: String(message.serverVersion ?? 'unknown') }); break;
    }
  }
  private setStatus(status: ConnectionStatus): void { this.status = status; this.options.onStatusChange(status); }
}

export const colyseusClient = new ColyseusClient();
