import { actionPriority } from './actionLayer';
import type { ActionEvent } from './actionLayer';

export interface ActionBufferMetrics {
  buffered: number;
  executed: number;
  expired: number;
  rejected: number;
  duplicate: number;
  averageWaitMs: number;
  maximumWaitMs: number;
}

export type ActionResolution = 'executed' | 'rejected' | 'defer';

interface BufferedAction<T> {
  payload: T;
  event: ActionEvent;
  queuedAt: number;
  expiresAt: number;
  priority: number;
}

export interface ActionBufferOptions {
  capacity?: number;
  defaultTtlMs?: number;
  contextTtlMs?: number;
  duplicateWindowMs?: number;
}

const EMPTY_METRICS = (): ActionBufferMetrics => ({
  buffered: 0,
  executed: 0,
  expired: 0,
  rejected: 0,
  duplicate: 0,
  averageWaitMs: 0,
  maximumWaitMs: 0,
});

/** One authoritative, bounded action buffer with deterministic sequencing and observability. */
export class ActionBuffer<T> {
  private readonly entries: BufferedAction<T>[] = [];
  private readonly state = EMPTY_METRICS();
  private totalExecutionWaitMs = 0;
  private readonly capacity: number;
  private readonly defaultTtlMs: number;
  private readonly contextTtlMs: number;
  private readonly duplicateWindowMs: number;

  constructor(options: ActionBufferOptions = {}) {
    this.capacity = options.capacity ?? 32;
    this.defaultTtlMs = options.defaultTtlMs ?? 150;
    this.contextTtlMs = options.contextTtlMs ?? 110;
    this.duplicateWindowMs = options.duplicateWindowMs ?? 48;
  }

  push(payload: T, event: ActionEvent, nowMs: number): boolean {
    this.prune(nowMs);
    const duplicate = this.entries.some((entry) => entry.event.action === event.action
      && entry.event.source === event.source
      && entry.event.phase === event.phase
      && Math.abs(entry.queuedAt - nowMs) <= this.duplicateWindowMs);
    if (duplicate) {
      this.state.duplicate += 1;
      return false;
    }
    const ttlMs = event.action === 'contextAction' || event.action === 'propAction' ? this.contextTtlMs : this.defaultTtlMs;
    this.entries.push({ payload, event, queuedAt: nowMs, expiresAt: nowMs + ttlMs, priority: actionPriority(event.action) });
    this.state.buffered += 1;
    if (this.entries.length > this.capacity) {
      this.entries.sort(ActionBuffer.compare);
      this.entries.shift();
      this.state.rejected += 1;
    }
    return true;
  }

  resolveNext(nowMs: number, eligible: (payload: T) => boolean, attempt: (payload: T) => ActionResolution, onExpired?: (payload: T) => void): ActionResolution | null {
    this.prune(nowMs, onExpired);
    const candidates = this.entries.filter((entry) => eligible(entry.payload)).sort(ActionBuffer.compare);
    const next = candidates[0];
    if (!next) return null;
    const resolution = attempt(next.payload);
    if (resolution === 'defer') return resolution;
    const index = this.entries.indexOf(next);
    if (index >= 0) this.entries.splice(index, 1);
    if (resolution === 'rejected') {
      this.state.rejected += 1;
      return resolution;
    }
    const waitMs = Math.max(0, nowMs - next.queuedAt);
    this.state.executed += 1;
    this.totalExecutionWaitMs += waitMs;
    this.state.averageWaitMs = this.totalExecutionWaitMs / this.state.executed;
    this.state.maximumWaitMs = Math.max(this.state.maximumWaitMs, waitMs);
    return resolution;
  }

  clear(resetMetrics = false): void {
    this.entries.length = 0;
    if (resetMetrics) {
      Object.assign(this.state, EMPTY_METRICS());
      this.totalExecutionWaitMs = 0;
    }
  }

  get size(): number { return this.entries.length; }
  get metrics(): Readonly<ActionBufferMetrics> { return { ...this.state }; }

  private prune(nowMs: number, onExpired?: (payload: T) => void): void {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      if (!entry || entry.expiresAt >= nowMs) continue;
      this.entries.splice(index, 1);
      this.state.expired += 1;
      onExpired?.(entry.payload);
    }
  }

  private static compare<T>(left: BufferedAction<T>, right: BufferedAction<T>): number {
    return left.event.sequence - right.event.sequence || right.priority - left.priority || left.queuedAt - right.queuedAt;
  }
}
