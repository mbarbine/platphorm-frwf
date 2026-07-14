import { Room, Client, Delayed } from 'colyseus';
import { MatchRoomStateSchema, FighterStateSchema } from './WrestlingRoomState';
import { SERVER_CONFIG } from '../config';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';
import type { FighterId, GameCommand, PlayerRole } from '@frwf/game-protocol';
// Future: import { createMatch, advanceMatch, requestCommand } from '@frwf/game-core';

// ──────────────────────────────────────────────────────────────────────────────
// Internal session record — not part of the synchronized state.
// ──────────────────────────────────────────────────────────────────────────────

interface PlayerSession {
  readonly sessionId: string;
  role: PlayerRole;
  fighterId: FighterId;
  ready: boolean;
  connected: boolean;
  lastCommandSeq: number;
  reconnectToken?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Incoming message shapes (validated before use)
// ──────────────────────────────────────────────────────────────────────────────

interface SelectFighterMsg { fighterId: FighterId }
interface CommandMsg { command: GameCommand; direction: { x: number; z: number }; running: boolean; block: boolean; seq: number }
interface VersionMsg { clientVersion: string }

// ──────────────────────────────────────────────────────────────────────────────
// WrestlingRoom
// ──────────────────────────────────────────────────────────────────────────────

export class WrestlingRoom extends Room<MatchRoomStateSchema> {
  maxClients = SERVER_CONFIG.MAX_CLIENTS_PER_ROOM;

  private readonly sessions = new Map<string, PlayerSession>();
  private simulationClock?: Delayed;
  private snapshotClock?: Delayed;
  private snapshotSeq = 0;

  /** Future game-core match model (authoritative deterministic simulation). */
  // private matchModel: MatchModel | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async onCreate(options: { ruleset?: string; difficulty?: string; private?: boolean }): Promise<void> {
    this.setState(new MatchRoomStateSchema());
    this.state.ruleset = options.ruleset ?? 'standard';
    this.state.difficulty = options.difficulty ?? 'normal';
    this.state.seed = Math.floor(Math.random() * 0xFFFFFF);
    this.state.serverVersion = PROTOCOL_VERSION;
    this.state.phase = 'lobby';

    if (options.private) this.setPrivate(true);

    this.clock.start();

    this.registerHandlers();

    this.onMessage('version', (client, msg: VersionMsg) => {
      if (msg.clientVersion !== PROTOCOL_VERSION) {
        client.send('versionRejected', { serverVersion: PROTOCOL_VERSION, minClientVersion: PROTOCOL_VERSION });
        client.leave(4000);
      }
    });

    this.log('Created', { ruleset: this.state.ruleset, difficulty: this.state.difficulty });
  }

  async onJoin(client: Client, options: { fighterId?: FighterId; spectate?: boolean }): Promise<void> {
    const activePlayers = [...this.sessions.values()].filter(s => s.role !== 'spectator' && s.connected);
    const role: PlayerRole = options.spectate || activePlayers.length >= 2
      ? 'spectator'
      : activePlayers.length === 0 ? 'player1' : 'player2';

    const session: PlayerSession = {
      sessionId: client.sessionId,
      role,
      fighterId: this.validatedFighterId(options.fighterId),
      ready: false,
      connected: true,
      lastCommandSeq: 0,
    };
    this.sessions.set(client.sessionId, session);

    // Initialize fighter state in the synchronized schema
    const fighterState = new FighterStateSchema();
    fighterState.definitionId = session.fighterId;
    fighterState.posX = role === 'player1' ? -2.3 : 2.3;
    fighterState.facing = role === 'player1' ? 0 : Math.PI;
    this.state.fighters.set(client.sessionId, fighterState);
    this.state.roles.set(client.sessionId, role);

    this.log(`${client.sessionId} joined as ${role} (${session.fighterId})`);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const session = this.sessions.get(client.sessionId);
    if (!session) return;

    if (!consented && session.role !== 'spectator' && this.state.phase === 'active') {
      session.connected = false;
      this.log(`${client.sessionId} disconnected — holding seat for ${SERVER_CONFIG.RECONNECT_GRACE_SECONDS}s`);
      try {
        await this.allowReconnection(client, SERVER_CONFIG.RECONNECT_GRACE_SECONDS);
        session.connected = true;
        this.log(`${client.sessionId} reconnected`);
      } catch {
        this.log(`${client.sessionId} did not reconnect — replacing with AI`);
        this.replaceWithAI(session);
      }
    } else {
      this.sessions.delete(client.sessionId);
      this.state.fighters.delete(client.sessionId);
      this.state.roles.delete(client.sessionId);
    }
  }

