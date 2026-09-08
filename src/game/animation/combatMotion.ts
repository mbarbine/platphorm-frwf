import { Euler, Quaternion } from 'three';
import data from './generated/combat-motions.json';
import type { Pose } from './poses';
import type { AttackPhase, MoveDefinition } from '../types/game';

interface MotionClip { duration: number; contact: number | null; frames: { time: number; pose: Pose }[] }
const clips = data.clips as unknown as Record<string, MotionClip>;
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const rotations = ['torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
const hinges = ['leftForearm', 'rightForearm', 'leftShin', 'rightShin'] as const;
const qa = new Quaternion(); const qb = new Quaternion(); const ea = new Euler(); const eb = new Euler();

/** Shortest-arc interpolation avoids Euler wrap snaps in imported shoulder motion. */
function blend(a: Pose, b: Pose, amount: number): Pose {
  const p = { ...a };
  for (const key of rotations) {
    qa.setFromEuler(ea.set(...a[key])); qb.setFromEuler(eb.set(...b[key]));
    ea.setFromQuaternion(qa.slerp(qb, amount)); p[key] = [ea.x, ea.y, ea.z];
  }
  for (const key of hinges) p[key] = [a[key][0] + (b[key][0] - a[key][0]) * amount, 0, 0];
  for (const key of ['rootX', 'rootY', 'rootZ', 'rootTilt', 'rootYaw', 'rootRoll'] as const) p[key] = a[key] + (b[key] - a[key]) * amount;
  return p;
}

export function sampleCombatMotion(id: string, seconds: number): Pose | null {
  const clip = clips[id]; if (!clip) return null;
  const t = clamp(seconds, 0, clip.duration);
  const index = Math.min(clip.frames.length - 2, Math.floor(t * 30));
  const a = clip.frames[index]; const b = clip.frames[index + 1];
  if (!a || !b) return null;
  return blend(a.pose, b.pose, clamp((t - a.time) / Math.max(.0001, b.time - a.time)));
}

export function authoredStrikePose(base: Pose, move: MoveDefinition, phase: AttackPhase, elapsed: number): Pose {
  const clip = clips[move.id]; if (!clip || clip.contact === null) return base;
  const loadEnd = Math.max(0, clip.contact - .1);
  const strikeEnd = Math.min(clip.duration, clip.contact + .06);
  const progress = phase === 'anticipation' ? clamp(elapsed / move.anticipationDuration)
    : phase === 'active' ? clamp((elapsed - move.anticipationDuration) / move.activeDuration)
      : clamp((elapsed - move.anticipationDuration - move.activeDuration) / move.recoveryDuration);
  const time = phase === 'anticipation' ? progress * loadEnd
    : phase === 'active' ? loadEnd + progress * (strikeEnd - loadEnd)
      : strikeEnd + progress * (clip.duration - strikeEnd);
  const captured = sampleCombatMotion(move.id, time); if (!captured) return base;
  // Rapier owns foot placement and root travel. Captured hip/shoulder timing
  // drives the same physical limbs that score contact, never a separate skin.
  const envelope = phase === 'anticipation' ? clamp(progress * 4) : phase === 'recovery' ? clamp((1 - progress) * 3) : 1;
  const result = blend(base, captured, .65 * envelope);
  result.rootX = base.rootX; result.rootY = base.rootY; result.rootZ = base.rootZ;
  result.rootTilt = clamp(result.rootTilt, -.22, .22); result.rootRoll = clamp(result.rootRoll, -.18, .18);
  result.rootYaw = base.rootYaw + clamp(captured.rootYaw - base.rootYaw, -.45, .45) * .35 * envelope;
  for (const side of ['left', 'right'] as const) {
    // Preserve the support leg; a captured airborne kick must not pull both
    // physical feet off the ground during a standing wrestling strike.
    if (!move.id.includes('kick') && move.id !== 'roundhouse' || side === 'left') {
      const support = blend(base, captured, .18 * envelope);
      result[`${side}Leg`] = support[`${side}Leg`]; result[`${side}Shin`] = support[`${side}Shin`];
    }
  }
  return result;
}

export function authoredIdlePose(base: Pose, elapsed: number): Pose {
  const clip = clips.fighting_idle; if (!clip) return base;
  const phase = (elapsed % (clip.duration * 2)) / clip.duration;
  const captured = sampleCombatMotion('fighting_idle', (phase <= 1 ? phase : 2 - phase) * clip.duration);
  if (!captured) return base;
  const result = blend(base, captured, .6 * clamp(elapsed * 2));
  result.leftLeg = base.leftLeg; result.rightLeg = base.rightLeg; result.leftShin = base.leftShin; result.rightShin = base.rightShin;
  result.rootTilt = base.rootTilt; result.rootYaw = base.rootYaw; result.rootRoll = base.rootRoll;
  return result;
}
