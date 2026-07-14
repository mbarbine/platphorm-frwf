import type { GameCommand } from '../types/game';

interface BufferedCommand {
  command: GameCommand;
  issuedAt: number;
  expiresAt: number;
}

/** Device-side edge buffer. The authoritative simulation applies its own legality buffer after capture. */
export class BoundedCommandBuffer {
  private readonly entries: BufferedCommand[] = [];

  constructor(private readonly capacity = 12, private readonly ttlMs = 220) {}

  push(command: GameCommand, now = performance.now()): void {
    this.prune(now);
    this.entries.push({ command, issuedAt: now, expiresAt: now + this.ttlMs });
    if (this.entries.length > this.capacity) this.entries.splice(0, this.entries.length - this.capacity);
  }

  drain(now = performance.now()): GameCommand[] {
    this.prune(now);
    const commands = this.entries.map((entry) => entry.command);
    this.entries.length = 0;
    return commands;
  }

  clear(): void { this.entries.length = 0; }

  get size(): number { return this.entries.length; }

  private prune(now: number): void {
    let expired = 0;
    while (expired < this.entries.length && (this.entries[expired]?.expiresAt ?? Number.POSITIVE_INFINITY) < now) expired += 1;
    if (expired > 0) this.entries.splice(0, expired);
  }
}
