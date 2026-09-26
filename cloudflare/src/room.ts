import { DurableObject } from 'cloudflare:workers';
import { applyOnlineAction, createOnlineMatch, stepOnlineMatch } from '../../packages/game-core/src/onlineSimulation';
import type { OnlineMatchState } from '../../packages/game-core/src/onlineSimulation';
import type { FighterId, MatchResultMessage, SnapshotMessage } from '../../packages/game-protocol/src/index';
import { clientMessage, digest } from './contracts';
import type { Env } from './env';

interface Seat { id: string; role: 'player1' | 'player2'; tokenHash: string; fighterId: FighterId; ready: boolean; rematch: boolean; disconnectedAt: number | null; lastSeen: number; lastSeq: number }
interface SavedRoom {
  id: string; createdAt: number; expiresAt: number; ruleset: 'standard' | 'chaos'; seats: Seat[];
  phase: 'lobby' | 'active' | 'result'; round: number; snapshotSeq: number;
  model: string | null; result: MatchResultMessage | null; persisted: boolean; completedAt: string | null;
}
// Serialize the complete authoritative model, including attack deduplication.
const serialize = (model: OnlineMatchState) => JSON.stringify(model, (_key, value) => value instanceof Map ? { $map: [...value] } : value instanceof Set ? { $set: [...value] } : value);
const deserialize = (value: string): OnlineMatchState => JSON.parse(value, (_key, item) => item?.$map ? new Map(item.$map) : item?.$set ? new Set(item.$set) : item);

