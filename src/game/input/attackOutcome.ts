import type { FighterRuntime } from '../types/game';

export interface AttackIdentity { moveId: string; instanceId: number }
export interface AttackOutcome extends AttackIdentity {
  sequence: number;
  outcome: 'in_progress' | 'ended' | 'interrupted';
  phase: FighterRuntime['attackPhase'];
  contact: 'none' | 'hit' | 'blocked' | 'countered';
  poseFrames: number;
  updatedAt: number;
  reason: string | null;
}

type ObservedFighter = Pick<FighterRuntime, 'moveId' | 'attackInstanceId' | 'attackPhase' | 'state'>;
const disruptiveStates = new Set<FighterRuntime['state']>(['staggered', 'grabbed', 'airborne', 'downed', 'pinned', 'defeated']);

/** Tracks one accepted input by move instance. Contact and pose evidence are independent. */
export class AttackOutcomeTracker {
  private value: AttackOutcome | null = null;

  begin(sequence: number, attack: AttackIdentity, now: number): void {
    this.value = { ...attack, sequence, outcome: 'in_progress', phase: 'anticipation', contact: 'none', poseFrames: 0, updatedAt: now, reason: null };
  }

  observe(fighter: ObservedFighter, now: number, reason?: string): boolean {
    const value = this.value;
    if (!value || value.outcome !== 'in_progress') return false;
    if (fighter.moveId === value.moveId && fighter.attackInstanceId === value.instanceId && fighter.attackPhase && !disruptiveStates.has(fighter.state)) {
      if (value.phase === fighter.attackPhase) return false;
      value.phase = fighter.attackPhase; value.updatedAt = now; return true;
    }
    const interrupted = disruptiveStates.has(fighter.state) || fighter.moveId !== null;
    value.outcome = interrupted ? 'interrupted' : 'ended';
    value.reason = interrupted ? reason ?? 'Your move was interrupted' : null;
    value.updatedAt = now;
    return true;
  }

  recordPose(attack: AttackIdentity): void {
    if (this.matches(attack) && this.value?.outcome === 'in_progress') this.value.poseFrames += 1;
  }

  recordContact(attack: AttackIdentity, contact: Exclude<AttackOutcome['contact'], 'none'>, now: number): void {
    if (!this.matches(attack) || !this.value) return;
    this.value.contact = contact; this.value.updatedAt = now;
  }

  snapshot(): Readonly<AttackOutcome> | null { return this.value ? { ...this.value } : null; }
  reset(): void { this.value = null; }
  private matches(attack: AttackIdentity): boolean {
    return this.value?.instanceId === attack.instanceId && this.value.moveId === attack.moveId;
  }
}
