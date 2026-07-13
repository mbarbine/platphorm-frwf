import type { BodySegmentId } from './bodySchema';
import type { QuaternionValue, Vector3Value } from './motorController';

export interface SegmentTransform { position: Vector3Value; rotation: QuaternionValue }
export interface PhysicsReplayFrame {
  time: number;
  fighters: Readonly<Record<'player' | 'opponent', Partial<Record<BodySegmentId, SegmentTransform>>>>;
  props: Readonly<Record<string, SegmentTransform>>;
}

export class PhysicsReplayBuffer {
  private readonly frames: Array<PhysicsReplayFrame | undefined>;
  private cursor = 0;
  private count = 0;

  constructor(readonly capacity = 300) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Replay capacity must be a positive integer');
    this.frames = new Array<PhysicsReplayFrame | undefined>(capacity);
  }

  push(frame: PhysicsReplayFrame): void {
    this.frames[this.cursor] = frame;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.count = Math.min(this.capacity, this.count + 1);
  }

  chronological(): readonly PhysicsReplayFrame[] {
    const result: PhysicsReplayFrame[] = [];
    const start = (this.cursor - this.count + this.capacity) % this.capacity;
    for (let index = 0; index < this.count; index += 1) {
      const frame = this.frames[(start + index) % this.capacity];
      if (frame) result.push(frame);
    }
    return result;
  }

  clear(): void { this.frames.fill(undefined); this.cursor = 0; this.count = 0; }
  get size(): number { return this.count; }
}
