import type { BodySegmentId } from './bodySchema';
import type { QuaternionValue, Vector3Value } from './motorController';
import type { FighterSlot } from '../types/game';

export interface SegmentTransform { position: Vector3Value; rotation: QuaternionValue }
export interface PhysicsReplayFrame {
  time: number;
  fighters: Readonly<Partial<Record<FighterSlot, Partial<Record<BodySegmentId, SegmentTransform>>>>>;
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

/** Shared recorded pose for camera framing; never used as live simulation authority. */
export const replayPresentation: { frame: PhysicsReplayFrame | null; focusSlots: readonly FighterSlot[] } = { frame: null, focusSlots: [] };

/** Sample by simulation time, smoothing 30 Hz recordings on faster displays. */
export function sampleReplayFrame(frames: readonly PhysicsReplayFrame[], time: number): PhysicsReplayFrame | null {
  const first = frames[0]; const last = frames[frames.length - 1];
  if (!first || !last) return null;
  if (time <= first.time) return first;
  if (time >= last.time) return last;
  let high = frames.findIndex(frame => frame.time >= time);
  if (high < 1) high = 1;
  const before = frames[high - 1]; const after = frames[high];
  if (!before || !after) return last;
  const blend = Math.max(0, Math.min(1, (time - before.time) / Math.max(1e-6, after.time - before.time)));
  const interpolate = (a: SegmentTransform, b: SegmentTransform): SegmentTransform => {
    const sign = a.rotation.x * b.rotation.x + a.rotation.y * b.rotation.y + a.rotation.z * b.rotation.z + a.rotation.w * b.rotation.w < 0 ? -1 : 1;
    const rotation = {
      x: a.rotation.x + (b.rotation.x * sign - a.rotation.x) * blend,
      y: a.rotation.y + (b.rotation.y * sign - a.rotation.y) * blend,
      z: a.rotation.z + (b.rotation.z * sign - a.rotation.z) * blend,
      w: a.rotation.w + (b.rotation.w * sign - a.rotation.w) * blend,
    };
    const magnitude = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w) || 1;
    rotation.x /= magnitude; rotation.y /= magnitude; rotation.z /= magnitude; rotation.w /= magnitude;
    return { position: {
      x: a.position.x + (b.position.x - a.position.x) * blend,
      y: a.position.y + (b.position.y - a.position.y) * blend,
      z: a.position.z + (b.position.z - a.position.z) * blend,
    }, rotation };
  };
  const fighters: Partial<Record<FighterSlot, Partial<Record<BodySegmentId, SegmentTransform>>>> = {};
  for (const side of Object.keys(before.fighters) as FighterSlot[]) {
    const segments = before.fighters[side]; if (!segments) continue;
    const output: Partial<Record<BodySegmentId, SegmentTransform>> = {};
    for (const id of Object.keys(segments) as BodySegmentId[]) {
      const a = segments[id]; const b = after.fighters[side]?.[id];
      if (a) output[id] = b ? interpolate(a, b) : a;
    }
    fighters[side] = output;
  }
  const props: Record<string, SegmentTransform> = {};
  for (const [id, a] of Object.entries(before.props)) {
    const b = after.props[id]; props[id] = b ? interpolate(a, b) : a;
  }
  return { time, fighters, props };
}