  async onDispose(): Promise<void> {
    this.simulationClock?.clear();
    this.snapshotClock?.clear();
    this.log('Disposed');
  }

  // ── Message handlers ───────────────────────────────────────────────────────

  private registerHandlers(): void {
    this.onMessage<SelectFighterMsg>('selectFighter', (client, msg) => this.handleSelectFighter(client, msg));
    this.onMessage('ready', (client) => this.handleReady(client));
    this.onMessage<CommandMsg>('command', (client, msg) => this.handleCommand(client, msg));
    this.onMessage('rematch', (client) => this.handleRematch(client));
    this.onMessage('pause', (client, msg: { paused: boolean }) => {
      // Pause is only respected in single-player practice mode
      if (this.singlePlayerMode()) {
        this.state.phase = msg.paused ? 'lobby' : 'active'; // simple toggle, full impl TBD
      }
    });
  }

  private handleSelectFighter(client: Client, msg: SelectFighterMsg): void {
    if (this.state.phase !== 'lobby' && this.state.phase !== 'selection') return;
    const session = this.sessions.get(client.sessionId);
    if (!session || session.role === 'spectator') return;

    session.fighterId = this.validatedFighterId(msg.fighterId);
    const fighter = this.state.fighters.get(client.sessionId);
    if (fighter) fighter.definitionId = session.fighterId;
    this.state.phase = 'selection';
    this.log(`${client.sessionId} selected ${session.fighterId}`);
  }

  private handleReady(client: Client): void {
    if (!['lobby', 'selection'].includes(this.state.phase)) return;
    const session = this.sessions.get(client.sessionId);
    if (!session || session.role === 'spectator') return;

    session.ready = true;
    const players = this.activePlayers();
    if (players.length >= 2 && players.every(s => s.ready)) this.startMatch();
    else if (players.length === 1 && players[0]?.ready) this.startSinglePlayer();
  }

  private handleCommand(client: Client, msg: CommandMsg): void {
    if (this.state.phase !== 'active') return;
    const session = this.sessions.get(client.sessionId);
    if (!session || session.role === 'spectator') return;

    // Reject duplicate or out-of-order commands
    if (msg.seq <= session.lastCommandSeq) return;
    session.lastCommandSeq = msg.seq;

    // Update last acknowledged sequence in the synchronized state
    const fighter = this.state.fighters.get(client.sessionId);
    if (fighter) fighter.lastCommandSeq = msg.seq;

    // Acknowledge immediately for client-side reconciliation
    client.send('commandAck', { seq: msg.seq, serverTimestamp: this.clock.elapsedTime });

    // Apply to deterministic simulation (game-core integration point)
    // const actorKey = session.role === 'player1' ? 'player' : 'opponent';
    // if (this.matchModel) requestCommand(this.matchModel, actorKey, msg.command, msg.direction, msg.running);
  }

  private handleRematch(client: Client): void {
    if (this.state.phase !== 'result') return;
    this.state.rematchVotes.set(client.sessionId, true);

    const players = this.activePlayers();
    if (players.length >= 1 && players.every(s => this.state.rematchVotes.get(s.sessionId) === true)) {
      players.forEach(s => this.state.rematchVotes.delete(s.sessionId));
      players.forEach(s => { s.ready = false; });
      this.startMatch();
    }
  }

  // ── Match lifecycle ────────────────────────────────────────────────────────

  private startMatch(): void {
    const players = this.activePlayers();
    if (players.length < 2) return;

    const p1 = players.find(s => s.role === 'player1')!;
    const p2 = players.find(s => s.role === 'player2')!;

    // Initialize game-core model (integration hook)
    // this.matchModel = createMatch(p1.fighterId, p2.fighterId, this.state.ruleset, this.state.difficulty, this.state.seed);

    this.state.phase = 'active';
    this.state.resolved = false;
    this.state.elapsed = 0;
    this.state.announcement = 'ROUND ONE — FIGHT!';
    this.state.announcementTimer = 2.2;
    this.state.winnerSessionId = '';
    this.state.winMethod = '';

    this.simulationClock = this.clock.setInterval(
      () => this.tick(),
      1000 / SERVER_CONFIG.SERVER_TICK_RATE,
    );
    this.snapshotClock = this.clock.setInterval(
      () => this.broadcastSnapshot(),
      1000 / SERVER_CONFIG.SNAPSHOT_RATE,
    );

    this.log(`Match started: ${p1.fighterId} vs ${p2.fighterId}`);
  }

