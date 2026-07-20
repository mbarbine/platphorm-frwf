import { Room } from 'colyseus';
import type { Client, Delayed } from 'colyseus';
import { randomInt } from 'node:crypto';
import { MatchRoomStateSchema, FighterStateSchema } from './WrestlingRoomState';
import { SERVER_CONFIG } from '../config';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';
import type { ActionEvent, FighterId, PlayerRole } from '@frwf/game-protocol';
import { applyOnlineAction, createOnlineMatch, stepOnlineMatch } from '@frwf/game-core';
import type { OnlineMatchState } from '@frwf/game-core';
import { z } from 'zod';

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
interface CommandMsg { event: ActionEvent; seq: number }
interface VersionMsg { clientVersion: string }

const actionEventSchema = z.object({
  action: z.enum(['move', 'run', 'quickStrike', 'heavyStrike', 'grapple', 'guard', 'dodgeCounter', 'jump', 'propAction', 'contextAction', 'taunt', 'pause']),
  phase: z.enum(['started', 'held', 'released']),
  sequence: z.number().int().nonnegative(), timestamp: z.number().finite(),
  direction: z.object({ x: z.number().finite().min(-1).max(1), y: z.number().finite().min(-1).max(1) }),
  source: z.enum(['keyboard', 'gamepad', 'touch', 'xr', 'ai', 'replay', 'network']),
});
const commandSchema = z.object({ event: actionEventSchema, seq: z.number().int().positive() });

// ──────────────────────────────────────────────────────────────────────────────
// WrestlingRoom
// ──────────────────────────────────────────────────────────────────────────────

export class WrestlingRoom extends Room<MatchRoomStateSchema> {
  maxClients = SERVER_CONFIG.MAX_CLIENTS_PER_ROOM;

  private readonly sessions = new Map<string, PlayerSession>();
  private simulationClock?: Delayed;
  private snapshotClock?: Delayed;
  private snapshotSeq = 0;

  private matchModel: OnlineMatchState | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async onCreate(options: { ruleset?: string; difficulty?: string; private?: boolean }): Promise<void> {
    this.setState(new MatchRoomStateSchema());

    // Defensive validation of room creation options to prevent crash/DoS vectors
    let ruleset = 'standard';
    let difficulty = 'normal';
    let isPrivate = false;

    if (options && typeof options === 'object') {
      const opt = options as Record<string, unknown>;
      if (typeof opt.ruleset === 'string' && ['standard', 'chaos'].includes(opt.ruleset)) {
        ruleset = opt.ruleset;
      }
      if (typeof opt.difficulty === 'string' && ['normal', 'hard'].includes(opt.difficulty)) {
        difficulty = opt.difficulty;
      }
      if (typeof opt.private === 'boolean') {
        isPrivate = opt.private;
      }
    }

    this.state.ruleset = ruleset;
    this.state.difficulty = difficulty;
    // Use cryptographically secure pseudorandom number generator for match seeding
    this.state.seed = randomInt(0, 0xFFFFFF + 1);
    this.state.serverVersion = PROTOCOL_VERSION;
    this.state.phase = 'lobby';

    if (isPrivate) this.setPrivate(true);

    this.clock.start();

    this.registerHandlers();

    this.onMessage('version', (client, msg: VersionMsg) => {
      // Defensively check that payload is a valid object
      if (!msg || typeof msg !== 'object' || typeof msg.clientVersion !== 'string') {
        client.leave(4001); // Invalid message payload
        return;
      }
      if (msg.clientVersion !== PROTOCOL_VERSION) {
        client.send('versionRejected', { type: 'versionRejected', serverVersion: PROTOCOL_VERSION, minClientVersion: PROTOCOL_VERSION });
        client.leave(4000);
      }
    });

    this.log('Created', { ruleset: this.state.ruleset, difficulty: this.state.difficulty });
  }

