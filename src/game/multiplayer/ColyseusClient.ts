import { Client } from 'colyseus.js';
import type { Room } from 'colyseus.js';
import type { ActionEvent, CommandMessage, SelectFighterMessage } from '@frwf/game-protocol';
import type { CommandAckMessage, ImpactEventMessage, MatchResultMessage, RoomStateMessage, SnapshotMessage } from '@frwf/game-protocol';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';

// Client-side view of the server room state.
// Uses a plain interface — no Colyseus schema decorators.
// The server's MatchRoomStateSchema must stay in the server package.
export interface ClientRoomState {
  phase: string;
  resolved: boolean;
  elapsed: number;
  hype: number;
  announcement: string;
  ruleset: string;
  difficulty: string;
  winnerSessionId: string;
  winMethod: string;
  fighters: Map<string, ClientFighterState>;
  roles: Map<string, string>;
}

export interface ClientFighterState {
  definitionId: string;
  health: number;
  stamina: number;
  momentum: number;
  posX: number;
  posZ: number;
  facing: number;
  velocityX: number;
  velocityZ: number;
  combatState: string;
  moveId: string;
  attackPhase: string;
  phaseElapsed: number;
  grappleTargetSessionId: string | null;
  pinCount: number;
  finisherPrimed: boolean;
  lastCommandSeq: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// ColyseusClient — thin wrapper around the Colyseus SDK.
//
// Authority model:
//   CLIENT: local prediction, camera, effects, audio, HUD
//   SERVER: match state, damage, grapple ownership, pin result, knockout
//
// The client buffers commands, sends them with a sequence number, and reconciles
// when the server's acknowledged sequence diverges from the local prediction.
// ──────────────────────────────────────────────────────────────────────────────

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
  onVersionRejected?: (info: { serverVersion: string }) => void;
}

const DEFAULT_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:2567';

export class ColyseusClient {
  private readonly sdk: Client;
  private room: Room<ClientRoomState> | null = null;
  private commandSeq = 0;
  private status: ConnectionStatus = 'disconnected';
  private intentionalLeave = false;
  private readonly options: Required<ColyseusClientOptions>;