  private startSinglePlayer(): void {
    const p1 = this.activePlayers()[0];
    if (!p1) return;

    this.state.phase = 'active';
    this.state.resolved = false;
    this.state.elapsed = 0;
    this.state.announcement = 'ROUND ONE — FIGHT!';

    this.simulationClock = this.clock.setInterval(
      () => this.tick(),
      1000 / SERVER_CONFIG.SERVER_TICK_RATE,
    );
    this.snapshotClock = this.clock.setInterval(
      () => this.broadcastSnapshot(),
      1000 / SERVER_CONFIG.SNAPSHOT_RATE,
    );

    this.log(`Single-player match started (${p1.fighterId} vs AI)`);
  }

  private tick(): void {
    if (this.state.phase !== 'active') return;

    const dt = 1 / SERVER_CONFIG.SERVER_TICK_RATE;
    this.state.elapsed += dt;
    if (this.state.announcementTimer > 0) this.state.announcementTimer = Math.max(0, this.state.announcementTimer - dt);
    if (this.state.announcementTimer === 0 && this.state.announcement) this.state.announcement = '';

    // Run deterministic simulation (game-core integration hook)
    // if (this.matchModel) {
    //   advanceMatch(this.matchModel, dt, { move: { x: 0, z: 0 }, run: false, block: false, commands: [] });
    //   this.syncStateFromModel();
    //   if (this.matchModel.resolved) this.endMatch();
    // }

    // Timeout protection
    if (this.state.elapsed >= SERVER_CONFIG.MATCH_TIMEOUT_SECONDS) {
      this.endMatch('TIMEOUT');
    }
  }

  private syncStateFromModel(): void {
    // Sync server matchModel → Colyseus schema (game-core integration hook)
    // Called once per server tick.
    // if (!this.matchModel) return;
    // this.state.hype = this.matchModel.hype;
    // this.state.elapsed = this.matchModel.elapsed;
    // ... etc
  }

  private broadcastSnapshot(): void {
    // Broadcast a compact state snapshot to all clients for interpolation.
    // The Colyseus schema patch diff already handles the heavy lifting;
    // this explicit snapshot carries additional presentation hints.
    this.snapshotSeq += 1;
    const fighters: object[] = [];
    this.state.fighters.forEach((f, sessionId) => {
      fighters.push({
        sessionId,
        health: f.health,
        stamina: f.stamina,
        momentum: f.momentum,
        posX: f.posX,
        posZ: f.posZ,
        facing: f.facing,
        velocityX: f.velocityX,
        velocityZ: f.velocityZ,
        combatState: f.combatState,
        moveId: f.moveId,
        attackPhase: f.attackPhase,
        pinCount: f.pinCount,
      });
    });
    this.broadcast('snapshot', { seq: this.snapshotSeq, elapsed: this.state.elapsed, hype: this.state.hype, announcement: this.state.announcement || null, fighters });
  }

  private endMatch(method: 'PINFALL' | 'KNOCKOUT' | 'TIMEOUT' = 'TIMEOUT', winnerSessionId = ''): void {
    this.simulationClock?.clear();
    this.snapshotClock?.clear();

    this.state.phase = 'result';
    this.state.resolved = true;
    this.state.winnerSessionId = winnerSessionId;
    this.state.winMethod = method;
    this.state.announcement = method === 'TIMEOUT' ? 'TIME LIMIT!' : method === 'KNOCKOUT' ? 'KNOCKOUT!' : 'THREE!';
    this.state.announcementTimer = 4;

    this.broadcast('matchResult', {
      winner: winnerSessionId,
      method,
      duration: this.state.elapsed,
      hype: this.state.hype,
    });

    this.log(`Match ended: ${method}, winner=${winnerSessionId || 'none'}`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private activePlayers(): PlayerSession[] {
    return [...this.sessions.values()].filter(s => s.role !== 'spectator');
  }

  private singlePlayerMode(): boolean {
    return this.activePlayers().length === 1;
  }

  private replaceWithAI(session: PlayerSession): void {
    // Mark as AI-controlled (game-core will drive input for this slot)
    this.sessions.delete(session.sessionId);
    this.state.fighters.delete(session.sessionId);
    this.state.roles.delete(session.sessionId);
    this.log(`Slot ${session.role} replaced with AI`);
  }

  private validatedFighterId(id: unknown): FighterId {
    const valid: FighterId[] = ['atlas', 'vex', 'nova', 'brick', 'chad'];
    return valid.includes(id as FighterId) ? (id as FighterId) : 'atlas';
  }

  private log(msg: string, meta?: object): void {
    const prefix = `[Room ${this.roomId}]`;
    if (meta) console.log(prefix, msg, JSON.stringify(meta));
    else console.log(prefix, msg);
  }
}