  async onJoin(client: Client, options: { fighterId?: FighterId; spectate?: boolean }): Promise<void> {
    // Defensively parse join options to prevent crashes due to null/undefined or malformed inputs
    let spectate = false;
    let fighterId: unknown = undefined;

    if (options && typeof options === 'object') {
      const opt = options as Record<string, unknown>;
      if (typeof opt.spectate === 'boolean') {
        spectate = opt.spectate;
      } else if (opt.spectate != null) {
        spectate = !!opt.spectate;
      }
      fighterId = opt.fighterId;
    }

    const activePlayers = [...this.sessions.values()].filter(s => s.role !== 'spectator' && s.connected);
    const role: PlayerRole = spectate || activePlayers.length >= 2
      ? 'spectator'
      : activePlayers.length === 0 ? 'player1' : 'player2';

    const session: PlayerSession = {
      sessionId: client.sessionId,
      role,
      fighterId: this.validatedFighterId(fighterId),
      ready: false,
      connected: true,
      lastCommandSeq: 0,
    };
    this.sessions.set(client.sessionId, session);

    if (role !== 'spectator') {
      const fighterState = new FighterStateSchema();
      fighterState.definitionId = session.fighterId;
      fighterState.posX = role === 'player1' ? -2.3 : 2.3;
      fighterState.facing = role === 'player1' ? Math.PI / 2 : -Math.PI / 2;
      this.state.fighters.set(client.sessionId, fighterState);
    }
    this.state.roles.set(client.sessionId, role);

    this.log(`${client.sessionId} joined as ${role} (${session.fighterId})`);
    this.broadcastRoomState();
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
        this.log(`${client.sessionId} did not reconnect — match ends by forfeit`);
        this.resolveForfeit(session);
      }
    } else {
      this.sessions.delete(client.sessionId);
      this.state.fighters.delete(client.sessionId);
      this.state.roles.delete(client.sessionId);
      this.broadcastRoomState();
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
    this.onMessage('syncState', (client) => {
      const session = this.sessions.get(client.sessionId);
      if (!session) return;
      client.send('roomState', this.roomStateMessage());
    });
    this.onMessage('pause', (client, msg: { paused: boolean }) => {
      // Pause is only respected in single-player practice mode
      if (this.singlePlayerMode()) {
        const session = this.sessions.get(client.sessionId);
        // Authorization: Only active player can pause the single-player/practice match
        if (!session || session.role === 'spectator') return;

        // Defensively check that payload is a valid object with boolean property
        if (!msg || typeof msg !== 'object' || typeof msg.paused !== 'boolean') return;
        this.state.phase = msg.paused ? 'lobby' : 'active'; // simple toggle, full impl TBD
      }
    });
  }

  private handleSelectFighter(client: Client, msg: SelectFighterMsg): void {
    if (this.state.phase !== 'lobby' && this.state.phase !== 'selection') return;
    const session = this.sessions.get(client.sessionId);
    if (!session || session.role === 'spectator') return;
    // Defensively check that payload is a valid object
    if (!msg || typeof msg !== 'object') return;

    session.fighterId = this.validatedFighterId(msg.fighterId);
    const fighter = this.state.fighters.get(client.sessionId);
    if (fighter) fighter.definitionId = session.fighterId;
    this.state.phase = 'selection';
    this.broadcastRoomState();
    this.log(`${client.sessionId} selected ${session.fighterId}`);
  }

  private handleReady(client: Client): void {
    if (!['lobby', 'selection'].includes(this.state.phase)) return;
    const session = this.sessions.get(client.sessionId);
    if (!session || session.role === 'spectator') return;

    session.ready = true;
    const players = this.activePlayers();
    if (players.length >= 2 && players.every(s => s.ready)) this.startMatch();
    else { this.state.announcement = 'WAITING FOR SECOND WRESTLER'; this.state.announcementTimer = 0; this.broadcastRoomState(); }
  }

  private handleCommand(client: Client, msg: CommandMsg): void {
    if (this.state.phase !== 'active') return;
    const session = this.sessions.get(client.sessionId);
    if (!session || session.role === 'spectator') return;
    const parsed = commandSchema.safeParse(msg); if (!parsed.success) return;
    const command = parsed.data;

    // Reject duplicate or out-of-order commands
    if (command.seq <= session.lastCommandSeq) return;
    session.lastCommandSeq = command.seq;

    // Update last acknowledged sequence in the synchronized state
    const fighter = this.state.fighters.get(client.sessionId);
    if (fighter) fighter.lastCommandSeq = command.seq;

    const accepted = this.matchModel ? applyOnlineAction(this.matchModel, client.sessionId, command.event, command.seq) : false;
    client.send('commandAck', { type: 'commandAck', seq: command.seq, serverTimestamp: this.clock.elapsedTime, accepted });
  }

  private handleRematch(client: Client): void {
    if (this.state.phase !== 'result') return;
    const session = this.sessions.get(client.sessionId);
    // Authorization: Only active players can vote for a rematch
    if (!session || session.role === 'spectator') return;

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

    const p1 = players.find(s => s.role === 'player1');
    const p2 = players.find(s => s.role === 'player2');
    if (!p1 || !p2) return;

    this.matchModel = createOnlineMatch([
      { sessionId: p1.sessionId, fighterId: p1.fighterId },
      { sessionId: p2.sessionId, fighterId: p2.fighterId },
    ], this.state.ruleset === 'chaos' ? 'chaos' : 'standard');

    this.state.phase = 'active';
    this.state.resolved = false;
    this.state.elapsed = 0;
    this.state.announcement = 'ROUND ONE — FIGHT!';
    this.state.announcementTimer = 2.2;
    this.state.winnerSessionId = '';
    this.state.winMethod = '';
    this.syncStateFromModel();
    this.broadcastRoomState();

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

  private tick(): void {
    if (this.state.phase !== 'active') return;

    const dt = 1 / SERVER_CONFIG.SERVER_TICK_RATE;
    if (this.matchModel) {
      const impacts = stepOnlineMatch(this.matchModel, dt); this.syncStateFromModel();
      for (const impact of impacts) this.broadcast('impactEvent', { type: 'impactEvent', ...impact });
      if (this.matchModel.resolved) {
        this.endMatch(this.matchModel.winMethod || 'KNOCKOUT', this.matchModel.winnerSessionId);
        return;
      }
    } else this.state.elapsed += dt;

    // Timeout protection
    if (this.state.elapsed >= SERVER_CONFIG.MATCH_TIMEOUT_SECONDS) {
      this.endMatch('TIMEOUT');
    }
  }

  private syncStateFromModel(): void {
    const model = this.matchModel; if (!model) return;
    this.state.hype = model.hype; this.state.elapsed = model.elapsed; this.state.resolved = model.resolved;
    this.state.announcement = model.announcement; this.state.announcementTimer = model.announcementTimer;
    this.state.winnerSessionId = model.winnerSessionId; this.state.winMethod = model.winMethod;
    for (const [sessionId, source] of model.fighters) {
      let target = this.state.fighters.get(sessionId);
      if (!target) { target = new FighterStateSchema(); this.state.fighters.set(sessionId, target); }
      target.definitionId = source.fighterId; target.health = source.health; target.stamina = source.stamina; target.momentum = source.momentum;
      target.posX = source.posX; target.posZ = source.posZ; target.facing = source.facing; target.velocityX = source.velocityX; target.velocityZ = source.velocityZ;
      target.combatState = source.combatState; target.moveId = source.moveId; target.attackPhase = source.attackPhase ?? '';
      target.pinCount = source.pinCount; target.finisherPrimed = source.finisherPrimed; target.lastCommandSeq = source.lastCommandSeq;
    }
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
        definitionId: f.definitionId,
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
        phaseElapsed: this.matchModel?.fighters.get(sessionId)?.phaseElapsed ?? 0,
        grappleTargetSessionId: this.matchModel?.fighters.get(sessionId)?.grappleTarget ?? null,
        pinCount: f.pinCount,
        finisherPrimed: f.finisherPrimed,
        lastCommandSeq: f.lastCommandSeq,
      });
    });
    this.broadcast('snapshot', { type: 'snapshot', seq: this.snapshotSeq, elapsed: this.state.elapsed, hype: this.state.hype, announcement: this.state.announcement || null, fighters });
  }

  private endMatch(method: 'PINFALL' | 'KNOCKOUT' | 'TIMEOUT' | 'FORFEIT' = 'TIMEOUT', winnerSessionId = ''): void {
    this.simulationClock?.clear();
    this.snapshotClock?.clear();

    this.state.phase = 'result';
    this.state.resolved = true;
    this.state.winnerSessionId = winnerSessionId;
    this.state.winMethod = method;
    this.state.announcement = method === 'TIMEOUT' ? 'TIME LIMIT!' : method === 'FORFEIT' ? 'MATCH ENDS BY FORFEIT' : method === 'KNOCKOUT' ? 'KNOCKOUT!' : 'THREE!';
    this.state.announcementTimer = 4;

    this.broadcast('matchResult', {
      type: 'matchResult',
      winner: winnerSessionId,
      method,
      duration: this.state.elapsed,
      hype: this.state.hype,
      grade: this.state.hype >= 90 ? 'S' : this.state.hype >= 70 ? 'A' : this.state.hype >= 50 ? 'B' : this.state.hype >= 30 ? 'C' : 'D',
    });
    this.broadcastRoomState();

    this.log(`Match ended: ${method}, winner=${winnerSessionId || 'none'}`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private activePlayers(): PlayerSession[] {
    return [...this.sessions.values()].filter(s => s.role !== 'spectator');
  }

  private roomStateMessage() {
    return {
      type: 'roomState' as const,
      phase: this.state.phase as 'lobby' | 'selection' | 'countdown' | 'active' | 'result',
      roles: [...this.sessions.values()].map(({ sessionId, role }) => ({ sessionId, role })),
      fighters: [...this.sessions.values()].filter(({ role }) => role !== 'spectator').map(({ sessionId, fighterId }) => ({ sessionId, definitionId: fighterId })),
    };
  }

  private broadcastRoomState(): void { this.broadcast('roomState', this.roomStateMessage()); }

  private singlePlayerMode(): boolean {
    return this.activePlayers().length === 1;
  }

  private resolveForfeit(session: PlayerSession): void {
    const winner = this.activePlayers().find((candidate) => candidate.sessionId !== session.sessionId && candidate.connected)?.sessionId ?? '';
    if (this.state.phase === 'active') this.endMatch('FORFEIT', winner);
    this.sessions.delete(session.sessionId);
    this.state.fighters.delete(session.sessionId);
    this.state.roles.delete(session.sessionId);
    this.broadcastRoomState();
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
