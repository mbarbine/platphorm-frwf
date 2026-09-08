import type { ActionEvent } from './actionLayer';
import type { FrameInput } from '../systems/combat';
import type { MatchModel, Vec2 } from '../types/game';
import { GRAPPLE_ACQUISITION_RANGE } from '../systems/moveSelection';

export type ControlStyle = 'arcade' | 'technical';

/** Movement never silently changes the basic attack in Arcade controls. */
export function combatInputDirection(direction: Vec2, style: ControlStyle): Vec2 {
  return style === 'arcade' ? { x: 0, z: 0 } : direction;
}

export function planarInputVelocity(direction: Vec2, speed: number): Vec2 {
  const magnitude = Math.hypot(direction.x, direction.z);
  if (!Number.isFinite(magnitude) || magnitude < .001) return { x: 0, z: 0 };
  const scale = speed / Math.max(1, magnitude);
  return { x: direction.x * scale, z: direction.z * scale };
}

/** A short, cancellable physical step into a clinch; never teleports or awards contact. */
export class PlayerController {
  private pending: { event: ActionEvent; expiresAt: number; target: string } | null = null;
  private runtimeId = -1;

  reset(): void { this.pending = null; }

  read(input: FrameInput, model: MatchModel, style: ControlStyle): FrameInput {
    if (this.runtimeId !== model.runtimeId) { this.reset(); this.runtimeId = model.runtimeId; }
    if (model.paused || model.resolved || model.networkAuthority || model.labMode || style === 'technical') { this.reset(); return input; }
    const actor = model.player; const target = model[model.targets.player];
    const dx = target.position.x - actor.position.x; const dz = target.position.z - actor.position.z;
    const distance = Math.hypot(dx, dz);
    const standing = ['idle', 'locomotion'].includes(actor.state);
    const actions: ActionEvent[] = [];
    for (const event of input.actions ?? []) {
      const normalized = ['quickStrike', 'heavyStrike', 'grapple'].includes(event.action)
        ? { ...event, direction: { x: 0, y: 0 } } : event;
      if (event.phase === 'started' && event.action === 'grapple' && standing && !model.grapple
        && distance > GRAPPLE_ACQUISITION_RANGE && distance <= 2.3 && !['downed', 'defeated', 'victorious'].includes(target.state)) {
        this.pending = { event: normalized, expiresAt: model.elapsed + .45, target: model.targets.player };
      } else {
        if (event.phase === 'started' && ['quickStrike', 'heavyStrike', 'dodgeCounter', 'jump'].includes(event.action)) this.reset();
        actions.push(normalized);
      }
    }
    if (this.pending) {
      const retreating = input.move.x * dx + input.move.z * dz < -.1;
      if (!standing || input.block || retreating || this.pending.expiresAt < model.elapsed || this.pending.target !== model.targets.player) this.reset();
      else if (distance <= GRAPPLE_ACQUISITION_RANGE) { actions.push(this.pending.event); this.reset(); }
      else return { ...input, move: { x: dx / Math.max(.001, distance), z: dz / Math.max(.001, distance) }, run: false, actions };
    }
    return { ...input, actions };
  }
}