  constructor(options: ColyseusClientOptions = {}) {
    this.sdk = new Client(options.serverUrl ?? DEFAULT_SERVER_URL);
    this.options = {
      serverUrl: options.serverUrl ?? DEFAULT_SERVER_URL,
      onStatusChange: options.onStatusChange ?? (() => undefined),
      onStateChange: options.onStateChange ?? (() => undefined),
      onSnapshot: options.onSnapshot ?? (() => undefined),
      onImpactEvent: options.onImpactEvent ?? (() => undefined),
      onMatchResult: options.onMatchResult ?? (() => undefined),
      onCommandAck: options.onCommandAck ?? (() => undefined),
      onRoomState: options.onRoomState ?? (() => undefined),
      onVersionRejected: options.onVersionRejected ?? (() => undefined),
    };
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => {
      this.intentionalLeave = true;
      void this.room?.leave(true).catch(() => undefined);
    });
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  async joinOrCreate(roomName: string, options: { fighterId?: string; spectate?: boolean } = {}): Promise<void> {
    this.intentionalLeave = false;
    this.setStatus('connecting');
    try {
      this.room = await this.sdk.joinOrCreate<ClientRoomState>(roomName, options);
      this.setStatus('connected');
      this.attachRoomListeners();
      this.room.send('version', { protocolVersion: PROTOCOL_VERSION, clientVersion: PROTOCOL_VERSION });
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  async joinRoom(roomName: string, options: { fighterId?: string } = {}): Promise<void> {
    this.setStatus('connecting');
    try {
      this.room = await this.sdk.joinOrCreate<ClientRoomState>(roomName, options);
      this.setStatus('connected');
      this.attachRoomListeners();
      this.room.send('version', { protocolVersion: PROTOCOL_VERSION, clientVersion: PROTOCOL_VERSION });
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  async joinByRoomId(roomId: string, options: { fighterId?: string } = {}): Promise<void> {
    this.intentionalLeave = false;
    this.setStatus('connecting');
    try {
      this.room = await this.sdk.joinById<ClientRoomState>(roomId, options);
      this.setStatus('connected');
      this.attachRoomListeners();
      this.room.send('version', { protocolVersion: PROTOCOL_VERSION, clientVersion: PROTOCOL_VERSION });
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  async createPrivateRoom(options: { fighterId?: string; ruleset?: string } = {}): Promise<string> {
    this.intentionalLeave = false;
    this.setStatus('connecting');
    try {
      this.room = await this.sdk.create<ClientRoomState>('practice', { ...options, private: true });
      this.setStatus('connected');
      this.attachRoomListeners();
      this.room.send('version', { protocolVersion: PROTOCOL_VERSION, clientVersion: PROTOCOL_VERSION });
      return this.room.id;
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  async leave(consented = true): Promise<void> {
    this.intentionalLeave = true;
    await this.room?.leave(consented);
    this.room = null;
    this.setStatus('disconnected');
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  selectFighter(fighterId: string): void {
    const msg: SelectFighterMessage = { type: 'selectFighter', fighterId: fighterId as SelectFighterMessage['fighterId'], protocolVersion: PROTOCOL_VERSION };
    this.room?.send('selectFighter', msg);
  }

  ready(): void {
    this.room?.send('ready', { protocolVersion: PROTOCOL_VERSION });
  }

  /** Send one semantic action. Returns the network sequence used for reconciliation. */
  sendAction(event: ActionEvent): number {
    this.commandSeq += 1;
    const msg: CommandMessage = {
      type: 'command',
      event: { ...event, sequence: this.commandSeq, source: 'network' },
      seq: this.commandSeq,
      clientTimestamp: performance.now(),
      protocolVersion: PROTOCOL_VERSION,
    };
    this.room?.send('command', msg);
    return this.commandSeq;
  }

  voteRematch(): void {
    this.room?.send('rematch', { protocolVersion: PROTOCOL_VERSION });
  }

  // ── Room info ──────────────────────────────────────────────────────────────

  get roomId(): string | undefined { return this.room?.id; }
  get sessionId(): string | undefined { return this.room?.sessionId; }
  get currentStatus(): ConnectionStatus { return this.status; }
  get isConnected(): boolean { return this.status === 'connected'; }

  setEventHandlers(handlers: Partial<Pick<ColyseusClientOptions, 'onStatusChange' | 'onStateChange' | 'onSnapshot' | 'onImpactEvent' | 'onMatchResult' | 'onCommandAck' | 'onRoomState'>>): void {
    if (handlers.onStatusChange) this.options.onStatusChange = handlers.onStatusChange;
    if (handlers.onStateChange) this.options.onStateChange = handlers.onStateChange;
    if (handlers.onSnapshot) this.options.onSnapshot = handlers.onSnapshot;
    if (handlers.onImpactEvent) this.options.onImpactEvent = handlers.onImpactEvent;
    if (handlers.onMatchResult) this.options.onMatchResult = handlers.onMatchResult;
    if (handlers.onCommandAck) this.options.onCommandAck = handlers.onCommandAck;
    if (handlers.onRoomState) this.options.onRoomState = handlers.onRoomState;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private attachRoomListeners(): void {
    if (!this.room) return;

    this.room.onStateChange((state) => this.options.onStateChange(state));
    this.room.onMessage('snapshot', (msg) => this.options.onSnapshot(msg));
    this.room.onMessage('impactEvent', (msg) => this.options.onImpactEvent(msg));
    this.room.onMessage('matchResult', (msg) => this.options.onMatchResult(msg));
    this.room.onMessage('commandAck', (msg) => this.options.onCommandAck(msg));
    this.room.onMessage('roomState', (msg) => this.options.onRoomState(msg));
    this.room.onMessage('versionRejected', (msg) => this.options.onVersionRejected(msg));
    this.room.onLeave((code) => {
      if (code === 1000 || this.intentionalLeave) {
        this.setStatus('disconnected');
      } else {
        this.setStatus('reconnecting');
        void this.attemptReconnect();
      }
    });
    this.room.onError((code, message) => {
      console.error(`[ColyseusClient] Room error ${code}: ${message}`);
      this.setStatus('error');
    });
    // Colyseus resolves join only after decoding the initial schema. Listener
    // registration does not replay that already-decoded state, so publish it
    // once here and let subsequent patches flow through onStateChange.
    if (this.room.state) this.options.onStateChange(this.room.state);
    this.room.send('syncState', { protocolVersion: PROTOCOL_VERSION });
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.room) return;
    const reconnectionToken = this.room.reconnectionToken;
    try {
      this.room = await this.sdk.reconnect<ClientRoomState>(reconnectionToken);
      this.attachRoomListeners();
      this.setStatus('connected');
      console.log('[ColyseusClient] Reconnected');
    } catch {
      this.setStatus('error');
      console.warn('[ColyseusClient] Reconnect failed');
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.options.onStatusChange(status);
  }
}

/** Singleton client for the current browser session. */
export const colyseusClient = new ColyseusClient();