export class MatchRoom extends DurableObject<Env> {
  private room: SavedRoom | null = null;
  private model: OnlineMatchState | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private accumulator = 0;
  private rates = new Map<string, { second: number; count: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK(id = 1), state TEXT NOT NULL)');
    const row = ctx.storage.sql.exec<{ state: string }>('SELECT state FROM room WHERE id = 1').toArray()[0];
    if (row) { this.room = JSON.parse(row.state); this.model = this.room?.model ? deserialize(this.room.model) : null; }
    if (this.room?.phase === 'active') this.startClock();
  }

  async initialize(id: string, ruleset: 'standard' | 'chaos') {
    if (this.room) throw new Error('Room already exists');
    const tokens = [crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''), crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')];
    const now = Date.now();
    const seats: Seat[] = await Promise.all(tokens.map(async (token, index) => ({ id: crypto.randomUUID(), role: index === 0 ? 'player1' as const : 'player2' as const, tokenHash: await digest(token), fighterId: index === 0 ? 'atlas' as const : 'nova' as const, ready: false, rematch: false, disconnectedAt: now, lastSeen: now, lastSeq: 0 })));
    this.room = { id, createdAt: now, expiresAt: now + 3600000, ruleset, seats, phase: 'lobby', round: 0, snapshotSeq: 0, model: null, result: null, persisted: true, completedAt: null };
    this.save(); await this.ctx.storage.setAlarm(now + 60000);
    return { roomId: id, expiresAt: this.room.expiresAt, tickets: tokens.map((ticket, index) => ({ role: seats[index]?.role, ticket })) };
  }

  async fetch(request: Request): Promise<Response> {
    const room = this.room;
    if (!room || Date.now() > room.expiresAt) return Response.json({ ok: false, error: { code: 'room_expired' } }, { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response(null, { status: 426 });
    const protocols = request.headers.get('Sec-WebSocket-Protocol')?.split(',').map(value => value.trim()) ?? [];
    const ticket = protocols.find(value => /^[a-f0-9]{64}$/.test(value));
    if (!ticket || !protocols.includes('frwf-v1')) return new Response(null, { status: 401 });
    const hash = await digest(ticket); const seat = room.seats.find(candidate => candidate.tokenHash === hash);
    if (!seat) return new Response(null, { status: 401 });
    if (seat.disconnectedAt !== null && room.phase === 'active' && Date.now() - seat.disconnectedAt > 30000) return new Response(null, { status: 410 });
    for (const socket of this.ctx.getWebSockets(seat.id)) socket.close(4001, 'Session resumed elsewhere');
    seat.disconnectedAt = null; seat.lastSeen = Date.now(); this.save();
    const pair = new WebSocketPair(); this.ctx.acceptWebSocket(pair[1], [seat.id]);
    pair[1].serializeAttachment({ seatId: seat.id });
    this.send(pair[1], { type: 'welcome', roomId: room.id, sessionId: seat.id, lastCommandSeq: seat.lastSeq });
    this.broadcastState(); if (this.model) this.broadcastSnapshot();
    if (room.result) this.send(pair[1], room.result);
    return new Response(null, { status: 101, webSocket: pair[0], headers: { 'Sec-WebSocket-Protocol': 'frwf-v1' } });
  }

  webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > 4096) { socket.close(1009, 'Message too large'); return; }
    const attachment = socket.deserializeAttachment() as { seatId: string };
    const seat = this.room?.seats.find(candidate => candidate.id === attachment.seatId); if (!seat || !this.room) return;
    const second = Math.floor(Date.now() / 1000); const rate = this.rates.get(seat.id);
    const count = rate?.second === second ? rate.count + 1 : 1; this.rates.set(seat.id, { second, count });
    if (count > 120) { socket.close(1008, 'Message rate exceeded'); return; }
    let json: unknown; try { json = JSON.parse(raw); } catch { socket.close(1008, 'Invalid JSON'); return; }
    const parsed = clientMessage.safeParse(json); if (!parsed.success) { this.send(socket, { type: 'error', code: 'invalid_message' }); return; }
    const message = parsed.data; seat.lastSeen = Date.now();
    if (message.type === 'ping') { this.send(socket, { type: 'pong', clientTimestamp: message.clientTimestamp, serverTimestamp: Date.now() }); return; }
    if (message.type === 'command') {
      const accepted = this.room.phase === 'active' && !!this.model && message.seq > seat.lastSeq && message.seq === message.event.sequence
        && applyOnlineAction(this.model, seat.id, message.event, message.seq);
      if (message.seq > seat.lastSeq) seat.lastSeq = message.seq;
      this.save(); this.send(socket, { type: 'commandAck', seq: message.seq, accepted, serverTimestamp: Date.now() }); return;
    }
    if (message.type === 'selectFighter' && this.room.phase === 'lobby') { seat.fighterId = message.fighterId; seat.ready = false; }
    if (message.type === 'ready' && this.room.phase === 'lobby') seat.ready = true;
    if (message.type === 'rematch' && this.room.phase === 'result' && this.room.persisted) seat.rematch = true;
    if ((this.room.phase === 'lobby' && this.room.seats.every(player => player.ready && player.disconnectedAt === null))
      || (this.room.phase === 'result' && this.room.seats.every(player => player.rematch && player.disconnectedAt === null))) this.beginMatch();
    this.save(); this.broadcastState();
  }

  webSocketClose(socket: WebSocket) {
    const attachment = socket.deserializeAttachment() as { seatId: string };
    if (this.ctx.getWebSockets(attachment.seatId).some(other => other !== socket && other.readyState === 1)) return;
    const seat = this.room?.seats.find(candidate => candidate.id === attachment.seatId);
    if (seat) { seat.disconnectedAt = Date.now(); seat.ready = false; seat.rematch = false; this.save(); }
    socket.close(1000, 'Closed');
  }
  webSocketError(socket: WebSocket) { this.webSocketClose(socket); }

  private beginMatch() {
    const room = this.room; const first = room?.seats[0]; const second = room?.seats[1]; if (!room || !first || !second) return;
    this.model = createOnlineMatch([{ sessionId: first.id, fighterId: first.fighterId }, { sessionId: second.id, fighterId: second.fighterId }], room.ruleset);
    // Resume sequence across rematches so late packets from a previous round stay invalid.
    for (const seat of room.seats) { const fighter = this.model.fighters.get(seat.id); if (fighter) fighter.lastCommandSeq = seat.lastSeq; seat.rematch = false; }
    room.round++; room.phase = 'active'; room.result = null; room.completedAt = null; room.persisted = false;
    this.save(); this.startClock();
  }

  private startClock() {
    if (this.timer) return; this.lastTick = Date.now(); this.accumulator = 0;
    this.timer = setInterval(() => this.tick(), 1000 / 30);
  }
  private tick() {
    if (!this.room || !this.model || this.room.phase !== 'active') return;
    const now = Date.now(); this.accumulator += Math.min(.1, Math.max(0, (now - this.lastTick) / 1000)); this.lastTick = now;
    for (const seat of this.room.seats) {
      if (seat.disconnectedAt === null && now - seat.lastSeen > 30000) { seat.disconnectedAt = now; for (const ws of this.ctx.getWebSockets(seat.id)) ws.close(4000, 'Heartbeat timeout'); }
      if (seat.disconnectedAt !== null && now - seat.disconnectedAt > 30000) {
        const winner = this.room.seats.find(player => player.id !== seat.id && player.disconnectedAt === null)?.id ?? '';
        this.finish('FORFEIT', winner); return;
      }
    }
    while (this.accumulator >= 1 / 30) {
      this.accumulator -= 1 / 30;
      for (const impact of stepOnlineMatch(this.model, 1 / 30)) this.broadcast({ type: 'impactEvent', ...impact });
    }
    this.save(); this.broadcastSnapshot();
    if (this.model.resolved) this.finish('KNOCKOUT', this.model.winnerSessionId);
    else if (this.model.elapsed >= 600 || now >= this.room.expiresAt) this.finish('TIMEOUT', '');
  }
  private finish(method: 'KNOCKOUT' | 'TIMEOUT' | 'FORFEIT', winner: string) {
    if (!this.room || !this.model) return;
    if (this.timer) clearInterval(this.timer); this.timer = null;
    this.model.resolved = true; this.model.winnerSessionId = winner; this.model.winMethod = method;
    const hype = this.model.hype;
    this.room.phase = 'result'; this.room.completedAt = new Date().toISOString();
    this.room.result = { type: 'matchResult', winner, method, duration: this.model.elapsed, hype, grade: hype >= 90 ? 'S' : hype >= 70 ? 'A' : hype >= 50 ? 'B' : hype >= 30 ? 'C' : 'D' };
    this.save(); this.broadcast(this.room.result); this.broadcastState();
    this.ctx.waitUntil(this.persistResult());
  }
  private async persistResult() {
    const room = this.room; if (!room?.result || room.persisted) return;
    try {
      if (!this.env.DB) throw new Error('D1 not configured');
      await this.env.DB.prepare('INSERT OR IGNORE INTO match_results (match_id,map_id,ruleset,release,winner_fighter,method,duration,hype,completed_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(`${room.id}:${room.round}`, 'volt-dome', room.ruleset, this.env.RELEASE, room.seats.find(seat => seat.id === room.result?.winner)?.fighterId ?? null, room.result.method, room.result.duration, room.result.hype, room.completedAt).run();
      room.persisted = true; this.save(); this.broadcast({ type: 'persistence', status: 'saved' });
    } catch { this.broadcast({ type: 'persistence', status: 'degraded' }); await this.ctx.storage.setAlarm(Date.now() + 15000); }
  }
  async alarm() {
    if (!this.room) return;
    if (this.room.result && !this.room.persisted) { await this.persistResult(); if (!this.room.persisted) return; }
    if (Date.now() >= this.room.expiresAt && this.room.phase !== 'active') {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'Room expired');
      await this.ctx.storage.deleteAll(); this.room = null; this.model = null; return;
    }
    await this.ctx.storage.setAlarm(Date.now() + 60000);
  }
  private save() {
    if (!this.room) return; this.room.model = this.model ? serialize(this.model) : null;
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO room(id,state) VALUES (1,?)', JSON.stringify(this.room));
  }
  private send(socket: WebSocket, message: unknown) { try { socket.send(JSON.stringify(message)); } catch { socket.close(1011, 'Connection unavailable'); } }
  private broadcast(message: unknown) { for (const socket of this.ctx.getWebSockets()) this.send(socket, message); }
  private broadcastState() {
    if (!this.room) return;
    this.broadcast({ type: 'roomState', phase: this.room.phase, roles: this.room.seats.map(({ id, role }) => ({ sessionId: id, role })), fighters: this.room.seats.map(({ id, fighterId }) => ({ sessionId: id, definitionId: fighterId })) });
  }
  private broadcastSnapshot() {
    if (!this.room || !this.model) return;
    const message: SnapshotMessage = { type: 'snapshot', seq: ++this.room.snapshotSeq, elapsed: this.model.elapsed, hype: this.model.hype, announcement: this.model.announcement,
      fighters: [...this.model.fighters.values()].map(fighter => ({ ...fighter, sessionId: fighter.sessionId, definitionId: fighter.fighterId, attackPhase: fighter.attackPhase ?? '', grappleTargetSessionId: fighter.grappleTarget })) };
    this.broadcast(message);
  }
}
