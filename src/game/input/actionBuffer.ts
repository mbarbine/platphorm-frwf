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
export type ActionPushResult = 'buffered' | 'duplicate' | 'rejected';

export const ACTION_BUFFER_DEFAULT_TTL_MS = 150;
export const ACTION_BUFFER_CONTEXT_TTL_MS = 110;
export const ACTION_BUFFER_DUPLICATE_WINDOW_MS = 32;

interface BufferedAction<T> {
  payload: T;
  event: ActionEvent;
  queuedAt: number;
  expiresAt: number;
  priority: number;
  dedupeKey: string;
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
    this.defaultTtlMs = options.defaultTtlMs ?? ACTION_BUFFER_DEFAULT_TTL_MS;
    this.contextTtlMs = options.contextTtlMs ?? ACTION_BUFFER_CONTEXT_TTL_MS;
    this.duplicateWindowMs = options.duplicateWindowMs ?? ACTION_BUFFER_DUPLICATE_WINDOW_MS;
  }

  push(payload: T, event: ActionEvent, nowMs: number, dedupeKey = `${event.source}:${event.action}:${event.phase}`): ActionPushResult {
    this.prune(nowMs);
    const duplicate = this.entries.some((entry) => entry.dedupeKey === dedupeKey
      && Math.abs(entry.queuedAt - nowMs) <= this.duplicateWindowMs);
    if (duplicate) {
      this.state.duplicate += 1;
      return 'duplicate';
    }
    if (this.entries.length >= this.capacity) {
      this.state.rejected += 1;
      return 'rejected';
    }
    const ttlMs = event.action === 'contextAction' || event.action === 'propAction' ? this.contextTtlMs : this.defaultTtlMs;
    this.entries.push({ payload, event, queuedAt: nowMs, expiresAt: nowMs + ttlMs, priority: actionPriority(event.action), dedupeKey });
    this.state.buffered += 1;
    return 'buffered';
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

  rejectWhere(predicate: (payload: T) => boolean, onRejected?: (payload: T) => void): number {
    let rejected = 0;
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      if (!entry || !predicate(entry.payload)) continue;
      this.entries.splice(index, 1);
      this.state.rejected += 1;
      rejected += 1;
      onRejected?.(entry.payload);
    }
    return rejected;
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
    return right.priority - left.priority || left.event.sequence - right.event.sequence || left.queuedAt - right.queuedAt;
  }
}
